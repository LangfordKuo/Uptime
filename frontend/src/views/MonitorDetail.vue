<template>
  <div class="monitor-detail-page">
    <el-page-header @back="$router.back()" title="返回">
      <template #content>
        <div class="page-header-content">
          <span class="page-title">{{ monitor.name }}</span>
          <el-tag :type="statusType" size="large">{{ statusText }}</el-tag>
        </div>
      </template>
      <template #extra>
        <el-button @click="refreshData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button @click="$router.push(`/monitors/${$route.params.id}/edit`)">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
      </template>
    </el-page-header>

    <div v-loading="loading" class="content">
      <!-- 统计卡片 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <el-card shadow="hover">
            <div class="stat-item">
              <div class="stat-label">24小时可用率</div>
              <div class="stat-value">{{ stats.uptime?.last24h?.percentage || 0 }}%</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <div class="stat-item">
              <div class="stat-label">7天可用率</div>
              <div class="stat-value">{{ stats.uptime?.last7d?.percentage || 0 }}%</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <div class="stat-item">
              <div class="stat-label">平均响应时间</div>
              <div class="stat-value">{{ stats.avgResponseTime || 0 }}ms</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover">
            <div class="stat-item">
              <div class="stat-label">30天故障次数</div>
              <div class="stat-value">{{ stats.incidentCount || 0 }}</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 响应时间趋势图 -->
      <el-card class="chart-card">
        <template #header>
          <span>24小时响应时间趋势</span>
        </template>
        <div ref="chartRef" class="chart-container"></div>
      </el-card>

      <!-- 最近检测结果 -->
      <el-card class="results-card">
        <template #header>
          <span>最近检测结果</span>
        </template>
        <el-table :data="results" stripe>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'up' ? 'success' : 'danger'" size="small">
                {{ row.status === 'up' ? '正常' : '故障' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="响应时间" prop="response_time" width="120">
            <template #default="{ row }">
              {{ row.response_time ? row.response_time + 'ms' : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态码" prop="status_code" width="100" />
          <el-table-column label="错误信息" prop="error_message" show-overflow-tooltip />
          <el-table-column label="检测时间" prop="checked_at" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.checked_at) }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 故障事件 -->
      <el-card class="incidents-card">
        <template #header>
          <span>故障事件历史</span>
        </template>
        <el-timeline v-if="incidents.length > 0">
          <el-timeline-item
            v-for="incident in incidents"
            :key="incident.id"
            :timestamp="formatDateTime(incident.started_at)"
            placement="top"
          >
            <el-card>
              <div class="incident-item">
                <div>
                  <el-tag type="danger" size="small">故障</el-tag>
                  <span class="incident-time">
                    持续时间: {{ formatDuration(incident.duration) }}
                  </span>
                </div>
                <div class="incident-period" v-if="incident.ended_at">
                  {{ formatDateTime(incident.started_at) }} 至 {{ formatDateTime(incident.ended_at) }}
                </div>
                <div class="incident-period" v-else>
                  <el-tag type="warning" size="small">进行中</el-tag>
                </div>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无故障事件" />
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { formatTime, parseUTCTime } from '@/utils/datetime'
import { monitorApi } from '@/api'

const route = useRoute()

const monitor = ref({})
const stats = ref({})
const results = ref([])
const incidents = ref([])
const loading = ref(false)
const chartRef = ref(null)
let chartInstance = null

const statusType = computed(() => {
  if (!monitor.value.enabled) return 'info'
  switch (monitor.value.latestStatus) {
    case 'up': return 'success'
    case 'down': return 'danger'
    default: return 'info'
  }
})

const statusText = computed(() => {
  if (!monitor.value.enabled) return '已禁用'
  switch (monitor.value.latestStatus) {
    case 'up': return '正常运行'
    case 'down': return '服务故障'
    default: return '未知状态'
  }
})

const formatDateTime = (time) => {
  return formatTime(time, 'YYYY-MM-DD HH:mm:ss')
}

const formatDuration = (seconds) => {
  if (!seconds) return '-'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours}时${minutes}分${secs}秒`
}

const initChart = () => {
  if (!chartRef.value) return

  chartInstance = echarts.init(chartRef.value)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    xAxis: {
      type: 'category',
      data: stats.value.trend?.map(item => parseUTCTime(item.time_slot).format('MM-DD HH:mm')) || []
    },
    yAxis: {
      type: 'value',
      name: '响应时间 (ms)'
    },
    series: [
      {
        name: '平均响应时间',
        type: 'line',
        data: stats.value.trend?.map(item => Math.round(item.avg_response_time)) || [],
        smooth: true,
        areaStyle: {
          opacity: 0.3
        }
      }
    ],
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    }
  }

  chartInstance.setOption(option)
}

const refreshData = async () => {
  loading.value = true
  try {
    const [monitorRes, statsRes, resultsRes, incidentsRes] = await Promise.all([
      monitorApi.getById(route.params.id),
      monitorApi.getStats(route.params.id),
      monitorApi.getResults(route.params.id, 50),
      monitorApi.getIncidents(route.params.id, 20)
    ])

    if (monitorRes.success) monitor.value = monitorRes.data
    if (statsRes.success) stats.value = statsRes.data
    if (resultsRes.success) results.value = resultsRes.data
    if (incidentsRes.success) incidents.value = incidentsRes.data

    setTimeout(() => {
      initChart()
    }, 100)
  } catch (error) {
    console.error('Failed to load monitor details:', error)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshData()
  window.addEventListener('resize', () => {
    chartInstance?.resize()
  })
})

onUnmounted(() => {
  chartInstance?.dispose()
})
</script>

<style scoped>
.monitor-detail-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
}

.content {
  margin-top: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
}

.stat-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #409eff;
}

.chart-card,
.results-card,
.incidents-card {
  margin-bottom: 20px;
}

.chart-container {
  width: 100%;
  height: 400px;
}

.incident-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.incident-time {
  margin-left: 12px;
  color: #606266;
}

.incident-period {
  color: #909399;
  font-size: 13px;
}
</style>
