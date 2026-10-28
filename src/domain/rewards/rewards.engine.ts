/**
 * Движок наград. Получает состояние после действия пользователя и
 * дописывает только новые XP-события и ачивки. Идемпотентен: повторный
 * вызов с тем же состоянием возвращает тот же объект.
 */
import type { Course } from '../catalog/catalog.types'
import { toIso } from '../shared/dates'
import type { AchievementUnlock, UserProgress, XpEvent } from '../progress/progress.types'
import {
  ACHIEVEMENT_GROUPS,
  ACHIEVEMENTS,
  buildRewardFacts,
  RANKS,
  revisitedFilmIds,
  XP_EVENT_RULE,
  XP_RULES,
  type AchievementDefinition,
  type AchievementFigure,
  type AchievementGroup,
  type Rank,
  type XpRule,
} from './rewards.config'

export interface EligibleXp {
  id: string
  amount: number
}

/** Все XP-события, которые положены пользователю по текущему состоянию. */
export function eligibleXpEvents(course: Course, p: UserProgress): EligibleXp[] {
  const facts = buildRewardFacts(course, p)
  const out: EligibleXp[] = []
  for (const film of course.films) {
    if (facts.meaningfulFilmIds.has(film.id)) out.push({ id: `first-note:${film.id}`, amount: XP_RULES.firstMeaningfulNote })
    const fp = p.films[film.id]
    if (!fp) continue
    if (fp.watchStatus === 'watched') out.push({ id: `watched:${film.id}`, amount: XP_RULES.filmWatched })
    if (fp.exercise.completedAt) out.push({ id: `exercise:${film.id}`, amount: XP_RULES.exerciseCompleted })
  }
  for (const filmId of revisitedFilmIds(p)) {
    if (course.filmById.has(filmId)) out.push({ id: `revisit:${filmId}`, amount: XP_RULES.revisit })
  }
  for (const level of course.levels) {
    if (p.levels[level.id]?.completedAt) out.push({ id: `level:${level.id}`, amount: XP_RULES.levelCompleted })
  }
  if (p.graduation.completedAt) out.push({ id: 'graduation', amount: XP_RULES.graduationCompleted })
  return out
}

export function sumXp(ledger: readonly XpEvent[]): number {
  return ledger.reduce((sum, e) => sum + e.amount, 0)
}

export interface RewardOutcome {
  progress: UserProgress
  unlocked: AchievementDefinition[]
  gainedXp: number
}

export function evaluateRewards(course: Course, p: UserProgress, now: Date): RewardOutcome {
  const at = toIso(now)
  const known = new Set(p.xpLedger.map((e) => e.id))
  const newEvents: XpEvent[] = eligibleXpEvents(course, p)
    .filter((e) => !known.has(e.id))
    .map((e) => ({ ...e, at }))

  const unlockedIds = new Set(p.achievements.map((a) => a.id))
  const facts = buildRewardFacts(course, p)
  const unlocked = ACHIEVEMENTS.filter((a) => !unlockedIds.has(a.id) && a.check(facts))

  const xpConsistent = p.xp === sumXp(p.xpLedger)
  if (newEvents.length === 0 && unlocked.length === 0 && xpConsistent) {
    return { progress: p, unlocked: [], gainedXp: 0 }
  }
  const xpLedger = newEvents.length ? [...p.xpLedger, ...newEvents] : p.xpLedger
  const achievements: AchievementUnlock[] = unlocked.length
    ? [...p.achievements, ...unlocked.map((a) => ({ id: a.id, unlockedAt: at }))]
    : p.achievements
  return {
    progress: { ...p, xpLedger, xp: sumXp(xpLedger), achievements },
    unlocked,
    gainedXp: sumXp(newEvents),
  }
}

export function rankFor(xp: number): { rank: Rank; next: Rank | null; progressToNext: number } {
  let index = 0
  RANKS.forEach((r, i) => {
    if (xp >= r.minXp) index = i
  })
  const rank = RANKS[index] as Rank
  const next = RANKS[index + 1] ?? null
  const progressToNext = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1
  return { rank, next, progressToNext: Math.max(0, Math.min(1, progressToNext)) }
}

export function achievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

/* ---------------- Для страницы достижений ---------------- */

export type RankState = 'passed' | 'current' | 'ahead'

/** Все ранги по порядку и где среди них пользователь. */
export function rankLadder(xp: number): { rank: Rank; state: RankState }[] {
  const current = rankFor(xp).rank
  const currentIndex = RANKS.indexOf(current)
  return RANKS.map((rank, i) => ({
    rank,
    state: i < currentIndex ? 'passed' : i === currentIndex ? 'current' : 'ahead',
  }))
}

export interface XpBreakdownRow {
  rule: XpRule
  /** Сколько XP даёт одно событие. */
  amount: number
  count: number
  total: number
}

/** Откуда набран опыт: по правилам в порядке XP_RULES, включая ещё не сработавшие. */
export function xpBreakdown(ledger: readonly XpEvent[]): XpBreakdownRow[] {
  const rows = new Map(
    (Object.keys(XP_RULES) as XpRule[]).map((rule) => [rule, { rule, amount: XP_RULES[rule], count: 0, total: 0 }]),
  )
  for (const event of ledger) {
    const rule = XP_EVENT_RULE[event.id.split(':')[0] ?? '']
    const row = rule && rows.get(rule)
    if (!row) continue
    row.count++
    row.total += event.amount
  }
  return [...rows.values()]
}

export interface AchievementCard {
  achievement: AchievementDefinition
  unlockedAt: string | null
}

export interface AchievementSection {
  group: AchievementGroup
  title: string
  shape: string
  figure: AchievementFigure
  cards: AchievementCard[]
  unlocked: number
}

/** Ачивки по группам в порядке конфигурации; дата открытия — из журнала выданных. */
export function achievementBoard(p: UserProgress): { sections: AchievementSection[]; unlocked: number; total: number } {
  const unlockedAt = new Map(p.achievements.map((a) => [a.id, a.unlockedAt]))
  const sections = (Object.keys(ACHIEVEMENT_GROUPS) as AchievementGroup[]).map((group) => {
    const cards = ACHIEVEMENTS.filter((a) => a.group === group).map((achievement) => ({
      achievement,
      unlockedAt: unlockedAt.get(achievement.id) ?? null,
    }))
    return {
      group,
      ...ACHIEVEMENT_GROUPS[group],
      cards,
      unlocked: cards.filter((c) => c.unlockedAt).length,
    }
  })
  return {
    sections,
    unlocked: sections.reduce((n, s) => n + s.unlocked, 0),
    total: ACHIEVEMENTS.length,
  }
}
