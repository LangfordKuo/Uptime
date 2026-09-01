<template>
  <div class="monitor-form-page">
    <el-page-header @back="$router.back()" :title="isEdit ? '编辑监控项' : '新建监控项'">
      <template #content>
        <span class="page-title">{{ isEdit ? '编辑监控项' : '创建新的监控项' }}</span>
      </template>
    </el-page-header>

    <el-card class="form-card" v-loading="loading">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="140px"
        label-position="left"
      >
        <el-form-item label="监控名称" prop="name">
          <el-input
            v-model="formData.name"
            placeholder="请输入监控名称"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="监控类型" prop="type">
          <el-radio-group v-model="formData.type" @change="handleTypeChange">
            <el-radio-button label="http">HTTP/HTTPS</el-radio-button>
            <el-radio-button label="tcp">TCP 端口</el-radio-button>
            <el-radio-button label="ping">PING</el-radio-button>
            <el-radio-button label="push">推送</el-radio-button>
            <el-radio-button label="ssl">SSL 证书</el-radio-button>
            <el-radio-button label="domain">域名到期</el-radio-button>
            <el-radio-button label="dns">DNS</el-radio-button>
            <el-radio-button label="docker">Docker</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item :label="targetLabel" prop="target" v-if="formData.type !== 'push'">
          <el-input
            v-model="formData.target"
            :placeholder="targetPlaceholder"
          >
            <template #prepend v-if="formData.type === 'http'">
              <el-select v-model="formData.config.method" style="width: 100px">
                <el-option label="GET" value="GET" />
                <el-option label="POST" value="POST" />
                <el-option label="PUT" value="PUT" />
                <el-option label="HEAD" value="HEAD" />
              </el-select>
            </template>
          </el-input>
          <div class="form-help">
            {{ targetHelp }}
          </div>
        </el-form-item>

        <!-- Push 类型：显示推送 URL -->
        <template v-if="formData.type === 'push'">
          <el-form-item label="推送 URL">
            <el-input :model-value="pushUrl" readonly>
              <template #append>
                <el-button @click="copyPushUrl">复制</el-button>
              </template>
            </el-input>
            <div class="form-help">
              在你的服务/定时任务里定期请求此 URL（curl 即可），心跳超时后判定为故障。
            </div>
          </el-form-item>

          <el-form-item label="心跳周期">
            <el-input-number v-model="formData.config.period" :min="20" :max="86400" :step="10" />
            <span class="unit">秒</span>
            <span class="form-help" style="margin-left: 12px">超过周期的 1.5 倍未收到心跳视为故障</span>
          </el-form-item>

          <el-alert
            v-if="isEdit && !monitor?.push_token"
            title="保存后系统会自动生成推送 Token"
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
          />
        </template>

        <!-- HTTP 专属配置 -->
        <template v-if="formData.type === 'http'">
          <el-form-item label="期望状态码">
            <el-input
              v-model="formData.config.expectedStatusCode"
              placeholder="留空 = 2xx；支持 200,204 或 200-299"
              style="max-width: 320px"
            />
          </el-form-item>

          <el-form-item label="关键词检查">
            <div style="width: 100%">
              <el-input
                v-model="formData.config.keyword"
                placeholder="响应体必须包含的关键词（可选）"
                style="max-width: 320px"
              />
              <el-checkbox v-model="formData.config.invertKeyword" style="margin-left: 16px">
                反转：包含关键词则视为故障
              </el-checkbox>
            </div>
          </el-form-item>

          <el-form-item label="自定义 Header">
            <el-input
              v-model="headersText"
              type="textarea"
              :rows="3"
              placeholder='{"Authorization": "Bearer xxx"}'
            />
            <div class="form-help" v-if="headersError">
              <span style="color: var(--md-error, #b3261e)">{{ headersError }}</span>
            </div>
          </el-form-item>
        </template>

        <!-- DNS 专属配置 -->
        <template v-if="formData.type === 'dns'">
          <el-form-item label="记录类型">
            <el-select v-model="formData.config.recordType" style="width: 140px">
              <el-option v-for="t in ['A','AAAA','CNAME','MX','TXT','NS']" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="期望解析值">
            <el-input
              v-model="formData.config.expectedValue"
              placeholder="可选，解析结果需包含此值"
              style="max-width: 320px"
            />
          </el-form-item>
        </template>

        <!-- Docker 专属配置 -->
        <template v-if="formData.type === 'docker'">
          <el-form-item label="Socket 路径">
            <el-input
              v-model="formData.config.socketPath"
              :placeholder="defaultDockerSocket"
              style="max-width: 400px"
            />
          </el-form-item>
        </template>

        <!-- SSL 专属配置 -->
        <template v-if="formData.type === 'ssl'">
          <el-alert
            type="info"
            :closable="false"
            style="margin-bottom: 16px"
            title="监控证书有效期：证书过期判定为故障，详情页可查看剩余天数"
          />
        </template>

        <!-- 分组 / 标签 / 描述 -->
        <el-form-item label="分组">
          <el-select
            v-model="formData.group_name"
            allow-create
            filterable
            clearable
            placeholder="选择或输入新分组（可选）"
            style="max-width: 320px"
          >
            <el-option v-for="g in monitorStore.allGroups" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>

        <el-form-item label="标签">
          <el-select
            v-model="formData.tags"
            multiple
            allow-create
            filterable
            default-first-option
            placeholder="输入后回车添加标签（可选）"
            style="max-width: 100%"
          />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="2"
            maxlength="500"
            placeholder="备注信息（可选）"
          />
        </el-form-item>

        <el-form-item label="检测间隔" prop="interval" v-if="formData.type !== 'push'">
          <el-input-number
            v-model="formData.interval"
            :min="10"
            :max="86400"
            :step="10"
          />
          <span class="unit">秒</span>
        </el-form-item>

        <el-form-item label="超时时间" prop="timeout" v-if="formData.type !== 'push'">
          <el-input-number
            v-model="formData.timeout"
            :min="1"
            :max="300"
          />
          <span class="unit">秒</span>
          <div class="form-help" style="width: 100%">
            超时时间必须小于检测间隔，保存时会自动修正
          </div>
        </el-form-item>

        <el-form-item label="故障确认次数" v-if="formData.type !== 'push'">
          <el-input-number v-model="formData.max_retries" :min="1" :max="10" />
          <span class="unit">次</span>
          <div class="form-help" style="width: 100%">
            连续失败达到该次数才判定为故障并触发通知，1 表示立即确认（可防止网络抖动误报）
          </div>
        </el-form-item>

        <!-- 通知渠道 -->
        <el-form-item label="通知渠道" v-if="channels.length > 0">
          <el-select
            v-model="formData.channel_ids"
            multiple
            clearable
            placeholder="不选择则使用所有启用的渠道"
            style="max-width: 100%"
          >
            <el-option
              v-for="c in channels"
              :key="c.id"
              :label="`${c.name} (${c.type})`"
              :value="c.id"
            />
          </el-select>
          <div class="form-help" style="width: 100%">
            故障与恢复时发送通知；未选择时使用全部启用渠道
          </div>
        </el-form-item>
        <el-alert
          v-else-if="canNotify"
          type="info"
          :closable="false"
          style="margin-bottom: 16px"
          title="还没有配置通知渠道。可在「系统管理」中添加邮件 / Telegram / Webhook 等渠道"
        />

        <el-form-item label="启用状态" prop="enabled">
          <el-switch
            v-model="formData.enabled"
            :active-value="1"
            :inactive-value="0"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ isEdit ? '保存修改' : '创建监控项' }}
          </el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import { monitorApi, notificationApi } from '@/api'

