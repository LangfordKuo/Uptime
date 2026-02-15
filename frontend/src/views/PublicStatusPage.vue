<template>
  <div class="public-status-page">
    <div class="status-container">
      <!-- 头部 -->
      <header class="status-header">
        <div v-if="statusPage?.logo_url" class="logo">
          <img :src="statusPage.logo_url" :alt="statusPage.name" />
        </div>
        <h1>{{ statusPage?.name }}</h1>
        <p v-if="statusPage?.description" class="description">{{ statusPage.description }}</p>
      </header>

      <!-- 整体状态 - 横向紧凑布局 -->
      <div class="overall-status" :class="overallStatus">
        <div class="status-left">
          <div class="status-icon">
            <el-icon :size="32">
              <CircleCheck v-if="overallStatus === 'operational'" />
              <Warning v-else-if="overallStatus === 'degraded'" />
              <CircleClose v-else />
            </el-icon>
          </div>
          <h2>{{ overallStatusText }}</h2>
        </div>
        <div class="status-right">
          <p class="last-updated">最后更新: {{ formatTime(statusPage?.updated_at) }}</p>
        </div>
      </div>

      <!-- 服务列表 -->
      <div class="services-section">
        <h3>服务状态</h3>
        <div class="services-list">
          <div
            v-for="monitor in statusPage?.monitors"
            :key="monitor.id"
            class="service-item"
          >
            <div class="service-header">
              <div class="service-info">
                <div class="status-dot" :class="monitor.latest_status || 'unknown'"></div>
                <span class="service-name">{{ monitor.display_name || monitor.name }}</span>
                <span class="service-type">{{ getTypeText(monitor.type) }}</span>
              </div>
              <div class="service-status">
                <span class="status-text" :class="monitor.latest_status || 'unknown'">
                  {{ getStatusText(monitor.latest_status) }}
                </span>
                <span v-if="monitor.latest_response_time" class="response-time">
                  {{ monitor.latest_response_time }}ms
                </span>
              </div>
            </div>

            <!-- 今日在线率 -->
            <div class="today-uptime">
              <span class="uptime-label">今日在线率</span>
              <span class="uptime-value" :class="getTodayUptimeColor(monitor.daily_uptime)">
                {{ getTodayUptime(monitor.daily_uptime) }}
              </span>
            </div>

            <!-- 30天热力图 -->
            <div class="heatmap">
              <div
                v-for="(day, index) in monitor.daily_uptime"
                :key="index"
                class="heat-cell"
                :class="getHeatColor(day.uptime)"
                :title="getTooltip(day)"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 页脚 -->
      <footer class="status-footer">
        <p>Powered by <a href="https://github.com/LangfordKuo/Uptime" target="_blank" rel="noopener noreferrer">Uptime Monitor</a></p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { statusPageApi } from '@/api'
import { loadTimezoneSettings, formatWithSystemTimezone } from '@/utils/timezone'

const route = useRoute()
const statusPage = ref(null)

