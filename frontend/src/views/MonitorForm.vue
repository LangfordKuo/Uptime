<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <PageHeader :title="isEdit ? '编辑监控项' : '创建新的监控项'" :back-to="null" @back="$router.back()">
      <template #subtitle>{{ isEdit ? '修改监控配置' : '添加新的服务监控' }}</template>
    </PageHeader>

    <div v-if="loading" class="flex justify-center py-24">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <Card v-else>
      <CardHeader>
        <CardTitle>基本信息</CardTitle>
        <CardDescription>监控名称、类型与目标</CardDescription>
      </CardHeader>
      <CardContent class="space-y-5">
        <div class="space-y-2">
          <Label>监控名称 <span class="text-destructive">*</span></Label>
          <Input v-model="form.name" placeholder="请输入监控名称" maxlength="100" />
        </div>

        <div class="space-y-2">
          <Label>监控类型</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="t in types"
              :key="t.value"
              type="button"
              :class="cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                form.type === t.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent hover:text-accent-foreground'
              )"
              @click="handleTypeChange(t.value)"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- 监控目标 -->
        <div v-if="form.type !== 'push'" class="space-y-2">
          <Label>{{ targetLabel }} <span class="text-destructive">*</span></Label>
          <div v-if="form.type === 'http'" class="flex gap-2">
            <Select v-model="form.config.method" :options="methodOptions" class="w-28 shrink-0" placeholder="GET" />
            <Input v-model="form.target" :placeholder="targetPlaceholder" />
          </div>
          <Input v-else v-model="form.target" :placeholder="targetPlaceholder" />
          <p class="text-xs text-muted-foreground">{{ targetHelp }}</p>
        </div>

        <!-- Push 推送地址 -->
        <template v-if="form.type === 'push'">
          <div class="space-y-2">
            <Label>推送 URL</Label>
            <div class="flex gap-2">
              <Input :model-value="pushUrl" readonly class="font-mono text-xs" />
              <Button variant="outline" size="icon" class="shrink-0" @click="copyText(pushUrl)">
                <Copy />
              </Button>
            </div>
            <p class="text-xs text-muted-foreground">
              在你的服务/定时任务里定期请求此 URL（curl 即可），心跳超时后判定为故障。
            </p>
          </div>
          <div class="space-y-2">
            <Label>心跳周期（秒）</Label>
            <Input v-model.number="form.config.period" type="number" :min="20" :max="86400" class="w-40" />
            <p class="text-xs text-muted-foreground">超过周期的 1.5 倍未收到心跳视为故障</p>
          </div>
        </template>

        <!-- HTTP 配置 -->
        <template v-if="form.type === 'http'">
          <div class="grid gap-5 sm:grid-cols-2">
            <div class="space-y-2">
              <Label>期望状态码</Label>
              <Input v-model="form.config.expectedStatusCode" placeholder="留空 = 2xx；支持 200,204 或 200-299" />
            </div>
            <div class="space-y-2">
              <Label>关键词检查</Label>
              <Input v-model="form.config.keyword" placeholder="响应体必须包含的关键词（可选）" />
            </div>
          </div>
          <label class="flex cursor-pointer items-center gap-2 text-sm" v-if="form.config.keyword">
            <Checkbox v-model="form.config.invertKeyword" />
            反转：包含关键词则视为故障
          </label>
          <div class="space-y-2">
            <Label>自定义 Header (JSON)</Label>
            <Textarea v-model="headersText" :rows="3" placeholder='{"Authorization": "Bearer xxx"}' />
            <p v-if="headersError" class="text-xs text-destructive">{{ headersError }}</p>
          </div>
        </template>

        <!-- DNS 配置 -->
        <div v-if="form.type === 'dns'" class="grid gap-5 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>记录类型</Label>
            <Select v-model="form.config.recordType" :options="dnsTypes" />
          </div>
          <div class="space-y-2">
            <Label>期望解析值</Label>
            <Input v-model="form.config.expectedValue" placeholder="可选，解析结果需包含此值" />
          </div>
        </div>

        <!-- Docker 配置 -->
        <div v-if="form.type === 'docker'" class="space-y-2">
          <Label>Socket 路径</Label>
          <Input v-model="form.config.socketPath" :placeholder="defaultDockerSocket" />
        </div>

        <Alert v-if="form.type === 'ssl'" variant="info">
          <Info />
          <AlertDescription>监控证书有效期：证书过期判定为故障，详情页可查看剩余天数。</AlertDescription>
        </Alert>
      </CardContent>

      <Separator />

      <CardHeader class="pt-4">
        <CardTitle>分类与通知</CardTitle>
        <CardDescription>分组、标签与通知渠道</CardDescription>
      </CardHeader>
      <CardContent class="space-y-5">
        <div class="grid gap-5 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>分组</Label>
            <Input v-model="form.group_name" list="group-suggestions" placeholder="选择或输入新分组（可选）" />
            <datalist id="group-suggestions">
              <option v-for="g in monitorStore.allGroups" :key="g" :value="g" />
            </datalist>
          </div>
          <div class="space-y-2">
            <Label>标签</Label>
            <Input v-model="tagsText" placeholder="多个标签用逗号分隔（可选）" />
          </div>
        </div>

        <div class="space-y-2">
          <Label>描述</Label>
          <Textarea v-model="form.description" :rows="2" placeholder="备注信息（可选）" />
        </div>

        <div class="space-y-2" v-if="channels.length > 0">
          <Label>通知渠道</Label>
          <MultiSelect
            v-model="form.channel_ids"
            :options="channelOptions"
            placeholder="不选择则使用所有启用的渠道"
          />
          <p class="text-xs text-muted-foreground">故障与恢复时发送通知；未选择时使用全部启用渠道</p>
        </div>
        <Alert v-else-if="authStore.isAdmin" variant="info">
          <Info />
          <AlertDescription>
            还没有通知渠道，可在「系统管理 → 通知渠道」中添加邮件 / Telegram / Webhook 等。
          </AlertDescription>
        </Alert>
      </CardContent>

      <Separator />

      <CardHeader class="pt-4">
        <CardTitle>检测参数</CardTitle>
        <CardDescription>间隔、超时与故障确认</CardDescription>
      </CardHeader>
      <CardContent class="space-y-5">
        <div v-if="form.type !== 'push'" class="grid gap-5 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>检测间隔（秒）<span class="text-destructive">*</span></Label>
            <Input v-model.number="form.interval" type="number" :min="10" :max="86400" />
          </div>
          <div class="space-y-2">
            <Label>超时时间（秒）<span class="text-destructive">*</span></Label>
            <Input v-model.number="form.timeout" type="number" :min="1" :max="300" />
            <p class="text-xs text-muted-foreground">必须小于检测间隔，保存时自动修正</p>
          </div>
        </div>

        <div v-if="form.type !== 'push'" class="space-y-2">
          <Label>故障确认次数</Label>
          <Input v-model.number="form.max_retries" type="number" :min="1" :max="10" class="w-40" />
          <p class="text-xs text-muted-foreground">
            连续失败达到该次数才判定为故障并触发通知，1 表示立即确认（可防止网络抖动误报）
          </p>
        </div>

        <label class="flex cursor-pointer items-center gap-3">
          <Switch v-model="form.enabledBool" />
          <span class="text-sm font-medium">{{ form.enabledBool ? '启用监控' : '禁用监控' }}</span>
        </label>
      </CardContent>

      <CardFooter class="justify-end gap-2 border-t pt-4">
        <Button variant="outline" @click="$router.back()">取消</Button>
        <Button :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '创建监控项' }}
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Loader2, Copy, Info } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToast'
import { monitorApi, notificationApi } from '@/api'
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card.js'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Label from '@/components/ui/Label.vue'
import Select from '@/components/ui/Select.vue'
import MultiSelect from '@/components/ui/MultiSelect.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Switch from '@/components/ui/Switch.vue'
import Alert, { AlertDescription } from '@/components/ui/alert.js'
import Separator from '@/components/ui/separator.js'
import PageHeader from '@/components/ui/PageHeader.vue'

