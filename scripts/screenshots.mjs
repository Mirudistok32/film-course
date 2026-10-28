// Визуальная проверка собранного dist/index.html так, как его открывает пользователь:
// по file:// в Chrome, в обеих темах, на ширине ноутбука и телефона.
// Пишет PNG в .screenshots/ и выводит ошибки консоли и горизонтальный скролл.
//
//   npm run build && npm run shots            — все страницы
//   npm run shots -- film                     — только сценарии, в имени которых есть «film»
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = resolve(ROOT, 'dist/index.html')
const OUT = resolve(ROOT, '.screenshots')
const STORAGE_KEY = 'kino-kak-sposob-myshleniya:progress'
const filter = process.argv[2] ?? ''

if (!existsSync(DIST)) {
  console.error('Нет dist/index.html — сначала npm run build')
  process.exit(1)
}
mkdirSync(OUT, { recursive: true })

const fixture = readFileSync(resolve(ROOT, 'tests/fixtures/progress-v1-example.json'), 'utf8')

/** Фикстура с пройденным первым уровнем и строгим порядком — для карты курса и страницы уровня. */
const advanced = (() => {
  const doc = JSON.parse(fixture)
  doc.progress.levels = {
    'level-01': { completedAt: '2026-10-28T18:00:00.000Z', reflection: 'Монтаж и свет меняют смысл кадра.' },
  }
  doc.progress.settings = { ...doc.progress.settings, sequentialMode: true }
  return JSON.stringify(doc)
})()

/** Пройденный фильм с упражнением, самопроверкой и заметками — для итога и списка заметок. */
const filmDone = (() => {
  const doc = JSON.parse(fixture)
  const film = doc.progress.films['the-cabinet-of-dr-caligari']
  // Формат v1 фикстуры: заметки лежат внутри фильма, мигрируют в общий список при загрузке.
  Object.assign(film, {
    completedAt: '2026-10-28T17:30:00.000Z',
    exerciseCompleted: true,
    revisitLater: true,
    notes: [
      { id: 'n1', kind: 'observation', text: 'Окна и двери — кривые треугольники, ни одной прямой линии.', createdAt: '2026-10-28T16:40:00.000Z', updatedAt: '2026-10-28T16:40:00.000Z' },
      { id: 'n2', kind: 'question', text: 'Чьими глазами мы видим этот город?', createdAt: '2026-10-28T17:40:00.000Z', updatedAt: '2026-10-28T17:40:00.000Z' },
    ],
  })
  return JSON.stringify(doc)
})()

/** Журнал: заметки разных типов, свободная заметка, копия при объединении и мотив (поверх загруженной v2). */
function journalData(p) {
  const note = (id, kind, filmId, text, createdAt, updatedAt = createdAt) => ({ id, kind, filmId, text, createdAt, updatedAt, tags: [] })
  p.notes = [
    note('j1', 'observation', 'the-cabinet-of-dr-caligari', 'Окна и двери — кривые треугольники, ни одной прямой линии.', '2026-10-27T16:40:00.000Z'),
    note('j2', 'free', null, 'Я заметил: в двух фильмах подряд герой смотрит в окно перед решением.\nЭто заставило почувствовать: паузу, вдох перед шагом.\nВозможно, это означает: окно — граница между «думать» и «делать».\nНа это указывает: после окна монтаж всякий раз ускоряется.', '2026-10-28T09:10:00.000Z', '2026-10-28T11:00:00.000Z'),
    note('j3', 'question', 'nosferatu', 'Почему тень поднимается по лестнице раньше, чем мы видим самого героя?', '2026-10-28T12:20:00.000Z'),
    note('j4', 'merge-copy', 'nosferatu', 'Тень на лестнице — страх, который приходит раньше угрозы.', '2026-10-28T12:30:00.000Z'),
  ]
  p.motifs = [
    {
      id: 'm1',
      title: 'Тень раньше человека',
      description: 'Тень появляется в кадре до героя и говорит о нём больше, чем лицо.',
      filmIds: ['the-cabinet-of-dr-caligari', 'nosferatu'],
      createdAt: '2026-10-28T13:00:00.000Z',
      updatedAt: '2026-10-28T13:00:00.000Z',
    },
  ]
}

/** Достижения: заметки и мотив из журнала, несколько учебных дней, личная цель на неделю. */
function achievementsData(p) {
  journalData(p)
  p.activityDays = ['2026-10-12', '2026-10-14', '2026-10-21', '2026-10-27', '2026-10-28']
  p.settings.weeklyGoal = true
}

