import { requiredWatchedCount } from '../catalog/catalog'
import type { Course, Film, Level } from '../catalog/catalog.types'
import { daysBetween, isAfter, isoWeekKey, localDate } from '../shared/dates'
import { isMeaningful, plural } from '../shared/text'
import { GRADUATION_MIN_DECISIONS, hasAnyProgress } from './progress.defaults'
import type { FilmProgress, Note, NoteKind, UserProgress } from './progress.types'
import { ANSWER_KEYS } from './progress.types'

export interface Criterion<Id extends string = string> {
  id: Id
  label: string
  met: boolean
  detail?: string
}

/* ---------------- Фильм ---------------- */

export type FilmDisplayStatus = 'not-started' | 'started' | 'watched' | 'completed' | 'reviewing'

export const FILM_STATUS_LABEL: Record<FilmDisplayStatus, string> = {
  'not-started': 'Не смотрел',
  started: 'Начал',
  watched: 'Посмотрел',
  completed: 'Пройден',
  reviewing: 'Разбираю повторно',
}

export function filmDisplayStatus(fp: FilmProgress | undefined): FilmDisplayStatus {
  if (!fp) return 'not-started'
  if (fp.completedAt) return fp.reviewing ? 'reviewing' : 'completed'
  if (fp.watchStatus === 'watched') return 'watched'
  if (fp.watchStatus === 'started' || fp.analysisStatus !== 'not-started') return 'started'
  return 'not-started'
}

export function notesForFilm(p: UserProgress, filmId: string): Note[] {
  return p.notes.filter((n) => n.filmId === filmId)
}

/** Есть ли по фильму хотя бы одна осмысленная запись (ответ или заметка). */
export function hasMeaningfulRecord(p: UserProgress, filmId: string): boolean {
  const fp = p.films[filmId]
  if (fp && ANSWER_KEYS.some((k) => isMeaningful(fp.answers[k]))) return true
  return p.notes.some((n) => n.filmId === filmId && isMeaningful(n.text))
}

type FilmCriterionId = 'watched' | 'exercise' | 'note'

export function filmCompletionCriteria(p: UserProgress, filmId: string): Criterion<FilmCriterionId>[] {
  const fp = p.films[filmId]
  const criteria: Criterion<FilmCriterionId>[] = [
    { id: 'watched', label: 'Фильм отмечен просмотренным', met: fp?.watchStatus === 'watched' },
  ]
  if (p.settings.lightMode) {
    criteria.push({
      id: 'note',
      label: 'Записано хотя бы одно наблюдение или короткая заметка',
      met: hasMeaningfulRecord(p, filmId),
    })
  } else {
    criteria.push({
      id: 'exercise',
      label: 'Выполнено основное упражнение',
      met: Boolean(fp?.exercise.completedAt),
    })
  }
  return criteria
}

export function canCompleteFilm(p: UserProgress, filmId: string): boolean {
  return filmCompletionCriteria(p, filmId).every((c) => c.met)
}

/** Короткие названия шагов для полосы прогресса на карточке фильма. */
const FILM_STEP_NAME: Record<FilmCriterionId | 'completed', string> = {
  watched: 'просмотр',
  exercise: 'упражнение',
  note: 'короткая заметка',
  completed: 'итог фильма',
}

/**
 * Путь фильма: условия завершения и сам итог. Шаги можно делать
 * не по порядку, поэтому «дальше» — первый невыполненный, а `lit` —
 * какие именно шаги выполнены, по порядку.
 */
export function filmSteps(
  p: UserProgress,
  filmId: string,
): { done: number; total: number; lit: boolean[]; next: string | null } {
  const steps: { id: FilmCriterionId | 'completed'; met: boolean }[] = [
    ...filmCompletionCriteria(p, filmId),
    { id: 'completed', met: Boolean(p.films[filmId]?.completedAt) },
  ]
  const next = steps.find((s) => !s.met)
  const lit = steps.map((s) => s.met)
  return {
    done: lit.filter(Boolean).length,
    total: steps.length,
    lit,
    next: next ? FILM_STEP_NAME[next.id] : null,
  }
}

/** Шаги урока фильма (ТЗ §12.2–12.4). */
export type FilmStage = 'before' | 'during' | 'after'
export const FILM_STAGES: readonly FilmStage[] = ['before', 'during', 'after']

export const FILM_STAGE_LABEL: Record<FilmStage, string> = {
  before: 'Перед просмотром',
  during: 'Во время',
  after: 'После просмотра',
}

