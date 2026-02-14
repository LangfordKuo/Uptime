<template>
  <div class="system-settings">
    <el-row :gutter="24">
      <!-- 网站基本信息 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><Setting /></el-icon>
              <span>网站基本信息</span>
            </div>
          </template>
          
          <el-form
            ref="siteFormRef"
            :model="siteForm"
            :rules="siteRules"
            label-width="100px"
            label-position="top"
          >
            <el-form-item label="网站名称" prop="siteName">
              <el-input 
                v-model="siteForm.siteName" 
                placeholder="请输入网站名称"
              />
            </el-form-item>

            <el-form-item label="网站URL" prop="siteUrl">
              <el-input 
                v-model="siteForm.siteUrl" 
                placeholder="https://example.com"
              />
            </el-form-item>

            <el-form-item label="网站介绍" prop="siteDescription">
              <el-input
                v-model="siteForm.siteDescription"
                type="textarea"
                :rows="4"
                placeholder="请输入网站介绍"
              />
            </el-form-item>

            <el-form-item>
              <el-button 
                type="primary" 
                @click="saveSiteSettings"
                :loading="savingSite"
              >
                <el-icon><Check /></el-icon>
                保存设置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 外观设置 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><Brush /></el-icon>
              <span>外观设置</span>
            </div>
          </template>

          <div class="theme-section">
            <h4>主题模式</h4>
            <div class="theme-options">
              <div 
                class="theme-option" 
                :class="{ active: currentTheme === 'light' }"
                @click="setTheme('light')"
              >
                <div class="theme-preview light">
                  <div class="preview-header"></div>
                  <div class="preview-content">
                    <div class="preview-card"></div>
                    <div class="preview-card"></div>
                  </div>
                </div>
                <span class="theme-label">亮色模式</span>
                <el-icon v-if="currentTheme === 'light'" class="check-icon"><Check /></el-icon>
              </div>

              <div 
                class="theme-option" 
                :class="{ active: currentTheme === 'dark' }"
                @click="setTheme('dark')"
              >
                <div class="theme-preview dark">
                  <div class="preview-header"></div>
                  <div class="preview-content">
                    <div class="preview-card"></div>
                    <div class="preview-card"></div>
                  </div>
                </div>
                <span class="theme-label">暗色模式</span>
                <el-icon v-if="currentTheme === 'dark'" class="check-icon"><Check /></el-icon>
              </div>

              <div 
                class="theme-option" 
                :class="{ active: currentTheme === 'auto' }"
                @click="setTheme('auto')"
              >
                <div class="theme-preview auto">
                  <div class="preview-header"></div>
                  <div class="preview-content">
                    <div class="preview-card light"></div>
                    <div class="preview-card dark"></div>
                  </div>
                </div>
                <span class="theme-label">跟随系统</span>
                <el-icon v-if="currentTheme === 'auto'" class="check-icon"><Check /></el-icon>
              </div>
            </div>
          </div>

          <el-divider />

          <div class="accent-color-section">
            <h4>强调色</h4>
            <div class="color-options">
              <div 
                v-for="color in accentColors" 
                :key="color.value"
                class="color-option"
                :class="{ active: currentAccent === color.value }"
                @click="setAccentColor(color.value)"
              >
                <div class="color-circle" :style="{ backgroundColor: color.hex }"></div>
                <span class="color-label">{{ color.label }}</span>
                <el-icon v-if="currentAccent === color.value" class="check-icon"><Check /></el-icon>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 时区设置 -->
        <el-card style="margin-top: 24px;">
          <template #header>
            <div class="card-header">
              <el-icon><Clock /></el-icon>
              <span>时区设置</span>
            </div>
          </template>
          
          <el-form
            :model="timezoneForm"
            label-width="100px"
            label-position="top"
          >
            <el-form-item label="显示时区">
              <el-select 
                v-model="timezoneForm.timezone" 
                placeholder="选择时区"
                style="width: 100%"
                filterable
              >
                <el-option
                  v-for="tz in timezoneOptions"
                  :key="tz.value"
                  :label="tz.label"
                  :value="tz.value"
                />
              </el-select>
              <div class="form-hint">选择后，所有时间显示将使用该时区</div>
            </el-form-item>

            <el-form-item label="日期时间格式">
              <el-select 
                v-model="timezoneForm.dateFormat" 
                placeholder="选择格式"
                style="width: 100%"
              >
                <el-option
                  v-for="fmt in dateFormatOptions"
                  :key="fmt.value"
                  :label="fmt.label"
                  :value="fmt.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="预览">
              <div class="timezone-preview">
                <div class="preview-item">
                  <span class="preview-label">当前时间：</span>
                  <span class="preview-value">{{ formattedCurrentTime }}</span>
                </div>
                <div class="preview-item">
                  <span class="preview-label">UTC时间：</span>
                  <span class="preview-value">{{ utcCurrentTime }}</span>
                </div>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button 
                type="primary" 
                @click="saveTimezoneSettings"
                :loading="savingTimezone"
              >
                <el-icon><Check /></el-icon>
                保存时区设置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 系统信息 -->
        <el-card style="margin-top: 24px;">
          <template #header>
            <div class="card-header">
              <el-icon><InfoFilled /></el-icon>
              <span>系统信息</span>
            </div>
          </template>
          
          <div class="system-info">
            <div class="info-item">
              <span class="info-label">系统版本</span>
              <span class="info-value">v1.0.0</span>
            </div>
            <div class="info-item">
              <span class="info-label">Node.js 版本</span>
              <span class="info-value">{{ systemInfo.nodeVersion }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">数据库</span>
              <span class="info-value">SQLite</span>
            </div>
            <div class="info-item">
              <span class="info-label">运行时间</span>
              <span class="info-value">{{ systemInfo.uptime }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { settingsApi } from '@/api'
import { Clock } from '@element-plus/icons-vue'

const siteFormRef = ref(null)
const savingSite = ref(false)
const currentTheme = ref('light')
const currentAccent = ref('black')
const savingTimezone = ref(false)
const timezoneOptions = ref([])
const dateFormatOptions = ref([])
const currentTime = ref(new Date())

const siteForm = reactive({
  siteName: 'Uptime',
  siteUrl: '',
  siteDescription: '服务状态监控系统'
})

const timezoneForm = reactive({
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD HH:mm:ss'
})

const siteRules = {
  siteName: [
    { required: true, message: '请输入网站名称', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在1-50个字符', trigger: 'blur' }
  ],
  siteUrl: [
    { type: 'url', message: '请输入有效的URL', trigger: 'blur' }
  ]
}

const accentColors = [
  { value: 'black', label: '经典黑', hex: '#1A1A1A' },
  { value: 'blue', label: '科技蓝', hex: '#1976D2' },
  { value: 'green', label: '自然绿', hex: '#388E3C' },
  { value: 'purple', label: '优雅紫', hex: '#7B1FA2' },
  { value: 'orange', label: '活力橙', hex: '#F57C00' },
]

const systemInfo = reactive({
  nodeVersion: '',
  uptime: '0天 0小时'
})

// 加载设置
const loadSettings = async () => {
  try {
    // 从后端加载网站设置
    const res = await settingsApi.getSiteSettings()
    if (res.data) {
      Object.assign(siteForm, res.data)
      // 更新页面标题
      document.title = siteForm.siteName
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
  
  // 加载时区设置
  try {
    const tzRes = await settingsApi.getTimezoneSettings()
    if (tzRes.data) {
      Object.assign(timezoneForm, tzRes.data)
    }
  } catch (error) {
    console.error('加载时区设置失败:', error)
  }
  
  // 加载时区选项
  try {
    const optionsRes = await settingsApi.getTimezoneOptions()
    if (optionsRes.data) {
      timezoneOptions.value = optionsRes.data.timezones
      dateFormatOptions.value = optionsRes.data.dateFormats
    }
  } catch (error) {
    console.error('加载时区选项失败:', error)
  }
  
  // 从本地存储加载主题和强调色（这些保存在本地）
  const saved = localStorage.getItem('systemSettings')
  if (saved) {
    const settings = JSON.parse(saved)
    currentTheme.value = settings.theme || 'light'
    currentAccent.value = settings.accent || 'black'
  }
}

// 保存时区设置
const saveTimezoneSettings = async () => {
  try {
    savingTimezone.value = true
    await settingsApi.saveTimezoneSettings({
      timezone: timezoneForm.timezone,
      dateFormat: timezoneForm.dateFormat
    })
    ElMessage.success('时区设置已保存')
  } catch (error) {
    console.error(error)
    ElMessage.error('保存失败')
  } finally {
    savingTimezone.value = false
  }
}

// 格式化日期时间
const formatDateTime = (date, timezone, format) => {
  if (!date) return ''
  
  try {
    // 创建 UTC 时间的 Date 对象
    const utcDate = new Date(date)
    
    if (timezone === 'UTC') {
      const year = utcDate.getUTCFullYear()
      const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
      const day = String(utcDate.getUTCDate()).padStart(2, '0')
      const hour = String(utcDate.getUTCHours()).padStart(2, '0')
      const minute = String(utcDate.getUTCMinutes()).padStart(2, '0')
      const second = String(utcDate.getUTCSeconds()).padStart(2, '0')
      
      return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hour)
        .replace('mm', minute)
        .replace('ss', second)
    }
    
    // 使用 Intl.DateTimeFormat 进行时区转换
    const options = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }
    
    const formatter = new Intl.DateTimeFormat('en-US', options)
    const parts = formatter.formatToParts(utcDate)
    
    const year = parts.find(p => p.type === 'year').value
    const month = parts.find(p => p.type === 'month').value
    const day = parts.find(p => p.type === 'day').value
    const hour = parts.find(p => p.type === 'hour').value
    const minute = parts.find(p => p.type === 'minute').value
    const second = parts.find(p => p.type === 'second').value
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hour)
      .replace('mm', minute)
      .replace('ss', second)
  } catch (error) {
    console.error('时间格式化错误:', error)
    return date.toString()
  }
}

// 计算属性：格式化的当前时间
const formattedCurrentTime = computed(() => {
  return formatDateTime(currentTime.value, timezoneForm.timezone, timezoneForm.dateFormat)
})

// 计算属性：UTC当前时间
const utcCurrentTime = computed(() => {
  return formatDateTime(currentTime.value, 'UTC', 'YYYY-MM-DD HH:mm:ss')
})

// 保存网站设置
const saveSiteSettings = async () => {
  try {
    await siteFormRef.value.validate()
    savingSite.value = true
    
    // 保存到后端
    await settingsApi.saveSiteSettings({
      siteName: siteForm.siteName,
      siteUrl: siteForm.siteUrl,
      siteDescription: siteForm.siteDescription
    })
    
    // 更新页面标题
    document.title = siteForm.siteName
    
    ElMessage.success('网站设置已保存')
  } catch (error) {
    console.error(error)
    ElMessage.error('保存失败')
  } finally {
    savingSite.value = false
  }
}

// 设置主题
const setTheme = (theme) => {
  currentTheme.value = theme
  const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}')
  settings.theme = theme
  localStorage.setItem('systemSettings', JSON.stringify(settings))
  
  // 应用主题
  applyTheme(theme)
  ElMessage.success(`已切换到${theme === 'light' ? '亮色' : theme === 'dark' ? '暗色' : '跟随系统'}模式`)
}

// 应用主题
const applyTheme = (theme) => {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
  } else if (theme === 'light') {
    html.classList.remove('dark')
  } else {
    // auto: 检测系统偏好
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }
}

