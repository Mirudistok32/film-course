/**
 * «Кадр» на обложке фильма: силуэтная сцена в духе теневого театра и
 * книжной графики. Сцена детерминирована: один фильм — всегда один рисунок.
 * Мотив выбирается по месту фильма в уровне, поэтому соседние фильмы
 * не повторяют друг друга; мелкие детали — по сиду фильма.
 *
 * Возвращает только данные path в координатах COVER_VIEWBOX — цвета задаёт
 * компонент (цвет уровня), поэтому рисунок работает в обеих темах.
 * Ниже GROUND_Y — сплошная «земля», на ней компонент пишет название.
 */
import { createRng, hashSeed, r1, type Rng } from './random'
import { drawTree } from './tree'

export const COVER_WIDTH = 48
export const COVER_HEIGHT = 100
export const COVER_VIEWBOX = `0 0 ${COVER_WIDTH} ${COVER_HEIGHT}`
/** Верх «земли»: всё ниже — плашка под название. */
export const GROUND_Y = 60

export const COVER_MOTIFS = ['moon', 'figure', 'building', 'tree', 'road', 'window'] as const
export type CoverMotif = (typeof COVER_MOTIFS)[number]

export interface CoverOptions {
  /** Сид деталей — обычно id фильма. */
  seed: string
  /** Номер уровня и место фильма в нём — по ним выбирается мотив. */
  levelNumber: number
  order: number
}

/**
 * Вид слоя:
 * - far — дальний план, заливка цветом линий, полупрозрачно;
 * - glow — свет (луна, звёзды, огонь), заливка цветом линий, приглушённо;
 * - shape — силуэт, сплошная заливка цветом линий;
 * - hole — просвет (окно, дорога), заливка цветом фона;
 * - line — тонкая линия (побеги, провода, птицы), обводка цветом линий.
 */
export type CoverLayerKind = 'far' | 'glow' | 'shape' | 'hole' | 'line'

export interface CoverLayer {
  kind: CoverLayerKind
  d: string
}

export interface CoverDrawing {
  motif: CoverMotif
  /** Отразить сцену по горизонтали. */
  flip: boolean
  /** Слои в порядке рисования. */
  layers: CoverLayer[]
}

type Point = [number, number]

const W = COVER_WIDTH
const G = GROUND_Y
const pt = (p: Point) => `${r1(p[0])} ${r1(p[1])}`

function rect(x: number, y: number, w: number, h: number): string {
  return `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`
}

function circle(cx: number, cy: number, r: number): string {
  const d = r1(2 * r)
  return `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${d} 0a${r1(r)} ${r1(r)} 0 1 0 ${-d} 0Z`
}

function polygon(points: Point[]): string {
  return `M${points.map(pt).join('L')}Z`
}

/**
 * Серп: часть круга (x, y, r), не закрытая сдвинутым кругом радиуса 0.85r.
 * Точки пересечения окружностей — по стандартной формуле.
 */
function crescent(x: number, y: number, r: number, angle: number): string {
  const r2 = r * 0.85
  const dist = r * 0.5
  const u: Point = [Math.cos(angle), Math.sin(angle)]
  const a = (dist * dist + r * r - r2 * r2) / (2 * dist)
  const h = Math.sqrt(r * r - a * a)
  const p1: Point = [x + a * u[0] - h * u[1], y + a * u[1] + h * u[0]]
  const p2: Point = [x + a * u[0] + h * u[1], y + a * u[1] - h * u[0]]
  return `M${pt(p1)}A${r1(r)} ${r1(r)} 0 1 1 ${pt(p2)}A${r1(r2)} ${r1(r2)} 0 1 0 ${pt(p1)}Z`
}

function add(out: CoverDrawing, kind: CoverLayerKind, ...paths: string[]) {
  for (const d of paths) out.layers.push({ kind, d })
}

