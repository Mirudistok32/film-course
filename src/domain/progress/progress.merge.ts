/**
 * Объединение текущего прогресса с импортированным (ТЗ §25).
 *
 * - Статусы берутся более продвинутые, даты завершения — самые ранние.
 * - Тексты не теряются: если поле заполнено по-разному, в поле остаётся
 *   текущая версия, а версия из файла сохраняется отдельной заметкой
 *   с меткой merge-conflict. Повторный импорт того же файла не создаёт
 *   дубликатов — заметки сравниваются по тексту.
 * - Ачивки объединяются по id с самой ранней датой, XP — по id событий.
 * - Настройки остаются текущими.
 */
import { earliestIso, latestIso, toIso } from '../shared/dates'
import { createId } from '../shared/ids'
import { normalizeText, plural } from '../shared/text'
import { sumXp } from '../rewards/rewards.engine'
import { createLevelProgress } from './progress.defaults'
import type {
  AchievementUnlock,
  AnalysisStatus,
  AnswerKey,
  FilmProgress,
  GraduationWork,
  LevelProgress,
  MotifLink,
  Note,
  UserProgress,
  WatchStatus,
  XpEvent,
} from './progress.types'
import { ANSWER_KEYS } from './progress.types'

export const MERGE_CONFLICT_TAG = 'merge-conflict'

export interface MergeReport {
  filmsAdded: number
  filmsUpdated: number
  notesAdded: number
  conflictsPreserved: number
  achievementsAdded: number
  xpEventsAdded: number
  motifsAdded: number
  levelsCompletedAdded: number
}

const WATCH_RANK: Record<WatchStatus, number> = { 'not-watched': 0, started: 1, watched: 2 }
const ANALYSIS_RANK: Record<AnalysisStatus, number> = { 'not-started': 0, 'in-progress': 1, completed: 2 }

export const ANSWER_LABELS: Record<AnswerKey, string> = {
  observation: 'Я заметил…',
  feeling: 'Это заставило меня почувствовать…',
  hypothesis: 'Возможно, это означает…',
  evidence: 'На это указывает…',
  altHypothesis: 'Другое прочтение',
  openQuestion: 'Открытый вопрос',
}

class MergeState {
  notes: Note[]
  report: MergeReport = {
    filmsAdded: 0,
    filmsUpdated: 0,
    notesAdded: 0,
    conflictsPreserved: 0,
    achievementsAdded: 0,
    xpEventsAdded: 0,
    motifsAdded: 0,
    levelsCompletedAdded: 0,
  }
  /** Сколько заметок с таким текстом (по фильму) уже есть — для дедупликации. */
  private texts = new Map<string, number>()

  constructor(
    initial: Note[],
    private now: Date,
  ) {
    this.notes = [...initial]
    for (const n of initial) this.count(n, 1)
  }

  private key(filmId: string | null, text: string) {
    return `${filmId ?? ''}\u0000${normalizeText(text)}`
  }

  private count(note: Note, delta: number) {
    const key = this.key(note.filmId, note.text)
    const next = (this.texts.get(key) ?? 0) + delta
    if (next > 0) this.texts.set(key, next)
    else this.texts.delete(key)
  }

  hasText(filmId: string | null, text: string) {
    return this.texts.has(this.key(filmId, text))
  }

  addNote(note: Note) {
    this.notes.push(note)
    this.count(note, 1)
  }

  replaceNote(index: number, note: Note) {
    const prev = this.notes[index]
    if (prev) this.count(prev, -1)
    this.notes[index] = note
    this.count(note, 1)
  }

  /**
   * Возвращает значение поля после объединения. Если версии различаются,
   * версия из файла сохраняется заметкой (если такой текст ещё не сохранён).
   */
  text(current: string | undefined, incoming: string | undefined, filmId: string | null, tag: string): string {
    const cur = current ?? ''
    const inc = incoming ?? ''
    if (normalizeText(inc) === '' || normalizeText(cur) === normalizeText(inc)) return cur
    if (normalizeText(cur) === '') return inc
    if (!this.hasText(filmId, inc)) {
      const iso = toIso(this.now)
      this.addNote({
        id: createId('note'),
        text: inc,
        kind: 'merge-copy',
        filmId,
        createdAt: iso,
        updatedAt: iso,
        tags: [MERGE_CONFLICT_TAG, tag],
      })
      this.report.conflictsPreserved++
    }
    return cur
  }
}

