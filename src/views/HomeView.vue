<script setup lang="ts">
/**
 * Главная (ТЗ §9): суть курса, общий прогресс, кнопка продолжения
 * к последнему незавершённому шагу, текущий уровень, последние заметки
 * и резервная копия. Без прогресса — спокойный стартовый сценарий;
 * вернувшемуся ученику сразу под кадром — блок «Продолжить».
 */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useProgressStore } from '@/stores/progress'
import {
  backupReminder,
  courseStats,
  FILM_STAGE_LABEL,
  hasMarkedFilm,
  resumeInfo,
} from '@/domain/progress/progress.selectors'
import { rankFor } from '@/domain/rewards/rewards.engine'
import { formatDateTime } from '@/domain/shared/dates'
import { excerpt, plural } from '@/domain/shared/text'
import { levelTint, TINTS } from '@/domain/shared/tint'
import AppButton from '@/components/AppButton.vue'
import DisclosurePanel from '@/components/DisclosurePanel.vue'
import FilmCover from '@/components/FilmCover.vue'
import IntertitleCard from '@/components/IntertitleCard.vue'
import ProgressMeter from '@/components/ProgressMeter.vue'
import HeroScene from '@/illustrations/HeroScene.vue'
import HankoStamp from '@/illustrations/HankoStamp.vue'
import InkDivider from '@/illustrations/InkDivider.vue'
import InkVignette from '@/illustrations/InkVignette.vue'
import LevelEmblem from '@/illustrations/LevelEmblem.vue'

const store = useProgressStore()
const course = computed(() => store.course)
const p = computed(() => store.progress)

const stats = computed(() => courseStats(course.value, p.value))
const resume = computed(() => resumeInfo(course.value, p.value))
const resumeFilm = computed(() => {
  const step = resume.value.step
  return step.kind === 'film' || step.kind === 'start' ? step.film : null
})
/** После первого отмеченного фильма подсказки новичку сворачиваются. */
const howFolded = computed(() => hasMarkedFilm(p.value))
const rank = computed(() => rankFor(p.value.xp))
const reminder = computed(() => backupReminder(p.value, store.now()))

const cta = computed<{ label: string; detail: string; to: RouteLocationRaw }>(() => {
  const step = resume.value.step
  switch (step.kind) {
    case 'start':
      return {
        label: 'Начать курс',
        detail: `Уровень 1 · первый фильм — «${step.film.title}»`,
        to: { name: 'film', params: { filmId: step.film.id } },
      }
    case 'film':
      return {
        label: 'Продолжить',
        detail: `${step.reason === 'current' ? 'Вы остановились на фильме' : 'Следующий фильм'} «${step.film.title}» · уровень ${step.level.number}`,
        to: { name: 'film', params: { filmId: step.film.id } },
      }
    case 'level':
      return {
        label: 'Завершить уровень',
        detail: `Критерии уровня ${step.level.number} «${step.level.title}» выполнены`,
        to: { name: 'level', params: { levelId: step.level.id } },
      }
    case 'graduation':
      return { label: 'К выпускной работе', detail: 'Все уровни пройдены', to: { name: 'graduation' } }
    default:
      return {
        label: 'Открыть карту курса',
        detail: 'Курс пройден — можно возвращаться к любимым фильмам',
        to: { name: 'course' },
      }
  }
})

/** Где пользователь остановился: шаг урока или место фильма в порядке курса. */
const resumeWhere = computed(() => {
  const { step, stage } = resume.value
  if (step.kind !== 'film') return ''
  if (stage) return `Вы остановились на шаге «${FILM_STAGE_LABEL[stage]}»`
  return step.reason === 'current' ? 'Вы открывали этот урок' : 'Следующий фильм по порядку уровня'
})

const resumeLevelLabel = computed(() => {
  const { stats, filmsLeft } = resume.value
  if (!stats) return ''
  const films = (n: number) => plural(n, ['фильм', 'фильма', 'фильмов'])
  return filmsLeft
    ? `В уровне ${plural(filmsLeft, ['остался', 'осталось', 'осталось'])} ${filmsLeft} ${films(filmsLeft)} из ${stats.total}`
    : `Все ${stats.total} ${films(stats.total)} уровня пройдены`
})

