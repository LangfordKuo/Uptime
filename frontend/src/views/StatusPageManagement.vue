<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <Card>
      <CardHeader>
        <div class="flex w-full flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>状态页列表</CardTitle>
            <CardDescription>创建可公开访问的服务状态页面</CardDescription>
          </div>
          <Button size="sm" @click="openCreate">
            <Plus />
            新建状态页
          </Button>
        </div>
      </CardHeader>
      <CardContent class="px-0 pb-0">
        <div v-if="loading" class="flex justify-center py-16">
          <Loader2 class="size-7 animate-spin text-muted-foreground" />
        </div>
        <Table v-else-if="statusPages.length > 0">
          <TableHeader>
            <TableRow>
              <TableHead class="pl-6">名称</TableHead>
              <TableHead>访问链接</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>监控项</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead class="pr-6 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="row in statusPages" :key="row.id">
              <TableCell class="pl-6">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ row.name }}</span>
                  <Badge v-if="row.is_public" variant="success">公开</Badge>
                  <Badge v-else variant="secondary">私有</Badge>
                  <Badge v-if="row.has_password" variant="warning">密码</Badge>
                </div>
              </TableCell>
              <TableCell>
                <a
                  :href="`/status/${row.slug}`"
                  target="_blank"
                  class="text-primary hover:underline underline-offset-2 font-mono text-xs"
                >/status/{{ row.slug }}</a>
              </TableCell>
              <TableCell class="max-w-48 truncate text-muted-foreground" :title="row.description">
                {{ row.description || '-' }}
              </TableCell>
              <TableCell>{{ row.monitor_count }}</TableCell>
              <TableCell class="text-muted-foreground">{{ formatTime(row.created_at) }}</TableCell>
              <TableCell class="pr-6">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" title="查看" @click="viewStatusPage(row)">
                    <ExternalLink />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="编辑" @click="editStatusPage(row)">
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="删除"
                    class="text-destructive hover:text-destructive"
                    @click="handleDelete(row)"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <CardContent v-else>
          <Empty description="暂无状态页，创建一个向访客展示服务状态" />
        </CardContent>
      </CardContent>
    </Card>

    <!-- 创建/编辑状态页 -->
    <Dialog :open="showDialog" @update:open="showDialog = $event" class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ isEditing ? '编辑状态页' : '新建状态页' }}</DialogTitle>
        <DialogDescription>配置状态页信息与展示的监控项</DialogDescription>
      </DialogHeader>
      <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label>名称</Label>
            <Input v-model="form.name" placeholder="请输入状态页名称" />
          </div>
          <div class="space-y-2">
            <Label>Slug</Label>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground whitespace-nowrap">/status/</span>
              <Input v-model="form.slug" placeholder="小写字母、数字、连字符" class="font-mono" />
            </div>
          </div>
        </div>
        <div class="space-y-2">
          <Label>描述</Label>
          <Textarea v-model="form.description" :rows="2" placeholder="请输入状态页描述（可选）" />
        </div>
        <div class="space-y-2">
          <Label>Logo URL</Label>
          <Input v-model="form.logo_url" placeholder="可选，状态页 Logo 地址" />
        </div>
        <div class="space-y-2">
          <Label>访问密码</Label>
          <Input
            v-model="form.password"
            type="password"
            :placeholder="isEditing && form.has_password ? '已设置密码，留空保持不变' : '可选，设置后访客需输入密码'"
          />
          <label v-if="isEditing && form.has_password" class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox v-model="form.remove_password" />
            移除访问密码
          </label>
        </div>
        <label class="flex cursor-pointer items-center gap-3">
          <Switch v-model="form.isPublicBool" />
          <span class="text-sm font-medium">公开访问</span>
        </label>
        <div class="space-y-2">
          <Label>展示的监控项</Label>
          <MultiSelect
            v-model="form.monitor_ids"
            :options="monitorOptions"
            placeholder="选择要展示的监控项"
            empty-text="暂无监控项"
          />
        </div>
      </div>
      <DialogFooter class="mt-2">
        <Button variant="outline" @click="showDialog = false">取消</Button>
        <Button :loading="submitting" @click="handleSubmit">
          {{ isEditing ? '保存' : '创建' }}
        </Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Plus, Loader2, ExternalLink, Pencil, Trash2 } from 'lucide-vue-next'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import { statusPageApi, monitorApi } from '@/api'
