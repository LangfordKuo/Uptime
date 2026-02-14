<template>
  <div class="install-page">
    <div class="install-container">
      <el-card class="install-card">
        <template #header>
          <div class="install-header">
            <el-icon class="header-icon"><Setting /></el-icon>
            <h2>系统安装</h2>
            <p class="subtitle">Uptime Monitor 首次安装配置</p>
          </div>
        </template>

        <el-steps :active="currentStep" finish-status="success" align-center>
          <el-step title="欢迎" />
          <el-step title="创建管理员" />
          <el-step title="完成" />
        </el-steps>

        <div class="step-content">
          <!-- 步骤1：欢迎 -->
          <div v-if="currentStep === 0" class="step-welcome">
            <el-result icon="info" title="欢迎使用 Uptime Monitor">
              <template #sub-title>
                <p>感谢选择 Uptime Monitor 服务监控系统</p>
                <p>在开始使用之前，您需要创建一个管理员账户</p>
              </template>
              <template #extra>
                <el-button type="primary" @click="currentStep = 1">
                  开始安装
                  <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                </el-button>
              </template>
            </el-result>
          </div>

          <!-- 步骤2：创建管理员 -->
          <div v-if="currentStep === 1" class="step-form">
            <el-form
              ref="formRef"
              :model="form"
              :rules="rules"
              label-width="100px"
              size="large"
            >
              <el-form-item label="用户名" prop="username">
                <el-input
                  v-model="form.username"
                  placeholder="请输入管理员用户名"
                  prefix-icon="User"
                />
              </el-form-item>

              <el-form-item label="邮箱" prop="email">
                <el-input
                  v-model="form.email"
                  placeholder="请输入管理员邮箱"
                  prefix-icon="Message"
                />
              </el-form-item>

              <el-form-item label="密码" prop="password">
                <el-input
                  v-model="form.password"
                  type="password"
                  placeholder="请输入密码（至少6位）"
                  prefix-icon="Lock"
                  show-password
                />
              </el-form-item>

              <el-form-item label="确认密码" prop="confirmPassword">
                <el-input
                  v-model="form.confirmPassword"
                  type="password"
                  placeholder="请再次输入密码"
                  prefix-icon="Lock"
                  show-password
                />
              </el-form-item>

              <el-form-item>
                <el-space>
                  <el-button @click="currentStep = 0">上一步</el-button>
                  <el-button type="primary" :loading="installing" @click="handleInstall">
                    开始安装
                  </el-button>
                </el-space>
              </el-form-item>
            </el-form>
          </div>

          <!-- 步骤3：完成 -->
          <div v-if="currentStep === 2" class="step-complete">
            <el-result icon="success" title="安装成功">
              <template #sub-title>
                <p>管理员账户已创建成功</p>
                <p>用户名：<strong>{{ form.username }}</strong></p>
                <p>请牢记您的登录信息</p>
              </template>
              <template #extra>
                <el-button type="primary" @click="goToLogin">
                  前往登录
                  <el-icon class="el-icon--right"><ArrowRight /></el-icon>
                </el-button>
              </template>
            </el-result>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { installApi } from '@/api'
import { clearInstallCache } from '@/router'

const router = useRouter()

const currentStep = ref(0)
const installing = ref(false)
const formRef = ref(null)

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const validatePass = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请输入密码'))
  } else if (value.length < 6) {
    callback(new Error('密码长度至少6位'))
  } else {
    if (form.confirmPassword !== '') {
      formRef.value.validateField('confirmPassword')
    }
    callback()
  }
}

const validateConfirmPass = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== form.password) {
    callback(new Error('两次密码输入不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 50, message: '用户名长度在3-50个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, validator: validatePass, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirmPass, trigger: 'blur' }
  ]
}

const handleInstall = async () => {
  try {
    await formRef.value.validate()
    
    installing.value = true
    
    await installApi.install(form)
    
    // 清除安装检查缓存，下次路由切换时会重新检查
    clearInstallCache()
    
    ElMessage.success('安装成功')
    currentStep.value = 2
  } catch (error) {
    if (error !== false) {
      ElMessage.error(error.response?.data?.message || error.message || '安装失败')
    }
  } finally {
    installing.value = false
  }
}

const goToLogin = () => {
  router.push('/login')
}
</script>

<style scoped>
.install-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.install-container {
  width: 100%;
  max-width: 800px;
}

.install-card {
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.install-header {
  text-align: center;
}

.header-icon {
  font-size: 64px;
  color: #667eea;
  margin-bottom: 16px;
}

.install-header h2 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 28px;
}

.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.step-content {
  margin-top: 40px;
  min-height: 300px;
}

.step-welcome,
.step-complete {
  padding: 20px 0;
}

.step-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

:deep(.el-result__title) {
  font-size: 24px;
}

:deep(.el-result__subtitle p) {
  margin: 8px 0;
  font-size: 16px;
}

:deep(.el-result__subtitle strong) {
  color: #667eea;
  font-size: 18px;
}
</style>
