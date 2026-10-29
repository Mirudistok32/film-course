<script setup lang="ts">
/**
 * Карта курса (ТЗ §10): все 13 уровней кадрами одной киноплёнки сверху
 * вниз. У кадра — номер, название, цель, число фильмов, статус словами
 * и «N из M фильмов пройдено». Порядок рекомендуемый: в строгом режиме
 * закрытые уровни всё равно открываются для чтения.
 *
 * На телефоне над плёнкой — компактный «ролик» из 13 кадров-эмблем для
 * перехода к уровню, а цель уровня в кадре свёрнута до одной строки.
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { useScrollTo } from '@/composables/useScrollTo'
import {
  courseMap,
  courseStats,
  GRADUATION_STATUS_LABEL,
  graduationStatus,
  LEVEL_STATUS_LABEL,
} from '@/domain/progress/progress.selectors'
import { plural } from '@/domain/shared/text'
import { levelTint } from '@/domain/shared/tint'
import AppButton from '@/components/AppButton.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import HankoStamp from '@/illustrations/HankoStamp.vue'
import InkDivider from '@/illustrations/InkDivider.vue'
import LevelEmblem from '@/illustrations/LevelEmblem.vue'

const store = useProgressStore()
const course = computed(() => store.course)
const p = computed(() => store.progress)

const entries = computed(() => courseMap(course.value, p.value))
const stats = computed(() => courseStats(course.value, p.value))
const strict = computed(() => store.settings.sequentialMode)

const films = (n: number) => plural(n, ['фильм', 'фильма', 'фильмов'])

/** Номера уровней-расширений одним диапазоном: «3–13». */
const proposedRange = computed(() => {
  const numbers = course.value.levels.filter((l) => l.status === 'proposed-expansion').map((l) => l.number)
  if (!numbers.length) return ''
  const first = numbers[0]!
  const last = numbers[numbers.length - 1]!
  return first === last ? `${first}` : `${first}–${last}`
})

const graduation = computed(() => GRADUATION_STATUS_LABEL[graduationStatus(p.value)])

/** Кадры плёнки по id уровня — для перехода из «ролика» на телефоне. */
const frameEls: Record<string, HTMLElement> = {}
const scrollTo = useScrollTo()

function goTo(levelId: string) {
  const el = frameEls[levelId]
  scrollTo(el, el?.querySelector<HTMLElement>('.frame__link'))
}

/** Уровни, у которых на телефоне раскрыта цель. */
const expanded = ref(new Set<string>())

function toggleAbout(levelId: string) {
  if (expanded.value.has(levelId)) expanded.value.delete(levelId)
  else expanded.value.add(levelId)
}
</script>

