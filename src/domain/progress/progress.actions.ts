/**
 * Доменные действия над прогрессом. Все функции чистые: принимают текущее
 * состояние и время, возвращают новое состояние (или то же самое, если
 * действие невозможно). Награды здесь не начисляются — этим занимается
 * rewards.engine после применения действия.
 */
import type { Level } from '../catalog/catalog.types'
import { localDate, toIso } from '../shared/dates'
import { createId } from '../shared/ids'
import { isMeaningful, normalizeText } from '../shared/text'
import { createFilmProgress, createLevelProgress, GRADUATION_MIN_DECISIONS } from './progress.defaults'
import { canCompleteFilm, graduationCriteria, levelStats } from './progress.selectors'
import type {
  AnswerKey,
  FilmProgress,
  GraduationDecision,
  GraduationWork,
  MotifLink,
  Note,
  NoteKind,
  Settings,
  UserProgress,
} from './progress.types'

/** Отмечает учебную активность сегодняшнего дня. */
function touch(p: UserProgress, now: Date): UserProgress {
  const day = localDate(now)
  const activityDays = p.activityDays.includes(day) ? p.activityDays : [...p.activityDays, day].sort()
  return { ...p, lastActiveDate: day, activityDays }
}

function updateFilm(
  p: UserProgress,
  filmId: string,
  now: Date,
  change: (fp: FilmProgress) => FilmProgress | null,
): UserProgress {
  const prev = p.films[filmId] ?? createFilmProgress(now)
  const next = change(prev)
  if (!next) return p
  return touch({ ...p, films: { ...p.films, [filmId]: { ...next, updatedAt: toIso(now) } } }, now)
}

/** Анализ начат, если не завершён и есть хоть один непустой ответ. */
function analysisAfterEdit(fp: FilmProgress): FilmProgress['analysisStatus'] {
  return fp.analysisStatus === 'completed' ? 'completed' : 'in-progress'
}

/* ---------------- Навигация ---------------- */

export function openFilm(p: UserProgress, filmId: string, levelId: string): UserProgress {
  if (p.currentFilmId === filmId && p.currentLevelId === levelId) return p
  return { ...p, currentFilmId: filmId, currentLevelId: levelId }
}

/* ---------------- Просмотр ---------------- */

export function startWatching(p: UserProgress, filmId: string, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) =>
    fp.watchStatus !== 'not-watched' ? null : { ...fp, watchStatus: 'started', startedAt: fp.startedAt ?? toIso(now) },
  )
}

export function markWatched(p: UserProgress, filmId: string, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) =>
    fp.watchStatus === 'watched'
      ? null
      : {
          ...fp,
          watchStatus: 'watched',
          watchedAt: fp.watchedAt ?? toIso(now),
          startedAt: fp.startedAt ?? toIso(now),
        },
  )
}

/** Отменить ошибочную отметку просмотра. Завершённый фильм не понижается. */
export function unmarkWatched(p: UserProgress, filmId: string, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) =>
    fp.watchStatus !== 'watched' || fp.completedAt
      ? null
      : { ...fp, watchStatus: fp.startedAt ? 'started' : 'not-watched', watchedAt: null },
  )
}

/* ---------------- Ответы и упражнение ---------------- */

export function setAnswer(p: UserProgress, filmId: string, key: AnswerKey, text: string, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) => {
    if ((fp.answers[key] ?? '') === text) return null
    return {
      ...fp,
      answers: { ...fp.answers, [key]: text },
      analysisStatus: analysisAfterEdit(fp),
      startedAt: fp.startedAt ?? toIso(now),
    }
  })
}

export function setExerciseResponse(p: UserProgress, filmId: string, text: string, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) =>
    fp.exercise.response === text
      ? null
      : {
          ...fp,
          exercise: { ...fp.exercise, response: text },
          analysisStatus: analysisAfterEdit(fp),
          startedAt: fp.startedAt ?? toIso(now),
        },
  )
}

export function toggleChecklistItem(p: UserProgress, filmId: string, index: number, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) => {
    const has = fp.exercise.checklist.includes(index)
    const checklist = has
      ? fp.exercise.checklist.filter((i) => i !== index)
      : [...fp.exercise.checklist, index].sort((a, b) => a - b)
    return { ...fp, exercise: { ...fp.exercise, checklist } }
  })
}