/** С какого шага открыть урок — там, где пользователь остановился. */
export function filmStartStage(fp: FilmProgress | undefined): FilmStage {
  if (!fp) return 'before'
  if (fp.watchStatus === 'watched' || fp.completedAt || fp.analysisStatus !== 'not-started') return 'after'
  return fp.watchStatus === 'started' ? 'during' : 'before'
}

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  free: 'Заметка',
  observation: 'Наблюдение',
  hypothesis: 'Гипотеза',
  question: 'Вопрос',
  'merge-copy': 'Копия при объединении',
}

/* ---------------- Уровень ---------------- */

export interface LevelStats {
  total: number
  watched: number
  completed: number
  exercises: number
  requiredWatched: number
  /** Доля пройденных фильмов, 0–100. */
  percent: number
  criteria: Criterion[]
  canComplete: boolean
  completedAt: string | null
}

export function levelStats(level: Level, p: UserProgress): LevelStats {
  const films = level.films
  let watched = 0
  let completed = 0
  let exercises = 0
  let meaningful = 0
  for (const film of films) {
    const fp = p.films[film.id]
    if (fp?.watchStatus === 'watched') watched++
    if (fp?.completedAt) completed++
    if (fp?.exercise.completedAt) exercises++
    if (hasMeaningfulRecord(p, film.id)) meaningful++
  }
  const lp = p.levels[level.id]
  const rule = level.completion
  const requiredWatched = requiredWatchedCount(level)
  const criteria: Criterion[] = [
    {
      id: 'watched',
      label: `Просмотрено не меньше ${requiredWatched} из ${films.length} ${plural(films.length, ['фильма', 'фильмов', 'фильмов'])}`,
      met: watched >= requiredWatched,
      detail: `сейчас ${watched}`,
    },
  ]
  if (p.settings.lightMode) {
    criteria.push({
      id: 'records',
      label: 'Есть хотя бы одна содержательная заметка по фильму уровня',
      met: meaningful >= 1,
      detail: `сейчас ${meaningful}`,
    })
  } else if (rule.minExercises > 0) {
    criteria.push({
      id: 'exercises',
      label: `Выполнено основных упражнений: не меньше ${rule.minExercises}`,
      met: exercises >= rule.minExercises,
      detail: `сейчас ${exercises}`,
    })
  }
  if (rule.requireReflection) {
    criteria.push({
      id: 'reflection',
      label: 'Сохранена итоговая заметка уровня',
      met: isMeaningful(lp?.reflection),
    })
  }
  return {
    total: films.length,
    watched,
    completed,
    exercises,
    requiredWatched,
    percent: films.length === 0 ? 0 : Math.round((completed / films.length) * 100),
    criteria,
    canComplete: criteria.every((c) => c.met),
    completedAt: lp?.completedAt ?? null,
  }
}

export type LevelStatus = 'locked' | 'available' | 'in-progress' | 'completed' | 'review'

export const LEVEL_STATUS_LABEL: Record<LevelStatus, string> = {
  locked: 'Закрыт (строгий порядок)',
  available: 'Не начат',
  'in-progress': 'В процессе',
  completed: 'Пройден',
  review: 'Пройден · повторный разбор',
}

export function isLevelLocked(course: Course, level: Level, p: UserProgress): boolean {
  if (!p.settings.sequentialMode || p.levels[level.id]?.completedAt) return false
  const index = course.levels.indexOf(level)
  if (index <= 0) return false
  const prev = course.levels[index - 1]
  return Boolean(prev && !p.levels[prev.id]?.completedAt)
}

export function levelStatus(course: Course, level: Level, p: UserProgress): LevelStatus {
  if (p.levels[level.id]?.completedAt) {
    return level.films.some((f) => p.films[f.id]?.reviewing) ? 'review' : 'completed'
  }
  if (isLevelLocked(course, level, p)) return 'locked'
  const touched =
    level.films.some((f) => filmDisplayStatus(p.films[f.id]) !== 'not-started' || hasMeaningfulRecord(p, f.id)) ||
    isMeaningful(p.levels[level.id]?.reflection, 1)
  return touched ? 'in-progress' : 'available'
}

/* ---------------- Курс ---------------- */

export interface CourseStats {
  totalLevels: number
  levelsCompleted: number
  totalFilms: number
  filmsWatched: number
  filmsCompleted: number
  percent: number
}

export function courseStats(course: Course, p: UserProgress): CourseStats {
  const filmsWatched = course.films.filter((f) => p.films[f.id]?.watchStatus === 'watched').length
  const filmsCompleted = course.films.filter((f) => p.films[f.id]?.completedAt).length
  const levelsCompleted = course.levels.filter((l) => p.levels[l.id]?.completedAt).length
  return {
    totalLevels: course.levels.length,
    levelsCompleted,
    totalFilms: course.films.length,
    filmsWatched,
    filmsCompleted,
    percent: course.films.length === 0 ? 0 : Math.round((filmsCompleted / course.films.length) * 100),
  }
}

