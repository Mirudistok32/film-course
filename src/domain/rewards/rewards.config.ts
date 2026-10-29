/**
 * Все числа и условия геймификации — в одном месте (ТЗ §16–18, §31).
 * Награды выдаются за проверяемые состояния прогресса, а не за клики:
 * поэтому повторный рендер, правка опечатки или повторный импорт
 * ничего не начисляют второй раз.
 */
import type { Course, ExerciseTag } from '../catalog/catalog.types'
import { isMeaningful, mentionsFormalDecision } from '../shared/text'
import { GRADUATION_MIN_DECISIONS } from '../progress/progress.defaults'
import { graduationCriteria, hasMeaningfulRecord } from '../progress/progress.selectors'
import type { UserProgress } from '../progress/progress.types'

export const XP_RULES = {
  filmWatched: 10,
  firstMeaningfulNote: 10,
  exerciseCompleted: 20,
  levelCompleted: 50,
  graduationCompleted: 100,
  revisit: 5,
} as const

export type XpRule = keyof typeof XP_RULES

/** За что начисляется опыт — подписи для страницы достижений. */
export const XP_RULE_LABELS: Record<XpRule, string> = {
  filmWatched: 'Фильм отмечен просмотренным',
  firstMeaningfulNote: 'Первая содержательная запись по фильму',
  exerciseCompleted: 'Выполнено основное упражнение',
  revisit: 'Возвращение к пройденному фильму с новой заметкой — один раз на фильм',
  levelCompleted: 'Завершён уровень',
  graduationCompleted: 'Завершена выпускная работа',
}

/** Префикс id XP-события → правило (`watched:nosferatu`, `graduation`). */
export const XP_EVENT_RULE: Record<string, XpRule> = {
  watched: 'filmWatched',
  'first-note': 'firstMeaningfulNote',
  exercise: 'exerciseCompleted',
  revisit: 'revisit',
  level: 'levelCompleted',
  graduation: 'graduationCompleted',
}

export interface Rank {
  id: string
  title: string
  minXp: number
}

/** Ранг — метафора накопленного опыта, а не оценка способностей. Не понижается. */
export const RANKS: readonly Rank[] = [
  { id: 'observer', title: 'Наблюдатель', minXp: 0 },
  { id: 'detail-seeker', title: 'Искатель деталей', minXp: 50 },
  { id: 'frame-reader', title: 'Читатель кадра', minXp: 250 },
  { id: 'montage-explorer', title: 'Исследователь монтажа', minXp: 600 },
  { id: 'form-analyst', title: 'Аналитик формы', minXp: 1100 },
  { id: 'interpreter', title: 'Автор интерпретации', minXp: 1800 },
  { id: 'cinematic-thinker', title: 'Кинематографический мыслитель', minXp: 2700 },
]

export type AchievementGroup = 'first-steps' | 'explorer' | 'course' | 'mastery'

export type AchievementFigure = 'circle' | 'diamond' | 'shield' | 'octagon'

/** У каждой группы своя форма значка: раздел различим не только цветом (ТЗ §34). */
export const ACHIEVEMENT_GROUPS: Record<AchievementGroup, { title: string; shape: string; figure: AchievementFigure }> =
  {
    'first-steps': { title: 'Первые шаги', shape: 'круглая печать', figure: 'circle' },
    explorer: { title: 'Исследователь', shape: 'ромб', figure: 'diamond' },
    course: { title: 'Прогресс по курсу', shape: 'щит', figure: 'shield' },
    mastery: { title: 'Мастерство', shape: 'восьмиугольник', figure: 'octagon' },
  }

export interface RewardFacts {
  course: Course
  progress: UserProgress
  /** Фильмы каталога, у которых есть хотя бы одна осмысленная запись. */
  meaningfulFilmIds: Set<string>
  completedLevels: number
  /** Теги упражнений, выполненных пользователем. */
  completedExerciseTags: Set<ExerciseTag>
}

export interface AchievementDefinition {
  id: string
  title: string
  description: string
  /** Как получить — показывается до открытия. */
  hint: string
  group: AchievementGroup
  check: (facts: RewardFacts) => boolean
}

