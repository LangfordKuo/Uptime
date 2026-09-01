<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <Card>
      <CardHeader>
        <div class="flex w-full flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>管理员可创建用户并管理角色</CardDescription>
          </div>
          <Button v-if="authStore.isAdmin" size="sm" @click="openCreate">
            <Plus />
            新建用户
          </Button>
        </div>
      </CardHeader>
      <CardContent class="px-0 pb-0">
        <div v-if="loading" class="flex justify-center py-16">
          <Loader2 class="size-7 animate-spin text-muted-foreground" />
        </div>
        <Table v-else-if="users.length > 0">
          <TableHeader>
            <TableRow>
              <TableHead class="pl-6">ID</TableHead>
              <TableHead>用户名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead class="pr-6 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="user in users" :key="user.id">
              <TableCell class="pl-6 text-muted-foreground">{{ user.id }}</TableCell>
              <TableCell class="font-medium">{{ user.username }}</TableCell>
              <TableCell class="text-muted-foreground">{{ user.email }}</TableCell>
              <TableCell>
                <Badge :variant="user.role === 'admin' ? 'default' : user.role === 'user' ? 'success' : 'secondary'">
                  {{ getRoleText(user.role) }}
                </Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">{{ formatTime(user.created_at) }}</TableCell>
              <TableCell class="pr-6">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" :disabled="!canEdit(user)" @click="openUsername(user)">
                    改用户名
                  </Button>
                  <Button variant="ghost" size="sm" :disabled="!canEdit(user)" @click="openPassword(user)">
                    改密码
                  </Button>
                  <Button
                    v-if="authStore.isAdmin && user.id !== authStore.user.id"
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:text-destructive"
                    @click="handleDelete(user)"
                  >
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <CardContent v-else>
          <Empty description="暂无用户" />
        </CardContent>
      </CardContent>
    </Card>

    <!-- 新建用户 -->
    <Dialog :open="showCreate" @update:open="showCreate = $event" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>新建用户</DialogTitle>
        <DialogDescription>创建新用户并分配角色</DialogDescription>
      </DialogHeader>
      <div class="space-y-4">
        <div class="space-y-2">
          <Label>用户名</Label>
          <Input v-model="createForm.username" placeholder="3-50 个字符" />
        </div>
        <div class="space-y-2">
          <Label>邮箱</Label>
          <Input v-model="createForm.email" type="email" placeholder="user@example.com" />
        </div>
        <div class="space-y-2">
          <Label>密码</Label>
          <Input v-model="createForm.password" type="password" placeholder="至少 6 位" />
        </div>
        <div class="space-y-2">
          <Label>角色</Label>
          <Select v-model="createForm.role" :options="[
            { label: '普通用户', value: 'user' },
            { label: '访客（只读）', value: 'viewer' }
          ]" />
        </div>
      </div>
      <DialogFooter class="mt-2">
        <Button variant="outline" @click="showCreate = false">取消</Button>
        <Button :loading="creating" @click="handleCreate">确定</Button>
      </DialogFooter>
    </Dialog>

    <!-- 修改用户名 -->
    <Dialog :open="showUsername" @update:open="showUsername = $event" class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>修改用户名</DialogTitle>
      </DialogHeader>
      <div class="space-y-2">
        <Label>新用户名</Label>
        <Input v-model="usernameForm.username" placeholder="3-50 个字符" />
      </div>
      <DialogFooter class="mt-2">
        <Button variant="outline" @click="showUsername = false">取消</Button>
        <Button :loading="updating" @click="handleUpdateUsername">确定</Button>
      </DialogFooter>
    </Dialog>

    <!-- 修改密码 -->
    <Dialog :open="showPassword" @update:open="showPassword = $event" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>修改密码</DialogTitle>
        <DialogDescription v-if="passwordForm.userId !== authStore.user?.id">
          管理员重置他人密码无需输入当前密码
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-4">
        <div v-if="passwordForm.userId === authStore.user?.id" class="space-y-2">
          <Label>当前密码</Label>
          <Input v-model="passwordForm.oldPassword" type="password" placeholder="请输入当前密码" />
        </div>
        <div class="space-y-2">
          <Label>新密码</Label>
          <Input v-model="passwordForm.newPassword" type="password" placeholder="至少 6 位" />
        </div>
        <div class="space-y-2">
          <Label>确认新密码</Label>
          <Input v-model="passwordForm.confirmPassword" type="password" placeholder="再次输入新密码" />
        </div>
      </div>
      <DialogFooter class="mt-2">
        <Button variant="outline" @click="showPassword = false">取消</Button>
        <Button :loading="updating" @click="handleUpdatePassword">确定</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import { authApi } from '@/api'