const router = useRouter()
const route = useRoute()
const monitorStore = useMonitorStore()
const authStore = useAuthStore()

const loading = ref(false)
const submitting = ref(false)
const monitor = ref(null)
const channels = ref([])
const headersText = ref('')
const headersError = ref('')
const tagsText = ref('')

const isEdit = computed(() => route.name === 'MonitorEdit')

const types = [
  { value: 'http', label: 'HTTP/HTTPS' },
  { value: 'tcp', label: 'TCP 端口' },
  { value: 'ping', label: 'PING' },
  { value: 'push', label: '推送' },
  { value: 'ssl', label: 'SSL 证书' },
  { value: 'domain', label: '域名到期' },
  { value: 'dns', label: 'DNS' },
  { value: 'docker', label: 'Docker' }
]

const methodOptions = ['GET', 'POST', 'PUT', 'HEAD'].map(v => ({ label: v, value: v }))
const dnsTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'].map(v => ({ label: v, value: v }))

const channelOptions = computed(() =>
  channels.value.map(c => ({ label: `${c.name} (${c.type})`, value: c.id }))
)

function defaultConfig(type) {
  if (type === 'http') return { method: 'GET', expectedStatusCode: '', keyword: '', invertKeyword: false }
  if (type === 'dns') return { recordType: 'A', expectedValue: '' }
  if (type === 'push') return { period: 300 }
  if (type === 'docker') return { socketPath: '' }
  return {}
}

const form = reactive({
  name: '',
  type: 'http',
  target: '',
  interval: 300,
  timeout: 30,
  max_retries: 1,
  group_name: '',
  description: '',
  channel_ids: [],
  enabledBool: true,
  config: defaultConfig('http')
})

