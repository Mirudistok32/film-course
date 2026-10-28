import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { chooseImportFile, fixture, open, seed, STORAGE_KEY, stored, trackErrors } from './helpers'

test('экспорт → сброс → импорт возвращает прогресс', async ({ page }) => {
  const errors = trackErrors(page)
  await seed(page, fixture, '/settings/data')
  const before = (await stored(page)).progress

  // Экспорт.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Скачать резервную копию' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.json$/)
  const backup = readFileSync(await file.path(), 'utf8')
  expect(JSON.parse(backup).progress.films).toEqual(before.films)

  // Сброс с подтверждением.
  await page.getByRole('button', { name: 'Сбросить прогресс' }).click()
  const dialog = page.getByRole('dialog', { name: 'Сбросить весь прогресс?' })
  await dialog.getByRole('button', { name: 'Сбросить', exact: true }).click()
  await expect(page.getByText('Прогресса пока нет — сбрасывать нечего.')).toBeVisible()
  expect((await stored(page))?.progress.films ?? {}).toEqual({})

  // Импорт: предпросмотр → замена (прогресса нет, подтверждение не нужно).
  await chooseImportFile(page, file.suggestedFilename(), backup)
  await expect(page.getByRole('heading', { name: /Что в файле/ })).toBeVisible()
  await page.getByRole('button', { name: 'Заменить текущий прогресс' }).click()
  await expect.poll(async () => (await stored(page))?.progress.films).toEqual(before.films)

  await page.reload()
  await expect(page.getByText('Прогресса пока нет — сбрасывать нечего.')).toBeHidden()
  expect(errors).toEqual([])
})

test('повреждённый файл не меняет прогресс', async ({ page }) => {
  await seed(page, fixture, '/settings/data')
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)

  await chooseImportFile(page, 'broken.json', '{"format":"kino')
  await expect(page.getByRole('heading', { name: 'Файл «broken.json» не подошёл' })).toBeVisible()
  await expect(page.getByText('Текущий прогресс не изменён.')).toBeVisible()

  await chooseImportFile(page, 'other.json', '{"format":"other-app","schemaVersion":1}')
  await expect(page.getByRole('heading', { name: 'Файл «other.json» не подошёл' })).toBeVisible()

  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before)
})

test('повреждённые данные в браузере не перезаписываются молча', async ({ page }) => {
  const broken = '{"format":"kino'
  await seed(page, broken)
  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(alert.getByRole('button', { name: 'Скачать данные как есть' })).toBeVisible()

  // Переход по страницам и открытие фильма не затирают нечитаемые данные.
  await open(page, '/film/nosferatu')
  await page.reload()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(broken)
})
