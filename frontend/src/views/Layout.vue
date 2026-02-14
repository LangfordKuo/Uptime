<template>
  <div class="layout">
    <el-container>
      <el-header class="header">
        <div class="header-content">
          <h1 class="title">
            <el-icon><Monitor /></el-icon>
            Uptime Monitor
          </h1>
          <div class="header-right">
            <el-button 
              type="primary" 
              @click="$router.push('/monitors/create')"
              v-if="authStore.isAdmin || authStore.isUser"
            >
              <el-icon><Plus /></el-icon>
              新建监控
            </el-button>
            <el-dropdown @command="handleCommand">
              <el-button type="info" plain>
                <el-icon><User /></el-icon>
                {{ authStore.user?.username }}
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item disabled>
                    <el-tag :type="roleType" size="small">{{ roleText }}</el-tag>
                  </el-dropdown-item>
                  <el-dropdown-item command="users">
                    <el-icon><UserFilled /></el-icon>
                    用户管理
                  </el-dropdown-item>
                  <el-dropdown-item divided command="logout">
                    <el-icon><SwitchButton /></el-icon>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const monitorStore = useMonitorStore()
const authStore = useAuthStore()

const roleType = computed(() => {
  switch (authStore.user?.role) {
    case 'admin': return 'danger'
    case 'user': return 'success'
    case 'viewer': return 'info'
    default: return 'info'
  }
})

const roleText = computed(() => {
  switch (authStore.user?.role) {
    case 'admin': return '管理员'
    case 'user': return '用户'
    case 'viewer': return '访客'
    default: return '未知'
  }
})

const handleCommand = async (command) => {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      
      authStore.logout()
      ElMessage.success('已退出登录')
      router.push('/login')
    } catch (error) {
      // 用户取消
    }
  } else if (command === 'users') {
    router.push('/users')
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
.layout {
  min-height: 100vh;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  color: white;
  font-size: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.main {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}
</style>
