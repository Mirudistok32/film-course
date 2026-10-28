<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import { useAppearance } from '@/composables/useAppearance'

useAppearance()
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>
