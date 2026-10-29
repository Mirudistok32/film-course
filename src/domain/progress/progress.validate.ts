/**
 * Проверка и нормализация прогресса текущей версии схемы.
 *
 * Правила:
 * - неверный тип обязательного поля или недопустимый статус — ошибка, файл не принимается;
 * - отсутствующее необязательное поле заполняется значением по умолчанию;
 * - неизвестные поля игнорируются;
 * - ссылки на фильмы, которых нет в каталоге, сохраняются (каталог мог измениться),
 *   но о них сообщается предупреждением.
 */
import { isIsoDateTime, isLocalDate } from '../shared/dates'
import { createGraduation, createInitialProgress, DEFAULT_SETTINGS } from './progress.defaults'
import type {
  AchievementUnlock,
  AnalysisStatus,
  Answers,
  FilmProgress,
  GraduationWork,
  LevelProgress,
  MotifLink,
  Note,
  NoteKind,
  Settings,
  UserProgress,
  WatchStatus,
  XpEvent,
} from './progress.types'
import { ANSWER_KEYS, NOTE_KINDS } from './progress.types'

export const LIMITS = {
  maxTextLength: 50_000,
  maxNotes: 10_000,
  maxFilms: 2_000,
  maxLedger: 20_000,
  maxMotifs: 1_000,
  maxTags: 20,
  maxXpPerEvent: 1_000,
} as const

const WATCH: WatchStatus[] = ['not-watched', 'started', 'watched']
const ANALYSIS: AnalysisStatus[] = ['not-started', 'in-progress', 'completed']

export interface ValidationContext {
  knownFilmIds?: ReadonlySet<string>
  knownLevelIds?: ReadonlySet<string>
  knownAchievementIds?: ReadonlySet<string>
}

export type ValidationResult =
  { ok: true; progress: UserProgress; warnings: string[] } | { ok: false; errors: string[]; warnings: string[] }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

class Checker {
  errors: string[] = []
  warnings: string[] = []

  error(path: string, message: string) {
    if (this.errors.length < 50) this.errors.push(`${path}: ${message}`)
  }

  /**
   * Предупреждение показывается человеку в баннере и при импорте, поэтому
   * пишется без технических путей. Одинаковые сообщения не повторяются.
   */
  warn(message: string) {
    if (this.warnings.length < 50 && !this.warnings.includes(message)) this.warnings.push(message)
  }

  text(obj: Obj, key: string, path: string, fallback = ''): string {
    const v = obj[key]
    if (v === undefined || v === null) return fallback
    if (typeof v !== 'string') {
      this.error(`${path}.${key}`, 'ожидается строка')
      return fallback
    }
    if (v.length > LIMITS.maxTextLength) {
      this.error(`${path}.${key}`, `текст длиннее ${LIMITS.maxTextLength} символов`)
      return fallback
    }
    return v
  }

  isoOrNull(obj: Obj, key: string, path: string): string | null {
    const v = obj[key]
    if (v === undefined || v === null) return null
    if (!isIsoDateTime(v)) {
      this.error(`${path}.${key}`, 'ожидается дата в формате ISO 8601 или null')
      return null
    }
    return v
  }

  iso(obj: Obj, key: string, path: string, fallback?: string): string {
    const v = obj[key]
    if (v === undefined && fallback !== undefined) return fallback
    if (!isIsoDateTime(v)) {
      this.error(`${path}.${key}`, 'ожидается дата в формате ISO 8601')
      return fallback ?? new Date(0).toISOString()
    }
    return v
  }

  bool(obj: Obj, key: string, path: string, fallback: boolean): boolean {
    const v = obj[key]
    if (v === undefined) return fallback
    if (typeof v !== 'boolean') {
      this.error(`${path}.${key}`, 'ожидается true или false')
      return fallback
    }
    return v
  }

  oneOf<T extends string>(obj: Obj, key: string, path: string, allowed: readonly T[], fallback?: T): T {
    const v = obj[key]
    if (v === undefined && fallback !== undefined) return fallback
    if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
      this.error(`${path}.${key}`, `недопустимое значение ${JSON.stringify(v)}; допустимо: ${allowed.join(', ')}`)
      return fallback ?? (allowed[0] as T)
    }
    return v as T
  }

  array(obj: Obj, key: string, path: string, required: boolean, max: number): unknown[] {
    const v = obj[key]
    if (v === undefined && !required) return []
    if (!Array.isArray(v)) {
      this.error(`${path}.${key}`, 'ожидается массив')
      return []
    }
    if (v.length > max) {
      this.error(`${path}.${key}`, `слишком много элементов (${v.length} > ${max})`)
      return []
    }
    return v
  }

  record(obj: Obj, key: string, path: string, required: boolean): Obj {
    const v = obj[key]
    if (v === undefined && !required) return {}
    if (!isObj(v)) {
      this.error(`${path}.${key}`, 'ожидается объект')
      return {}
    }
    return v
  }
}

