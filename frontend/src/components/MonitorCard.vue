<template>
  <Card
    class="group relative cursor-pointer gap-0 py-0 transition-shadow hover:shadow-md"
    @click="$emit('click')"
  >
    <!-- 状态顶条 -->
    <div
      class="h-1 rounded-t-xl"
      :class="{
        'bg-success': statusClass === 'up',
        'bg-destructive': statusClass === 'down',
        'bg-muted-foreground/30': statusClass !== 'up' && statusClass !== 'down'
      }"
    />

    <CardHeader class="px-5 pt-4">
      <div class="flex w-full items-start justify-between gap-2">
        <div class="min-w-0">
          <CardTitle class="truncate text-base">{{ monitor.name }}</CardTitle>
          <CardDescription class="truncate mt-0.5">{{ monitor.target }}</CardDescription>
        </div>
        <Badge variant="secondary" class="shrink-0 font-mono text-[10px]">{{ typeText }}</Badge>
      </div>
    </CardHeader>

    <CardContent class="px-5 space-y-3">
      <div class="flex flex-wrap items-center gap-1.5" v-if="hasMeta">
        <Badge v-if="monitor.group_name" variant="outline">{{ monitor.group_name }}</Badge>
        <Badge v-for="tag in (monitor.tags || []).slice(0, 3)" :key="tag" variant="outline">{{ tag }}</Badge>
        <Badge v-if="monitor.inMaintenance" variant="warning">
          <Wrench class="size-3" />
          维护中
        </Badge>
      </div>

      <div class="flex items-center justify-between">
        <Badge :variant="statusVariant" class="gap-1 px-2 py-1">
          <span
            :class="cn('inline-block size-1.5 rounded-full',
              statusClass === 'up' ? 'bg-success' : statusClass === 'down' ? 'bg-destructive anim-pulse-dot' : 'bg-muted-foreground')"
          />
          {{ statusText }}
        </Badge>
        <span v-if="monitor.latestResponseTime != null" class="flex items-center gap-1 text-xs text-muted-foreground">
          <Timer class="size-3.5" />
          {{ monitor.latestResponseTime }}ms
        </span>
      </div>
    </CardContent>

    <div class="mt-auto flex items-center justify-between border-t px-5 py-3">
      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <TrendingUp class="size-3.5" />
        {{ monitor.uptime24h ?? '—' }}{{ monitor.uptime24h != null ? '%' : '' }} 可用率
      </span>
      <span class="flex items-center gap-2">
        <span v-if="monitor.latestCheck" class="text-xs text-muted-foreground/70">
          {{ formatTimeFromNow(monitor.latestCheck) }}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          class="opacity-0 transition-opacity group-hover:opacity-100"
          title="立即检测"
          @click.stop="handleCheckNow"
        >
          <Loader2 v-if="checking" class="animate-spin" />
          <RefreshCw v-else class="size-3.5" />
        </Button>
      </span>
    </div>
  </Card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Wrench, Timer, TrendingUp, RefreshCw, Loader2 } from 'lucide-vue-next'
import { formatTimeFromNow } from '@/utils/datetime'
import { cn } from '@/lib/utils'
import { toast } from '@/composables/useToast'
import { useMonitorStore } from '@/stores/monitor'
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.js'
import Badge from '@/components/ui/badge.js'
import Button from '@/components/ui/Button.vue'

const props = defineProps({
  monitor: { type: Object, required: true }
})

defineEmits(['click'])

const monitorStore = useMonitorStore()
const checking = ref(false)

const statusClass = computed(() => {
  if (!props.monitor.enabled) return 'disabled'
  return props.monitor.latestStatus || 'unknown'
})

const statusVariant = computed(() => {
  if (props.monitor.inMaintenance) return 'warning'
  const map = { up: 'success', down: 'destructive', unknown: 'secondary' }
  return map[statusClass.value] || 'secondary'
})

const statusText = computed(() => {
  if (props.monitor.inMaintenance) return '维护中'
  const map = {
    up: '正常运行',
    down: '服务故障',
    unknown: '状态未知',
    disabled: '已禁用'
  }
  return map[statusClass.value] || '未知'
})

const typeText = computed(() => {
  const map = {
    http: 'HTTP', tcp: 'TCP', ping: 'PING', push: 'PUSH',
    ssl: 'SSL', domain: 'DOMAIN', dns: 'DNS', docker: 'DOCKER'
  }
  return map[props.monitor.type] || props.monitor.type
})

const hasMeta = computed(() =>
  props.monitor.group_name || (props.monitor.tags && props.monitor.tags.length > 0) || props.monitor.inMaintenance
)

const handleCheckNow = async () => {
  checking.value = true
  try {
    const res = await monitorStore.checkNow(props.monitor.id)
    if (res.success) {
      toast.success(`检测完成: ${res.data.status === 'up' ? '正常' : '故障'} ${res.data.responseTime ?? ''}ms`)
    }
  } catch {
    toast.error('检测失败')
  } finally {
    checking.value = false
  }
}
</script>