const recentNotes = computed(() =>
  [...p.value.notes]
    .filter((n) => n.text.trim() !== '')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)
    .map((n) => ({ ...n, film: n.filmId ? course.value.filmById.get(n.filmId) : undefined })),
)

const HOW = [
  {
    title: 'Настройтесь',
    text: 'Откройте урок фильма и прочитайте, на что обратить внимание. Ответов заранее нет — только вопросы.',
  },
  {
    title: 'Посмотрите фильм',
    text: 'Фильмов на сайте нет: смотрите там, где вам удобно, и возвращайтесь с впечатлениями.',
  },
  {
    title: 'Ответьте цепочкой',
    text: '«Я заметил…» → «Это заставило почувствовать…» → «Возможно, это означает…» → «На это указывает…».',
  },
  {
    title: 'Сохраните копию',
    text: 'Прогресс хранится только в этом браузере. Раз в несколько занятий скачивайте резервную копию в JSON.',
  },
]

function exportNow() {
  if (!store.exportBackup()) store.notify('error', 'Не удалось скачать копию', 'Браузер запретил скачивание файла.')
}
</script>

<template>
  <div class="home">
    <section class="hero container" aria-labelledby="home-title">
      <HeroScene class="hero__scene" />
      <div v-if="!store.started" class="hero__text">
        <p class="eyebrow">
          Тренажёр внимательного просмотра · {{ stats.totalLevels }} уровней · {{ stats.totalFilms }} фильмов
        </p>
        <h1 id="home-title">{{ course.title }}</h1>
        <p class="hero__lead">{{ course.description }}</p>
        <div class="hero__cta">
          <AppButton variant="primary" size="l" :to="cta.to">{{ cta.label }}</AppButton>
          <p class="hero__next">{{ cta.detail }}</p>
        </div>
        <RouterLink :to="{ name: 'course' }" class="hero__map">Карта всех {{ stats.totalLevels }} уровней</RouterLink>
      </div>
      <h1 v-else id="home-title" class="visually-hidden">{{ course.title }}</h1>
    </section>

    <section v-if="store.started" class="resume container" aria-labelledby="resume-title">
      <article class="card resume__card" :data-tint="resume.level ? levelTint(resume.level.number) : 'mint'">
        <div class="resume__art">
          <FilmCover v-if="resumeFilm" :film="resumeFilm" class="resume__cover" />
          <LevelEmblem
            v-else-if="resume.step.kind === 'level'"
            :level="resume.step.level.number"
            class="resume__emblem"
          />
          <HankoStamp v-else :text="resume.step.kind === 'done' ? 'курс пройден' : 'все уровни'" center="13" />
        </div>

        <div class="resume__info">
          <p class="eyebrow">
            Продолжить<template v-if="resume.level">
              · уровень {{ resume.level.number }} «{{ resume.level.title }}»</template
            >
          </p>
          <template v-if="resumeFilm">
            <h2 id="resume-title" class="resume__title">«{{ resumeFilm.title }}»</h2>
            <p class="resume__meta">{{ resumeFilm.director }}, {{ resumeFilm.year }}</p>
            <p v-if="resumeWhere" class="resume__where">{{ resumeWhere }}</p>
          </template>
          <template v-else-if="resume.step.kind === 'level'">
            <h2 id="resume-title" class="resume__title">Уровень можно завершить</h2>
            <p class="resume__where">
              Условия уровня выполнены — подведите итог на его странице.
              <template v-if="resume.filmsLeft">Остальные фильмы можно досмотреть и после.</template>
            </p>
          </template>
          <template v-else-if="resume.step.kind === 'graduation'">
            <h2 id="resume-title" class="resume__title">Выпускная работа</h2>
            <p class="resume__where">
              Все уровни пройдены — осталась выпускная работа: разбор одного фильма от наблюдения до вопроса.
            </p>
          </template>
          <template v-else>
            <h2 id="resume-title" class="resume__title">Курс пройден</h2>
            <p class="resume__where">Возвращайтесь к фильмам, связывайте мотивы и пересматривайте разборы.</p>
          </template>
        </div>

        <div v-if="resume.stats" class="resume__level">
          <ProgressMeter :value="resume.stats.completed" :max="resume.stats.total" :label="resumeLevelLabel" />
        </div>

        <div class="resume__actions">
          <AppButton variant="primary" size="l" :to="cta.to">{{ cta.label }}</AppButton>
          <RouterLink
            v-if="resume.level && resume.step.kind !== 'level'"
            :to="{ name: 'level', params: { levelId: resume.level.id } }"
          >
            Открыть уровень
          </RouterLink>
          <RouterLink :to="{ name: 'course' }">Карта курса</RouterLink>
        </div>
      </article>
    </section>

    <section class="how container" :class="{ 'how--folded': howFolded }" aria-label="Как это устроено">
      <component :is="howFolded ? DisclosurePanel : 'div'" v-bind="howFolded ? { summary: 'Как это устроено' } : {}">
        <template v-if="!howFolded">
          <InkDivider />
          <h2 id="how-title">Как это устроено</h2>
        </template>
        <ol class="how__steps">
          <li v-for="(step, i) in HOW" :key="step.title" class="how__step" :data-tint="TINTS[i % TINTS.length]">
            <span class="how__num" aria-hidden="true">{{ i + 1 }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </li>
        </ol>
        <IntertitleCard caption="главное правило курса"
          >Сначала смотрите, потом объясняйте: наблюдение — раньше интерпретации.</IntertitleCard
        >
      </component>
    </section>

    <section v-if="store.started" class="dashboard container" aria-label="Ваш прогресс">
      <InkDivider />
      <div class="dashboard__grid">
        <article class="card path" data-tint="sky">
          <h2 class="card__title">Ваш путь</h2>
          <ProgressMeter
            :value="stats.levelsCompleted"
            :max="stats.totalLevels"
            :label="`Пройдено уровней: ${stats.levelsCompleted} из ${stats.totalLevels}`"
          />
          <ProgressMeter
            :value="stats.filmsCompleted"
            :max="stats.totalFilms"
            :label="`Пройдено фильмов: ${stats.filmsCompleted} из ${stats.totalFilms} · просмотрено ${stats.filmsWatched}`"
          />
          <p v-if="store.settings.showGamification" class="path__rank">
            Ранг: <strong>{{ rank.rank.title }}</strong> · {{ p.xp }} XP
            <template v-if="rank.next"> · до ранга «{{ rank.next.title }}» {{ rank.next.minXp - p.xp }} XP</template>
          </p>
        </article>

        <article class="card notes" data-tint="lavender">
          <h2 class="card__title">Последние записи</h2>
          <ul v-if="recentNotes.length" class="notes__list">
            <li v-for="n in recentNotes" :key="n.id">
              <p class="notes__film">
                <RouterLink v-if="n.film" :to="{ name: 'film', params: { filmId: n.film.id } }"
                  >«{{ n.film.title }}»</RouterLink
                >
                <span v-else>Свободная заметка</span>
                <span class="muted"> · {{ formatDateTime(n.updatedAt) }}</span>
              </p>
              <p class="notes__text">{{ excerpt(n.text, 140) }}</p>
            </li>
          </ul>
          <div v-else class="notes__empty">
            <InkVignette name="notebook" />
            <p class="muted">Заметок пока нет. Они появятся здесь, когда вы начнёте записывать наблюдения.</p>
          </div>
          <RouterLink :to="{ name: 'journal' }">Открыть журнал</RouterLink>
        </article>
      </div>
    </section>

    <section class="backup container" aria-labelledby="backup-title">
      <div class="backup__card" :class="{ 'backup__card--remind': reminder.show }">
        <div class="backup__text">
          <h2 id="backup-title" class="card__title">Резервная копия</h2>
          <p v-if="reminder.show" class="backup__reminder">{{ reminder.message }} Самое время сохранить копию.</p>
          <p class="muted">
            Последняя копия:
            {{ p.backup.lastExportAt ? formatDateTime(p.backup.lastExportAt) : 'ещё не скачивалась' }}. Файл JSON можно
            загрузить обратно в любом браузере.
          </p>
        </div>
        <div class="backup__actions">
          <AppButton variant="primary" @click="exportNow">Скачать копию (JSON)</AppButton>
          <AppButton v-if="reminder.show" variant="ghost" @click="store.snoozeReminderDays(7)"
            >Напомнить через неделю</AppButton
          >
          <RouterLink :to="{ name: 'data' }">Импорт и настройки</RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: 1rem;
}

