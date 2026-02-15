import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { installApi, settingsApi } from '@/api'

// 安装状态缓存
const INSTALL_CACHE_KEY = 'uptime_installed'
let installCheckCache = null
let installCheckPromise = null

// 初始化缓存（从 sessionStorage 读取）
function initInstallCache() {
  const cached = sessionStorage.getItem(INSTALL_CACHE_KEY)
  if (cached !== null) {
    installCheckCache = cached === 'true'
  }
}

// 检查安装状态（带缓存）
async function checkInstallStatus() {
  // 首次调用时尝试从 sessionStorage 读取
  if (installCheckCache === null) {
    initInstallCache()
  }
  
  // 如果已有缓存，直接返回
  if (installCheckCache !== null) {
    return installCheckCache
  }
  
  // 如果正在检查中，等待该请求完成
  if (installCheckPromise) {
    return installCheckPromise
  }
  
  // 发起新的检查请求
  installCheckPromise = installApi.checkInstalled()
    .then(res => {
      installCheckCache = res.data.installed
      // 将结果缓存到 sessionStorage
      sessionStorage.setItem(INSTALL_CACHE_KEY, String(installCheckCache))
      return installCheckCache
    })
    .catch(error => {
      console.error('Check install error:', error)
      return false
    })
    .finally(() => {
      installCheckPromise = null
    })
  
  return installCheckPromise
}

// 清除安装检查缓存（在安装完成后调用）
export function clearInstallCache() {
  installCheckCache = null
  sessionStorage.removeItem(INSTALL_CACHE_KEY)
}

const routes = [
  {
    path: '/install',
    name: 'Install',
    component: () => import('@/views/Install.vue'),
    meta: { requiresAuth: false, skipInstallCheck: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/status/:slug',
    name: 'PublicStatusPage',
    component: () => import('@/views/PublicStatusPage.vue'),
    meta: { requiresAuth: false, skipInstallCheck: true }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: 'monitors/create',
        name: 'MonitorCreate',
        component: () => import('@/views/MonitorForm.vue'),
        meta: { requiresRole: ['admin', 'user'] }
      },
      {
        path: 'monitors/:id',
        name: 'MonitorDetail',
        component: () => import('@/views/MonitorDetail.vue')
      },
      {
        path: 'monitors/:id/edit',
        name: 'MonitorEdit',
        component: () => import('@/views/MonitorForm.vue'),
        meta: { requiresRole: ['admin', 'user'] }
      },
      {
        path: 'users',
        name: 'UserManagement',
        component: () => import('@/views/UserManagement.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'status-pages',
        name: 'StatusPageManagement',
        component: () => import('@/views/StatusPageManagement.vue'),
        meta: { requiresRole: ['admin'] }
      },
      {
        path: 'system-settings',
        name: 'SystemSettings',
        component: () => import('@/views/SystemSettings.vue'),
        meta: { requiresRole: ['admin'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // 检查系统是否已安装（除了安装页面本身）
  if (!to.meta.skipInstallCheck) {
    try {
      const installed = await checkInstallStatus()
      if (!installed) {
        // 未安装，跳转到安装页面
        if (to.path !== '/install') {
          next('/install')
          return
        }
      } else {
        // 已安装，不允许访问安装页面
        if (to.path === '/install') {
          next('/login')
          return
        }
      }
    } catch (error) {
      console.error('Check install error:', error)
    }
  }
  
  // 如果路由需要认证
  if (to.meta.requiresAuth !== false) {
    if (!authStore.isAuthenticated) {
      // 未登录，跳转到登录页
      next('/login')
      return
    }
    
    // 检查角色权限
    if (to.meta.requiresRole) {
      const userRole = authStore.user?.role
      if (!to.meta.requiresRole.includes(userRole)) {
        // 权限不足，跳转到首页
        next('/')
        return
      }
    }
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    // 已登录用户访问登录页，跳转到首页
    next('/')
    return
  }
  
  // 设置页面标题
  try {
    const res = await settingsApi.getSiteSettings()
    if (res.data?.siteName) {
      document.title = res.data.siteName
    }
  } catch (error) {
    // 使用默认标题
  }
  
  next()
})

export default router