function readAnswers(c: Checker, raw: unknown, path: string): Answers {
  if (raw === undefined) return {}
  if (!isObj(raw)) {
    c.error(path, 'ожидается объект с ответами')
    return {}
  }
  const answers: Answers = {}
  for (const key of ANSWER_KEYS) {
    const value = c.text(raw, key, path, '')
    if (value !== '') answers[key] = value
  }
  return answers
}

function readFilm(c: Checker, raw: unknown, path: string, fallbackDate: string): FilmProgress | null {
  if (!isObj(raw)) {
    c.error(path, 'ожидается объект')
    return null
  }
  const exRaw = raw.exercise === undefined ? {} : raw.exercise
  if (!isObj(exRaw)) c.error(`${path}.exercise`, 'ожидается объект')
  const ex = isObj(exRaw) ? exRaw : {}
  const checklist = c
    .array(ex, 'checklist', `${path}.exercise`, false, 100)
    .filter((i): i is number => Number.isInteger(i) && (i as number) >= 0)
  const completedAt = c.isoOrNull(raw, 'completedAt', path)
  return {
    watchStatus: c.oneOf(raw, 'watchStatus', path, WATCH),
    analysisStatus: c.oneOf(raw, 'analysisStatus', path, ANALYSIS),
    startedAt: c.isoOrNull(raw, 'startedAt', path),
    watchedAt: c.isoOrNull(raw, 'watchedAt', path),
    completedAt,
    answers: readAnswers(c, raw.answers, `${path}.answers`),
    exercise: {
      response: c.text(ex, 'response', `${path}.exercise`),
      checklist: [...new Set(checklist)].sort((a, b) => a - b),
      completedAt: c.isoOrNull(ex, 'completedAt', `${path}.exercise`),
      sampleOpenedAt: c.isoOrNull(ex, 'sampleOpenedAt', `${path}.exercise`),
    },
    isFavorite: c.bool(raw, 'isFavorite', path, false),
    revisitLater: c.bool(raw, 'revisitLater', path, false),
    reviewing: Boolean(completedAt) && c.bool(raw, 'reviewing', path, false),
    updatedAt: c.iso(raw, 'updatedAt', path, fallbackDate),
  }
}

function readNotes(c: Checker, list: unknown[], ctx: ValidationContext): Note[] {
  const seen = new Set<string>()
  const notes: Note[] = []
  list.forEach((raw, i) => {
    const path = `progress.notes[${i}]`
    if (!isObj(raw)) return c.error(path, 'ожидается объект')
    const id = c.text(raw, 'id', path)
    if (!id) return c.error(`${path}.id`, 'нужен непустой идентификатор')
    if (seen.has(id)) return c.warn('Две заметки записаны под одним номером — оставлена первая.')
    seen.add(id)
    let kind: NoteKind = 'free'
    if (raw.kind !== undefined) {
      if (typeof raw.kind === 'string' && (NOTE_KINDS as readonly string[]).includes(raw.kind))
        kind = raw.kind as NoteKind
      else c.warn('У заметки незнакомый тип — она сохранена как свободная.')
    }
    const filmIdRaw = raw.filmId
    let filmId: string | null = null
    if (typeof filmIdRaw === 'string' && filmIdRaw) {
      filmId = filmIdRaw
      if (ctx.knownFilmIds && !ctx.knownFilmIds.has(filmId)) {
        c.warn(`Заметка относится к фильму «${filmId}», которого нет в курсе, — она сохранена.`)
      }
    } else if (filmIdRaw !== undefined && filmIdRaw !== null) {
      c.error(`${path}.filmId`, 'ожидается строка или null')
    }
    const tags = c
      .array(raw, 'tags', path, false, LIMITS.maxTags)
      .filter((t): t is string => typeof t === 'string' && t.length <= 100)
    const createdAt = c.iso(raw, 'createdAt', path)
    notes.push({
      id,
      text: c.text(raw, 'text', path),
      kind,
      filmId,
      createdAt,
      updatedAt: c.iso(raw, 'updatedAt', path, createdAt),
      tags,
    })
  })
  return notes
}

function readUnlocks(c: Checker, list: unknown[], ctx: ValidationContext): AchievementUnlock[] {
  const byId = new Map<string, AchievementUnlock>()
  list.forEach((raw, i) => {
    const path = `progress.achievements[${i}]`
    if (!isObj(raw)) return c.error(path, 'ожидается объект')
    const id = c.text(raw, 'id', path)
    if (!id) return c.error(`${path}.id`, 'нужен идентификатор')
    const unlockedAt = c.iso(raw, 'unlockedAt', path)
    if (ctx.knownAchievementIds && !ctx.knownAchievementIds.has(id)) {
      c.warn(`Достижение «${id}» незнакомо этой версии сайта — оно сохранено, но не показывается.`)
    }
    const prev = byId.get(id)
    if (!prev || Date.parse(unlockedAt) < Date.parse(prev.unlockedAt)) byId.set(id, { id, unlockedAt })
  })
  return [...byId.values()]
}

