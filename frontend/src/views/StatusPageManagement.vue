<template>
  <div class="status-page-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>状态页管理</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建状态页
          </el-button>
        </div>
      </template>

      <el-table :data="statusPages" v-loading="loading" stripe>
        <el-table-column prop="name" label="名称" min-width="150">
          <template #default="{ row }">
            <div class="status-page-name">
              <span>{{ row.name }}</span>
              <el-tag v-if="row.is_public" type="success" size="small">公开</el-tag>
              <el-tag v-else type="info" size="small">私有</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="slug" label="访问链接" min-width="200">
          <template #default="{ row }">
            <el-link type="primary" :href="`/status/${row.slug}`" target="_blank">
              /status/{{ row.slug }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="monitor_count" label="监控项数" width="100" />
        <el-table-column prop="creator_name" label="创建者" width="120" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="viewStatusPage(row)">
              <el-icon><View /></el-icon>
            </el-button>
            <el-button size="small" type="primary" @click="editStatusPage(row)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" type="danger" @click="deleteStatusPage(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑状态页对话框 -->
    <el-dialog
      v-model="showDialog"
      :title="isEditing ? '编辑状态页' : '新建状态页'"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入状态页名称" />
        </el-form-item>

        <el-form-item label="Slug" prop="slug">
          <el-input v-model="form.slug" placeholder="只能包含小写字母、数字和连字符">
            <template #prepend>/status/</template>
          </el-input>
        </el-form-item>

        <el-form-item label="描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            rows="3"
            placeholder="请输入状态页描述"
          />
        </el-form-item>

        <el-form-item label="Logo URL" prop="logo_url">
          <el-input v-model="form.logo_url" placeholder="可选，状态页Logo地址" />
        </el-form-item>

        <el-form-item label="公开访问" prop="is_public">
          <el-switch v-model="form.is_public" />
        </el-form-item>

        <el-form-item label="选择监控项" prop="monitor_ids">
          <el-select
            v-model="form.monitor_ids"
            multiple
            filterable
            placeholder="选择要展示的监控项"
            style="width: 100%"
          >
            <el-option
              v-for="monitor in monitors"
              :key="monitor.id"
              :label="monitor.name"
              :value="monitor.id"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ isEditing ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { statusPageApi, monitorApi } from '@/api'
import { formatTime } from '@/utils/datetime'

const router = useRouter()

const statusPages = ref([])
const monitors = ref([])
const loading = ref(false)
const showDialog = ref(false)
const showCreateDialog = computed({
  get: () => showDialog.value && !isEditing.value,
  set: (val) => {
    if (!val) showDialog.value = false
    else {
      isEditing.value = false
      resetForm()
      showDialog.value = true
    }
  }
})
const isEditing = ref(false)
const submitting = ref(false)
const formRef = ref(null)

const form = reactive({
  id: null,
  name: '',
  slug: '',
  description: '',
  logo_url: '',
  is_public: true,
  monitor_ids: []
})

const rules = {
  name: [
    { required: true, message: '请输入状态页名称', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在1-100个字符', trigger: 'blur' }
  ],
  slug: [
    { required: true, message: '请输入Slug', trigger: 'blur' },
    { pattern: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字和连字符', trigger: 'blur' }
  ]
}

const formatDate = (dateStr) => {
  return formatTime(dateStr)
}

const resetForm = () => {
  form.id = null
  form.name = ''
  form.slug = ''
  form.description = ''
  form.logo_url = ''
  form.is_public = true
  form.monitor_ids = []
}

const loadStatusPages = async () => {
  try {
    loading.value = true
    const res = await statusPageApi.getAll()
    statusPages.value = res.data
  } catch (error) {
    ElMessage.error('加载状态页列表失败')
  } finally {
    loading.value = false
  }
}

const loadMonitors = async () => {
  try {
    const res = await monitorApi.getAll()
    monitors.value = res.data
  } catch (error) {
    console.error('加载监控项失败:', error)
  }
}

const viewStatusPage = (row) => {
  window.open(`/status/${row.slug}`, '_blank')
}

const editStatusPage = async (row) => {
  isEditing.value = true
  try {
    const res = await statusPageApi.getById(row.id)
    const data = res.data
    
    form.id = data.id
    form.name = data.name
    form.slug = data.slug
    form.description = data.description || ''
    form.logo_url = data.logo_url || ''
    form.is_public = data.is_public === 1
    form.monitor_ids = data.monitors ? data.monitors.map(m => m.id) : []
    
    showDialog.value = true
  } catch (error) {
    ElMessage.error('加载状态页详情失败')
  }
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    submitting.value = true

    const data = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      logo_url: form.logo_url,
      is_public: form.is_public,
      monitor_ids: form.monitor_ids
    }

    if (isEditing.value) {
      await statusPageApi.update(form.id, data)
      ElMessage.success('状态页更新成功')
    } else {
      await statusPageApi.create(data)
      ElMessage.success('状态页创建成功')
    }

    showDialog.value = false
    resetForm()
    await loadStatusPages()
  } catch (error) {
    if (error.response?.data?.message) {
      ElMessage.error(error.response.data.message)
    } else if (error !== false) {
      ElMessage.error(isEditing.value ? '更新失败' : '创建失败')
    }
  } finally {
    submitting.value = false
  }
}

const deleteStatusPage = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除状态页 "${row.name}" 吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await statusPageApi.delete(row.id)
    ElMessage.success('删除成功')
    await loadStatusPages()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  loadStatusPages()
  loadMonitors()
})
</script>

