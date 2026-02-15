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
        label-width="120px"
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
            <el-radio label="http">HTTP/HTTPS</el-radio>
            <el-radio label="tcp">TCP 端口</el-radio>
            <el-radio label="ping">PING</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="监控目标" prop="target">
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

        <el-form-item label="检测间隔" prop="interval">
          <el-input-number
            v-model="formData.interval"
            :min="10"
            :max="86400"
            :step="10"
          />
          <span class="unit">秒</span>
        </el-form-item>

        <el-form-item label="超时时间" prop="timeout">
          <el-input-number
            v-model="formData.timeout"
            :min="1"
            :max="300"
          />
          <span class="unit">秒</span>
        </el-form-item>

        <el-form-item label="HTTP 配置" v-if="formData.type === 'http'">
          <div class="http-config">
            <el-form-item label="期望状态码">
              <el-input-number
                v-model="formData.config.expectedStatusCode"
                :min="100"
                :max="599"
                placeholder="200"
              />
            </el-form-item>
          </div>
        </el-form-item>

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
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useMonitorStore } from '@/stores/monitor'
import { monitorApi } from '@/api'

const router = useRouter()
const route = useRoute()
const monitorStore = useMonitorStore()

const formRef = ref(null)
const loading = ref(false)
const submitting = ref(false)

const isEdit = computed(() => route.name === 'MonitorEdit')

const formData = ref({
  name: '',
  type: 'http',
  target: '',
  interval: 300,
  timeout: 30,
  enabled: 1,
  config: {
    method: 'GET',
    expectedStatusCode: 200
  }
})

const rules = {
  name: [
    { required: true, message: '请输入监控名称', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择监控类型', trigger: 'change' }
  ],
  target: [
    { required: true, message: '请输入监控目标', trigger: 'blur' }
  ],
  interval: [
    { required: true, message: '请设置检测间隔', trigger: 'blur' }
  ],
  timeout: [
    { required: true, message: '请设置超时时间', trigger: 'blur' }
  ]
}

const targetPlaceholder = computed(() => {
  switch (formData.value.type) {
    case 'http':
      return 'https://example.com/api'
    case 'tcp':
      return 'example.com:3306'
    case 'ping':
      return 'example.com 或 8.8.8.8'
    default:
      return ''
  }
})

const targetHelp = computed(() => {
  switch (formData.value.type) {
    case 'http':
      return '输入完整的 HTTP/HTTPS URL'
    case 'tcp':
      return '格式: 主机名:端口号，例如: localhost:3306'
    case 'ping':
      return '输入域名或 IP 地址'
    default:
      return ''
  }
})

const handleTypeChange = () => {
  formData.value.target = ''
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    
    submitting.value = true
    
    const data = {
      ...formData.value,
      config: formData.value.type === 'http' ? formData.value.config : undefined
    }
    
    // 删除 undefined 字段
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key]
      }
    })

    if (isEdit.value) {
      await monitorStore.updateMonitor(route.params.id, data)
      ElMessage.success('更新成功')
    } else {
      await monitorStore.createMonitor(data)
      ElMessage.success('创建成功')
    }

    router.push('/')
  } catch (error) {
    if (error !== false) { // validate error
      ElMessage.error(isEdit.value ? '更新失败' : '创建失败')
    }
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (isEdit.value) {
    loading.value = true
    try {
      const res = await monitorApi.getById(route.params.id)
      if (res.success) {
        const monitor = res.data
        formData.value = {
          name: monitor.name,
          type: monitor.type,
          target: monitor.target,
          interval: monitor.interval,
          timeout: monitor.timeout,
          enabled: monitor.enabled,
          config: monitor.config || { method: 'GET', expectedStatusCode: 200 }
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
  max-width: 800px;
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

.http-config {
  width: 100%;
}
</style>