/** Упражнение можно отметить выполненным, только если есть осмысленный ответ. */
export function canCompleteExercise(fp: FilmProgress | undefined): boolean {
  return isMeaningful(fp?.exercise.response)
}

export function completeExercise(p: UserProgress, filmId: string, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) =>
    fp.exercise.completedAt || !canCompleteExercise(fp)
      ? null
      : {
          ...fp,
          exercise: { ...fp.exercise, completedAt: toIso(now) },
          analysisStatus: analysisAfterEdit(fp),
        },
  )
}

export function markSampleOpened(p: UserProgress, filmId: string, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) =>
    fp.exercise.sampleOpenedAt ? null : { ...fp, exercise: { ...fp.exercise, sampleOpenedAt: toIso(now) } },
  )
}

/* ---------------- Завершение фильма ---------------- */

export function completeFilm(p: UserProgress, filmId: string, now: Date): UserProgress {
  if (p.films[filmId]?.completedAt || !canCompleteFilm(p, filmId)) return p
  return updateFilm(p, filmId, now, (fp) => ({
    ...fp,
    completedAt: toIso(now),
    analysisStatus: 'completed',
    reviewing: false,
  }))
}

/** «Разбираю повторно» — доступно только для пройденного фильма и не снимает завершение. */
export function setReviewing(p: UserProgress, filmId: string, reviewing: boolean, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) =>
    !fp.completedAt || fp.reviewing === reviewing ? null : { ...fp, reviewing },
  )
}

export function setFavorite(p: UserProgress, filmId: string, value: boolean, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) => (fp.isFavorite === value ? null : { ...fp, isFavorite: value }))
}

export function setRevisitLater(p: UserProgress, filmId: string, value: boolean, now: Date): UserProgress {
  return updateFilm(p, filmId, now, (fp) => (fp.revisitLater === value ? null : { ...fp, revisitLater: value }))
}

/* ---------------- Заметки ---------------- */

export interface NewNote {
  text: string
  kind: NoteKind
  filmId: string | null
  tags?: string[]
}

export function addNote(p: UserProgress, input: NewNote, now: Date, id = createId('note')): UserProgress {
  if (normalizeText(input.text) === '') return p
  const iso = toIso(now)
  const note: Note = {
    id,
    text: input.text,
    kind: input.kind,
    filmId: input.filmId,
    createdAt: iso,
    updatedAt: iso,
    tags: input.tags ?? [],
  }
  let next: UserProgress = touch({ ...p, notes: [...p.notes, note] }, now)
  if (input.filmId) {
    next = updateFilm(next, input.filmId, now, (fp) => ({
      ...fp,
      analysisStatus: analysisAfterEdit(fp),
      startedAt: fp.startedAt ?? iso,
    }))
  }
  return next
}

export function updateNote(
  p: UserProgress,
  id: string,
  patch: Partial<Pick<Note, 'text' | 'kind' | 'filmId' | 'tags'>>,
  now: Date,
): UserProgress {
  const index = p.notes.findIndex((n) => n.id === id)
  const current = p.notes[index]
  if (!current) return p
  const updated: Note = { ...current, ...patch, updatedAt: toIso(now) }
  if (
    updated.text === current.text &&
    updated.kind === current.kind &&
    updated.filmId === current.filmId &&
    updated.tags.join('|') === current.tags.join('|')
  ) {
    return p
  }
  const notes = [...p.notes]
  notes[index] = updated
  return touch({ ...p, notes }, now)
}

export function deleteNote(p: UserProgress, id: string, now: Date): UserProgress {
  if (!p.notes.some((n) => n.id === id)) return p
  return touch({ ...p, notes: p.notes.filter((n) => n.id !== id) }, now)
}

/* ---------------- Уровни ---------------- */

export function setLevelReflection(p: UserProgress, levelId: string, text: string, now: Date): UserProgress {
  const prev = p.levels[levelId] ?? createLevelProgress()
  if (prev.reflection === text) return p
  return touch(
    { ...p, levels: { ...p.levels, [levelId]: { ...prev, reflection: text, reflectionUpdatedAt: toIso(now) } } },
    now,
  )
}

