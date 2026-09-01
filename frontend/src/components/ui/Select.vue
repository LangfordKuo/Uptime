<script setup>
import { computed } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

// 基于原生 select 的 shadcn 风格下拉（稳定可靠）
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] }, // [{ label, value }]
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
  class: { type: null, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const classes = computed(() =>
  cn(
    'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full appearance-none items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
    props.modelValue === '' || props.modelValue === null ? 'text-muted-foreground' : ''
  )
)

const rootClasses = computed(() => cn('relative', props.class))

const onChange = (e) => emit('update:modelValue', e.target.value)
</script>

<template>
  <div :class="rootClasses">
    <select :class="classes" :value="modelValue" :disabled="disabled" @change="onChange">
      <option value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <ChevronDown class="size-4 opacity-50 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
</template>
