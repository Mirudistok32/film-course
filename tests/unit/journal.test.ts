import { describe, expect, it } from 'vitest'
import { createInitialProgress } from '@/domain/progress/progress.defaults'
import { addNote, setAnswer, setExerciseResponse } from '@/domain/progress/progress.actions'
import {
  ALL_FILMS,
  EMPTY_JOURNAL_FILTER,
  filterJournal,
  journalEntries,
  NO_FILM,
} from '@/domain/progress/progress.journal'
import { makeTestCourse, T0 } from '../helpers'

const course = makeTestCourse()
const [film1, film2] = course.levels[0]!.films
const film3 = course.levels[1]!.films[0]!
const at = (min: number) => new Date(T0.getTime() + min * 60_000)

function sample() {
  let p = createInitialProgress(T0)
  p = setAnswer(p, film1!.id, 'observation', 'Тени длиннее людей', at(1))
  p = addNote(p, { text: 'Свободная мысль о тишине', kind: 'free', filmId: null }, at(2), 'n-free')
  p = addNote(p, { text: 'Камера не двигается', kind: 'observation', filmId: film2!.id }, at(3), 'n-film2')
  p = setExerciseResponse(p, film3.id, 'Ёлки в кадре как рамка', at(4))
  return p
}

describe('журнал', () => {
  it('собирает заметки и разборы, новые сверху', () => {
    const entries = journalEntries(course, sample())
    expect(entries.map((e) => e.id)).toEqual([`analysis-${film3.id}`, 'n-film2', 'n-free', `analysis-${film1!.id}`])
    const analysis = entries[0]!
    expect(analysis.type === 'analysis' && analysis.parts).toEqual([{ key: 'exercise', text: 'Ёлки в кадре как рамка' }])
  })

  it('фильм без ответов не даёт пустого разбора', () => {
    let p = createInitialProgress(T0)
    p = addNote(p, { text: 'Заметка', kind: 'free', filmId: film1!.id }, at(1), 'n1')
    expect(journalEntries(course, p).map((e) => e.type)).toEqual(['note'])
  })

  it('фильтрует по уровню, фильму, свободным заметкам и типу', () => {
    const entries = journalEntries(course, sample())
    const ids = (f: Partial<typeof EMPTY_JOURNAL_FILTER>) =>
      filterJournal(entries, { ...EMPTY_JOURNAL_FILTER, ...f }).map((e) => e.id)

    expect(ids({ levelId: course.levels[0]!.id })).toEqual(['n-film2', `analysis-${film1!.id}`])
    expect(ids({ filmId: film2!.id })).toEqual(['n-film2'])
    expect(ids({ filmId: NO_FILM })).toEqual(['n-free'])
    expect(ids({ type: 'analysis', filmId: ALL_FILMS })).toEqual([`analysis-${film3.id}`, `analysis-${film1!.id}`])
    expect(ids({ type: 'note', levelId: course.levels[1]!.id })).toEqual([])
  })

  it('ищет по словам без учёта регистра и «ё», в том числе по названию фильма', () => {
    const entries = journalEntries(course, sample())
    const ids = (query: string) => filterJournal(entries, { ...EMPTY_JOURNAL_FILTER, query }).map((e) => e.id)

    expect(ids('ТИШИНЕ')).toEqual(['n-free'])
    expect(ids('елки рамка')).toEqual([`analysis-${film3.id}`])
    expect(ids('тени тишина')).toEqual([])
    expect(ids(film2!.title.split(' ')[0]!)).toContain('n-film2')
    expect(ids('   ')).toHaveLength(4)
  })
})