/** Холмистая полоса от линии top до низа кадра. */
function hills(rng: Rng, top: number, amplitude: number, bumps: number): string {
  const step = W / bumps
  let d = `M-1 ${COVER_HEIGHT}L-1 ${r1(top + rng.range(-amplitude, amplitude))}`
  for (let i = 0; i < bumps; i++) {
    const x0 = i * step
    const peak = top - rng.range(0.2, 1) * amplitude
    const end = top + rng.range(-amplitude, amplitude) * 0.4
    d += `Q${pt([x0 + step / 2, peak])} ${pt([x0 + step + (i === bumps - 1 ? 1 : 0), end])}`
  }
  return `${d}L${W + 1} ${COVER_HEIGHT}Z`
}

/** Земля: верх слегка неровный, чтобы не читался как линейка. */
function ground(rng: Rng, top = G): string {
  return hills(rng, top, 0.8, 3)
}

/** Луна: полная или серп. */
function moon(rng: Rng, out: CoverDrawing, x: number, y: number, r: number) {
  add(out, 'glow', rng.chance(0.45) ? crescent(x, y, r, rng.range(-0.6, 0.6)) : circle(x, y, r))
}

function stars(rng: Rng, out: CoverDrawing, count: number, bottom: number) {
  for (let i = 0; i < count; i++) {
    add(out, 'glow', circle(rng.range(3, W - 3), rng.range(3, bottom), rng.range(0.35, 0.6)))
  }
}

/** Птицы — «галочки» из двух дуг. */
function birds(rng: Rng, out: CoverDrawing, count: number) {
  for (let i = 0; i < count; i++) {
    const x = rng.range(6, W - 6)
    const y = rng.range(8, 30)
    const s = rng.range(1.2, 2)
    add(
      out,
      'line',
      `M${pt([x - s, y])}Q${pt([x - s / 2, y - s * 0.7])} ${pt([x, y])}Q${pt([x + s / 2, y - s * 0.7])} ${pt([x + s, y])}`,
    )
  }
}

function drawMoon(rng: Rng, out: CoverDrawing) {
  const mx = rng.range(12, 36)
  moon(rng, out, mx, rng.range(14, 24), rng.range(6, 8.5))
  stars(rng, out, 2 + Math.floor(rng.next() * 4), 34)
  if (rng.chance(0.5)) {
    // Море: дальний берег, лунная дорожка и лодка.
    const shore = rng.range(40, 44)
    add(out, 'far', hills(rng, shore - 2, 2.5, 2))
    add(out, 'far', rect(-1, shore, W + 2, G - shore + 1))
    for (let i = 0; i < 5; i++) {
      const y = shore + 2 + i * ((G - shore - 3) / 5)
      const w = 2 + i * 1.6
      add(out, 'glow', rect(mx - w / 2 + rng.range(-1, 1), y, w, 0.7))
    }
    const bx = mx + (rng.chance(0.5) ? -1 : 1) * rng.range(8, 13)
    const by = rng.range(shore + 6, G - 6)
    add(
      out,
      'shape',
      polygon([
        [bx - 4, by],
        [bx + 4, by],
        [bx + 2.6, by + 1.8],
        [bx - 2.6, by + 1.8],
      ]),
    )
    add(
      out,
      'shape',
      polygon([
        [bx - 0.3, by - 0.2],
        [bx - 0.3, by - 7],
        [bx + 3.2, by - 0.2],
      ]),
    )
    return
  }
  add(out, 'far', hills(rng, rng.range(44, 50), 4, 2 + Math.floor(rng.next() * 2)))
  add(out, 'shape', hills(rng, rng.range(52, 56), 3, 3))
  // Одинокий домик на холме, в окне свет.
  const hx = rng.range(8, 34)
  const hy = rng.range(53, 55)
  add(
    out,
    'shape',
    rect(hx, hy - 5, 6, 6),
    polygon([
      [hx - 1, hy - 5],
      [hx + 3, hy - 8.5],
      [hx + 7, hy - 5],
    ]),
  )
  add(out, 'hole', rect(hx + 2.2, hy - 3.6, 1.6, 1.8))
}

