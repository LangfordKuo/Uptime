<template>
  <div class="monitor-detail-page">
    <el-page-header @back="$router.back()" title="返回">
      <template #content>
        <div class="page-header-content">
          <span class="page-title">{{ monitor.name }}</span>
          <el-tag v-if="monitor.inMaintenance" type="warning" size="large">
            <el-icon><Tools /></el-icon> 维护中
          </el-tag>
          <el-tag :type="statusType" size="large">{{ statusText }}</el-tag>
        </div>
      </template>
      <template #extra>
        <el-button @click="handleCheckNow" :loading="checking">
          <el-icon><VideoPlay /></el-icon>
          立即检测
        </el-button>
        <el-button @click="refreshData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button @click="$router.push(`/monitors/${$route.params.id}/edit`)">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="danger" @click="handleDelete">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </template>
    </el-page-header>

    <div v-loading="loading" class="content">
      <!-- Push 推送地址 -->
      <el-card v-if="monitor.type === 'push' && monitor.push_token" class="section-card">
        <template #header><span>推送地址</span></template>
        <el-input :model-value="pushUrl" readonly>
          <template #append>
            <el-button @click="copyText(pushUrl)">复制</el-button>
          </template>
        </el-input>
        <div class="form-help" style="margin-top: 8px">
          定期请求此 URL 表示服务存活，例如:
          <code>curl {{ pushUrl }}</code>
          （心跳周期 {{ monitor.config?.period || 300 }} 秒，超时 1.5 倍判定故障）
        </div>
      </el-card>

      <!-- SSL 证书信息 -->
      <el-card v-if="monitor.type === 'ssl' && monitor.latestExtra" class="section-card">
        <template #header><span>证书信息</span></template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="剩余天数">
            <el-tag :type="(monitor.latestExtra.daysRemaining ?? 0) < 14 ? 'danger' : 'success'">
              {{ monitor.latestExtra.daysRemaining }} 天
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="到期时间">{{ monitor.latestExtra.validTo }}</el-descriptions-item>
          <el-descriptions-item label="颁发者">{{ monitor.latestExtra.issuer || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

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
      <el-card class="section-card">
        <template #header>
          <div class="chart-header">
            <span>响应时间趋势</span>
            <el-radio-group v-model="chartRange" size="small" @change="refreshData">
              <el-radio-button :label="24">24小时</el-radio-button>
              <el-radio-button :label="168">7天</el-radio-button>
              <el-radio-button :label="720">30天</el-radio-button>
            </el-radio-group>
          </div>
        </template>
        <div ref="chartRef" class="chart-container"></div>
      </el-card>

      <!-- 维护窗口 -->
      <el-card class="section-card">
        <template #header>
          <div class="chart-header">
            <span>维护窗口
              <el-tooltip content="维护期间暂停检测、不触发告警、不计入可用率" placement="top">
                <el-icon style="vertical-align: middle"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
            <el-button size="small" type="primary" @click="maintenanceDialog = true">
              <el-icon><Plus /></el-icon>&nbsp;添加窗口
            </el-button>
          </div>
        </template>
        <el-table v-if="maintenanceWindows.length > 0" :data="maintenanceWindows" stripe>
          <el-table-column label="名称" prop="name">
            <template #default="{ row }">{{ row.name || '（未命名）' }}</template>
          </el-table-column>
          <el-table-column label="开始时间" width="200">
            <template #default="{ row }">{{ formatDateTime(row.start_at) }}</template>
          </el-table-column>
          <el-table-column label="结束时间" width="200">
            <template #default="{ row }">{{ formatDateTime(row.end_at) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag v-if="isWindowActive(row)" type="warning" size="small">进行中</el-tag>
              <el-tag v-else-if="new Date(row.end_at) < new Date()" type="info" size="small">已结束</el-tag>
              <el-tag v-else type="success" size="small">未开始</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button size="small" type="danger" link @click="handleDeleteMaintenance(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无维护窗口" :image-size="60" />
      </el-card>

      <!-- 最近检测结果 -->
      <el-card class="section-card">
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
              {{ row.response_time != null ? row.response_time + 'ms' : '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态码" prop="status_code" width="100">
            <template #default="{ row }">{{ row.status_code ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="错误信息" prop="error_message" show-overflow-tooltip />
          <el-table-column label="检测时间" prop="checked_at" width="180">
            <template #default="{ row }">
              {{ formatDateTime(row.checked_at) }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 故障事件 -->
      <el-card class="section-card">
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
                <div class="incident-period" v-if="incident.error_message">
                  {{ incident.error_message }}
                </div>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无故障事件" />
      </el-card>
    </div>

    <!-- 添加维护窗口对话框 -->
    <el-dialog v-model="maintenanceDialog" title="添加维护窗口" width="480px">
      <el-form label-width="90px">
        <el-form-item label="名称">
          <el-input v-model="maintenanceForm.name" placeholder="例如: 系统升级（可选）" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="maintenanceForm.range"
            type="datetimerange"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="maintenanceDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddMaintenance">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import { loadTimezoneSettings, formatWithSystemTimezone } from '@/utils/timezone'
import { monitorApi } from '@/api'
import { Refresh, Edit, Delete, VideoPlay, Plus, Tools, QuestionFilled } from '@element-plus/icons-vue'

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
const chartRange = ref(24)
const maintenanceDialog = ref(false)
const maintenanceForm = ref({ name: '', range: null })
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
  if (monitor.value.inMaintenance) return '维护中'
  if (!monitor.value.enabled) return '已禁用'
  switch (monitor.value.latestStatus) {
    case 'up': return '正常运行'
    case 'down': return '服务故障'
    default: return '未知状态'
  }
})

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
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败')
  }
}

const handleCheckNow = async () => {
  checking.value = true
  try {
    const res = await monitorApi.checkNow(route.params.id)
    if (res.success) {
      ElMessage.success(`检测完成: ${res.data.status === 'up' ? '正常' : '故障'}`)
      refreshData()
    }
  } catch {
    ElMessage.error('检测失败')
  } finally {
    checking.value = false
  }
}

const handleAddMaintenance = async () => {
  const { name, range } = maintenanceForm.value
  if (!range || range.length !== 2) {
    ElMessage.warning('请选择时间范围')
    return
  }
  try {
    const res = await monitorApi.createMaintenance(route.params.id, {
      name: name || '',
      start_at: range[0].toISOString(),
      end_at: range[1].toISOString()
    })
    if (res.success) {
      ElMessage.success('维护窗口已创建')
      maintenanceDialog.value = false
      maintenanceForm.value = { name: '', range: null }
      loadMaintenance()
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '创建失败')
  }
}

const handleDeleteMaintenance = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除此维护窗口？', '确认', { type: 'warning' })
    const res = await monitorApi.deleteMaintenance(row.id)
    if (res.success) {
      ElMessage.success('已删除')
      loadMaintenance()
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const loadMaintenance = async () => {
  try {
    const res = await monitorApi.getMaintenance(route.params.id)
    if (res.success) maintenanceWindows.value = res.data
  } catch { /* ignore */ }
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除监控项 "${monitor.value.name}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const res = await monitorApi.delete(route.params.id)
    if (res.success) {
      ElMessage.success('删除成功')
      router.push('/')
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除监控项失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const initChart = () => {
  if (!chartRef.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  const trend = stats.value.trend || []
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    xAxis: {
      type: 'category',
      data: trend.map(item => formatDateTime(item.time_slot).slice(chartRange.value > 24 ? 0 : 5, chartRange.value > 24 ? 10 : 16))
    },
    yAxis: {
      type: 'value',
      name: '响应时间 (ms)'
    },
    series: [
      {
        name: '平均响应时间',
        type: 'line',
        data: trend.map(item => item.avg_response_time != null ? Math.round(item.avg_response_time) : null),
        smooth: true,
        areaStyle: { opacity: 0.3 }
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
    await loadTimezoneSettings()

    const [monitorRes, statsRes, resultsRes, incidentsRes] = await Promise.all([
      monitorApi.getById(route.params.id),
      monitorApi.getStats(route.params.id, chartRange.value),
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
  loadMaintenance()
  window.addEventListener('resize', onResize)
})

const onResize = () => chartInstance?.resize()

onUnmounted(() => {
  chartInstance?.dispose()
  window.removeEventListener('resize', onResize)
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

.section-card {
  margin-bottom: 20px;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chart-container {
  width: 100%;
  height: 400px;
}

.form-help {
  color: #909399;
  font-size: 12px;
}

.form-help code {
  background: var(--md-surface-variant, #f5f5f5);
  padding: 1px 6px;
  border-radius: 4px;
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
