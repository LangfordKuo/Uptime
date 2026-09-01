<template>
  <div class="min-h-screen bg-muted/40">
    <div class="mx-auto max-w-3xl px-4 py-10">
      <!-- 密码保护 -->
      <div v-if="needPassword && !unlocked" class="flex justify-center pt-12">
        <Card class="w-full max-w-sm text-center">
          <CardHeader class="items-center">
            <div class="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
              <Lock class="size-5 text-muted-foreground" />
            </div>
            <CardTitle class="mt-2">此状态页受密码保护</CardTitle>
            <CardDescription>请输入访问密码继续</CardDescription>
          </CardHeader>
          <CardContent class="space-y-3">
            <Input
              v-model="passwordInput"
              type="password"
              placeholder="访问密码"
              @keyup.enter="submitPassword"
            />
            <Button class="w-full" :loading="loading" @click="submitPassword">解锁</Button>
          </CardContent>
        </Card>
      </div>

      <div v-else class="space-y-5">
        <!-- 头部 -->
        <header class="flex flex-col items-center gap-2 py-4 text-center">
          <img v-if="statusPage?.logo_url" :src="statusPage.logo_url" :alt="statusPage.name" class="mb-2 max-h-14" />
          <h1 class="text-3xl font-bold tracking-tight">{{ statusPage?.name }}</h1>
          <p v-if="statusPage?.description" class="text-muted-foreground">{{ statusPage.description }}</p>
        </header>

        <!-- 整体状态 -->
        <Card class="flex-row items-center justify-between gap-4 px-5 py-4">
          <div class="flex items-center gap-3">
            <span
              class="flex size-9 items-center justify-center rounded-full"
              :class="{
                'bg-success/10 text-success': overallStatus === 'operational',
                'bg-warning/15 text-warning': overallStatus === 'degraded',
                'bg-destructive/10 text-destructive': overallStatus === 'down' || overallStatus === 'unknown'
              }"
            >
              <CircleCheck v-if="overallStatus === 'operational'" class="size-5" />
              <AlertTriangle v-else-if="overallStatus === 'degraded'" class="size-5" />
              <CircleX v-else class="size-5" />
            </span>
            <div>
              <div class="font-semibold leading-tight">{{ overallStatusText }}</div>
              <div class="text-xs text-muted-foreground">最后更新: {{ formatTime(statusPage?.updated_at) }}</div>
            </div>
          </div>
        </Card>

        <!-- 服务列表 -->
        <Card>
          <CardHeader>
            <CardTitle>服务状态</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2">
            <div
              v-for="monitor in statusPage?.monitors"
              :key="monitor.id"
              class="rounded-lg border p-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 mb-3">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :class="{
                      'bg-success': monitor.latest_status === 'up',
                      'bg-destructive anim-pulse-dot': monitor.latest_status === 'down',
                      'bg-muted-foreground': !monitor.latest_status || monitor.latest_status === 'unknown'
                    }"
                  />
                  <span class="font-medium truncate">{{ monitor.display_name || monitor.name }}</span>
                  <Badge variant="outline" class="font-mono text-[10px]">{{ getTypeText(monitor.type) }}</Badge>
                  <Badge v-if="monitor.in_maintenance" variant="warning" class="gap-1">
                    <Wrench class="size-3" /> 维护中
                  </Badge>
                </div>
                <div class="flex items-center gap-2.5 shrink-0">
                  <span
                    class="text-sm font-medium"
                    :class="{
                      'text-success': !monitor.in_maintenance && monitor.latest_status === 'up',
                      'text-destructive': !monitor.in_maintenance && monitor.latest_status === 'down',
                      'text-muted-foreground': monitor.in_maintenance || !monitor.latest_status || monitor.latest_status === 'unknown'
                    }"
                  >
                    {{ monitor.in_maintenance ? '维护中' : getStatusText(monitor.latest_status) }}
                  </span>
                  <span class="flex items-baseline gap-1.5">
                    <span class="text-xs text-muted-foreground">今日在线率</span>
                    <span class="text-sm font-semibold" :class="getTodayUptimeColorClass(monitor.daily_uptime)">
                      {{ getTodayUptime(monitor.daily_uptime) }}
                    </span>
                  </span>
                  <span v-if="monitor.latest_response_time" class="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
                    {{ monitor.latest_response_time }}ms
                  </span>
                </div>
              </div>

              <!-- 30 天状态条 -->
              <div class="flex gap-[3px]">
                <div
                  v-for="(day, index) in monitor.daily_uptime"
                  :key="index"
                  class="h-6 flex-1 rounded-sm transition-transform hover:scale-y-125"
                  :class="{
                    'bg-success': day.uptime >= 99,
                    'bg-success/60': day.uptime >= 95 && day.uptime < 99,
                    'bg-warning': day.uptime >= 90 && day.uptime < 95,
                    'bg-destructive': day.uptime != null && day.uptime < 90,
                    'bg-muted': day.uptime == null
                  }"
                  :title="getTooltip(day)"
                />
              </div>
              <div class="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>30 天前</span>
                <span>今天</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 最近事件 -->
        <Card v-if="statusPage?.recent_incidents?.length > 0">
          <CardHeader>
            <CardTitle>最近事件</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div
              v-for="incident in statusPage.recent_incidents"
              :key="incident.id"
              class="rounded-lg border p-4"
            >
              <div class="flex items-center gap-2 mb-1">
                <Badge :variant="incident.ended_at ? 'success' : 'destructive'">
                  {{ incident.ended_at ? '已恢复' : '故障中' }}
                </Badge>
                <span class="text-sm font-medium">{{ incident.monitor_name }}</span>
              </div>
              <div v-if="incident.error_message" class="text-xs text-muted-foreground break-all mb-0.5">
                {{ incident.error_message }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ formatTime(incident.started_at) }}
                <template v-if="incident.ended_at">
                  → {{ formatTime(incident.ended_at) }}（持续 {{ formatIncidentDuration(incident.duration) }}）
                </template>
                <template v-else> · 进行中</template>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 页脚 -->
        <footer class="pt-4 pb-2 text-center text-xs text-muted-foreground">
          Powered by
          <a
            href="https://github.com/LangfordKuo/Uptime"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:text-foreground hover:underline underline-offset-2"
          >Uptime Monitor</a>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  Lock, CircleCheck, CircleX, AlertTriangle, Wrench
} from 'lucide-vue-next'
import { statusPageApi } from '@/api'
import { loadTimezoneSettings, formatWithSystemTimezone } from '@/utils/timezone'
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.js'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Badge from '@/components/ui/badge.js'

