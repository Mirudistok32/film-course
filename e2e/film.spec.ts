import { expect, test } from '@playwright/test'
import { open, stored, trackErrors } from './helpers'

const FILM = 'the-cabinet-of-dr-caligari'

test('прохождение фильма с нуля переживает перезагрузку', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page, `/film/${FILM}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Кабинет доктора Калигари')

  // Перед просмотром → во время → после.
  await page.getByRole('button', { name: 'Начинаю смотреть' }).first().click()
  await expect(page.getByRole('tab', { name: /Во время/ })).toHaveAttribute('aria-selected', 'true')
  // Отметка просмотра сама переводит на шаг «после просмотра».
  await page.getByRole('button', { name: 'Досмотрел — отметить просмотр' }).click()
  await expect(page).toHaveURL(/step=after/)

  const done = page.getByRole('button', { name: 'Отметить фильм пройденным' })
  await expect(done).toBeDisabled()

  const observation = 'Окна и двери — кривые треугольники, ни одной прямой линии.'
  await page.getByLabel('Я заметил…').fill(observation)
  await page.getByLabel('Ваш ответ', { exact: true }).fill('Декорации нарисованы: тени и свет написаны краской прямо на стенах.')
  await page.getByRole('button', { name: 'Упражнение выполнено' }).click()
  await expect(page.getByText(/Упражнение выполнено \d/)).toBeVisible()

  await expect(done).toBeEnabled()
  await done.click()
  await expect(page.getByText('Фильм пройден', { exact: true })).toBeVisible()

  // Набор текста сохраняется с задержкой — дождаться записи и перезагрузить.
  await expect.poll(async () => (await stored(page))?.progress.films[FILM]?.answers?.observation).toBe(observation)
  await page.reload()

  await expect(page.getByText('Фильм пройден', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Я заметил…')).toHaveValue(observation)
  await expect(page.getByText(/Упражнение выполнено \d/)).toBeVisible()
  expect(errors).toEqual([])
})

test('шаг урока хранится в адресе', async ({ page }) => {
  await open(page, `/film/${FILM}?step=during`)
  await expect(page.getByRole('heading', { name: 'Ориентиры на время просмотра' })).toBeVisible()
  await page.getByRole('tab', { name: /После просмотра/ }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Вопросы после просмотра' })).toBeVisible()
})

test('липкая полоса урока: переходы к разделам и отметка «вы здесь»', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page, `/film/${FILM}`)
  const bar = page.getByRole('navigation', { name: 'Разделы страницы фильма' })

  // Упражнение лежит в шаге «После просмотра»: переход сначала открывает шаг.
  await bar.getByRole('button', { name: 'Упражнение' }).click()
  await expect(page).toHaveURL(/step=after/)
  await expect(page.getByText('Основное упражнение', { exact: true })).toBeInViewport()

  await bar.getByRole('button', { name: 'Заметки' }).click()
  const notes = page.getByRole('heading', { name: 'Заметки к фильму' })
  // Дождаться конца плавной прокрутки: заголовок замирает у верха окна.
  await expect.poll(async () => (await notes.boundingBox())!.y).toBeLessThan(160)
  await expect(bar.getByRole('button', { name: 'Заметки' })).toHaveAttribute('aria-current', 'step')

  // Полоса прилипла к верху окна, низкая и не закрывает заголовок раздела.
  const box = (await page.locator('.stage-nav').boundingBox())!
  expect(box.y).toBeLessThanOrEqual(0)
  expect(box.height).toBeLessThanOrEqual(48)
  expect((await notes.boundingBox())!.y).toBeGreaterThanOrEqual(box.y + box.height)

  // Шаг, переключённый снизу, показывается с начала.
  await page.getByRole('tab', { name: /Перед просмотром/ }).click()
  await expect(page.getByRole('heading', { name: 'Короткая настройка внимания' })).toBeInViewport()
  await expect(page.getByRole('tab', { name: /Перед просмотром/ })).toBeFocused()

  // Стрелки переключают шаг, фокус остаётся на вкладке (смена ?step= — не переход на другую страницу).
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/step=during/)
  await expect(page.getByRole('tab', { name: /Во время/ })).toBeFocused()
  expect(errors).toEqual([])
})

test('статусы на карте уровня и недоступная кнопка упражнения', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page, '/course/level-01')
  const card = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Кабинет доктора Калигари', exact: true }) })
  // «Не смотрел» не показывается на карточке, но остаётся словами для скринридера.
  await expect(card.getByText('Не смотрел')).toHaveClass(/visually-hidden/)

  await card.getByRole('link', { name: 'Кабинет доктора Калигари', exact: true }).click()
  await page.getByRole('button', { name: 'Начинаю смотреть' }).first().click()
  await page.getByRole('button', { name: 'Досмотрел — отметить просмотр' }).click()
  const exercise = page.getByRole('button', { name: 'Упражнение выполнено' })
  await expect(exercise).toBeDisabled()
  await expect(exercise).toHaveCSS('border-top-style', 'dashed')
  await expect(page.locator('#exercise-hint')).toContainText('Кнопка станет доступна')

  await open(page, '/course/level-01')
  await expect(card.getByText('Посмотрел')).toBeVisible()
  expect(errors).toEqual([])
})
