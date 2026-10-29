<script setup lang="ts">
/**
 * Сцена-заставка в кадре 2.39:1 между полосами плёнки: корявое дерево
 * на холме, маленький зритель и луна, на которую падает луч проектора.
 * Луна-экран — поклон раннему кино, плоские облака и холмы — старому аниме.
 *
 * Кадр живой, но без таймеров: слои смещаются с разной скоростью, пока кадр
 * уходит вверх при прокрутке (CSS scroll-driven animations), а в тёмной теме
 * звёзды и луч пару раз «вздыхают» после загрузки и замирают. При уменьшении
 * движения (системном или из настроек) кадр статичен.
 */
import { computed, useId } from 'vue'
import { createRng, r1 } from './random'
import { drawTree } from './tree'

const props = withDefaults(defineProps<{ seed?: string }>(), { seed: 'kino-hero' })
const uid = useId()

const W = 1200
const BAR = 29
const H = 502 + BAR * 2
const FLOOR = H - BAR

function hills(seed: string, base: number, amp: number): string {
  const rng = createRng(seed)
  const phases = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)]
  const ys: number[] = []
  for (let x = 0; x <= W; x += 40) {
    const t = x / W
    ys.push(
      base -
        amp *
          (0.55 * Math.sin(t * 5.1 + phases[0]!) +
            0.3 * Math.sin(t * 11.3 + phases[1]!) +
            0.15 * Math.sin(t * 23.7 + phases[2]!)),
    )
  }
  let d = `M0 ${r1(ys[0]!)}`
  for (let i = 1; i < ys.length; i++) {
    const x0 = (i - 1) * 40
    const mx = x0 + 20
    const my = (ys[i - 1]! + ys[i]!) / 2
    d += `Q${x0} ${r1(ys[i - 1]!)} ${mx} ${r1(my)}`
  }
  return `${d}L${W} ${r1(ys[ys.length - 1]!)}L${W} ${FLOOR}L0 ${FLOOR}Z`
}

const scene = computed(() => {
  const rng = createRng(props.seed)
  const stars = Array.from({ length: 40 }, () => ({
    x: r1(rng.range(0, W)),
    y: r1(rng.range(BAR + 6, 300)),
    r: r1(rng.range(0.6, 1.7)),
  }))
  const grass: string[] = []
  for (let x = 110; x < 540; x += rng.range(7, 16)) {
    const t = (x - 80) / 460
    const groundY = FLOOR - Math.sin(t * Math.PI) * 74 + 4
    const h = rng.range(6, 16)
    grass.push(`M${r1(x)} ${r1(groundY)}q${r1(rng.range(-3, 3))} ${r1(-h / 2)} ${r1(rng.range(-5, 5))} ${r1(-h)}`)
  }
  const holes: number[] = []
  for (let x = 14; x < W; x += 40) holes.push(x)
  return {
    tree: drawTree({
      seed: `${props.seed}-wych`,
      x: 300,
      y: 466,
      height: 410,
      depth: 7,
      lean: 0.1,
      gnarl: 0.7,
      fullness: 0.35,
      rootPower: 1.8,
    }),
    far: hills(`${props.seed}-far`, 372, 26),
    mid: hills(`${props.seed}-mid`, 414, 22),
    near: hills(`${props.seed}-near`, 452, 16),
    stars: [stars.filter((_, i) => i % 2 === 0), stars.filter((_, i) => i % 2 === 1)],
    grass,
    holes,
  }
})
</script>

