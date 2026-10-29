// Контраст текста по WCAG 2.x (ТЗ §34: не ниже AA).
//
//   node scripts/contrast.mjs        — таблица пар «текст/фон» из токенов для обеих тем
//
// Пары токенов проверяет и юнит-тест (tests/unit/contrast.test.ts), а auditPage
// вызывает npm run shots на каждой странице: так находятся и сочетания, которых
// нет в таблице (цвет уровня поверх градиента карточки, полупрозрачные слои).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Порог AA: обычный текст — 4.5, крупный (от 24px или от 18.66px жирным) — 3. */
export const AA = 4.5
export const AA_LARGE = 3

/** '#rgb' | '#rrggbb' | 'rgb(r g b / a)' → [r, g, b, a], r/g/b в 0…255. */
export function parseColor(value) {
  const v = value.trim()
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1]
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).concat(1)
  }
  const rgb = v.match(/^rgba?\(([^)]+)\)$/i)?.[1]
  if (rgb) {
    const [r, g, b, a = '1'] = rgb.split(/[\s,/]+/).filter(Boolean)
    return [Number(r), Number(g), Number(b), a.endsWith('%') ? parseFloat(a) / 100 : Number(a)]
  }
  throw new Error(`Не цвет: ${value}`)
}

/** color-mix(in srgb, a p%, b) и наложение полупрозрачного цвета на непрозрачный. */
export function mix(a, b, share) {
  return [0, 1, 2].map((i) => a[i] * share + b[i] * (1 - share)).concat(1)
}
export function over(top, bottom) {
  return mix(top, bottom, top[3] ?? 1)
}

