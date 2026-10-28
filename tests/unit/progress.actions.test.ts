import { describe, expect, it } from 'vitest'
import { createInitialProgress, hasAnyProgress } from '@/domain/progress/progress.defaults'
import {
  addGraduationDecision,
  addNote,
  completeExercise,
  completeGraduation,
  completeFilm,
  completeLevel,
  deleteNote,
  markWatched,
  removeGraduationDecision,
  setAnswer,
  setExerciseResponse,
  setGraduationDecision,
  setLevelReflection,
  setReviewing,
  startWatching,
  unmarkWatched,
  updateGraduation,
  updateNote,
} from '@/domain/progress/progress.actions'
import {
  canCompleteFilm,
  courseMap,
  courseStats,
  filmDisplayStatus,
  filmStartStage,
  graduationCriteria,
  graduationStatus,
  hasMarkedFilm,
  levelContinue,
  levelStats,
  levelStatus,
  nextStep,
  resumeInfo,
} from '@/domain/progress/progress.selectors'
import { CURRENT_SCHEMA_VERSION } from '@/domain/progress/progress.types'
import { COMMON_SELF_CHECK, filmNeighbours, selfCheckItems } from '@/domain/catalog/catalog'
import { LONG, makeTestCourse, T0 } from '../helpers'

const course = makeTestCourse()
const level1 = course.levels[0]!
const filmId = level1.films[0]!.id

