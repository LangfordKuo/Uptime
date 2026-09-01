import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { monitorApi, dashboardApi } from '@/api'
import { io } from 'socket.io-client'
import { useAuthStore } from './auth'

export const useMonitorStore = defineStore('monitor', () => {
  const monitors = ref([])
  const dashboardStats = ref({})
  const loading = ref(false)
  const socket = ref(null)

  // 桌面通知开关（持久化到 localStorage）
  const desktopNotify = ref(localStorage.getItem('desktop_notify') === 'true')

  const setDesktopNotify = (enabled) => {
    desktopNotify.value = enabled
    localStorage.setItem('desktop_notify', String(enabled))
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  // 初始化 Socket.io 连接
  // 使用相对地址（同源部署/反向代理都能工作），并在握手时携带 token 鉴权
  const initSocket = () => {
    if (socket.value) return

    const authStore = useAuthStore()
    socket.value = io(window.location.origin, {
      path: '/socket.io',
      auth: { token: authStore.token },
      transports: ['websocket', 'polling']
    })

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
      const monitor = monitors.value.find(m => m.id === data.monitorId)
      // 桌面通知
      if (desktopNotify.value && 'Notification' in window && Notification.permission === 'granted') {
        const isDown = data.type === 'started'
        new Notification(isDown ? '🔴 服务故障' : '🟢 服务恢复', {
          body: monitor
            ? `${monitor.name} ${isDown ? (data.errorMessage || '检测失败') : '已恢复'}`
            : `监控 #${data.monitorId}`,
          tag: `uptime-${data.monitorId}`
        })
      }
    })

    socket.value.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    socket.value.on('connect_error', (err) => {
      console.warn('Socket connect error:', err.message)
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

  // 立即检测一次
  const checkNow = async (id) => {
    const res = await monitorApi.checkNow(id)
    if (res.success) {
      const monitor = monitors.value.find(m => m.id === id)
      if (monitor) {
        monitor.latestStatus = res.data.status
        monitor.latestResponseTime = res.data.responseTime
        monitor.latestCheck = new Date().toISOString()
      }
    }
    return res
  }

  // 创建监控项
  const createMonitor = async (data) => {
    const res = await monitorApi.create(data)
    if (res.success) {
      await fetchMonitors()
    }
    return res
  }

  // 更新监控项
  const updateMonitor = async (id, data) => {
    const res = await monitorApi.update(id, data)
    if (res.success) {
      await fetchMonitors()
    }
    return res
  }

  // 删除监控项
  const deleteMonitor = async (id) => {
    const res = await monitorApi.delete(id)
    if (res.success) {
      monitors.value = monitors.value.filter(m => m.id !== id)
    }
    return res
  }

  // 切换监控项状态
  const toggleMonitor = async (id) => {
    const res = await monitorApi.toggle(id)
    if (res.success) {
      await fetchMonitors()
    }
    return res
  }

  // 计算属性
  const totalMonitors = computed(() => monitors.value.length)
  const activeMonitors = computed(() => monitors.value.filter(m => m.enabled).length)
  const upMonitors = computed(() => monitors.value.filter(m => m.latestStatus === 'up').length)
  const allGroups = computed(() =>
    [...new Set(monitors.value.map(m => m.group_name).filter(Boolean))].sort()
  )

  return {
    monitors,
    dashboardStats,
    loading,
    socket,
    desktopNotify,
    setDesktopNotify,
    totalMonitors,
    activeMonitors,
    upMonitors,
    allGroups,
    initSocket,
    disconnectSocket,
    fetchMonitors,
    fetchDashboard,
    checkNow,
    createMonitor,
    updateMonitor,
    deleteMonitor,
    toggleMonitor
  }
})