<template>
  <svg
    class="hero-scene"
    :viewBox="`0 0 ${W} ${H}`"
    aria-hidden="true"
    focusable="false"
    preserveAspectRatio="xMidYMid meet"
  >
    <defs>
      <linearGradient :id="`${uid}-sky`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--hero-sky-top)" />
        <stop offset="1" stop-color="var(--hero-sky-bottom)" />
      </linearGradient>
      <radialGradient :id="`${uid}-halo`">
        <stop offset="0.45" stop-color="var(--hero-moon-halo)" />
        <stop offset="1" stop-color="var(--hero-moon-halo)" stop-opacity="0" />
      </radialGradient>
      <linearGradient :id="`${uid}-beam`" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="var(--hero-moon)" stop-opacity="0.5" />
        <stop offset="1" stop-color="var(--hero-moon)" stop-opacity="0.05" />
      </linearGradient>
      <clipPath :id="`${uid}-frame`">
        <rect x="0" :y="BAR" :width="W" :height="H - BAR * 2" />
      </clipPath>
    </defs>

    <g :clip-path="`url(#${uid}-frame)`">
      <rect x="0" y="0" :width="W" :height="H" :fill="`url(#${uid}-sky)`" />

      <!-- Звёзды двумя группами: «дышат» вразнобой. -->
      <g class="layer stars" fill="var(--hero-moon)">
        <g v-for="(group, g) in scene.stars" :key="g" class="stars__part">
          <circle v-for="(s, i) in group" :key="i" :cx="s.x" :cy="s.y" :r="s.r" />
        </g>
      </g>

      <g class="layer moon">
        <circle cx="850" cy="196" r="200" :fill="`url(#${uid}-halo)`" />
        <circle cx="850" cy="196" r="88" fill="var(--hero-moon)" />
      </g>

      <!-- Луч проектора от зрителя к луне; при прокрутке поворачивается вслед за луной. -->
      <g class="layer beam">
        <path class="beam__light" d="M332 412 L790 150 L790 246 Z" :fill="`url(#${uid}-beam)`" />
      </g>

      <g fill="var(--hero-cloud)">
        <path
          class="layer cloud cloud--low"
          d="M600 262 Q660 244 730 254 Q800 236 880 250 Q960 238 1050 256 Q990 274 900 268 Q820 280 730 272 Q660 280 600 262 Z"
        />
        <path
          class="layer cloud cloud--left"
          d="M60 146 Q120 132 190 140 Q250 128 330 142 Q280 156 200 152 Q130 160 60 146 Z"
        />
        <path
          class="layer cloud cloud--right"
          d="M940 118 Q990 108 1040 114 Q1090 106 1150 118 Q1100 130 1040 126 Q990 132 940 118 Z"
        />
      </g>

      <g class="layer birds" fill="none" stroke="var(--hero-ink)" stroke-width="2" stroke-linecap="round" opacity="0.7">
        <path d="M708 122 q7 -6 14 0 q7 -6 14 0" />
        <path d="M742 98 q5 -4 10 0 q5 -4 10 0" />
        <path d="M684 150 q5 -4 10 0 q5 -4 10 0" />
      </g>

      <path class="layer hill--far" :d="scene.far" fill="var(--hero-hill-far)" />
      <path class="layer hill--mid" :d="scene.mid" fill="var(--hero-hill-mid)" />
      <path class="layer hill--near" :d="scene.near" fill="var(--hero-hill-near)" />

      <!-- Холм с деревом. -->
      <path :d="`M60 ${FLOOR} Q170 452 300 460 Q440 466 560 ${FLOOR} Z`" fill="var(--hero-ground)" />

      <g fill="var(--hero-ink)">
        <path v-for="(d, i) in scene.tree.limbs" :key="`l${i}`" :d="d" />
      </g>
      <!-- Побеги и дупла — линии, их можно слить в один path: пышная крона не раздувает DOM. -->
      <path
        :d="scene.tree.twigs.join('')"
        fill="none"
        stroke="var(--hero-ink)"
        stroke-width="1.6"
        stroke-linecap="round"
      />
      <path
        :d="scene.tree.knots.join('')"
        fill="none"
        stroke="var(--hero-sky-bottom)"
        stroke-width="1.4"
        opacity="0.35"
      />

      <!-- Зритель в капюшоне сидит среди корней, прислонившись спиной к стволу, и смотрит на луну.
           Лунный контур с лицевой стороны отделяет фигуру от ствола того же цвета. -->
      <path
        d="M309 466 L307 440 Q306 424 308 416 Q309 405 319 403 Q329 402 331 409 Q333 414 331 418 L330 421 Q334 423 339 425 L351 427 Q358 428 359 436 L360 458 Q365 462 365 466 Z"
        fill="var(--hero-figure)"
      />
      <path
        d="M321 403 Q329 402 331 409 Q333 414 331 418 L330 421 Q334 423 339 425 L351 427 Q358 428 359 436 L360 458"
        fill="none"
        stroke="var(--hero-moon)"
        stroke-width="1.6"
        stroke-linecap="round"
        opacity="0.55"
      />

      <g fill="none" stroke="var(--hero-ground)" stroke-width="2" stroke-linecap="round">
        <path v-for="(d, i) in scene.grass" :key="`g${i}`" :d="d" />
      </g>
    </g>

    <rect x="0" y="0" :width="W" :height="BAR" fill="var(--hero-bar)" />
    <rect x="0" :y="FLOOR" :width="W" :height="BAR" fill="var(--hero-bar)" />
    <g fill="var(--hero-hole)">
      <rect v-for="x in scene.holes" :key="`ht${x}`" :x="x" y="9" width="16" height="11" rx="2.5" />
      <rect v-for="x in scene.holes" :key="`hb${x}`" :x="x" :y="FLOOR + 9" width="16" height="11" rx="2.5" />
    </g>
  </svg>
