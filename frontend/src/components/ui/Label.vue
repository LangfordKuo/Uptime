<script setup>
import { cn } from '@/lib/utils'
const props = defineProps({
  class: { type: null, default: '' },
  for: { type: String, default: undefined }
})
</script>

<template>
  <label
    :for="for"
    :class="cn('flex items-center gap-2 text-sm leading-none font-medium select-none', props.class)"
  >
    <slot />
  </label>
</template>
