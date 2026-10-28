import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createInitialProgress } from '@/domain/progress/progress.defaults'
import {
  addNote,
  completeExercise,
  completeFilm,
  markWatched,
  setAnswer,
  setExerciseResponse,
} from '@/domain/progress/progress.actions'
import { createProgressFile, exportFileName, serializeProgressFile } from '@/domain/progress/progress.export'
import { parseImportText } from '@/domain/progress/progress.import'
import { mergeProgress, mergeReportLines, MERGE_CONFLICT_TAG } from '@/domain/progress/progress.merge'
import { LEGACY_V1_XP_EVENT } from '@/domain/progress/progress.migrations'
import { validateProgress } from '@/domain/progress/progress.validate'
import { evaluateRewards } from '@/domain/rewards/rewards.engine'
import { LONG, makeTestCourse, T0 } from '../helpers'

const course = makeTestCourse()
const f1 = course.levels[0]!.films[0]!.id
const later = new Date(T0.getTime() + 86_400_000)

function richProgress() {
  let p = createInitialProgress(T0)
  p = markWatched(p, f1, T0)
  p = setAnswer(p, f1, 'observation', LONG, T0)
  p = setAnswer(p, f1, 'feeling', 'Тревога от неустойчивого пространства', T0)
  p = completeExercise(setExerciseResponse(p, f1, LONG, T0), f1, T0)
  p = completeFilm(p, f1, T0)
  p = addNote(p, { text: 'Свободная мысль о тенях и свете', kind: 'free', filmId: null }, T0, 'free-1')
  return evaluateRewards(course, p, T0).progress
}

describe('экспорт', () => {
  it('имя файла соответствует ТЗ', () => {
    expect(exportFileName(new Date(2026, 9, 28, 12))).toBe('kino-kak-sposob-myshleniya-progress-2026-10-28.json')
  })

  it('файл содержит обязательные поля и читается человеком', () => {
    const text = serializeProgressFile(createProgressFile(richProgress(), T0))
    const data = JSON.parse(text)
    expect(data.format).toBe('kino-kak-sposob-myshleniya-progress')
    expect(data.schemaVersion).toBe(2)
    expect(data.exportedAt).toBe(T0.toISOString())
    expect(typeof data.appVersion).toBe('string')
    expect(text).toContain('\n  "progress": {')
  })
})

describe('экспорт → импорт (тест ТЗ №7)', () => {
  it('сохраняет ключевые данные без изменений', () => {
    const original = richProgress()
    const text = serializeProgressFile(createProgressFile(original, T0))
    const result = parseImportText(text, course)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.progress).toEqual(original)
    expect(result.summary.filmsCompleted).toBe(1)
    expect(result.summary.notes).toBe(1)
    expect(result.summary.xp).toBe(original.xp)
    expect(result.migratedFrom).toBeNull()
  })
})

