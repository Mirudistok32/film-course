/**
 * Даты: моменты времени храним как ISO 8601 UTC, календарные дни —
 * как локальную дату YYYY-MM-DD (чтобы смена часового пояса не сдвигала
 * «учебный день»).
 */

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function toIso(date: Date): string {
  return date.toISOString()
}

export function localDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value))
}

export function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const m = LOCAL_DATE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const probe = new Date(Date.UTC(y, mo - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d
}

/** Более ранняя из двух ISO-дат; null игнорируется. */
export function earliestIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return Date.parse(a) <= Date.parse(b) ? a : b
}

/** Более поздняя из двух ISO-дат; null игнорируется. */
export function latestIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return Date.parse(a) >= Date.parse(b) ? a : b
}

export function isAfter(a: string, b: string): boolean {
  return Date.parse(a) > Date.parse(b)
}

function parseLocal(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(day: string, n: number): string {
  const date = parseLocal(day)
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseLocal(to).getTime() - parseLocal(from).getTime()) / 86_400_000)
}

/** Ключ ISO-недели для локальной даты, например 2026-W44. */
export function isoWeekKey(day: string): string {
  const date = parseLocal(day)
  const weekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Человекочитаемая локальная дата для ISO-момента или локального дня. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = isLocalDate(value) ? parseLocal(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  if (isLocalDate(value)) {
    return dateFormatter.format(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  }
  return dateFormatter.format(date)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date)
}
