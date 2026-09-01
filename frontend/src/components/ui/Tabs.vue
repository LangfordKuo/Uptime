<script setup>
import { provide, ref, watch } from 'vue'

// 简洁的 Tabs 实现（shadcn 样式）
const props = defineProps({
  modelValue: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const current = ref(props.modelValue)
watch(() => props.modelValue, (v) => { current.value = v })

provide('tabs-current', current)
provide('tabs-select', (v) => {
  current.value = v
  emit('update:modelValue', v)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <slot />
  </div>
</template>