// 设置强调色
const setAccentColor = (color) => {
  currentAccent.value = color
  const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}')
  settings.accent = color
  localStorage.setItem('systemSettings', JSON.stringify(settings))
  
  // 应用强调色
  applyAccentColor(color)
  ElMessage.success('强调色已更新')
}

// 应用强调色
const applyAccentColor = (color) => {
  const colorMap = {
    black: '#1A1A1A',
    blue: '#1976D2',
    green: '#388E3C',
    purple: '#7B1FA2',
    orange: '#F57C00'
  }
  document.documentElement.style.setProperty('--md-primary', colorMap[color])
}

// 获取系统信息
const loadSystemInfo = () => {
  // 模拟系统信息
  systemInfo.nodeVersion = 'v18.x.x'
  systemInfo.uptime = '3天 12小时'
}

onMounted(() => {
  loadSettings()
  loadSystemInfo()
  applyTheme(currentTheme.value)
  applyAccentColor(currentAccent.value)
  
  // 每秒更新当前时间用于预览
  setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})
</script>

<style scoped>
.system-settings {
  padding: 0;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--md-on-surface);
}

/* 主题选择 */
.theme-section h4,
.accent-color-section h4 {
  margin: 0 0 16px 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--md-on-surface);
}

.theme-options {
  display: flex;
  gap: 16px;
}

