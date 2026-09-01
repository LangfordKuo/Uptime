<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <PageHeader :title="monitor.name || '监控详情'" :back-to="null">
      <template #extra>
        <Badge v-if="monitor.inMaintenance" variant="warning" class="gap-1">
          <Wrench class="size-3" /> 维护中
        </Badge>
        <Badge :variant="statusVariant" class="gap-1">{{ statusText }}</Badge>
      </template>
      <Button variant="outline" size="sm" :loading="checking" @click="handleCheckNow">
        <Play />
        立即检测
      </Button>
      <Button variant="outline" size="sm" @click="refreshData">
        <RefreshCw />
        刷新
      </Button>
      <Button variant="outline" size="sm" @click="$router.push(`/monitors/${$route.params.id}/edit`)">
        <Pencil />
        编辑
      </Button>
      <Button variant="destructive" size="sm" @click="handleDelete">
        <Trash2 />
        删除
      </Button>
    </PageHeader>

    <div v-if="loading" class="flex justify-center py-24">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Push 推送地址 -->
      <Card v-if="monitor.type === 'push' && monitor.push_token">
        <CardHeader>
          <CardTitle>推送地址</CardTitle>
          <CardDescription>
            定期请求此 URL 表示服务存活（心跳周期 {{ monitor.config?.period || 300 }} 秒，超时 1.5 倍判定故障）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex gap-2">
            <Input :model-value="pushUrl" readonly class="font-mono text-xs" />
            <Button variant="outline" size="icon" class="shrink-0" @click="copyText(pushUrl)">
              <Copy />
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- SSL 证书信息 -->
      <Card v-if="monitor.type === 'ssl' && monitor.latestExtra">
        <CardHeader>
          <CardTitle>证书信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <div class="text-xs text-muted-foreground mb-1.5">剩余天数</div>
              <Badge :variant="(monitor.latestExtra.daysRemaining ?? 0) < 14 ? 'destructive' : 'success'">
                {{ monitor.latestExtra.daysRemaining }} 天
              </Badge>
            </div>
            <div>
              <div class="text-xs text-muted-foreground mb-1.5">到期时间</div>
              <div class="text-sm font-medium">{{ monitor.latestExtra.validTo }}</div>
            </div>
            <div>
              <div class="text-xs text-muted-foreground mb-1.5">颁发者</div>
              <div class="text-sm font-medium">{{ monitor.latestExtra.issuer || '-' }}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 统计卡片 -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card v-for="stat in statCards" :key="stat.label" class="gap-0 py-0">
          <CardContent class="px-5 py-5">
            <div class="text-xs text-muted-foreground">{{ stat.label }}</div>
            <div class="mt-1 text-2xl font-bold tabular-nums leading-none" :class="stat.class">{{ stat.value }}</div>
          </CardContent>
        </Card>
      </div>

      <!-- 响应时间趋势 -->
      <Card>
        <CardHeader>
          <div class="flex w-full flex-wrap items-center justify-between gap-3">
            <CardTitle>响应时间趋势</CardTitle>
            <Tabs v-model="chartRange" @update:model-value="refreshData">
              <TabsList>
                <TabsTrigger value="24" class="flex-none px-3">24小时</TabsTrigger>
                <TabsTrigger value="168" class="flex-none px-3">7天</TabsTrigger>
                <TabsTrigger value="720" class="flex-none px-3">30天</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div ref="chartRef" class="h-72 w-full" />
        </CardContent>
      </Card>

      <Tabs v-model="activeTab">
        <TabsList class="w-full sm:w-auto">
          <TabsTrigger value="results" class="flex-none px-4">最近检测结果</TabsTrigger>
          <TabsTrigger value="maintenance" class="flex-none px-4">维护窗口</TabsTrigger>
          <TabsTrigger value="incidents" class="flex-none px-4">故障事件</TabsTrigger>
        </TabsList>

        <!-- 检测结果 -->
        <TabsContent value="results">
          <Card class="py-0">
            <CardContent class="px-0 pb-0" v-if="results.length > 0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="pl-5">状态</TableHead>
                    <TableHead>响应时间</TableHead>
                    <TableHead>状态码</TableHead>
                    <TableHead>错误信息</TableHead>
                    <TableHead class="pr-5 text-right">检测时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in results" :key="row.id">
                    <TableCell class="pl-5">
                      <Badge :variant="row.status === 'up' ? 'success' : 'destructive'">
                        {{ row.status === 'up' ? '正常' : '故障' }}
                      </Badge>
                    </TableCell>
                    <TableCell>{{ row.response_time != null ? row.response_time + 'ms' : '-' }}</TableCell>
                    <TableCell>{{ row.status_code ?? '-' }}</TableCell>
                    <TableCell class="max-w-72 truncate text-muted-foreground" :title="row.error_message">
                      {{ row.error_message || '-' }}
                    </TableCell>
                    <TableCell class="pr-5 text-right text-muted-foreground">{{ formatDateTime(row.checked_at) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
            <CardContent v-else>
              <Empty description="暂无检测记录" />
            </CardContent>
          </Card>
        </TabsContent>

        <!-- 维护窗口 -->
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <div class="flex w-full items-center justify-between gap-3">
                <div>
                  <CardTitle>维护窗口</CardTitle>
                  <CardDescription>维护期间暂停检测、不触发告警、不计入可用率</CardDescription>
                </div>
                <Button size="sm" @click="maintenanceDialog = true">
                  <Plus />
                  添加窗口
                </Button>
              </div>
            </CardHeader>
            <CardContent v-if="maintenanceWindows.length > 0" class="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="pl-6">名称</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead class="pr-6 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in maintenanceWindows" :key="row.id">
                    <TableCell class="pl-6">{{ row.name || '（未命名）' }}</TableCell>
                    <TableCell>{{ formatDateTime(row.start_at) }}</TableCell>
                    <TableCell>{{ formatDateTime(row.end_at) }}</TableCell>
                    <TableCell>
                      <Badge v-if="isWindowActive(row)" variant="warning">进行中</Badge>
                      <Badge v-else-if="new Date(row.end_at) < new Date()" variant="secondary">已结束</Badge>
                      <Badge v-else variant="success">未开始</Badge>
                    </TableCell>
                    <TableCell class="pr-6 text-right">
                      <Button variant="ghost" size="sm" class="text-destructive" @click="handleDeleteMaintenance(row)">
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
            <CardContent v-else>
              <Empty description="暂无维护窗口" />
            </CardContent>
          </Card>
        </TabsContent>

        <!-- 故障事件 -->
        <TabsContent value="incidents">
          <Card v-if="incidents.length > 0">
            <CardContent class="space-y-0">
              <div class="relative space-y-6 border-l pl-6 ml-2">
                <div v-for="incident in incidents" :key="incident.id" class="relative">
                  <span
                    class="absolute -left-[1.9rem] top-1 size-2.5 rounded-full border-2 border-background"
                    :class="incident.ended_at ? 'bg-success' : 'bg-destructive anim-pulse-dot'"
                  />
                  <div class="flex flex-wrap items-center gap-2">
                    <Badge :variant="incident.ended_at ? 'success' : 'destructive'">
                      {{ incident.ended_at ? '已恢复' : '故障中' }}
                    </Badge>
                    <span class="text-sm text-muted-foreground">
                      持续 {{ formatDuration(incident.duration) }}
                    </span>
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    {{ formatDateTime(incident.started_at) }} ~
                    {{ incident.ended_at ? formatDateTime(incident.ended_at) : '进行中' }}
                  </div>
                  <div v-if="incident.error_message" class="mt-1 text-xs text-muted-foreground/80 break-all">
                    {{ incident.error_message }}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card v-else>
            <CardContent>
              <Empty description="暂无故障事件" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </template>

    <!-- 添加维护窗口对话框 -->
    <Dialog :open="maintenanceDialog" @update:open="maintenanceDialog = $event" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>添加维护窗口</DialogTitle>
        <DialogDescription>该时间段内暂停检测、不触发告警、不计入可用率</DialogDescription>
      </DialogHeader>
      <div class="space-y-4">
        <div class="space-y-2">
          <Label>名称</Label>
          <Input v-model="maintenanceForm.name" placeholder="例如: 系统升级（可选）" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label>开始时间</Label>
            <Input v-model="maintenanceForm.start" type="datetime-local" />
          </div>
          <div class="space-y-2">
            <Label>结束时间</Label>
            <Input v-model="maintenanceForm.end" type="datetime-local" />
          </div>
        </div>
      </div>
      <DialogFooter class="mt-2">
        <Button variant="outline" @click="maintenanceDialog = false">取消</Button>
        <Button @click="handleAddMaintenance">确定</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import {
  Wrench, Play, RefreshCw, Pencil, Trash2, Loader2, Copy, Plus
} from 'lucide-vue-next'
import { loadTimezoneSettings, formatWithSystemTimezone } from '@/utils/timezone'
import { monitorApi } from '@/api'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.js'
import Badge from '@/components/ui/badge.js'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Empty from '@/components/ui/Empty.vue'
import Separator from '@/components/ui/separator.js'
import PageHeader from '@/components/ui/PageHeader.vue'
import Dialog from '@/components/ui/Dialog.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'
import DialogFooter from '@/components/ui/DialogFooter.vue'
import Tabs from '@/components/ui/Tabs.vue'
import TabsList from '@/components/ui/TabsList.vue'
import TabsTrigger from '@/components/ui/TabsTrigger.vue'
import TabsContent from '@/components/ui/TabsContent.vue'
import Table, { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.js'

const route = useRoute()
const router = useRouter()

const monitor = ref({})
const stats = ref({})
const results = ref([])
const incidents = ref([])
const maintenanceWindows = ref([])
const loading = ref(false)
const checking = ref(false)
const chartRef = ref(null)
const chartRange = ref('24')
const activeTab = ref('results')
const maintenanceDialog = ref(false)
const maintenanceForm = ref({ name: '', start: '', end: '' })
let chartInstance = null

const statusVariant = computed(() => {
  if (monitor.value.inMaintenance) return 'warning'
  if (!monitor.value.enabled) return 'secondary'
  const map = { up: 'success', down: 'destructive', unknown: 'secondary' }
  return map[monitor.value.latestStatus] || 'secondary'
})

const statusText = computed(() => {
  if (monitor.value.inMaintenance) return '维护中'
  if (!monitor.value.enabled) return '已禁用'
  const map = { up: '正常运行', down: '服务故障', unknown: '未知状态' }
  return map[monitor.value.latestStatus] || '未知状态'
})

const statCards = computed(() => [
  { label: '24小时可用率', value: (stats.value.uptime?.last24h?.percentage || 0) + '%' },
  { label: '7天可用率', value: (stats.value.uptime?.last7d?.percentage || 0) + '%' },
  { label: '平均响应时间', value: (stats.value.avgResponseTime || 0) + 'ms' },
  { label: '30天故障次数', value: stats.value.incidentCount || 0 }
])

const pushUrl = computed(() =>
  monitor.value.push_token
    ? `${window.location.origin}/api/push/${monitor.value.push_token}`
    : ''
)

const formatDateTime = (time) => {
  if (!time) return '-'
  return formatWithSystemTimezone(time)
}

const formatDuration = (seconds) => {
  if (!seconds) return '-'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours}时${minutes}分${secs}秒`
}

const isWindowActive = (row) => {
  const now = Date.now()
  return new Date(row.start_at) <= now && new Date(row.end_at) >= now
}

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('已复制')
  } catch {
    toast.error('复制失败')
  }
}

const handleCheckNow = async () => {
  checking.value = true
  try {
    const res = await monitorApi.checkNow(route.params.id)
    if (res.success) {
      toast.success(`检测完成: ${res.data.status === 'up' ? '正常' : '故障'}`)
      refreshData()
    }
  } catch {
    toast.error('检测失败')
  } finally {
    checking.value = false
  }
}

const handleAddMaintenance = async () => {
  const { name, start, end } = maintenanceForm.value
  if (!start || !end || new Date(end) <= new Date(start)) {
    toast.error('请选择有效的起止时间')
    return
  }
  try {
    const res = await monitorApi.createMaintenance(route.params.id, {
      name: name || '',
      start_at: new Date(start).toISOString(),
      end_at: new Date(end).toISOString()
    })
    if (res.success) {
      toast.success('维护窗口已创建')
      maintenanceDialog.value = false
      maintenanceForm.value = { name: '', start: '', end: '' }
      loadMaintenance()
    }
  } catch (e) {
    toast.error(e?.response?.data?.message || '创建失败')
  }
}

const handleDeleteMaintenance = async (row) => {
  const ok = await confirm({
    title: '删除维护窗口',
    description: `确定删除维护窗口「${row.name || '未命名'}」？`,
    destructive: true
  })
  if (!ok) return
  try {
    const res = await monitorApi.deleteMaintenance(row.id)
    if (res.success) {
      toast.success('已删除')
      loadMaintenance()
    }
  } catch {
    toast.error('删除失败')
  }
}

const handleDelete = async () => {
  const ok = await confirm({
    title: '删除监控项',
    description: `确定要删除「${monitor.value.name}」吗？此操作不可恢复。`,
    confirmText: '删除',
    destructive: true
  })
  if (!ok) return
  try {
    const res = await monitorApi.delete(route.params.id)
    if (res.success) {
      toast.success('删除成功')
      router.push('/')
    }
  } catch {
    toast.error('删除失败')
  }
}

const loadMaintenance = async () => {
  try {
    const res = await monitorApi.getMaintenance(route.params.id)
    if (res.success) maintenanceWindows.value = res.data
  } catch { /* ignore */ }
}

const initChart = () => {
  if (!chartRef.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  // zrender 不支持 oklch，使用 zinc 色板对应的 hex 值
  const isDark = document.documentElement.classList.contains('dark')
  const textColor = isDark ? '#a1a1aa' : '#71717a'   // zinc-400 / zinc-500
  const splitColor = isDark ? '#27272a' : '#e4e4e7'  // zinc-800 / zinc-200
  const tooltipBg = isDark ? '#18181b' : '#ffffff'
  const lineColor = isDark ? '#e4e4e7' : '#52525b'   // zinc-200 / zinc-600
  const range = Number(chartRange.value)

  const trend = stats.value.trend || []
  chartInstance.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: tooltipBg,
      borderColor: splitColor,
      textStyle: { color: isDark ? '#fafafa' : '#18181b' }
    },
    xAxis: {
      type: 'category',
      data: trend.map(item => formatDateTime(item.time_slot).slice(range > 24 ? 0 : 5, range > 24 ? 10 : 16)),
      axisLine: { lineStyle: { color: splitColor } },
      axisLabel: { color: textColor }
    },
    yAxis: {
      type: 'value',
      name: 'ms',
      nameTextStyle: { color: textColor },
      splitLine: { lineStyle: { color: splitColor } },
      axisLabel: { color: textColor }
    },
    series: [{
      name: '平均响应时间',
      type: 'line',
      data: trend.map(item => item.avg_response_time != null ? Math.round(item.avg_response_time) : null),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: lineColor },
      areaStyle: { opacity: 0.08, color: lineColor }
    }],
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true }
  })
}

const refreshData = async () => {
  loading.value = true
  try {
    await loadTimezoneSettings()

    const [monitorRes, statsRes, resultsRes, incidentsRes] = await Promise.all([
      monitorApi.getById(route.params.id),
      monitorApi.getStats(route.params.id, Number(chartRange.value)),
      monitorApi.getResults(route.params.id, 50),
      monitorApi.getIncidents(route.params.id, 20)
    ])

    if (monitorRes.success) monitor.value = monitorRes.data
    if (statsRes.success) stats.value = statsRes.data
    if (resultsRes.success) results.value = resultsRes.data
    if (incidentsRes.success) incidents.value = incidentsRes.data

    // 先让 loading 结束、图表容器进入 DOM，再初始化 echarts
    loading.value = false
    await nextTick()
    initChart()
  } catch (error) {
    console.error('Failed to load monitor details:', error)
    toast.error('加载数据失败')
    loading.value = false
  }
}

const onResize = () => chartInstance?.resize()

onMounted(() => {
  refreshData()
  loadMaintenance()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  chartInstance?.dispose()
  window.removeEventListener('resize', onResize)
})
</script>