import { formatTime } from '@/utils/datetime'
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.js'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Select from '@/components/ui/Select.vue'
import Badge from '@/components/ui/badge.js'
import Empty from '@/components/ui/Empty.vue'
import Dialog from '@/components/ui/Dialog.vue'
import DialogHeader from '@/components/ui/DialogHeader.vue'
import DialogTitle from '@/components/ui/DialogTitle.vue'
import DialogDescription from '@/components/ui/DialogDescription.vue'
import DialogFooter from '@/components/ui/DialogFooter.vue'
import Table, { TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.js'

const authStore = useAuthStore()

const users = ref([])
const loading = ref(false)
const showCreate = ref(false)
const showUsername = ref(false)
const showPassword = ref(false)
const creating = ref(false)
const updating = ref(false)

const createForm = reactive({ username: '', email: '', password: '', role: 'user' })
const usernameForm = reactive({ userId: null, username: '' })
const passwordForm = reactive({ userId: null, oldPassword: '', newPassword: '', confirmPassword: '' })

const getRoleText = (role) => ({ admin: '管理员', user: '用户', viewer: '访客' }[role] || role)

const canEdit = (user) =>
  authStore.isAdmin || user.id === authStore.user?.id

const loadUsers = async () => {
  try {
    loading.value = true
    const res = await authApi.getUsers()
    users.value = res.data
  } catch {
    toast.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  Object.assign(createForm, { username: '', email: '', password: '', role: 'user' })
  showCreate.value = true
}

const handleCreate = async () => {
  if (createForm.username.trim().length < 3) return toast.error('用户名长度至少 3 个字符')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(createForm.email)) return toast.error('请输入正确的邮箱地址')
  if (createForm.password.length < 6) return toast.error('密码长度至少 6 位')

  creating.value = true
  try {
    await authApi.createUser(createForm)
    toast.success('用户创建成功')
    showCreate.value = false
    await loadUsers()
  } catch (error) {
    toast.error(error?.response?.data?.message || '创建用户失败')
  } finally {
    creating.value = false
  }
}

const openUsername = (user) => {
  usernameForm.userId = user.id
  usernameForm.username = user.username
  showUsername.value = true
}

const handleUpdateUsername = async () => {
  if (usernameForm.username.trim().length < 3) return toast.error('用户名长度至少 3 个字符')
  updating.value = true
  try {
    await authApi.updateUsername(usernameForm.userId, { username: usernameForm.username })
    toast.success('用户名修改成功')
    showUsername.value = false
    if (usernameForm.userId === authStore.user?.id) await authStore.checkAuth()
    await loadUsers()
  } catch (error) {
    toast.error(error?.response?.data?.message || '修改用户名失败')
  } finally {
    updating.value = false
  }
}

const openPassword = (user) => {
  passwordForm.userId = user.id
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  showPassword.value = true
}

const handleUpdatePassword = async () => {
  if (passwordForm.newPassword.length < 6) return toast.error('密码长度至少 6 位')
  if (passwordForm.newPassword !== passwordForm.confirmPassword) return toast.error('两次密码输入不一致')
  updating.value = true
  try {
    await authApi.updatePassword(passwordForm.userId, {
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword
    })
    toast.success('密码修改成功')
    showPassword.value = false
  } catch (error) {
    toast.error(error?.response?.data?.message || '修改密码失败')
  } finally {
    updating.value = false
  }
}

const handleDelete = async (user) => {
  const ok = await confirm({
    title: '删除用户',
    description: `确定要删除用户「${user.username}」吗？此操作不可恢复。`,
    confirmText: '删除',
    destructive: true
  })
  if (!ok) return
  try {
    await authApi.deleteUser(user.id)
    toast.success('用户删除成功')
    await loadUsers()
  } catch (error) {
    toast.error(error?.response?.data?.message || '删除用户失败')
  }
}

onMounted(loadUsers)
</script>
