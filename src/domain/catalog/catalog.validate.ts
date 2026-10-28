import type {
  CatalogFile,
  ExerciseTag,
  FilmLesson,
  FilmSourceStatus,
  GlossaryTerm,
  LevelContent,
  LevelSourceStatus,
} from './catalog.types'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FILM_STATUSES: FilmSourceStatus[] = ['confirmed', 'previously-discussed', 'proposed-expansion']
const LEVEL_STATUSES: LevelSourceStatus[] = ['confirmed-core-plus-proposals', 'proposed-expansion']
export const EXERCISE_TAGS: ExerciseTag[] = [
  'composition',
  'montage',
  'time',
  'camera',
  'light',
  'color',
  'sound',
  'space',
  'body',
  'suspense',
  'metaphor',
  'ambiguity',
  'ethics',
  'synthesis',
]
export const MIN_FILMS_PER_LEVEL = 7

export interface CatalogValidationInput {
  catalog: CatalogFile
  lessons: Record<string, FilmLesson>
  levelContent: Record<string, LevelContent>
  glossary: GlossaryTerm[]
  /** Теги, от которых зависят ачивки: для каждого должен быть хотя бы один урок. */
  requiredTags?: ExerciseTag[]
}

const blank = (s: unknown) => typeof s !== 'string' || s.trim() === ''

/**
 * Проверяет согласованность каталога и авторского контента.
 * Возвращает список ошибок на русском; пустой список — всё в порядке.
 */