import { formatTime } from '@/utils/datetime'
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.js'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Textarea from '@/components/ui/Textarea.vue'
import Label from '@/components/ui/Label.vue'
import Switch from '@/components/ui/Switch.vue'
import Checkbox from '@/components/ui/Checkbox.vue'
import MultiSelect from '@/components/ui/MultiSelect.vue'
import Badge from '@/components/ui/badge.js'
import Empty from '@/components/ui/Empty.vue'
import Dialog from '@/components/ui/Dialog.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'
import DialogFooter from '@/components/ui/DialogFooter.vue'
import Table, { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.js'

const statusPages = ref([])
const monitors = ref([])
const loading = ref(false)
const showDialog = ref(false)
const isEditing = ref(false)
const submitting = ref(false)
const editingId = ref(null)

const form = reactive({
  name: '',
  slug: '',
  description: '',
  logo_url: '',
  password: '',
  has_password: false,
  remove_password: false,
  isPublicBool: true,
  monitor_ids: []
})

const monitorOptions = computed(() =>
  monitors.value.map(m => ({ label: m.name, value: m.id }))
)

const resetForm = () => {
  Object.assign(form, {
    name: '', slug: '', description: '', logo_url: '',
    password: '', has_password: false, remove_password: false,
    isPublicBool: true, monitor_ids: []
  })
}

const loadStatusPages = async () => {
  try {
    loading.value = true
    const res = await statusPageApi.getAll()
    statusPages.value = res.data
  } catch {
    toast.error('加载状态页列表失败')
  } finally {
    loading.value = false
  }
}

const loadMonitors = async () => {
  try {
    const res = await monitorApi.getAll()
    monitors.value = res.data
  } catch { /* ignore */ }
}

const viewStatusPage = (row) => {
  window.open(`/status/${row.slug}`, '_blank')
}

const openCreate = () => {
  isEditing.value = false
  editingId.value = null
  resetForm()
  showDialog.value = true
}

const editStatusPage = async (row) => {
  isEditing.value = true
  try {
    const res = await statusPageApi.getById(row.id)
    const data = res.data
    editingId.value = data.id
    Object.assign(form, {
      name: data.name,
      slug: data.slug,
      description: data.description || '',
      logo_url: data.logo_url || '',
      password: '',
      has_password: !!data.has_password,
      remove_password: false,
      isPublicBool: data.is_public === 1,
      monitor_ids: data.monitors ? data.monitors.map(m => m.id) : []
    })
    showDialog.value = true
  } catch {
    toast.error('加载状态页详情失败')
  }
}

const handleSubmit = async () => {
  if (!form.name.trim()) return toast.error('请输入状态页名称')
  if (!/^[a-z0-9-]+$/.test(form.slug)) return toast.error('Slug 只能包含小写字母、数字和连字符')

  submitting.value = true
  try {
    const data = {
      name: form.name.trim(),
      slug: form.slug,
      description: form.description,
      logo_url: form.logo_url,
      is_public: form.isPublicBool,
      monitor_ids: form.monitor_ids
    }
    if (form.remove_password) data.password = ''
    else if (form.password) data.password = form.password

    if (isEditing.value) {
      await statusPageApi.update(editingId.value, data)
      toast.success('状态页更新成功')
    } else {
      await statusPageApi.create(data)
      toast.success('状态页创建成功')
    }
    showDialog.value = false
    await loadStatusPages()
  } catch (error) {
    toast.error(error?.response?.data?.message || (isEditing.value ? '更新失败' : '创建失败'))
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (row) => {
  const ok = await confirm({
    title: '删除状态页',
    description: `确定要删除状态页「${row.name}」吗？此操作不可恢复。`,
    confirmText: '删除',
    destructive: true
  })
  if (!ok) return
  try {
    await statusPageApi.delete(row.id)
    toast.success('删除成功')
    await loadStatusPages()
  } catch {
    toast.error('删除失败')
  }
}

onMounted(() => {
  loadStatusPages()
  loadMonitors()
})
</script>
