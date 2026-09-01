<template>
  <div class="public-status-page">
    <div class="status-container">
      <!-- 密码保护弹窗 -->
      <div v-if="needPassword && !unlocked" class="password-gate">
        <div class="password-card">
          <h2>🔒 此状态页受密码保护</h2>
          <p>请输入访问密码</p>
          <el-input
            v-model="passwordInput"
            type="password"
            placeholder="访问密码"
            show-password
            @keyup.enter="submitPassword"
          />
          <el-button
            type="primary"
            style="margin-top: 16px; width: 100%"
            :loading="loading"
            @click="submitPassword"
          >
            解锁
          </el-button>
        </div>
      </div>

      <template v-else>
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
                <span v-if="monitor.in_maintenance" class="maintenance-badge">维护中</span>
              </div>
              <div class="service-status">
                <span class="status-text" :class="monitor.latest_status || 'unknown'">
                  {{ monitor.in_maintenance ? '维护中' : getStatusText(monitor.latest_status) }}
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

      <!-- 最近故障事件 -->
      <div class="services-section" v-if="statusPage?.recent_incidents?.length > 0">
        <h3>最近事件</h3>
        <div class="incidents-list">
          <div
            v-for="incident in statusPage.recent_incidents"
            :key="incident.id"
            class="incident-item"
          >
            <div class="incident-header">
              <span class="incident-status" :class="incident.ended_at ? 'resolved' : 'ongoing'">
                {{ incident.ended_at ? '已恢复' : '故障中' }}
              </span>
              <span class="incident-monitor">{{ incident.monitor_name }}</span>
            </div>
            <div class="incident-meta" v-if="incident.error_message">
              {{ incident.error_message }}
            </div>
            <div class="incident-meta">
              {{ formatTime(incident.started_at) }}
              <template v-if="incident.ended_at">
                → {{ formatTime(incident.ended_at) }}（持续 {{ formatIncidentDuration(incident.duration) }}）
              </template>
              <template v-else> · 进行中</template>
            </div>
          </div>
        </div>
      </div>

      <!-- 页脚 -->
      <footer class="status-footer">
        <p>Powered by <a href="https://github.com/LangfordKuo/Uptime" target="_blank" rel="noopener noreferrer">Uptime Monitor</a></p>
      </footer>
      </template>
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
const needPassword = ref(false)
const unlocked = ref(false)
const passwordInput = ref('')
const loading = ref(false)

const overallStatus = computed(() => {
  if (!statusPage.value?.monitors?.length) return 'unknown'
  const monitors = statusPage.value.monitors
  // 维护中的监控项不参与整体状态判定
  const active = monitors.filter(m => !m.in_maintenance)
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

const loadStatusPage = async (password = null) => {
  try {
    loading.value = true
    // 先加载时区设置
    await loadTimezoneSettings()

    const res = await statusPageApi.getPublic(route.params.slug, password)
    statusPage.value = res.data
    needPassword.value = false
    unlocked.value = true

    // 设置页面标题
    if (statusPage.value?.name) {
      document.title = statusPage.value.name
    }
  } catch (error) {
    if (error?.response?.status === 401 && error?.response?.data?.needsPassword) {
      needPassword.value = true
    } else if (error?.response?.status === 404) {
      ElMessage.error('状态页不存在或未公开')
    } else {
      ElMessage.error('加载失败')
    }
  } finally {
    loading.value = false
  }
}

const submitPassword = () => {
  if (!passwordInput.value) {
    ElMessage.warning('请输入密码')
    return
  }
  loadStatusPage(passwordInput.value)
}

onMounted(() => loadStatusPage())
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

/* 密码保护 */
.password-gate {
  display: flex;
  justify-content: center;
  padding-top: 8vh;
}

.password-card {
  background: var(--md-surface);
  border-radius: var(--md-shape-lg);
  box-shadow: var(--md-elevation-2);
  padding: 40px;
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.password-card h2 {
  margin: 0 0 8px 0;
  font-size: 1.4rem;
}

.password-card p {
  color: var(--md-on-surface-variant);
  margin: 0 0 24px 0;
}

/* 维护徽章 */
.maintenance-badge {
  font-size: 0.7rem;
  color: #ed6c02;
  background: #fff3e0;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

/* 最近事件 */
.incidents-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.incident-item {
  padding: 14px 16px;
  background: var(--md-surface-variant);
  border-radius: var(--md-shape-md);
}

.incident-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.incident-status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.incident-status.resolved {
  color: var(--md-success);
  background: var(--md-success-container, #e8f5e9);
}

.incident-status.ongoing {
  color: var(--md-error);
  background: var(--md-error-container, #fdecea);
}

.incident-monitor {
  font-weight: 600;
  color: var(--md-on-surface);
  font-size: 0.925rem;
}

.incident-meta {
  font-size: 0.8rem;
  color: var(--md-on-surface-variant);
  margin-top: 2px;
  word-break: break-all;
}

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
