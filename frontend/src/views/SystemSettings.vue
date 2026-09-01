<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <Tabs v-model="activeTab">
      <TabsList class="flex-wrap h-auto">
        <TabsTrigger value="basic" class="flex-none px-4">
          <Settings2 class="size-4" />
          基础设置
        </TabsTrigger>
        <TabsTrigger value="notifications" class="flex-none px-4">
          <Bell class="size-4" />
          通知渠道
        </TabsTrigger>
        <TabsTrigger value="apikeys" class="flex-none px-4">
          <KeyRound class="size-4" />
          API Keys
        </TabsTrigger>
        <TabsTrigger value="backups" class="flex-none px-4">
          <DatabaseBackup class="size-4" />
          备份管理
        </TabsTrigger>
      </TabsList>

      <!-- ================= 基础设置 ================= -->
      <TabsContent value="basic" class="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>网站信息</CardTitle>
            <CardDescription>状态页与登录页展示的信息</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label>网站名称</Label>
                <Input v-model="siteForm.siteName" placeholder="Uptime" />
              </div>
              <div class="space-y-2">
                <Label>网站 URL</Label>
                <Input v-model="siteForm.siteUrl" placeholder="https://example.com" />
              </div>
            </div>
            <div class="space-y-2">
              <Label>网站介绍</Label>
              <Textarea v-model="siteForm.siteDescription" :rows="3" placeholder="服务状态监控系统" />
            </div>
            <Button :loading="savingSite" @click="saveSiteSettings">保存设置</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>外观</CardTitle>
            <CardDescription>主题模式与强调色（保存到本地浏览器）</CardDescription>
          </CardHeader>
          <CardContent class="space-y-5">
            <div class="space-y-2">
              <Label>主题模式</Label>
              <Tabs :model-value="theme.theme.value" @update:model-value="theme.setTheme($event)">
                <TabsList>
                  <TabsTrigger value="light" class="flex-none px-4"><Sun class="size-4" /> 亮色</TabsTrigger>
                  <TabsTrigger value="dark" class="flex-none px-4"><Moon class="size-4" /> 暗色</TabsTrigger>
                  <TabsTrigger value="system" class="flex-none px-4"><MonitorCog class="size-4" /> 跟随系统</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div class="space-y-2">
              <Label>强调色</Label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="color in ACCENTS"
                  :key="color.value"
                  class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer"
                  :class="theme.accent.value === color.value ? 'border-primary bg-accent font-medium' : 'hover:bg-accent'"
                  @click="theme.setAccent(color.value)"
                >
                  <span
                    class="size-4 rounded-full border"
                    :style="{ backgroundColor: color.primary }"
                  />
                  {{ color.label }}
                  <Check v-if="theme.accent.value === color.value" class="size-3.5" />
                </button>
              </div>
            </div>
            <Separator />
            <div class="space-y-2">
              <Label>显示时区</Label>
              <div class="grid gap-3 sm:grid-cols-2">
                <Select
                  v-model="timezoneForm.timezone"
                  :options="timezoneOptions"
                  placeholder="选择时区"
                  filterable
                />
                <Select
                  v-model="timezoneForm.dateFormat"
                  :options="dateFormatOptions"
                  placeholder="日期格式"
                />
              </div>
              <Button variant="outline" :loading="savingTimezone" @click="saveTimezoneSettings">
                保存时区设置
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <!-- ================= 通知渠道 ================= -->
      <TabsContent value="notifications">
        <Card>
          <CardHeader>
            <div class="flex w-full flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>通知渠道</CardTitle>
                <CardDescription>
                  支持邮件 / Telegram / Webhook / 钉钉 / 飞书 / 企业微信；未绑定渠道的监控使用全部启用渠道
                </CardDescription>
              </div>
              <Button size="sm" @click="openChannelDialog()">
                <Plus />
                新建渠道
              </Button>
            </div>
          </CardHeader>
          <CardContent class="px-0 pb-0" v-if="channels.length > 0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="pl-6">名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>绑定监控</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead class="pr-6 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in channels" :key="row.id">
                  <TableCell class="pl-6 font-medium">{{ row.name }}</TableCell>
                  <TableCell><Badge variant="secondary">{{ channelTypeLabel(row.type) }}</Badge></TableCell>
                  <TableCell class="text-muted-foreground">{{ row.monitor_ids.length }} 个</TableCell>
                  <TableCell>
                    <Badge :variant="row.enabled ? 'success' : 'secondary'">{{ row.enabled ? '启用' : '停用' }}</Badge>
                  </TableCell>
                  <TableCell class="pr-6">
                    <div class="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" :loading="testingId === row.id" @click="testChannel(row)">
                        测试
                      </Button>
                      <Button variant="ghost" size="sm" @click="openChannelDialog(row)">编辑</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="text-destructive hover:text-destructive"
                        @click="deleteChannel(row)"
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <CardContent v-else>
            <Empty description="还没有通知渠道" />
          </CardContent>
        </Card>
      </TabsContent>

      <!-- ================= API Keys ================= -->
      <TabsContent value="apikeys">
        <Card>
          <CardHeader>
            <div class="flex w-full flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  只读访问凭证，通过 <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">X-API-Key</code> 请求头使用
                </CardDescription>
              </div>
              <Button size="sm" @click="apiKeyDialog = true; newApiKey = ''">
                <Plus />
                创建 Key
              </Button>
            </div>
          </CardHeader>
          <CardContent class="px-0 pb-0" v-if="apiKeys.length > 0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="pl-6">名称</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>最后使用</TableHead>
                  <TableHead class="pr-6 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in apiKeys" :key="item.id">
                  <TableCell class="pl-6 font-medium">{{ item.name }}</TableCell>
                  <TableCell class="font-mono text-xs text-muted-foreground">{{ item.key_preview }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ item.last_used_at ? formatTime(item.last_used_at) : '从未使用' }}</TableCell>
                  <TableCell class="pr-6 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-destructive hover:text-destructive"
                      @click="deleteApiKey(item)"
                    >
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <CardContent v-else>
            <Empty description="还没有 API Key" />
          </CardContent>
        </Card>
      </TabsContent>

      <!-- ================= 备份管理 ================= -->
      <TabsContent value="backups">
        <Card>
          <CardHeader>
            <div class="flex w-full flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>数据库备份</CardTitle>
                <CardDescription>每日自动备份，保留最近 {{ backupKeep }} 份</CardDescription>
              </div>
              <Button size="sm" :loading="backingUp" @click="createBackup">
                <Plus />
                立即备份
              </Button>
            </div>
          </CardHeader>
          <CardContent class="px-0 pb-0" v-if="backups.length > 0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="pl-6">文件名</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead class="pr-6 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in backups" :key="row.name">
                  <TableCell class="pl-6 font-mono text-xs">{{ row.name }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ formatSize(row.size) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ formatTime(row.created_at) }}</TableCell>
                  <TableCell class="pr-6 text-right">
                    <Button variant="ghost" size="sm" @click="downloadBackup(row)">下载</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <CardContent v-else>
            <Empty description="暂无备份" />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>

    <!-- 通知渠道对话框 -->
    <Dialog :open="channelDialog" @update:open="channelDialog = $event" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ editingChannel ? '编辑通知渠道' : '新建通知渠道' }}</DialogTitle>
        <DialogDescription>配置后可发送测试消息验证</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <div class="space-y-2">
          <Label>渠道名称</Label>
          <Input v-model="channelForm.name" placeholder="例如: 运维群机器人" />
        </div>
        <div class="space-y-2">
          <Label>类型</Label>
          <Select
            v-model="channelForm.type"
            :options="[
              { label: '邮件 (SMTP)', value: 'email' },
              { label: 'Telegram', value: 'telegram' },
              { label: 'Webhook', value: 'webhook' },
              { label: '钉钉机器人', value: 'dingtalk' },
              { label: '飞书机器人', value: 'feishu' },
              { label: '企业微信机器人', value: 'wecom' }
            ]"
            @update:model-value="channelForm.config = {}"
          />
        </div>

        <template v-if="channelForm.type === 'email'">
          <div class="space-y-2">
            <Label>SMTP 服务器</Label>
            <Input v-model="channelForm.config.smtpHost" placeholder="smtp.example.com" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label>端口</Label>
              <Input v-model.number="channelForm.config.smtpPort" type="number" placeholder="465" />
            </div>
            <label class="flex cursor-pointer items-end gap-2 pb-2 text-sm">
              <Checkbox v-model="channelForm.config.smtpSecureBool" defaultChecked />
              SSL
            </label>
          </div>
          <div class="space-y-2">
            <Label>账号</Label>
            <Input v-model="channelForm.config.smtpUser" placeholder="发件邮箱账号" />
          </div>
          <div class="space-y-2">
            <Label>密码/授权码</Label>
            <Input v-model="channelForm.config.smtpPass" type="password" placeholder="邮箱授权码" />
          </div>
          <div class="space-y-2">
            <Label>收件邮箱</Label>
            <Input v-model="channelForm.config.to" placeholder="接收告警的邮箱" />
          </div>
        </template>

        <template v-if="channelForm.type === 'telegram'">
          <div class="space-y-2">
            <Label>Bot Token</Label>
            <Input v-model="channelForm.config.botToken" type="password" placeholder="123456:ABC-DEF..." />
          </div>
          <div class="space-y-2">
            <Label>Chat ID</Label>
            <Input v-model="channelForm.config.chatId" placeholder="接收消息的 chat id" />
          </div>
        </template>

        <template v-if="channelForm.type === 'webhook'">
          <div class="space-y-2">
            <Label>URL</Label>
            <Input v-model="channelForm.config.url" placeholder="https://example.com/hook" />
          </div>
          <div class="space-y-2">
            <Label>密钥</Label>
            <Input v-model="channelForm.config.secret" type="password" placeholder="可选，通过 X-Webhook-Secret 头传递" />
          </div>
        </template>

        <template v-if="channelForm.type === 'dingtalk'">
          <div class="space-y-2">
            <Label>Webhook</Label>
            <Input v-model="channelForm.config.webhookUrl" placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." />
          </div>
          <div class="space-y-2">
            <Label>加签密钥</Label>
            <Input v-model="channelForm.config.secret" type="password" placeholder="SEC 开头（可选）" />
          </div>
        </template>

        <template v-if="channelForm.type === 'feishu'">
          <div class="space-y-2">
            <Label>Webhook</Label>
            <Input v-model="channelForm.config.webhookUrl" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
          </div>
          <div class="space-y-2">
            <Label>签名校验</Label>
            <Input v-model="channelForm.config.secret" type="password" placeholder="签名密钥（可选）" />
          </div>
        </template>

        <template v-if="channelForm.type === 'wecom'">
          <div class="space-y-2">
            <Label>Webhook</Label>
            <Input v-model="channelForm.config.webhookUrl" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
          </div>
        </template>

        <label class="flex cursor-pointer items-center gap-3">
          <Switch v-model="channelForm.enabledBool" />
          <span class="text-sm font-medium">启用</span>
        </label>
      </div>
      <DialogFooter class="mt-2">
        <Button variant="outline" @click="channelDialog = false">取消</Button>
        <Button :loading="savingChannel" @click="saveChannel">保存</Button>
      </DialogFooter>
    </Dialog>

    <!-- 创建 API Key 对话框 -->
    <Dialog :open="apiKeyDialog" @update:open="apiKeyDialog = $event" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>创建 API Key</DialogTitle>
        <DialogDescription>Key 创建后仅展示一次，请妥善保存</DialogDescription>
      </DialogHeader>
      <div class="space-y-4">
        <div v-if="!newApiKey" class="space-y-2">
          <Label>名称</Label>
          <Input v-model="newApiKeyName" placeholder="例如: grafana 面板" @keyup.enter="createApiKey" />
        </div>
        <div v-else class="space-y-2">
          <Label>请立即保存此 Key：</Label>
          <div class="flex gap-2">
            <Input :model-value="newApiKey" readonly class="font-mono text-xs" />
            <Button variant="outline" size="icon" class="shrink-0" @click="copyText(newApiKey)">
              <Copy />
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter class="mt-2">
        <Button variant="outline" @click="apiKeyDialog = false; newApiKey = ''">
          {{ newApiKey ? '关闭' : '取消' }}
        </Button>
        <Button v-if="!newApiKey" :loading="creatingKey" @click="createApiKey">创建</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import {
  Settings2, Bell, KeyRound, DatabaseBackup, Plus, Sun, Moon, MonitorCog, Check, Copy
} from 'lucide-vue-next'
import { settingsApi, notificationApi, apiKeyApi, backupApi } from '@/api'
import { formatTime } from '@/utils/datetime'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import { useTheme, ACCENTS } from '@/composables/useTheme'
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.js'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Label from '@/components/ui/Label.vue'
import Select from '@/components/ui/Select.vue'
import Switch from '@/components/ui/Switch.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import Badge from '@/components/ui/badge.js'
import Empty from '@/components/ui/Empty.vue'
import Separator from '@/components/ui/separator.js'
import Dialog from '@/components/ui/Dialog.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'
import DialogFooter from '@/components/ui/DialogFooter.vue'
import Tabs from '@/components/ui/Tabs.vue'
import TabsList from '@/components/ui/TabsList.vue'
import TabsTrigger from '@/components/ui/TabsTrigger.vue'
import TabsContent from '@/components/ui/TabsContent.vue'
import Table, { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.js'

const theme = useTheme()
const activeTab = ref('basic')

// ===== 基础设置 =====
const savingSite = ref(false)
const savingTimezone = ref(false)
const timezoneOptions = ref([])
const dateFormatOptions = ref([])

const siteForm = reactive({ siteName: 'Uptime', siteUrl: '', siteDescription: '服务状态监控系统' })
const timezoneForm = reactive({ timezone: 'UTC', dateFormat: 'YYYY-MM-DD HH:mm:ss' })

const loadSettings = async () => {
  try {
    const res = await settingsApi.getSiteSettings()
    if (res.data) Object.assign(siteForm, res.data)
  } catch { /* ignore */ }
  try {
    const tzRes = await settingsApi.getTimezoneSettings()
    if (tzRes.data) Object.assign(timezoneForm, tzRes.data)
  } catch { /* ignore */ }
  try {
    const optionsRes = await settingsApi.getTimezoneOptions()
    if (optionsRes.data) {
      timezoneOptions.value = optionsRes.data.timezones.map(t => ({ label: t.label, value: t.value }))
      dateFormatOptions.value = optionsRes.data.dateFormats.map(f => ({ label: f.label, value: f.value }))
    }
  } catch { /* ignore */ }
}

const saveSiteSettings = async () => {
  savingSite.value = true
  try {
    await settingsApi.saveSiteSettings({ ...siteForm })
    toast.success('网站设置已保存')
  } catch {
    toast.error('保存失败')
  } finally {
    savingSite.value = false
  }
}

const saveTimezoneSettings = async () => {
  savingTimezone.value = true
  try {
    await settingsApi.saveTimezoneSettings({ ...timezoneForm })
    toast.success('时区设置已保存')
  } catch {
    toast.error('保存失败')
  } finally {
    savingTimezone.value = false
  }
}

// ===== 通知渠道 =====
const channels = ref([])
const channelDialog = ref(false)
const savingChannel = ref(false)
const testingId = ref(null)
const editingChannel = ref(null)
const channelForm = reactive({
  name: '', type: 'webhook', enabledBool: true, config: {}
})

const channelTypeLabel = (type) => ({
  email: '邮件', telegram: 'Telegram', webhook: 'Webhook',
  dingtalk: '钉钉', feishu: '飞书', wecom: '企业微信'
}[type] || type)

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
    channelForm.enabledBool = !!channel.enabled
    channelForm.config = { ...channel.config }
  } else {
    channelForm.name = ''
    channelForm.type = 'webhook'
    channelForm.enabledBool = true
    channelForm.config = {}
  }
  channelDialog.value = true
}

