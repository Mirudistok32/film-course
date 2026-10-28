import { describe, expect, it } from 'vitest'
import { catalog, course } from '@/content/course'
import { glossary } from '@/content/glossary'
import { lessons } from '@/content/lessons'
import { levelContent } from '@/content/levels'
import { validateCatalog } from '@/domain/catalog/catalog.validate'
import { REQUIRED_EXERCISE_TAGS } from '@/domain/rewards/rewards.config'

describe('учебный каталог', () => {
  it('каталог, уроки, лекции и словарь согласованы', () => {
    const errors = validateCatalog({
      catalog,
      lessons,
      levelContent,
      glossary,
      requiredTags: REQUIRED_EXERCISE_TAGS,
    })
    expect(errors).toEqual([])
  })

  it('у каждого фильма курса есть урок', () => {
    expect(course.films).toHaveLength(100)
    expect(course.films.filter((f) => !f.lesson).map((f) => f.id)).toEqual([])
  })

  it('стартовые вопросы уроков не повторяются', () => {
    const questions = Object.values(lessons).map((l) => l.startQuestion)
    expect(new Set(questions).size).toBe(questions.length)
  })
})
