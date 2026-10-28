<script setup lang="ts">
/**
 * Статус фильма или уровня: значок разной формы + текст.
 * Смысл не передаётся только цветом (ТЗ §34).
 */
import { computed } from 'vue'
import {
  FILM_STATUS_LABEL,
  LEVEL_STATUS_LABEL,
  type FilmDisplayStatus,
  type LevelStatus,
} from '@/domain/progress/progress.selectors'

type Shape = 'empty' | 'half' | 'dot' | 'done' | 'again' | 'lock'

/** Передайте ровно одно: статус фильма или статус уровня. */
const props = defineProps<{ film?: FilmDisplayStatus; level?: LevelStatus }>()

const FILM_SHAPE: Record<FilmDisplayStatus, Shape> = {
  'not-started': 'empty',
  started: 'half',
  watched: 'dot',
  completed: 'done',
  reviewing: 'again',
}
const LEVEL_SHAPE: Record<LevelStatus, Shape> = {
  locked: 'lock',
  available: 'empty',
  'in-progress': 'half',
  completed: 'done',
  review: 'again',
}

const view = computed(() =>
  props.level
    ? { shape: LEVEL_SHAPE[props.level], text: LEVEL_STATUS_LABEL[props.level] }
    : { shape: FILM_SHAPE[props.film ?? 'not-started'], text: FILM_STATUS_LABEL[props.film ?? 'not-started'] },
)
</script>

<template>
  <span class="badge" :class="`badge--${view.shape}`">
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <template v-if="view.shape === 'lock'">
        <rect x="3" y="7" width="10" height="7" rx="1.5" class="fill" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" class="line" />
      </template>
      <template v-else>
        <circle cx="8" cy="8" r="6" class="line" />
        <path v-if="view.shape === 'half'" d="M8 2a6 6 0 0 1 0 12Z" class="fill" />
        <circle v-if="view.shape === 'dot'" cx="8" cy="8" r="2.6" class="fill" />
        <template v-if="view.shape === 'done' || view.shape === 'again'">
          <circle cx="8" cy="8" r="6" class="fill" />
          <path v-if="view.shape === 'done'" d="M5 8.2l2 2 4-4.2" class="check" />
          <path v-else d="M10.8 6.2A3.2 3.2 0 1 0 11 9.2M10.8 4v2.4H8.5" class="check" />
        </template>
      </template>
    </svg>
    <span>{{ view.text }}</span>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.15em 0.6em 0.15em 0.45em;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--ink-soft);
  background: var(--paper-raised);
  white-space: nowrap;
}
svg {
  width: 1em;
  height: 1em;
  flex: none;
}
.line {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.fill {
  fill: currentColor;
}
.check {
  fill: none;
  stroke: var(--paper-raised);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.badge--half,
.badge--dot {
  color: var(--tint-butter-ink);
  border-color: color-mix(in srgb, currentColor 45%, transparent);
  background: var(--tint-butter);
}
.badge--done,
.badge--again {
  color: var(--tint-mint-ink);
  border-color: color-mix(in srgb, currentColor 45%, transparent);
  background: var(--tint-mint);
}
.badge--done .check,
.badge--again .check {
  stroke: var(--tint-mint);
}
.badge--lock {
  background: var(--paper-sunken);
}
</style>