const saveChannel = async () => {
  if (!channelForm.name.trim()) return toast.error('请输入渠道名称')
  savingChannel.value = true
  try {
    const config = { ...channelForm.config }
    if (channelForm.config.smtpSecureBool !== undefined) {
      config.smtpSecure = channelForm.config.smtpSecureBool
      delete config.smtpSecureBool
    }
    const payload = {
      name: channelForm.name.trim(),
      type: channelForm.type,
      enabled: channelForm.enabledBool,
      config
    }
    const res = editingChannel.value
      ? await notificationApi.updateChannel(editingChannel.value.id, payload)
      : await notificationApi.createChannel(payload)
    if (res.success) {
      toast.success(editingChannel.value ? '渠道已更新' : '渠道已创建')
      channelDialog.value = false
      loadChannels()
    }
  } catch (e) {
    toast.error(e?.response?.data?.message || '保存失败')
  } finally {
    savingChannel.value = false
  }
}

const deleteChannel = async (channel) => {
  const ok = await confirm({
    title: '删除通知渠道',
    description: `确定删除渠道「${channel.name}」？`,
    confirmText: '删除',
    destructive: true
  })
  if (!ok) return
  try {
    const res = await notificationApi.deleteChannel(channel.id)
    if (res.success) {
      toast.success('已删除')
      loadChannels()
    }
  } catch {
    toast.error('删除失败')
  }
}

