/**
 * Импорт резервной копии: чтение файла, проверка и краткое резюме.
 * Применение (замена или объединение) выполняет стор после подтверждения
 * пользователя — здесь состояние не меняется.
 */
import type { Course } from '../catalog/catalog.types'
import { isMeaningful } from '../shared/text'
import { documentError, readProgressDocument, type DocumentError, type DocumentInfo } from './progress.document'
import type { UserProgress } from './progress.types'
import { ANSWER_KEYS } from './progress.types'

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export interface ProgressSummary {
  filmsWithProgress: number
  filmsWatched: number
  filmsCompleted: number
  levelsCompleted: number
  notes: number
  answers: number
  achievements: number
  xp: number
  /** Фильмы и заметки, которых нет в текущем каталоге. */
  unknownFilmIds: string[]
}

export type ImportParseResult =
  | {
      ok: true
      progress: UserProgress
      info: DocumentInfo
      summary: ProgressSummary
      migratedFrom: number | null
      warnings: string[]
    }
  | { ok: false; error: DocumentError }

export function summarizeProgress(p: UserProgress, course: Course): ProgressSummary {
  const films = Object.entries(p.films)
  const unknown = new Set<string>()
  for (const [id] of films) if (!course.filmById.has(id)) unknown.add(id)
  for (const n of p.notes) if (n.filmId && !course.filmById.has(n.filmId)) unknown.add(n.filmId)
  return {
    filmsWithProgress: films.length,
    filmsWatched: films.filter(([, f]) => f.watchStatus === 'watched').length,
    filmsCompleted: films.filter(([, f]) => f.completedAt).length,
    levelsCompleted: Object.values(p.levels).filter((l) => l.completedAt).length,
    notes: p.notes.length,
    answers: films.reduce((sum, [, f]) => sum + ANSWER_KEYS.filter((k) => isMeaningful(f.answers[k], 1)).length, 0),
    achievements: p.achievements.length,
    xp: p.xp,
    unknownFilmIds: [...unknown],
  }
}

export function parseImportText(text: string, course: Course): ImportParseResult {
  if (text.trim() === '') return { ok: false, error: documentError('empty') }
  if (new Blob([text]).size > MAX_IMPORT_BYTES) return { ok: false, error: documentError('too-large') }
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^﻿/, ''))
  } catch (e) {
    return { ok: false, error: documentError('not-json', [e instanceof Error ? e.message : String(e)]) }
  }
  const result = readProgressDocument(data, course)
  if (!result.ok) return result
  return {
    ok: true,
    progress: result.progress,
    info: result.info,
    summary: summarizeProgress(result.progress, course),
    migratedFrom: result.migratedFrom,
    warnings: result.warnings,
  }
}

export async function parseImportFile(file: File, course: Course): Promise<ImportParseResult> {
  if (file.size === 0) return { ok: false, error: documentError('empty') }
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: documentError('too-large', [`Размер: ${(file.size / 1024 / 1024).toFixed(1)} МБ, максимум 5 МБ`]),
    }
  }
  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, error: documentError('read-failed') }
  }
  return parseImportText(text, course)
}
