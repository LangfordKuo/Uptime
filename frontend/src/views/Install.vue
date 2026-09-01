<template>
  <div class="flex min-h-screen items-center justify-center bg-background p-4">
    <div class="w-full max-w-md">
      <div class="mb-8 flex flex-col items-center gap-2 text-center">
        <div class="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
          <Activity class="size-6" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight">系统安装</h1>
        <p class="text-sm text-muted-foreground">Uptime Monitor 首次安装配置</p>
      </div>

      <Card>
        <!-- 步骤 1：欢迎 -->
        <template v-if="step === 0">
          <CardHeader class="items-center text-center">
            <CardTitle class="text-xl">欢迎使用 Uptime Monitor</CardTitle>
            <CardDescription>
              感谢选择 Uptime Monitor 服务监控系统。<br />
              在开始使用之前，您需要创建一个管理员账户。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button class="w-full" @click="step = 1">
              开始安装
              <ArrowRight />
            </Button>
          </CardContent>
        </template>

        <!-- 步骤 2：创建管理员 -->
        <template v-else-if="step === 1">
          <CardHeader>
            <CardTitle class="text-xl">创建管理员账户</CardTitle>
            <CardDescription>该账户拥有系统最高管理权限</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label for="username">用户名</Label>
              <Input id="username" v-model="form.username" placeholder="3-50 个字符" />
            </div>
            <div class="space-y-2">
              <Label for="email">邮箱</Label>
              <Input id="email" v-model="form.email" type="email" placeholder="admin@example.com" />
            </div>
            <div class="space-y-2">
              <Label for="password">密码</Label>
              <Input id="password" v-model="form.password" type="password" placeholder="至少 6 位" />
            </div>
            <div class="space-y-2">
              <Label for="confirmPassword">确认密码</Label>
              <Input id="confirmPassword" v-model="form.confirmPassword" type="password" placeholder="再次输入密码" />
            </div>
            <Alert v-if="formError" variant="destructive">
              <CircleAlert />
              <AlertDescription>{{ formError }}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter class="flex justify-between">
            <Button variant="ghost" @click="step = 0">上一步</Button>
            <Button :loading="installing" @click="handleInstall">开始安装</Button>
          </CardFooter>
        </template>

        <!-- 步骤 3：完成 -->
        <template v-else>
          <CardHeader class="items-center text-center">
            <div class="bg-success/10 text-success mx-auto flex size-12 items-center justify-center rounded-full">
              <CircleCheck class="size-6" />
            </div>
            <CardTitle class="text-xl">安装成功</CardTitle>
            <CardDescription>
              管理员账户 <strong>{{ form.username }}</strong> 已创建，监控服务已自动启动。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button class="w-full" @click="$router.push('/login')">
              前往登录
              <ArrowRight />
            </Button>
          </CardContent>
        </template>
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
import { reactive, ref } from 'vue'
import { Activity, ArrowRight, CircleAlert, CircleCheck } from 'lucide-vue-next'
import { installApi } from '@/api'
import { toast } from '@/composables/useToast'
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card.js'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Alert, { AlertDescription } from '@/components/ui/alert.js'

const step = ref(0)
const installing = ref(false)
const formError = ref('')

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const handleInstall = async () => {
  formError.value = ''
  if (form.username.trim().length < 3) {
    formError.value = '用户名长度至少 3 个字符'
    return
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
    formError.value = '请输入正确的邮箱地址'
    return
  }
  if (form.password.length < 6) {
    formError.value = '密码长度至少 6 位'
    return
  }
  if (form.password !== form.confirmPassword) {
    formError.value = '两次密码输入不一致'
    return
  }

  installing.value = true
  try {
    const res = await installApi.install(form)
    if (res.success) {
      step.value = 2
    }
  } catch (error) {
    toast.error(error?.response?.data?.message || '安装失败')
  } finally {
    installing.value = false
  }
}
</script>