const films = (f: RewardFacts) => Object.entries(f.progress.films)

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  /* Первые шаги */
  {
    id: 'first-viewing',
    title: 'Первый просмотр',
    description: 'Отмечен первый просмотренный фильм.',
    hint: 'Отметьте любой фильм просмотренным.',
    group: 'first-steps',
    check: (f) => films(f).some(([, fp]) => fp.watchStatus === 'watched'),
  },
  {
    id: 'i-noticed',
    title: 'Я заметил',
    description: 'Сохранено первое наблюдение за формой.',
    hint: 'Заполните поле «Я заметил…» или сохраните заметку-наблюдение.',
    group: 'first-steps',
    check: (f) =>
      films(f).some(([, fp]) => isMeaningful(fp.answers.observation)) ||
      f.progress.notes.some((n) => n.kind === 'observation' && isMeaningful(n.text)),
  },
  {
    id: 'form-to-feeling',
    title: 'От формы к чувству',
    description: 'Заполнена связка «наблюдение → эффект → гипотеза».',
    hint: 'По одному фильму заполните три первых шага цепочки ответа.',
    group: 'first-steps',
    check: (f) =>
      films(f).some(
        ([, fp]) =>
          isMeaningful(fp.answers.observation) &&
          isMeaningful(fp.answers.feeling) &&
          isMeaningful(fp.answers.hypothesis),
      ),
  },
  {
    id: 'first-exercise',
    title: 'Первое упражнение',
    description: 'Выполнено первое основное упражнение.',
    hint: 'Выполните основное упражнение любого фильма.',
    group: 'first-steps',
    check: (f) => films(f).some(([, fp]) => fp.exercise.completedAt),
  },
  {
    id: 'return-to-frame',
    title: 'Возвращение к кадру',
    description: 'Вы вернулись к пройденному фильму и дополнили анализ.',
    hint: 'Добавьте новую заметку к фильму, который уже отмечен пройденным.',
    group: 'first-steps',
    check: (f) => revisitedFilmIds(f.progress).size > 0,
  },

  /* Исследователь */
  {
    id: 'three-attentive-viewings',
    title: 'Три внимательных просмотра',
    description: 'Три просмотренных фильма, к каждому есть содержательная запись.',
    hint: 'Посмотрите три фильма и к каждому оставьте хотя бы одно наблюдение.',
    group: 'explorer',
    check: (f) => [...f.meaningfulFilmIds].filter((id) => f.progress.films[id]?.watchStatus === 'watched').length >= 3,
  },
  {
    id: 'not-only-plot',
    title: 'Не только сюжет',
    description: 'В трёх разных записях названы конкретные формальные решения.',
    hint: 'Пишите о кадре, свете, звуке, монтаже, ритме — в трёх разных записях.',
    group: 'explorer',
    check: (f) => formalRecordCount(f.progress) >= 3,
  },
  {
    id: 'motif-trace',
    title: 'След мотива',
    description: 'Один повторяющийся образ связан в нескольких фильмах.',
    hint: 'В журнале на вкладке «Мотивы» свяжите образ минимум с двумя фильмами.',
    group: 'explorer',
    check: (f) => f.progress.motifs.some((m) => m.filmIds.length >= 2 && isMeaningful(m.title, 2)),
  },
  {
    id: 'two-readings',
    title: 'Два прочтения',
    description: 'По одному фильму сохранены две разные гипотезы.',
    hint: 'Заполните поле «Другое прочтение» рядом с гипотезой.',
    group: 'explorer',
    check: (f) =>
      films(f).some(([, fp]) => isMeaningful(fp.answers.hypothesis) && isMeaningful(fp.answers.altHypothesis)) ||
      Object.values(
        groupBy(
          f.progress.notes.filter((n) => n.kind === 'hypothesis' && n.filmId && isMeaningful(n.text)),
          (n) => n.filmId ?? '',
        ),
      ).some((list) => list.length >= 2),
  },
  {
    id: 'open-question',
    title: 'Вопрос без ответа',
    description: 'Сохранён открытый вопрос, который вы решили не закрывать одной трактовкой.',
    hint: 'Заполните поле «Открытый вопрос» или сохраните заметку-вопрос.',
    group: 'explorer',
    check: (f) =>
      films(f).some(([, fp]) => isMeaningful(fp.answers.openQuestion, 10)) ||
      f.progress.notes.some((n) => n.kind === 'question' && isMeaningful(n.text, 10)),
  },

  /* Прогресс по курсу */
  {
    id: 'level-complete',
    title: 'Уровень пройден',
    description: 'Завершён первый уровень.',
    hint: 'Выполните критерии уровня и нажмите «Завершить уровень».',
    group: 'course',
    check: (f) => f.completedLevels >= 1,
  },
  {
    id: 'three-levels',
    title: 'Первые три ступени',
    description: 'Завершены три уровня.',
    hint: 'Завершите три уровня.',
    group: 'course',
    check: (f) => f.completedLevels >= 3,
  },
  {
    id: 'halfway',
    title: 'Половина пути',
    description: 'Завершено не меньше 7 из 13 уровней.',
    hint: 'Завершите семь уровней.',
    group: 'course',
    check: (f) => f.completedLevels >= Math.ceil(f.course.levels.length / 2),
  },
  {
    id: 'course-complete',
    title: 'Курс пройден',
    description: 'Завершены все уровни и выпускная работа.',
    hint: 'Завершите все уровни и выпускную работу.',
    group: 'course',
    check: (f) => f.completedLevels === f.course.levels.length && Boolean(f.progress.graduation.completedAt),
  },

  /* Мастерство */
  {
    id: 'frame-reading',
    title: 'Чтение кадра',
    description: 'Выполнено упражнение о композиции кадра.',
    hint: 'Выполните любое упражнение о композиции кадра — больше всего их на уровне «Кадр, композиция и мизансцена».',
    group: 'mastery',
    check: (f) => f.completedExerciseTags.has('composition'),
  },
  {
    id: 'sense-of-rhythm',
    title: 'Чувство ритма',
    description: 'Выполнено упражнение о монтаже.',
    hint: 'Выполните любое упражнение о монтаже — больше всего их на уровне «Монтаж, ритм и время».',
    group: 'mastery',
    check: (f) => f.completedExerciseTags.has('montage'),
  },
  {
    id: 'film-listener',
    title: 'Слушатель кино',
    description: 'Выполнено упражнение о звуке.',
    hint: 'Выполните упражнение, посвящённое звуку, музыке или тишине.',
    group: 'mastery',
    check: (f) => f.completedExerciseTags.has('sound'),
  },
  {
    id: 'metaphor-found',
    title: 'Метафора найдена',
    description: 'Выполнено упражнение о мотиве или метафоре.',
    hint: 'Выполните любое упражнение о мотиве или метафоре — больше всего их на уровне «Метафора, сон и символ».',
    group: 'mastery',
    check: (f) => f.completedExerciseTags.has('metaphor'),
  },
  {
    id: 'argument-not-impression',
    title: 'Аргумент, а не впечатление',
    description: 'В выпускном анализе несколько формальных наблюдений и объяснение связей между ними.',
    hint: 'Завершите выпускную работу: три решения с эффектом и их связь.',
    group: 'mastery',
    check: (f) => {
      const g = f.progress.graduation
      const decisions = g.decisions.filter((d) => isMeaningful(d.observation, 10) && isMeaningful(d.effect, 10))
      return Boolean(g.completedAt) && decisions.length >= GRADUATION_MIN_DECISIONS && isMeaningful(g.connections, 40)
    },
  },
  {
    id: 'own-thought',
    title: 'Собственная мысль',
    description: 'Создана итоговая интерпретация, основанная на конкретных сценах.',
    hint: 'В выпускной работе укажите сцены и напишите итоговую интерпретацию.',
    group: 'mastery',
    check: (f) => {
      const byId = new Map(graduationCriteria(f.progress).map((c) => [c.id, c.met]))
      return Boolean(byId.get('subject') && byId.get('interpretation'))
    },
  },
]