const router = useRouter()
const route = useRoute()
const monitorStore = useMonitorStore()
const authStore = useAuthStore()

const formRef = ref(null)
const loading = ref(false)
const submitting = ref(false)
const monitor = ref(null)
const channels = ref([])
const headersText = ref('')
const headersError = ref('')

const isEdit = computed(() => route.name === 'MonitorEdit')
const canNotify = computed(() => authStore.isAdmin)

const defaultFormData = () => ({
  name: '',
  type: 'http',
  target: '',
  interval: 300,
  timeout: 30,
  enabled: 1,
  max_retries: 1,
  group_name: '',
  tags: [],
  description: '',
  channel_ids: [],
  config: defaultConfig('http')
})

function defaultConfig(type) {
  const base = {}
  if (type === 'http') {
    return { method: 'GET', expectedStatusCode: '', keyword: '', invertKeyword: false, headers: {} }
  }
  if (type === 'dns') return { recordType: 'A', expectedValue: '' }
  if (type === 'push') return { period: 300 }
  if (type === 'docker') return { socketPath: '' }
  return base
}

const formData = ref(defaultFormData())

const rules = {
  name: [{ required: true, message: '请输入监控名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择监控类型', trigger: 'change' }],
  target: [
    {
      validator: (rule, value, callback) => {
        if (formData.value.type === 'push' || (value && value.trim())) callback()
        else callback(new Error('请输入监控目标'))
      },
      trigger: 'blur'
    }
  ],
  interval: [{ required: true, message: '请设置检测间隔', trigger: 'blur' }],
  timeout: [{ required: true, message: '请设置超时时间', trigger: 'blur' }]
}

const targetLabel = computed(() => {
  const map = {
    http: '监控 URL', tcp: '目标地址', ping: '目标主机',
    ssl: '域名', domain: '域名', dns: '域名', docker: '容器名/ID'
  }
  return map[formData.value.type] || '监控目标'
})

