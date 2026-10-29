/**
 * Миграции между версиями схемы сохранения.
 *
 * Каждая миграция `up` получает сырые данные версии N и возвращает данные
 * версии N+1, не бросая исключений на неожиданных типах (их потом поймает
 * валидатор). `finalize` вызывается после успешной проверки — для шагов,
 * которым нужен уже типизированный прогресс и каталог.
 */
import type { Course } from '../catalog/catalog.types'
import { eligibleXpEvents, sumXp } from '../rewards/rewards.engine'
import { createGraduation } from './progress.defaults'
import type { UserProgress } from './progress.types'
import { CURRENT_SCHEMA_VERSION } from './progress.types'

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

export interface MigrationContext {
  /** Дата экспорта/сохранения исходного файла — используется как дата событий. */
  sourceDate: string
  course: Course
}

interface Migration {
  up: (progress: Raw, ctx: MigrationContext) => Raw
  finalize?: (progress: UserProgress, original: Raw, ctx: MigrationContext) => UserProgress
}

export const LEGACY_V1_XP_EVENT = 'legacy:v1-balance'

/**
 * v1 (пример из ТЗ) → v2:
 * - заметки из films[id].notes переезжают в общий массив notes с filmId;
 * - exerciseCompleted → exercise.completedAt;
 * - levels[id] получают поля рефлексии;
 * - xp превращается в журнал событий: события выводятся из состояния,
 *   а разница с исходным xp сохраняется отдельным событием, чтобы XP не уменьшился.
 */
const v1ToV2: Migration = {
  up(p, ctx) {
    const notes: unknown[] = []
    const films: Raw = {}
    const rawFilms = p.films
    if (isObj(rawFilms)) {
      for (const [filmId, value] of Object.entries(rawFilms)) {
        if (!isObj(value)) {
          films[filmId] = value
          continue
        }
        const { notes: filmNotes, exerciseCompleted, ...rest } = value
        if (Array.isArray(filmNotes)) {
          for (const n of filmNotes) {
            notes.push(isObj(n) ? { kind: 'free', tags: [], ...n, filmId } : n)
          }
        }
        const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : ctx.sourceDate
        films[filmId] = {
          startedAt: null,
          revisitLater: false,
          reviewing: false,
          ...rest,
          exercise: {
            response: '',
            checklist: [],
            completedAt: exerciseCompleted === true ? updatedAt : null,
            sampleOpenedAt: null,
          },
        }
      }
    }
    const levels: Raw = {}
    if (isObj(p.levels)) {
      for (const [levelId, value] of Object.entries(p.levels)) {
        levels[levelId] = isObj(value) ? { reflection: '', reflectionUpdatedAt: null, ...value } : value
      }
    }
    const lastActive = typeof p.lastActiveDate === 'string' ? p.lastActiveDate : null
    return {
      ...p,
      films: isObj(rawFilms) ? films : p.films,
      levels: isObj(p.levels) ? levels : (p.levels ?? {}),
      notes,
      motifs: [],
      graduation: createGraduation(),
      // XP пересчитывается в finalize из исходного значения; здесь — сумма пустого журнала.
      xp: 0,
      xpLedger: [],
      activityDays: lastActive ? [lastActive] : [],
      backup: { lastExportAt: null, lastImportAt: null, reminderSnoozedUntil: null },
    }
  },
  finalize(progress, original, ctx) {
    const legacyXp =
      typeof original.xp === 'number' && Number.isFinite(original.xp) ? Math.max(0, Math.round(original.xp)) : 0
    const ledger = eligibleXpEvents(ctx.course, progress).map((e) => ({ ...e, at: ctx.sourceDate }))
    const derived = sumXp(ledger)
    if (legacyXp > derived) ledger.push({ id: LEGACY_V1_XP_EVENT, amount: legacyXp - derived, at: ctx.sourceDate })
    return { ...progress, xpLedger: ledger, xp: sumXp(ledger) }
  },
}

export const MIGRATIONS: Record<number, Migration> = {
  1: v1ToV2,
}

export const OLDEST_SUPPORTED_VERSION = 1

export interface MigrationPlan {
  migrated: Raw
  /** Версии, из которых выполнены переходы (например [1] для v1 → v2). */
  applied: number[]
  finalize: (p: UserProgress) => UserProgress
}

export function migrateProgress(progress: Raw, fromVersion: number, ctx: MigrationContext): MigrationPlan {
  let current = progress
  const applied: number[] = []
  const finalizers: Array<(p: UserProgress) => UserProgress> = []
  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const migration = MIGRATIONS[v]
    if (!migration) throw new Error(`Нет миграции со схемы ${v}`)
    const before = current
    current = migration.up(current, ctx)
    applied.push(v)
    if (migration.finalize) {
      const fin = migration.finalize
      finalizers.push((p) => fin(p, before, ctx))
    }
  }
  return {
    migrated: current,
    applied,
    finalize: (p) => finalizers.reduce((acc, fn) => fn(acc), p),
  }
}
