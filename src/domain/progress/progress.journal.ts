/**
 * Журнал (ТЗ §13): заметки и разборы фильмов в одной ленте, фильтры
 * по уровню, фильму и типу записи, поиск по содержимому.
 * Разбор — ответы цепочки и ответ упражнения одного фильма; редактируется
 * на странице фильма, в журнале только читается.
 */
import type { Course, Film } from '../catalog/catalog.types'
import { containsWords, normalizeText, searchable } from '../shared/text'
import type { AnswerKey, Note, UserProgress } from './progress.types'

export type AnalysisPartKey = AnswerKey | 'exercise'

export const ANALYSIS_PARTS: readonly AnalysisPartKey[] = [
  'observation',
  'feeling',
  'hypothesis',
  'evidence',
  'altHypothesis',
  'openQuestion',
  'exercise',
]

export const ANALYSIS_PART_LABEL: Record<AnalysisPartKey, string> = {
  observation: 'Наблюдение',
  feeling: 'Эффект',
  hypothesis: 'Гипотеза',
  evidence: 'Довод',
  altHypothesis: 'Другое прочтение',
  openQuestion: 'Открытый вопрос',
  exercise: 'Упражнение',
}

export interface AnalysisPart {
  key: AnalysisPartKey
  text: string
}

export type JournalEntry =
  | { type: 'note'; id: string; date: string; note: Note; film: Film | null }
  | { type: 'analysis'; id: string; date: string; film: Film; parts: AnalysisPart[] }

export type JournalEntryType = JournalEntry['type']

/** Особые значения фильтра по фильму: все записи и свободные заметки без фильма. */
export const ALL_FILMS = ''
export const NO_FILM = 'none'

export interface JournalFilter {
  levelId: string | null
  /** id фильма, ALL_FILMS или NO_FILM. */
  filmId: string
  type: JournalEntryType | 'all'
  query: string
}

export const EMPTY_JOURNAL_FILTER: JournalFilter = { levelId: null, filmId: ALL_FILMS, type: 'all', query: '' }

function analysisParts(p: UserProgress, filmId: string): AnalysisPart[] {
  const fp = p.films[filmId]
  if (!fp) return []
  return ANALYSIS_PARTS.map((key) => ({
    key,
    text: key === 'exercise' ? fp.exercise.response : (fp.answers[key] ?? ''),
  })).filter((part) => normalizeText(part.text) !== '')
}

/** Все записи журнала, новые сверху (по дате последнего изменения). */
export function journalEntries(course: Course, p: UserProgress): JournalEntry[] {
  const entries: JournalEntry[] = p.notes.map((note) => ({
    type: 'note',
    id: note.id,
    date: note.updatedAt,
    note,
    film: note.filmId ? (course.filmById.get(note.filmId) ?? null) : null,
  }))
  for (const [filmId, fp] of Object.entries(p.films)) {
    const film = course.filmById.get(filmId)
    const parts = analysisParts(p, filmId)
    if (film && parts.length)
      entries.push({ type: 'analysis', id: `analysis-${filmId}`, date: fp.updatedAt, film, parts })
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date))
}

function entryText(entry: JournalEntry): string {
  const film = entry.film ? `${entry.film.title} ${entry.film.director}` : ''
  const body =
    entry.type === 'note' ? `${entry.note.text} ${entry.note.tags.join(' ')}` : entry.parts.map((x) => x.text).join(' ')
  return searchable(`${film} ${body}`)
}

/** Каждое слово запроса должно встретиться в записи или в названии фильма. */
export function matchesQuery(entry: JournalEntry, query: string): boolean {
  return containsWords(entryText(entry), query)
}

export function filterJournal(entries: JournalEntry[], filter: JournalFilter): JournalEntry[] {
  return entries.filter((entry) => {
    if (filter.type !== 'all' && entry.type !== filter.type) return false
    if (filter.filmId === NO_FILM) {
      if (entry.type !== 'note' || entry.note.filmId !== null) return false
    } else if (filter.filmId !== ALL_FILMS && entry.film?.id !== filter.filmId) {
      return false
    }
    if (filter.levelId && entry.film?.levelId !== filter.levelId) return false
    return matchesQuery(entry, filter.query)
  })
}

/** Рекомендуемый шаблон записи (ТЗ §13); писать по нему необязательно. */
export const NOTE_TEMPLATE = [
  'Я заметил: ',
  'Это заставило почувствовать: ',
  'Возможно, это означает: ',
  'На это указывает: ',
].join('\n')
