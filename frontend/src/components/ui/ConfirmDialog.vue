<script setup>
import Dialog from './Dialog.vue'
import DialogHeader from './DialogHeader.vue'
import DialogTitle from './DialogTitle.vue'
import DialogDescription from './DialogDescription.vue'
import DialogFooter from './DialogFooter.vue'
import Button from './Button.vue'
import { confirmState, settleConfirm } from '@/composables/useConfirm'
</script>

<template>
  <Dialog :open="confirmState.open" @update:open="(v) => !v && settleConfirm(false)" class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{{ confirmState.title }}</DialogTitle>
      <DialogDescription class="whitespace-pre-line">{{ confirmState.description }}</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" @click="settleConfirm(false)">{{ confirmState.cancelText }}</Button>
      <Button
        :variant="confirmState.destructive ? 'destructive' : 'default'"
        @click="settleConfirm(true)"
      >
        {{ confirmState.confirmText }}
      </Button>
    </DialogFooter>
  </Dialog>
</template>