<style scoped>
.status-page-management {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 4px;
}

.card-header span {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--md-on-surface);
}

.status-page-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 表格样式优化 */
:deep(.el-table) {
  border-radius: var(--md-shape-lg);
  overflow: hidden;
  background-color: var(--md-surface);
}

:deep(.el-table th) {
  background-color: var(--md-surface-variant) !important;
  color: var(--md-on-surface-variant) !important;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  padding: 16px 12px !important;
}

:deep(.el-table td) {
  color: var(--md-on-surface) !important;
  padding: 16px 12px !important;
}

:deep(.el-table__row:hover > td) {
  background-color: var(--md-surface-variant) !important;
}

/* 标签样式 */
:deep(.el-tag--success) {
  background-color: #E8F5E9 !important;
  color: #2E7D32 !important;
  border-color: transparent !important;
}

:deep(.el-tag--info) {
  background-color: #F5F5F5 !important;
  color: #6B6B6B !important;
  border-color: transparent !important;
}

/* 按钮样式 */
:deep(.el-button--primary) {
  background-color: var(--md-primary) !important;
  border-color: var(--md-primary) !important;
}

:deep(.el-button--primary:hover) {
  background-color: #333333 !important;
  border-color: #333333 !important;
}

:deep(.el-button--danger) {
  background-color: var(--md-error) !important;
  border-color: var(--md-error) !important;
}

/* 链接样式 */
:deep(.el-link--primary) {
  color: var(--md-primary) !important;
}

:deep(.el-link--primary:hover) {
  color: #333333 !important;
}

/* 对话框样式 */
:deep(.el-dialog) {
  border-radius: var(--md-shape-xl) !important;
}

:deep(.el-dialog__header) {
  padding: 24px 24px 16px !important;
  font-weight: 600;
  font-size: 1.25rem;
}

:deep(.el-dialog__body) {
  padding: 16px 24px !important;
}

:deep(.el-dialog__footer) {
  padding: 16px 24px 24px !important;
}

/* 表单样式 */
:deep(.el-form-item__label) {
  color: var(--md-on-surface-variant) !important;
  font-weight: 500;
}

:deep(.el-input__wrapper) {
  background-color: var(--md-surface-variant) !important;
  border-color: var(--md-outline-variant) !important;
}

:deep(.el-textarea__inner) {
  background-color: var(--md-surface-variant) !important;
  border-color: var(--md-outline-variant) !important;
}
</style>
