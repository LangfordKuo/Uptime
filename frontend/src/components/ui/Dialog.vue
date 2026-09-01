<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps({
  open: { type: Boolean, default: false },
  class: { type: null, default: '' }
})
const emit = defineEmits(['update:open'])

const close = () => emit('update:open', false)

const onKeydown = (e) => {
  if (e.key === 'Escape') close()
}

watch(() => props.open, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="anim-overlay-in"
      leave-active-class="anim-overlay-out"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/50"
        @click="close"
      />
    </Transition>
    <Transition
      enter-active-class="anim-content-in"
      leave-active-class="anim-content-out"
    >
      <div
        v-if="open"
        role="dialog"
        :class="cn(
          'bg-background fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg max-h-[85vh] overflow-y-auto',
          props.class
        )"
        @click.stop
      >
        <slot />
        <button
          class="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none cursor-pointer"
          @click="close"
        >
          <X class="size-4" />
          <span class="sr-only">关闭</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
