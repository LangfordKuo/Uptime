import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isUser = computed(() => user.value?.role === 'user')
  const isViewer = computed(() => user.value?.role === 'viewer')

  // 登录
  const login = async (credentials) => {
    const res = await authApi.login(credentials)
    
    token.value = res.data.token
    user.value = res.data.user
    
    localStorage.setItem('token', res.data.token)
    localStorage.setItem('user', JSON.stringify(res.data.user))
    
    return res
  }

  // 登出
  const logout = () => {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  // 检查认证状态
  const checkAuth = async () => {
    if (!token.value) return false
    
    try {
      const res = await authApi.getCurrentUser()
      user.value = res.data
      localStorage.setItem('user', JSON.stringify(res.data))
      return true
    } catch (error) {
      logout()
      return false
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isUser,
    isViewer,
    login,
    logout,
    checkAuth
  }
})
