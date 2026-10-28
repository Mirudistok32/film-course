import { localDate, toIso } from '../shared/dates'
import type { ProgressFile, UserProgress } from './progress.types'
import { CURRENT_SCHEMA_VERSION, PROGRESS_FORMAT } from './progress.types'

export function appVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
}

export function createProgressFile(progress: UserProgress, now: Date): ProgressFile {
  return {
    format: PROGRESS_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: toIso(now),
    appVersion: appVersion(),
    progress,
  }
}

/** Читаемый человеком JSON с отступами. */
export function serializeProgressFile(file: ProgressFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

export function exportFileName(now: Date, suffix = ''): string {
  return `${PROGRESS_FORMAT}${suffix ? `-${suffix}` : ''}-${localDate(now)}.json`
}

/** Скачивает текст как файл. Возвращает false, если браузер не дал это сделать. */
export function downloadTextFile(name: string, text: string, mime = 'application/json'): boolean {
  try {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}