const route = useRoute()
const statusPage = ref(null)
const needPassword = ref(false)
const unlocked = ref(false)
const passwordInput = ref('')
const loading = ref(false)

const overallStatus = computed(() => {
  if (!statusPage.value?.monitors?.length) return 'unknown'
  const active = statusPage.value.monitors.filter(m => !m.in_maintenance)
  const down = active.filter(m => m.latest_status === 'down').length
  const unknown = active.filter(m => !m.latest_status || m.latest_status === 'unknown').length
  if (down > 0) return 'down'
  if (unknown > 0) return 'degraded'
  return 'operational'
})

const overallStatusText = computed(() => ({
  operational: '所有系统运行正常',
  degraded: '部分服务异常',
  down: '服务中断',
  unknown: '状态未知'
}[overallStatus.value]))

const getTypeText = (type) => ({
  http: 'HTTP', tcp: 'TCP', ping: 'PING', push: 'PUSH',
  ssl: 'SSL', domain: '域名', dns: 'DNS', docker: 'Docker'
}[type] || type)

const getStatusText = (status) => ({ up: '正常', down: '故障', unknown: '未知' }[status] || '未知')

const formatIncidentDuration = (seconds) => {
  if (!seconds) return ''
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`
  return `${Math.floor(seconds / 3600)} 小时 ${Math.round((seconds % 3600) / 60)} 分`
}

const getTooltip = (day) => {
  if (day.uptime == null) return `${day.date}: 无数据`
  return `${day.date}: ${day.uptime.toFixed(1)}% (${day.up_count}/${day.total_checks})`
}

const getTodayUptime = (dailyUptime) => {
  if (!dailyUptime?.length) return '--'
  const today = dailyUptime[dailyUptime.length - 1]
  if (today.uptime == null) return '--'
  return today.uptime.toFixed(2) + '%'
}

const getTodayUptimeColorClass = (dailyUptime) => {
  if (!dailyUptime?.length) return 'text-muted-foreground'
  const today = dailyUptime[dailyUptime.length - 1]
  if (today.uptime == null) return 'text-muted-foreground'
  if (today.uptime >= 99) return 'text-success'
  if (today.uptime >= 95) return 'text-success'
  if (today.uptime >= 90) return 'text-warning'
  return 'text-destructive'
}

const formatTime = (time) => {
  if (!time) return '--'
  return formatWithSystemTimezone(time)
}

const loadStatusPage = async (password = null) => {
  try {
    loading.value = true
    await loadTimezoneSettings()

    const res = await statusPageApi.getPublic(route.params.slug, password)
    statusPage.value = res.data
    needPassword.value = false
    unlocked.value = true

    if (statusPage.value?.name) {
      document.title = statusPage.value.name
    }
  } catch (error) {
    if (error?.response?.status === 401 && error?.response?.data?.needsPassword) {
      needPassword.value = true
    } else if (error?.response?.status === 404) {
      needPassword.value = false
      unlocked.value = true
    } else {
      needPassword.value = false
      unlocked.value = true
    }
  } finally {
    loading.value = false
  }
}

const submitPassword = () => {
  if (!passwordInput.value) return
  loadStatusPage(passwordInput.value)
}

onMounted(() => loadStatusPage())
</script>
