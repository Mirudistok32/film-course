import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AA, parseColor, ratio, readBlock, readThemes, tokenPairs } from '../../scripts/contrast.mjs'

const css = readFileSync(resolve(import.meta.dirname, '../../src/styles/tokens.css'), 'utf8')

describe('контраст по WCAG', () => {
  it('считает известные пары', () => {
    expect(ratio(parseColor('#000'), parseColor('#fff'))).toBeCloseTo(21, 5)
    expect(ratio(parseColor('#fff'), parseColor('#fff'))).toBe(1)
    // Классическая граница: #767676 на белом — 4.54, #777 — уже 4.48.
    expect(ratio(parseColor('#767676'), parseColor('#ffffff'))).toBeGreaterThan(AA)
    expect(ratio(parseColor('#777777'), parseColor('#ffffff'))).toBeLessThan(AA)
  })

  it('не зависит от порядка и учитывает прозрачность текста', () => {
    const a = parseColor('#2b2230')
    const b = parseColor('#f7f0e6')
    expect(ratio(a, b)).toBeCloseTo(ratio(b, a), 5)
    expect(ratio(parseColor('rgb(0 0 0 / 0.5)'), parseColor('#fff'))).toBeLessThan(ratio(a, b))
  })

  it('читает hex и rgb', () => {
    expect(parseColor('#abc')).toEqual([170, 187, 204, 1])
    expect(parseColor('rgb(154 46 28 / 0.09)')).toEqual([154, 46, 28, 0.09])
    expect(parseColor('rgba(1, 2, 3, 50%)')).toEqual([1, 2, 3, 0.5])
    expect(() => parseColor('var(--ink)')).toThrow()
  })
})

describe('токены тем', () => {
  const themes = readThemes(css)

  it.each(Object.keys(themes))('пары «текст/фон» темы %s не ниже AA', (name) => {
    const low = tokenPairs(themes[name as keyof typeof themes]).filter((p) => p.ratio < AA)
    expect(low).toEqual([])
  })

  it('системный и явный «кинозал» совпадают', () => {
    const system = readBlock(css, ":root:not([data-theme='light'])")
    const explicit = readBlock(css, ":root[data-theme='dark']")
    expect(system).toEqual(explicit)
  })
})
