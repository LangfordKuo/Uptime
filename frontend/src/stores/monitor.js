import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { monitorApi, dashboardApi } from '@/api'
import { io } from 'socket.io-client'

export const useMonitorStore = defineStore('monitor', () => {
  const monitors = ref([])
  const dashboardStats = ref({})
  const loading = ref(false)
  const socket = ref(null)

  // 初始化 Socket.io 连接
  const initSocket = () => {
    socket.value = io('http://localhost:3000')

    socket.value.on('connect', () => {
      console.log('Socket connected')
    })

    socket.value.on('monitor:status', (data) => {
      // 更新监控项状态
      const monitor = monitors.value.find(m => m.id === data.monitorId)
      if (monitor) {
        monitor.latestStatus = data.status
        monitor.latestResponseTime = data.responseTime
        monitor.latestCheck = data.timestamp
      }
    })

    socket.value.on('monitor:incident', (data) => {
      console.log('Incident event:', data)
      // 可以在此触发通知
    })

    socket.value.on('disconnect', () => {
      console.log('Socket disconnected')
    })
  }

  // 断开 Socket 连接
  const disconnectSocket = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
  }

  // 获取所有监控项
  const fetchMonitors = async () => {
    loading.value = true
    try {
      const res = await monitorApi.getAll()
      if (res.success) {
        monitors.value = res.data
      }
    } catch (error) {
      console.error('Failed to fetch monitors:', error)
    } finally {
      loading.value = false
    }
  }

  // 获取仪表盘数据
  const fetchDashboard = async () => {
    loading.value = true
    try {
      const res = await dashboardApi.getDashboard()
      if (res.success) {
        dashboardStats.value = res.data.stats
        monitors.value = res.data.monitors
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error)
    } finally {
      loading.value = false
    }
  }

  // 创建监控项
  const createMonitor = async (data) => {
    try {
      const res = await monitorApi.create(data)
      if (res.success) {
        await fetchMonitors()
        return res
      }
    } catch (error) {
      console.error('Failed to create monitor:', error)
      throw error
    }
  }

  // 更新监控项
  const updateMonitor = async (id, data) => {
    try {
      const res = await monitorApi.update(id, data)
      if (res.success) {
        await fetchMonitors()
        return res
      }
    } catch (error) {
      console.error('Failed to update monitor:', error)
      throw error
    }
  }

  // 删除监控项
  const deleteMonitor = async (id) => {
    try {
      const res = await monitorApi.delete(id)
      if (res.success) {
        await fetchMonitors()
        return res
      }
    } catch (error) {
      console.error('Failed to delete monitor:', error)
      throw error
    }
  }

  // 切换监控项状态
  const toggleMonitor = async (id) => {
    try {
      const res = await monitorApi.toggle(id)
      if (res.success) {
        await fetchMonitors()
        return res
      }
    } catch (error) {
      console.error('Failed to toggle monitor:', error)
      throw error
    }
  }

  // 计算属性
  const totalMonitors = computed(() => monitors.value.length)
  const activeMonitors = computed(() => monitors.value.filter(m => m.enabled).length)
  const upMonitors = computed(() => monitors.value.filter(m => m.latestStatus === 'up').length)

  return {
    monitors,
    dashboardStats,
    loading,
    socket,
    totalMonitors,
    activeMonitors,
    upMonitors,
    initSocket,
    disconnectSocket,
    fetchMonitors,
    fetchDashboard,
    createMonitor,
    updateMonitor,
    deleteMonitor,
    toggleMonitor
  }
})
