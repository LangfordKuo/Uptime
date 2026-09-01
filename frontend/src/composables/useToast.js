import { reactive } from 'vue'

// 轻量 toast 通知（替代 ElMessage）
export const toasts = reactive([])
let id = 0

function push(type, message, duration = 3000) {
  const item = { id: ++id, type, message }
  toasts.push(item)
  if (toasts.length > 5) toasts.shift()
  setTimeout(() => {
    const idx = toasts.findIndex(t => t.id === item.id)
    if (idx !== -1) toasts.splice(idx, 1)
  }, duration)
}

export const toast = {
  success: (msg, d) => push('success', msg, d),
  error: (msg, d) => push('error', msg, d || 4000),
  info: (msg, d) => push('info', msg, d)
}