describe('ошибочные файлы', () => {
  const ok = serializeProgressFile(createProgressFile(richProgress(), T0))

  it.each([
    ['', 'empty'],
    ['{ не json', 'not-json'],
    ['[]', 'not-object'],
    [JSON.stringify({ format: 'other', schemaVersion: 1, progress: {} }), 'wrong-format'],
    [JSON.stringify({ format: 'kino-kak-sposob-myshleniya-progress', progress: {} }), 'missing-version'],
    [JSON.stringify({ format: 'kino-kak-sposob-myshleniya-progress', schemaVersion: 99, progress: {} }), 'newer-version'],
    [JSON.stringify({ format: 'kino-kak-sposob-myshleniya-progress', schemaVersion: 1.5, progress: {} }), 'unsupported-version'],
  ])('%s → %s', (text, code) => {
    const r = parseImportText(text, course)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe(code)
      expect(r.error.message.length).toBeGreaterThan(10)
    }
  })

  it('недопустимый статус фильма — ошибка с путём к полю', () => {
    const data = JSON.parse(ok)
    data.progress.films[f1].watchStatus = 'done'
    const r = parseImportText(JSON.stringify(data), course)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.code).toBe('invalid-data')
      expect(r.error.details.join('\n')).toContain(`films["${f1}"].watchStatus`)
    }
  })

  it('битая дата и отрицательный XP — ошибки', () => {
    const data = JSON.parse(ok)
    data.progress.films[f1].watchedAt = 'вчера'
    data.progress.xpLedger[0].amount = -5
    const r = parseImportText(JSON.stringify(data), course)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.details.length).toBeGreaterThanOrEqual(2)
  })

  it('неизвестные поля не ломают импорт, неизвестный фильм — предупреждение', () => {
    const data = JSON.parse(ok)
    data.progress.somethingNew = { a: 1 }
    data.progress.films['removed-film'] = data.progress.films[f1]
    const r = parseImportText(JSON.stringify(data), course)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.warnings.join('\n')).toContain('removed-film')
      // Предупреждения читает человек: без технических путей к полям.
      expect(r.warnings.join('\n')).not.toContain('progress.')
      expect(r.progress.films['removed-film']).toBeDefined()
      expect(r.summary.unknownFilmIds).toEqual(['removed-film'])
    }
  })

  it('неверная сумма xp пересчитывается из событий', () => {
    const data = JSON.parse(ok)
    data.progress.xp = 99999
    const r = parseImportText(JSON.stringify(data), course)
    expect(r.ok && r.progress.xp).toBe(richProgress().xp)
  })
})

describe('миграция v1 → v2', () => {
  const v1Text = readFileSync(resolve(process.cwd(), 'tests/fixtures/progress-v1-example.json'), 'utf-8')

  it('пример из ТЗ импортируется без потери данных и XP', () => {
    const r = parseImportText(v1Text, course)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.migratedFrom).toBe(1)
    // Опыт v1 пересчитывается при миграции — это не повод для предупреждения.
    expect(r.warnings).toEqual([])
    const film = r.progress.films['the-cabinet-of-dr-caligari']
    expect(film?.watchStatus).toBe('watched')
    expect(film?.answers.evidence).toContain('Наклонные стены')
    expect(film?.exercise.completedAt).toBeNull()
    expect(r.progress.achievements).toEqual([{ id: 'first-viewing', unlockedAt: '2026-10-28T16:31:00.000Z' }])
    expect(r.progress.xp).toBe(20)
    expect(r.progress.xpLedger.map((e) => e.id).sort()).toEqual([
      'first-note:the-cabinet-of-dr-caligari',
      'watched:the-cabinet-of-dr-caligari',
    ])
    // повторная оценка наград не добавляет XP
    expect(evaluateRewards(course, r.progress, later).gainedXp).toBe(0)
  })

  it('заметки и выполненное упражнение v1 переносятся, лишний XP сохраняется отдельным событием', () => {
    const data = JSON.parse(v1Text)
    data.progress.xp = 70
    data.progress.films['the-cabinet-of-dr-caligari'].exerciseCompleted = true
    data.progress.films['the-cabinet-of-dr-caligari'].notes = [
      { id: 'old-1', text: 'Старая заметка', createdAt: '2026-10-28T16:40:00.000Z', updatedAt: '2026-10-28T16:40:00.000Z' },
    ]
    const r = parseImportText(JSON.stringify(data), course)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.progress.notes[0]).toMatchObject({ id: 'old-1', filmId: 'the-cabinet-of-dr-caligari', kind: 'free' })
    expect(r.progress.films['the-cabinet-of-dr-caligari']?.exercise.completedAt).not.toBeNull()
    expect(r.progress.xp).toBe(70)
    expect(r.progress.xpLedger.find((e) => e.id === LEGACY_V1_XP_EVENT)?.amount).toBe(30)
  })

  it('повреждённый v1 даёт ошибку, а не исключение', () => {
    const data = JSON.parse(v1Text)
    data.progress.films = 'oops'
    const r = parseImportText(JSON.stringify(data), course)
    expect(r.ok).toBe(false)
  })
})

