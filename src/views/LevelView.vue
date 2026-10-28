<script setup lang="ts">
/**
 * Страница уровня (ТЗ §11): описание, навыки, мини-лекция с примерами,
 * фильмы со статусами, прогресс, условие завершения с итоговой заметкой,
 * термины уровня и кнопка продолжения к первому незавершённому фильму.
 * В строгом порядке закрытый уровень открыт для чтения, но не для записи.
 */
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { usePageTitle } from '@/composables/usePageTitle'
import { useScrollTo } from '@/composables/useScrollTo'
import { completeLevel, setLevelReflection } from '@/domain/progress/progress.actions'
import {
  FILM_STATUS_LABEL,
  filmDisplayStatus,
  isLevelLocked,
  levelContinue,
  levelStats,
  levelStatus,
} from '@/domain/progress/progress.selectors'
import { XP_RULES } from '@/domain/rewards/rewards.config'
import { formatDate } from '@/domain/shared/dates'
import { plural } from '@/domain/shared/text'
import { levelTint } from '@/domain/shared/tint'
import type { GlossaryTerm } from '@/domain/catalog/catalog.types'
import AnswerField from '@/components/AnswerField.vue'
import AppButton from '@/components/AppButton.vue'
import CriteriaList from '@/components/CriteriaList.vue'
import FilmCover from '@/components/FilmCover.vue'
import IntertitleCard from '@/components/IntertitleCard.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import HankoStamp from '@/illustrations/HankoStamp.vue'
import InkDivider from '@/illustrations/InkDivider.vue'
import LevelEmblem from '@/illustrations/LevelEmblem.vue'
import NotFoundView from './NotFoundView.vue'

const route = useRoute()
const store = useProgressStore()
const course = computed(() => store.course)
const p = computed(() => store.progress)

const level = computed(() => course.value.levelById.get(String(route.params.levelId)) ?? null)
usePageTitle(() => (level.value ? `Уровень ${level.value.number}. ${level.value.title}` : 'Страница не найдена'))

const stats = computed(() => (level.value ? levelStats(level.value, p.value) : null))
const status = computed(() => (level.value ? levelStatus(course.value, level.value, p.value) : 'available'))
const locked = computed(() => (level.value ? isLevelLocked(course.value, level.value, p.value) : false))
const completedAt = computed(() => (level.value ? (p.value.levels[level.value.id]?.completedAt ?? null) : null))

const neighbours = computed(() => {
  const index = level.value ? course.value.levels.indexOf(level.value) : -1
  return { prev: course.value.levels[index - 1] ?? null, next: course.value.levels[index + 1] ?? null }
})

const films = computed(() =>
  (level.value?.films ?? []).map((film) => ({ film, status: filmDisplayStatus(p.value.films[film.id]) })),
)
/** На уровнях 1–2 часть фильмов — из исходной концепции курса, часть добавлена как предложение. */
const mixedSources = computed(() => level.value?.status === 'confirmed-core-plus-proposals')

const terms = computed(() =>
  (level.value?.termIds ?? [])
    .map((id) => course.value.termById.get(id))
    .filter((t): t is GlossaryTerm => Boolean(t))
    .sort((a, b) => a.term.localeCompare(b.term, 'ru')),
)

const filmsWord = (n: number) => plural(n, ['фильма', 'фильмов', 'фильмов'])

/* ---------- Итог уровня ---------- */

const completion = ref<HTMLElement | null>(null)
const completionTitle = ref<HTMLElement | null>(null)
const message = ref('')

const reflection = computed({
  get: () => (level.value ? (p.value.levels[level.value.id]?.reflection ?? '') : ''),
  set: (text: string) => {
    const id = level.value?.id
    if (id) store.apply((q, now) => setLevelReflection(q, id, text, now), 'debounced')
  },
})

function finishLevel() {
  const target = level.value
  if (!target || locked.value || !stats.value?.canComplete) return
  store.apply((q, now) => completeLevel(q, target, now))
  if (completedAt.value) message.value = `Уровень ${target.number} пройден. Итоговую заметку можно дополнять и дальше.`
}

const scrollTo = useScrollTo()

async function goToCompletion() {
  await nextTick()
  scrollTo(completion.value, completionTitle.value)
}

/* ---------- Кнопка продолжения ---------- */

type Cta = { label: string; detail: string; to?: RouteLocationRaw }

