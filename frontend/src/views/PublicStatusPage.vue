<template>
  <div class="public-status-page" v-loading="loading">
    <div v-if="statusPage" class="status-container">
      <!-- 头部 -->
      <header class="status-header">
        <div v-if="statusPage.logo_url" class="logo">
          <img :src="statusPage.logo_url" :alt="statusPage.name" />
        </div>
        <h1>{{ statusPage.name }}</h1>
        <p v-if="statusPage.description" class="description">{{ statusPage.description }}</p>
        <div class="last-updated">
          最后更新: {{ formatDateTime(statusPage.updated_at || statusPage.created_at) }}
        </div>
      </header>

      <!-- 整体状态概览 -->
      <div class="overall-status" :class="overallStatusClass">
        <el-icon :size="48">
          <CircleCheck v-if="overallStatus === 'operational'" />
          <Warning v-else-if="overallStatus === 'degraded'" />
          <CircleClose v-else />
        </el-icon>
        <h2>{{ overallStatusText }}</h2>
      </div>

      <!-- 监控项列表 -->
      <div class="monitors-section">
        <h3>服务状态</h3>
        <div class="monitors-list">
          <div
            v-for="monitor in statusPage.monitors"
            :key="monitor.id"
            class="monitor-item"
            :class="getMonitorStatusClass(monitor)"
          >
            <div class="monitor-info">
              <div class="monitor-name">
                <el-icon :size="20">
                  <CircleCheck v-if="monitor.latest_status === 'up'" />
                  <CircleClose v-else-if="monitor.latest_status === 'down'" />
                  <QuestionFilled v-else />
                </el-icon>
                <span>{{ monitor.display_name || monitor.name }}</span>
              </div>
              <div class="monitor-type">{{ getTypeText(monitor.type) }}</div>
            </div>
            <div class="monitor-status">
              <el-tag :type="getStatusType(monitor.latest_status)" size="large">
                {{ getStatusText(monitor.latest_status) }}
              </el-tag>
              <div v-if="monitor.latest_response_time" class="response-time">
                {{ monitor.latest_response_time }}ms
              </div>
              <div v-if="monitor.latest_check" class="last-check">
                {{ formatTimeFromNow(monitor.latest_check) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 页脚 -->
      <footer class="status-footer">
        <p>由 Uptime Monitor 提供技术支持</p>
      </footer>
    </div>

    <el-empty v-else-if="!loading" description="状态页不存在或未公开" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { statusPageApi } from '@/api'
import { formatTime, formatTimeFromNow } from '@/utils/datetime'

const route = useRoute()

const statusPage = ref(null)
const loading = ref(false)

const overallStatus = computed(() => {
  if (!statusPage.value?.monitors || statusPage.value.monitors.length === 0) {
    return 'unknown'
  }

  const monitors = statusPage.value.monitors
  const downCount = monitors.filter(m => m.latest_status === 'down').length
  const unknownCount = monitors.filter(m => !m.latest_status || m.latest_status === 'unknown').length
  const upCount = monitors.filter(m => m.latest_status === 'up').length

  if (downCount > 0) return 'down'
  if (unknownCount > 0) return 'degraded'
  if (upCount > 0) return 'operational'
  return 'unknown'
})

const overallStatusClass = computed(() => {
  const map = {
    operational: 'status-operational',
    degraded: 'status-degraded',
    down: 'status-down',
    unknown: 'status-unknown'
  }
  return map[overallStatus.value]
})

const overallStatusText = computed(() => {
  const map = {
    operational: '所有系统运行正常',
    degraded: '部分服务异常',
    down: '服务中断',
    unknown: '状态未知'
  }
  return map[overallStatus.value]
})

const formatDateTime = (time) => {
  return formatTime(time)
}

const getMonitorStatusClass = (monitor) => {
  const status = monitor.latest_status || 'unknown'
  return `monitor-${status}`
}

const getStatusType = (status) => {
  const map = {
    up: 'success',
    down: 'danger',
    unknown: 'info'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    up: '正常',
    down: '故障',
    unknown: '未知'
  }
  return map[status] || '未知'
}

const getTypeText = (type) => {
  const map = {
    http: 'HTTP/HTTPS',
    tcp: 'TCP端口',
    ping: 'PING'
  }
  return map[type] || type
}

const loadStatusPage = async () => {
  const slug = route.params.slug
  if (!slug) return

  try {
    loading.value = true
    const res = await statusPageApi.getPublic(slug)
    statusPage.value = res.data
  } catch (error) {
    ElMessage.error('加载状态页失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStatusPage()
})
</script>

<style scoped>
.public-status-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px 20px;
}

.status-container {
  max-width: 900px;
  margin: 0 auto;
}

.status-header {
  text-align: center;
  color: white;
  margin-bottom: 40px;
}

.status-header .logo {
  margin-bottom: 20px;
}

.status-header .logo img {
  max-height: 80px;
  max-width: 200px;
}

.status-header h1 {
  font-size: 36px;
  margin: 0 0 16px 0;
}

.status-header .description {
  font-size: 18px;
  opacity: 0.9;
  margin: 0 0 8px 0;
}

.status-header .last-updated {
  font-size: 14px;
  opacity: 0.7;
}

.overall-status {
  background: white;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  margin-bottom: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.overall-status.status-operational {
  color: #67c23a;
}

.overall-status.status-degraded {
  color: #e6a23c;
}

.overall-status.status-down {
  color: #f56c6c;
}

.overall-status.status-unknown {
  color: #909399;
}

.overall-status h2 {
  margin: 16px 0 0 0;
  font-size: 24px;
}

.monitors-section {
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.monitors-section h3 {
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #303133;
}

.monitors-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.monitor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-radius: 8px;
  background: #f5f7fa;
  border-left: 4px solid #909399;
  transition: all 0.3s;
}

.monitor-item.monitor-up {
  border-left-color: #67c23a;
  background: #f0f9eb;
}

.monitor-item.monitor-down {
  border-left-color: #f56c6c;
  background: #fef0f0;
}

.monitor-item.monitor-unknown {
  border-left-color: #909399;
  background: #f4f4f5;
}

.monitor-info {
  flex: 1;
}

.monitor-name {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.monitor-type {
  font-size: 14px;
  color: #909399;
  margin-left: 32px;
}

.monitor-status {
  text-align: right;
}

.response-time {
  font-size: 14px;
  color: #606266;
  margin-top: 8px;
}

.last-check {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.status-footer {
  text-align: center;
  color: white;
  opacity: 0.7;
  margin-top: 40px;
  font-size: 14px;
}
</style>