<template>
  <div class="course container">
    <header class="course__head">
      <p class="eyebrow">{{ stats.totalLevels }} уровней · {{ stats.totalFilms }} {{ films(stats.totalFilms) }}</p>
      <h1>Карта курса</h1>
      <p class="course__lead">
        Уровни идут от рождения киноязыка к целостной мысли о фильме. Рекомендуемый порядок — сверху вниз:
        каждый следующий уровень опирается на навык предыдущего.
      </p>
      <div class="course__meters">
        <ProgressMeter
          class="course__levels-meter"
          :value="stats.levelsCompleted"
          :max="stats.totalLevels"
          :label="`Пройдено уровней: ${stats.levelsCompleted} из ${stats.totalLevels}`"
        />
        <ProgressMeter
          :value="stats.filmsCompleted"
          :max="stats.totalFilms"
          :label="`Пройдено фильмов: ${stats.filmsCompleted} из ${stats.totalFilms} · просмотрено ${stats.filmsWatched}`"
        />
      </div>
      <p class="course__mode">
        <template v-if="strict">
          Включён строгий порядок: уровень открывается для заданий после завершения предыдущего. Закрытые уровни
          можно читать в режиме обзора.
        </template>
        <template v-else>Любой уровень можно открыть сразу — порядок подсказывает путь, но не запрещает.</template>
        <RouterLink :to="{ name: 'data' }">Изменить в настройках</RouterLink>
      </p>
    </header>

    <nav class="reel" aria-label="Быстрый переход к уровню">
      <ol class="reel__list">
        <li v-for="{ level, status, isCurrent } in entries" :key="level.id">
          <button
            type="button"
            class="reel__cell"
            :class="`reel__cell--${status}`"
            :data-tint="levelTint(level.number)"
            :aria-current="isCurrent ? 'step' : undefined"
            @click="goTo(level.id)"
          >
            <LevelEmblem :level="level.number" class="reel__emblem" />
            <span class="reel__num" aria-hidden="true">{{ level.number }}</span>
            <span class="visually-hidden">Уровень {{ level.number }}: {{ level.title }} — {{ LEVEL_STATUS_LABEL[status] }}</span>
          </button>
        </li>
      </ol>
    </nav>

    <ol class="strip" aria-label="Уровни курса">
      <li
        v-for="{ level, status, stats: ls, isCurrent } in entries"
        :key="level.id"
        :ref="(el) => (frameEls[level.id] = el as HTMLElement)"
        class="frame"
        :data-tint="levelTint(level.number)"
        :class="[`frame--${status}`, { 'frame--current': isCurrent }]"
      >
        <LevelEmblem :level="level.number" class="frame__emblem" />
        <div class="frame__text">
          <p class="frame__eyebrow">
            <span class="eyebrow">Уровень {{ level.number }}</span>
            <!-- У пройденного уровня счётчик фильмов рядом со статусом «Пройден» только сбивает: уровень завершается по просмотрам. -->
            <span v-if="status !== 'completed' && status !== 'review'" class="frame__count" aria-hidden="true">
              {{ ls.completed }} из {{ ls.total }}
            </span>
            <span v-if="isCurrent" class="frame__here">Вы здесь</span>
          </p>
          <h2 class="frame__title">
            <RouterLink :to="{ name: 'level', params: { levelId: level.id } }" class="frame__link">
              {{ level.title }}
            </RouterLink>
          </h2>
          <div class="frame__about" :class="{ 'frame__about--open': expanded.has(level.id) }">
            <p :id="`purpose-${level.id}`" class="frame__purpose">{{ level.purpose }}</p>
            <button
              type="button"
              class="frame__more"
              :aria-expanded="expanded.has(level.id)"
              :aria-controls="`purpose-${level.id}`"
              @click="toggleAbout(level.id)"
            >
              {{ expanded.has(level.id) ? 'Свернуть' : 'Подробнее' }}<span class="visually-hidden"> о цели уровня {{ level.number }}</span>
            </button>
          </div>
        </div>
        <div class="frame__progress">
          <StatusBadge :level="status" class="frame__badge" />
          <ProgressMeter
            class="frame__meter"
            :value="ls.completed"
            :max="ls.total"
            :label="`${ls.completed} из ${ls.total} ${plural(ls.total, ['фильма', 'фильмов', 'фильмов'])} пройдено · просмотрено ${ls.watched}`"
          />
          <p v-if="status === 'locked'" class="frame__note">Откроется после уровня {{ level.number - 1 }}; читать можно уже сейчас</p>
        </div>
        <span v-if="status === 'completed' || status === 'review'" class="frame__stamp" aria-hidden="true">
          <HankoStamp text="уровень пройден" :center="String(level.number)" />
        </span>
      </li>
    </ol>

    <p v-if="proposedRange" class="course__source muted">
      Уровни {{ proposedRange }} — предложенное расширение программы: состав фильмов и тексты уроков ещё проходят
      редактуру.
    </p>

    <section class="finale" aria-labelledby="finale-title">
      <InkDivider />
      <p class="eyebrow">Финал курса</p>
      <h2 id="finale-title">Выпускная работа</h2>
      <p class="finale__text">
        Разбор одного фильма по вашему выбору: главный вопрос, несколько формальных решений и интерпретация, которая
        на них опирается. Критерии видны заранее — начинать можно в любой момент.
      </p>
      <p class="finale__status">Статус: <strong>{{ graduation }}</strong></p>
      <AppButton :to="{ name: 'graduation' }">Открыть выпускную работу</AppButton>
    </section>
  </div>
</template>

<style scoped>
.course {
  display: grid;
  gap: 1.5rem;
  padding-top: clamp(1.5rem, 4vw, 2.5rem);
}