function drawFigure(rng: Rng, out: CoverDrawing) {
  if (rng.chance(0.5)) moon(rng, out, rng.range(8, 40), rng.range(10, 20), rng.range(3, 5))
  else birds(rng, out, 2 + Math.floor(rng.next() * 3))
  add(out, 'far', hills(rng, rng.range(48, 53), 2.5, 2))
  add(out, 'shape', ground(rng))

  const x = rng.range(17, 31)
  const h = rng.range(20, 26)
  const top = G - h
  const head = h * 0.11
  const shoulder = h * 0.17
  const hem = h * rng.range(0.22, 0.3)
  // Голова, плащ-трапеция, ноги.
  add(out, 'shape', circle(x, top + head, head))
  add(
    out,
    'shape',
    polygon([
      [x - shoulder * 0.55, top + head * 2.1],
      [x + shoulder * 0.55, top + head * 2.1],
      [x + hem, G - h * 0.22],
      [x - hem, G - h * 0.22],
    ]),
  )
  add(out, 'shape', rect(x - hem * 0.45, G - h * 0.24, hem * 0.28, h * 0.25))
  add(out, 'shape', rect(x + hem * 0.17, G - h * 0.24, hem * 0.28, h * 0.25))
  if (rng.chance(0.5)) {
    // Шляпа с полями.
    add(out, 'shape', rect(x - head * 1.8, top + head * 0.55, head * 3.6, head * 0.45))
    add(out, 'shape', rect(x - head * 0.95, top - head * 0.6, head * 1.9, head * 1.3))
  }
  if (rng.chance(0.5)) {
    // Фонарный столб рядом с фигурой.
    const side = x < W / 2 ? 1 : -1
    const lx = x + side * rng.range(10, 14)
    const lh = rng.range(30, 38)
    add(out, 'shape', rect(lx - 0.6, G - lh, 1.2, lh))
    add(
      out,
      'shape',
      polygon([
        [lx - 2, G - lh],
        [lx + 2, G - lh],
        [lx + 1.2, G - lh - 2.6],
        [lx - 1.2, G - lh - 2.6],
      ]),
    )
    add(out, 'glow', circle(lx, G - lh + 1.6, 2.4))
  }
}

function drawBuilding(rng: Rng, out: CoverDrawing) {
  stars(rng, out, 1 + Math.floor(rng.next() * 3), 24)
  if (rng.chance(0.6)) moon(rng, out, rng.range(8, 40), rng.range(9, 16), rng.range(3, 4.5))
  add(out, 'shape', ground(rng))

  const blocks = rng.chance(0.55) ? 2 : 1
  let x = blocks === 2 ? rng.range(5, 9) : rng.range(10, 16)
  for (let b = 0; b < blocks; b++) {
    const w = b === 0 ? rng.range(15, 22) : rng.range(10, 14)
    const h = b === 0 ? rng.range(22, 34) : rng.range(14, 22)
    const top = G - h
    add(out, 'shape', rect(x, top, w, h + 1))
    const roof = Math.floor(rng.next() * 3)
    if (roof === 0) {
      add(
        out,
        'shape',
        polygon([
          [x - 1.5, top + 0.2],
          [x + w / 2, top - w * 0.42],
          [x + w + 1.5, top + 0.2],
        ]),
      )
    } else if (roof === 1) {
      // Башенка со шпилем.
      const tw = w * 0.36
      const tx = x + rng.range(0.1, 0.55) * w
      add(out, 'shape', rect(tx, top - 8, tw, 8.5))
      add(
        out,
        'shape',
        polygon([
          [tx - 0.6, top - 8],
          [tx + tw / 2, top - 8 - tw * 1.6],
          [tx + tw + 0.6, top - 8],
        ]),
      )
    } else {
      add(out, 'shape', rect(x + w * rng.range(0.15, 0.65), top - 4.5, 2.2, 5))
    }
    // Окна сеткой, светится часть.
    const cols = Math.max(2, Math.floor(w / 5.2))
    const rows = Math.max(2, Math.floor(h / 7))
    const gx = w / cols
    const gy = (h - 4) / rows
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (!rng.chance(0.42)) continue
        add(out, 'hole', rect(x + c * gx + gx * 0.3, top + 3 + r * gy + gy * 0.22, gx * 0.4, gy * 0.48))
      }
    }
    x += w + rng.range(2, 5)
  }
}

