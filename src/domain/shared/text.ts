/** Минимальная длина «осмысленного» текста (без учёта лишних пробелов). */
export const MEANINGFUL_TEXT_MIN = 20

export function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

/** Строка для поиска: регистр и «ё» не важны. */
export function searchable(text: string): string {
  return normalizeText(text).toLowerCase().replace(/ё/g, 'е')
}

/** Каждое слово запроса встречается в тексте, уже приведённом через searchable. */
export function containsWords(text: string, query: string): boolean {
  return searchable(query)
    .split(' ')
    .filter(Boolean)
    .every((w) => text.includes(w))
}

export function isMeaningful(text: string | null | undefined, min = MEANINGFUL_TEXT_MIN): boolean {
  return normalizeText(text).length >= min
}

/**
 * Основы слов, по которым видно, что запись говорит о форме фильма,
 * а не только о сюжете. Эвристика для ачивки «Не только сюжет».
 */
const FORMAL_STEMS = [
  'кадр',
  'план',
  'монтаж',
  'склейк',
  'камер',
  'ракурс',
  'композиц',
  'мизансцен',
  'свет',
  'тен',
  'цвет',
  'палитр',
  'звук',
  'музык',
  'тишин',
  'шум',
  'ритм',
  'длительн',
  'панорам',
  'наезд',
  'крупн',
  'глубин',
  'фокус',
  'силуэт',
  'симметри',
  'рамк',
  'затемнени',
  'наплыв',
  'контраст',
  'декорац',
  'объектив',
  'ракурс',
  'перспектив',
  'темп',
  'пауз',
  'закадров',
  'передн',
  'фон',
]
const FORMAL_RE = new RegExp(`(^|[^а-яё])(${FORMAL_STEMS.join('|')})`, 'i')

export function mentionsFormalDecision(text: string | null | undefined): boolean {
  return FORMAL_RE.test((text ?? '').toLowerCase())
}

export function excerpt(text: string, max = 160): string {
  const clean = normalizeText(text)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Русское склонение: plural(3, ['фильм', 'фильма', 'фильмов']). */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}
