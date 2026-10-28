/**
 * Словарь (ТЗ §14): термины по темам, поиск по статье, фильтр по уровню
 * и уроки, в которых встречается термин.
 */
import { containsWords, searchable } from '../shared/text'
import { filmsUsingTerm } from './catalog'
import type { Course, Film, GlossaryGroupId, GlossaryTerm } from './catalog.types'

/** Порядок тем на странице; внутри темы — порядок терминов в src/content/glossary.ts. */
export const GLOSSARY_GROUPS: readonly { id: GlossaryGroupId; title: string }[] = [
  { id: 'frame', title: 'Кадр и план' },
  { id: 'space', title: 'Композиция и пространство' },
  { id: 'camera', title: 'Камера и взгляд' },
  { id: 'montage', title: 'Монтаж и время' },
  { id: 'light', title: 'Свет, цвет и стиль' },
  { id: 'sound', title: 'Звук' },
  { id: 'meaning', title: 'Смысл и напряжение' },
]

export interface GlossaryFilter {
  query: string
  levelId: string | null
}

export interface GlossarySection {
  id: GlossaryGroupId
  title: string
  terms: GlossaryTerm[]
}

/** Ищет по всей статье и по названию фильма из примера. */
export function termMatches(course: Course, term: GlossaryTerm, query: string): boolean {
  const film = course.filmById.get(term.example.filmId)
  const text = [term.term, term.aka, term.simple, term.professional, term.noticeQuestion, term.example.text, film?.title]
  return containsWords(searchable(text.filter(Boolean).join(' ')), query)
}

/** Темы с подходящими терминами; пустые темы не возвращаются. */
export function glossarySections(course: Course, filter: GlossaryFilter): GlossarySection[] {
  const level = filter.levelId ? course.levelById.get(filter.levelId) : undefined
  const terms = course.glossary.filter(
    (t) => (!level || level.termIds.includes(t.id)) && termMatches(course, t, filter.query),
  )
  return GLOSSARY_GROUPS.map((g) => ({ ...g, terms: terms.filter((t) => t.group === g.id) })).filter(
    (s) => s.terms.length,
  )
}

/** Уроки с термином в порядке курса; уроки выбранного уровня — первыми. */
export function termLessons(course: Course, termId: string, levelId: string | null = null): Film[] {
  const films = filmsUsingTerm(course, termId)
  if (!levelId) return films
  return [...films.filter((f) => f.levelId === levelId), ...films.filter((f) => f.levelId !== levelId)]
}