function mergeFilm(cur: FilmProgress, inc: FilmProgress, filmId: string, m: MergeState): FilmProgress {
  const answers: FilmProgress['answers'] = {}
  for (const key of ANSWER_KEYS) {
    const value = m.text(cur.answers[key], inc.answers[key], filmId, `field:${key}`)
    if (value !== '') answers[key] = value
  }
  const completedAt = earliestIso(cur.completedAt, inc.completedAt)
  return {
    watchStatus: WATCH_RANK[inc.watchStatus] > WATCH_RANK[cur.watchStatus] ? inc.watchStatus : cur.watchStatus,
    analysisStatus:
      ANALYSIS_RANK[inc.analysisStatus] > ANALYSIS_RANK[cur.analysisStatus] ? inc.analysisStatus : cur.analysisStatus,
    startedAt: earliestIso(cur.startedAt, inc.startedAt),
    watchedAt: earliestIso(cur.watchedAt, inc.watchedAt),
    completedAt,
    answers,
    exercise: {
      response: m.text(cur.exercise.response, inc.exercise.response, filmId, 'field:exercise'),
      checklist: [...new Set([...cur.exercise.checklist, ...inc.exercise.checklist])].sort((a, b) => a - b),
      completedAt: earliestIso(cur.exercise.completedAt, inc.exercise.completedAt),
      sampleOpenedAt: earliestIso(cur.exercise.sampleOpenedAt, inc.exercise.sampleOpenedAt),
    },
    isFavorite: cur.isFavorite || inc.isFavorite,
    revisitLater: cur.revisitLater || inc.revisitLater,
    reviewing: Boolean(completedAt) && cur.reviewing,
    updatedAt: latestIso(cur.updatedAt, inc.updatedAt) ?? cur.updatedAt,
  }
}

function mergeNotes(incoming: Note[], m: MergeState) {
  const byId = new Map(m.notes.map((n, i) => [n.id, i]))
  for (const note of incoming) {
    const index = byId.get(note.id)
    if (index === undefined) {
      if (m.hasText(note.filmId, note.text)) continue
      m.addNote(note)
      byId.set(note.id, m.notes.length - 1)
      m.report.notesAdded++
      continue
    }
    const existing = m.notes[index] as Note
    if (normalizeText(existing.text) === normalizeText(note.text)) continue
    // Одна и та же заметка изменена по-разному: более свежая версия остаётся
    // под исходным id, другая сохраняется копией.
    const incomingNewer = Date.parse(note.updatedAt) > Date.parse(existing.updatedAt)
    const keep = incomingNewer ? note : existing
    const other = incomingNewer ? existing : note
    m.replaceNote(index, keep)
    if (!m.hasText(other.filmId, other.text)) {
      m.addNote({
        ...other,
        id: createId('note'),
        kind: 'merge-copy',
        tags: [...new Set([...other.tags, MERGE_CONFLICT_TAG])],
      })
      m.report.conflictsPreserved++
    }
  }
}

function mergeLevels(cur: Record<string, LevelProgress>, inc: Record<string, LevelProgress>, m: MergeState) {
  const levels: Record<string, LevelProgress> = { ...cur }
  for (const [id, incLevel] of Object.entries(inc)) {
    const curLevel = cur[id] ?? createLevelProgress()
    if (!curLevel.completedAt && incLevel.completedAt) m.report.levelsCompletedAdded++
    levels[id] = {
      completedAt: earliestIso(curLevel.completedAt, incLevel.completedAt),
      reflection: m.text(curLevel.reflection, incLevel.reflection, null, `level:${id}`),
      reflectionUpdatedAt: latestIso(curLevel.reflectionUpdatedAt, incLevel.reflectionUpdatedAt),
    }
  }
  return levels
}

function mergeGraduation(cur: GraduationWork, inc: GraduationWork, m: MergeState): GraduationWork {
  const length = Math.max(cur.decisions.length, inc.decisions.length)
  const decisions = Array.from({ length }, (_, i) => ({
    observation: m.text(
      cur.decisions[i]?.observation,
      inc.decisions[i]?.observation,
      null,
      `graduation:decision-${i + 1}`,
    ),
    effect: m.text(cur.decisions[i]?.effect, inc.decisions[i]?.effect, null, `graduation:effect-${i + 1}`),
  }))
  return {
    subject: m.text(cur.subject, inc.subject, null, 'graduation:subject'),
    filmId: cur.filmId ?? inc.filmId,
    mainQuestion: m.text(cur.mainQuestion, inc.mainQuestion, null, 'graduation:question'),
    decisions,
    connections: m.text(cur.connections, inc.connections, null, 'graduation:connections'),
    interpretation: m.text(cur.interpretation, inc.interpretation, null, 'graduation:interpretation'),
    completedAt: earliestIso(cur.completedAt, inc.completedAt),
    updatedAt: latestIso(cur.updatedAt, inc.updatedAt),
  }
}

