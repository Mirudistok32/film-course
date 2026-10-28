import { describe, expect, it } from 'vitest'
import { createInitialProgress } from '@/domain/progress/progress.defaults'
import { markWatched } from '@/domain/progress/progress.actions'
import { ACHIEVEMENT_GROUPS, ACHIEVEMENTS, RANKS, XP_RULES } from '@/domain/rewards/rewards.config'
import { achievementBoard, evaluateRewards, rankLadder, xpBreakdown } from '@/domain/rewards/rewards.engine'
import { makeTestCourse, T0 } from '../helpers'

const course = makeTestCourse()
const f1 = course.levels[0]!.films[0]!.id

describe('страница достижений: селекторы', () => {
  it('лестница рангов: пройденные, текущий и впереди', () => {
    expect(rankLadder(0).map((s) => s.state)).toEqual(['current', ...RANKS.slice(1).map(() => 'ahead')])
    const ladder = rankLadder(RANKS[2]!.minXp + 1)
    expect(ladder.map((s) => s.state).slice(0, 4)).toEqual(['passed', 'passed', 'current', 'ahead'])
    expect(rankLadder(1_000_000).at(-1)?.state).toBe('current')
  })

  it('разбивка XP по правилам: все правила, даже не сработавшие', () => {
    const rows = xpBreakdown([
      { id: `watched:${f1}`, amount: 10, at: T0.toISOString() },
      { id: 'watched:other', amount: 10, at: T0.toISOString() },
      { id: 'level:level-01', amount: 50, at: T0.toISOString() },
      { id: 'graduation', amount: 100, at: T0.toISOString() },
      { id: 'unknown:x', amount: 7, at: T0.toISOString() },
    ])
    expect(rows.map((r) => r.rule)).toEqual(Object.keys(XP_RULES))
    const by = Object.fromEntries(rows.map((r) => [r.rule, r]))
    expect(by.filmWatched).toMatchObject({ count: 2, total: 20, amount: XP_RULES.filmWatched })
    expect(by.levelCompleted).toMatchObject({ count: 1, total: 50 })
    expect(by.graduationCompleted).toMatchObject({ count: 1, total: 100 })
    expect(by.exerciseCompleted).toMatchObject({ count: 0, total: 0 })
  })

  it('доска ачивок: все группы, дата открытия из прогресса', () => {
    const p = evaluateRewards(course, markWatched(createInitialProgress(T0), f1, T0), T0).progress
    const board = achievementBoard(p)
    expect(board.total).toBe(ACHIEVEMENTS.length)
    expect(board.unlocked).toBe(1)
    expect(board.sections.map((s) => s.group)).toEqual(Object.keys(ACHIEVEMENT_GROUPS))
    expect(board.sections.reduce((n, s) => n + s.cards.length, 0)).toBe(ACHIEVEMENTS.length)
    const first = board.sections[0]!.cards.find((c) => c.achievement.id === 'first-viewing')
    expect(first?.unlockedAt).toBe(T0.toISOString())
    expect(board.sections[0]!.unlocked).toBe(1)
    expect(new Set(board.sections.map((s) => s.figure)).size).toBe(board.sections.length)
  })

  it('неизвестная ачивка в прогрессе не ломает счёт', () => {
    const p = { ...createInitialProgress(T0), achievements: [{ id: 'removed-one', unlockedAt: T0.toISOString() }] }
    expect(achievementBoard(p).unlocked).toBe(0)
  })
})
