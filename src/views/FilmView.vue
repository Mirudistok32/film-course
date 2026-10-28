<script setup lang="ts">
/**
 * Страница фильма (ТЗ §12): шапка со статусом и личными действиями,
 * урок тремя шагами-вкладками «Перед / Во время / После просмотра»
 * в липкой полосе вместе с переходами к упражнению, заметкам и итогу. Материал выдаётся порциями: открыт один шаг, образец
 * разбора — только по действию. Просмотр отмечается отдельно от разбора.
 * В строгом порядке фильм закрытого уровня открыт только для чтения.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import { usePageTitle } from '@/composables/usePageTitle'
import { useScrollTo } from '@/composables/useScrollTo'
import { useSectionSpy } from '@/composables/useSectionSpy'
import {
  completeFilm,
  markWatched,
  openFilm,
  setFavorite,
  setReviewing,
  setRevisitLater,
  startWatching,
  unmarkWatched,
} from '@/domain/progress/progress.actions'
import {
  canCompleteFilm,
  FILM_STAGES,
  filmCompletionCriteria,
  filmDisplayStatus,
  filmStartStage,
  isLevelLocked,
  type FilmStage,
} from '@/domain/progress/progress.selectors'
import { filmNeighbours } from '@/domain/catalog/catalog'
import type { GlossaryTerm } from '@/domain/catalog/catalog.types'
import { XP_RULES } from '@/domain/rewards/rewards.config'
import { formatDate } from '@/domain/shared/dates'
import { levelTint } from '@/domain/shared/tint'
import AppButton from '@/components/AppButton.vue'
import CriteriaList from '@/components/CriteriaList.vue'
import FilmCover from '@/components/FilmCover.vue'
import IntertitleCard from '@/components/IntertitleCard.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import AnswerChain from '@/components/film/AnswerChain.vue'
import FilmExercise from '@/components/film/FilmExercise.vue'
import FilmNotes from '@/components/film/FilmNotes.vue'
import FilmStageNav, { FILM_SECTIONS, type FilmJump } from '@/components/film/FilmStageNav.vue'
import HankoStamp from '@/illustrations/HankoStamp.vue'
import InkDivider from '@/illustrations/InkDivider.vue'
import NotFoundView from './NotFoundView.vue'

const route = useRoute()
const router = useRouter()
const store = useProgressStore()
const course = computed(() => store.course)
const p = computed(() => store.progress)

const film = computed(() => course.value.filmById.get(String(route.params.filmId)) ?? null)
const level = computed(() => (film.value ? (course.value.levelById.get(film.value.levelId) ?? null) : null))
const lesson = computed(() => film.value?.lesson ?? null)
usePageTitle(() => (film.value ? `${film.value.title} (${film.value.year})` : 'Страница не найдена'))

const fp = computed(() => (film.value ? p.value.films[film.value.id] : undefined))
const status = computed(() => filmDisplayStatus(fp.value))
const locked = computed(() => (level.value ? isLevelLocked(course.value, level.value, p.value) : false))
const prevLevel = computed(() => (level.value ? (course.value.levels[course.value.levels.indexOf(level.value) - 1] ?? null) : null))
const neighbours = computed(() =>
  film.value && level.value ? filmNeighbours(level.value, film.value.id) : { prev: null, next: null },
)

/** Год, режиссёр; страна и хронометраж — только если заполнены в каталоге (ТЗ §12.1). */
const facts = computed(() => {
  const f = film.value
  if (!f) return []
  return [String(f.year), f.director, f.country, f.runtimeMinutes ? `${f.runtimeMinutes} мин` : null].filter(Boolean)
})

const terms = computed(() =>
  (lesson.value?.terms ?? [])
    .map((id) => course.value.termById.get(id))
    .filter((t): t is GlossaryTerm => Boolean(t)),
)

const gamified = computed(() => store.settings.showGamification)
const message = ref('')

/* ---------- Шаги урока ---------- */

/** Шаг по умолчанию считается при открытии фильма и дальше сам не прыгает. */
const initialStage = ref<FilmStage>('before')

watch(
  () => film.value?.id,
  (id) => {
    message.value = ''
    if (!id || !film.value) return
    initialStage.value = filmStartStage(p.value.films[id])
    const levelId = film.value.levelId
    if (!locked.value && !store.persistenceBlocked) store.apply((q) => openFilm(q, id, levelId))
  },
  { immediate: true },
)

const stage = computed<FilmStage>(() => {
  const q = route.query.step
  return FILM_STAGES.find((s) => s === q) ?? initialStage.value
})