const testChannel = async (channel) => {
  testingId.value = channel.id
  try {
    const res = await notificationApi.testChannel(channel.id)
    if (res.success) toast.success('测试消息已发送')
  } catch (e) {
    toast.error(e?.response?.data?.message || '发送失败')
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
  if (!newApiKeyName.value.trim()) return toast.error('请输入名称')
  creatingKey.value = true
  try {
    const res = await apiKeyApi.create(newApiKeyName.value.trim())
    if (res.success) {
      newApiKey.value = res.data.key
      loadApiKeys()
    }
  } catch {
    toast.error('创建失败')
  } finally {
    creatingKey.value = false
  }
}

const deleteApiKey = async (item) => {
  const ok = await confirm({
    title: '删除 API Key',
    description: `确定删除「${item.name}」？使用它的第三方将立即失效。`,
    confirmText: '删除',
    destructive: true
  })
  if (!ok) return
  try {
    const res = await apiKeyApi.remove(item.id)
    if (res.success) {
      toast.success('已删除')
      loadApiKeys()
    }
  } catch {
    toast.error('删除失败')
  }
}

// ===== 备份 =====
const backups = ref([])
const backingUp = ref(false)
const backupKeep = 7

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
      toast.success('备份已创建')
      loadBackups()
    }
  } catch {
    toast.error('备份失败')
  } finally {
    backingUp.value = false
  }
}

const downloadBackup = async (row) => {
  try {
    await backupApi.download(row.name)
  } catch {
    toast.error('下载失败')
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
    toast.success('已复制')
  } catch {
    toast.error('复制失败')
  }
}

onMounted(() => {
  loadSettings()
  loadChannels()
  loadApiKeys()
  loadBackups()
})
</script>