const cta = computed<Cta | null>(() => {
  if (!level.value) return null
  const prev = neighbours.value.prev
  if (locked.value && prev) {
    return {
      label: `К уровню ${prev.number}`,
      detail: `Включён строгий порядок: задания откроются после уровня ${prev.number} «${prev.title}».`,
      to: { name: 'level', params: { levelId: prev.id } },
    }
  }
  const step = levelContinue(course.value, level.value, p.value)
  switch (step.kind) {
    case 'film':
      return {
        label: status.value === 'in-progress' ? 'Продолжить уровень' : 'Начать уровень',
        detail: `Фильм ${step.film.order} из ${level.value.films.length} — «${step.film.title}»`,
        to: { name: 'film', params: { filmId: step.film.id } },
      }
    case 'complete':
      return { label: 'К итогу уровня', detail: 'Все фильмы пройдены — осталось подвести итог.' }
    case 'next-level':
      return {
        label: `К уровню ${step.level.number}`,
        detail: `Следующий — «${step.level.title}»`,
        to: { name: 'level', params: { levelId: step.level.id } },
      }
    default:
      return { label: 'К выпускной работе', detail: 'Это последний уровень курса.', to: { name: 'graduation' } }
  }
})
</script>

<template>
  <NotFoundView v-if="!level || !stats" />
  <div v-else class="level container" :data-tint="levelTint(level.number)">
    <header class="head">
      <div class="head__intro">
        <p class="head__crumbs">
          <RouterLink :to="{ name: 'course' }">Карта курса</RouterLink>
          <span aria-hidden="true"> · </span>
          <span>Уровень {{ level.number }} из {{ course.levels.length }}</span>
        </p>
        <div class="head__title">
          <LevelEmblem :level="level.number" class="head__emblem" />
          <h1>{{ level.title }}</h1>
        </div>
        <p class="head__lead">{{ level.purpose }}</p>
        <p v-if="level.status === 'proposed-expansion'" class="head__source">
          Уровень входит в предложенное расширение программы: состав фильмов и тексты уроков ещё проходят редактуру.
        </p>
      </div>

      <aside class="card status" :data-tint="levelTint(level.number)" aria-label="Ваш прогресс на уровне">
        <StatusBadge :level="status" />
        <ProgressMeter
          :value="stats.completed"
          :max="stats.total"
          :label="`${stats.completed} из ${stats.total} ${filmsWord(stats.total)} пройдено · просмотрено ${stats.watched}`"
        />
        <template v-if="cta">
          <AppButton v-if="cta.to" variant="primary" size="l" :to="cta.to">{{ cta.label }}</AppButton>
          <AppButton v-else variant="primary" size="l" @click="goToCompletion">{{ cta.label }}</AppButton>
          <p class="status__detail">{{ cta.detail }}</p>
        </template>
        <span v-if="completedAt" class="status__stamp" aria-hidden="true">
          <HankoStamp text="уровень пройден" :center="String(level.number)" />
        </span>
      </aside>
    </header>

    <p v-if="locked && neighbours.prev" class="notice">
      <strong>Режим обзора.</strong> Включён строгий порядок: читать уровень и уроки можно уже сейчас, а записывать
      ответы и завершать уровень — после уровня {{ neighbours.prev.number }}.
      <RouterLink :to="{ name: 'data' }">Изменить в настройках</RouterLink>
    </p>

    <section class="skills" aria-labelledby="skills-title">
      <div>
        <h2 id="skills-title">Чему вы здесь научитесь</h2>
        <ol class="skills__list">
          <li v-for="skill in level.skills" :key="skill">{{ skill }}</li>
        </ol>
      </div>
      <IntertitleCard v-if="level.content" caption="после уровня">{{ level.content.outcome }}</IntertitleCard>
    </section>

    <section v-if="level.content" class="lecture" aria-labelledby="lecture-title">
      <InkDivider />
      <p class="eyebrow">Мини-лекция</p>
      <h2 id="lecture-title">Ключевой принцип</h2>
      <p class="lecture__principle prose">{{ level.content.lecture.principle }}</p>
      <h3 class="lecture__examples-title">Разобранные примеры</h3>
      <ol class="lecture__examples">
        <li v-for="ex in level.content.lecture.examples" :key="ex.title" class="example">
          <h4>{{ ex.title }}</h4>
          <p>{{ ex.text }}</p>
          <p v-if="ex.filmId && course.filmById.get(ex.filmId)" class="example__link">
            <RouterLink :to="{ name: 'film', params: { filmId: ex.filmId } }">
              Урок фильма «{{ course.filmById.get(ex.filmId)!.title }}»
            </RouterLink>
          </p>
        </li>
      </ol>
    </section>

    <section class="films" aria-labelledby="films-title">
      <InkDivider />
      <h2 id="films-title">Фильмы уровня</h2>
      <p class="films__lead">
        {{ stats.total }} {{ plural(stats.total, ['фильм', 'фильма', 'фильмов']) }} в рекомендуемом порядке. Смотрите их
        там, где вам удобно, а сюда возвращайтесь с наблюдениями.
      </p>
      <ol class="films__list">
        <li v-for="{ film, status: fs } in films" :key="film.id" class="film" :class="`film--${fs}`">
          <FilmCover :film="film" class="film__cover" />
          <div class="film__text">
            <p class="film__meta">
              {{ film.order }} · {{ film.year }}
              <span v-if="mixedSources && film.status === 'proposed-expansion'"> · предложение</span>
            </p>
            <h3 class="film__title">
              <RouterLink :to="{ name: 'film', params: { filmId: film.id } }" class="film__link">{{ film.title }}</RouterLink>
            </h3>
            <p class="film__director">{{ film.director }}</p>
            <p class="film__focus">{{ film.learningFocus }}</p>
            <!-- «Не смотрел» на каждой карточке шумит: показываем только начатое, а для скринридера статус остаётся словами. -->
            <StatusBadge v-if="fs !== 'not-started'" :film="fs" class="film__badge" />
            <span v-else class="visually-hidden">{{ FILM_STATUS_LABEL[fs] }}</span>
          </div>
        </li>
      </ol>
      <p v-if="mixedSources" class="films__source">
        «Предложение» — фильм добавлен к исходной концепции курса, чтобы на уровне было не меньше семи работ.
      </p>
    </section>

    <section v-if="terms.length" class="terms" aria-labelledby="terms-title">
      <InkDivider />
      <h2 id="terms-title">Термины уровня</h2>
      <p class="terms__lead">Встречаются в уроках этого уровня. В словаре — простое и профессиональное значение.</p>
      <ul class="terms__list">
        <li v-for="t in terms" :key="t.id">
          <RouterLink :to="{ name: 'glossary', query: { term: t.id } }" class="term">{{ t.term }}</RouterLink>
        </li>
      </ul>
      <RouterLink :to="{ name: 'glossary', query: { level: level.id } }">Все термины уровня в словаре</RouterLink>
    </section>

    <section ref="completion" class="completion card" aria-labelledby="completion-title">
      <h2 id="completion-title" ref="completionTitle" tabindex="-1">Завершение уровня</h2>
      <div v-if="completedAt" class="completion__done">
        <HankoStamp class="completion__stamp" text="уровень пройден" :center="String(level.number)" />
        <p>
          <strong>Уровень пройден</strong> ({{ formatDate(completedAt) }}). Завершение не отменяется: можно
          пересматривать фильмы и дополнять итоговую заметку.
        </p>
      </div>
      <p v-else class="completion__lead">
        Условия видны заранее. Длинный текст по каждому фильму не нужен — достаточно выполнить пункты ниже.
        <template v-if="store.settings.lightMode">Включён облегчённый режим: вместо упражнения хватит короткой заметки.</template>
      </p>
      <CriteriaList v-if="!completedAt" :criteria="stats.criteria" />

      <AnswerField
        v-if="level.content"
        v-model="reflection"
        label="Итоговая заметка уровня"
        :hint="level.content.reflectionPrompt"
        :rows="5"
        :readonly="locked"
      />

      <div v-if="!completedAt && !locked" class="completion__action">
        <AppButton variant="primary" :disabled="!stats.canComplete" aria-describedby="completion-hint" @click="finishLevel">
          Завершить уровень
        </AppButton>
        <p id="completion-hint" class="completion__hint">
          <template v-if="stats.canComplete">
            Все условия выполнены.<template v-if="store.settings.showGamification"> За уровень — {{ XP_RULES.levelCompleted }} XP.</template>
          </template>
          <template v-else>Кнопка станет доступна, когда все условия будут выполнены.</template>
        </p>
      </div>
      <p class="completion__message" role="status">{{ message }}</p>
    </section>

    <nav class="neighbours" aria-label="Соседние уровни">
      <RouterLink v-if="neighbours.prev" :to="{ name: 'level', params: { levelId: neighbours.prev.id } }" class="neighbour">
        <span class="neighbour__dir">← Уровень {{ neighbours.prev.number }}</span>
        <span class="neighbour__title">{{ neighbours.prev.title }}</span>
      </RouterLink>
      <RouterLink
        v-if="neighbours.next"
        :to="{ name: 'level', params: { levelId: neighbours.next.id } }"
        class="neighbour neighbour--next"
      >
        <span class="neighbour__dir">Уровень {{ neighbours.next.number }} →</span>
        <span class="neighbour__title">{{ neighbours.next.title }}</span>
      </RouterLink>
      <RouterLink v-else :to="{ name: 'graduation' }" class="neighbour neighbour--next">
        <span class="neighbour__dir">Финал курса →</span>
        <span class="neighbour__title">Выпускная работа</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.level {
  display: grid;
  gap: 2rem;
  padding-top: clamp(1.25rem, 3vw, 2rem);
}