function drawTreeScene(rng: Rng, out: CoverDrawing, seed: string) {
  if (rng.chance(0.55)) moon(rng, out, rng.range(8, 40), rng.range(10, 20), rng.range(4, 6))
  else birds(rng, out, 2 + Math.floor(rng.next() * 2))
  add(out, 'far', hills(rng, rng.range(46, 52), 3, 2))
  add(out, 'shape', ground(rng))
  const tree = drawTree({
    seed,
    x: rng.range(18, 30),
    y: G + 0.5,
    height: rng.range(40, 50),
    depth: 5,
    lean: rng.range(-0.2, 0.2),
    roots: false,
  })
  add(out, 'shape', ...tree.limbs)
  add(out, 'line', ...tree.twigs)
}

function drawRoad(rng: Rng, out: CoverDrawing) {
  const horizon = rng.range(36, 42)
  if (rng.chance(0.6)) add(out, 'glow', circle(rng.range(10, 38), horizon - rng.range(5, 11), rng.range(4, 7)))
  else birds(rng, out, 2 + Math.floor(rng.next() * 3))
  // Поле до горизонта — полупрозрачное, чтобы на нём читались дорога и столбы.
  add(out, 'far', hills(rng, horizon, 0.8, 2), hills(rng, horizon + 0.5, 0.4, 2))

  // Дорога к точке схода: почти во всю ширину у края земли, сходится в нитку на горизонте.
  const vx = rng.range(16, 32)
  const vy = horizon + 1
  const bx = rng.range(20, 28)
  const bend = rng.range(-4, 4)
  const half = rng.range(8, 11)
  const mid: Point = [(vx + bx) / 2 + bend, (vy + G) / 2]
  add(
    out,
    'hole',
    `M${pt([vx - 0.3, vy])}Q${pt([mid[0] - half * 0.4, mid[1]])} ${pt([bx - half, G + 1])}` +
      `L${pt([bx + half, G + 1])}Q${pt([mid[0] + half * 0.4, mid[1]])} ${pt([vx + 0.3, vy])}Z`,
  )
  // Точка на средней линии дороги: u = 0 — у края земли, 1 — на горизонте.
  const along = (u: number): Point => {
    const v = 1 - u
    return [v * v * bx + 2 * u * v * mid[0] + u * u * vx, v * v * G + 2 * u * v * mid[1] + u * u * vy]
  }
  // Разметка: штрихи сужаются и укорачиваются к горизонту.
  for (let i = 0; i < 4; i++) {
    const u = 0.12 + i * 0.22
    const w = 0.6 * (1 - u)
    const [x0, y0] = along(u)
    const [x1, y1] = along(u + 0.08 * (1 - u))
    add(
      out,
      'far',
      polygon([
        [x0 - w, y0],
        [x0 + w, y0],
        [x1 + w / 2, y1],
        [x1 - w / 2, y1],
      ]),
    )
  }
  // Столбы у обочины, с той стороны, куда дорога раскрывается; высота — по
  // перспективе (пропорциональна расстоянию до горизонта), между ними провод.
  const side = vx < bx ? 1 : -1
  const tops: Point[] = []
  for (const t of [0.05, 0.32, 0.55, 0.74]) {
    const k = (1 - t) * (1 - t)
    const [cx, py] = along(t)
    const px = cx + side * (half + 2) * (1 - t)
    const ph = 0.8 + 1.3 * (py - vy)
    add(out, 'shape', rect(px - 0.3 - 0.4 * k, py - ph, 0.6 + 0.8 * k, ph))
    add(out, 'shape', rect(px - 1 - 2.4 * k, py - ph + 0.8, 2 + 4.8 * k, 0.4 + 0.4 * k))
    tops.push([px, py - ph + 1])
  }
  for (let i = 1; i < tops.length; i++) {
    const a = tops[i - 1]!
    const b = tops[i]!
    add(out, 'line', `M${pt(a)}Q${pt([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1.5])} ${pt(b)}`)
  }
}

