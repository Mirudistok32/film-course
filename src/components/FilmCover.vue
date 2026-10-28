<script setup lang="ts">
/**
 * Текстовая обложка фильма (ТЗ §11): не зависит от сторонних картинок.
 * Кадр плёнки с эмблемой уровня, названием, годом и номером в курсе.
 * Декоративна — те же данные есть рядом в тексте карточки.
 */
import type { Film } from '@/domain/catalog/catalog.types'
import { levelTint } from '@/domain/shared/tint'
import LevelEmblem from '@/illustrations/LevelEmblem.vue'

defineProps<{ film: Pick<Film, 'title' | 'year' | 'levelNumber' | 'order'> }>()
</script>

<template>
  <div class="cover" :data-tint="levelTint(film.levelNumber)" aria-hidden="true">
    <span class="cover__holes cover__holes--l" />
    <span class="cover__holes cover__holes--r" />
    <div class="cover__frame">
      <LevelEmblem class="cover__emblem" :level="film.levelNumber" />
      <p class="cover__title">{{ film.title }}</p>
      <p class="cover__meta">{{ film.year }}</p>
      <p class="cover__number">{{ film.levelNumber }}·{{ film.order }}</p>
    </div>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  aspect-ratio: 2 / 3;
  padding: 0 14%;
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
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4cqi;
  padding: 8cqi 4cqi;
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% 25%, color-mix(in srgb, var(--tint) 45%, var(--paper-raised)), var(--tint));
  color: var(--ink);
  text-align: center;
}
.cover__emblem {
  --emblem-size: 30cqi;
  color: var(--tint-ink);
}
.cover__title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: clamp(0.7rem, 9.5cqi, 1.4rem);
  line-height: 1.1;
  text-wrap: balance;
  hyphens: auto;
  overflow-wrap: anywhere;
}
.cover__meta {
  font-size: clamp(0.65rem, 7cqi, 0.95rem);
  color: var(--ink-soft);
}
.cover__number {
  position: absolute;
  bottom: 3cqi;
  right: 5cqi;
  font-family: var(--font-accent);
  font-size: clamp(0.6rem, 6cqi, 0.85rem);
  color: var(--ink-faint);
}
</style>