const scrollTo = useScrollTo()
/** Высота липкой полосы в пикселях (3rem) — с запасом на округление. */
const STAGE_NAV_HEIGHT = 56
const lessonEl = ref<HTMLElement | null>(null)

/**
 * Шаг хранится в адресе (?step=after): переживает перезагрузку и кнопку «назад».
 * Если начало урока уже ушло под липкую полосу (переключили шаг снизу), новый
 * шаг показывается с начала; фокус остаётся на нажатой кнопке.
 */
async function selectStage(s: FilmStage, reveal = true) {
  if (s !== stage.value) await router.replace({ query: { ...route.query, step: s } })
  if (!reveal) return
  await nextTick()
  const el = lessonEl.value
  if (el && el.getBoundingClientRect().top < STAGE_NAV_HEIGHT) scrollTo(el, null)
}

/* ---------- Липкая полоса: где читают и куда перейти ---------- */

const exerciseCmp = ref<InstanceType<typeof FilmExercise> | null>(null)
const notes = ref<InstanceType<typeof FilmNotes> | null>(null)
const completionEl = ref<HTMLElement | null>(null)

const sectionEls = () => ({
  lesson: lessonEl.value,
  exercise: exerciseCmp.value?.$el as HTMLElement | undefined,
  notes: notes.value?.$el as HTMLElement | undefined,
  completion: completionEl.value,
})
const currentSection = useSectionSpy(FILM_SECTIONS, sectionEls)

const jumps = computed<FilmJump[]>(() => (lesson.value ? ['exercise', 'notes', 'completion'] : ['notes', 'completion']))

/** Упражнение — внутри шага «После просмотра»: сначала открыть шаг. */
async function jump(section: FilmJump) {
  if (section === 'exercise') await selectStage('after', false)
  await nextTick()
  scrollTo(sectionEls()[section])
}

/* ---------- Действия ---------- */

function act(change: Parameters<typeof store.apply>[0]) {
  if (film.value && !locked.value) store.apply(change)
}

function begin() {
  const id = film.value?.id
  if (!id) return
  act((q, now) => startWatching(q, id, now))
  selectStage('during')
}

function watched() {
  const id = film.value?.id
  if (!id) return
  act((q, now) => markWatched(q, id, now))
  message.value = gamified.value
    ? `Просмотр отмечен (+${XP_RULES.filmWatched} XP). Разбор можно начать сейчас или позже.`
    : 'Просмотр отмечен. Разбор можно начать сейчас или позже.'
  selectStage('after')
}

function unwatch() {
  const id = film.value?.id
  if (!id) return
  act((q, now) => unmarkWatched(q, id, now))
  message.value = 'Отметка о просмотре снята.'
}

function toggleFavorite() {
  const id = film.value?.id
  if (id) act((q, now) => setFavorite(q, id, !fp.value?.isFavorite, now))
}

function toggleRevisit() {
  const id = film.value?.id
  if (id) act((q, now) => setRevisitLater(q, id, !fp.value?.revisitLater, now))
}

function toggleReviewing() {
  const id = film.value?.id
  if (id) act((q, now) => setReviewing(q, id, !fp.value?.reviewing, now))
}

const criteria = computed(() => (film.value ? filmCompletionCriteria(p.value, film.value.id) : []))
const canComplete = computed(() => (film.value ? canCompleteFilm(p.value, film.value.id) : false))

function finishFilm() {
  const id = film.value?.id
  if (!id || !canComplete.value) return
  act((q, now) => completeFilm(q, id, now))
  if (fp.value?.completedAt) message.value = 'Фильм пройден. К нему можно возвращаться: новые заметки тоже сохраняются.'
}
</script>

