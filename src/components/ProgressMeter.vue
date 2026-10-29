<script setup lang="ts">
/**
 * Прогресс словами и полосой (ТЗ §10, §33): подпись — главный носитель
 * смысла, полоса только дублирует её. При небольшом числе шагов полоса
 * рисуется кадрами плёнки — по кадру на фильм. Кадр, засвеченный на глазах
 * (значение выросло после появления полосы), один раз заливается слева
 * направо; при открытии страницы кадры просто горят. Если шаги идут
 * не по порядку, `lit` задаёт, какие именно кадры засвечены.
 */
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    max: number
    /** Видимая подпись, например «3 из 7 фильмов пройдены». */
    label: string
    /** До скольких шагов рисовать отдельные кадры. */
    frameLimit?: number
    /** Какие кадры засвечены, по порядку; без него — первые `value`. */
    lit?: readonly boolean[]
  }>(),
  { frameLimit: 16, lit: undefined },
)

const clamped = computed(() => Math.max(0, Math.min(props.value, props.max)))
const percent = computed(() => (props.max > 0 ? (clamped.value / props.max) * 100 : 0))
const frames = computed(() => (props.max > 0 && props.max <= props.frameLimit ? props.max : 0))

/** Засвечен ли кадр i (с единицы). */
const on = computed(() => Array.from({ length: frames.value }, (_, i) => props.lit?.[i] ?? i < clamped.value))

/** Номера кадров, засвеченных после появления полосы. */
const fresh = ref(new Set<number>())
watch(on, (now, before) => {
  const next = new Set([...fresh.value].filter((i) => now[i - 1]))
  now.forEach((lit, i) => {
    if (lit && !before[i]) next.add(i + 1)
  })
  fresh.value = next
})
</script>

<template>
  <div class="meter">
    <p class="meter__label">{{ label }}</p>
    <div v-if="frames" class="meter__frames" aria-hidden="true">
      <span
        v-for="i in frames"
        :key="i"
        class="frame"
        :class="{ 'frame--on': on[i - 1], 'frame--fresh': on[i - 1] && fresh.has(i) }"
      />
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
  /* Пустой кадр — заметная серая клетка плёнки в обеих темах. */
  --frame-empty: color-mix(in srgb, var(--intertitle-ink) 22%, var(--hero-bar));
  width: 1.15rem;
  height: 0.8rem;
  border-radius: 1.5px;
  background: var(--frame-empty);
}
/* Пройденный кадр — «засвеченный» пастелью, светлый в обеих темах. */
.frame--on {
  background: linear-gradient(135deg, var(--frame-lit-a), var(--frame-lit-b));
}
@media (prefers-reduced-motion: no-preference) {
  :root:not([data-reduced-motion='true']) .frame--fresh {
    background:
      linear-gradient(135deg, var(--frame-lit-a), var(--frame-lit-b)) left / 100% 100% no-repeat,
      var(--frame-empty);
    animation: frame-fill 480ms var(--ease) both;
  }
}
@keyframes frame-fill {
  from {
    background-size: 0 100%;
  }
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
