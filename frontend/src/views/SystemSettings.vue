<template>
  <div class="system-settings">
    <el-tabs v-model="activeTab" class="settings-tabs">
      <!-- ================= 基础设置 ================= -->
      <el-tab-pane label="基础设置" name="basic">
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
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- ================= 通知渠道 ================= -->
      <el-tab-pane label="通知渠道" name="notifications">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><Bell /></el-icon>
              <span>通知渠道</span>
              <el-button
                type="primary"
                size="small"
                style="margin-left: auto"
                @click="openChannelDialog()"
              >
                <el-icon><Plus /></el-icon>&nbsp;新建渠道
              </el-button>
            </div>
          </template>

          <el-alert
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
            title="监控项可以在编辑页绑定通知渠道；未绑定的监控项会使用所有已启用的渠道。"
          />

          <el-table v-if="channels.length > 0" :data="channels" stripe>
            <el-table-column label="名称" prop="name" min-width="140" />
            <el-table-column label="类型" width="120">
              <template #default="{ row }">
                <el-tag size="small">{{ channelTypeLabel(row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="绑定监控数" width="110">
              <template #default="{ row }">{{ row.monitor_ids.length }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220">
              <template #default="{ row }">
                <el-button size="small" link type="primary" :loading="testingId === row.id" @click="testChannel(row)">
                  测试
                </el-button>
                <el-button size="small" link type="primary" @click="openChannelDialog(row)">编辑</el-button>
                <el-button size="small" link type="danger" @click="deleteChannel(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="还没有通知渠道" :image-size="80" />
        </el-card>
      </el-tab-pane>

      <!-- ================= API Keys ================= -->
      <el-tab-pane label="API Keys" name="apikeys">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><Key /></el-icon>
              <span>API Keys</span>
              <el-button
                type="primary"
                size="small"
                style="margin-left: auto"
                @click="apiKeyDialog = true"
              >
                <el-icon><Plus /></el-icon>&nbsp;创建 Key
              </el-button>
            </div>
          </template>

          <el-alert
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
            title="API Key 拥有只读权限，通过请求头 X-API-Key 使用，适合接入第三方监控面板或脚本。"
          />

          <el-table v-if="apiKeys.length > 0" :data="apiKeys" stripe>
            <el-table-column label="名称" prop="name" min-width="160" />
            <el-table-column label="Key" prop="key_preview" width="160" />
            <el-table-column label="创建时间" width="180">
              <template #default="{ row }">{{ (row.created_at || '').replace('T', ' ').slice(0, 19) }}</template>
            </el-table-column>
            <el-table-column label="最后使用" width="180">
              <template #default="{ row }">{{ row.last_used_at ? row.last_used_at.replace('T', ' ').slice(0, 19) : '从未使用' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button size="small" link type="danger" @click="deleteApiKey(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="还没有 API Key" :image-size="80" />
        </el-card>
      </el-tab-pane>

      <!-- ================= 备份管理 ================= -->
      <el-tab-pane label="备份管理" name="backups">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon><FolderChecked /></el-icon>
              <span>数据库备份</span>
              <el-button
                type="primary"
                size="small"
                style="margin-left: auto"
                :loading="backingUp"
                @click="createBackup"
              >
                <el-icon><Plus /></el-icon>&nbsp;立即备份
              </el-button>
            </div>
          </template>

          <el-table v-if="backups.length > 0" :data="backups" stripe>
            <el-table-column label="文件名" prop="name" min-width="280" />
            <el-table-column label="大小" width="120">
              <template #default="{ row }">{{ formatSize(row.size) }}</template>
            </el-table-column>
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ row.created_at.replace('T', ' ').slice(0, 19) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button size="small" link type="primary" @click="downloadBackup(row)">下载</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无备份" :image-size="80" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 通知渠道编辑对话框 -->
    <el-dialog
      v-model="channelDialog"
      :title="editingChannel ? '编辑通知渠道' : '新建通知渠道'"
      width="560px"
    >
      <el-form label-width="110px">
        <el-form-item label="渠道名称" required>
          <el-input v-model="channelForm.name" placeholder="例如: 运维群机器人" />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select v-model="channelForm.type" style="width: 100%" @change="channelForm.config = {}">
            <el-option label="邮件 (SMTP)" value="email" />
            <el-option label="Telegram" value="telegram" />
            <el-option label="Webhook" value="webhook" />
            <el-option label="钉钉机器人" value="dingtalk" />
            <el-option label="飞书机器人" value="feishu" />
            <el-option label="企业微信机器人" value="wecom" />
          </el-select>
        </el-form-item>

        <!-- 各类型的配置字段 -->
        <template v-if="channelForm.type === 'email'">
          <el-form-item label="SMTP 服务器" required>
            <el-input v-model="channelForm.config.smtpHost" placeholder="smtp.example.com" />
          </el-form-item>
          <el-form-item label="端口">
            <el-input-number v-model="channelForm.config.smtpPort" :min="1" :max="65535" />
            <el-checkbox v-model="channelForm.config.smtpSecure" style="margin-left: 16px">SSL</el-checkbox>
          </el-form-item>
          <el-form-item label="账号">
            <el-input v-model="channelForm.config.smtpUser" placeholder="发件邮箱账号" />
          </el-form-item>
          <el-form-item label="密码/授权码">
            <el-input v-model="channelForm.config.smtpPass" type="password" show-password placeholder="邮箱授权码" />
          </el-form-item>
          <el-form-item label="收件邮箱" required>
            <el-input v-model="channelForm.config.to" placeholder="接收告警的邮箱" />
          </el-form-item>
        </template>

        <template v-if="channelForm.type === 'telegram'">
          <el-form-item label="Bot Token" required>
            <el-input v-model="channelForm.config.botToken" placeholder="123456:ABC-DEF..." show-password />
          </el-form-item>
          <el-form-item label="Chat ID" required>
            <el-input v-model="channelForm.config.chatId" placeholder="接收消息的 chat id" />
          </el-form-item>
        </template>

        <template v-if="channelForm.type === 'webhook'">
          <el-form-item label="URL" required>
            <el-input v-model="channelForm.config.url" placeholder="https://example.com/hook" />
          </el-form-item>
          <el-form-item label="密钥">
            <el-input v-model="channelForm.config.secret" placeholder="可选，通过 X-Webhook-Secret 头传递" show-password />
          </el-form-item>
        </template>

        <template v-if="channelForm.type === 'dingtalk'">
          <el-form-item label="Webhook" required>
            <el-input v-model="channelForm.config.webhookUrl" placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
          </el-form-item>
          <el-form-item label="加签密钥">
            <el-input v-model="channelForm.config.secret" placeholder="SEC 开头（可选）" show-password />
          </el-form-item>
        </template>

        <template v-if="channelForm.type === 'feishu'">
          <el-form-item label="Webhook" required>
            <el-input v-model="channelForm.config.webhookUrl" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
          </el-form-item>
          <el-form-item label="签名校验">
            <el-input v-model="channelForm.config.secret" placeholder="签名密钥（可选）" show-password />
          </el-form-item>
        </template>

        <template v-if="channelForm.type === 'wecom'">
          <el-form-item label="Webhook" required>
            <el-input v-model="channelForm.config.webhookUrl" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
          </el-form-item>
        </template>

        <el-form-item label="启用">
          <el-switch v-model="channelForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="channelDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingChannel" @click="saveChannel">保存</el-button>
      </template>
    </el-dialog>

    <!-- 创建 API Key 对话框 -->
    <el-dialog v-model="apiKeyDialog" title="创建 API Key" width="440px">
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="newApiKeyName" placeholder="例如: grafana 面板" />
        </el-form-item>
      </el-form>
      <div v-if="newApiKey" class="new-key-box">
        <div class="form-hint" style="margin-bottom: 8px">
          <b>请立即保存，此 Key 仅展示一次：</b>
        </div>
        <el-input :model-value="newApiKey" readonly>
          <template #append>
            <el-button @click="copyText(newApiKey)">复制</el-button>
          </template>
        </el-input>
      </div>
      <template #footer>
        <el-button @click="closeApiKeyDialog">关闭</el-button>
        <el-button v-if="!newApiKey" type="primary" :loading="creatingKey" @click="createApiKey">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { settingsApi, notificationApi, apiKeyApi, backupApi } from '@/api'
import { Clock, Bell, Key, FolderChecked, Plus } from '@element-plus/icons-vue'

const activeTab = ref('basic')
const siteFormRef = ref(null)
const savingSite = ref(false)
const currentTheme = ref('light')
const currentAccent = ref('black')
const savingTimezone = ref(false)
const timezoneOptions = ref([])
const dateFormatOptions = ref([])

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

// ===== 通知渠道 =====
const channels = ref([])
const channelDialog = ref(false)
const savingChannel = ref(false)
const testingId = ref(null)
const editingChannel = ref(null)
const channelForm = reactive({
  name: '',
  type: 'webhook',
  enabled: true,
  config: {}
})

const channelTypeLabel = (type) => {
  const map = {
    email: '邮件', telegram: 'Telegram', webhook: 'Webhook',
    dingtalk: '钉钉', feishu: '飞书', wecom: '企业微信'
  }
  return map[type] || type
}

const loadChannels = async () => {
  try {
    const res = await notificationApi.getChannels()
    if (res.success) channels.value = res.data
  } catch { /* ignore */ }
}

const openChannelDialog = (channel = null) => {
  editingChannel.value = channel
  if (channel) {
    channelForm.name = channel.name
    channelForm.type = channel.type
    channelForm.enabled = !!channel.enabled
    channelForm.config = { ...channel.config }
  } else {
    channelForm.name = ''
    channelForm.type = 'webhook'
    channelForm.enabled = true
    channelForm.config = {}
  }
  channelDialog.value = true
}

const saveChannel = async () => {
  if (!channelForm.name.trim()) {
    ElMessage.warning('请输入渠道名称')
    return
  }
  savingChannel.value = true
  try {
    const payload = {
      name: channelForm.name.trim(),
      type: channelForm.type,
      enabled: channelForm.enabled,
      config: { ...channelForm.config }
    }
    const res = editingChannel.value
      ? await notificationApi.updateChannel(editingChannel.value.id, payload)
      : await notificationApi.createChannel(payload)
    if (res.success) {
      ElMessage.success(editingChannel.value ? '渠道已更新' : '渠道已创建')
      channelDialog.value = false
      loadChannels()
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    savingChannel.value = false
  }
}

const deleteChannel = async (channel) => {
  try {
    await ElMessageBox.confirm(`确定删除渠道 "${channel.name}"？`, '确认', { type: 'warning' })
    const res = await notificationApi.deleteChannel(channel.id)
    if (res.success) {
      ElMessage.success('已删除')
      loadChannels()
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const testChannel = async (channel) => {
  testingId.value = channel.id
  try {
    const res = await notificationApi.testChannel(channel.id)
    if (res.success) ElMessage.success('测试消息已发送')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || '发送失败')
  } finally {
    testingId.value = null
  }
}

// ===== API Keys =====
const apiKeys = ref([])
const apiKeyDialog = ref(false)
const creatingKey = ref(false)
const newApiKeyName = ref('')
const newApiKey = ref('')

const loadApiKeys = async () => {
  try {
    const res = await apiKeyApi.getAll()
    if (res.success) apiKeys.value = res.data
  } catch { /* ignore */ }
}

const createApiKey = async () => {
  if (!newApiKeyName.value.trim()) {
    ElMessage.warning('请输入名称')
    return
  }
  creatingKey.value = true
  try {
    const res = await apiKeyApi.create(newApiKeyName.value.trim())
    if (res.success) {
      newApiKey.value = res.data.key
      loadApiKeys()
    }
  } catch {
    ElMessage.error('创建失败')
  } finally {
    creatingKey.value = false
  }
}

const closeApiKeyDialog = () => {
  apiKeyDialog.value = false
  newApiKeyName.value = ''
  newApiKey.value = ''
}

const deleteApiKey = async (item) => {
  try {
    await ElMessageBox.confirm(`确定删除 API Key "${item.name}"？使用它的第三方将立即失效。`, '确认', { type: 'warning' })
    const res = await apiKeyApi.remove(item.id)
    if (res.success) {
      ElMessage.success('已删除')
      loadApiKeys()
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

// ===== 备份 =====
const backups = ref([])
const backingUp = ref(false)

const loadBackups = async () => {
  try {
    const res = await backupApi.list()
    if (res.success) backups.value = res.data
  } catch { /* ignore */ }
}

const createBackup = async () => {
  backingUp.value = true
  try {
    const res = await backupApi.create()
    if (res.success) {
      ElMessage.success('备份已创建')
      loadBackups()
    }
  } catch {
    ElMessage.error('备份失败')
  } finally {
    backingUp.value = false
  }
}

const downloadBackup = async (row) => {
  try {
    await backupApi.download(row.name)
  } catch {
    ElMessage.error('下载失败')
  }
}

const formatSize = (bytes) => {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败')
  }
}

// ===== 原有基础设置逻辑 =====
const loadSettings = async () => {
  try {
    const res = await settingsApi.getSiteSettings()
    if (res.data) {
      Object.assign(siteForm, res.data)
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }

  try {
    const tzRes = await settingsApi.getTimezoneSettings()
    if (tzRes.data) {
      Object.assign(timezoneForm, tzRes.data)
    }
  } catch (error) {
    console.error('加载时区设置失败:', error)
  }

  try {
    const optionsRes = await settingsApi.getTimezoneOptions()
    if (optionsRes.data) {
      timezoneOptions.value = optionsRes.data.timezones
      dateFormatOptions.value = optionsRes.data.dateFormats
    }
  } catch (error) {
    console.error('加载时区选项失败:', error)
  }

  const saved = localStorage.getItem('systemSettings')
  if (saved) {
    const settings = JSON.parse(saved)
    currentTheme.value = settings.theme || 'light'
    currentAccent.value = settings.accent || 'black'
  }
}

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

const saveSiteSettings = async () => {
  try {
    await siteFormRef.value.validate()
    savingSite.value = true

    await settingsApi.saveSiteSettings({
      siteName: siteForm.siteName,
      siteUrl: siteForm.siteUrl,
      siteDescription: siteForm.siteDescription
    })

    ElMessage.success('网站设置已保存')
  } catch (error) {
    if (error !== false) {
      console.error(error)
      ElMessage.error('保存失败')
    }
  } finally {
    savingSite.value = false
  }
}

const setTheme = (theme) => {
  currentTheme.value = theme
  const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}')
  settings.theme = theme
  localStorage.setItem('systemSettings', JSON.stringify(settings))

  applyTheme(theme)
  ElMessage.success(`已切换到${theme === 'light' ? '亮色' : theme === 'dark' ? '暗色' : '跟随系统'}模式`)
}

const applyTheme = (theme) => {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
  } else if (theme === 'light') {
    html.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }
}

const setAccentColor = (color) => {
  currentAccent.value = color
  const settings = JSON.parse(localStorage.getItem('systemSettings') || '{}')
  settings.accent = color
  localStorage.setItem('systemSettings', JSON.stringify(settings))

  applyAccentColor(color)
  ElMessage.success('强调色已更新')
}

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

let timeTimer = null

onMounted(() => {
  loadSettings()
  applyTheme(currentTheme.value)
  applyAccentColor(currentAccent.value)

  // 新标签页的数据
  loadChannels()
  loadApiKeys()
  loadBackups()
})

onUnmounted(() => {
  if (timeTimer) clearInterval(timeTimer)
})
</script>

<style scoped>
.system-settings {
  padding: 0;
}

.settings-tabs {
  background: var(--md-surface);
  border-radius: var(--md-shape-lg);
  padding: 8px 24px 24px;
  box-shadow: var(--md-elevation-1);
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

.new-key-box {
  margin-top: 8px;
}
</style>
