import { ref } from 'vue'

// 主题管理：亮/暗/跟随系统 + 强调色（shadcn oklch 色板）
const THEME_KEY = 'shadcn_theme'
const ACCENT_KEY = 'shadcn_accent'

const theme = ref(localStorage.getItem(THEME_KEY) || 'system')
const accent = ref(localStorage.getItem(ACCENT_KEY) || 'zinc')

export const ACCENTS = [
  { value: 'zinc', label: '经典黑', primary: 'oklch(0.205 0 0)', primaryDark: 'oklch(0.922 0 0)', ring: 'oklch(0.708 0 0)' },
  { value: 'blue', label: '科技蓝', primary: 'oklch(0.546 0.245 262.881)', primaryDark: 'oklch(0.623 0.214 259.815)', ring: 'oklch(0.623 0.214 259.815)' },
  { value: 'green', label: '自然绿', primary: 'oklch(0.596 0.145 163.225)', primaryDark: 'oklch(0.696 0.17 162.48)', ring: 'oklch(0.696 0.17 162.48)' },
  { value: 'violet', label: '优雅紫', primary: 'oklch(0.541 0.281 293.009)', primaryDark: 'oklch(0.606 0.25 292.717)', ring: 'oklch(0.606 0.25 292.717)' },
  { value: 'orange', label: '活力橙', primary: 'oklch(0.646 0.222 41.116)', primaryDark: 'oklch(0.705 0.213 47.604)', ring: 'oklch(0.705 0.213 47.604)' }
]

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function apply() {
  const root = document.documentElement
  const dark = theme.value === 'dark' || (theme.value === 'system' && systemPrefersDark())
  root.classList.toggle('dark', dark)

  const preset = ACCENTS.find(a => a.value === accent.value) || ACCENTS[0]
  root.style.setProperty('--primary', dark ? preset.primaryDark : preset.primary)
  root.style.setProperty('--ring', preset.ring)
}

// 跟随系统的实时切换
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (theme.value === 'system') apply()
})

export function useTheme() {
  const setTheme = (value) => {
    theme.value = value
    localStorage.setItem(THEME_KEY, value)
    apply()
  }
  const setAccent = (value) => {
    accent.value = value
    localStorage.setItem(ACCENT_KEY, value)
    apply()
  }
  const toggleDark = () => {
    const dark = theme.value === 'dark' || (theme.value === 'system' && systemPrefersDark())
    setTheme(dark ? 'light' : 'dark')
  }
  const isDark = () =>
    theme.value === 'dark' || (theme.value === 'system' && systemPrefersDark())

  return { theme, accent, setTheme, setAccent, toggleDark, isDark }
}

// 应用启动时立即应用
apply()
