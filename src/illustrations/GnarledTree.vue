<script setup lang="ts">
/**
 * Корявое дерево как самостоятельная иллюстрация. Внутри другой SVG
 * используйте drawTree напрямую (см. HeroScene.vue).
 */
import { computed } from 'vue'
import { drawTree } from './tree'

const props = withDefaults(
  defineProps<{
    seed: string | number
    depth?: number
    lean?: number
    /** Подпись для скринридеров; без неё рисунок декоративный. */
    label?: string
  }>(),
  { depth: 6, lean: 0, label: '' },
)

const tree = computed(() =>
  drawTree({ seed: props.seed, x: 100, y: 188, height: 165, depth: props.depth, lean: props.lean }),
)
</script>

<template>
  <svg
    class="gnarled-tree"
    viewBox="0 0 200 200"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
  >
    <g fill="currentColor">
      <path v-for="(d, i) in tree.limbs" :key="`l${i}`" :d="d" />
    </g>
    <g fill="none" stroke="currentColor" stroke-width="0.9" stroke-linecap="round">
      <path v-for="(d, i) in tree.twigs" :key="`t${i}`" :d="d" />
    </g>
    <g fill="none" stroke="var(--paper)" stroke-width="0.9" opacity="0.55">
      <path v-for="(d, i) in tree.knots" :key="`k${i}`" :d="d" />
    </g>
  </svg>
</template>

<style scoped>
.gnarled-tree {
  width: 100%;
  height: auto;
  color: var(--ink);
}
</style>
