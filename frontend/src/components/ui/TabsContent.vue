<script setup>
import { inject, computed } from 'vue'

const props = defineProps({
  value: { type: String, required: true }
})
const current = inject('tabs-current')
const active = computed(() => current.value === props.value)
</script>

<template>
  <div v-show="active">
    <slot />
  </div>
</template>
