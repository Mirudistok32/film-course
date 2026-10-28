/**
 * Типы учебного каталога. Каталог — неизменяемые данные проекта:
 * список уровней и фильмов (film-course-catalog.json) плюс авторский
 * контент уроков, уровней и словаря из src/content.
 */

export type FilmSourceStatus = 'confirmed' | 'previously-discussed' | 'proposed-expansion'
export type LevelSourceStatus = 'confirmed-core-plus-proposals' | 'proposed-expansion'

export interface CatalogFilmRecord {
  id: string
  title: string
  originalTitle?: string | null
  year: number
  director: string
  status: FilmSourceStatus
  learningFocus: string
  runtimeMinutes: number | null
  country: string | null
  posterUrl: string | null
  externalViewingUrl: string | null
  order: number
}

export interface CatalogLevelRecord {
  id: string
  number: number
  title: string
  status: LevelSourceStatus
  purpose: string
  skills: string[]
  films: CatalogFilmRecord[]
}

export interface CatalogFile {
  catalogSchemaVersion: number
  course: {
    id: string
    title: string
    language: string
    description: string
    sourceNote: string
  }
  levels: CatalogLevelRecord[]
}

/** Теги упражнений: по ним выдаются ачивки мастерства. */
export type ExerciseTag =
  | 'composition'
  | 'montage'
  | 'time'
  | 'camera'
  | 'light'
  | 'color'
  | 'sound'
  | 'space'
  | 'body'
  | 'suspense'
  | 'metaphor'
  | 'ambiguity'
  | 'ethics'
  | 'synthesis'

export interface Exercise {
  title: string
  /** Что нужно сделать — одна-две фразы. */
  task: string
  /** На что смотреть во время выполнения. */
  lookAt: string
  steps: string[]
  /** Дополнительные критерии самопроверки, кроме общих. */
  selfCheck?: string[]
  /** Усложнение для тех, кто хочет пойти дальше. */
  advanced?: string
  tags: ExerciseTag[]
}

export interface SampleAnalysis {
  title: string
  text: string
}

export interface FilmLesson {
  /** Почему фильм важен для навыка уровня. */
  why: string
  /** Простой вопрос, с которым начать просмотр. */
  startQuestion: string
  /** 2–3 вещи, на которые обратить внимание. */
  lookFor: string[]
  /** Ориентиры для панели «Во время просмотра». */
  duringCues: string[]
  /** Вопросы после просмотра трёх типов. */
  afterQuestions: {
    observation: string
    effect: string
    interpretation: string
  }
  exercise: Exercise
  /** Образцы разбора: один или два конкурирующих. */
  samples: SampleAnalysis[]
  /** id терминов словаря. */
  terms: string[]
  /** Деликатное предупреждение о тяжёлом содержании, без спойлеров. */
  contentNote?: string
}

export interface LevelLectureExample {
  title: string
  text: string
  filmId?: string
}

export interface LevelCompletionRule {
  /** Доля фильмов уровня, отмеченных просмотренными (0..1). */
  minWatchedShare: number
  /** Минимум выполненных основных упражнений. */
  minExercises: number
  /** Требуется ли итоговая рефлексия уровня. */
  requireReflection: boolean
}

export interface LevelContent {
  lecture: {
    principle: string
    examples: LevelLectureExample[]
  }
  /** Чем пользователь владеет после уровня (из ТЗ, §6). */
  outcome: string
  /** Вопрос итоговой рефлексии уровня. */
  reflectionPrompt: string
  completion?: Partial<LevelCompletionRule>
}

/** Тема словаря: термины на странице сгруппированы по ним, а не по алфавиту. */
export type GlossaryGroupId = 'frame' | 'space' | 'camera' | 'montage' | 'light' | 'sound' | 'meaning'

export interface GlossaryTerm {
  id: string
  term: string
  /** Другие названия, например «диегетический звук». */
  aka?: string
  group: GlossaryGroupId
  simple: string
  professional: string
  noticeQuestion: string
  /** spoiler — пример касается финала: в словаре скрыт до нажатия. */
  example: { filmId: string; text: string; spoiler?: boolean }
}

/* ---------- Собранная модель, которой пользуется интерфейс ---------- */

export interface Film extends CatalogFilmRecord {
  levelId: string
  levelNumber: number
  /** null — урок ещё не написан; страница показывает базовые вопросы уровня. */
  lesson: FilmLesson | null
}

export interface Level {
  id: string
  number: number
  title: string
  status: LevelSourceStatus
  purpose: string
  skills: string[]
  films: Film[]
  content: LevelContent | null
  completion: LevelCompletionRule
  /** Термины, встречающиеся в уроках уровня. */
  termIds: string[]
}

export interface Course {
  id: string
  title: string
  description: string
  sourceNote: string
  levels: Level[]
  films: Film[]
  filmById: ReadonlyMap<string, Film>
  levelById: ReadonlyMap<string, Level>
  glossary: GlossaryTerm[]
  termById: ReadonlyMap<string, GlossaryTerm>
}