/* ---------- Шапка: название слева, прогресс и продолжение справа ---------- */

.head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
  align-items: start;
  gap: 1.5rem 2.5rem;
  padding: clamp(1rem, 3vw, 2rem);
  border-radius: var(--radius-m);
  background:
    radial-gradient(30rem 16rem at 0% 0%, var(--tint), transparent 75%),
    linear-gradient(120deg, color-mix(in srgb, var(--tint) 55%, transparent), transparent 70%);
}
.head__intro {
  display: grid;
  gap: 0.9rem;
  max-width: 44rem;
}
.head__crumbs {
  font-family: var(--font-accent);
  font-size: 0.9rem;
  color: var(--ink-soft);
}
.head__title {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.head__emblem {
  --emblem-size: 5rem;
  flex: none;
  color: var(--tint-ink);
}
.head__lead {
  font-size: clamp(1.05rem, 1rem + 0.3vw, 1.2rem);
  color: var(--ink-soft);
}
.head__source {
  font-size: 0.9rem;
  color: var(--ink-faint);
}

.status {
  position: relative;
  display: grid;
  justify-items: start;
  gap: 0.85rem;
}
.status :deep(.meter) {
  width: 100%;
}
.status__detail {
  font-size: 0.92rem;
  color: var(--ink-soft);
}
.status__stamp {
  --hanko-size: 3.4rem;
  position: absolute;
  top: 0.6rem;
  right: 0.7rem;
  pointer-events: none;
}

.notice {
  max-width: 48rem;
  padding: 0.9rem 1.1rem;
  border-left: 3px solid var(--accent);
  background: var(--accent-wash);
  border-radius: 0 var(--radius-s) var(--radius-s) 0;
}

/* ---------- Навыки ---------- */

.skills {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 1.5rem 2.5rem;
}
.skills__list {
  display: grid;
  gap: 0.6rem;
  margin-top: 1rem;
  padding: 0;
  list-style: none;
  counter-reset: skill;
}
.skills__list li {
  position: relative;
  padding-left: 2.6rem;
  counter-increment: skill;
}
.skills__list li::before {
  content: counter(skill);
  position: absolute;
  left: 0;
  top: -0.15rem;
  width: 1.9rem;
  height: 1.9rem;
  display: grid;
  place-items: center;
  border: 1.5px solid color-mix(in srgb, var(--tint-ink) 45%, transparent);
  border-radius: 50%;
  background: var(--tint);
  font-family: var(--font-accent);
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--tint-ink);
}

