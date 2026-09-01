<template>
  <div class="flex min-h-screen bg-background">
    <!-- 侧边导航栏 -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-background transition-[width] duration-200"
      :class="isCollapsed ? 'w-16' : 'w-60'"
    >
      <div class="flex h-14 items-center justify-between border-b px-4">
        <router-link to="/" class="flex items-center gap-2 overflow-hidden">
          <Activity class="size-6 text-primary shrink-0" />
          <span v-if="!isCollapsed" class="text-lg font-bold tracking-tight truncate">Uptime</span>
        </router-link>
        <button
          class="text-muted-foreground hover:text-foreground hidden md:block cursor-pointer"
          @click="isCollapsed = !isCollapsed"
        >
          <PanelLeft :class="cn('size-5 transition-transform', isCollapsed && 'rotate-180')" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 p-2">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          :class="cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive(item.path)
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )"
          :title="item.title"
        >
          <component :is="item.icon" class="size-4 shrink-0" />
          <span v-if="!isCollapsed" class="truncate">{{ item.title }}</span>
        </router-link>
      </nav>

      <div class="border-t p-3">
        <DropdownMenu align="start">
          <button class="flex w-full items-center gap-2 rounded-md p-2 hover:bg-accent transition-colors cursor-pointer">
            <div class="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
              {{ authStore.user?.username?.charAt(0).toUpperCase() }}
            </div>
            <div v-if="!isCollapsed" class="flex-1 min-w-0 text-left">
              <div class="truncate text-sm font-medium">{{ authStore.user?.username }}</div>
              <div class="text-xs text-muted-foreground">{{ roleText }}</div>
            </div>
            <ChevronUp v-if="!isCollapsed" class="size-4 text-muted-foreground shrink-0" />
          </button>
          <template #content>
            <DropdownMenuItem data-dropdown-item @click="toggleDesktopNotify">
              <Bell class="size-4" />
              桌面通知：{{ monitorStore.desktopNotify ? '已开启' : '已关闭' }}
            </DropdownMenuItem>
            <DropdownMenuItem data-dropdown-item @click="theme.toggleDark()">
              <Sun v-if="theme.isDark()" class="size-4" />
              <Moon v-else class="size-4" />
              {{ theme.isDark() ? '切换亮色' : '切换暗色' }}
            </DropdownMenuItem>
            <div class="bg-border -mx-1 my-1 h-px" />
            <DropdownMenuItem v-if="authStore.isAdmin" data-dropdown-item @click="$router.push('/users')">
              <Users class="size-4" />
              用户管理
            </DropdownMenuItem>
            <DropdownMenuItem data-dropdown-item destructive @click="handleLogout">
              <LogOut class="size-4" />
              退出登录
            </DropdownMenuItem>
          </template>
        </DropdownMenu>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="flex-1 flex flex-col min-w-0 transition-[margin] duration-200" :class="isCollapsed ? 'md:ml-16' : 'md:ml-60'">
      <header class="flex h-14 items-center justify-between gap-4 border-b px-4 md:px-6">
        <div class="min-w-0">
          <h1 class="text-base font-semibold truncate">{{ pageTitle }}</h1>
          <p class="text-xs text-muted-foreground truncate">{{ pageSubtitle }}</p>
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            :title="theme.isDark() ? '切换亮色' : '切换暗色'"
            @click="theme.toggleDark()"
          >
            <Sun v-if="theme.isDark()" class="size-4" />
            <Moon v-else class="size-4" />
          </Button>
          <Button v-if="showCreateButton" @click="$router.push('/monitors/create')">
            <Plus />
            新建监控
          </Button>
        </div>
      </header>

      <main class="flex-1 p-4 md:p-6">
        <router-view />
      </main>

      <footer class="border-t py-4 text-center text-xs text-muted-foreground">
        Powered by
        <a
          href="https://github.com/LangfordKuo/Uptime"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-foreground hover:underline underline-offset-2"
        >Uptime Monitor</a>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Activity, PanelLeft, ChevronUp, Bell, Sun, Moon, Users, LogOut, Plus,
  LayoutDashboard, FileText, Settings, SquarePlus
} from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import { useMonitorStore } from '@/stores/monitor'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import Button from '@/components/ui/Button.vue'
import DropdownMenu from '@/components/ui/DropdownMenu.vue'
import DropdownMenuItem from '@/components/ui/DropdownMenuItem.vue'

const route = useRoute()
const router = useRouter()
const monitorStore = useMonitorStore()
const authStore = useAuthStore()
const theme = useTheme()

const isCollapsed = ref(false)

const menuItems = computed(() => {
  const items = [
    { path: '/', title: '仪表盘', icon: LayoutDashboard }
  ]
  if (authStore.isAdmin) {
    items.push({ path: '/status-pages', title: '状态页管理', icon: FileText })
    items.push({ path: '/system-settings', title: '系统管理', icon: Settings })
  }
  items.push({ path: '/monitors/create', title: '新建监控', icon: SquarePlus })
  return items
})

const isActive = (path) => {
  if (path === '/') return route.path === '/'
  if (path === '/monitors/create') return route.path === '/monitors/create'
  return false
}

const roleText = computed(() => {
  const map = { admin: '管理员', user: '用户', viewer: '访客' }
  return map[authStore.user?.role] || ''
})

const pageTitle = computed(() => {
  if (route.path === '/monitors/create') return '新建监控'
  if (route.params?.id) return '监控详情'
  const map = {
    '/': '仪表盘',
    '/users': '用户管理',
    '/status-pages': '状态页管理',
    '/system-settings': '系统管理'
  }
  return map[route.path] || 'Uptime'
})

const pageSubtitle = computed(() => {
  const map = {
    '/': '查看所有服务的运行状态',
    '/monitors/create': '添加新的服务监控',
    '/users': '管理系统用户',
    '/status-pages': '管理公开状态页面',
    '/system-settings': '站点、通知、密钥与备份'
  }
  return map[route.path] || ''
})

const showCreateButton = computed(() =>
  route.path === '/' && (authStore.isAdmin || authStore.isUser)
)

const toggleDesktopNotify = async () => {
  const enabled = !monitorStore.desktopNotify
  if (enabled && 'Notification' in window && Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      toast.error('浏览器拒绝了通知权限')
      return
    }
  }
  monitorStore.setDesktopNotify(enabled)
  toast.success(enabled ? '已开启故障桌面通知' : '已关闭桌面通知')
}

const handleLogout = async () => {
  const ok = await confirm({ title: '退出登录', description: '确定要退出当前账户吗？' })
  if (!ok) return
  authStore.logout()
  router.push('/login')
}

onMounted(() => {
  monitorStore.initSocket()
})

onUnmounted(() => {
  monitorStore.disconnectSocket()
})
</script>
