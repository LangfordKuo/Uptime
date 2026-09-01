<script setup>
import { inject, computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  value: { type: String, required: true },
  class: { type: null, default: '' }
})

const current = inject('tabs-current')
const select = inject('tabs-select')
const active = computed(() => current.value === props.value)
</script>

<template>
  <button
    :data-state="active ? 'active' : 'inactive'"
    :class="cn(
      'data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-all data-[state=active]:shadow-sm hover:text-foreground cursor-pointer disabled:pointer-events-none disabled:opacity-50',
      props.class
    )"
    @click="select?.(props.value)"
  >
    <slot />
  </button>
</template>
