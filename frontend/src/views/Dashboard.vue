<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon class="stat-icon total"><Files /></el-icon>
            <div class="stat-content">
              <div class="stat-value">{{ dashboardStats.total || 0 }}</div>
              <div class="stat-label">总监控项</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon class="stat-icon up"><CircleCheck /></el-icon>
            <div class="stat-content">
              <div class="stat-value">{{ dashboardStats.up || 0 }}</div>
              <div class="stat-label">运行正常</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon class="stat-icon down"><CircleClose /></el-icon>
            <div class="stat-content">
              <div class="stat-value">{{ dashboardStats.down || 0 }}</div>
              <div class="stat-label">异常故障</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="stat-card">
            <el-icon class="stat-icon incidents"><Warning /></el-icon>
            <div class="stat-content">
              <div class="stat-value">{{ dashboardStats.activeIncidents || 0 }}</div>
              <div class="stat-label">活动故障</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="monitors-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>监控项列表</span>
          <el-button text @click="fetchDashboard">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <div v-if="monitors.length === 0" class="empty-state">
        <el-empty description="暂无监控项">
          <el-button type="primary" @click="$router.push('/monitors/create')">
            创建第一个监控项
          </el-button>
        </el-empty>
      </div>

      <div v-else class="monitors-grid">
        <MonitorCard
          v-for="monitor in monitors"
          :key="monitor.id"
          :monitor="monitor"
          @toggle="handleToggle"
          @delete="handleDelete"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMonitorStore } from '@/stores/monitor'
import MonitorCard from '@/components/MonitorCard.vue'

const monitorStore = useMonitorStore()
const { monitors, dashboardStats, loading } = storeToRefs(monitorStore)
const { fetchDashboard, toggleMonitor, deleteMonitor } = monitorStore

onMounted(() => {
  fetchDashboard()
})

const handleToggle = async (id) => {
  try {
    await toggleMonitor(id)
    ElMessage.success('操作成功')
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleDelete = async (monitor) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除监控项 "${monitor.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await deleteMonitor(monitor.id)
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}
</script>

<style scoped>
.dashboard {
  padding: 20px 0;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  font-size: 48px;
}

.stat-icon.total {
  color: #409eff;
}

.stat-icon.up {
  color: #67c23a;
}

.stat-icon.down {
  color: #f56c6c;
}

.stat-icon.incidents {
  color: #e6a23c;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  color: #909399;
  font-size: 14px;
}

.monitors-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.monitors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.empty-state {
  padding: 40px 0;
}
</style>