.theme-option {
  flex: 1;
  cursor: pointer;
  padding: 12px;
  border-radius: var(--md-shape-md);
  border: 2px solid transparent;
  transition: all 0.2s ease;
  position: relative;
}

.theme-option:hover {
  background-color: var(--md-surface-variant);
}

.theme-option.active {
  border-color: var(--md-primary);
  background-color: var(--md-primary-container);
}

.theme-preview {
  width: 100%;
  height: 80px;
  border-radius: var(--md-shape-sm);
  overflow: hidden;
  margin-bottom: 8px;
  border: 1px solid var(--md-outline-variant);
}

.theme-preview.light {
  background-color: #FFFFFF;
}

.theme-preview.dark {
  background-color: #1A1A1A;
}

.theme-preview.auto {
  background: linear-gradient(135deg, #FFFFFF 50%, #1A1A1A 50%);
}

.preview-header {
  height: 20px;
  background-color: rgba(128, 128, 128, 0.2);
}

.preview-content {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-card {
  height: 16px;
  border-radius: 4px;
  background-color: rgba(128, 128, 128, 0.15);
}

.preview-card.light {
  background-color: rgba(0, 0, 0, 0.1);
}

.preview-card.dark {
  background-color: rgba(255, 255, 255, 0.1);
}

.theme-label {
  display: block;
  text-align: center;
  font-size: 0.875rem;
  color: var(--md-on-surface-variant);
}

.theme-option.active .theme-label {
  color: var(--md-primary);
  font-weight: 500;
}

.check-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--md-primary);
  font-size: 1.25rem;
}