/** Теги упражнений, без которых часть ачивок невозможно получить. */
export const REQUIRED_EXERCISE_TAGS: ExerciseTag[] = ['composition', 'montage', 'sound', 'metaphor']

/* ---------------- Вспомогательные факты ---------------- */

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of items) (out[key(item)] ??= []).push(item)
  return out
}

/** Фильмы, к которым после завершения добавлена новая осмысленная заметка. */
export function revisitedFilmIds(p: UserProgress): Set<string> {
  const ids = new Set<string>()
  for (const note of p.notes) {
    if (!note.filmId || !isMeaningful(note.text)) continue
    const completedAt = p.films[note.filmId]?.completedAt
    if (completedAt && Date.parse(note.createdAt) > Date.parse(completedAt)) ids.add(note.filmId)
  }
  return ids
}

/** Сколько разных записей (заметок и полей ответа) упоминают формальные решения. */
export function formalRecordCount(p: UserProgress): number {
  let count = p.notes.filter((n) => isMeaningful(n.text) && mentionsFormalDecision(n.text)).length
  for (const fp of Object.values(p.films)) {
    for (const text of [fp.answers.observation, fp.answers.evidence, fp.exercise.response]) {
      if (isMeaningful(text) && mentionsFormalDecision(text)) count++
    }
  }
  return count
}

export function buildRewardFacts(course: Course, progress: UserProgress): RewardFacts {
  const meaningfulFilmIds = new Set(course.films.filter((f) => hasMeaningfulRecord(progress, f.id)).map((f) => f.id))
  const completedExerciseTags = new Set<ExerciseTag>()
  for (const film of course.films) {
    if (progress.films[film.id]?.exercise.completedAt) {
      for (const tag of film.lesson?.exercise.tags ?? []) completedExerciseTags.add(tag)
    }
  }
  return {
    course,
    progress,
    meaningfulFilmIds,
    completedLevels: course.levels.filter((l) => progress.levels[l.id]?.completedAt).length,
    completedExerciseTags,
  }
}