function mergeById<T extends { id: string }>(
  cur: T[],
  inc: T[],
  pick: (a: T, b: T) => T,
): { list: T[]; added: number } {
  const map = new Map(cur.map((x) => [x.id, x]))
  let added = 0
  for (const item of inc) {
    const existing = map.get(item.id)
    if (!existing) added++
    map.set(item.id, existing ? pick(existing, item) : item)
  }
  return { list: [...map.values()], added }
}

export function mergeProgress(
  current: UserProgress,
  incoming: UserProgress,
  now: Date,
): { progress: UserProgress; report: MergeReport } {
  const m = new MergeState(current.notes, now)

  const films: Record<string, FilmProgress> = { ...current.films }
  for (const [id, inc] of Object.entries(incoming.films)) {
    const cur = current.films[id]
    if (!cur) {
      films[id] = inc
      m.report.filmsAdded++
    } else {
      const merged = mergeFilm(cur, inc, id, m)
      if (JSON.stringify(merged) !== JSON.stringify(cur)) m.report.filmsUpdated++
      films[id] = merged
    }
  }

  mergeNotes(incoming.notes, m)
  const levels = mergeLevels(current.levels, incoming.levels, m)
  const graduation = mergeGraduation(current.graduation, incoming.graduation, m)

  const achievements = mergeById<AchievementUnlock>(current.achievements, incoming.achievements, (a, b) =>
    Date.parse(b.unlockedAt) < Date.parse(a.unlockedAt) ? b : a,
  )
  const ledger = mergeById<XpEvent>(current.xpLedger, incoming.xpLedger, (a, b) =>
    Date.parse(b.at) < Date.parse(a.at) ? b : a,
  )
  const motifs = mergeById<MotifLink>(current.motifs, incoming.motifs, (a, b) => {
    const newer = Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a
    return { ...newer, filmIds: [...new Set([...a.filmIds, ...b.filmIds])] }
  })
  m.report.achievementsAdded = achievements.added
  m.report.xpEventsAdded = ledger.added
  m.report.motifsAdded = motifs.added

  const progress: UserProgress = {
    ...current,
    createdAt: earliestIso(current.createdAt, incoming.createdAt) ?? current.createdAt,
    lastActiveDate:
      current.lastActiveDate >= incoming.lastActiveDate ? current.lastActiveDate : incoming.lastActiveDate,
    currentFilmId: current.currentFilmId ?? incoming.currentFilmId,
    currentLevelId: current.currentLevelId ?? incoming.currentLevelId,
    films,
    levels,
    notes: m.notes,
    motifs: motifs.list,
    graduation,
    achievements: achievements.list,
    xpLedger: ledger.list,
    xp: sumXp(ledger.list),
    activityDays: [...new Set([...current.activityDays, ...incoming.activityDays])].sort(),
  }
  return { progress, report: m.report }
}

/** Итог объединения словами — для сообщения после импорта. Нулевые пункты не показываются. */
export function mergeReportLines(r: MergeReport): string[] {
  const n = (count: number, forms: readonly [string, string, string]) => `${count} ${plural(count, forms)}`
  const lines: string[] = []
  if (r.filmsAdded) lines.push(`Новых фильмов с прогрессом: ${r.filmsAdded}`)
  if (r.filmsUpdated) lines.push(`Дополнено фильмов: ${r.filmsUpdated}`)
  if (r.levelsCompletedAdded) lines.push(`Отмечено пройденными уровней: ${r.levelsCompletedAdded}`)
  if (r.notesAdded) lines.push(`Добавлено заметок: ${r.notesAdded}`)
  if (r.motifsAdded) lines.push(`Добавлено мотивов: ${r.motifsAdded}`)
  if (r.achievementsAdded) lines.push(`Открыто достижений: ${r.achievementsAdded}`)
  if (r.xpEventsAdded) lines.push(`Учтено новых начислений опыта: ${r.xpEventsAdded}`)
  if (r.conflictsPreserved) {
    lines.push(
      `${n(r.conflictsPreserved, ['ответ отличался', 'ответа отличались', 'ответов отличались'])} — в полях осталась текущая версия, версия из файла сохранена заметкой с меткой «${MERGE_CONFLICT_TAG}»`,
    )
  }
  return lines
}
