import { reactive } from 'vue'

// 全局确认对话框状态（由 ConfirmDialog.vue 渲染）
export const confirmState = reactive({
  open: false,
  title: '',
  description: '',
  confirmText: '确定',
  cancelText: '取消',
  destructive: false
})

let resolver = null

// 用法: const ok = await confirm({ title, description, destructive })
export function confirm(options = {}) {
  confirmState.title = options.title || '确认操作'
  confirmState.description = options.description || ''
  confirmState.confirmText = options.confirmText || '确定'
  confirmState.cancelText = options.cancelText || '取消'
  confirmState.destructive = options.destructive || false
  confirmState.open = true
  return new Promise((resolve) => {
    resolver = resolve
  })
}

export function settleConfirm(value) {
  confirmState.open = false
  resolver?.(value)
  resolver = null
}