export function completeLevel(p: UserProgress, level: Level, now: Date): UserProgress {
  const prev = p.levels[level.id] ?? createLevelProgress()
  if (prev.completedAt || !levelStats(level, p).canComplete) return p
  return touch({ ...p, levels: { ...p.levels, [level.id]: { ...prev, completedAt: toIso(now) } } }, now)
}

/* ---------------- Мотивы ---------------- */

export function addMotif(
  p: UserProgress,
  input: Pick<MotifLink, 'title' | 'description' | 'filmIds'>,
  now: Date,
  id = createId('motif'),
): UserProgress {
  if (normalizeText(input.title) === '') return p
  const iso = toIso(now)
  const motif: MotifLink = { id, ...input, filmIds: [...new Set(input.filmIds)], createdAt: iso, updatedAt: iso }
  return touch({ ...p, motifs: [...p.motifs, motif] }, now)
}

export function updateMotif(
  p: UserProgress,
  id: string,
  patch: Partial<Pick<MotifLink, 'title' | 'description' | 'filmIds'>>,
  now: Date,
): UserProgress {
  const exists = p.motifs.some((m) => m.id === id)
  if (!exists) return p
  const motifs = p.motifs.map((m) =>
    m.id === id ? { ...m, ...patch, filmIds: [...new Set(patch.filmIds ?? m.filmIds)], updatedAt: toIso(now) } : m,
  )
  return touch({ ...p, motifs }, now)
}

export function deleteMotif(p: UserProgress, id: string, now: Date): UserProgress {
  if (!p.motifs.some((m) => m.id === id)) return p
  return touch({ ...p, motifs: p.motifs.filter((m) => m.id !== id) }, now)
}

/* ---------------- Выпускная работа ---------------- */

export function updateGraduation(
  p: UserProgress,
  patch: Partial<Pick<GraduationWork, 'subject' | 'filmId' | 'mainQuestion' | 'connections' | 'interpretation'>>,
  now: Date,
): UserProgress {
  const g = p.graduation
  const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => patch[k] !== g[k])
  if (!changed) return p
  return touch({ ...p, graduation: { ...g, ...patch, updatedAt: toIso(now) } }, now)
}

export function setGraduationDecision(
  p: UserProgress,
  index: number,
  patch: Partial<GraduationDecision>,
  now: Date,
): UserProgress {
  const current = p.graduation.decisions[index]
  if (!current) return p
  const decisions = [...p.graduation.decisions]
  decisions[index] = { ...current, ...patch }
  return touch({ ...p, graduation: { ...p.graduation, decisions, updatedAt: toIso(now) } }, now)
}

export function addGraduationDecision(p: UserProgress, now: Date): UserProgress {
  const decisions = [...p.graduation.decisions, { observation: '', effect: '' }]
  return touch({ ...p, graduation: { ...p.graduation, decisions, updatedAt: toIso(now) } }, now)
}

export function removeGraduationDecision(p: UserProgress, index: number, now: Date): UserProgress {
  if (p.graduation.decisions.length <= GRADUATION_MIN_DECISIONS || !p.graduation.decisions[index]) return p
  const decisions = p.graduation.decisions.filter((_, i) => i !== index)
  return touch({ ...p, graduation: { ...p.graduation, decisions, updatedAt: toIso(now) } }, now)
}

export function completeGraduation(p: UserProgress, now: Date): UserProgress {
  if (p.graduation.completedAt || !graduationCriteria(p).every((c) => c.met)) return p
  return touch({ ...p, graduation: { ...p.graduation, completedAt: toIso(now), updatedAt: toIso(now) } }, now)
}

/* ---------------- Настройки и резервные копии ---------------- */

export function updateSettings(p: UserProgress, patch: Partial<Settings>): UserProgress {
  const changed = (Object.keys(patch) as (keyof Settings)[]).some((k) => patch[k] !== p.settings[k])
  return changed ? { ...p, settings: { ...p.settings, ...patch } } : p
}

export function markExported(p: UserProgress, now: Date): UserProgress {
  return { ...p, backup: { ...p.backup, lastExportAt: toIso(now), reminderSnoozedUntil: null } }
}

export function markImported(p: UserProgress, now: Date): UserProgress {
  return { ...p, backup: { ...p.backup, lastImportAt: toIso(now) } }
}

export function snoozeBackupReminder(p: UserProgress, untilDay: string): UserProgress {
  return { ...p, backup: { ...p.backup, reminderSnoozedUntil: untilDay } }
}
