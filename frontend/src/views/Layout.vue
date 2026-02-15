<template>
  <div class="app-layout">
    <!-- 侧边导航栏 -->
    <aside class="sidebar" :class="{ 'collapsed': isCollapsed }">
      <div class="sidebar-header">
        <div class="logo">
          <el-icon :size="32" color="var(--md-primary)"><Monitor /></el-icon>
          <span v-if="!isCollapsed" class="logo-text">Uptime</span>
        </div>
        <el-button 
          text 
          class="collapse-btn"
          @click="isCollapsed = !isCollapsed"
        >
          <el-icon :size="20"><Fold v-if="!isCollapsed" /><Expand v-else /></el-icon>
        </el-button>
      </div>

      <nav class="sidebar-nav">
        <router-link 
          v-for="item in menuItems" 
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'active': $route.path === item.path }"
        >
          <el-icon :size="24"><component :is="item.icon" /></el-icon>
          <span v-if="!isCollapsed" class="nav-text">{{ item.title }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <el-dropdown trigger="click" @command="handleCommand">
          <div class="user-profile">
            <div class="avatar">
              {{ authStore.user?.username?.charAt(0).toUpperCase() }}
            </div>
            <div v-if="!isCollapsed" class="user-info">
              <div class="username">{{ authStore.user?.username }}</div>
              <div class="role">{{ roleText }}</div>
            </div>
            <el-icon v-if="!isCollapsed" class="arrow"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="users" v-if="authStore.isAdmin">
                <el-icon><UserFilled /></el-icon>
                <span>用户管理</span>
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <el-icon><SwitchButton /></el-icon>
                <span>退出登录</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 顶部栏 -->
      <header class="top-bar">
        <div class="page-title">
          <h1>{{ pageTitle }}</h1>
          <p class="subtitle">{{ pageSubtitle }}</p>
        </div>
        <div class="top-actions">
          <el-button 
            v-if="showCreateButton"
            type="primary" 
            size="large"
            class="fab-button"
            @click="handleCreate"
          >
            <el-icon><Plus /></el-icon>
            <span>新建监控</span>
          </el-button>
        </div>
      </header>

      <!-- 页面内容 -->
      <div class="content-area">
        <router-view />
      </div>
      
      <!-- 页脚 -->
      <footer class="layout-footer">
        <p>Powered by <a href="https://github.com/LangfordKuo/Uptime" target="_blank" rel="noopener noreferrer">Uptime Monitor</a></p>
      </footer>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const monitorStore = useMonitorStore()
const authStore = useAuthStore()

const isCollapsed = ref(false)

const menuItems = computed(() => {
  const items = [
    { path: '/', title: '仪表盘', icon: 'Odometer' },
  ]
  if (authStore.isAdmin) {
    items.push({ path: '/status-pages', title: '状态页管理', icon: 'Document' })
    items.push({ path: '/system-settings', title: '系统管理', icon: 'Setting' })
  }
  items.push({ path: '/monitors/create', title: '新建监控', icon: 'Plus' })
  return items
})

const roleText = computed(() => {
  const map = { admin: '管理员', user: '用户', viewer: '访客' }
  return map[authStore.user?.role] || ''
})

const pageTitle = computed(() => {
  const titles = {
    '/': '仪表盘',
    '/monitors/create': '新建监控',
    '/status-pages': '状态页管理',
    '/system-settings': '系统管理',
  }
  return titles[route.path] || '监控详情'
})

const pageSubtitle = computed(() => {
  const subtitles = {
    '/': '查看所有服务的运行状态',
    '/monitors/create': '添加新的服务监控',
    '/status-pages': '管理公开状态页面',
    '/system-settings': '配置网站基本信息和外观',
  }
  return subtitles[route.path] || ''
})

const showCreateButton = computed(() => {
  return route.path === '/' && (authStore.isAdmin || authStore.isUser)
})

const handleCreate = () => {
  router.push('/monitors/create')
}

const handleCommand = async (command) => {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      authStore.logout()
      router.push('/login')
    } catch {
      // 取消
    }
  } else if (command === 'users') {
    router.push('/users')
  } else if (command === 'statusPages') {
    router.push('/status-pages')
  }
}

onMounted(() => {
  monitorStore.initSocket()
})

onUnmounted(() => {
  monitorStore.disconnectSocket()
})
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--md-background);
}

/* 侧边栏 */
.sidebar {
  width: 280px;
  background-color: var(--md-surface);
  border-right: 1px solid var(--md-outline-variant);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: fixed;
  height: 100vh;
  z-index: 100;
}

.sidebar.collapsed {
  width: 80px;
}

.sidebar-header {
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--md-outline-variant);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--md-primary);
  letter-spacing: -0.5px;
}

.collapse-btn {
  padding: 8px;
  color: var(--md-on-surface-variant);
}

/* 导航 */
.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: var(--md-shape-full);
  color: var(--md-on-surface-variant);
  text-decoration: none;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.nav-item:hover {
  background-color: var(--md-surface-variant);
  color: var(--md-on-surface);
}

.nav-item.active {
  background-color: var(--md-secondary-container);
  color: var(--md-on-secondary-container);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 60%;
  background-color: var(--md-primary);
  border-radius: 0 4px 4px 0;
}

.nav-text {
  font-size: 1rem;
  font-weight: 500;
}

/* 用户资料 */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--md-outline-variant);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--md-shape-md);
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-profile:hover {
  background-color: var(--md-surface-variant);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--md-shape-full);
  background: linear-gradient(135deg, var(--md-primary), var(--md-tertiary));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 600;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.username {
  font-weight: 600;
  color: var(--md-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.role {
  font-size: 0.75rem;
  color: var(--md-on-surface-variant);
}

.arrow {
  color: var(--md-on-surface-variant);
}

/* 主内容区 */
.main-content {
  flex: 1;
  margin-left: 280px;
  transition: margin-left 0.3s ease;
  display: flex;
  flex-direction: column;
}

.sidebar.collapsed + .main-content {
  margin-left: 80px;
}

/* 顶部栏 */
.top-bar {
  padding: 24px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--md-background);
}

.page-title h1 {
  font-size: 2rem;
  font-weight: 600;
  color: var(--md-on-background);
  margin: 0;
  letter-spacing: -0.5px;
}

.page-title .subtitle {
  font-size: 1rem;
  color: var(--md-on-surface-variant);
  margin: 4px 0 0 0;
}

.fab-button {
  height: 56px;
  padding: 0 24px;
  font-size: 1rem;
  border-radius: var(--md-shape-full) !important;
  box-shadow: var(--md-elevation-2);
}

.fab-button:hover {
  box-shadow: var(--md-elevation-3);
}

/* 内容区 */
.content-area {
  flex: 1;
  padding: 0 32px 32px;
  overflow-y: auto;
}

/* 页脚 */
.layout-footer {
  text-align: center;
  padding: 16px;
  color: var(--md-on-surface-variant);
  font-size: 0.875rem;
  border-top: 1px solid var(--md-outline-variant);
}

.layout-footer a {
  color: var(--md-on-surface-variant);
  text-decoration: none;
  border-bottom: 1px solid var(--md-outline-variant);
  transition: border-color 0.2s;
}

.layout-footer a:hover {
  border-color: var(--md-primary);
}

/* 响应式 */
@media (max-width: 768px) {
  .sidebar {
    width: 80px;
  }
  
  .sidebar .logo-text,
  .sidebar .nav-text,
  .sidebar .user-info,
  .sidebar .arrow {
    display: none;
  }
  
  .main-content {
    margin-left: 80px;
  }
}
</style>
