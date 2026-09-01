<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <!-- 统计卡片 -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card v-for="stat in statsList" :key="stat.key" class="gap-0 py-0">
        <CardContent class="flex items-center gap-4 px-5 py-5">
          <div :class="cn('flex size-11 shrink-0 items-center justify-center rounded-lg', stat.bgClass)">
            <component :is="stat.icon" :class="cn('size-5', stat.fgClass)" />
          </div>
          <div>
            <div class="text-2xl font-bold tabular-nums leading-none">{{ stat.value }}</div>
            <div class="mt-1 text-xs text-muted-foreground">{{ stat.label }}</div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 监控列表 -->
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-base font-semibold">服务监控</h2>
        <div class="flex flex-wrap items-center gap-2">
          <Select
            v-model="groupFilter"
            :options="groupOptions"
            placeholder="全部分组"
            class="w-36"
          />
          <div class="relative">
            <Search class="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input v-model="searchText" placeholder="搜索名称/目标" class="w-44 pl-8" />
          </div>
          <Tabs v-model="currentFilter">
            <TabsList>
              <TabsTrigger v-for="tab in filterTabs" :key="tab.value" :value="tab.value" class="flex-none px-3">
                {{ tab.label }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div class="flex flex-wrap gap-2" v-if="authStore.isAdmin || authStore.isUser">
        <Button variant="outline" size="sm" @click="handleExport">
          <Download />
          导出
        </Button>
        <label>
          <input
            ref="importInput"
            type="file"
            accept=".json"
            class="hidden"
            @change="handleImportFile"
          />
          <Button variant="outline" size="sm" as-child>
            <span>
              <Upload />
              导入
            </span>
          </Button>
        </label>
        <Button size="sm" @click="$router.push('/monitors/create')">
          <Plus />
          新建监控
        </Button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" v-if="filteredMonitors.length > 0">
        <MonitorCard
          v-for="monitor in filteredMonitors"
          :key="monitor.id"
          :monitor="monitor"
          @click="goToDetail(monitor.id)"
        />
      </div>

      <Empty
        v-else
        :description="monitors.length === 0 ? '暂无监控项，创建第一个监控开始使用' : '没有匹配的监控项'"
      >
        <Button v-if="monitors.length === 0" size="sm" @click="$router.push('/monitors/create')">
          <Plus />
          创建第一个监控
        </Button>
      </Empty>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  Search, Download, Upload, Plus, Activity,
  CircleCheck, CircleX, AlertTriangle
} from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { toast } from '@/composables/useToast'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import { monitorApi } from '@/api'
import Card, { CardContent } from '@/components/ui/card.js'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Empty from '@/components/ui/Empty.vue'
import Tabs from '@/components/ui/Tabs.vue'
import TabsList from '@/components/ui/TabsList.vue'
import TabsTrigger from '@/components/ui/TabsTrigger.vue'
import MonitorCard from '@/components/MonitorCard.vue'

const router = useRouter()
const monitorStore = useMonitorStore()
const authStore = useAuthStore()
const { monitors, dashboardStats } = storeToRefs(monitorStore)
const { fetchDashboard } = monitorStore

const currentFilter = ref('all')
const groupFilter = ref('')
const searchText = ref('')
const importInput = ref(null)

const statsList = computed(() => [
  {
    key: 'total', label: '总监控项', value: dashboardStats.value.total || 0,
    icon: Activity, bgClass: 'bg-primary/10', fgClass: 'text-primary'
  },
  {
    key: 'up', label: '运行正常', value: dashboardStats.value.up || 0,
    icon: CircleCheck, bgClass: 'bg-success/10', fgClass: 'text-success'
  },
  {
    key: 'down', label: '异常故障', value: dashboardStats.value.down || 0,
    icon: CircleX, bgClass: 'bg-destructive/10', fgClass: 'text-destructive'
  },
  {
    key: 'incidents', label: '活动故障', value: dashboardStats.value.activeIncidents || 0,
    icon: AlertTriangle, bgClass: 'bg-warning/15', fgClass: 'text-warning'
  }
])

const filterTabs = [
  { label: '全部', value: 'all' },
  { label: '正常', value: 'up' },
  { label: '故障', value: 'down' },
  { label: '未知', value: 'unknown' }
]

const groupOptions = computed(() =>
  monitorStore.allGroups.map(g => ({ label: g, value: g }))
)

const filteredMonitors = computed(() => {
  let list = monitors.value
  if (currentFilter.value !== 'all') {
    list = list.filter(m => {
      if (currentFilter.value === 'unknown') return !m.latestStatus || m.latestStatus === 'unknown'
      return m.latestStatus === currentFilter.value
    })
  }
  if (groupFilter.value) {
    list = list.filter(m => m.group_name === groupFilter.value)
  }
  if (searchText.value.trim()) {
    const q = searchText.value.trim().toLowerCase()
    list = list.filter(m =>
      m.name.toLowerCase().includes(q) || (m.target || '').toLowerCase().includes(q)
    )
  }
  return list
})

const goToDetail = (id) => {
  router.push(`/monitors/${id}`)
}

const handleExport = async () => {
  try {
    const res = await monitorApi.exportMonitors()
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uptime-monitors-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('导出成功')
  } catch {
    toast.error('导出失败')
  }
}

const handleImportFile = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const list = Array.isArray(parsed) ? parsed : parsed.monitors
    if (!Array.isArray(list) || list.length === 0) {
      toast.error('文件中没有监控项')
      return
    }
    const res = await monitorApi.importMonitors(list)
    if (res.success) {
      const { created, failed } = res.data
      toast.success(`导入完成: 成功 ${created} 个${failed ? `，失败 ${failed} 个` : ''}`)
      fetchDashboard()
    }
  } catch (err) {
    toast.error('导入失败: ' + (err?.response?.data?.message || '文件格式错误'))
  }
}

onMounted(() => {
  fetchDashboard()
})
</script>