export function validateCatalog(input: CatalogValidationInput): string[] {
  const { catalog, lessons, levelContent, glossary, requiredTags = [] } = input
  const errors: string[] = []
  const filmIds = new Set<string>()
  const levelIds = new Set<string>()
  const levelNumbers = new Set<number>()

  if (blank(catalog.course?.id) || blank(catalog.course?.title)) {
    errors.push('Каталог: не заполнены course.id или course.title')
  }

  for (const level of catalog.levels) {
    const where = `Уровень ${level.id}`
    if (!SLUG.test(level.id)) errors.push(`${where}: id должен быть slug`)
    if (levelIds.has(level.id)) errors.push(`${where}: повторяющийся id`)
    levelIds.add(level.id)
    if (levelNumbers.has(level.number)) errors.push(`${where}: повторяющийся номер ${level.number}`)
    levelNumbers.add(level.number)
    if (!LEVEL_STATUSES.includes(level.status)) errors.push(`${where}: неизвестный статус ${level.status}`)
    if (blank(level.title) || blank(level.purpose)) errors.push(`${where}: пустое название или цель`)
    if (level.skills.length < 2 || level.skills.length > 4) {
      errors.push(`${where}: навыков должно быть 2–4, сейчас ${level.skills.length}`)
    }
    if (level.films.length < MIN_FILMS_PER_LEVEL) {
      errors.push(`${where}: фильмов меньше ${MIN_FILMS_PER_LEVEL}`)
    }
    if (!levelContent[level.id]) errors.push(`${where}: нет контента уровня (лекции)`)

    const orders = new Set<number>()
    for (const film of level.films) {
      const fw = `Фильм ${film.id}`
      if (!SLUG.test(film.id)) errors.push(`${fw}: id должен быть slug`)
      if (filmIds.has(film.id)) errors.push(`${fw}: повторяющийся id`)
      filmIds.add(film.id)
      if (orders.has(film.order)) errors.push(`${fw}: повторяющийся order ${film.order} в ${level.id}`)
      orders.add(film.order)
      if (!FILM_STATUSES.includes(film.status)) errors.push(`${fw}: неизвестный статус ${film.status}`)
      if (!Number.isInteger(film.year) || film.year < 1880 || film.year > 2100) {
        errors.push(`${fw}: неправдоподобный год ${film.year}`)
      }
      if (blank(film.title) || blank(film.learningFocus)) errors.push(`${fw}: пустое название или фокус`)
    }
  }

  const sortedNumbers = [...levelNumbers].sort((a, b) => a - b)
  sortedNumbers.forEach((n, i) => {
    if (n !== i + 1) errors.push(`Номера уровней должны идти подряд с 1, найден ${n}`)
  })

  const termIds = new Set<string>()
  for (const term of glossary) {
    if (termIds.has(term.id)) errors.push(`Термин ${term.id}: повторяющийся id`)
    termIds.add(term.id)
    if ([term.term, term.simple, term.professional, term.noticeQuestion, term.example.text].some(blank)) {
      errors.push(`Термин ${term.id}: есть пустые поля`)
    }
    if (!filmIds.has(term.example.filmId)) {
      errors.push(`Термин ${term.id}: пример ссылается на неизвестный фильм ${term.example.filmId}`)
    }
  }

  const usedTerms = new Set<string>()
  const usedTags = new Set<ExerciseTag>()
  for (const [filmId, lesson] of Object.entries(lessons)) {
    const lw = `Урок ${filmId}`
    if (!filmIds.has(filmId)) {
      errors.push(`${lw}: фильма нет в каталоге`)
      continue
    }
    if (blank(lesson.why) || blank(lesson.startQuestion)) errors.push(`${lw}: пустая настройка внимания`)
    if (lesson.lookFor.length < 2 || lesson.lookFor.length > 3) errors.push(`${lw}: lookFor должно быть 2–3`)
    if (lesson.duringCues.length < 2) errors.push(`${lw}: нужно минимум 2 ориентира во время просмотра`)
    const q = lesson.afterQuestions
    if ([q.observation, q.effect, q.interpretation].some(blank)) errors.push(`${lw}: пустые вопросы после просмотра`)
    const ex = lesson.exercise
    if ([ex.title, ex.task, ex.lookAt].some(blank)) errors.push(`${lw}: пустые поля упражнения`)
    if (ex.steps.length < 2) errors.push(`${lw}: в упражнении нужно минимум 2 шага`)
    if (ex.tags.length === 0) errors.push(`${lw}: у упражнения нет тегов`)
    for (const tag of ex.tags) {
      if (!EXERCISE_TAGS.includes(tag)) errors.push(`${lw}: неизвестный тег ${tag}`)
      usedTags.add(tag)
    }
    if (lesson.samples.length === 0 || lesson.samples.some((s) => blank(s.text))) {
      errors.push(`${lw}: нужен хотя бы один образец разбора`)
    }
    if (lesson.terms.length === 0) errors.push(`${lw}: нет связанных терминов`)
    for (const t of lesson.terms) {
      if (!termIds.has(t)) errors.push(`${lw}: неизвестный термин ${t}`)
      usedTerms.add(t)
    }
  }
  for (const filmId of filmIds) {
    if (!lessons[filmId]) errors.push(`Фильм ${filmId}: нет урока`)
  }
  for (const termId of termIds) {
    if (!usedTerms.has(termId)) errors.push(`Термин ${termId}: не используется ни в одном уроке`)
  }
  for (const tag of requiredTags) {
    if (!usedTags.has(tag)) errors.push(`Нет ни одного упражнения с тегом ${tag}, нужным для ачивки`)
  }

  for (const [levelId, content] of Object.entries(levelContent)) {
    if (!levelIds.has(levelId)) {
      errors.push(`Контент уровня ${levelId}: уровня нет в каталоге`)
      continue
    }
    if (blank(content.lecture.principle) || blank(content.outcome) || blank(content.reflectionPrompt)) {
      errors.push(`Контент уровня ${levelId}: пустые поля`)
    }
    if (content.lecture.examples.length < 2 || content.lecture.examples.length > 3) {
      errors.push(`Контент уровня ${levelId}: примеров должно быть 2–3`)
    }
    for (const ex of content.lecture.examples) {
      if (ex.filmId && !filmIds.has(ex.filmId)) {
        errors.push(`Контент уровня ${levelId}: пример ссылается на неизвестный фильм ${ex.filmId}`)
      }
    }
  }

  return errors
}
