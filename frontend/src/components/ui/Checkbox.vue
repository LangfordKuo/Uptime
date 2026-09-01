<script setup>
import { Check, Minus } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps({
  modelValue: { type: [Boolean, String], default: false }, // true/false/'indeterminate'
  disabled: { type: Boolean, default: false },
  class: { type: null, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const toggle = () => {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="modelValue === 'indeterminate' ? 'mixed' : !!modelValue"
    :data-state="modelValue === 'indeterminate' ? 'indeterminate' : modelValue ? 'checked' : 'unchecked'"
    :disabled="disabled"
    :class="cn(
      'peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground focus-visible:ring-ring/50 size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer flex items-center justify-center',
      props.class
    )"
    @click="toggle"
  >
    <Check v-if="modelValue === true" class="size-3" />
    <Minus v-else-if="modelValue === 'indeterminate'" class="size-3" />
  </button>
</template>