const overallStatus = computed(() => {
  if (!statusPage.value?.monitors?.length) return 'unknown'
  const monitors = statusPage.value.monitors
  const down = monitors.filter(m => m.latest_status === 'down').length
  const unknown = monitors.filter(m => !m.latest_status || m.latest_status === 'unknown').length
  
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

const getTypeText = (type) => ({ http: 'HTTP', tcp: 'TCP', ping: 'PING' }[type] || type)
const getStatusText = (status) => ({ up: '正常', down: '故障', unknown: '未知' }[status] || '未知')

const getHeatColor = (uptime) => {
  if (uptime === null || uptime === undefined) return 'unknown'
  if (uptime >= 99) return 'excellent'
  if (uptime >= 95) return 'good'
  if (uptime >= 90) return 'warning'
  return 'critical'
}

const getTooltip = (day) => {
  if (day.uptime === null) return `${day.date}: 无数据`
  return `${day.date}: ${day.uptime.toFixed(1)}% (${day.up_count}/${day.total_checks})`
}

// 获取今日在线率
const getTodayUptime = (dailyUptime) => {
  if (!dailyUptime || dailyUptime.length === 0) return '--'
  // 获取最后一天（今天）的数据
  const today = dailyUptime[dailyUptime.length - 1]
  if (today.uptime === null || today.uptime === undefined) return '--'
  return today.uptime.toFixed(2) + '%'
}

// 获取今日在线率颜色
const getTodayUptimeColor = (dailyUptime) => {
  if (!dailyUptime || dailyUptime.length === 0) return 'unknown'
  const today = dailyUptime[dailyUptime.length - 1]
  if (today.uptime === null || today.uptime === undefined) return 'unknown'
  if (today.uptime >= 99) return 'excellent'
  if (today.uptime >= 95) return 'good'
  if (today.uptime >= 90) return 'warning'
  return 'critical'
}

// 格式化时间（使用时区设置）
const formatTime = (time) => {
  if (!time) return '--'
  return formatWithSystemTimezone(time)
}

const loadStatusPage = async () => {
  try {
    // 先加载时区设置
    await loadTimezoneSettings()
    
    const res = await statusPageApi.getPublic(route.params.slug)
    statusPage.value = res.data
    
    // 设置页面标题
    if (statusPage.value?.name) {
      document.title = statusPage.value.name
    }
  } catch {
    ElMessage.error('加载失败')
  }
}

onMounted(loadStatusPage)
</script>

<style scoped>
.public-status-page {
  min-height: 100vh;
  background: #F5F5F5;
  padding: 48px 24px;
}

.status-container {
  max-width: 800px;
  margin: 0 auto;
}

/* 头部 */
.status-header {
  text-align: center;
  color: var(--md-on-surface);
  margin-bottom: 32px;
}

.logo img {
  max-height: 64px;
  margin-bottom: 16px;
}

.status-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.description {
  font-size: 1.125rem;
  opacity: 0.9;
  margin: 0;
}

/* 整体状态 - 横向紧凑布局 */
.overall-status {
  background: var(--md-surface);
  border-radius: var(--md-shape-lg);
  padding: 20px 24px;
  margin-bottom: 16px;
  box-shadow: var(--md-elevation-1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.overall-status.operational .status-left { color: var(--md-success); }
.overall-status.degraded .status-left { color: var(--md-warning); }
.overall-status.down .status-left { color: var(--md-error); }

.status-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-icon {
  display: flex;
  align-items: center;
}

.overall-status h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--md-on-surface);
}

.status-right {
  text-align: right;
}

.last-updated {
  font-size: 0.75rem;
  color: var(--md-on-surface-variant);
  margin: 0;
}

/* 服务列表 */
.services-section {
  background: var(--md-surface);
  border-radius: var(--md-shape-lg);
  padding: 20px;
  box-shadow: var(--md-elevation-1);
}

.services-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--md-on-surface);
}

.services-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.service-item {
  padding: 16px;
  background: var(--md-surface-variant);
  border-radius: var(--md-shape-md);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.service-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.service-status {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
  flex-shrink: 0;
}

/* 今日在线率 */
.today-uptime {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--md-surface);
  border-radius: var(--md-shape-sm);
}

.uptime-label {
  font-size: 0.875rem;
  color: var(--md-on-surface-variant);
}

.uptime-value {
  font-size: 1rem;
  font-weight: 600;
}

.uptime-value.excellent { color: var(--md-success); }
.uptime-value.good { color: #4CAF50; }
.uptime-value.warning { color: var(--md-warning); }
.uptime-value.critical { color: var(--md-error); }
.uptime-value.unknown { color: var(--md-outline); }

.service-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--md-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--md-outline);
  flex-shrink: 0;
  margin-left: 2px;
}

.status-dot.up { background: var(--md-success); box-shadow: 0 0 3px 1px var(--md-success); }
.status-dot.down { background: var(--md-error); box-shadow: 0 0 3px 1px var(--md-error); }

.service-type {
  font-size: 0.7rem;
  color: var(--md-on-surface-variant);
  padding: 2px 6px;
  background: var(--md-surface-variant);
  border-radius: 4px;
  flex-shrink: 0;
}

.service-status {
  text-align: right;
}

.status-text {
  font-weight: 600;
  font-size: 0.875rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-text.up { color: var(--md-success); }
.status-text.down { color: var(--md-error); }

.response-time {
  font-size: 0.75rem;
  color: var(--md-on-surface-variant);
  white-space: nowrap;
  flex-shrink: 0;
  padding: 2px 6px;
  background: var(--md-surface-variant);
  border-radius: 4px;
}

/* 热力图 */
.heatmap {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.heat-cell {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  cursor: pointer;
  transition: transform 0.2s;
  background: var(--md-outline-variant);
}

.heat-cell:hover {
  transform: scale(1.3);
}

.heat-cell.excellent { background: var(--md-success); }
.heat-cell.good { background: #4CAF50; }
.heat-cell.warning { background: var(--md-warning); }
.heat-cell.critical { background: var(--md-error); }
.heat-cell.unknown { background: var(--md-outline-variant); }

/* 页脚 */
.status-footer {
  text-align: center;
  color: var(--md-on-surface-variant);
  margin-top: 32px;
  font-size: 0.875rem;
}

.status-footer a {
  color: var(--md-on-surface-variant);
  text-decoration: none;
  border-bottom: 1px solid var(--md-outline-variant);
  transition: border-color 0.2s;
}

.status-footer a:hover {
  border-color: var(--md-primary);
}
</style>