const targetPlaceholder = computed(() => {
  switch (formData.value.type) {
    case 'http': return 'https://example.com/api'
    case 'tcp': return 'example.com:3306'
    case 'ping': return 'example.com 或 8.8.8.8'
    case 'ssl': return 'example.com（可选 :端口）'
    case 'domain': return 'example.com'
    case 'dns': return 'example.com'
    case 'docker': return 'my-container'
    default: return ''
  }
})

const targetHelp = computed(() => {
  switch (formData.value.type) {
    case 'http': return '输入完整的 HTTP/HTTPS URL'
    case 'tcp': return '格式: 主机名:端口号，例如: localhost:3306'
    case 'ping': return '输入域名或 IP 地址'
    case 'ssl': return '要检查证书的域名'
    case 'domain': return '通过 RDAP 查询域名到期时间'
    case 'dns': return '要解析的域名'
    case 'docker': return 'Docker 容器名称或 ID'
    default: return ''
  }
})

const defaultDockerSocket = computed(() =>
  window.navigator.platform.includes('Win') ? '\\\\.\\pipe\\docker_engine' : '/var/run/docker.sock'
)

// 推送 URL（编辑已有 push 监控时展示真实 token）
const pushUrl = computed(() => {
  const origin = window.location.origin
  if (isEdit.value && monitor.value?.push_token) {
    return `${origin}/api/push/${monitor.value.push_token}`
  }
  return `${origin}/api/push/<保存后自动生成 Token>`
})

const copyPushUrl = async () => {
  try {
    await navigator.clipboard.writeText(pushUrl.value)
    ElMessage.success('已复制')
  } catch {
    ElMessage.warning('复制失败，请手动复制')
  }
}

const handleTypeChange = () => {
  if (!isEdit.value) {
    formData.value.target = ''
    formData.value.config = defaultConfig(formData.value.type)
    if (formData.value.type !== 'http') headersText.value = ''
  }
}

// 自定义 header JSON 解析
watch(headersText, (value) => {
  headersError.value = ''
  if (!value.trim()) {
    formData.value.config.headers = {}
    return
  }
  try {
    formData.value.config.headers = JSON.parse(value)
  } catch (e) {
    headersError.value = 'JSON 格式错误: ' + e.message
  }
})

const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    if (headersError.value) {
      ElMessage.error('自定义 Header JSON 格式错误')
      return
    }

    submitting.value = true

    const config = { ...formData.value.config }
    // 清理空配置
    if (config.headers && Object.keys(config.headers).length === 0) delete config.headers
    if (config.keyword === '') delete config.keyword
    if (config.expectedValue === '') delete config.expectedValue
    if (config.socketPath === '') delete config.socketPath

    const data = {
      ...formData.value,
      group_name: formData.value.group_name || null,
      description: formData.value.description || null,
      config
    }

    if (isEdit.value) {
      await monitorStore.updateMonitor(route.params.id, data)
      ElMessage.success('更新成功')
    } else {
      await monitorStore.createMonitor(data)
      ElMessage.success('创建成功')
    }

    router.push('/')
  } catch (error) {
    if (error !== false) {
      const msg = error?.response?.data?.errors?.[0] || error?.response?.data?.message
      ElMessage.error(msg || (isEdit.value ? '更新失败' : '创建失败'))
    }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  // 加载通知渠道列表（管理员）
  if (authStore.isAdmin) {
    try {
      const res = await notificationApi.getChannels()
      if (res.success) channels.value = res.data
    } catch { /* 忽略 */ }
  }

  if (isEdit.value) {
    loading.value = true
    try {
      const res = await monitorApi.getById(route.params.id)
      if (res.success) {
        const m = res.data
        monitor.value = m
        formData.value = {
          name: m.name,
          type: m.type,
          target: m.target,
          interval: m.interval,
          timeout: m.timeout,
          enabled: m.enabled,
          max_retries: m.max_retries || 1,
          group_name: m.group_name || '',
          tags: m.tags || [],
          description: m.description || '',
          channel_ids: m.channel_ids || [],
          config: m.config || defaultConfig(m.type)
        }
        if (formData.value.config?.headers && Object.keys(formData.value.config.headers).length > 0) {
          headersText.value = JSON.stringify(formData.value.config.headers, null, 2)
        }
      }
    } catch (error) {
      ElMessage.error('加载监控项失败')
      router.back()
    } finally {
      loading.value = false
    }
  }
})
</script>

<style scoped>
.monitor-form-page {
  max-width: 860px;
  margin: 0 auto;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
}

.form-card {
  margin-top: 20px;
}

.form-help {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}

.unit {
  margin-left: 8px;
  color: #909399;
}
</style>