/** Уровень, на котором пользователь сейчас учится: первый незавершённый. */
export function currentLevel(course: Course, p: UserProgress): Level | null {
  return course.levels.find((l) => !p.levels[l.id]?.completedAt) ?? null
}

export interface LevelMapEntry {
  level: Level
  status: LevelStatus
  stats: LevelStats
  /** Рекомендуемый уровень «Вы здесь» — первый незавершённый. */
  isCurrent: boolean
}

/** Строки карты курса (ТЗ §10): статус, прогресс и отметка текущего уровня. */
export function courseMap(course: Course, p: UserProgress): LevelMapEntry[] {
  const current = currentLevel(course, p)
  return course.levels.map((level) => ({
    level,
    status: levelStatus(course, level, p),
    stats: levelStats(level, p),
    isCurrent: level === current,
  }))
}

export type LevelContinue =
  { kind: 'film'; film: Film } | { kind: 'complete' } | { kind: 'next-level'; level: Level } | { kind: 'graduation' }

/**
 * Кнопка продолжения на странице уровня (ТЗ §11 п. 8): первый незавершённый
 * фильм; если все фильмы пройдены — итог уровня; после завершения — дальше
 * по курсу.
 */
export function levelContinue(course: Course, level: Level, p: UserProgress): LevelContinue {
  if (!p.levels[level.id]?.completedAt) {
    const film = level.films.find((f) => !p.films[f.id]?.completedAt)
    return film ? { kind: 'film', film } : { kind: 'complete' }
  }
  const next = course.levels[course.levels.indexOf(level) + 1]
  return next ? { kind: 'next-level', level: next } : { kind: 'graduation' }
}

export type NextStep =
  | { kind: 'start'; film: Film; level: Level }
  | { kind: 'film'; film: Film; level: Level; reason: 'current' | 'next' }
  | { kind: 'level'; level: Level }
  | { kind: 'graduation' }
  | { kind: 'done' }

/**
 * Следующий рекомендуемый шаг. Если пользователь последним открывал
 * незавершённый фильм — возвращаем к нему, иначе — первый незавершённый
 * шаг по порядку курса.
 */
export function nextStep(course: Course, p: UserProgress): NextStep {
  const firstLevel = course.levels[0]
  const firstFilm = firstLevel?.films[0]
  if (!hasAnyProgress(p) && firstLevel && firstFilm) {
    return { kind: 'start', film: firstFilm, level: firstLevel }
  }

  const current = p.currentFilmId ? course.filmById.get(p.currentFilmId) : undefined
  if (current && !p.films[current.id]?.completedAt) {
    const level = course.levelById.get(current.levelId)
    if (level && !isLevelLocked(course, level, p) && !p.levels[level.id]?.completedAt) {
      return { kind: 'film', film: current, level, reason: 'current' }
    }
  }

  for (const level of course.levels) {
    if (p.levels[level.id]?.completedAt) continue
    if (levelStats(level, p).canComplete) return { kind: 'level', level }
    const film = level.films.find((f) => !p.films[f.id]?.completedAt)
    return film ? { kind: 'film', film, level, reason: 'next' } : { kind: 'level', level }
  }

  return p.graduation.completedAt ? { kind: 'done' } : { kind: 'graduation' }
}

export interface ResumeInfo {
  step: NextStep
  /** Уровень, к которому ведёт шаг; null — остались выпускная работа или курс пройден. */
  level: Level | null
  stats: LevelStats | null
  /** Сколько фильмов уровня ещё не пройдено. */
  filmsLeft: number
  /** Шаг урока, на котором пользователь остановился; null — фильм ещё не открывали. */
  stage: FilmStage | null
}

/**
 * Блок «Продолжить» на главной: следующий шаг и всё, что нужно показать
 * рядом с ним, — уровень, сколько фильмов в нём осталось и где пользователь
 * остановился в уроке.
 */
export function resumeInfo(course: Course, p: UserProgress): ResumeInfo {
  const step = nextStep(course, p)
  const level = step.kind === 'start' || step.kind === 'film' || step.kind === 'level' ? step.level : null
  const stats = level ? levelStats(level, p) : null
  const fp = step.kind === 'film' ? p.films[step.film.id] : undefined
  return {
    step,
    level,
    stats,
    filmsLeft: stats ? stats.total - stats.completed : 0,
    stage: fp ? filmStartStage(fp) : null,
  }
}