/* ---------- Мини-лекция ---------- */

.lecture {
  display: grid;
  gap: 0.75rem;
}
.lecture__principle {
  font-size: clamp(1.05rem, 1rem + 0.25vw, 1.15rem);
}
.lecture__principle::first-letter {
  float: left;
  margin: 0.08em 0.12em 0 0;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 3.4em;
  line-height: 0.8;
  color: var(--accent);
}
.lecture__examples-title {
  margin-top: 0.75rem;
}
.lecture__examples {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  gap: 1rem;
  padding: 0;
  list-style: none;
}
.example {
  display: grid;
  align-content: start;
  gap: 0.5rem;
  padding: 1.1rem 1.2rem;
  border-top: 4px solid var(--tint-ink);
  background: linear-gradient(180deg, color-mix(in srgb, var(--tint) 70%, var(--paper-raised)), var(--paper-raised) 8rem);
  border-radius: var(--radius-s) var(--radius-s) var(--radius-m) var(--radius-m);
  box-shadow: var(--shadow);
}
.example p {
  font-size: 0.97rem;
}
.example__link {
  margin-top: 0.25rem;
  font-weight: 560;
}

/* ---------- Фильмы ---------- */

.films {
  display: grid;
  gap: 0.75rem;
}
.films__lead,
.terms__lead {
  max-width: var(--measure);
  color: var(--ink-soft);
}
.films__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 30rem), 1fr));
  gap: 1rem;
  margin-top: 0.5rem;
  padding: 0;
  list-style: none;
}
.film {
  position: relative;
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  gap: 1.1rem;
  padding: 0.9rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: linear-gradient(120deg, color-mix(in srgb, var(--tint) 40%, var(--paper-raised)), var(--paper-raised) 55%);
  box-shadow: var(--shadow);
}
.film--completed,
.film--reviewing {
  border-color: color-mix(in srgb, var(--moss) 55%, var(--line));
}
/* Вся карточка кликабельна через растянутую ссылку; фокус рисуется на карточке. */
.film:has(.film__link:focus-visible) {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}
.film__link {
  text-decoration: none;
}
.film__link::after {
  content: '';
  position: absolute;
  inset: 0;
}
.film__link:focus-visible {
  outline: none;
}
.film:hover .film__link {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}
.film__cover {
  align-self: start;
}
.film__text {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 0.3rem;
}
.film__meta {
  font-family: var(--font-accent);
  font-size: 0.85rem;
  color: var(--ink-soft);
}
.film__title {
  font-size: 1.5rem;
}
.film__director {
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.film__focus {
  font-size: 0.95rem;
}
.film__badge {
  margin-top: 0.35rem;
}
.films__source {
  font-size: 0.9rem;
  color: var(--ink-faint);
  max-width: var(--measure);
}

/* ---------- Термины ---------- */

.terms {
  display: grid;
  justify-items: start;
  gap: 0.75rem;
}
.terms__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0;
  list-style: none;
}
.term {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.3rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--tint-ink) 35%, transparent);
  border-radius: 999px;
  background: var(--tint);
  text-decoration: none;
}
.term:hover {
  border-color: var(--tint-ink);
}