</template>

<style scoped>
.hero-scene {
  width: 100%;
  height: auto;
  border-radius: var(--radius-s);
}
.stars {
  opacity: var(--hero-stars, 0);
}

/*
 * Параллакс: чем дальше слой, тем сильнее он «отстаёт» (смещается вниз),
 * пока кадр уходит за верх экрана. Смещения — в единицах viewBox.
 * Холм с деревом и зрителем стоит на месте — это опорный план.
 */
.stars {
  --drift-y: 110px;
}
.moon {
  --drift-y: 90px;
}
.cloud--low {
  --drift-x: -30px;
  --drift-y: 60px;
}
.cloud--left {
  --drift-x: 36px;
  --drift-y: 64px;
}
.cloud--right {
  --drift-x: -24px;
  --drift-y: 70px;
}
.birds {
  --drift-x: -40px;
  --drift-y: 50px;
}
.hill--far {
  --drift-y: 40px;
}
.hill--mid {
  --drift-y: 24px;
}
.hill--near {
  --drift-y: 12px;
}

@keyframes hero-drift {
  to {
    transform: translate(var(--drift-x, 0), var(--drift-y, 0));
  }
}
/* Луна опускается на 90 — луч поворачивается вокруг зрителя, чтобы упираться в неё. */
@keyframes hero-beam-follow {
  to {
    transform: rotate(9deg);
  }
}
@keyframes hero-stars-breath {
  50% {
    opacity: 0.4;
  }
}
@keyframes hero-beam-breath {
  50% {
    opacity: calc(1 - var(--hero-beam-breath, 0));
  }
}

@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    :root:not([data-reduced-motion='true']) .hero-scene {
      view-timeline: --hero-frame block;
    }
    :root:not([data-reduced-motion='true']) .layer {
      animation: hero-drift linear both;
      animation-timeline: --hero-frame;
      animation-range: exit 0% exit 100%;
    }
    :root:not([data-reduced-motion='true']) .beam {
      transform-origin: 332px 412px;
      animation-name: hero-beam-follow;
    }
  }

  /* Дыхание — конечное: две-три волны после загрузки, затем исходное состояние. */
  :root:not([data-reduced-motion='true']) .stars__part {
    animation: hero-stars-breath 3.2s ease-in-out 4;
  }
  :root:not([data-reduced-motion='true']) .stars__part:nth-child(2) {
    animation-delay: 1.6s;
  }
  :root:not([data-reduced-motion='true']) .beam__light {
    animation: hero-beam-breath 6s ease-in-out 2;
  }
}
</style>
