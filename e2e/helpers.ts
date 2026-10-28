import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, type Page } from '@playwright/test'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = resolve(ROOT, 'dist/index.html')

export const STORAGE_KEY = 'kino-kak-sposob-myshleniya:progress'
export const fixture = readFileSync(resolve(ROOT, 'tests/fixtures/progress-v1-example.json'), 'utf8')

/** Ошибки консоли и страницы за время теста — в конце теста их не должно быть. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

/** Открыть страницу сайта по адресу после # (например, '/film/nosferatu'). */
export async function open(page: Page, path = '/') {
  if (!existsSync(DIST)) throw new Error('Нет dist/index.html — сначала npm run build')
  await page.goto(`file://${DIST}#${path}`)
}

/**
 * Подложить сохранённые данные и перечитать их. Сначала открывается главная:
 * страница фильма при открытии сохраняет прогресс и записала бы поверх пустое состояние.
 */
export async function seed(page: Page, raw: string, path = '/') {
  await open(page)
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, raw])
  await page.reload()
  await open(page, path)
  await page.reload()
}

/** Прочитать сохранённый документ прогресса из localStorage. */
export async function stored(page: Page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

/** Выбрать файл в скрытом поле импорта на странице «Данные». */
export async function chooseImportFile(page: Page, name: string, text: string | Buffer) {
  await page.locator('input[type=file]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: typeof text === 'string' ? Buffer.from(text) : text,
  })
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'горизонтальная прокрутка').toBeLessThanOrEqual(0)
}
