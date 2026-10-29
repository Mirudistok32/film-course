<script setup lang="ts">
/**
 * Печать-ханко «пройдено»: киноварь, неровный оттиск, слегка повёрнута.
 * Текст печати дублируется для скринридеров через aria-label.
 * press — печать только что поставили: один короткий оттиск (≤ 600 мс),
 * без него (в том числе после перезагрузки) печать просто на месте.
 */
import { computed, useId } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Текст по окружности. */
    text?: string
    /** Крупный знак в центре: номер уровня или короткое слово. */
    center?: string
    /** Поворот в градусах. */
    tilt?: number
    /** Проиграть оттиск при появлении. */
    press?: boolean
  }>(),
  { text: 'пройдено', center: '✓', tilt: -8, press: false },
)

const uid = useId()
/** Кегль надписи по дуге: длинная надпись мельче, чтобы уложиться в верхние ~210° круга. */
const arcSize = computed(() => Math.min(13, 118 / Math.max(props.text.length * 0.95, 1)).toFixed(1))
</script>

<template>
  <svg
    class="hanko"
    :class="{ 'hanko--press': press }"
    viewBox="0 0 100 100"
    role="img"
    :aria-label="`Печать: ${props.text}`"
    focusable="false"
  >
    <defs>
      <filter :id="`${uid}-rough`" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" />
      </filter>
      <!-- Полный круг от нижней точки: середина пути — вверху, надпись не упирается в концы дуги. -->
      <path :id="`${uid}-arc`" d="M50 80A30 30 0 1 1 50 20A30 30 0 1 1 50 80" />
    </defs>
    <g :transform="`rotate(${tilt} 50 50)`" :filter="`url(#${uid}-rough)`">
      <circle cx="50" cy="50" r="45" class="ring" />
      <circle cx="50" cy="50" r="40" class="ring thin" />
      <text class="arc-text" :font-size="arcSize">
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
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.center {
  fill: currentColor;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 32px;
}

/* Оттиск: печать опускается на бумагу, чуть сплющивается и оставляет след. */
@media (prefers-reduced-motion: no-preference) {
  :root:not([data-reduced-motion='true']) .hanko--press {
    animation: hanko-press 520ms var(--ease) both;
  }
}
@keyframes hanko-press {
  0% {
    opacity: 0;
    transform: scale(1.5) rotate(10deg);
  }
  55% {
    opacity: 1;
    transform: scale(0.9) rotate(-2deg);
  }
  75% {
    transform: scale(1.04);
  }
  100% {
    opacity: 1;
    transform: none;
  }
}
</style>
