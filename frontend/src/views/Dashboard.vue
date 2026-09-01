<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="stat in statsList" :key="stat.key">
        <div class="stat-icon" :style="{ backgroundColor: stat.bgColor }">
          <el-icon :size="28" :color="stat.color">
            <component :is="stat.icon" />
          </el-icon>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <!-- 监控列表 -->
    <div class="monitors-section">
      <div class="section-header">
        <h2>服务监控</h2>
        <div class="header-actions">
          <el-select
            v-model="groupFilter"
            clearable
            placeholder="全部分组"
            size="default"
            style="width: 150px"
          >
            <el-option v-for="g in monitorStore.allGroups" :key="g" :label="g" :value="g" />
          </el-select>
          <el-input
            v-model="searchText"
            clearable
            placeholder="搜索名称/目标"
            style="width: 180px"
            :prefix-icon="Search"
          />
          <div class="filter-tabs">
            <button
              v-for="tab in filterTabs"
              :key="tab.value"
              class="tab-btn"
              :class="{ 'active': currentFilter === tab.value }"
              @click="currentFilter = tab.value"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="toolbar" v-if="authStore.isAdmin || authStore.isUser">
        <el-button size="small" @click="handleExport">
          <el-icon><Download /></el-icon>&nbsp;导出
        </el-button>
        <el-upload
          :show-file-list="false"
          accept=".json"
          :before-upload="handleImportFile"
        >
          <el-button size="small">
            <el-icon><Upload /></el-icon>&nbsp;导入
          </el-button>
        </el-upload>
        <el-button size="small" @click="$router.push('/monitors/create')" type="primary">
          <el-icon><Plus /></el-icon>&nbsp;新建监控
        </el-button>
      </div>

      <div class="monitors-grid">
        <MonitorCard
          v-for="monitor in filteredMonitors"
          :key="monitor.id"
          :monitor="monitor"
          @click="goToDetail(monitor.id)"
        />
      </div>

      <el-empty
        v-if="filteredMonitors.length === 0"
        :description="monitors.length === 0 ? '暂无监控项' : '没有匹配的监控项'"
        :image-size="120"
      >
        <el-button v-if="monitors.length === 0" type="primary" @click="$router.push('/monitors/create')">
          创建第一个监控
        </el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { Search, Download, Upload, Plus } from '@element-plus/icons-vue'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import { monitorApi } from '@/api'
import MonitorCard from '@/components/MonitorCard.vue'

const router = useRouter()
const monitorStore = useMonitorStore()
const authStore = useAuthStore()
const { monitors, dashboardStats } = storeToRefs(monitorStore)
const { fetchDashboard } = monitorStore

const currentFilter = ref('all')
const groupFilter = ref('')
const searchText = ref('')

const statsList = computed(() => [
  {
    key: 'total',
    label: '总监控项',
    value: dashboardStats.value.total || 0,
    icon: 'Monitor',
    color: '#6750A4',
    bgColor: '#EADDFF'
  },
  {
    key: 'up',
    label: '运行正常',
    value: dashboardStats.value.up || 0,
    icon: 'CircleCheck',
    color: '#2E7D32',
    bgColor: '#E8F5E9'
  },
  {
    key: 'down',
    label: '异常故障',
    value: dashboardStats.value.down || 0,
    icon: 'CircleClose',
    color: '#B3261E',
    bgColor: '#F9DEDC'
  },
  {
    key: 'incidents',
    label: '活动故障',
    value: dashboardStats.value.activeIncidents || 0,
    icon: 'Warning',
    color: '#ED6C02',
    bgColor: '#FFF3E0'
  }
])

const filterTabs = [
  { label: '全部', value: 'all' },
  { label: '正常', value: 'up' },
  { label: '故障', value: 'down' },
  { label: '未知', value: 'unknown' }
]

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
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败')
  }
}

const handleImportFile = async (file) => {
  try {
    const text = await file.text()
    const parsed = JSON.parse(text)
    const monitors = Array.isArray(parsed) ? parsed : parsed.monitors
    if (!Array.isArray(monitors) || monitors.length === 0) {
      ElMessage.error('文件中没有监控项')
      return false
    }
    const res = await monitorApi.importMonitors(monitors)
    if (res.success) {
      const { created, failed } = res.data
      ElMessage.success(`导入完成: 成功 ${created} 个${failed ? `，失败 ${failed} 个` : ''}`)
      fetchDashboard()
    }
  } catch (e) {
    ElMessage.error('导入失败: ' + (e?.response?.data?.message || '文件格式错误'))
  }
  return false // 阻止 el-upload 默认上传
}

onMounted(() => {
  fetchDashboard()
})
</script>

<style scoped>
.dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--md-surface);
  border-radius: var(--md-shape-lg);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--md-elevation-1);
  transition: box-shadow 0.2s;
}

.stat-card:hover {
  box-shadow: var(--md-elevation-2);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--md-shape-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--md-on-surface);
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--md-on-surface-variant);
  margin-top: 4px;
}

/* 监控列表 */
.monitors-section {
  background: var(--md-surface);
  border-radius: var(--md-shape-lg);
  padding: 24px;
  box-shadow: var(--md-elevation-1);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--md-on-surface);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.filter-tabs {
  display: flex;
  gap: 4px;
  background: var(--md-surface-variant);
  padding: 4px;
  border-radius: var(--md-shape-full);
  border: 1px solid var(--md-outline-variant);
}

.tab-btn {
  padding: 8px 20px;
  border: none;
  background: transparent;
  color: var(--md-on-surface-variant);
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--md-shape-full);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--md-on-surface);
  background: rgba(103, 80, 164, 0.05);
}

.tab-btn.active {
  background: var(--md-primary);
  color: var(--md-on-primary);
  box-shadow: none;
}

.monitors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

/* 响应式 */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }
}
</style>
