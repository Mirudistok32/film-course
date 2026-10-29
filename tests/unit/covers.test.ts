import { describe, expect, it } from 'vitest'
import { course } from '@/content/course'
import { COVER_MOTIFS, drawCover, pickMotif } from '@/illustrations/covers'

const coverOf = (film: { id: string; levelNumber: number; order: number }) =>
  drawCover({ seed: film.id, levelNumber: film.levelNumber, order: film.order })

describe('обложки фильмов', () => {
  it('один фильм — всегда один и тот же рисунок', () => {
    for (const film of course.films.slice(0, 12)) {
      expect(coverOf(film)).toEqual(coverOf(film))
    }
  })

  it('у разных фильмов разные рисунки', () => {
    const drawings = new Set(course.films.map((film) => JSON.stringify(coverOf(film).layers)))
    expect(drawings.size).toBe(course.films.length)
  })

  it('соседние фильмы уровня — с разными мотивами, в уровне не меньше шести мотивов подряд', () => {
    for (const level of course.levels) {
      const motifs = level.films.map((film) => pickMotif(film.levelNumber, film.order))
      motifs.slice(1).forEach((motif, i) => expect(motif).not.toBe(motifs[i]))
      expect(new Set(motifs.slice(0, COVER_MOTIFS.length)).size).toBe(Math.min(motifs.length, COVER_MOTIFS.length))
    }
  })

  it('все мотивы встречаются в курсе', () => {
    const used = new Set(course.films.map((film) => coverOf(film).motif))
    expect(used).toEqual(new Set(COVER_MOTIFS))
  })

  it('пути без NaN и Infinity', () => {
    for (const film of course.films) {
      for (const layer of coverOf(film).layers) {
        expect(layer.d).toMatch(/^M/)
        expect(layer.d).not.toMatch(/NaN|Infinity/)
      }
    }
  })
})
