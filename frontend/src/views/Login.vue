<template>
  <div class="login-page">
    <div class="login-container">
      <div class="brand-section">
        <div class="logo">
          <el-icon :size="64" color="var(--md-primary)"><Monitor /></el-icon>
        </div>
        <h1>{{ siteSettings.siteName }}</h1>
        <p>{{ siteSettings.siteDescription }}</p>
      </div>

      <div class="form-section">
        <div class="form-card">
          <h2>欢迎回来</h2>
          <p class="subtitle">请登录您的账户</p>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            class="login-form"
          >
            <el-form-item prop="username">
              <el-input
                v-model="form.username"
                placeholder="用户名"
                size="large"
                :prefix-icon="User"
                @keyup.enter="handleLogin"
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="密码"
                size="large"
                :prefix-icon="Lock"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>

            <el-button
              type="primary"
              size="large"
              class="login-btn"
              :loading="loading"
              @click="handleLogin"
            >
              登录
            </el-button>
          </el-form>
        </div>
      </div>
    </div>
    
    <!-- 页脚 -->
    <footer class="login-footer">
      <p>Powered by <a href="https://github.com/LangfordKuo/Uptime" target="_blank" rel="noopener noreferrer">Uptime Monitor</a></p>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { settingsApi } from '@/api'

const router = useRouter()
const authStore = useAuthStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const siteSettings = reactive({
  siteName: 'Uptime',
  siteDescription: '服务状态监控系统'
})

// 加载网站设置
const loadSiteSettings = async () => {
  try {
    const res = await settingsApi.getSiteSettings()
    if (res.data) {
      siteSettings.siteName = res.data.siteName || 'Uptime'
      siteSettings.siteDescription = res.data.siteDescription || '服务状态监控系统'
    }
  } catch (error) {
    console.error('加载网站设置失败:', error)
  }
}

onMounted(() => {
  loadSiteSettings()
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  try {
    await formRef.value.validate()
    loading.value = true
    
    await authStore.login(form)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (error) {
    if (error.response?.data?.message) {
      ElMessage.error(error.response.data.message)
    } else if (error !== false) {
      ElMessage.error('登录失败')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F5F5F5;
  padding: 20px;
}

.login-container {
  display: flex;
  width: 100%;
  max-width: 960px;
  min-height: 600px;
  background: var(--md-surface);
  border-radius: var(--md-shape-xl);
  overflow: hidden;
  box-shadow: var(--md-elevation-4);
}

.brand-section {
  flex: 1;
  background: var(--md-primary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: white;
  text-align: center;
}

.logo {
  width: 120px;
  height: 120px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--md-shape-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
  backdrop-filter: blur(10px);
}

.brand-section h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 16px 0;
}

.brand-section p {
  font-size: 1.125rem;
  opacity: 0.9;
  margin: 0;
}

.form-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.form-card {
  width: 100%;
  max-width: 360px;
}

.form-card h2 {
  font-size: 2rem;
  font-weight: 600;
  color: var(--md-on-surface);
  margin: 0 0 8px 0;
}

.form-card .subtitle {
  font-size: 1rem;
  color: var(--md-on-surface-variant);
  margin: 0 0 32px 0;
}

.login-form :deep(.el-input__wrapper) {
  padding: 12px 16px;
}

.login-btn {
  width: 100%;
  height: 52px;
  font-size: 1rem;
  font-weight: 600;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .login-container {
    flex-direction: column;
  }
  
  .brand-section {
    padding: 32px;
    min-height: 200px;
  }
  
  .brand-section h1 {
    font-size: 1.75rem;
  }
  
  .form-section {
    padding: 32px;
  }
}

/* 页脚 */
.login-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  padding: 16px;
  color: var(--md-on-surface-variant);
  font-size: 0.875rem;
}

.login-footer a {
  color: var(--md-on-surface-variant);
  text-decoration: none;
  border-bottom: 1px solid var(--md-outline-variant);
  transition: border-color 0.2s;
}

.login-footer a:hover {
  border-color: var(--md-primary);
}
</style>