<template>
  <NotFoundView v-if="!film || !level" />
  <div v-else class="film container" :data-tint="levelTint(level.number)">
    <header class="head">
      <FilmCover :film="film" class="head__cover" />
      <div class="head__intro">
        <p class="head__crumbs">
          <RouterLink :to="{ name: 'level', params: { levelId: level.id } }">
            Уровень {{ level.number }}. {{ level.title }}
          </RouterLink>
          <span aria-hidden="true"> · </span>
          <span>фильм {{ film.order }} из {{ level.films.length }}</span>
        </p>
        <h1>{{ film.title }}</h1>
        <p v-if="film.originalTitle" class="head__original">{{ film.originalTitle }}</p>
        <p class="head__facts">{{ facts.join(' · ') }}</p>
        <p class="head__focus">{{ film.learningFocus }}</p>
        <p v-if="film.status === 'proposed-expansion'" class="head__source">
          Фильм входит в предложенное расширение программы: урок ещё проходит редактуру.
        </p>
      </div>

      <aside class="card status" :data-tint="levelTint(level.number)" aria-label="Ваш статус и действия">
        <StatusBadge :film="status" />
        <template v-if="!locked">
          <template v-if="fp?.watchStatus === 'watched'">
            <p class="status__fact">Просмотрен {{ formatDate(fp.watchedAt) }}</p>
            <AppButton v-if="!fp.completedAt" variant="ghost" @click="unwatch">Снять отметку о просмотре</AppButton>
          </template>
          <div v-else class="status__row">
            <AppButton variant="primary" @click="watched">Отметить просмотр</AppButton>
            <AppButton v-if="status === 'not-started'" @click="begin">Начинаю смотреть</AppButton>
          </div>
          <div class="status__row">
            <AppButton variant="ghost" :aria-pressed="Boolean(fp?.isFavorite)" @click="toggleFavorite">
              <svg class="icon" :class="{ 'icon--on': fp?.isFavorite }" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
              </svg>
              {{ fp?.isFavorite ? 'В избранном' : 'В избранное' }}
            </AppButton>
            <AppButton variant="ghost" @click="notes?.focusInput()">Записать заметку</AppButton>
          </div>
        </template>
        <p class="status__message" role="status">{{ message }}</p>
        <span v-if="fp?.completedAt" class="status__stamp" aria-hidden="true">
          <HankoStamp text="фильм пройден" />
        </span>
      </aside>
    </header>

    <p v-if="locked && prevLevel" class="notice">
      <strong>Режим обзора.</strong> Включён строгий порядок: урок можно читать уже сейчас, а отмечать просмотр и
      записывать ответы — после уровня {{ prevLevel.number }}.
      <RouterLink :to="{ name: 'data' }">Изменить в настройках</RouterLink>
    </p>

    <p v-if="lesson?.contentNote" class="notice notice--content">
      <strong>Перед просмотром.</strong> {{ lesson.contentNote }}
    </p>

    <FilmStageNav :stage="stage" :current="currentSection" :jumps="jumps" @select="selectStage" @jump="jump" />

    <section ref="lessonEl" class="lesson" aria-label="Урок">
      <!-- Перед просмотром: короткая настройка внимания сразу, без длинной лекции. -->
      <div v-show="stage === 'before'" id="panel-before" class="panel" role="tabpanel" aria-labelledby="tab-before" tabindex="0">
        <template v-if="lesson">
          <h2 class="panel__title">Короткая настройка внимания</h2>
          <div class="before">
            <IntertitleCard caption="вопрос на просмотр">{{ lesson.startQuestion }}</IntertitleCard>
            <div>
              <h3 class="panel__subtitle">Обратите внимание</h3>
              <ul class="look-for">
                <li v-for="item in lesson.lookFor" :key="item">{{ item }}</li>
              </ul>
              <p class="panel__note">Не нужно ловить всё сразу — хватит одной-двух вещей.</p>
            </div>
          </div>
          <h3 class="panel__subtitle">Почему этот фильм на этом уровне</h3>
          <p class="prose">{{ lesson.why }}</p>
          <div v-if="terms.length" class="terms">
            <h3 class="panel__subtitle">Термины урока</h3>
            <ul class="terms__list">
              <li v-for="t in terms" :key="t.id">
                <RouterLink :to="{ name: 'glossary', query: { term: t.id } }" class="term">{{ t.term }}</RouterLink>
              </li>
            </ul>
          </div>
        </template>
        <p v-else class="prose">Урок к этому фильму ещё пишется. Смотрите с вопросом уровня: {{ level.purpose }}</p>
        <div v-if="!locked" class="panel__next">
          <AppButton v-if="status === 'not-started'" variant="primary" @click="begin">Начинаю смотреть</AppButton>
          <AppButton v-else @click="selectStage('during')">Дальше: во время просмотра</AppButton>
        </div>
      </div>

      <!-- Во время просмотра: несколько ориентиров, без таймкодов. -->
      <div v-show="stage === 'during'" id="panel-during" class="panel" role="tabpanel" aria-labelledby="tab-during" tabindex="0">
        <h2 class="panel__title">Ориентиры на время просмотра</h2>
        <p class="panel__lead">
          Страницу можно оставить открытой или вернуться к ней после. Таймкоды не нужны: версии фильма отличаются
          длительностью и монтажом. Ориентиры не подсказывают ответ — только куда смотреть.
        </p>
        <ul v-if="lesson" class="cues">
          <li v-for="cue in lesson.duringCues" :key="cue" class="cue">{{ cue }}</li>
        </ul>
        <div v-if="!locked" class="panel__next">
          <AppButton v-if="fp?.watchStatus !== 'watched'" variant="primary" @click="watched">
            Досмотрел — отметить просмотр
          </AppButton>
          <AppButton v-else variant="primary" @click="selectStage('after')">Дальше: после просмотра</AppButton>
          <AppButton variant="ghost" @click="notes?.focusInput()">Записать мысль</AppButton>
        </div>
      </div>

      <!-- После просмотра: цепочка ответа и основное упражнение. -->
      <div v-show="stage === 'after'" id="panel-after" class="panel" role="tabpanel" aria-labelledby="tab-after" tabindex="0">
        <h2 class="panel__title">Вопросы после просмотра</h2>
        <p class="panel__lead">
          От наблюдения к мысли: сначала то, что видно и слышно, потом чувство, гипотеза и довод. На каждое поле хватит
          одной-двух фраз — ответы сохраняются автоматически.
        </p>
        <AnswerChain :film-id="film.id" :questions="lesson?.afterQuestions" :readonly="locked" />
        <FilmExercise
          v-if="lesson"
          ref="exerciseCmp"
          tabindex="-1"
          :film-id="film.id"
          :exercise="lesson.exercise"
          :samples="lesson.samples"
          :readonly="locked"
          class="panel__exercise"
        />
      </div>
    </section>

    <InkDivider />
    <FilmNotes ref="notes" tabindex="-1" :film-id="film.id" :readonly="locked" />

    <section ref="completionEl" class="completion card" tabindex="-1" aria-labelledby="completion-title">
      <h2 id="completion-title">Итог фильма</h2>
      <div v-if="fp?.completedAt" class="completion__done">
        <HankoStamp class="completion__stamp" text="фильм пройден" />
        <p>
          <strong>Фильм пройден</strong> ({{ formatDate(fp.completedAt) }}). К нему можно возвращаться: пересматривать,
          дописывать ответы и заметки.
        </p>
      </div>
      <template v-else>
        <p class="completion__lead">
          Просмотр отмечается отдельно от разбора: факт просмотра не потеряется, даже если сейчас нет сил отвечать.
          <template v-if="store.settings.lightMode">Включён облегчённый режим: вместо упражнения хватит короткой записи.</template>
        </p>
        <CriteriaList :criteria="criteria" />
      </template>

      <div v-if="!locked" class="completion__actions">
        <AppButton v-if="!fp?.completedAt" variant="primary" :disabled="!canComplete" aria-describedby="film-completion-hint" @click="finishFilm">
          Отметить фильм пройденным
        </AppButton>
        <AppButton v-else :aria-pressed="Boolean(fp.reviewing)" @click="toggleReviewing">
          {{ fp.reviewing ? 'Разбираю повторно — снять' : 'Разбираю повторно' }}
        </AppButton>
        <AppButton variant="ghost" :aria-pressed="Boolean(fp?.revisitLater)" @click="toggleRevisit">
          <svg class="icon" :class="{ 'icon--on': fp?.revisitLater }" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M4 1.8h8v12.4l-4-3-4 3z" />
          </svg>
          {{ fp?.revisitLater ? 'Вернусь позже — отмечено' : 'Хочу вернуться позже' }}
        </AppButton>
      </div>
      <p v-if="!locked && !fp?.completedAt" id="film-completion-hint" class="completion__hint">
        {{ canComplete ? 'Все условия выполнены.' : 'Кнопка станет доступна, когда все условия будут выполнены.' }}
      </p>
    </section>

    <nav class="neighbours" aria-label="Соседние фильмы">
      <RouterLink v-if="neighbours.prev" :to="{ name: 'film', params: { filmId: neighbours.prev.id } }" class="neighbour">
        <span class="neighbour__dir">← Фильм {{ neighbours.prev.order }}</span>
        <span class="neighbour__title">{{ neighbours.prev.title }}</span>
      </RouterLink>
      <RouterLink v-else :to="{ name: 'level', params: { levelId: level.id } }" class="neighbour">
        <span class="neighbour__dir">← К уровню {{ level.number }}</span>
        <span class="neighbour__title">{{ level.title }}</span>
      </RouterLink>
      <RouterLink
        v-if="neighbours.next"
        :to="{ name: 'film', params: { filmId: neighbours.next.id } }"
        class="neighbour neighbour--next"
      >
        <span class="neighbour__dir">Фильм {{ neighbours.next.order }} →</span>
        <span class="neighbour__title">{{ neighbours.next.title }}</span>
      </RouterLink>
      <RouterLink v-else :to="{ name: 'level', params: { levelId: level.id } }" class="neighbour neighbour--next">
        <span class="neighbour__dir">К итогу уровня {{ level.number }} →</span>
        <span class="neighbour__title">{{ level.title }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.film {
  display: grid;
  gap: 2rem;
  padding-top: clamp(1.25rem, 3vw, 2rem);
}

/* ---------- Шапка: обложка, название, статус ---------- */

.head {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr) minmax(16rem, 20rem);
  align-items: start;
  gap: 1.5rem 2rem;
  padding: clamp(1rem, 3vw, 2rem);
  border-radius: var(--radius-m);
  background:
    radial-gradient(30rem 16rem at 0% 0%, var(--tint), transparent 75%),
    linear-gradient(120deg, color-mix(in srgb, var(--tint) 55%, transparent), transparent 70%);
}
.head__cover {
  align-self: start;
}
.head__intro {
  display: grid;
  gap: 0.6rem;
  max-width: 44rem;
}
.head__crumbs {
  font-family: var(--font-accent);
  font-size: 0.9rem;
  color: var(--ink-soft);
}
.head__original {
  font-family: var(--font-accent);
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.head__facts {
  font-weight: 560;
}
.head__focus {
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
  gap: 0.75rem;
}
.status__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.status__fact {
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.status__message:empty {
  display: none;
}
.status__message {
  font-size: 0.95rem;
  font-weight: 560;
  color: var(--moss);
}
.status__stamp {
  --hanko-size: 3.4rem;
  position: absolute;
  top: 0.6rem;
  right: 0.7rem;
  pointer-events: none;
}
.icon {
  width: 1.05rem;
  height: 1.05rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linejoin: round;
}
.icon--on {
  fill: var(--gold);
  stroke: var(--gold);
}

.notice {
  max-width: 48rem;
  padding: 0.9rem 1.1rem;
  border-left: 3px solid var(--accent);
  background: var(--accent-wash);
  border-radius: 0 var(--radius-s) var(--radius-s) 0;
}
.notice--content {
  border-left-color: var(--gold);
  background: var(--paper-sunken);
}

/* ---------- Шаги урока ---------- */

.lesson {
  display: grid;
  gap: 1.5rem;
}
.panel {
  display: grid;
  gap: 1rem;
  max-width: 52rem;
}
.panel:focus-visible {
  outline-offset: 8px;
}
.panel__title {
  font-size: clamp(1.45rem, 1.2rem + 0.9vw, 1.8rem);
}
.panel__subtitle {
  margin-top: 0.5rem;
  font-size: 1.2rem;
}
.panel__lead,
.panel__note {
  color: var(--ink-soft);
}
.panel__note {
  margin-top: 0.5rem;
  font-size: 0.92rem;
}
.panel__next {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.panel__exercise {
  margin-top: 1rem;
}

.before {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  align-items: center;
  gap: 1.25rem 2rem;
}
.look-for,
.cues {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0;
  list-style: none;
}
.look-for li,
.cue {
  position: relative;
  padding-left: 1.5rem;
}
/* Маркер — кадрик плёнки. */
.look-for li::before,
.cue::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 0.7rem;
  height: 0.55rem;
  border: 1.5px solid var(--line-strong);
  border-radius: 2px;
}
.cues {
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-m);
  background: var(--paper-raised);
  gap: 0.75rem;
}

.terms__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0;
  list-style: none;
}
.term {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--paper-raised);
  text-decoration: none;
}
.term:hover {
  border-color: var(--accent);
}

/* ---------- Итог ---------- */

.completion {
  display: grid;
  gap: 1rem;
  max-width: 48rem;
}
.completion__lead,
.completion__hint {
  color: var(--ink-soft);
}
.completion__hint {
  font-size: 0.92rem;
}
.completion__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
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

/* ---------- Соседние фильмы ---------- */

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

@media (max-width: 60rem) {
  .head {
    grid-template-columns: 7.5rem minmax(0, 1fr);
  }
  .status {
    grid-column: 1 / -1;
  }
}

@media (max-width: 40rem) {
  .before {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 30rem) {
  .film {
    gap: 1.5rem;
  }
  .head {
    grid-template-columns: 4.75rem minmax(0, 1fr);
    gap: 1rem;
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
