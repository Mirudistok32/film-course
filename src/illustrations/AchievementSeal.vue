<script setup lang="ts">
/**
 * Значок достижения. Форма — по группе (печать, ромб, щит, восьмиугольник),
 * открытый значок — оттиск киноварью, закрытый — пунктирный контур.
 * Декоративный: группа и статус всегда написаны словами рядом.
 */
import { computed, useId } from 'vue'
import type { AchievementFigure } from '@/domain/rewards/rewards.config'

const props = withDefaults(defineProps<{ figure: AchievementFigure; unlocked?: boolean; tilt?: number }>(), {
  unlocked: false,
  tilt: -6,
})

const OUTLINE: Record<AchievementFigure, string> = {
  circle: 'M32 5a27 27 0 1 1 0 54a27 27 0 1 1 0-54Z',
  diamond: 'M32 3L61 32L32 61L3 32Z',
  shield: 'M32 4L56 12V30C56 45 46 54.5 32 60C18 54.5 8 45 8 30V12Z',
  octagon: 'M42.7 6.1L57.9 21.3V42.7L42.7 57.9H21.3L6.1 42.7V21.3L21.3 6.1Z',
}

const uid = useId()
const d = computed(() => OUTLINE[props.figure])
</script>

<template>
  <svg class="seal" :class="{ 'seal--on': unlocked }" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs v-if="unlocked">
      <filter :id="`${uid}-rough`" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" />
      </filter>
    </defs>
    <g v-if="unlocked" :transform="`rotate(${tilt} 32 32)`" :filter="`url(#${uid}-rough)`">
      <path :d="d" class="outer" />
      <path :d="d" class="inner" transform="translate(32 32) scale(0.8) translate(-32 -32)" />
      <path d="M32 19C33 29 35 31 45 32C35 33 33 35 32 45C31 35 29 33 19 32C29 31 31 29 32 19Z" class="spark" />
    </g>
    <g v-else>
      <path :d="d" class="outer outer--off" />
      <circle cx="32" cy="32" r="3.5" class="dot" />
    </g>
  </svg>
</template>

<style scoped>
.seal {
  width: var(--seal-size, 3.5rem);
  height: var(--seal-size, 3.5rem);
  flex: none;
  color: var(--line-strong);
}
.seal--on {
  color: var(--accent);
}
.outer {
  fill: var(--accent-wash);
  stroke: currentColor;
  stroke-width: 3;
  stroke-linejoin: round;
}
.outer--off {
  fill: none;
  stroke-width: 1.6;
  stroke-dasharray: 3 3.5;
}
.inner {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linejoin: round;
}
.spark {
  fill: currentColor;
}
.dot {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
}
</style>
