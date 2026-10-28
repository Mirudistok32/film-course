/**
 * Чтение «документа прогресса» — общий путь для локального хранилища
 * и импортируемых файлов: проверка формата и версии → миграция →
 * валидация → финальные шаги миграции. Ничего не записывает.
 */
import type { Course } from '../catalog/catalog.types'
import { isIsoDateTime } from '../shared/dates'
import { ACHIEVEMENTS } from '../rewards/rewards.config'
import { migrateProgress, OLDEST_SUPPORTED_VERSION } from './progress.migrations'
import type { UserProgress } from './progress.types'
import { CURRENT_SCHEMA_VERSION, PROGRESS_FORMAT } from './progress.types'
import { validateProgress } from './progress.validate'

export type DocumentErrorCode =
  | 'not-json'
  | 'not-object'
  | 'wrong-format'
  | 'missing-version'
  | 'newer-version'
  | 'unsupported-version'
  | 'invalid-data'
  | 'too-large'
  | 'empty'
  | 'read-failed'

export interface DocumentError {
  code: DocumentErrorCode
  message: string
  details: string[]
}

export interface DocumentInfo {
  schemaVersion: number
  exportedAt: string | null
  appVersion: string | null
}

export type ReadDocumentResult =
  | {
      ok: true
      progress: UserProgress
      info: DocumentInfo
      /** Версия, из которой выполнена миграция, или null. */
      migratedFrom: number | null
      warnings: string[]
    }
  | { ok: false; error: DocumentError }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function documentError(code: DocumentErrorCode, details: string[] = []): DocumentError {
  const messages: Record<DocumentErrorCode, string> = {
    'not-json': 'Файл не является корректным JSON. Возможно, он повреждён или это другой тип файла.',
    'not-object': 'В файле нет объекта с данными прогресса.',
    'wrong-format': 'Это не резервная копия курса «Кино как способ мышления».',
    'missing-version': 'В файле не указана версия формата (schemaVersion).',
    'newer-version':
      'Файл создан более новой версией сайта. Эта версия не умеет его читать — обновите страницу или сайт. Текущие данные не изменены.',
    'unsupported-version': 'Версия формата файла не поддерживается.',
    'invalid-data': 'Данные в файле повреждены или заполнены неверно. Текущий прогресс не изменён.',
    'too-large': 'Файл слишком большой для резервной копии курса.',
    empty: 'Файл пуст — в нём нет данных.',
    'read-failed': 'Не удалось прочитать файл.',
  }
  return { code, message: messages[code], details }
}

export function validationContext(course: Course) {
  return {
    knownFilmIds: new Set(course.films.map((f) => f.id)),
    knownLevelIds: new Set(course.levels.map((l) => l.id)),
    knownAchievementIds: new Set(ACHIEVEMENTS.map((a) => a.id)),
  }
}

export function readProgressDocument(data: unknown, course: Course): ReadDocumentResult {
  if (!isObj(data)) return { ok: false, error: documentError('not-object') }
  if (data.format !== PROGRESS_FORMAT) {
    return {
      ok: false,
      error: documentError('wrong-format', [`format: ожидалось «${PROGRESS_FORMAT}», в файле ${JSON.stringify(data.format ?? null)}`]),
    }
  }
  const version = data.schemaVersion
  if (version === undefined) return { ok: false, error: documentError('missing-version') }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: documentError('unsupported-version', [`schemaVersion: ${JSON.stringify(version)}`]) }
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: documentError('newer-version', [`Версия файла: ${version}, поддерживается до ${CURRENT_SCHEMA_VERSION}`]),
    }
  }
  if (version < OLDEST_SUPPORTED_VERSION) {
    return { ok: false, error: documentError('unsupported-version', [`schemaVersion: ${version}`]) }
  }
  if (!isObj(data.progress)) {
    return { ok: false, error: documentError('invalid-data', ['progress: ожидается объект']) }
  }

  const exportedAt = isIsoDateTime(data.exportedAt) ? data.exportedAt : null
  const savedAt = isIsoDateTime(data.savedAt) ? data.savedAt : null
  const sourceDate = exportedAt ?? savedAt ?? new Date().toISOString()

  let migrated: Record<string, unknown> = data.progress
  let finalize = (p: UserProgress) => p
  let migratedFrom: number | null = null
  if (version < CURRENT_SCHEMA_VERSION) {
    try {
      const plan = migrateProgress(data.progress, version, { sourceDate, course })
      migrated = plan.migrated
      finalize = plan.finalize
      migratedFrom = version
    } catch (e) {
      return { ok: false, error: documentError('unsupported-version', [String(e)]) }
    }
  }

  const result = validateProgress(migrated, validationContext(course))
  if (!result.ok) return { ok: false, error: documentError('invalid-data', result.errors) }

  return {
    ok: true,
    progress: finalize(result.progress),
    info: {
      schemaVersion: version,
      exportedAt: exportedAt ?? savedAt,
      appVersion: typeof data.appVersion === 'string' ? data.appVersion : null,
    },
    migratedFrom,
    warnings: result.warnings,
  }
}
