<template>
  <div class="user-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button 
            v-if="authStore.isAdmin" 
            type="primary" 
            @click="showCreateDialog = true"
          >
            <el-icon><Plus /></el-icon>
            新建用户
          </el-button>
        </div>
      </template>

      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="getRoleType(row.role)">
              {{ getRoleText(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280">
          <template #default="{ row }">
            <el-button 
              size="small" 
              @click="editUsername(row)"
              :disabled="!canEdit(row)"
            >
              修改用户名
            </el-button>
            <el-button 
              size="small" 
              @click="editPassword(row)"
              :disabled="!canEdit(row)"
            >
              修改密码
            </el-button>
            <el-button 
              v-if="authStore.isAdmin && row.id !== authStore.user.id"
              size="small" 
              type="danger" 
              @click="deleteUser(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建用户对话框 -->
    <el-dialog v-model="showCreateDialog" title="新建用户" width="500px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="createForm.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="createForm.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="createForm.role" placeholder="请选择角色">
            <el-option label="普通用户" value="user" />
            <el-option label="访客" value="viewer" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate" :loading="creating">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改用户名对话框 -->
    <el-dialog v-model="showUsernameDialog" title="修改用户名" width="500px">
      <el-form ref="usernameFormRef" :model="usernameForm" :rules="usernameRules" label-width="100px">
        <el-form-item label="新用户名" prop="username">
          <el-input v-model="usernameForm.username" placeholder="请输入新用户名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUsernameDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateUsername" :loading="updating">确定</el-button>
      </template>
    </el-dialog>

    <!-- 修改密码对话框 -->
    <el-dialog v-model="showPasswordDialog" title="修改密码" width="500px">
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="100px">
        <el-form-item label="当前密码" prop="oldPassword" v-if="passwordForm.userId === authStore.user?.id">
          <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" @click="handleUpdatePassword" :loading="updating">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api'
import { formatTime } from '@/utils/datetime'

const authStore = useAuthStore()

const users = ref([])
const loading = ref(false)
const showCreateDialog = ref(false)
const showUsernameDialog = ref(false)
const showPasswordDialog = ref(false)
const creating = ref(false)
const updating = ref(false)

const createFormRef = ref(null)
const usernameFormRef = ref(null)
const passwordFormRef = ref(null)

const createForm = reactive({
  username: '',
  email: '',
  password: '',
  role: 'user'
})

const usernameForm = reactive({
  userId: null,
  username: ''
})

const passwordForm = reactive({
  userId: null,
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const createRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 50, message: '用户名长度在3-50个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6个字符', trigger: 'blur' }
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ]
}

const usernameRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 50, message: '用户名长度在3-50个字符', trigger: 'blur' }
  ]
}

const validatePass = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请输入新密码'))
  } else if (value.length < 6) {
    callback(new Error('密码长度至少6位'))
  } else {
    if (passwordForm.confirmPassword !== '') {
      passwordFormRef.value.validateField('confirmPassword')
    }
    callback()
  }
}

const validateConfirmPass = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== passwordForm.newPassword) {
    callback(new Error('两次密码输入不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, validator: validatePass, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirmPass, trigger: 'blur' }
  ]
}

const getRoleType = (role) => {
  const types = {
    admin: 'danger',
    user: 'success',
    viewer: 'info'
  }
  return types[role] || 'info'
}

const getRoleText = (role) => {
  const texts = {
    admin: '管理员',
    user: '用户',
    viewer: '访客'
  }
  return texts[role] || role
}

const formatDate = (dateStr) => {
  return formatTime(dateStr)
}

const canEdit = (user) => {
  // 管理员可以编辑任何人，普通用户只能编辑自己
  return authStore.isAdmin || user.id === authStore.user?.id
}

const loadUsers = async () => {
  try {
    loading.value = true
    const res = await authApi.getUsers()
    users.value = res.data
  } catch (error) {
    ElMessage.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

const handleCreate = async () => {
  try {
    await createFormRef.value.validate()
    creating.value = true
    
    await authApi.createUser(createForm)
    
    ElMessage.success('用户创建成功')
    showCreateDialog.value = false
    
    // 重置表单
    createFormRef.value.resetFields()
    
    // 重新加载列表
    await loadUsers()
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '创建用户失败')
  } finally {
    creating.value = false
  }
}

const editUsername = (user) => {
  usernameForm.userId = user.id
  usernameForm.username = user.username
  showUsernameDialog.value = true
}

const handleUpdateUsername = async () => {
  try {
    await usernameFormRef.value.validate()
    updating.value = true
    
    await authApi.updateUsername(usernameForm.userId, {
      username: usernameForm.username
    })
    
    ElMessage.success('用户名修改成功')
    showUsernameDialog.value = false
    
    // 如果修改的是自己，更新本地用户信息
    if (usernameForm.userId === authStore.user?.id) {
      await authStore.checkAuth()
    }
    
    // 重新加载列表
    await loadUsers()
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '修改用户名失败')
  } finally {
    updating.value = false
  }
}

const editPassword = (user) => {
  passwordForm.userId = user.id
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  showPasswordDialog.value = true
}

const handleUpdatePassword = async () => {
  try {
    await passwordFormRef.value.validate()
    updating.value = true
    
    await authApi.updatePassword(passwordForm.userId, {
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
      confirmPassword: passwordForm.confirmPassword
    })
    
    ElMessage.success('密码修改成功')
    showPasswordDialog.value = false
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '修改密码失败')
  } finally {
    updating.value = false
  }
}

const deleteUser = async (user) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${user.username}" 吗？此操作不可恢复。`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await authApi.deleteUser(user.id)
    ElMessage.success('用户删除成功')
    
    // 重新加载列表
    await loadUsers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.message || '删除用户失败')
    }
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
