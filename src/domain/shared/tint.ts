/**
 * Пастельный оттенок уровня. Соседние уровни всегда разного цвета: оттенки
 * идут по кругу. В разметке — атрибут `data-tint`, цвета — `--tint-*` в tokens.css.
 */
export const TINTS = ['rose', 'peach', 'butter', 'mint', 'sky', 'lavender'] as const

export type Tint = (typeof TINTS)[number]

export function levelTint(levelNumber: number): Tint {
  const index = (((levelNumber - 1) % TINTS.length) + TINTS.length) % TINTS.length
  return TINTS[index]!
}
