/**
 * Адаптер локального хранилища. Единственное место, где код знает про
 * localStorage. Хранилище передаётся параметром, поэтому логику можно
 * тестировать без браузера и заменить на IndexedDB, не трогая остальное.
 */
import type { Course } from '../catalog/catalog.types'
import { toIso } from '../shared/dates'
import { readProgressDocument } from './progress.document'
import type { UserProgress } from './progress.types'
import { CURRENT_SCHEMA_VERSION, PROGRESS_FORMAT } from './progress.types'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const STORAGE_KEY = 'kino-kak-sposob-myshleniya:progress'
const SNAPSHOT_PREFIX = 'kino-kak-sposob-myshleniya:snapshot:'

export type SnapshotLabel = 'before-import' | 'before-reset' | `before-migration-v${number}` | `corrupted-${string}`

/** Возвращает localStorage, если запись в него действительно работает. */
export function resolveBrowserStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const probe = `${STORAGE_KEY}:probe`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; progress: UserProgress; migratedFrom: number | null; warnings: string[] }
  | { kind: 'corrupted'; raw: string; errors: string[] }
  | { kind: 'newer'; raw: string; version: number }
  | { kind: 'unavailable' }

export function loadProgress(storage: KeyValueStorage | null, course: Course): LoadResult {
  if (!storage) return { kind: 'unavailable' }
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { kind: 'unavailable' }
  }
  if (raw === null || raw === '') return { kind: 'empty' }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { kind: 'corrupted', raw, errors: ['Сохранённые данные не являются корректным JSON'] }
  }
  const result = readProgressDocument(data, course)
  if (!result.ok) {
    if (result.error.code === 'newer-version') {
      const version = (data as { schemaVersion?: unknown }).schemaVersion
      return { kind: 'newer', raw, version: typeof version === 'number' ? version : CURRENT_SCHEMA_VERSION + 1 }
    }
    return { kind: 'corrupted', raw, errors: [result.error.message, ...result.error.details] }
  }
  return { kind: 'ok', progress: result.progress, migratedFrom: result.migratedFrom, warnings: result.warnings }
}

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' | 'unknown'; message: string }

export function serializeForStorage(progress: UserProgress, now: Date): string {
  return JSON.stringify({
    format: PROGRESS_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    savedAt: toIso(now),
    appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
    progress,
  })
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
  )
}

export function saveProgress(storage: KeyValueStorage | null, progress: UserProgress, now: Date): SaveResult {
  if (!storage) {
    return { ok: false, reason: 'unavailable', message: 'Браузер не разрешает сохранять данные на этом устройстве.' }
  }
  try {
    storage.setItem(STORAGE_KEY, serializeForStorage(progress, now))
    return { ok: true }
  } catch (e) {
    if (isQuotaError(e)) {
      return {
        ok: false,
        reason: 'quota',
        message: 'Хранилище браузера заполнено. Скачайте резервную копию, чтобы не потерять изменения.',
      }
    }
    return { ok: false, reason: 'unknown', message: 'Не удалось сохранить изменения в браузере.' }
  }
}

/** Сохраняет снимок сырых данных под отдельным ключом. Возвращает ключ или null. */
export function writeSnapshot(storage: KeyValueStorage | null, label: SnapshotLabel, raw: string): string | null {
  if (!storage) return null
  const key = `${SNAPSHOT_PREFIX}${label}`
  try {
    storage.setItem(key, raw)
    return key
  } catch {
    return null
  }
}

export function readSnapshot(storage: KeyValueStorage | null, label: SnapshotLabel): string | null {
  if (!storage) return null
  try {
    return storage.getItem(`${SNAPSHOT_PREFIX}${label}`)
  } catch {
    return null
  }
}

export function removeSnapshot(storage: KeyValueStorage | null, label: SnapshotLabel): void {
  try {
    storage?.removeItem(`${SNAPSHOT_PREFIX}${label}`)
  } catch {
    /* снимок не критичен */
  }
}

export function readRaw(storage: KeyValueStorage | null): string | null {
  try {
    return storage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

/** Хранилище в памяти — для тестов и как запасной вариант. */
export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  }
}