.course__head {
  display: grid;
  gap: 0.9rem;
  max-width: 46rem;
}
.course__lead {
  font-size: clamp(1.05rem, 1rem + 0.3vw, 1.2rem);
  color: var(--ink-soft);
}
.course__meters {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.25rem;
}
.course__mode {
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.course__mode a {
  margin-left: 0.35em;
}

/* ---------- Плёнка: тёмная лента с перфорацией по краям ---------- */

.strip {
  --hole-w: 16px;
  --hole-h: 28px;
  --hole-edge: 0.6rem;
  position: relative;
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0.75rem calc(var(--hole-edge) * 2 + var(--hole-w));
  list-style: none;
  background: var(--hero-bar);
  border-radius: var(--radius-s);
  box-shadow: var(--shadow);
}
/* Отверстия — маска с повторяющимся скруглённым прямоугольником, цвет берётся из темы. */
.strip::before,
.strip::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: var(--hole-w);
  background: var(--hero-hole);
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='28'><rect x='2' y='8' width='12' height='12' rx='2.5'/></svg>")
    0 0 / var(--hole-w) var(--hole-h) repeat-y;
  mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='28'><rect x='2' y='8' width='12' height='12' rx='2.5'/></svg>")
    0 0 / var(--hole-w) var(--hole-h) repeat-y;
}
.strip::before {
  left: var(--hole-edge);
}
.strip::after {
  right: var(--hole-edge);
}

.frame {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(13rem, 17rem);
  align-items: center;
  gap: 1rem 1.5rem;
  padding: clamp(1rem, 2.5vw, 1.4rem) clamp(1rem, 3vw, 1.75rem);
  background: linear-gradient(100deg, var(--tint) 0, color-mix(in srgb, var(--tint) 40%, var(--paper-raised)) 9rem, var(--paper-raised) 60%);
  border-radius: 3px;
}
.frame--current {
  box-shadow: inset 0 0 0 2px var(--accent);
}
/*
 * Вся карточка кликабельна через растянутую ссылку; фокус рисуется на кадре —
 * внутри него (снаружи тёмная плёнка) и цветом уровня, см. [data-tint] в base.css.
 */
.frame:has(.frame__link:focus-visible) {
  outline: 3px solid var(--focus);
  outline-offset: -7px;
}
.frame__link {
  text-decoration: none;
}
.frame__link::after {
  content: '';
  position: absolute;
  inset: 0;
}
.frame__link:focus-visible {
  outline: none;
}
.frame:hover .frame__link {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

.frame__emblem {
  --emblem-size: 4.5rem;
  color: var(--tint-ink);
}
.frame--locked .frame__emblem {
  opacity: 0.55;
}
.frame--completed .frame__emblem,
.frame--review .frame__emblem {
  color: var(--moss);
}

.frame__text {
  display: grid;
  gap: 0.3rem;
}
.frame__eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.75rem;
}
.frame__eyebrow .eyebrow {
  font-size: 0.9rem;
}
.frame__here {
  padding: 0.05em 0.55em;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.frame__title {
  font-size: clamp(1.5rem, 1.25rem + 1vw, 1.9rem);
}
.frame__purpose {
  font-size: 0.97rem;
  color: var(--ink-soft);
}

.frame__count,
.frame__more {
  display: none;
}

.frame__progress {
  display: grid;
  justify-items: start;
  gap: 0.6rem;
}
.frame__note {
  font-size: 0.85rem;
  color: var(--ink-soft);
}

.frame__stamp {
  --hanko-size: 3.6rem;
  position: absolute;
  top: 0.4rem;
  right: 0.6rem;
  pointer-events: none;
}

.course__source {
  font-size: 0.9rem;
  max-width: var(--measure);
}

.finale {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  max-width: 40rem;
  margin: 1rem auto 0;
  text-align: center;
}
.finale__text {
  color: var(--ink-soft);
}

/* ---------- «Ролик» для перехода к уровню: только на телефоне ---------- */

.reel {
  display: none;
}
.reel__list {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
  margin: 0;
  padding: 0.45rem;
  list-style: none;
  background: var(--hero-bar);
  border-radius: var(--radius-s);
  box-shadow: var(--shadow);
}
.reel__cell {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.1rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.3rem 0 0.2rem;
  border: 0;
  border-radius: 3px;
  background: color-mix(in srgb, var(--intertitle-ink) 12%, var(--hero-bar));
  color: var(--intertitle-ink);
  font: inherit;
  cursor: pointer;
}
.reel__emblem {
  --emblem-size: 1.75rem;
  color: inherit;
}
.reel__num {
  font-family: var(--font-accent);
  font-size: 0.72rem;
  line-height: 1;
}
/* Начатый уровень — подкрашен цветом уровня, пройденный — «засвечен» пастелью, как кадры прогресса. */
.reel__cell--in-progress {
  background: color-mix(in srgb, var(--tint) 30%, var(--hero-bar));
}
.reel__cell--completed,
.reel__cell--review {
  background: linear-gradient(135deg, var(--frame-lit-a), var(--frame-lit-b));
  color: var(--hero-bar);
}
.reel__cell--locked {
  opacity: 0.55;
}
/* Текущий уровень — рамка акцентом и метка-уголок: не только цветом. */
.reel__cell[aria-current] {
  box-shadow: inset 0 0 0 2px var(--accent);
}
.reel__cell[aria-current]::after {
  content: '';
  position: absolute;
  top: 3px;
  right: 3px;
  border: 5px solid transparent;
  border-top-color: var(--accent);
  border-right-color: var(--accent);
}
/* Кольцо лежит на тёмной плёнке ролика — светлое, с оттенком уровня. */
.reel__cell:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--tint-ink) 30%, var(--intertitle-ink));
  outline-offset: 2px;
}

