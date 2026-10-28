/**
 * Точка сборки учебного контента. Каталог фильмов — JSON (редактируется
 * без изменения кода), авторские тексты уроков, уровней и словаря — в TS-файлах
 * рядом, чтобы опечатка в структуре ловилась проверкой типов.
 */
import catalogJson from '@/data/film-course-catalog.json'
import { buildCourse } from '@/domain/catalog/catalog'
import type { CatalogFile } from '@/domain/catalog/catalog.types'
import { glossary } from './glossary'
import { levelContent } from './levels'
import { lessons } from './lessons'

export const catalog = catalogJson as CatalogFile

export const course = buildCourse({ catalog, lessons, levelContent, glossary })