/** Выпускная работа: все пять шагов заполнены, четыре решения, работа завершена; высший ранг — проверить шапку. */
function graduationData(p) {
  for (const i of [1, 2, 3]) p.xpLedger.push({ id: `legacy:shots-${i}`, amount: 1000, at: '2026-10-28T18:00:00.000Z' })
  p.graduation = {
    subject: 'Три сцены одного фильма: утро в доме, праздник у соседей, возвращение ночью.',
    filmId: 'the-cabinet-of-dr-caligari',
    mainQuestion: 'Почему героиня кажется одинокой даже среди людей?',
    decisions: [
      { observation: 'Её снимают через дверные проёмы, всегда на дальнем плане.', effect: 'Кажется, что мы подглядываем, а она заперта.' },
      { observation: 'На празднике музыка звучит из-за стены, а не в комнате.', effect: 'Веселье слышно, но оно чужое и далёкое.' },
      { observation: 'Ночная сцена идёт одним долгим планом без склеек.', effect: 'Время тянется, выхода из него нет.' },
      { observation: 'В финале впервые крупный план лица.', effect: 'Дистанция исчезает внезапно, становится неловко.' },
    ],
    connections: 'Рамки дверей, звук из-за стены и долгий план работают на одно: дистанцию между героиней и миром, которую фильм снимает только в финале.',
    interpretation: 'Одиночество здесь — не настроение, а устройство пространства и звука: фильм держит нас на расстоянии от героини так же, как её держат люди вокруг. Крупный план в финале ломает это правило — и поэтому ощущается как признание.',
    completedAt: '2026-10-28T18:30:00.000Z',
    updatedAt: '2026-10-28T18:30:00.000Z',
  }
}

/** Главная: фильм начат, но ещё не отмечен просмотренным — подсказки новичку развёрнуты. */
function homeStarted(p) {
  Object.assign(p.films['the-cabinet-of-dr-caligari'], { watchStatus: 'started', watchedAt: null })
}

/** Главная: все уровни пройдены, осталась выпускная; игровые элементы скрыты. */
function homeGraduation(p) {
  for (let i = 1; i <= 13; i++) {
    p.levels[`level-${String(i).padStart(2, '0')}`] = { reflection: 'итог', reflectionUpdatedAt: null, completedAt: '2026-10-28T18:00:00.000Z' }
  }
  p.settings.showGamification = false
}

/**
 * Страницы: hash — адрес, seed — подложить прогресс из фикстуры, raw — подложить сырые данные,
 * mutate — поправить прогресс после загрузки (уже в формате v2),
 * click — нажать по порядку первые видимые кнопки/summary с этим текстом (раскрыть спойлер, открыть диалог),
 * upload — выбрать файл в поле импорта (до нажатий из click),
 * viewportOnly — снять только окно, а не всю страницу (проверить прокрутку к блоку).
 */
