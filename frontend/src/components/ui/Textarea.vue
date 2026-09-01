<script setup>
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  modelValue: { type: String, default: '' },
  class: { type: null, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const classes = computed(() =>
  cn(
    'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
    props.class
  )
)

const onInput = (e) => emit('update:modelValue', e.target.value)
</script>

<template>
  <textarea :class="classes" :value="modelValue" @input="onInput" />
</template>
