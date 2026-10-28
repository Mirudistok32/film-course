import { describe, expect, it } from 'vitest'
import { course } from '@/content/course'
import { GLOSSARY_GROUPS, glossarySections, termLessons, termMatches } from '@/domain/catalog/glossary'

const term = (id: string) => course.termById.get(id)!
const ids = (query: string, levelId: string | null = null) =>
  glossarySections(course, { query, levelId }).flatMap((s) => s.terms.map((t) => t.id))

describe('словарь', () => {
  it('каждая тема непустая, все термины попадают на страницу по одному разу', () => {
    const sections = glossarySections(course, { query: '', levelId: null })
    expect(sections.map((s) => s.id)).toEqual(GLOSSARY_GROUPS.map((g) => g.id))
    const all = sections.flatMap((s) => s.terms.map((t) => t.id))
    expect(all).toHaveLength(course.glossary.length)
    expect(new Set(all).size).toBe(all.length)
  })

  it('внутри темы сохраняется порядок из файла словаря', () => {
    const frame = glossarySections(course, { query: '', levelId: null })[0]!
    expect(frame.terms.map((t) => t.id)).toEqual(['frame', 'shot', 'long-shot', 'medium-shot', 'close-up'])
  })

  it('поиск — по всей статье и названию фильма, без учёта регистра и «ё», все слова', () => {
    expect(termMatches(course, term('diegetic-sound'), 'ДИЕГЕТИЧЕСКИЙ')).toBe(true)
    expect(termMatches(course, term('jump-cut'), 'джамп')).toBe(true)
    expect(ids('Стачки бойни')).toEqual(['metaphor'])
    expect(ids('Стачки джамп')).toEqual([])
    expect(ids('Калигари')).toEqual(expect.arrayContaining(['frame', 'expressionism']))
    expect(ids('остается').length).toBeGreaterThan(0)
    expect(ids('остается')).toEqual(ids('остаётся'))
    expect(ids('ничего такого нет в словаре')).toEqual([])
  })

  it('фильтр по уровню оставляет только термины из уроков уровня', () => {
    const level = course.levels[2]!
    const shown = ids('', level.id)
    expect(shown.length).toBe(level.termIds.length)
    expect(new Set(shown)).toEqual(new Set(level.termIds))
  })

  it('уроки с термином — в порядке курса, уроки выбранного уровня первыми', () => {
    const all = termLessons(course, 'long-shot')
    expect(all.length).toBeGreaterThan(5)
    const order = all.map((f) => course.films.indexOf(f))
    expect(order).toEqual([...order].sort((a, b) => a - b))

    const levelId = all.at(-1)!.levelId
    const first = termLessons(course, 'long-shot', levelId)
    const fromLevel = all.filter((f) => f.levelId === levelId).length
    expect(first.slice(0, fromLevel).every((f) => f.levelId === levelId)).toBe(true)
    expect(new Set(first)).toEqual(new Set(all))
  })
})
