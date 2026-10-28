import type { FilmLesson } from '@/domain/catalog/catalog.types'
import { lessons as l01 } from './level-01'
import { lessons as l02 } from './level-02'
import { lessons as l03 } from './level-03'
import { lessons as l04 } from './level-04'
import { lessons as l05 } from './level-05'
import { lessons as l06 } from './level-06'
import { lessons as l07 } from './level-07'
import { lessons as l08 } from './level-08'
import { lessons as l09 } from './level-09'
import { lessons as l10 } from './level-10'
import { lessons as l11 } from './level-11'
import { lessons as l12 } from './level-12'
import { lessons as l13 } from './level-13'

export const lessons: Record<string, FilmLesson> = {
  ...l01,
  ...l02,
  ...l03,
  ...l04,
  ...l05,
  ...l06,
  ...l07,
  ...l08,
  ...l09,
  ...l10,
  ...l11,
  ...l12,
  ...l13,
}
