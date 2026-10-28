import { localDate, toIso } from '../shared/dates'
import type { FilmProgress, GraduationWork, LevelProgress, Settings, UserProgress } from './progress.types'

export const DEFAULT_SETTINGS: Settings = {
  showGamification: true,
  reducedMotion: false,
  textScale: 'normal',
  theme: 'system',
  sequentialMode: false,
  lightMode: false,
  weeklyGoal: false,
}

/** В выпускной работе минимум три формальных решения. */
export const GRADUATION_MIN_DECISIONS = 3

export function createGraduation(): GraduationWork {
  return {
    subject: '',
    filmId: null,
    mainQuestion: '',
    decisions: Array.from({ length: GRADUATION_MIN_DECISIONS }, () => ({ observation: '', effect: '' })),
    connections: '',
    interpretation: '',
    completedAt: null,
    updatedAt: null,
  }
}

export function createFilmProgress(now: Date): FilmProgress {
  return {
    watchStatus: 'not-watched',
    analysisStatus: 'not-started',
    startedAt: null,
    watchedAt: null,
    completedAt: null,
    answers: {},
    exercise: { response: '', checklist: [], completedAt: null, sampleOpenedAt: null },
    isFavorite: false,
    revisitLater: false,
    reviewing: false,
    updatedAt: toIso(now),
  }
}

export function createLevelProgress(): LevelProgress {
  return { completedAt: null, reflection: '', reflectionUpdatedAt: null }
}

export function createInitialProgress(now: Date): UserProgress {
  return {
    createdAt: toIso(now),
    lastActiveDate: localDate(now),
    currentLevelId: null,
    currentFilmId: null,
    films: {},
    levels: {},
    notes: [],
    motifs: [],
    graduation: createGraduation(),
    achievements: [],
    xp: 0,
    xpLedger: [],
    activityDays: [],
    settings: { ...DEFAULT_SETTINGS },
    backup: { lastExportAt: null, lastImportAt: null, reminderSnoozedUntil: null },
  }
}

/** Есть ли в прогрессе хоть какие-то следы учёбы (для главной: «старт» или «продолжение»). */
export function hasAnyProgress(p: UserProgress): boolean {
  return (
    Object.keys(p.films).length > 0 ||
    p.notes.length > 0 ||
    Object.values(p.levels).some((l) => l.completedAt || l.reflection.trim()) ||
    p.graduation.updatedAt !== null
  )
}
