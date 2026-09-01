<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import Badge from './badge.js'

// 多选下拉：按钮触发 + 复选列表 + 点击外部关闭
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, default: () => [] }, // [{ label, value }]
  placeholder: { type: String, default: '请选择' },
  emptyText: { type: String, default: '暂无可选项' },
  class: { type: null, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)

const toggleOption = (value) => {
  const next = props.modelValue.includes(value)
    ? props.modelValue.filter(v => v !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}

const selectedLabels = computed(() =>
  props.options
    .filter(o => props.modelValue.includes(o.value))
    .map(o => o.label)
)

const onOutside = (e) => {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('click', onOutside))
onBeforeUnmount(() => document.removeEventListener('click', onOutside))
</script>

<template>
  <div ref="root" class="relative w-full">
    <button
      type="button"
      :class="cn(
        'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 min-h-9 w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm shadow-xs outline-none focus-visible:ring-[3px] cursor-pointer min-h-9 h-auto',
        props.class
      )"
      @click="open = !open"
    >
      <span v-if="selectedLabels.length === 0" class="text-muted-foreground">{{ placeholder }}</span>
      <span v-else class="flex flex-wrap gap-1 py-0.5">
        <Badge v-for="label in selectedLabels.slice(0, 6)" :key="label" variant="secondary">{{ label }}</Badge>
        <Badge v-if="selectedLabels.length > 6" variant="secondary">+{{ selectedLabels.length - 6 }}</Badge>
      </span>
      <ChevronDown class="size-4 opacity-50 shrink-0" />
    </button>

    <div
      v-if="open"
      class="bg-popover text-popover-foreground anim-menu-in absolute z-50 mt-1 w-full rounded-md border p-1 shadow-md max-h-64 overflow-y-auto"
    >
      <div v-if="options.length === 0" class="py-4 text-center text-sm text-muted-foreground">
        {{ emptyText }}
      </div>
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer text-left"
        @click="toggleOption(opt.value)"
      >
        <span class="flex size-4 items-center justify-center">
          <Check v-if="modelValue.includes(opt.value)" class="size-4" />
        </span>
        <span>{{ opt.label }}</span>
      </button>
    </div>
  </div>
</template>
