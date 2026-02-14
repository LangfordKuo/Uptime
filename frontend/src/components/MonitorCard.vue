<template>
  <el-card class="monitor-card" :class="{ 'disabled': !monitor.enabled }">
    <div class="card-content">
      <div class="card-header">
        <div class="header-left">
          <el-tag :type="statusType" size="large">
            {{ statusText }}
          </el-tag>
          <span class="monitor-name">{{ monitor.name }}</span>
        </div>
        <el-dropdown @command="handleCommand">
          <el-icon class="more-icon"><More /></el-icon>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="view">
                <el-icon><View /></el-icon>查看详情
              </el-dropdown-item>
              <el-dropdown-item command="edit">
                <el-icon><Edit /></el-icon>编辑
              </el-dropdown-item>
              <el-dropdown-item command="toggle">
                <el-icon><Switch /></el-icon>
                {{ monitor.enabled ? '禁用' : '启用' }}
              </el-dropdown-item>
              <el-dropdown-item command="delete" divided>
                <el-icon><Delete /></el-icon>删除
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div class="card-body">
        <div class="info-row">
          <span class="label">类型:</span>
          <el-tag size="small">{{ typeText }}</el-tag>
        </div>
        <div class="info-row">
          <span class="label">目标:</span>
          <span class="value">{{ monitor.target }}</span>
        </div>
        <div class="info-row" v-if="monitor.latestResponseTime">
          <span class="label">响应时间:</span>
          <span class="value">{{ monitor.latestResponseTime }}ms</span>
        </div>
        <div class="info-row" v-if="monitor.uptime24h">
          <span class="label">24h可用率:</span>
          <span class="value">{{ monitor.uptime24h }}%</span>
        </div>
        <div class="info-row" v-if="monitor.latestCheck">
          <span class="label">最后检测:</span>
          <span class="value">{{ formatTime(monitor.latestCheck) }}</span>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatTimeFromNow } from '@/utils/datetime'

const props = defineProps({
  monitor: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['toggle', 'delete'])
const router = useRouter()

const statusType = computed(() => {
  if (!props.monitor.enabled) return 'info'
  switch (props.monitor.latestStatus) {
    case 'up': return 'success'
    case 'down': return 'danger'
    default: return 'info'
  }
})

const statusText = computed(() => {
  if (!props.monitor.enabled) return '已禁用'
  switch (props.monitor.latestStatus) {
    case 'up': return '正常'
    case 'down': return '故障'
    default: return '未知'
  }
})

const typeText = computed(() => {
  switch (props.monitor.type) {
    case 'http': return 'HTTP/HTTPS'
    case 'tcp': return 'TCP端口'
    case 'ping': return 'PING'
    default: return props.monitor.type
  }
})

const formatTime = (time) => {
  return formatTimeFromNow(time)
}

const handleCommand = (command) => {
  switch (command) {
    case 'view':
      router.push(`/monitors/${props.monitor.id}`)
      break
    case 'edit':
      router.push(`/monitors/${props.monitor.id}/edit`)
      break
    case 'toggle':
      emit('toggle', props.monitor.id)
      break
    case 'delete':
      emit('delete', props.monitor)
      break
  }
}
</script>

<style scoped>
.monitor-card {
  transition: all 0.3s;
}

.monitor-card:hover {
  transform: translateY(-2px);
}

.monitor-card.disabled {
  opacity: 0.6;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.monitor-name {
  font-size: 18px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-icon {
  cursor: pointer;
  font-size: 20px;
  padding: 4px;
}

.more-icon:hover {
  background: #f5f7fa;
  border-radius: 4px;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.label {
  color: #909399;
  min-width: 70px;
}

.value {
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