const PAGES = [
  { name: 'home-empty', hash: '' },
  { name: 'home-progress', hash: '', seed: true },
  { name: 'home-started', hash: '', seed: true, mutate: homeStarted },
  { name: 'home-graduation', hash: '', seed: true, mutate: homeGraduation },
  { name: 'course', hash: '#/course', seed: true },
  { name: 'course-strict', hash: '#/course', raw: advanced },
  { name: 'level', hash: '#/course/level-01', seed: true },
  { name: 'level-done', hash: '#/course/level-01', raw: advanced },
  { name: 'level-locked', hash: '#/course/level-03', raw: advanced },
  { name: 'film', hash: '#/film/the-cabinet-of-dr-caligari', seed: true },
  { name: 'film-before', hash: '#/film/alexander-nevsky' },
  { name: 'film-during', hash: '#/film/alexander-nevsky?step=during' },
  { name: 'film-done', hash: '#/film/the-cabinet-of-dr-caligari', raw: filmDone, click: ['Посмотреть пример разбора'] },
  // Липкая полоса урока: переход к заметкам из полосы (снимок окна, после плавной прокрутки).
  { name: 'film-stuck', hash: '#/film/the-cabinet-of-dr-caligari', raw: filmDone, click: ['Заметки'], viewportOnly: true, settle: 900 },
  { name: 'film-dialog', hash: '#/film/the-cabinet-of-dr-caligari', raw: filmDone, click: ['Удалить'], mobileOnly: true },
  { name: 'journal', hash: '#/journal', seed: true, mutate: journalData },
  { name: 'journal-empty', hash: '#/journal' },
  { name: 'journal-film', hash: '#/journal?film=nosferatu', seed: true, mutate: journalData },
  { name: 'journal-new', hash: '#/journal', seed: true, mutate: journalData, click: ['Новая заметка'] },
  { name: 'journal-edit', hash: '#/journal', seed: true, mutate: journalData, click: ['Изменить'], mobileOnly: true },
  { name: 'journal-motifs', hash: '#/journal?tab=motifs', seed: true, mutate: journalData },
  { name: 'glossary', hash: '#/glossary', click: ['Пример касается финала'] },
  { name: 'glossary-term', hash: '#/glossary?term=montage', viewportOnly: true },
  { name: 'glossary-level', hash: '#/glossary?level=level-03', click: ['Ещё'] },
  { name: 'achievements', hash: '#/achievements', seed: true },
  { name: 'achievements-rich', hash: '#/achievements', raw: filmDone, mutate: achievementsData },
  { name: 'achievements-hidden', hash: '#/achievements', seed: true, mutate: (p) => (p.settings.showGamification = false) },
  { name: 'data', hash: '#/settings/data', seed: true },
  { name: 'data-empty', hash: '#/settings/data' },
  { name: 'data-import', hash: '#/settings/data', seed: true, mutate: journalData, upload: { name: 'progress-v1.json', text: fixture } },
  { name: 'data-import-error', hash: '#/settings/data', seed: true, upload: { name: 'notes.json', text: '{"format":"other-app","schemaVersion":1}' } },
  { name: 'data-merged', hash: '#/settings/data', raw: filmDone, upload: { name: 'progress-v1.json', text: fixture }, click: ['Объединить с текущим'] },
  { name: 'data-reset', hash: '#/settings/data', seed: true, click: ['Сбросить прогресс'], mobileOnly: true },
  { name: 'data-corrupted', hash: '#/settings/data', raw: '{"format":"kino' },
  { name: 'graduation', hash: '#/graduation', seed: true },
  { name: 'graduation-done', hash: '#/graduation', seed: true, mutate: graduationData },
  { name: 'graduation-locked', hash: '#/graduation', raw: advanced },
  { name: 'not-found', hash: '#/nope' },
  { name: 'corrupted', hash: '', raw: '{"format":"kino' },
  { name: 'menu', hash: '', menu: true, mobileOnly: true },
]
const VIEWS = [
  { name: 'light-desktop', scheme: 'light', width: 1280, height: 900 },
  { name: 'dark-mobile', scheme: 'dark', width: 390, height: 844, mobile: true },
]

const url = `file://${DIST}`
const problems = []
const browser = await chromium.launch({ channel: 'chrome' })
let count = 0

for (const view of VIEWS) {
  for (const page of PAGES) {
    const name = `${page.name}--${view.name}`
    if (filter && !name.includes(filter)) continue
    if (page.mobileOnly && !view.mobile) continue
    const ctx = await browser.newContext({
      viewport: { width: view.width, height: view.height },
      colorScheme: view.scheme,
    })
    const tab = await ctx.newPage()
    tab.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') problems.push(`${name}: [${m.type()}] ${m.text()}`)
    })
    tab.on('pageerror', (e) => problems.push(`${name}: [pageerror] ${e.message}`))

    await tab.goto(url)
    if (page.seed || page.raw) {
      await tab.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, page.raw ?? fixture])
      // Перечитать данные до перехода: страница фильма при открытии сохраняет прогресс
      // и иначе записала бы поверх подложенного пустое состояние из памяти.
      await tab.reload()
    }
    if (page.mutate) {
      await tab.waitForTimeout(100)
      const doc = JSON.parse(await tab.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))
      page.mutate(doc.progress)
      await tab.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, JSON.stringify(doc)])
      await tab.reload()
    }
    await tab.goto(url + page.hash)
    await tab.reload()
    await tab.waitForTimeout(300)
    if (page.menu) await tab.getByRole('button', { name: 'Меню' }).click()
    if (page.upload) {
      await tab.locator('input[type=file]').setInputFiles({
        name: page.upload.name,
        mimeType: 'application/json',
        buffer: Buffer.from(page.upload.text),
      })
      await tab.waitForTimeout(300)
    }
    for (const text of page.click ?? []) {
      await tab.locator(':is(button, summary, a):visible', { hasText: text }).first().click()
      await tab.waitForTimeout(200)
    }
    if (page.settle) await tab.waitForTimeout(page.settle)

    if (await tab.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
      problems.push(`${name}: горизонтальная прокрутка`)
    }
    await tab.screenshot({ path: resolve(OUT, `${name}.png`), fullPage: !page.viewportOnly })
    count++
    await ctx.close()
  }
}
await browser.close()

console.log(`Скриншотов: ${count} → ${OUT}`)
console.log('Полностраничный снимок показывает «шов» фона на высоте окна — это фиксированное зерно, не ошибка.')
if (problems.length) {
  console.log(`Проблемы (${problems.length}):\n${problems.join('\n')}`)
  process.exit(1)
}
console.log('Ошибок консоли и горизонтальной прокрутки нет.')
