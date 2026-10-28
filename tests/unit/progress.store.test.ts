import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addNote, markWatched, setAnswer } from '@/domain/progress/progress.actions'
import { createProgressFile, serializeProgressFile } from '@/domain/progress/progress.export'
import { parseImportText } from '@/domain/progress/progress.import'
import {
  createMemoryStorage,
  readSnapshot,
  resolveBrowserStorage,
  STORAGE_KEY,
} from '@/domain/progress/progress.storage'
import { useProgressStore } from '@/stores/progress'
import { LONG, makeTestCourse, tickingClock } from '../helpers'

const course = makeTestCourse()
const f1 = course.levels[0]!.films[0]!.id

function freshStore(storage: ReturnType<typeof createMemoryStorage> | null) {
  setActivePinia(createPinia())
  const store = useProgressStore()
  store.init({ storage, now: tickingClock(), course })
  return store
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('автосохранение и перезагрузка (тест ТЗ №3)', () => {
  it('ответ и заметка переживают «перезагрузку» стора', () => {
    const storage = createMemoryStorage()
    const a = freshStore(storage)
    a.apply((p, now) => setAnswer(p, f1, 'observation', LONG, now), 'debounced')
    a.apply((p, now) => addNote(p, { text: 'Заметка о ритме монтажа', kind: 'free', filmId: f1 }, now))
    a.flush()

    const b = freshStore(storage)
    expect(b.loadState).toBe('ready')
    expect(b.progress.films[f1]?.answers.observation).toBe(LONG)
    expect(b.progress.notes.map((n) => n.text)).toEqual(['Заметка о ритме монтажа'])
    expect(b.progress.xp).toBe(a.progress.xp)
  })

  it('ввод текста сохраняется после короткой паузы, статус «Сохраняем…» → «Сохранено»', () => {
    const storage = createMemoryStorage()
    const store = freshStore(storage)
    store.apply((p, now) => setAnswer(p, f1, 'feeling', 'тревога', now), 'debounced')
    expect(store.saveStatus).toBe('pending')
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    vi.advanceTimersByTime(450)
    expect(store.saveStatus).toBe('saved')
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).progress.films[f1].answers.feeling).toBe('тревога')
  })

  it('уведомляет об открытой ачивке один раз', () => {
    const store = freshStore(createMemoryStorage())
    store.apply((p, now) => markWatched(p, f1, now))
    store.apply((p, now) => markWatched(p, course.levels[0]!.films[1]!.id, now))
    expect(store.toasts.filter((t) => t.kind === 'achievement').map((t) => t.title)).toEqual(['Первый просмотр'])
  })
})

describe('недоступное и повреждённое хранилище', () => {
  it('приложение работает без localStorage (тест ТЗ №12)', () => {
    const store = freshStore(null)
    expect(store.loadState).toBe('unavailable')
    store.apply((p, now) => markWatched(p, f1, now))
    expect(store.progress.films[f1]?.watchStatus).toBe('watched')
    expect(store.saveStatus).toBe('error')
  })

  it('resolveBrowserStorage возвращает null, если запись запрещена', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(resolveBrowserStorage()).toBeNull()
    spy.mockRestore()
  })

  it('переполненное хранилище — понятная ошибка, данные остаются в памяти', () => {
    const storage = createMemoryStorage()
    const store = freshStore(storage)
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    store.apply((p, now) => markWatched(p, f1, now))
    expect(store.saveStatus).toBe('error')
    expect(store.saveMessage).toContain('заполнено')
    expect(store.progress.films[f1]?.watchStatus).toBe('watched')
  })

  it('повреждённые данные не перезаписываются без решения пользователя', () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: '{"format":"kino-kak-sposob-myshleniya-progress", обрыв' })
    const store = freshStore(storage)
    expect(store.loadState).toBe('corrupted')
    store.apply((p, now) => markWatched(p, f1, now))
    expect(storage.getItem(STORAGE_KEY)).toContain('обрыв')

    expect(store.startFreshAfterIssue()).toBe(true)
    expect(store.loadState).toBe('ready')
    const snapshotKey = Object.keys(storage.dump()).find((k) => k.includes('snapshot:corrupted-'))
    expect(snapshotKey && storage.getItem(snapshotKey)).toContain('обрыв')
  })

  it('данные более новой версии не перезаписываются', () => {
    const newer = JSON.stringify({ format: 'kino-kak-sposob-myshleniya-progress', schemaVersion: 99, progress: {} })
    const storage = createMemoryStorage({ [STORAGE_KEY]: newer })
    const store = freshStore(storage)
    expect(store.loadState).toBe('newer')
    store.apply((p, now) => markWatched(p, f1, now))
    expect(storage.getItem(STORAGE_KEY)).toBe(newer)
  })

  it('данные v1 мигрируются при загрузке, исходник сохраняется снимком', () => {
    const v1 = readFileSync(resolve(process.cwd(), 'tests/fixtures/progress-v1-example.json'), 'utf-8')
    const storage = createMemoryStorage({ [STORAGE_KEY]: v1 })
    const store = freshStore(storage)
    expect(store.loadState).toBe('ready')
    expect(store.migratedFrom).toBe(1)
    expect(store.progress.xp).toBe(20)
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).schemaVersion).toBe(2)
    expect(readSnapshot(storage, 'before-migration-v1')).toBe(v1)
  })
})

