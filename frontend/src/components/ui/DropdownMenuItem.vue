<script setup>
import { cn } from '@/lib/utils'
const props = defineProps({
  destructive: { type: Boolean, default: false },
  class: { type: null, default: '' }
})
</script>

<template>
  <button
    data-dropdown-item
    :class="cn(
      destructive && 'text-destructive hover:bg-destructive/10',
      props.class
    )"
  >
    <slot />
  </button>
</template>
