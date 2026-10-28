<script setup lang="ts">
/** Индикатор автосохранения. Озвучивается скринридерами (role="status"). */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'

const store = useProgressStore()

const view = computed(() => {
  switch (store.saveStatus) {
    case 'pending':
      return { mark: 'pending', text: 'Сохраняю…' }
    case 'saved':
      return { mark: 'saved', text: 'Сохранено' }
    case 'error':
      return { mark: 'error', text: 'Не сохранено' }
    default:
      return { mark: 'idle', text: 'В этом браузере' }
  }
})
</script>

<template>
  <div class="save" :class="`save--${view.mark}`">
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle v-if="view.mark === 'pending'" cx="8" cy="8" r="5.5" class="ring" stroke-dasharray="3 2.2" />
      <path v-else-if="view.mark === 'error'" d="M8 2.5L14 13.5H2Z M8 6.5V9.5 M8 11.4V11.6" class="ring" />
      <template v-else>
        <circle cx="8" cy="8" r="5.5" class="ring" />
        <path v-if="view.mark === 'saved'" d="M5.4 8.2l1.8 1.8 3.4-3.6" class="ring" />
      </template>
    </svg>
    <span role="status" aria-live="polite">{{ view.text }}</span>
    <RouterLink v-if="store.saveStatus === 'error'" :to="{ name: 'data' }" class="save__help">
      Что делать?<span class="visually-hidden"> {{ store.saveMessage }}</span>
    </RouterLink>
  </div>
</template>

<style scoped>
.save {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--ink-soft);
  white-space: nowrap;
}
svg {
  width: 1rem;
  height: 1rem;
  flex: none;
}
.ring {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.save--saved {
  color: var(--moss);
}
.save--error {
  color: var(--accent);
  font-weight: 560;
}
.save__help {
  color: inherit;
}
</style>