/* 强调色选择 */
.accent-color-section {
  margin-top: 24px;
}

.color-options {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.color-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 12px 16px;
  border-radius: var(--md-shape-md);
  border: 2px solid transparent;
  transition: all 0.2s ease;
  position: relative;
  min-width: 80px;
}

.color-option:hover {
  background-color: var(--md-surface-variant);
}

.color-option.active {
  border-color: var(--md-primary);
  background-color: var(--md-primary-container);
}

.color-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--md-outline-variant);
}

.color-label {
  font-size: 0.875rem;
  color: var(--md-on-surface-variant);
}

.color-option.active .color-label {
  color: var(--md-primary);
  font-weight: 500;
}

/* 系统信息 */
.system-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--md-outline-variant);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 0.875rem;
  color: var(--md-on-surface-variant);
}

.info-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--md-on-surface);
  font-family: monospace;
}

/* 表单样式 */
:deep(.el-form-item__label) {
  color: var(--md-on-surface-variant) !important;
  font-weight: 500;
  padding-bottom: 8px;
}

:deep(.el-input__wrapper) {
  background-color: var(--md-surface-variant) !important;
  border-color: var(--md-outline-variant) !important;
}

:deep(.el-textarea__inner) {
  background-color: var(--md-surface-variant) !important;
  border-color: var(--md-outline-variant) !important;
}

/* 时区设置样式 */
.form-hint {
  font-size: 0.75rem;
  color: var(--md-on-surface-variant);
  margin-top: 4px;
}

.timezone-preview {
  background: var(--md-surface-variant);
  border-radius: var(--md-shape-sm);
  padding: 12px 16px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--md-outline-variant);
}

.preview-item:last-child {
  border-bottom: none;
}

.preview-label {
  font-size: 0.875rem;
  color: var(--md-on-surface-variant);
}

.preview-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--md-on-surface);
  font-family: monospace;
}
</style>
