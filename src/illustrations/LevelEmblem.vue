<script setup lang="ts">
import { computed } from 'vue'
import { EMBLEMS } from './emblems'

const props = withDefaults(
  defineProps<{
    level: number
    /** Подпись для скринридеров; без неё эмблема декоративная. */
    label?: string
  }>(),
  { label: '' },
)

const emblem = computed(() => EMBLEMS[props.level] ?? EMBLEMS[1]!)
</script>

<template>
  <svg
    class="level-emblem"
    viewBox="0 0 64 64"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  >
    <circle cx="32" cy="32" r="30.5" class="ring" />
    <circle cx="32" cy="32" r="27.5" class="ring fine" />
    <g class="main">
      <path v-for="(d, i) in emblem.main" :key="`m${i}`" :d="d" />
    </g>
    <g class="fine">
      <path v-for="(d, i) in emblem.fine ?? []" :key="`f${i}`" :d="d" />
    </g>
    <g class="solid">
      <path v-for="(d, i) in emblem.solid ?? []" :key="`s${i}`" :d="d" />
      <circle v-for="(c, i) in emblem.dots ?? []" :key="`d${i}`" :cx="c[0]" :cy="c[1]" :r="c[2]" />
    </g>
  </svg>
</template>

<style scoped>
.level-emblem {
  width: var(--emblem-size, 3.5rem);
  height: var(--emblem-size, 3.5rem);
  flex: none;
  color: var(--ink);
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ring {
  stroke-width: 1.6;
}
.main {
  stroke-width: 2.3;
}
.fine {
  stroke-width: 1.1;
  opacity: 0.8;
}
.solid {
  fill: currentColor;
  stroke: none;
}
</style>
