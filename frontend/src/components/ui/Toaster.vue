<script setup>
import { toasts } from '@/composables/useToast'
import { CircleCheck, CircleX, Info } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const icons = { success: CircleCheck, error: CircleX, info: Info }
const styles = {
  success: 'border-success/30 text-success',
  error: 'border-destructive/30 text-destructive',
  info: 'border-border text-foreground'
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      <div
        v-for="item in toasts"
        :key="item.id"
        :class="cn(
          'anim-toast-in pointer-events-auto flex items-start gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg',
          styles[item.type]
        )"
      >
        <component :is="icons[item.type]" class="size-4 mt-0.5 shrink-0" />
        <div class="text-sm">{{ item.message }}</div>
      </div>
    </div>
  </Teleport>
</template>
