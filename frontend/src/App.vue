<script setup>
import Toaster from '@/components/ui/Toaster.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
</script>

<template>
  <router-view />
  <Toaster />
  <ConfirmDialog />
</template>
