import type {
  CatalogFile,
  Course,
  Exercise,
  Film,
  FilmLesson,
  GlossaryTerm,
  Level,
  LevelCompletionRule,
  LevelContent,
} from './catalog.types'

export const DEFAULT_COMPLETION: LevelCompletionRule = {
  minWatchedShare: 0.7,
  minExercises: 1,
  requireReflection: true,
}

export interface CourseSources {
  catalog: CatalogFile
  lessons: Record<string, FilmLesson>
  levelContent: Record<string, LevelContent>
  glossary: GlossaryTerm[]
}

/**
 * Собирает курс из каталога и авторского контента. Порядок уровней и фильмов
 * берётся из полей number/order, а не из порядка в файле.
 */
export function buildCourse({ catalog, lessons, levelContent, glossary }: CourseSources): Course {
  const levels: Level[] = [...catalog.levels]
    .sort((a, b) => a.number - b.number)
    .map((raw) => {
      const films: Film[] = [...raw.films]
        .sort((a, b) => a.order - b.order)
        .map((film) => ({
          ...film,
          levelId: raw.id,
          levelNumber: raw.number,
          lesson: lessons[film.id] ?? null,
        }))
      const content = levelContent[raw.id] ?? null
      const termIds = [...new Set(films.flatMap((f) => f.lesson?.terms ?? []))]
      return {
        id: raw.id,
        number: raw.number,
        title: raw.title,
        status: raw.status,
        purpose: raw.purpose,
        skills: raw.skills,
        films,
        content,
        completion: { ...DEFAULT_COMPLETION, ...content?.completion },
        termIds,
      }
    })

  const films = levels.flatMap((l) => l.films)
  return {
    id: catalog.course.id,
    title: catalog.course.title,
    description: catalog.course.description,
    sourceNote: catalog.course.sourceNote,
    levels,
    films,
    filmById: new Map(films.map((f) => [f.id, f])),
    levelById: new Map(levels.map((l) => [l.id, l])),
    glossary,
    termById: new Map(glossary.map((t) => [t.id, t])),
  }
}

/** Сколько фильмов нужно отметить просмотренными, чтобы закрыть уровень. */
export function requiredWatchedCount(level: Level): number {
  return Math.ceil(level.films.length * level.completion.minWatchedShare)
}

/**
 * Общие вопросы самопроверки (ТЗ §12.5): оценивается качество наблюдения
 * и аргумента, а не совпадение с эталонной трактовкой.
 */
export const COMMON_SELF_CHECK: readonly string[] = [
  'Назвал ли я конкретную деталь, которую видно или слышно?',
  'Объяснил ли я, какой эффект она создаёт?',
  'Показал ли я связь детали с гипотезой?',
]

/** Пункты самопроверки упражнения: сначала общие, затем свои. Прогресс хранит их индексы. */
export function selfCheckItems(exercise: Pick<Exercise, 'selfCheck'>): string[] {
  return [...COMMON_SELF_CHECK, ...(exercise.selfCheck ?? [])]
}

/** Соседние фильмы в рекомендуемом порядке уровня. */
export function filmNeighbours(level: Level, filmId: string): { prev: Film | null; next: Film | null } {
  const index = level.films.findIndex((f) => f.id === filmId)
  if (index < 0) return { prev: null, next: null }
  return { prev: level.films[index - 1] ?? null, next: level.films[index + 1] ?? null }
}

/** Уроки, в которых встречается термин. */
export function filmsUsingTerm(course: Course, termId: string): Film[] {
  return course.films.filter((f) => f.lesson?.terms.includes(termId))
}
