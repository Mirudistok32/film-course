<script setup lang="ts">
/**
 * Условия завершения (уровня, фильма): значок-галочка дублируется словами
 * «выполнено» / «ещё нет», чтобы смысл не держался на цвете (ТЗ §34).
 */
import type { Criterion } from '@/domain/progress/progress.selectors'

defineProps<{ criteria: Criterion[] }>()
</script>

<template>
  <ul class="criteria">
    <li v-for="c in criteria" :key="c.id" class="criterion" :class="{ 'criterion--met': c.met }">
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="8" r="6.5" />
        <path v-if="c.met" d="M5 8.2l2 2 4-4.2" />
      </svg>
      <span>
        {{ c.label }}
        <span class="criterion__state">— {{ c.met ? 'выполнено' : 'ещё нет' }}<template v-if="c.detail && !c.met">, {{ c.detail }}</template></span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.criteria {
  display: grid;
  gap: 0.55rem;
  padding: 0;
  list-style: none;
}
.criterion {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  gap: 0.6rem;
  align-items: start;
}
.criterion svg {
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.2rem;
  fill: none;
  stroke: var(--line-strong);
  stroke-width: 1.5;
}
.criterion--met svg {
  stroke: var(--moss);
}
.criterion--met svg circle {
  fill: var(--moss-wash);
}
.criterion--met svg path {
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.criterion__state {
  color: var(--ink-soft);
  white-space: nowrap;
}
.criterion--met .criterion__state {
  color: var(--moss);
}

@media (max-width: 30rem) {
  .criterion__state {
    white-space: normal;
  }
}
</style>
