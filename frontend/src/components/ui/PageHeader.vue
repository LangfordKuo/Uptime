<script setup>
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import Button from './Button.vue'

const props = defineProps({
  title: { type: String, default: '' },
  backTo: { type: String, default: '' },
  class: { type: null, default: '' }
})

const router = useRouter()
const goBack = () => {
  if (props.backTo) router.push(props.backTo)
  else router.back()
}
</script>

<template>
  <div :class="cn('flex flex-wrap items-center gap-3 justify-between', props.class)">
    <div class="flex items-center gap-3 min-w-0">
      <Button v-if="backTo !== null" variant="ghost" size="icon" @click="goBack">
        <ArrowLeft />
      </Button>
      <div class="min-w-0">
        <h1 class="text-lg font-semibold tracking-tight truncate">{{ title }}</h1>
        <div v-if="$route.meta" class="text-sm text-muted-foreground"><slot name="subtitle" /></div>
      </div>
      <slot name="extra" />
    </div>
    <div class="flex items-center gap-2">
      <slot />
    </div>
  </div>
</template>
