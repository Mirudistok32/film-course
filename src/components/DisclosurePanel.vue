<script setup lang="ts">
/**
 * Раскрывающийся блок на нативных <details>/<summary>: работает с клавиатуры
 * и скринридерами без дополнительного кода. Для спойлеров и образцов разбора
 * (ТЗ §34: раскрываются только по действию пользователя).
 */
import { ref } from 'vue'

withDefaults(
  defineProps<{
    summary: string
    /** Пометка «спойлер» рядом с заголовком. */
    spoiler?: boolean
    open?: boolean
  }>(),
  { spoiler: false, open: false },
)

const emit = defineEmits<{ open: [] }>()
const opened = ref(false)

function onToggle(event: Event) {
  const el = event.target as HTMLDetailsElement
  if (el.open && !opened.value) {
    opened.value = true
    emit('open')
  }
}
</script>

<template>
  <details class="disclosure" :open="open" @toggle="onToggle">
    <summary class="disclosure__summary">
      <svg class="disclosure__mark" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M6 3.5L10.5 8L6 12.5" />
      </svg>
      <span class="disclosure__title">{{ summary }}</span>
      <span v-if="spoiler" class="disclosure__spoiler">спойлер</span>
    </summary>
    <div class="disclosure__body">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.disclosure {
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.disclosure + .disclosure {
  border-top: 0;
}
.disclosure__summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 3rem;
  padding: 0.5rem 0.25rem;
  cursor: pointer;
  list-style: none;
  font-weight: 560;
}
.disclosure__summary::-webkit-details-marker {
  display: none;
}
.disclosure__summary:hover .disclosure__title {
  color: var(--accent);
}
.disclosure__mark {
  width: 1rem;
  height: 1rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform var(--dur) var(--ease);
}
.disclosure[open] > .disclosure__summary .disclosure__mark {
  transform: rotate(90deg);
}
.disclosure__spoiler {
  margin-left: auto;
  padding: 0 0.5em;
  border: 1px solid var(--accent);
  border-radius: var(--radius-s);
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}
.disclosure__body {
  padding: 0.25rem 0.25rem 1.25rem 1.85rem;
}
</style>
