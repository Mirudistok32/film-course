<script setup lang="ts">
/**
 * Прогресс словами и полосой (ТЗ §10, §33): подпись — главный носитель
 * смысла, полоса только дублирует её. При небольшом числе шагов полоса
 * рисуется кадрами плёнки — по кадру на фильм.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    max: number
    /** Видимая подпись, например «3 из 7 фильмов пройдены». */
    label: string
    /** До скольких шагов рисовать отдельные кадры. */
    frameLimit?: number
  }>(),
  { frameLimit: 16 },
)

const clamped = computed(() => Math.max(0, Math.min(props.value, props.max)))
const percent = computed(() => (props.max > 0 ? (clamped.value / props.max) * 100 : 0))
const frames = computed(() => (props.max > 0 && props.max <= props.frameLimit ? props.max : 0))
</script>

<template>
  <div class="meter">
    <p class="meter__label">{{ label }}</p>
    <div v-if="frames" class="meter__frames" aria-hidden="true">
      <span v-for="i in frames" :key="i" class="frame" :class="{ 'frame--on': i <= clamped }" />
    </div>
    <div v-else class="meter__bar" aria-hidden="true">
      <span class="meter__fill" :style="{ width: `${percent}%` }" />
    </div>
  </div>
</template>

<style scoped>
.meter {
  display: grid;
  gap: 0.4rem;
}
.meter__label {
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.meter__frames {
  display: flex;
  gap: 3px;
  padding: 4px;
  background: var(--hero-bar);
  border-radius: 2px;
  width: fit-content;
  max-width: 100%;
  flex-wrap: wrap;
}
.frame {
  width: 1.15rem;
  height: 0.8rem;
  border-radius: 1.5px;
  background: color-mix(in srgb, var(--intertitle-ink) 14%, var(--hero-bar));
}
/* Пройденный кадр — «засвеченный» пастелью, светлый в обеих темах. */
.frame--on {
  background: linear-gradient(135deg, var(--frame-lit-a), var(--frame-lit-b));
}
.meter__bar {
  height: 0.55rem;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  overflow: hidden;
  background: var(--paper-sunken);
}
.meter__fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--tint-rose-ink), var(--tint-lavender-ink), var(--tint-sky-ink));
  border-radius: inherit;
  transition: width var(--dur) var(--ease);
}
</style>
