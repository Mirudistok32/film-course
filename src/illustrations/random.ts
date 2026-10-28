/**
 * Детерминированный генератор случайных чисел: один и тот же сид всегда
 * даёт один и тот же рисунок, поэтому дерево у фильма не меняется между визитами.
 */

/** Строку — в 32-битный сид (FNV-1a). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export interface Rng {
  /** [0, 1) */
  next(): number
  /** [min, max) */
  range(min: number, max: number): number
  /** Вероятность p — true. */
  chance(p: number): boolean
}

/** mulberry32 — короткий и достаточно ровный для иллюстраций. */
export function createRng(seed: number | string): Rng {
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    chance: (p) => next() < p,
  }
}

/** Округление координат: короче path и стабильнее снапшоты. */
export const r1 = (n: number) => Math.round(n * 10) / 10
