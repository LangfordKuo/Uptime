<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { cn } from '@/lib/utils'

// 轻量下拉菜单：默认插槽放触发按钮，#content 放菜单项
const props = defineProps({
  align: { type: String, default: 'end' }, // start | end
  class: { type: null, default: '' }
})

const open = ref(false)
const root = ref(null)

const onOutside = (e) => {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onOutside))
onBeforeUnmount(() => document.removeEventListener('click', onOutside))
</script>

<template>
  <div ref="root" class="relative">
    <div @click="open = !open">
      <slot />
    </div>
    <div
      v-if="open"
      :class="cn(
        'bg-popover text-popover-foreground anim-menu-in absolute z-50 mt-1 min-w-40 rounded-md border p-1 shadow-md',
        align === 'end' ? 'right-0' : 'left-0',
        props.class
      )"
      @click="open = false"
    >
      <slot name="content" />
    </div>
  </div>
</template>

<style scoped>
:slotted([data-dropdown-item]) {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.5rem;
  border-radius: calc(var(--radius) - 4px);
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  text-align: left;
}
:slotted([data-dropdown-item]:hover) {
  background: var(--accent);
}
</style>
