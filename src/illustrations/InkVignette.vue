<script setup lang="ts">
/**
 * Виньетки для пустых состояний и страницы 404 — небольшие рисунки тушью.
 * Всегда декоративные: смысл передаёт текст рядом.
 */
import { computed } from 'vue'
import { drawTree } from './tree'

export type VignetteName = 'notebook' | 'signpost' | 'sprout' | 'reel'

const props = defineProps<{ name: VignetteName }>()

/** Маленькое дерево рядом со столбом — тот же генератор, что и в заставке. */
const tree = computed(() =>
  props.name === 'signpost' ? drawTree({ seed: 'lost-tree', x: 34, y: 92, height: 70, depth: 5, lean: -0.15, roots: false }) : null,
)
</script>

<template>
  <svg class="vignette" viewBox="0 0 160 100" aria-hidden="true" focusable="false">
    <path class="ground" d="M8 92Q80 86 152 92" />

    <g v-if="name === 'notebook'">
      <path class="main" d="M30 80L80 72L130 80V36L80 28L30 36Z" />
      <path class="main" d="M80 28V72" />
      <path class="fine" d="M40 44L72 39M40 52L72 47M40 60L66 56M88 39L120 44M88 47L118 52" />
      <path class="main" d="M112 58L146 14" />
      <path class="fine" d="M146 14Q150 22 140 30Q136 26 146 14Z" />
      <path class="solid" d="M112 58L110 64L115 60Z" />
    </g>

    <g v-else-if="name === 'signpost'">
      <g v-if="tree" class="solid">
        <path v-for="(d, i) in tree.limbs" :key="`l${i}`" :d="d" />
      </g>
      <g v-if="tree" class="fine">
        <path v-for="(d, i) in tree.twigs" :key="`t${i}`" :d="d" />
      </g>
      <path class="main" d="M100 92L98 30" />
      <path class="main" d="M84 36L120 32L126 38L120 44L86 47Z" />
      <path class="main" d="M112 54L80 52L74 58L80 64L112 63Z" />
      <path class="fine" d="M92 41H112M86 58H104" />
    </g>

    <g v-else-if="name === 'sprout'">
      <path class="main" d="M80 90Q79 72 81 58" />
      <path class="main" d="M81 64Q66 62 60 48Q74 46 81 60" />
      <path class="main" d="M81 58Q90 44 106 44Q102 60 82 62" />
      <path class="fine" d="M66 50Q72 54 79 59M100 47Q92 52 84 59" />
      <path class="fine" d="M60 92Q70 88 80 90Q90 88 100 92" />
    </g>

    <g v-else>
      <circle class="main" cx="62" cy="50" r="30" />
      <circle class="main" cx="62" cy="50" r="6" />
      <circle class="fine" cx="62" cy="34" r="7" />
      <circle class="fine" cx="62" cy="66" r="7" />
      <circle class="fine" cx="46" cy="50" r="7" />
      <circle class="fine" cx="78" cy="50" r="7" />
      <path class="main" d="M88 64Q110 74 120 62Q130 50 150 58" />
      <path class="fine" d="M96 68L98 63M104 70L106 65M112 69L114 64" />
    </g>
  </svg>
</template>

<style scoped>
.vignette {
  width: var(--vignette-size, 10rem);
  height: auto;
  color: var(--ink-soft);
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.ground {
  stroke-width: 1.2;
  opacity: 0.6;
}
.main {
  stroke-width: 2;
}
.fine {
  stroke-width: 1;
}
.solid {
  fill: currentColor;
  stroke: none;
}
</style>
