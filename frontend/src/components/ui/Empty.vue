<script setup>
import { PackageOpen } from 'lucide-vue-next'
const props = defineProps({
  description: { type: String, default: '暂无数据' }
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
    <PackageOpen class="size-10 text-muted-foreground/50" />
    <p class="text-sm text-muted-foreground">{{ description }}</p>
    <slot />
  </div>
</template>
