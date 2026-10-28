<script setup lang="ts">
/**
 * Печать-ханко «пройдено»: киноварь, неровный оттиск, слегка повёрнута.
 * Текст печати дублируется для скринридеров через aria-label.
 */
import { useId } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Текст по окружности. */
    text?: string
    /** Крупный знак в центре: номер уровня или короткое слово. */
    center?: string
    /** Поворот в градусах. */
    tilt?: number
  }>(),
  { text: 'пройдено', center: '✓', tilt: -8 },
)

const uid = useId()
</script>

<template>
  <svg class="hanko" viewBox="0 0 100 100" role="img" :aria-label="`Печать: ${props.text}`" focusable="false">
    <defs>
      <filter :id="`${uid}-rough`" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" />
      </filter>
      <path :id="`${uid}-arc`" d="M18 50A32 32 0 1 1 82 50" />
    </defs>
    <g :transform="`rotate(${tilt} 50 50)`" :filter="`url(#${uid}-rough)`">
      <circle cx="50" cy="50" r="45" class="ring" />
      <circle cx="50" cy="50" r="40" class="ring thin" />
      <text class="arc-text">
        <textPath :href="`#${uid}-arc`" startOffset="50%" text-anchor="middle">{{ text }}</textPath>
      </text>
      <text x="50" y="69" class="center" text-anchor="middle">{{ center }}</text>
    </g>
  </svg>
</template>

<style scoped>
.hanko {
  width: var(--hanko-size, 4.5rem);
  height: var(--hanko-size, 4.5rem);
  color: var(--accent);
  flex: none;
}
.ring {
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
}
.thin {
  stroke-width: 1.4;
}
.arc-text {
  fill: currentColor;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.center {
  fill: currentColor;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 32px;
}
</style>
