<template>
  <div class="monitor-card" :class="statusClass" @click="$emit('click')">
    <div class="card-header">
      <div class="status-indicator" :class="statusClass"></div>
      <div class="header-right">
        <el-tooltip v-if="monitor.inMaintenance" content="维护中" placement="top">
          <el-icon class="maintenance-icon"><Tools /></el-icon>
        </el-tooltip>
        <el-tooltip content="立即检测" placement="top">
          <el-button
            class="check-btn"
            size="small"
            circle
            :loading="checking"
            @click.stop="handleCheckNow"
          >
            <el-icon v-if="!checking"><Refresh /></el-icon>
          </el-button>
        </el-tooltip>
        <div class="monitor-type-badge">
          {{ typeText }}
        </div>
      </div>
    </div>

    <div class="card-body">
      <h3 class="monitor-name">{{ monitor.name }}</h3>
      <p class="monitor-target">{{ monitor.target }}</p>

      <div class="tag-row" v-if="hasMeta">
        <el-tag v-if="monitor.group_name" size="small" effect="plain">{{ monitor.group_name }}</el-tag>
        <el-tag
          v-for="tag in (monitor.tags || []).slice(0, 3)"
          :key="tag"
          size="small"
          type="info"
          effect="plain"
        >
          {{ tag }}
        </el-tag>
      </div>

      <div class="status-info">
        <div class="status-badge" :class="statusClass">
          <el-icon :size="16">
            <CircleCheck v-if="monitor.latestStatus === 'up'" />
            <CircleClose v-else-if="monitor.latestStatus === 'down'" />
            <Minus v-else />
          </el-icon>
          <span>{{ statusText }}</span>
        </div>

        <div class="metrics" v-if="monitor.latestResponseTime">
          <div class="metric">
            <el-icon><Timer /></el-icon>
            <span>{{ monitor.latestResponseTime }}ms</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <div class="uptime-badge">
        <el-icon><TrendCharts /></el-icon>
        <span>{{ monitor.uptime24h ?? '—' }}{{ monitor.uptime24h != null ? '%' : '' }} 可用率</span>
      </div>
      <div class="last-check" v-if="monitor.latestCheck">
        {{ formatTimeFromNow(monitor.latestCheck) }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { formatTimeFromNow } from '@/utils/datetime'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  monitor: {
    type: Object,
    required: true
  }
})

defineEmits(['click'])

const monitorStore = useMonitorStore()
const authStore = useAuthStore()
const checking = ref(false)

const statusClass = computed(() => {
  if (!props.monitor.enabled) return 'disabled'
  return props.monitor.latestStatus || 'unknown'
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
    http: 'HTTP',
    tcp: 'TCP',
    ping: 'PING',
    push: 'PUSH',
    ssl: 'SSL',
    domain: 'DOMAIN',
    dns: 'DNS',
    docker: 'DOCKER'
  }
  return map[props.monitor.type] || props.monitor.type
})

const hasMeta = computed(() =>
  props.monitor.group_name || (props.monitor.tags && props.monitor.tags.length > 0)
)

const handleCheckNow = async () => {
  checking.value = true
  try {
    const res = await monitorStore.checkNow(props.monitor.id)
    if (res.success) {
      ElMessage.success(`检测完成: ${res.data.status === 'up' ? '正常' : '故障'} ${res.data.responseTime ?? ''}ms`)
    }
  } catch {
    ElMessage.error('检测失败')
  } finally {
    checking.value = false
  }
}
</script>

<style scoped>
.monitor-card {
  background: var(--md-surface);
  border-radius: var(--md-shape-lg);
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--md-outline-variant);
  position: relative;
  overflow: hidden;
}

.monitor-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--md-elevation-2);
}

.monitor-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--md-outline);
}

.monitor-card.up::before {
  background: var(--md-success);
}

.monitor-card.down::before {
  background: var(--md-error);
}

.monitor-card.disabled::before {
  background: var(--md-outline);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.maintenance-icon {
  color: #ed6c02;
}

.check-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.monitor-card:hover .check-btn {
  opacity: 1;
}

.monitor-type-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--md-on-surface-variant);
  background: var(--md-surface-variant);
  padding: 4px 12px;
  border-radius: var(--md-shape-full);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-body {
  margin-bottom: 16px;
}

.monitor-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--md-on-surface);
  margin: 0 0 8px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.monitor-target {
  font-size: 0.875rem;
  color: var(--md-on-surface-variant);
  margin: 0 0 12px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.status-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--md-shape-full);
  font-size: 0.875rem;
  font-weight: 500;
  background: var(--md-surface-variant);
  color: var(--md-on-surface-variant);
}

.status-badge.up {
  background: var(--md-success-container);
  color: var(--md-success);
}

.status-badge.down {
  background: var(--md-error-container);
  color: var(--md-error);
}

.metrics {
  display: flex;
  gap: 12px;
}

.metric {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  color: var(--md-on-surface-variant);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid var(--md-outline-variant);
}

.uptime-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  color: var(--md-on-surface-variant);
}

.last-check {
  font-size: 0.75rem;
  color: var(--md-outline);
}
</style>