/** Отмечен ли хотя бы один фильм просмотренным: после этого подсказки новичку сворачиваются. */
export function hasMarkedFilm(p: UserProgress): boolean {
  return Object.values(p.films).some((f) => f.watchStatus === 'watched' || f.completedAt)
}

/* ---------------- Выпускная работа ---------------- */

export function graduationCriteria(p: UserProgress): Criterion[] {
  const g = p.graduation
  const filledDecisions = g.decisions.filter((d) => isMeaningful(d.observation, 10) && isMeaningful(d.effect, 10))
  return [
    { id: 'subject', label: 'Указаны фильм и 2–3 сцены', met: isMeaningful(g.subject, 10) },
    { id: 'question', label: 'Сформулирован главный вопрос', met: isMeaningful(g.mainQuestion, 15) },
    {
      id: 'decisions',
      label: `Минимум ${GRADUATION_MIN_DECISIONS} формальных решения, у каждого описан эффект`,
      met: filledDecisions.length >= GRADUATION_MIN_DECISIONS,
      detail: `сейчас ${filledDecisions.length}`,
    },
    { id: 'connections', label: 'Объяснено, как решения связаны между собой', met: isMeaningful(g.connections, 40) },
    {
      id: 'interpretation',
      label: 'Итоговая интерпретация опирается на решения',
      met: isMeaningful(g.interpretation, 80),
    },
  ]
}

export type GraduationStatus = 'not-started' | 'in-progress' | 'completed'

export const GRADUATION_STATUS_LABEL: Record<GraduationStatus, string> = {
  'not-started': 'Не начата',
  'in-progress': 'В процессе',
  completed: 'Завершена',
}

export function graduationStatus(p: UserProgress): GraduationStatus {
  const g = p.graduation
  if (g.completedAt) return 'completed'
  const texts = [
    g.subject,
    g.mainQuestion,
    g.connections,
    g.interpretation,
    ...g.decisions.flatMap((d) => [d.observation, d.effect]),
  ]
  return texts.some((t) => isMeaningful(t, 1)) ? 'in-progress' : 'not-started'
}

/* ---------------- Активность и привычка ---------------- */

export interface ActivityStats {
  activeDays: number
  activeWeeks: number
  /** Фильмы, отмеченные просмотренными на текущей неделе. */
  watchedThisWeek: number
}

export function activityStats(p: UserProgress, now: Date): ActivityStats {
  const thisWeek = isoWeekKey(localDate(now))
  const watchedThisWeek = Object.values(p.films).filter(
    (f) => f.watchedAt && isoWeekKey(localDate(new Date(f.watchedAt))) === thisWeek,
  ).length
  return {
    activeDays: p.activityDays.length,
    activeWeeks: new Set(p.activityDays.map(isoWeekKey)).size,
    watchedThisWeek,
  }
}

/* ---------------- Напоминание о резервной копии ---------------- */

export const BACKUP_REMINDER = { changedRecords: 10, activeDays: 3, snoozeDays: 7 } as const

export interface BackupReminder {
  show: boolean
  message: string
}

/**
 * Мягкое напоминание об экспорте: после 10 новых/изменённых записей или
 * 3 активных дней с момента последней копии. Никаких повторов чаще, чем
 * пользователь разрешил.
 */
export function backupReminder(p: UserProgress, now: Date): BackupReminder {
  const none = { show: false, message: '' }
  if (!hasAnyProgress(p)) return none
  const today = localDate(now)
  if (p.backup.reminderSnoozedUntil && daysBetween(today, p.backup.reminderSnoozedUntil) >= 0) return none

  const since = p.backup.lastExportAt
  const changed =
    p.notes.filter((n) => !since || isAfter(n.updatedAt, since)).length +
    Object.values(p.films).filter((f) => !since || isAfter(f.updatedAt, since)).length
  const sinceDay = since ? localDate(new Date(since)) : null
  const days = p.activityDays.filter((d) => !sinceDay || d > sinceDay).length

  const prefix = since ? 'С последней резервной копии' : 'Резервной копии ещё нет, а'
  if (changed >= BACKUP_REMINDER.changedRecords) {
    return {
      show: true,
      message: `${prefix} ${since ? 'появилось' : 'у вас уже'} ${changed} ${plural(changed, ['новая запись', 'новые записи', 'новых записей'])}.`,
    }
  }
  if (days >= BACKUP_REMINDER.activeDays) {
    return {
      show: true,
      message: `${prefix} ${since ? 'прошло' : 'вы занимались уже'} ${days} ${plural(days, ['учебный день', 'учебных дня', 'учебных дней'])}.`,
    }
  }
  return none
}