describe('объединение', () => {
  it('не понижает завершённый фильм до непросмотренного (тест ТЗ №9)', () => {
    const done = richProgress()
    const fresh = createInitialProgress(later)
    const behind = { ...fresh, films: { [f1]: { ...done.films[f1]!, watchStatus: 'not-watched' as const, watchedAt: null, completedAt: null, analysisStatus: 'not-started' as const } } }
    for (const [a, b] of [[done, behind], [behind, done]] as const) {
      const { progress } = mergeProgress(a, b, later)
      expect(progress.films[f1]?.watchStatus).toBe('watched')
      expect(progress.films[f1]?.completedAt).toBe(done.films[f1]?.completedAt)
      expect(progress.films[f1]?.analysisStatus).toBe('completed')
    }
  })

  it('конфликт текста не теряет ни одной версии (тест ТЗ №10)', () => {
    const a = setAnswer(createInitialProgress(T0), f1, 'observation', 'Версия на ноутбуке: длинные тени', T0)
    const b = setAnswer(createInitialProgress(T0), f1, 'observation', 'Версия на телефоне: кривые окна', later)
    const { progress, report } = mergeProgress(a, b, later)
    expect(progress.films[f1]?.answers.observation).toBe('Версия на ноутбуке: длинные тени')
    const copy = progress.notes.find((n) => n.tags.includes(MERGE_CONFLICT_TAG))
    expect(copy?.text).toBe('Версия на телефоне: кривые окна')
    expect(copy?.filmId).toBe(f1)
    expect(report.conflictsPreserved).toBe(1)
    expect(mergeReportLines(report)).toEqual([
      'Дополнено фильмов: 1',
      `1 ответ отличался — в полях осталась текущая версия, версия из файла сохранена заметкой с меткой «${MERGE_CONFLICT_TAG}»`,
    ])
  })

  it('одна заметка, изменённая по-разному, сохраняется в обеих версиях', () => {
    const base = addNote(createInitialProgress(T0), { text: 'Исходный текст', kind: 'free', filmId: f1 }, T0, 'same')
    const a = { ...base, notes: [{ ...base.notes[0]!, text: 'Правка А', updatedAt: T0.toISOString() }] }
    const b = { ...base, notes: [{ ...base.notes[0]!, text: 'Правка Б', updatedAt: later.toISOString() }] }
    const { progress } = mergeProgress(a, b, later)
    const texts = progress.notes.map((n) => n.text).sort()
    expect(texts).toEqual(['Правка А', 'Правка Б'])
    expect(progress.notes.find((n) => n.id === 'same')?.text).toBe('Правка Б')
  })

  it('повторный импорт того же файла ничего не дублирует (XP, ачивки, заметки)', () => {
    const mine = evaluateRewards(course, markWatched(createInitialProgress(T0), course.levels[1]!.films[0]!.id, T0), T0).progress
    const theirs = richProgress()
    const once = mergeProgress(mine, theirs, later).progress
    const twice = mergeProgress(once, theirs, later)
    expect(twice.progress.xp).toBe(once.xp)
    expect(twice.progress.achievements).toEqual(once.achievements)
    expect(twice.progress.notes).toHaveLength(once.notes.length)
    expect(twice.report.notesAdded + twice.report.conflictsPreserved + twice.report.xpEventsAdded).toBe(0)
    expect(mergeReportLines(twice.report).some((l) => l.includes('заметок') || l.includes('опыта'))).toBe(false)
    expect(once.xp).toBe(mine.xp + theirs.xp)
    expect(evaluateRewards(course, once, later).progress.xp).toBe(once.xp)
  })

  it('ачивки объединяются по id с самой ранней датой', () => {
    const a = { ...createInitialProgress(T0), achievements: [{ id: 'first-viewing', unlockedAt: later.toISOString() }] }
    const b = { ...createInitialProgress(T0), achievements: [{ id: 'first-viewing', unlockedAt: T0.toISOString() }] }
    expect(mergeProgress(a, b, later).progress.achievements).toEqual([{ id: 'first-viewing', unlockedAt: T0.toISOString() }])
  })

  it('результат объединения проходит валидацию', () => {
    const { progress } = mergeProgress(richProgress(), richProgress(), later)
    expect(validateProgress(JSON.parse(JSON.stringify(progress))).ok).toBe(true)
  })
})