function readLedger(c: Checker, list: unknown[]): XpEvent[] {
  const byId = new Map<string, XpEvent>()
  list.forEach((raw, i) => {
    const path = `progress.xpLedger[${i}]`
    if (!isObj(raw)) return c.error(path, 'ожидается объект')
    const id = c.text(raw, 'id', path)
    if (!id) return c.error(`${path}.id`, 'нужен идентификатор события')
    const amount = raw.amount
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > LIMITS.maxXpPerEvent) {
      return c.error(`${path}.amount`, `ожидается целое число от 0 до ${LIMITS.maxXpPerEvent}`)
    }
    const at = c.iso(raw, 'at', path)
    const prev = byId.get(id)
    if (prev) c.warn('Одно и то же начисление опыта записано дважды — учтено один раз.')
    if (!prev || Date.parse(at) < Date.parse(prev.at)) byId.set(id, { id, amount, at })
  })
  return [...byId.values()]
}

function readLevels(c: Checker, raw: Obj, ctx: ValidationContext): Record<string, LevelProgress> {
  const levels: Record<string, LevelProgress> = {}
  for (const [id, value] of Object.entries(raw)) {
    const path = `progress.levels["${id}"]`
    if (!isObj(value)) {
      c.error(path, 'ожидается объект')
      continue
    }
    if (ctx.knownLevelIds && !ctx.knownLevelIds.has(id)) c.warn(`Уровня «${id}» нет в курсе — его данные сохранены.`)
    levels[id] = {
      completedAt: c.isoOrNull(value, 'completedAt', path),
      reflection: c.text(value, 'reflection', path),
      reflectionUpdatedAt: c.isoOrNull(value, 'reflectionUpdatedAt', path),
    }
  }
  return levels
}

function readMotifs(c: Checker, list: unknown[]): MotifLink[] {
  const seen = new Set<string>()
  const motifs: MotifLink[] = []
  list.forEach((raw, i) => {
    const path = `progress.motifs[${i}]`
    if (!isObj(raw)) return c.error(path, 'ожидается объект')
    const id = c.text(raw, 'id', path)
    if (!id || seen.has(id)) return c.warn('Мотив без номера или с повторяющимся номером пропущен.')
    seen.add(id)
    const createdAt = c.iso(raw, 'createdAt', path)
    motifs.push({
      id,
      title: c.text(raw, 'title', path),
      description: c.text(raw, 'description', path),
      filmIds: [
        ...new Set(c.array(raw, 'filmIds', path, false, 200).filter((f): f is string => typeof f === 'string')),
      ],
      createdAt,
      updatedAt: c.iso(raw, 'updatedAt', path, createdAt),
    })
  })
  return motifs
}

function readGraduation(c: Checker, raw: unknown): GraduationWork {
  if (raw === undefined) return createGraduation()
  const path = 'progress.graduation'
  if (!isObj(raw)) {
    c.error(path, 'ожидается объект')
    return createGraduation()
  }
  const decisions = c.array(raw, 'decisions', path, false, 50).map((d, i) => {
    if (!isObj(d)) {
      c.error(`${path}.decisions[${i}]`, 'ожидается объект')
      return { observation: '', effect: '' }
    }
    return {
      observation: c.text(d, 'observation', `${path}.decisions[${i}]`),
      effect: c.text(d, 'effect', `${path}.decisions[${i}]`),
    }
  })
  const base = createGraduation()
  while (decisions.length < base.decisions.length) decisions.push({ observation: '', effect: '' })
  const filmId = raw.filmId
  return {
    subject: c.text(raw, 'subject', path),
    filmId: typeof filmId === 'string' && filmId ? filmId : null,
    mainQuestion: c.text(raw, 'mainQuestion', path),
    decisions,
    connections: c.text(raw, 'connections', path),
    interpretation: c.text(raw, 'interpretation', path),
    completedAt: c.isoOrNull(raw, 'completedAt', path),
    updatedAt: c.isoOrNull(raw, 'updatedAt', path),
  }
}

const SETTING_LABELS: Record<keyof Settings, string> = {
  showGamification: 'игровые элементы',
  reducedMotion: 'меньше движения',
  textScale: 'размер текста',
  theme: 'тема',
  sequentialMode: 'строгий порядок уровней',
  lightMode: 'облегчённый режим',
  weeklyGoal: 'цель на неделю',
}

