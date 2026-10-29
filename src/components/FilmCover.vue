<script setup lang="ts">
/**
 * Обложка фильма (ТЗ §11): не зависит от сторонних картинок.
 * Кадр плёнки с силуэтной сценой (своя у каждого фильма, см. covers.ts)
 * в цвете уровня; на «земле» — название, год и номер в курсе.
 * На узкой обложке (журнал, телефон) название скрыто — оно рядом в тексте.
 * Декоративна — те же данные есть рядом в тексте карточки.
 */
import { computed } from 'vue'
import type { Film } from '@/domain/catalog/catalog.types'
import { levelTint } from '@/domain/shared/tint'
import { COVER_VIEWBOX, COVER_WIDTH, cachedCover } from '@/illustrations/covers'

const props = defineProps<{ film: Pick<Film, 'id' | 'title' | 'year' | 'levelNumber' | 'order'> }>()

const scene = computed(() =>
  cachedCover({ seed: props.film.id, levelNumber: props.film.levelNumber, order: props.film.order }),
)
</script>

<template>
  <div class="cover" :data-tint="levelTint(film.levelNumber)" :data-motif="scene.motif" aria-hidden="true">
    <span class="cover__holes cover__holes--l" />
    <span class="cover__holes cover__holes--r" />
    <div class="cover__frame">
      <svg class="cover__scene" :viewBox="COVER_VIEWBOX" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g :transform="scene.flip ? `matrix(-1 0 0 1 ${COVER_WIDTH} 0)` : undefined">
          <path v-for="(layer, i) in scene.layers" :key="i" :class="`cover__${layer.kind}`" :d="layer.d" />
        </g>
      </svg>
      <div class="cover__caption">
        <p class="cover__title">{{ film.title }}</p>
        <p class="cover__meta">{{ film.year }}</p>
      </div>
      <p class="cover__number">{{ film.levelNumber }}·{{ film.order }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Поля под перфорацию — колонками своей сетки: проценты в padding считались бы
   от ширины родителя, и во flex-строке обложка раздувалась бы. */
.cover {
  position: relative;
  display: grid;
  grid-template-columns: 14% minmax(0, 1fr) 14%;
  aspect-ratio: 2 / 3;
  background: var(--hero-bar);
  border-radius: 3px;
  container-type: inline-size;
}
.cover__holes {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14%;
  background-image: radial-gradient(circle at 50% 50%, var(--hero-hole) 0 28%, transparent 30%);
  background-size: 100% 9cqi;
  opacity: 0.85;
}
.cover__holes--l {
  left: 0;
}
.cover__holes--r {
  right: 0;
}
.cover__frame {
  position: relative;
  grid-column: 2;
  min-height: 0;
  overflow: hidden;
  background: linear-gradient(color-mix(in srgb, var(--tint) 45%, var(--paper-raised)), var(--tint) 58%);
}
.cover__scene {
  /* В «кинозале» светлые силуэты чуть приглушены, чтобы не спорить с текстом карточки. */
  --cover-fill: color-mix(in srgb, var(--tint-ink) var(--cover-ink), var(--tint));
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.cover__far {
  fill: var(--cover-fill);
  opacity: 0.3;
}
.cover__glow {
  fill: var(--cover-fill);
  opacity: 0.55;
}
.cover__shape {
  fill: var(--cover-fill);
}
.cover__hole {
  fill: var(--tint);
}
.cover__line {
  fill: none;
  stroke: var(--cover-fill);
  stroke-width: 0.5;
  stroke-linecap: round;
}
/* Подпись — на «земле» кадра (ниже GROUND_Y = 60% высоты), цветом фона уровня;
   в «кинозале» земля светлая — подпись тёмная. */
.cover__caption {
  position: absolute;
  inset: 62% 4cqi 9cqi;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2cqi;
  color: var(--cover-caption, var(--tint));
  text-align: center;
}
.cover__title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(0.66rem, 9.5cqi, 1.4rem);
  line-height: 1.1;
  text-wrap: balance;
  hyphens: auto;
  overflow-wrap: anywhere;
}
.cover__meta {
  font-size: clamp(0.62rem, 7cqi, 0.95rem);
  opacity: 0.85;
}
.cover__number {
  position: absolute;
  bottom: 3cqi;
  right: 5cqi;
  font-family: var(--font-accent);
  font-size: clamp(0.55rem, 6cqi, 0.85rem);
  color: var(--cover-caption, var(--tint));
  opacity: 0.75;
}
/* Узкая обложка (журнал, карточки на телефоне): название не помещается на «земле»
   и переносилось бы по слогам — остаются сцена и год. */
@container (max-width: 5.5rem) {
  .cover__title,
  .cover__number {
    display: none;
  }
}
</style>
