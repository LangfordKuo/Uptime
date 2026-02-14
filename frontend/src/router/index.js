import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { installApi } from '@/api'

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
      const res = await installApi.checkInstalled()
      if (!res.data.installed) {
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
  
  next()
})

export default router