describe('начальное состояние (тест ТЗ №1)', () => {
  it('создаётся пустым, с настройками по умолчанию и без прогресса', () => {
    const p = createInitialProgress(T0)
    expect(p.createdAt).toBe(T0.toISOString())
    expect(p.lastActiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(p.films).toEqual({})
    expect(p.notes).toEqual([])
    expect(p.xp).toBe(0)
    expect(p.xpLedger).toEqual([])
    expect(p.settings.showGamification).toBe(true)
    expect(p.settings.sequentialMode).toBe(false)
    expect(hasAnyProgress(p)).toBe(false)
    expect(CURRENT_SCHEMA_VERSION).toBe(2)
  })
})

describe('просмотр фильма (тест ТЗ №2)', () => {
  it('отметка просмотра сохраняет статус и дату', () => {
    const p = markWatched(createInitialProgress(T0), filmId, T0)
    expect(p.films[filmId]?.watchStatus).toBe('watched')
    expect(p.films[filmId]?.watchedAt).toBe(T0.toISOString())
    expect(filmDisplayStatus(p.films[filmId])).toBe('watched')
    expect(p.activityDays).toHaveLength(1)
  })

  it('повторная отметка не меняет дату первого просмотра', () => {
    const p1 = markWatched(createInitialProgress(T0), filmId, T0)
    const p2 = markWatched(p1, filmId, new Date(T0.getTime() + 86_400_000))
    expect(p2).toBe(p1)
  })

  it('отмена просмотра возможна, пока фильм не завершён', () => {
    const p = unmarkWatched(markWatched(createInitialProgress(T0), filmId, T0), filmId, T0)
    expect(p.films[filmId]?.watchStatus).toBe('started')
    expect(p.films[filmId]?.watchedAt).toBeNull()
  })
})

describe('ответы, упражнение и завершение', () => {
  it('ответ переводит анализ в «в процессе», не трогая просмотр', () => {
    const p = setAnswer(createInitialProgress(T0), filmId, 'observation', LONG, T0)
    expect(p.films[filmId]?.analysisStatus).toBe('in-progress')
    expect(p.films[filmId]?.watchStatus).toBe('not-watched')
    expect(filmDisplayStatus(p.films[filmId])).toBe('started')
  })

  it('упражнение нельзя завершить с пустым ответом', () => {
    const p0 = createInitialProgress(T0)
    expect(completeExercise(p0, filmId, T0)).toBe(p0)
    const p1 = completeExercise(setExerciseResponse(p0, filmId, LONG, T0), filmId, T0)
    expect(p1.films[filmId]?.exercise.completedAt).toBe(T0.toISOString())
  })

  it('фильм завершается только после просмотра и упражнения; облегчённый режим требует заметку', () => {
    let p = markWatched(createInitialProgress(T0), filmId, T0)
    expect(canCompleteFilm(p, filmId)).toBe(false)
    expect(completeFilm(p, filmId, T0)).toBe(p)

    const light = { ...p, settings: { ...p.settings, lightMode: true } }
    expect(canCompleteFilm(light, filmId)).toBe(false)
    expect(canCompleteFilm(setAnswer(light, filmId, 'observation', LONG, T0), filmId)).toBe(true)

    p = completeExercise(setExerciseResponse(p, filmId, LONG, T0), filmId, T0)
    p = completeFilm(p, filmId, T0)
    expect(p.films[filmId]?.completedAt).not.toBeNull()
    expect(p.films[filmId]?.analysisStatus).toBe('completed')
  })

  it('повторный разбор не сбрасывает завершение', () => {
    let p = markWatched(createInitialProgress(T0), filmId, T0)
    p = completeFilm(completeExercise(setExerciseResponse(p, filmId, LONG, T0), filmId, T0), filmId, T0)
    const completedAt = p.films[filmId]?.completedAt
    p = setReviewing(p, filmId, true, T0)
    p = setAnswer(p, filmId, 'hypothesis', 'Новая мысль при повторном просмотре', T0)
    expect(p.films[filmId]?.completedAt).toBe(completedAt)
    expect(filmDisplayStatus(p.films[filmId])).toBe('reviewing')
    expect(unmarkWatched(p, filmId, T0)).toBe(p)
  })
})

describe('заметки', () => {
  it('создание, правка и удаление', () => {
    let p = addNote(createInitialProgress(T0), { text: LONG, kind: 'observation', filmId }, T0, 'n1')
    expect(p.notes).toHaveLength(1)
    expect(p.films[filmId]?.analysisStatus).toBe('in-progress')
    p = updateNote(p, 'n1', { text: 'Изменённый текст заметки о кадре' }, T0)
    expect(p.notes[0]?.text).toBe('Изменённый текст заметки о кадре')
    p = deleteNote(p, 'n1', T0)
    expect(p.notes).toHaveLength(0)
  })

  it('пустая заметка не создаётся', () => {
    const p = createInitialProgress(T0)
    expect(addNote(p, { text: '   ', kind: 'free', filmId: null }, T0)).toBe(p)
  })
})

describe('прогресс уровня (тест ТЗ №4)', () => {
  const finish = (p: ReturnType<typeof createInitialProgress>, id: string) =>
    completeFilm(completeExercise(setExerciseResponse(markWatched(p, id, T0), id, LONG, T0), id, T0), id, T0)

  it('0 фильмов — 0%', () => {
    const s = levelStats(level1, createInitialProgress(T0))
    expect(s.percent).toBe(0)
    expect(s.completed).toBe(0)
    expect(s.canComplete).toBe(false)
  })

  it('1 фильм — 14%, «1 из 7»', () => {
    const s = levelStats(level1, finish(createInitialProgress(T0), filmId))
    expect(s.completed).toBe(1)
    expect(s.total).toBe(7)
    expect(s.percent).toBe(14)
  })

  it('все фильмы — 100%, уровень можно завершить после рефлексии', () => {
    let p = createInitialProgress(T0)
    for (const f of level1.films) p = finish(p, f.id)
    expect(levelStats(level1, p).percent).toBe(100)
    expect(levelStats(level1, p).canComplete).toBe(false)
    expect(completeLevel(p, level1, T0)).toBe(p)
    p = setLevelReflection(p, level1.id, 'Я научился видеть, как монтаж меняет смысл кадров', T0)
    expect(levelStats(level1, p).canComplete).toBe(true)
    p = completeLevel(p, level1, T0)
    expect(p.levels[level1.id]?.completedAt).toBe(T0.toISOString())
    expect(levelStatus(course, level1, p)).toBe('completed')
    expect(courseStats(course, p).levelsCompleted).toBe(1)
  })

  it('критерий 70% просмотров: 5 из 7', () => {
    expect(levelStats(level1, createInitialProgress(T0)).requiredWatched).toBe(5)
  })
})

describe('статус уровня и следующий шаг', () => {
  it('строгий порядок закрывает второй уровень', () => {
    const p = createInitialProgress(T0)
    const strict = { ...p, settings: { ...p.settings, sequentialMode: true } }
    expect(levelStatus(course, course.levels[1]!, p)).toBe('available')
    expect(levelStatus(course, course.levels[1]!, strict)).toBe('locked')
  })

  it('карта курса: все уровни по порядку, «Вы здесь» — первый незавершённый', () => {
    let p = createInitialProgress(T0)
    const empty = courseMap(course, p)
    expect(empty.map((e) => e.level.number)).toEqual(course.levels.map((l) => l.number))
    expect(empty.filter((e) => e.isCurrent).map((e) => e.level.id)).toEqual([level1.id])
    expect(empty.every((e) => e.status === 'available' && e.stats.completed === 0)).toBe(true)

    p = markWatched(p, filmId, T0)
    expect(courseMap(course, p)[0]!.status).toBe('in-progress')

    p = { ...p, levels: { ...p.levels, [level1.id]: { reflection: 'итог', reflectionUpdatedAt: null, completedAt: T0.toISOString() } } }
    const after = courseMap(course, p)
    expect(after[0]!.status).toBe('completed')
    expect(after[0]!.isCurrent).toBe(false)
    expect(after[1]!.isCurrent).toBe(true)
  })

  it('карта курса в строгом порядке: открыт только следующий уровень', () => {
    const p = createInitialProgress(T0)
    const strict = { ...p, settings: { ...p.settings, sequentialMode: true } }
    const statuses = courseMap(course, strict).map((e) => e.status)
    expect(statuses[0]).toBe('available')
    expect(statuses.slice(1).every((s) => s === 'locked')).toBe(true)
  })

  it('продолжение на странице уровня: первый незавершённый фильм → итог уровня → следующий уровень', () => {
    let p = createInitialProgress(T0)
    const first = levelContinue(course, level1, p)
    expect(first.kind === 'film' && first.film.id === filmId).toBe(true)

    const finish = (q: typeof p, id: string) =>
      completeFilm(completeExercise(setExerciseResponse(markWatched(q, id, T0), id, LONG, T0), id, T0), id, T0)
    p = finish(p, filmId)
    const second = levelContinue(course, level1, p)
    expect(second.kind === 'film' && second.film.id === level1.films[1]!.id).toBe(true)

    for (const f of level1.films) p = finish(p, f.id)
    expect(levelContinue(course, level1, p).kind).toBe('complete')

    p = completeLevel(setLevelReflection(p, level1.id, 'Я научился видеть, как монтаж меняет смысл кадров', T0), level1, T0)
    const next = levelContinue(course, level1, p)
    expect(next.kind === 'next-level' && next.level.id === course.levels[1]!.id).toBe(true)

    const last = course.levels[course.levels.length - 1]!
    const done = { ...p, levels: { ...p.levels, [last.id]: { reflection: 'итог', reflectionUpdatedAt: null, completedAt: T0.toISOString() } } }
    expect(levelContinue(course, last, done).kind).toBe('graduation')
  })

  it('без прогресса — старт с первого фильма, затем возврат к текущему', () => {
    const p0 = createInitialProgress(T0)
    expect(nextStep(course, p0).kind).toBe('start')
    const other = level1.films[3]!.id
    const p1 = { ...markWatched(p0, filmId, T0), currentFilmId: other, currentLevelId: level1.id }
    const step = nextStep(course, p1)
    expect(step.kind === 'film' && step.film.id === other && step.reason === 'current').toBe(true)
  })
})

describe('блок «Продолжить» на главной', () => {
  const finish = (p: ReturnType<typeof createInitialProgress>, id: string) =>
    completeFilm(completeExercise(setExerciseResponse(markWatched(p, id, T0), id, LONG, T0), id, T0), id, T0)

  it('без прогресса — первый фильм курса, подсказки новичку развёрнуты', () => {
    const p = createInitialProgress(T0)
    const r = resumeInfo(course, p)
    expect(r.step.kind).toBe('start')
    expect(r.level?.id).toBe(level1.id)
    expect(r.filmsLeft).toBe(level1.films.length)
    expect(r.stage).toBeNull()
    expect(hasMarkedFilm(p)).toBe(false)
  })

  it('начатый фильм — шаг урока, где остановились; сворачивание после отметки «посмотрел»', () => {
    let p = startWatching(createInitialProgress(T0), filmId, T0)
    let r = resumeInfo(course, p)
    expect(r.step.kind === 'film' && r.step.film.id === filmId).toBe(true)
    expect(r.stage).toBe('during')
    expect(hasMarkedFilm(p)).toBe(false)

    p = markWatched(p, filmId, T0)
    r = resumeInfo(course, p)
    expect(r.stage).toBe('after')
    expect(r.filmsLeft).toBe(level1.films.length)
    expect(hasMarkedFilm(p)).toBe(true)
  })

  it('следующий фильм без прогресса — без шага урока; пройденные фильмы уменьшают остаток', () => {
    const r = resumeInfo(course, finish(createInitialProgress(T0), filmId))
    expect(r.step.kind === 'film' && r.step.film.id === level1.films[1]!.id && r.step.reason === 'next').toBe(true)
    expect(r.stage).toBeNull()
    expect(r.filmsLeft).toBe(level1.films.length - 1)
    expect(r.stats?.completed).toBe(1)
  })

  it('выполненные условия уровня — шаг «завершить уровень»; после всех уровней — без уровня', () => {
    let p = createInitialProgress(T0)
    for (const f of level1.films) p = finish(p, f.id)
    p = setLevelReflection(p, level1.id, 'Я научился видеть, как монтаж меняет смысл кадров', T0)
    const r = resumeInfo(course, p)
    expect(r.step.kind).toBe('level')
    expect(r.level?.id).toBe(level1.id)
    expect(r.filmsLeft).toBe(0)

    const levels = Object.fromEntries(
      course.levels.map((l) => [l.id, { reflection: 'итог', reflectionUpdatedAt: null, completedAt: T0.toISOString() }]),
    )
    const done = resumeInfo(course, { ...p, levels })
    expect(done.step.kind).toBe('graduation')
    expect(done.level).toBeNull()
    expect(done.stats).toBeNull()
    expect(done.filmsLeft).toBe(0)
  })
})

describe('страница фильма', () => {
  it('урок открывается на шаге, где пользователь остановился', () => {
    let p = createInitialProgress(T0)
    expect(filmStartStage(p.films[filmId])).toBe('before')
    p = startWatching(p, filmId, T0)
    expect(filmStartStage(p.films[filmId])).toBe('during')
    expect(filmStartStage(setAnswer(createInitialProgress(T0), filmId, 'observation', 'дверь', T0).films[filmId])).toBe(
      'after',
    )
    p = markWatched(p, filmId, T0)
    expect(filmStartStage(p.films[filmId])).toBe('after')
  })

  it('самопроверка: сначала общие пункты, затем пункты упражнения', () => {
    expect(selfCheckItems({})).toEqual([...COMMON_SELF_CHECK])
    expect(selfCheckItems({ selfCheck: ['Свой пункт'] })).toEqual([...COMMON_SELF_CHECK, 'Свой пункт'])
  })

  it('соседние фильмы уровня по порядку', () => {
    const [a, b, c] = level1.films
    expect(filmNeighbours(level1, a!.id)).toEqual({ prev: null, next: b })
    expect(filmNeighbours(level1, b!.id)).toEqual({ prev: a, next: c })
    expect(filmNeighbours(level1, 'нет-такого')).toEqual({ prev: null, next: null })
  })
})

describe('выпускная работа', () => {
  const decision = (i: number) => ({ observation: `Решение ${i}: камера держит героя у края кадра`, effect: 'Ощущение, что ему нет места' })

  it('статус: не начата → в процессе → завершена; завершить можно только по критериям', () => {
    let p = createInitialProgress(T0)
    expect(graduationStatus(p)).toBe('not-started')
    p = setGraduationDecision(p, 1, { observation: 'Кадр' }, T0)
    expect(graduationStatus(p)).toBe('in-progress')

    expect(completeGraduation(p, T0)).toBe(p)
    p = updateGraduation(p, { subject: 'Фильм уровня 13, три сцены: начало, середина, финал', mainQuestion: 'Почему герой одинок среди людей?' }, T0)
    for (const i of [0, 1, 2]) p = setGraduationDecision(p, i, decision(i), T0)
    p = updateGraduation(p, { connections: LONG + LONG, interpretation: LONG + LONG + LONG + LONG }, T0)
    expect(graduationCriteria(p).every((c) => c.met)).toBe(true)

    p = completeGraduation(p, T0)
    expect(p.graduation.completedAt).toBe(T0.toISOString())
    expect(graduationStatus(p)).toBe('completed')
  })

  it('решений не меньше трёх: лишние удаляются, обязательные — нет', () => {
    let p = createInitialProgress(T0)
    expect(p.graduation.decisions).toHaveLength(3)
    expect(removeGraduationDecision(p, 0, T0)).toBe(p)
    p = addGraduationDecision(p, T0)
    p = setGraduationDecision(p, 3, decision(3), T0)
    expect(p.graduation.decisions).toHaveLength(4)
    p = removeGraduationDecision(p, 3, T0)
    expect(p.graduation.decisions).toHaveLength(3)
  })
})
