/**
 * Pinia-стор прогресса — тонкая обёртка над доменными функциями:
 * применяет действие → начисляет награды → сохраняет в хранилище.
 *
 * Правила сохранности:
 * - каждое изменение сохраняется автоматически (кнопки — сразу, ввод текста — через 400 мс);
 * - отложенное сохранение сбрасывается при скрытии/закрытии страницы;
 * - повреждённые или «более новые» данные в хранилище никогда не перезаписываются
 *   без явного решения пользователя;
 * - перед заменой при импорте и перед сбросом делается снимок текущих данных.
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { course as defaultCourse } from '@/content/course'
import type { Course } from '@/domain/catalog/catalog.types'
import { localDate } from '@/domain/shared/dates'
import { createInitialProgress, hasAnyProgress } from '@/domain/progress/progress.defaults'
import { readProgressDocument } from '@/domain/progress/progress.document'
import {
  createProgressFile,
  downloadTextFile,
  exportFileName,
  serializeProgressFile,
} from '@/domain/progress/progress.export'
import { mergeProgress, type MergeReport } from '@/domain/progress/progress.merge'
import {
  loadProgress,
  readSnapshot,
  removeSnapshot,
  resolveBrowserStorage,
  saveProgress,
  serializeForStorage,
  STORAGE_KEY,
  writeSnapshot,
  type KeyValueStorage,
} from '@/domain/progress/progress.storage'
import type { UserProgress } from '@/domain/progress/progress.types'
import { markExported, markImported } from '@/domain/progress/progress.actions'
import { evaluateRewards, rankFor } from '@/domain/rewards/rewards.engine'
import type { AchievementDefinition } from '@/domain/rewards/rewards.config'

export type LoadState = 'loading' | 'ready' | 'corrupted' | 'newer' | 'unavailable'
export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error'

export interface Toast {
  id: number
  kind: 'achievement' | 'rank' | 'info' | 'error'
  title: string
  text: string
}

export const TEXT_SAVE_DELAY_MS = 400

type Change = (p: UserProgress, now: Date) => UserProgress

export const useProgressStore = defineStore('progress', () => {
  const course = shallowRef<Course>(defaultCourse)
  let storage: KeyValueStorage | null = null
  let clock: () => Date = () => new Date()
  let timer: ReturnType<typeof setTimeout> | null = null
  let toastSeq = 0
  let listenersAttached = false

  const progress = shallowRef<UserProgress>(createInitialProgress(new Date()))
  const loadState = ref<LoadState>('loading')
  const loadIssue = ref<{ raw: string; errors: string[]; version?: number } | null>(null)
  const loadWarnings = ref<string[]>([])
  const migratedFrom = ref<number | null>(null)
  const saveStatus = ref<SaveStatus>('idle')
  const saveMessage = ref('')
  const toasts = ref<Toast[]>([])
  const undoImportAvailable = ref(false)
  const undoResetAvailable = ref(false)

  /** Пока данные в хранилище повреждены или новее — ничего не записываем. */
  const persistenceBlocked = computed(() => loadState.value === 'corrupted' || loadState.value === 'newer')
  const settings = computed(() => progress.value.settings)
  const started = computed(() => hasAnyProgress(progress.value))

  function notify(kind: Toast['kind'], title: string, text = '') {
    const toast = { id: ++toastSeq, kind, title, text }
    toasts.value = [...toasts.value.slice(-3), toast]
    return toast.id
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function announceRewards(before: UserProgress, unlocked: AchievementDefinition[], after: UserProgress) {
    if (!after.settings.showGamification) return
    for (const a of unlocked) notify('achievement', a.title, a.description)
    const prevRank = rankFor(before.xp).rank
    const nextRank = rankFor(after.xp).rank
    if (nextRank.id !== prevRank.id)
      notify('rank', `Новый ранг: ${nextRank.title}`, 'Это метафора накопленного опыта, а не оценка.')
  }

  function writeNow(): boolean {
    if (persistenceBlocked.value) {
      saveStatus.value = 'error'
      saveMessage.value = 'Сохранение приостановлено: сначала решите, что делать с повреждёнными данными.'
      return false
    }
    const result = saveProgress(storage, progress.value, clock())
    if (result.ok) {
      saveStatus.value = 'saved'
      saveMessage.value = ''
      return true
    }
    saveStatus.value = 'error'
    saveMessage.value = result.message
    return false
  }

  /** Начисляет награды и записывает состояние. */
  function commit() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const before = progress.value
    const outcome = evaluateRewards(course.value, before, clock())
    progress.value = outcome.progress
    announceRewards(before, outcome.unlocked, outcome.progress)
    writeNow()
  }

  /**
   * Применить изменение. `debounced` — для набора текста: состояние меняется
   * сразу, запись и награды — после короткой паузы.
   */
  function apply(change: Change, mode: 'immediate' | 'debounced' = 'immediate') {
    const next = change(progress.value, clock())
    if (next === progress.value) return
    progress.value = next
    if (mode === 'immediate') {
      commit()
    } else {
      saveStatus.value = 'pending'
      if (timer) clearTimeout(timer)
      timer = setTimeout(commit, TEXT_SAVE_DELAY_MS)
    }
  }

  function flush() {
    if (timer) commit()
  }

  function hasPendingChanges() {
    return timer !== null
  }

  function attachListeners() {
    if (listenersAttached || typeof window === 'undefined') return
    listenersAttached = true
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
    // Другая вкладка сохранила данные — подтягиваем их, если у нас нет несохранённого ввода.
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY || e.newValue === null || hasPendingChanges() || persistenceBlocked.value) return
      const result = loadProgress(storage, course.value)
      if (result.kind === 'ok') {
        progress.value = result.progress
        notify('info', 'Данные обновлены', 'Прогресс изменён в другой вкладке и подгружен сюда.')
      }
    })
  }

  function init(options: { storage?: KeyValueStorage | null; now?: () => Date; course?: Course } = {}) {
    if (options.course) course.value = options.course
    if (options.now) clock = options.now
    storage = options.storage !== undefined ? options.storage : resolveBrowserStorage()
    const result = loadProgress(storage, course.value)
    loadIssue.value = null
    loadWarnings.value = []
    migratedFrom.value = null

    switch (result.kind) {
      case 'empty':
        progress.value = createInitialProgress(clock())
        loadState.value = 'ready'
        break
      case 'ok': {
        loadState.value = 'ready'
        loadWarnings.value = result.warnings
        migratedFrom.value = result.migratedFrom
        // Правила наград могли обновиться — досчитываем молча, без уведомлений.
        const outcome = evaluateRewards(course.value, result.progress, clock())
        progress.value = outcome.progress
        if (result.migratedFrom !== null) {
          const raw = storage?.getItem(STORAGE_KEY)
          if (raw) writeSnapshot(storage, `before-migration-v${result.migratedFrom}`, raw)
          writeNow()
        } else if (outcome.progress !== result.progress) {
          writeNow()
        }
        break
      }
      case 'corrupted':
        progress.value = createInitialProgress(clock())
        loadState.value = 'corrupted'
        loadIssue.value = { raw: result.raw, errors: result.errors }
        break
      case 'newer':
        progress.value = createInitialProgress(clock())
        loadState.value = 'newer'
        loadIssue.value = { raw: result.raw, errors: [], version: result.version }
        break
      case 'unavailable':
        progress.value = createInitialProgress(clock())
        loadState.value = 'unavailable'
        saveStatus.value = 'error'
        saveMessage.value = 'Браузер не разрешает сохранять данные. Скачивайте резервную копию перед закрытием вкладки.'
        break
    }
    undoImportAvailable.value = readSnapshot(storage, 'before-import') !== null
    undoResetAvailable.value = readSnapshot(storage, 'before-reset') !== null
    attachListeners()
  }

  /* ---------- Резервные копии ---------- */

  function exportBackup(): boolean {
    flush()
    const now = clock()
    const ok = downloadTextFile(exportFileName(now), serializeProgressFile(createProgressFile(progress.value, now)))
    if (ok) {
      progress.value = markExported(progress.value, now)
      writeNow()
    }
    return ok
  }

  /** Скачать исходные повреждённые данные как есть, чтобы ничего не потерять. */
  function downloadRawIssue(): boolean {
    if (!loadIssue.value) return false
    return downloadTextFile(exportFileName(clock(), 'damaged'), loadIssue.value.raw, 'application/json')
  }

  /** Начать заново при повреждённых данных: старые данные остаются отдельным снимком. */
  function startFreshAfterIssue(): boolean {
    const now = clock()
    if (loadIssue.value) writeSnapshot(storage, `corrupted-${now.getTime()}`, loadIssue.value.raw)
    loadIssue.value = null
    loadState.value = storage ? 'ready' : 'unavailable'
    progress.value = createInitialProgress(now)
    return writeNow()
  }

  function snapshotCurrent(label: 'before-import' | 'before-reset') {
    if (persistenceBlocked.value && loadIssue.value) {
      writeSnapshot(storage, `corrupted-${clock().getTime()}`, loadIssue.value.raw)
      return
    }
    writeSnapshot(storage, label, serializeForStorage(progress.value, clock()))
  }

  function replaceWith(imported: UserProgress) {
    flush()
    snapshotCurrent('before-import')
    if (persistenceBlocked.value) {
      loadIssue.value = null
      loadState.value = storage ? 'ready' : 'unavailable'
    }
    const now = clock()
    const outcome = evaluateRewards(course.value, markImported(imported, now), now)
    progress.value = outcome.progress
    undoImportAvailable.value = storage !== null
    return { saved: writeNow(), unlocked: outcome.unlocked }
  }

  function mergeWith(imported: UserProgress): {
    saved: boolean
    report: MergeReport
    unlocked: AchievementDefinition[]
  } {
    flush()
    snapshotCurrent('before-import')
    const now = clock()
    const merged = mergeProgress(progress.value, imported, now)
    const outcome = evaluateRewards(course.value, markImported(merged.progress, now), now)
    progress.value = outcome.progress
    undoImportAvailable.value = storage !== null
    return { saved: writeNow(), report: merged.report, unlocked: outcome.unlocked }
  }

  /** Вернуть данные из снимка перед импортом или сбросом; снимок после этого удаляется. */
  function restoreSnapshot(label: 'before-import' | 'before-reset'): boolean {
    flush()
    const raw = readSnapshot(storage, label)
    if (!raw) return false
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      return false
    }
    const result = readProgressDocument(data, course.value)
    if (!result.ok) return false
    progress.value = result.progress
    const saved = writeNow()
    if (saved) {
      removeSnapshot(storage, label)
      if (label === 'before-import') undoImportAvailable.value = false
      else undoResetAvailable.value = false
    }
    return saved
  }

  const undoImport = () => restoreSnapshot('before-import')
  const undoReset = () => restoreSnapshot('before-reset')

  /** Сброс прогресса. Без явного подтверждения ничего не делает. Настройки интерфейса сохраняются. */
  function resetProgress(confirmed: boolean): boolean {
    if (!confirmed) return false
    flush()
    snapshotCurrent('before-reset')
    const settingsBefore = progress.value.settings
    progress.value = { ...createInitialProgress(clock()), settings: settingsBefore }
    undoResetAvailable.value = storage !== null
    return writeNow()
  }

  function snoozeReminderDays(days: number) {
    const until = new Date(clock())
    until.setDate(until.getDate() + days)
    apply((p) => ({ ...p, backup: { ...p.backup, reminderSnoozedUntil: localDate(until) } }))
  }

  return {
    progress,
    loadState,
    loadIssue,
    loadWarnings,
    migratedFrom,
    saveStatus,
    saveMessage,
    toasts,
    undoImportAvailable,
    undoResetAvailable,
    persistenceBlocked,
    settings,
    started,
    course,
    now: () => clock(),
    init,
    apply,
    commit,
    flush,
    notify,
    dismissToast,
    exportBackup,
    downloadRawIssue,
    startFreshAfterIssue,
    replaceWith,
    mergeWith,
    undoImport,
    undoReset,
    resetProgress,
    snoozeReminderDays,
  }
})