function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export function ratio(fg, bg) {
  const [l1, l2] = [luminance(over(fg, bg)), luminance(bg)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Переменные одного блока tokens.css: { '--ink': '#2b2230', … }. */
export function readBlock(css, selector) {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`Нет блока ${selector}`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

/** Токены обеих тем; тёмная — светлая с переопределениями «кинозала». */
export function readThemes(css) {
  const light = readBlock(css, ':root {')
  return { light, dark: { ...light, ...readBlock(css, ":root[data-theme='dark']") } }
}

const LEVEL_TINTS = ['rose', 'peach', 'butter', 'mint', 'sky', 'lavender']

/**
 * Пары «текст/фон», на которых держится интерфейс. Заливка уровня — как в base.css:
 * --tint = color-mix(--tint-*-ink --tint-lift, --tint-*).
 */
export function tokenPairs(theme) {
  const c = (name) => parseColor(theme[name])
  const surfaces = { бумага: c('--paper'), карточка: c('--paper-raised'), углубление: c('--paper-sunken') }
  const pairs = []
  for (const [bgName, bg] of Object.entries(surfaces)) {
    for (const fg of ['--ink', '--ink-soft', '--ink-faint', '--accent', '--moss', '--gold']) {
      pairs.push({ fg, bg: bgName, ratio: ratio(c(fg), bg) })
    }
  }
  const lift = parseFloat(theme['--tint-lift'] ?? '0') / 100
  for (const tint of LEVEL_TINTS) {
    const ink = c(`--tint-${tint}-ink`)
    const fill = mix(ink, c(`--tint-${tint}`), lift)
    pairs.push({ fg: `--tint-${tint}-ink`, bg: `заливка ${tint}`, ratio: ratio(ink, fill) })
    pairs.push({ fg: '--ink-soft', bg: `заливка ${tint}`, ratio: ratio(c('--ink-soft'), fill) })
    pairs.push({ fg: '--moss', bg: `заливка ${tint}`, ratio: ratio(c('--moss'), fill) })
    pairs.push({ fg: `--tint-${tint}-ink`, bg: 'карточка', ratio: ratio(ink, c('--paper-raised')) })
  }
  const card = c('--paper-raised')
  pairs.push({ fg: '--moss', bg: 'плашка мха', ratio: ratio(c('--moss'), over(c('--moss-wash'), card)) })
  pairs.push({ fg: '--accent', bg: 'плашка киновари', ratio: ratio(c('--accent'), over(c('--accent-wash'), card)) })
  pairs.push({ fg: '--accent-ink', bg: 'кнопка', ratio: ratio(c('--accent-ink'), c('--accent')) })
  pairs.push({ fg: '--intertitle-ink', bg: 'интертитр', ratio: ratio(c('--intertitle-ink'), c('--intertitle-bg')) })
  return pairs
}

/**
 * Проверка в браузере (page.evaluate): каждый видимый элемент с текстом против фона,
 * собранного из фонов предков. У градиента берётся худшая точка. Текст поверх
 * иллюстраций (абсолютное позиционирование, SVG) так не проверить — их смотреть глазами.
 * Функция самодостаточна: Playwright передаёт в страницу только её исходник.
 */
export function auditPage() {
  const AA = 4.5
  const AA_LARGE = 3
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const cache = new Map()
  // Любой CSS-цвет (rgb, color(srgb …), oklab) → [r, g, b, a] через пиксель холста.
  const rgba = (css) => {
    if (!cache.has(css)) {
      probe.clearRect(0, 0, 1, 1)
      probe.fillStyle = css
      probe.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
      cache.set(css, [r, g, b, a / 255])
    }
    return cache.get(css)
  }
  const over = (t, b) => [0, 1, 2].map((i) => t[i] * t[3] + b[i] * (1 - t[3])).concat(1)
  const lum = ([r, g, b]) => {
    const [R, G, B] = [r, g, b].map((v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * R + 0.7152 * G + 0.0722 * B
  }
  const ratio = (fg, bg) => {
    const [a, b] = [lum(over(fg, bg)), lum(bg)].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  }
  const hex = (c) =>
    '#' +
    c
      .slice(0, 3)
      .map((v) => Math.round(v).toString(16).padStart(2, '0'))
      .join('')
  const COLOR = /(?:rgba?|color|oklab|oklch)\([^()]*\)/g

  // Варианты фона под элементом: слои предков сверху вниз до первого непрозрачного.
  const backgrounds = (el) => {
    const layers = []
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node)
      const stops = s.backgroundImage.includes('gradient') ? (s.backgroundImage.match(COLOR) ?? []).map(rgba) : []
      const color = rgba(s.backgroundColor)
      if (stops.length || color[3] > 0) layers.push({ stops, color })
      if (color[3] === 1 || (stops.length && stops.every((x) => x[3] === 1))) break
    }
    let options = [rgba(getComputedStyle(document.body).backgroundColor)]
    for (const { stops, color } of layers.reverse()) {
      const base = color[3] > 0 ? options.map((b) => over(color, b)) : options
      options = stops.length ? stops.flatMap((st) => base.map((b) => over(st, b))) : base
    }
    return options
  }

  const hidden = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const s = getComputedStyle(node)
      if (s.visibility === 'hidden' || s.display === 'none' || s.clip === 'rect(0px, 0px, 0px, 0px)') return true
      if (node.matches('.visually-hidden, [aria-hidden="true"], svg')) return true
    }
    return !el.getClientRects().length
  }

  const found = []
  for (const el of document.body.querySelectorAll('*')) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join('')
      .trim()
    if (!text || hidden(el)) continue
    const s = getComputedStyle(el)
    const fg = rgba(s.color)
    let alpha = fg[3]
    for (let node = el; node; node = node.parentElement) alpha *= Number(getComputedStyle(node).opacity)
    const size = parseFloat(s.fontSize)
    const need = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700) ? AA_LARGE : AA
    const color = [fg[0], fg[1], fg[2], alpha]
    const [worst, bg] = backgrounds(el)
      .map((b) => [ratio(color, b), b])
      .reduce((a, b) => (b[0] < a[0] ? b : a))
    if (worst < need) {
      found.push({
        text: text.slice(0, 40),
        cls: el.className?.baseVal ?? el.className,
        tag: el.tagName.toLowerCase(),
        ratio: +worst.toFixed(2),
        need,
        colors: `${hex(over(color, bg))} на ${hex(bg)}`,
      })
    }
  }
  return found
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = readFileSync(resolve(import.meta.dirname, '../src/styles/tokens.css'), 'utf8')
  let failed = 0
  for (const [name, theme] of Object.entries(readThemes(css))) {
    console.log(`\n${name === 'light' ? 'Пергамент' : 'Кинозал'}`)
    for (const p of tokenPairs(theme)) {
      const ok = p.ratio >= AA
      if (!ok) failed++
      console.log(`${ok ? '  ' : '✗ '}${p.fg.padEnd(22)} на ${p.bg.padEnd(18)} ${p.ratio.toFixed(2)}`)
    }
  }
  console.log(failed ? `\nНиже AA (4.5): ${failed}` : '\nВсе пары не ниже AA (4.5).')
  process.exit(failed ? 1 : 0)
}