/** Настройки не критичны: недопустимое значение заменяется значением по умолчанию. */
function readSettings(c: Checker, raw: Obj): Settings {
  const s = { ...DEFAULT_SETTINGS }
  const pick = <K extends keyof Settings>(key: K, valid: (v: unknown) => boolean) => {
    const v = raw[key]
    if (v === undefined) return
    if (valid(v)) s[key] = v as Settings[K]
    else c.warn(`Настройка «${SETTING_LABELS[key]}» записана неверно — вернули значение по умолчанию.`)
  }
  const isBool = (v: unknown) => typeof v === 'boolean'
  pick('showGamification', isBool)
  pick('reducedMotion', isBool)
  pick('sequentialMode', isBool)
  pick('lightMode', isBool)
  pick('weeklyGoal', isBool)
  pick('textScale', (v) => v === 'small' || v === 'normal' || v === 'large')
  pick('theme', (v) => v === 'system' || v === 'light' || v === 'dark')
  return s
}

export function validateProgress(input: unknown, ctx: ValidationContext = {}): ValidationResult {
  const c = new Checker()
  if (!isObj(input)) {
    return { ok: false, errors: ['progress: ожидается объект с данными прогресса'], warnings: [] }
  }
  const createdAt = c.iso(input, 'createdAt', 'progress')
  const defaults = createInitialProgress(new Date(Date.parse(createdAt) || 0))

  const lastActiveRaw = input.lastActiveDate
  let lastActiveDate = defaults.lastActiveDate
  if (lastActiveRaw !== undefined) {
    if (isLocalDate(lastActiveRaw)) lastActiveDate = lastActiveRaw
    else c.error('progress.lastActiveDate', 'ожидается дата YYYY-MM-DD')
  }

  const filmsRaw = c.record(input, 'films', 'progress', true)
  if (Object.keys(filmsRaw).length > LIMITS.maxFilms) c.error('progress.films', 'слишком много записей')
  const films: Record<string, FilmProgress> = {}
  for (const [id, raw] of Object.entries(filmsRaw)) {
    const fp = readFilm(c, raw, `progress.films["${id}"]`, createdAt)
    if (!fp) continue
    if (ctx.knownFilmIds && !ctx.knownFilmIds.has(id)) {
      c.warn(`Фильма «${id}» нет в курсе — его прогресс сохранён, но не показывается.`)
    }
    films[id] = fp
  }

  const notes = readNotes(c, c.array(input, 'notes', 'progress', true, LIMITS.maxNotes), ctx)
  const achievements = readUnlocks(c, c.array(input, 'achievements', 'progress', true, 500), ctx)
  const xpLedger = readLedger(c, c.array(input, 'xpLedger', 'progress', true, LIMITS.maxLedger))
  const xpSum = xpLedger.reduce((s, e) => s + e.amount, 0)
  if (input.xp !== undefined && input.xp !== xpSum) {
    c.warn(`Опыт пересчитан по записанным начислениям: ${xpSum} XP вместо ${JSON.stringify(input.xp)}.`)
  }

  const activityDays = [
    ...new Set(
      c.array(input, 'activityDays', 'progress', false, 20_000).filter((d, i) => {
        if (isLocalDate(d)) return true
        c.error(`progress.activityDays[${i}]`, 'ожидается дата YYYY-MM-DD')
        return false
      }) as string[],
    ),
  ].sort()

  const settingsRaw = c.record(input, 'settings', 'progress', true)
  const backupRaw = c.record(input, 'backup', 'progress', false)
  const snooze = backupRaw.reminderSnoozedUntil

  const currentFilmId = typeof input.currentFilmId === 'string' ? input.currentFilmId : null
  const currentLevelId = typeof input.currentLevelId === 'string' ? input.currentLevelId : null

  const progress: UserProgress = {
    createdAt,
    lastActiveDate,
    currentLevelId,
    currentFilmId: currentFilmId && (!ctx.knownFilmIds || ctx.knownFilmIds.has(currentFilmId)) ? currentFilmId : null,
    films,
    levels: readLevels(c, c.record(input, 'levels', 'progress', false), ctx),
    notes,
    motifs: readMotifs(c, c.array(input, 'motifs', 'progress', false, LIMITS.maxMotifs)),
    graduation: readGraduation(c, input.graduation),
    achievements,
    xp: xpSum,
    xpLedger,
    activityDays,
    settings: readSettings(c, settingsRaw),
    backup: {
      lastExportAt: c.isoOrNull(backupRaw, 'lastExportAt', 'progress.backup'),
      lastImportAt: c.isoOrNull(backupRaw, 'lastImportAt', 'progress.backup'),
      reminderSnoozedUntil: isLocalDate(snooze) ? snooze : null,
    },
  }

  if (c.errors.length > 0) return { ok: false, errors: c.errors, warnings: c.warnings }
  return { ok: true, progress, warnings: c.warnings }
}
