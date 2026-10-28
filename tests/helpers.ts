import catalogJson from '@/data/film-course-catalog.json'
import { buildCourse } from '@/domain/catalog/catalog'
import type { CatalogFile, ExerciseTag, FilmLesson, LevelContent } from '@/domain/catalog/catalog.types'
import type { Course } from '@/domain/catalog/catalog.types'

export const catalog = catalogJson as CatalogFile

const TAG_BY_LEVEL: Record<string, ExerciseTag> = {
  'level-03': 'composition',
  'level-04': 'montage',
  'level-06': 'sound',
  'level-10': 'metaphor',
}

/** Курс из настоящего каталога с заглушками уроков — тесты логики не зависят от текстов. */
export function makeTestCourse(): Course {
  const lessons: Record<string, FilmLesson> = {}
  const levelContent: Record<string, LevelContent> = {}
  for (const level of catalog.levels) {
    levelContent[level.id] = {
      lecture: { principle: 'p', examples: [{ title: 'a', text: 'a' }, { title: 'b', text: 'b' }] },
      outcome: 'o',
      reflectionPrompt: 'r',
    }
    for (const film of level.films) {
      lessons[film.id] = {
        why: 'w',
        startQuestion: 'q',
        lookFor: ['a', 'b'],
        duringCues: ['a', 'b'],
        afterQuestions: { observation: 'o', effect: 'e', interpretation: 'i' },
        exercise: { title: 't', task: 't', lookAt: 'l', steps: ['1', '2'], tags: [TAG_BY_LEVEL[level.id] ?? 'synthesis'] },
        samples: [{ title: 's', text: 's' }],
        terms: [],
      }
    }
  }
  return buildCourse({ catalog, lessons, levelContent, glossary: [] })
}

export const T0 = new Date('2026-10-28T10:00:00.000Z')

/** Часы, которые сдвигаются на минуту при каждом вызове. */
export function tickingClock(start = T0) {
  let t = start.getTime()
  return () => {
    t += 60_000
    return new Date(t)
  }
}

export const LONG = 'Наклонные стены и резкие тени повторяются в кадре'
