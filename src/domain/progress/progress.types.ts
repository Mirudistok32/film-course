/**
 * Пользовательский прогресс. Это единственные данные, которые сохраняются
 * в браузере и попадают в JSON-копию. Каталог курса сюда не входит.
 *
 * Любое изменение контракта требует повышения CURRENT_SCHEMA_VERSION,
 * миграции в progress.migrations.ts и теста на неё.
 */

export const PROGRESS_FORMAT = 'kino-kak-sposob-myshleniya-progress'
export const CURRENT_SCHEMA_VERSION = 2

export type WatchStatus = 'not-watched' | 'started' | 'watched'
export type AnalysisStatus = 'not-started' | 'in-progress' | 'completed'

/**
 * Цепочка ответа: «Я заметил…» → «Это заставило почувствовать…» →
 * «Возможно, это означает…» → «На это указывает…», плюс необязательные
 * второе прочтение и открытый вопрос.
 */
export type AnswerKey = 'observation' | 'feeling' | 'hypothesis' | 'evidence' | 'altHypothesis' | 'openQuestion'
export const ANSWER_KEYS: readonly AnswerKey[] = [
  'observation',
  'feeling',
  'hypothesis',
  'evidence',
  'altHypothesis',
  'openQuestion',
]
export type Answers = Partial<Record<AnswerKey, string>>

export interface ExerciseProgress {
  response: string
  /** Индексы отмеченных пунктов самопроверки. */
  checklist: number[]
  completedAt: string | null
  /** Когда впервые открыт образец разбора. */
  sampleOpenedAt: string | null
}

export interface FilmProgress {
  watchStatus: WatchStatus
  analysisStatus: AnalysisStatus
  startedAt: string | null
  watchedAt: string | null
  /** Пользователь отметил фильм пройденным. */
  completedAt: string | null
  answers: Answers
  exercise: ExerciseProgress
  isFavorite: boolean
  /** «Хочу вернуться позже». */
  revisitLater: boolean
  /** «Разбираю повторно» — не отменяет завершения. */
  reviewing: boolean
  updatedAt: string
}

export type NoteKind = 'free' | 'observation' | 'hypothesis' | 'question' | 'merge-copy'
export const NOTE_KINDS: readonly NoteKind[] = ['free', 'observation', 'hypothesis', 'question', 'merge-copy']

export interface Note {
  id: string
  text: string
  kind: NoteKind
  /** null — свободная заметка без фильма. */
  filmId: string | null
  createdAt: string
  updatedAt: string
  tags: string[]
}

export interface LevelProgress {
  completedAt: string | null
  reflection: string
  reflectionUpdatedAt: string | null
}

/** «Связать мотивы»: один повторяющийся образ в нескольких фильмах. */
export interface MotifLink {
  id: string
  title: string
  description: string
  filmIds: string[]
  createdAt: string
  updatedAt: string
}

export interface GraduationDecision {
  observation: string
  effect: string
}

export interface GraduationWork {
  /** Фильм и сцены, которые разбирает пользователь (свободный текст). */
  subject: string
  /** Если фильм из каталога — его id. */
  filmId: string | null
  mainQuestion: string
  decisions: GraduationDecision[]
  /** Как решения связаны между собой. */
  connections: string
  interpretation: string
  completedAt: string | null
  updatedAt: string | null
}

export interface AchievementUnlock {
  id: string
  unlockedAt: string
}

/** Уникальное событие начисления XP. Сумма событий = XP пользователя. */
export interface XpEvent {
  id: string
  amount: number
  at: string
}

export type TextScale = 'small' | 'normal' | 'large'
export type ThemePreference = 'system' | 'light' | 'dark'

export interface Settings {
  showGamification: boolean
  reducedMotion: boolean
  textScale: TextScale
  theme: ThemePreference
  /** Строгий порядок уровней (по умолчанию выключен). */
  sequentialMode: boolean
  /** Облегчённый режим: просмотр + короткая заметка вместо обязательного упражнения. */
  lightMode: boolean
  /** Личная цель «один фильм в неделю», без наказаний. */
  weeklyGoal: boolean
}

export interface BackupMeta {
  lastExportAt: string | null
  lastImportAt: string | null
  /** Локальная дата YYYY-MM-DD, до которой не напоминать об экспорте. */
  reminderSnoozedUntil: string | null
}

export interface UserProgress {
  createdAt: string
  /** Локальная дата YYYY-MM-DD. */
  lastActiveDate: string
  currentLevelId: string | null
  currentFilmId: string | null
  films: Record<string, FilmProgress>
  levels: Record<string, LevelProgress>
  notes: Note[]
  motifs: MotifLink[]
  graduation: GraduationWork
  achievements: AchievementUnlock[]
  /** Хранится для читаемости файла; всегда равно сумме xpLedger. */
  xp: number
  xpLedger: XpEvent[]
  /** Локальные даты YYYY-MM-DD, в которые была учебная активность. */
  activityDays: string[]
  settings: Settings
  backup: BackupMeta
}

export interface ProgressFile {
  format: typeof PROGRESS_FORMAT
  schemaVersion: number
  exportedAt: string
  appVersion: string
  progress: UserProgress
}
