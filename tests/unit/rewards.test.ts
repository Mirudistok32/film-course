import { describe, expect, it } from 'vitest'
import { createInitialProgress } from '@/domain/progress/progress.defaults'
import {
  addMotif,
  addNote,
  completeExercise,
  completeFilm,
  markWatched,
  setAnswer,
  setExerciseResponse,
  updateNote,
} from '@/domain/progress/progress.actions'
import { ACHIEVEMENTS, XP_RULES } from '@/domain/rewards/rewards.config'
import { evaluateRewards, rankFor } from '@/domain/rewards/rewards.engine'
import { LONG, makeTestCourse, T0 } from '../helpers'

const course = makeTestCourse()
const f1 = course.levels[0]!.films[0]!.id
const f2 = course.levels[0]!.films[1]!.id
const later = new Date(T0.getTime() + 3_600_000)

describe('XP и ачивки', () => {
  it('ачивки имеют уникальные стабильные id', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(12)
  })

  it('просмотр даёт XP и ачивку «Первый просмотр»', () => {
    const r = evaluateRewards(course, markWatched(createInitialProgress(T0), f1, T0), T0)
    expect(r.gainedXp).toBe(XP_RULES.filmWatched)
    expect(r.progress.xp).toBe(10)
    expect(r.unlocked.map((a) => a.id)).toEqual(['first-viewing'])
  })

  it('одна и та же ачивка не открывается повторно (тест ТЗ №5)', () => {
    const r1 = evaluateRewards(course, markWatched(createInitialProgress(T0), f1, T0), T0)
    const r2 = evaluateRewards(course, markWatched(r1.progress, f2, later), later)
    expect(r2.unlocked.map((a) => a.id)).not.toContain('first-viewing')
    expect(r2.progress.achievements.filter((a) => a.id === 'first-viewing')).toHaveLength(1)
    expect(r2.progress.achievements[0]?.unlockedAt).toBe(T0.toISOString())
  })

  it('повторное действие не начисляет XP второй раз (тест ТЗ №6)', () => {
    let p = evaluateRewards(course, setAnswer(createInitialProgress(T0), f1, 'observation', LONG, T0), T0).progress
    expect(p.xp).toBe(XP_RULES.firstMeaningfulNote)
    // правка опечатки и повторный вызов движка
    p = setAnswer(p, f1, 'observation', `${LONG}.`, later)
    const again = evaluateRewards(course, p, later)
    expect(again.gainedXp).toBe(0)
    expect(evaluateRewards(course, again.progress, later).progress).toBe(again.progress)
    expect(again.progress.xp).toBe(XP_RULES.firstMeaningfulNote)
  })

  it('XP не снимается, если отметку просмотра отменили и поставили снова', () => {
    let p = evaluateRewards(course, markWatched(createInitialProgress(T0), f1, T0), T0).progress
    p = { ...p, films: { ...p.films, [f1]: { ...p.films[f1]!, watchStatus: 'not-watched', watchedAt: null } } }
    p = evaluateRewards(course, p, later).progress
    expect(p.xp).toBe(10)
    p = evaluateRewards(course, markWatched(p, f1, later), later).progress
    expect(p.xp).toBe(10)
  })

  it('цепочка наблюдение → эффект → гипотеза открывает «От формы к чувству»', () => {
    let p = createInitialProgress(T0)
    p = setAnswer(p, f1, 'observation', LONG, T0)
    p = setAnswer(p, f1, 'feeling', 'Пространство вызывает тревогу и ожидание', T0)
    p = setAnswer(p, f1, 'hypothesis', 'Мир фильма отражает нестабильное восприятие', T0)
    const ids = evaluateRewards(course, p, T0).unlocked.map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['i-noticed', 'form-to-feeling']))
  })

  it('возвращение к пройденному фильму даёт 5 XP один раз', () => {
    let p = setAnswer(markWatched(createInitialProgress(T0), f1, T0), f1, 'observation', LONG, T0)
    p = completeFilm(completeExercise(setExerciseResponse(p, f1, LONG, T0), f1, T0), f1, T0)
    p = evaluateRewards(course, p, T0).progress
    const before = p.xp
    p = addNote(p, { text: 'При повторном просмотре заметил новый ритм', kind: 'observation', filmId: f1 }, later, 'n1')
    p = addNote(p, { text: 'И ещё одно наблюдение о свете в финале', kind: 'observation', filmId: f1 }, later, 'n2')
    const r = evaluateRewards(course, p, later)
    expect(r.progress.xp - before).toBe(XP_RULES.revisit)
    expect(r.unlocked.map((a) => a.id)).toContain('return-to-frame')
    // правка заметки не даёт новых очков
    const edited = updateNote(r.progress, 'n1', { text: 'Исправленная заметка о новом ритме' }, later)
    expect(evaluateRewards(course, edited, later).gainedXp).toBe(0)
  })

  it('мастерство: упражнение с тегом монтажа открывает «Чувство ритма»', () => {
    const montageFilm = course.levels[3]!.films[0]!.id
    const p = completeExercise(setExerciseResponse(createInitialProgress(T0), montageFilm, LONG, T0), montageFilm, T0)
    expect(evaluateRewards(course, p, T0).unlocked.map((a) => a.id)).toContain('sense-of-rhythm')
  })

  it('«След мотива» требует минимум двух фильмов', () => {
    const one = addMotif(createInitialProgress(T0), { title: 'Лестница', description: '', filmIds: [f1] }, T0)
    expect(evaluateRewards(course, one, T0).unlocked.map((a) => a.id)).not.toContain('motif-trace')
    const two = addMotif(createInitialProgress(T0), { title: 'Лестница', description: '', filmIds: [f1, f2] }, T0)
    expect(evaluateRewards(course, two, T0).unlocked.map((a) => a.id)).toContain('motif-trace')
  })

  it('«Не только сюжет» — три записи о формальных решениях', () => {
    let p = createInitialProgress(T0)
    p = addNote(p, { text: 'Герой долго идёт по дороге, потом уезжает', kind: 'free', filmId: f1 }, T0, 'a')
    p = addNote(p, { text: 'Крупный план лица держится очень долго', kind: 'free', filmId: f1 }, T0, 'b')
    p = addNote(p, { text: 'Музыка исчезает перед развязкой сцены', kind: 'free', filmId: f2 }, T0, 'c')
    expect(evaluateRewards(course, p, T0).unlocked.map((a) => a.id)).not.toContain('not-only-plot')
    p = addNote(p, { text: 'Свет падает сбоку и делит лицо пополам', kind: 'free', filmId: f2 }, T0, 'd')
    expect(evaluateRewards(course, p, T0).unlocked.map((a) => a.id)).toContain('not-only-plot')
  })
})

describe('ранги', () => {
  it('ранг вычисляется из XP и не зависит от активности', () => {
    expect(rankFor(0).rank.title).toBe('Наблюдатель')
    expect(rankFor(49).rank.id).toBe('observer')
    expect(rankFor(50).rank.id).toBe('detail-seeker')
    expect(rankFor(100_000).next).toBeNull()
  })
})