.hero {
  padding-top: clamp(1rem, 3vw, 2rem);
}
.hero__scene {
  box-shadow: var(--shadow);
}
.hero__text {
  max-width: 46rem;
  margin: clamp(1.5rem, 4vw, 2.5rem) auto 0;
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 0.9rem;
}
.hero__lead {
  font-size: clamp(1.05rem, 1rem + 0.4vw, 1.25rem);
  color: var(--ink-soft);
}
.hero__cta {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.hero__next {
  font-size: 0.95rem;
  color: var(--ink-soft);
}
.hero__map {
  font-size: 0.95rem;
}

.card__title {
  font-size: 1.6rem;
}

.resume {
  margin-top: clamp(1rem, 3vw, 1.75rem);
}
.resume__card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    'art info'
    'level level'
    'actions actions';
  align-items: center;
  gap: 1rem 1.25rem;
}
.resume__art {
  grid-area: art;
  align-self: start;
}
.resume__cover {
  width: clamp(4.75rem, 18vw, 7rem);
}
.resume__emblem {
  width: 4.5rem;
  height: 4.5rem;
  color: var(--tint-ink);
}
.resume__info {
  grid-area: info;
  display: grid;
  gap: 0.35rem;
}
.resume__title {
  font-size: clamp(1.4rem, 1.2rem + 1vw, 2rem);
  overflow-wrap: anywhere;
}
.resume__meta {
  color: var(--ink-soft);
}
.resume__where {
  font-size: 0.97rem;
}
.resume__level {
  grid-area: level;
}
.resume__actions {
  grid-area: actions;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
}
@media (min-width: 52rem) {
  .resume__card {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'art info actions'
      'art level actions';
    column-gap: 2rem;
  }
  .resume__level {
    max-width: 28rem;
  }
  .resume__actions {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
}
@media (max-width: 30rem) {
  .resume__actions > :first-child {
    flex: 1 1 100%;
  }
}

.how--folded {
  margin-top: 0.5rem;
}
.how__steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1.25rem;
  margin: 1.5rem 0 2rem;
  padding: 0;
  list-style: none;
}
.how__step {
  position: relative;
  padding: 1.25rem;
  border-top: 4px solid var(--tint-ink);
  border-radius: var(--radius-s) var(--radius-s) var(--radius-m) var(--radius-m);
  background: linear-gradient(180deg, var(--tint), color-mix(in srgb, var(--tint) 30%, transparent));
}
.how__step h3 {
  margin-bottom: 0.35rem;
}
.how__step p {
  color: var(--ink-soft);
  font-size: 0.97rem;
}
.how__num {
  display: block;
  font-family: var(--font-accent);
  font-size: 2.4rem;
  line-height: 1;
  color: var(--tint-ink);
  margin-bottom: 0.25rem;
}
.how h2 {
  text-align: center;
}

.dashboard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: 1.25rem;
  align-items: start;
}
.dashboard__grid .card {
  display: grid;
  gap: 1rem;
}
.path__rank {
  font-size: 0.95rem;
}
.path__rank strong {
  font-family: var(--font-display);
  font-size: 1.15rem;
}
.notes__list {
  display: grid;
  gap: 0.9rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.notes__film {
  font-size: 0.9rem;
}
.notes__text {
  font-size: 0.97rem;
}
.notes__empty {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  text-align: center;
}

.backup {
  margin-top: 1.5rem;
}
.backup__card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem 2rem;
  padding: 1.25rem 1.5rem;
  border: 1px dashed color-mix(in srgb, var(--tint-peach-ink) 55%, transparent);
  border-radius: var(--radius-m);
  background: color-mix(in srgb, var(--tint-peach) 55%, transparent);
}
.backup__card--remind {
  border-style: solid;
  border-color: var(--accent);
  background: var(--accent-wash);
}
.backup__text {
  flex: 1 1 22rem;
  display: grid;
  gap: 0.35rem;
}
.backup__reminder {
  font-weight: 560;
}
.backup__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
}
</style>
