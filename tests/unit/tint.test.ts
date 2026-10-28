import { describe, expect, it } from 'vitest'
import { course } from '@/content/course'
import { TINTS, levelTint } from '@/domain/shared/tint'

describe('пастельный оттенок уровня', () => {
  it('идёт по кругу с первого уровня', () => {
    expect(levelTint(1)).toBe('rose')
    expect(levelTint(6)).toBe('lavender')
    expect(levelTint(7)).toBe('rose')
    expect(levelTint(13)).toBe('rose')
  })

  it('у соседних уровней курса оттенки разные', () => {
    const tints = course.levels.map((level) => levelTint(level.number))
    tints.slice(1).forEach((tint, i) => expect(tint).not.toBe(tints[i]))
    expect(new Set(tints)).toEqual(new Set(TINTS))
  })

  it('не ломается на неожиданном номере', () => {
    expect(TINTS).toContain(levelTint(0))
    expect(TINTS).toContain(levelTint(-3))
  })
})