const targetLabel = computed(() => ({
  http: '监控 URL', tcp: '目标地址', ping: '目标主机',
  ssl: '域名', domain: '域名', dns: '域名', docker: '容器名/ID'
}[form.type] || '监控目标'))

const targetPlaceholder = computed(() => ({
  http: 'https://example.com/api',
  tcp: 'example.com:3306',
  ping: 'example.com 或 8.8.8.8',
  ssl: 'example.com（可选 :端口）',
  domain: 'example.com',
  dns: 'example.com',
  docker: 'my-container'
}[form.type] || ''))

const targetHelp = computed(() => ({
  http: '输入完整的 HTTP/HTTPS URL',
  tcp: '格式: 主机名:端口号，例如: localhost:3306',
  ping: '输入域名或 IP 地址',
  ssl: '要检查证书的域名',
  domain: '通过 RDAP 查询域名到期时间',
  dns: '要解析的域名',
  docker: 'Docker 容器名称或 ID'
}[form.type] || ''))

const defaultDockerSocket = window.navigator.platform.includes('Win')
  ? '\\\\.\\pipe\\docker_engine'
  : '/var/run/docker.sock'

const pushUrl = computed(() => {
  const origin = window.location.origin
  if (isEdit.value && monitor.value?.push_token) {
    return `${origin}/api/push/${monitor.value.push_token}`
  }
  return `${origin}/api/push/<保存后自动生成 Token>`
})

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('已复制')
  } catch {
    toast.error('复制失败，请手动复制')
  }
}

const handleTypeChange = (type) => {
  form.type = type
  if (!isEdit.value) {
    form.target = ''
    form.config = defaultConfig(type)
    if (type !== 'http') headersText.value = ''
  }
}

// Header JSON 解析
watch(headersText, (value) => {
  headersError.value = ''
  if (!value.trim()) {
    form.config.headers = {}
    return
  }
  try {
    form.config.headers = JSON.parse(value)
  } catch (e) {
    headersError.value = 'JSON 格式错误: ' + e.message
  }
})

// 标签文本 <-> 数组
watch(tagsText, (value) => {
  form.tags = value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
})

const handleSubmit = async () => {
  if (!form.name.trim()) {
    toast.error('请输入监控名称')
    return
  }
  if (form.type !== 'push' && !form.target.trim()) {
    toast.error('请输入监控目标')
    return
  }
  if (headersError.value) {
    toast.error('自定义 Header JSON 格式错误')
    return
  }

  submitting.value = true
  try {
    const config = { ...form.config }
    if (config.headers && Object.keys(config.headers).length === 0) delete config.headers
    if (config.keyword === '') delete config.keyword
    if (config.expectedValue === '') delete config.expectedValue
    if (config.socketPath === '') delete config.socketPath

    const data = {
      name: form.name.trim(),
      type: form.type,
      target: form.type === 'push' ? 'push' : form.target.trim(),
      interval: form.interval,
      timeout: form.timeout,
      enabled: form.enabledBool ? 1 : 0,
      max_retries: form.max_retries,
      group_name: form.group_name.trim() || null,
      tags: form.tags,
      description: form.description.trim() || null,
      channel_ids: form.channel_ids,
      config
    }

    if (isEdit.value) {
      await monitorStore.updateMonitor(route.params.id, data)
      toast.success('更新成功')
    } else {
      await monitorStore.createMonitor(data)
      toast.success('创建成功')
    }
    router.push('/')
  } catch (error) {
    const msg = error?.response?.data?.errors?.[0] || error?.response?.data?.message
    toast.error(msg || (isEdit.value ? '更新失败' : '创建失败'))
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (authStore.isAdmin) {
    try {
      const res = await notificationApi.getChannels()
      if (res.success) channels.value = res.data
    } catch { /* ignore */ }
  }

  if (isEdit.value) {
    loading.value = true
    try {
      const res = await monitorApi.getById(route.params.id)
      if (res.success) {
        const m = res.data
        monitor.value = m
        Object.assign(form, {
          name: m.name,
          type: m.type,
          target: m.target === 'push' ? '' : m.target,
          interval: m.interval,
          timeout: m.timeout,
          max_retries: m.max_retries || 1,
          group_name: m.group_name || '',
          description: m.description || '',
          channel_ids: m.channel_ids || [],
          enabledBool: m.enabled === 1,
          tags: m.tags || [],
          config: m.config || defaultConfig(m.type)
        })
        tagsText.value = (m.tags || []).join(', ')
        if (form.config?.headers && Object.keys(form.config.headers).length > 0) {
          headersText.value = JSON.stringify(form.config.headers, null, 2)
        }
      }
    } catch {
      toast.error('加载监控项失败')
      router.back()
    } finally {
      loading.value = false
    }
  }
})
</script>