describe('импорт и сброс', () => {
  it('несовместимый файл не меняет текущий прогресс (тест ТЗ №8)', () => {
    const storage = createMemoryStorage()
    const store = freshStore(storage)
    store.apply((p, now) => markWatched(p, f1, now))
    const before = store.progress
    const savedBefore = storage.getItem(STORAGE_KEY)
    const r = parseImportText(JSON.stringify({ format: 'kino-kak-sposob-myshleniya-progress', schemaVersion: 7, progress: {} }), course)
    expect(r.ok).toBe(false)
    expect(store.progress).toBe(before)
    expect(storage.getItem(STORAGE_KEY)).toBe(savedBefore)
  })

  it('замена делает снимок и может быть отменена', () => {
    const storage = createMemoryStorage()
    const store = freshStore(storage)
    store.apply((p, now) => markWatched(p, f1, now))
    const other = course.levels[2]!.films[0]!.id
    const donor = freshStore(createMemoryStorage())
    donor.apply((p, now) => markWatched(p, other, now))
    const parsed = parseImportText(serializeProgressFile(createProgressFile(donor.progress, new Date())), course)
    if (!parsed.ok) throw new Error('parse failed')

    setActivePinia(createPinia())
    const reopened = useProgressStore()
    reopened.init({ storage, now: tickingClock(), course })
    reopened.replaceWith(parsed.progress)
    expect(reopened.progress.films[f1]).toBeUndefined()
    expect(reopened.progress.films[other]?.watchStatus).toBe('watched')
    expect(reopened.progress.backup.lastImportAt).not.toBeNull()
    expect(reopened.undoImportAvailable).toBe(true)

    expect(reopened.undoImport()).toBe(true)
    expect(reopened.progress.films[f1]?.watchStatus).toBe('watched')
    expect(reopened.progress.films[other]).toBeUndefined()
  })

  it('сброс не происходит без подтверждения (тест ТЗ №11)', () => {
    const storage = createMemoryStorage()
    const store = freshStore(storage)
    store.apply((p, now) => markWatched(p, f1, now))
    store.apply((p) => ({ ...p, settings: { ...p.settings, theme: 'dark' } }))
    expect(store.resetProgress(false)).toBe(false)
    expect(store.progress.films[f1]).toBeDefined()

    expect(store.resetProgress(true)).toBe(true)
    expect(store.progress.films).toEqual({})
    expect(store.progress.xp).toBe(0)
    expect(store.progress.settings.theme).toBe('dark')
    expect(readSnapshot(storage, 'before-reset')).toContain(f1)
  })

  it('сброс можно отменить, снимок после этого удаляется — и после перезагрузки', () => {
    const storage = createMemoryStorage()
    const store = freshStore(storage)
    store.apply((p, now) => markWatched(p, f1, now))
    expect(store.undoResetAvailable).toBe(false)
    store.resetProgress(true)
    expect(store.undoResetAvailable).toBe(true)

    const reopened = freshStore(storage)
    expect(reopened.undoResetAvailable).toBe(true)
    expect(reopened.undoReset()).toBe(true)
    expect(reopened.progress.films[f1]?.watchStatus).toBe('watched')
    expect(reopened.undoResetAvailable).toBe(false)
    expect(readSnapshot(storage, 'before-reset')).toBeNull()
    expect(reopened.undoReset()).toBe(false)
  })

  it('экспорт отмечает дату последней копии', () => {
    const store = freshStore(createMemoryStorage())
    const create = vi.fn(() => 'blob:test')
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    store.apply((p, now) => markWatched(p, f1, now))
    expect(store.exportBackup()).toBe(true)
    expect(click).toHaveBeenCalled()
    expect(store.progress.backup.lastExportAt).not.toBeNull()
    click.mockRestore()
  })
})