function drawWindow(rng: Rng, out: CoverDrawing) {
  // Комната изнутри: стена — силуэт, окно — просвет с видом наружу.
  const ww = rng.range(26, 31)
  const wh = rng.range(34, 40)
  const wx = (W - ww) / 2 + rng.range(-3, 3)
  const wy = rng.range(8, 13)
  const arched = rng.chance(0.4)
  add(out, 'shape', rect(-1, -1, W + 2, G + 2))
  add(
    out,
    'hole',
    arched
      ? `M${pt([wx, wy + wh])}L${pt([wx, wy + ww / 2])}A${r1(ww / 2)} ${r1(ww / 2)} 0 0 1 ${pt([wx + ww, wy + ww / 2])}L${pt([wx + ww, wy + wh])}Z`
      : rect(wx, wy, ww, wh),
  )
  // Вид в окне поверх просвета: луна и дальние холмы.
  moon(rng, out, wx + ww * rng.range(0.25, 0.75), wy + wh * rng.range(0.25, 0.4), rng.range(2.5, 4))
  const sill = wy + wh
  add(
    out,
    'far',
    `M${pt([wx, sill])}L${pt([wx, sill - rng.range(4, 8)])}Q${pt([wx + ww * 0.35, sill - rng.range(8, 12)])} ${pt([wx + ww * 0.6, sill - rng.range(4, 7)])}` +
      `Q${pt([wx + ww * 0.85, sill - rng.range(2, 6)])} ${pt([wx + ww, sill - rng.range(5, 9)])}L${pt([wx + ww, sill])}Z`,
  )
  // Переплёт и подоконник.
  add(out, 'shape', rect(wx + ww / 2 - 0.6, wy, 1.2, wh))
  add(out, 'shape', rect(wx, wy + wh * 0.42, ww, 1.2))
  add(out, 'shape', rect(wx - 2.5, sill, ww + 5, 1.8))
  // Занавески: мягкие складки по краям окна.
  const drape = (x0: number, dir: 1 | -1) =>
    `M${pt([x0, wy - 2])}L${pt([x0 + dir * ww * 0.3, wy - 2])}Q${pt([x0 + dir * ww * 0.08, wy + wh * 0.45])} ${pt([x0 + dir * ww * 0.2, sill])}L${pt([x0, sill])}Z`
  add(out, 'far', drape(wx - 0.5, 1), drape(wx + ww + 0.5, -1))
  if (rng.chance(0.5)) {
    // Свеча на подоконнике.
    const cx = wx + ww * rng.range(0.15, 0.85)
    add(out, 'shape', rect(cx - 0.8, sill - 4, 1.6, 4))
    add(
      out,
      'glow',
      `M${pt([cx, sill - 7.2])}Q${pt([cx + 1.1, sill - 5])} ${pt([cx, sill - 4.4])}Q${pt([cx - 1.1, sill - 5])} ${pt([cx, sill - 7.2])}Z`,
    )
  }
}

/** Мотив по месту в уровне: соседние фильмы уровня всегда разные. */
export function pickMotif(levelNumber: number, order: number): CoverMotif {
  const index = ((levelNumber - 1) * 5 + order - 1) % COVER_MOTIFS.length
  return COVER_MOTIFS[index]!
}

const coverCache = new Map<string, CoverDrawing>()

/** Сцена детерминирована, поэтому одну обложку рисуем один раз (журнал повторяет фильмы). */
export function cachedCover(options: CoverOptions): CoverDrawing {
  const key = `${options.seed}:${options.levelNumber}:${options.order}`
  let drawing = coverCache.get(key)
  if (!drawing) coverCache.set(key, (drawing = drawCover(options)))
  return drawing
}

export function drawCover(options: CoverOptions): CoverDrawing {
  const motif = pickMotif(options.levelNumber, options.order)
  const rng = createRng(hashSeed(`cover:${options.seed}`))
  const out: CoverDrawing = { motif, flip: rng.chance(0.5), layers: [] }
  if (motif === 'moon') drawMoon(rng, out)
  else if (motif === 'figure') drawFigure(rng, out)
  else if (motif === 'building') drawBuilding(rng, out)
  else if (motif === 'tree') drawTreeScene(rng, out, options.seed)
  else if (motif === 'road') drawRoad(rng, out)
  else drawWindow(rng, out)
  // Земля под названием — у всех сцен; у окна её продолжает стена.
  add(out, 'shape', rect(-1, G, W + 2, COVER_HEIGHT - G + 1))
  return out
}
