<template>
  <div class="relative flex min-h-screen items-center justify-center bg-background p-4">
    <Button
      variant="ghost"
      size="icon"
      class="absolute right-4 top-4"
      :title="theme.isDark() ? '切换亮色' : '切换暗色'"
      @click="theme.toggleDark()"
    >
      <Sun v-if="theme.isDark()" class="size-4" />
      <Moon v-else class="size-4" />
    </Button>

    <div class="w-full max-w-sm">
      <!-- 品牌区 -->
      <div class="mb-8 flex flex-col items-center gap-2 text-center">
        <div class="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
          <Activity class="size-6" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight">{{ siteSettings.siteName }}</h1>
        <p class="text-sm text-muted-foreground">{{ siteSettings.siteDescription }}</p>
      </div>

      <!-- 登录卡片 -->
      <Card>
        <CardHeader>
          <CardTitle class="text-xl">欢迎回来</CardTitle>
          <CardDescription>请登录您的账户</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="username">用户名</Label>
            <Input id="username" v-model="form.username" placeholder="请输入用户名" @keyup.enter="handleLogin" />
          </div>
          <div class="space-y-2">
            <Label for="password">密码</Label>
            <div class="relative">
              <Input
                id="password"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                class="pr-10"
                @keyup.enter="handleLogin"
              />
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="size-4" />
                <Eye v-else class="size-4" />
              </button>
            </div>
          </div>
          <Button class="w-full" :loading="loading" @click="handleLogin">登 录</Button>
        </CardContent>
      </Card>
    </div>

    <footer class="absolute bottom-4 w-full text-center text-xs text-muted-foreground">
      Powered by
      <a
        href="https://github.com/LangfordKuo/Uptime"
        target="_blank"
        rel="noopener noreferrer"
        class="hover:text-foreground hover:underline underline-offset-2"
      >Uptime Monitor</a>
    </footer>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Activity, Eye, EyeOff } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import { toast } from '@/composables/useToast'
import { settingsApi } from '@/api'
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.js'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'

const router = useRouter()
const authStore = useAuthStore()
const theme = useTheme()

const loading = ref(false)
const showPassword = ref(false)
const form = reactive({ username: '', password: '' })

const siteSettings = reactive({
  siteName: 'Uptime',
  siteDescription: '服务状态监控系统'
})

const loadSiteSettings = async () => {
  try {
    const res = await settingsApi.getSiteSettings()
    if (res.data) {
      siteSettings.siteName = res.data.siteName || 'Uptime'
      siteSettings.siteDescription = res.data.siteDescription || '服务状态监控系统'
    }
  } catch (error) {
    console.error('加载网站设置失败:', error)
  }
}

const handleLogin = async () => {
  if (!form.username.trim() || !form.password) {
    toast.error('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await authStore.login(form)
    toast.success('登录成功')
    router.push('/')
  } catch (error) {
    toast.error(error?.response?.data?.message || '登录失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadSiteSettings)
</script>
