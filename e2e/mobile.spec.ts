import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, fixture, open, seed, trackErrors } from './helpers'

const PAGES = ['/', '/course', '/course/level-01', '/film/nosferatu', '/journal', '/glossary', '/achievements', '/settings/data', '/graduation']

test('страницы без горизонтальной прокрутки и ошибок консоли', async ({ page }) => {
  const errors = trackErrors(page)
  await seed(page, fixture)
  for (const path of PAGES) {
    await open(page, path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHorizontalScroll(page)
  }
  expect(errors).toEqual([])
})

test('меню на телефоне открывает разделы', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Кнопка меню есть только на узком экране')
  await open(page)
  const menu = page.getByRole('button', { name: 'Меню' })
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await menu.click()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('navigation', { name: 'Разделы сайта' }).getByRole('link', { name: 'Журнал' }).click()
  await expect(page).toHaveURL(/#\/journal/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('карта курса на телефоне: ролик уровней и свёрнутая цель', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Ролик и свёрнутая цель — только на узком экране')
  const errors = trackErrors(page)
  await open(page, '/course')
  const reel = page.getByRole('navigation', { name: 'Быстрый переход к уровню' })
  await expect(reel.getByRole('button')).toHaveCount(13)
  await expect(reel.getByRole('button', { name: /^Уровень 1:/ })).toHaveAttribute('aria-current', 'step')

  // Переход с клавиатуры: фокус на кнопке ролика, Enter — к кадру уровня, фокус на его ссылке.
  await reel.getByRole('button', { name: /^Уровень 9:/ }).focus()
  await page.keyboard.press('Enter')
  const link = page.getByRole('link', { name: 'Жанр, ожидание и напряжение', exact: true })
  await expect(link).toBeFocused()
  await expect(link).toBeInViewport()

  const more = page.getByRole('button', { name: 'Подробнее о цели уровня 9' })
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await more.click()
  await expect(page.getByRole('button', { name: 'Свернуть о цели уровня 9' })).toHaveAttribute('aria-expanded', 'true')
  await expect(page).toHaveURL(/#\/course$/)
  expect(errors).toEqual([])
})