/* ---------- Завершение ---------- */

.completion {
  display: grid;
  gap: 1.1rem;
  max-width: 48rem;
}
.completion h2:focus-visible {
  outline-offset: 6px;
}
.completion__lead {
  color: var(--ink-soft);
}
.completion__action {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}
.completion__hint {
  font-size: 0.92rem;
  color: var(--ink-soft);
}
.completion__done {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.completion__stamp {
  --hanko-size: 4rem;
  flex: none;
}
.completion__message:empty {
  display: none;
}
.completion__message {
  font-weight: 560;
  color: var(--moss);
}

/* ---------- Соседние уровни ---------- */

.neighbours {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
}
.neighbour {
  display: grid;
  gap: 0.15rem;
  min-height: 2.75rem;
  padding: 0.5rem 0;
  text-decoration: none;
}
.neighbour--next {
  grid-column: 2;
  text-align: right;
}
.neighbour__dir {
  font-family: var(--font-accent);
  font-size: 0.85rem;
  color: var(--ink-soft);
}
.neighbour__title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1.3rem;
  line-height: 1.2;
}
.neighbour:hover .neighbour__title {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18em;
}

/* ---------- Узкий экран: одна колонка ---------- */

@media (max-width: 52rem) {
  .head,
  .skills {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 30rem) {
  .level {
    gap: 1.5rem;
  }
  .head__emblem {
    --emblem-size: 3.5rem;
  }
  .film {
    grid-template-columns: 4.75rem minmax(0, 1fr);
    gap: 0.85rem;
    padding: 0.75rem;
  }
  .film__title {
    font-size: 1.3rem;
  }
  .neighbours {
    grid-template-columns: minmax(0, 1fr);
  }
  .neighbour--next {
    grid-column: 1;
    text-align: left;
  }
}
</style>