/* ---------- Узкий экран: одна колонка, перфорация уже ---------- */

@media (max-width: 52rem) {
  .frame {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
  }
  .frame__progress {
    grid-column: 1 / -1;
  }
  .frame__emblem {
    --emblem-size: 3.25rem;
  }
}

@media (max-width: 30rem) {
  .course {
    gap: 1.1rem;
  }
  /* Те же 13 кадров уровней показывает «ролик» ниже — у счётчика уровней остаётся подпись. */
  .course__levels-meter :deep(.meter__frames) {
    display: none;
  }
  .reel {
    display: block;
  }
  .strip {
    --hole-w: 11px;
    --hole-h: 20px;
    --hole-edge: 0.3rem;
    gap: 0.5rem;
    padding-block: 0.5rem;
  }
  /*
   * Плотный кадр в три строки: номер, «N из M» и статус словами; название;
   * цель одной строкой с кнопкой «Подробнее». Полная подпись прогресса —
   * для скринридера (полоса кадров остаётся на широком экране). Эмблемы —
   * в «ролике» над плёнкой; печать пройденного уровня заменяют статус
   * «Пройден» и засвеченный кадр ролика.
   */
  .frame {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'eyebrow badge'
      'title title'
      'about about'
      'note note';
    align-items: center;
    gap: 0.3rem 0.6rem;
    padding: 0.7rem 0.85rem 0.8rem;
  }
  .frame__emblem,
  .frame__stamp {
    display: none;
  }
  .frame__text,
  .frame__progress {
    display: contents;
  }
  /* Длинные статусы («Закрыт (строгий порядок)», «Пройден · повторный разбор») — отдельной строкой внизу. */
  .frame--locked,
  .frame--review {
    grid-template-areas:
      'eyebrow eyebrow'
      'title title'
      'about about'
      'badge badge'
      'note note';
  }
  .frame--locked .frame__badge,
  .frame--review .frame__badge {
    justify-self: start;
    margin-top: 0.3rem;
  }
  .frame__eyebrow {
    grid-area: eyebrow;
  }
  .frame__eyebrow > * {
    white-space: nowrap;
  }
  .frame__count {
    display: inline;
    font-family: var(--font-accent);
    font-size: 0.85rem;
    color: var(--ink-soft);
  }
  .frame__badge {
    grid-area: badge;
  }
  .frame__title {
    grid-area: title;
    font-size: 1.3rem;
  }
  .frame__about {
    grid-area: about;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .frame__purpose {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .frame__about--open {
    flex-direction: column;
    gap: 0;
  }
  .frame__about--open .frame__purpose {
    white-space: normal;
  }
  /* Кнопка поверх растянутой ссылки кадра; область нажатия больше видимой строки. */
  .frame__more {
    position: relative;
    z-index: 1;
    display: inline-block;
    flex: none;
    margin: -0.6rem -0.4rem;
    padding: 0.6rem 0.4rem;
    border: 0;
    background: none;
    color: var(--tint-ink);
    font: inherit;
    font-size: 0.92rem;
    font-weight: 560;
    text-decoration: underline;
    text-underline-offset: 0.2em;
    cursor: pointer;
  }
  .frame__meter {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .frame__note {
    grid-area: note;
  }
}
</style>
