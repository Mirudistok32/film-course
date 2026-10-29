/**
 * Процедурное корявое дерево в духе книжной графики Артура Рэкхема:
 * изогнутый ствол, закручивающиеся ветви, тонкие «волосяные» побеги,
 * дупла и корни. Возвращает только данные path — цвет и толщину
 * линий задаёт компонент, поэтому дерево работает в обеих темах.
 */
import { createRng, r1, type Rng } from './random'

export interface TreeOptions {
  seed: string | number
  /** Основание ствола. */
  x: number
  y: number
  /** Примерная высота кроны над основанием. */
  height: number
  /** Глубина ветвления: 4 — значок, 7 — большая иллюстрация. */
  depth?: number
  /** Общий наклон в радианах: отрицательный — влево. */
  lean?: number
  /** Насколько ветви изгибаются (0..1). */
  gnarl?: number
  /** Пышность кроны (0..1): больше боковых ветвей и побегов. */
  fullness?: number
  roots?: boolean
  /** Мощь корней: 1 — обычные, больше — длиннее, толще, с отростками. */
  rootPower?: number
}

export interface TreeDrawing {
  /** Залитые контуры ствола и ветвей. */
  limbs: string[]
  /** Тонкие побеги — рисуются линией. */
  twigs: string[]
  /** Дупла и наросты — рисуются линией поверх ствола. */
  knots: string[]
}

type Point = [number, number]

const norm = (dx: number, dy: number): Point => {
  const len = Math.hypot(dx, dy) || 1
  return [-dy / len, dx / len]
}

const pt = (p: Point) => `${r1(p[0])} ${r1(p[1])}`

/** Сужающийся отрезок по квадратичной кривой. */
function limbPath(a: Point, c: Point, b: Point, w0: number, w1: number): string {
  const n0 = norm(c[0] - a[0], c[1] - a[1])
  const n1 = norm(b[0] - c[0], b[1] - c[1])
  const nc = norm(b[0] - a[0], b[1] - a[1])
  const wm = (w0 + w1) / 2
  const side = (p: Point, n: Point, w: number, s: 1 | -1): Point => [p[0] + (s * n[0] * w) / 2, p[1] + (s * n[1] * w) / 2]
  const l0 = side(a, n0, w0, 1)
  const lc = side(c, nc, wm, 1)
  const l1 = side(b, n1, w1, 1)
  const q1 = side(b, n1, w1, -1)
  const qc = side(c, nc, wm, -1)
  const q0 = side(a, n0, w0, -1)
  return `M${pt(l0)}Q${pt(lc)} ${pt(l1)}L${pt(q1)}Q${pt(qc)} ${pt(q0)}Z`
}

/** Круг в месте сочленения, чтобы стыки ветвей не давали зазубрин. */
function jointPath(p: Point, r: number): string {
  const x = r1(p[0] - r)
  const d = r1(2 * r)
  return `M${x} ${r1(p[1])}a${r1(r)} ${r1(r)} 0 1 0 ${d} 0a${r1(r)} ${r1(r)} 0 1 0 ${-d} 0Z`
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${r1(cx - rx)} ${r1(cy)}A${r1(rx)} ${r1(ry)} 0 1 0 ${r1(cx + rx)} ${r1(cy)}A${r1(rx)} ${r1(ry)} 0 1 0 ${r1(cx - rx)} ${r1(cy)}Z`
}

export function drawTree(options: TreeOptions): TreeDrawing {
  const { x, y, height, depth = 6, lean = 0, gnarl = 0.6, fullness = 0, roots = true, rootPower = 1 } = options
  const rng: Rng = createRng(options.seed)
  const out: TreeDrawing = { limbs: [], twigs: [], knots: [] }

  // Сумма длин ведущей ветви ≈ length * (1 + k + k² + …), k ≈ 0.8
  const trunkLength = height / 3.4
  const trunkWidth = height * 0.085
  // Первый сегмент ствола: к нему прирастают наплывы мощных корней.
  let trunkBase: { a: Point; c: Point; b: Point } | null = null

  function curl(from: Point, angle: number, length: number, dir: number) {
    const turns = 0.9 + rng.next() * 0.9
    const c: Point = [from[0] + Math.cos(angle) * length * 0.6, from[1] + Math.sin(angle) * length * 0.6]
    const a2 = angle + dir * turns
    const end: Point = [c[0] + Math.cos(a2) * length * 0.5, c[1] + Math.sin(a2) * length * 0.5]
    out.twigs.push(`M${pt(from)}Q${pt(c)} ${pt(end)}`)
  }

  function grow(from: Point, angle: number, length: number, width: number, level: number, twist: number, isTrunk: boolean) {
    const bend = (rng.next() - 0.5) * length * gnarl * 0.9 + twist * length * 0.18
    const end: Point = [from[0] + Math.cos(angle) * length, from[1] + Math.sin(angle) * length]
    const n = norm(end[0] - from[0], end[1] - from[1])
    const mid: Point = [(from[0] + end[0]) / 2 + n[0] * bend, (from[1] + end[1]) / 2 + n[1] * bend]
    const endWidth = Math.max(width * (level <= 1 ? 0.35 : rng.range(0.62, 0.74)), 0.35)

    out.limbs.push(limbPath(from, mid, end, width, endWidth))
    if (!trunkBase) trunkBase = { a: from, c: mid, b: end }
    // Под мощными корнями шар у основания ствола торчал бы из-под земли.
    if (width > 2.2 && !(rootPower > 1 && from[0] === x && from[1] === y)) out.limbs.push(jointPath(from, width / 2))

    if (isTrunk && width > trunkWidth * 0.55 && rng.chance(0.55)) {
      const t = rng.range(0.35, 0.65)
      const kx = from[0] + (end[0] - from[0]) * t + n[0] * bend * 0.5
      const ky = from[1] + (end[1] - from[1]) * t + n[1] * bend * 0.5
      out.knots.push(ellipsePath(kx, ky, width * rng.range(0.14, 0.22), width * rng.range(0.22, 0.34)))
    }

    if (level === 0) {
      // Рэкхемовские «пальцы»: тонкие закрученные побеги на концах.
      // Закручиваются в одну сторону — иначе пара побегов читается как «птичка».
      const count = (rng.chance(0.45) ? 2 : 1) + (fullness > 0 && rng.chance(fullness * 0.5) ? 1 : 0)
      const dir = twist >= 0 ? 1 : -1
      for (let i = 0; i < count; i++) {
        curl(end, angle + dir * i * 0.35 + rng.range(-0.25, 0.25), length * rng.range(0.45, 0.8), dir)
      }
      return
    }

    // Направление к лучу «вверх» — дерево не уходит в землю.
    const up = -Math.PI / 2
    const toward = (a: number, k: number) => a + (up - a) * k

    // Ведущая ветвь продолжает ствол.
    const leaderAngle = toward(angle + rng.range(-0.38, 0.38) + twist * 0.12, isTrunk ? 0.25 : 0.06)
    grow(end, leaderAngle, length * rng.range(0.74, 0.86), endWidth, level - 1, twist, isTrunk && level > depth - 3)

    // Боковые ветви, по одной-две, поочерёдно в стороны.
    // Пышная крона добавляет третью ветвь; при fullness = 0 рисунок прежний.
    const sides = rng.chance((isTrunk ? 0.9 : 0.75) + fullness * 0.25)
      ? (rng.chance(0.4 + fullness * 0.35) ? 2 : 1) + (fullness > 0 && rng.chance(fullness * 0.45) ? 1 : 0)
      : 0
    let dir = rng.chance(0.5) ? 1 : -1
    for (let i = 0; i < sides; i++) {
      const spread = rng.range(0.5, 1.05)
      const childAngle = toward(angle + dir * spread, 0.05)
      grow(
        end,
        childAngle,
        length * rng.range(0.55, 0.76),
        endWidth * rng.range(0.55, 0.72),
        level - 1,
        dir * rng.range(0.5, 1.2),
        false,
      )
      dir = -dir
    }
  }

  grow([x, y], -Math.PI / 2 + lean + rng.range(-0.08, 0.08), trunkLength, trunkWidth, depth, rng.range(-0.6, 0.6), true)

  if (roots && rootPower > 1) {
    // Мощные корни: толстый «контрфорс» поднимается по стволу и растекается
    // по склону, дальше корень тянется тонким и иногда ветвится.
    const count = 4 + Math.floor(rng.next() * 3) + Math.round((rootPower - 1) * 2)
    // Ось ствола на высоте подъёма наплыва: t ≈ доля высоты первого сегмента.
    const trunkAxis = (rise: number): number => {
      const { a, c, b } = trunkBase!
      const t = Math.min(1, rise / Math.max(a[1] - b[1], 1))
      return (1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0]
    }
    for (let i = 0; i < count; i++) {
      const left = i % 2 === 0
      const s = left ? -1 : 1
      const angle = left ? Math.PI - rng.range(0.08, 0.4) : rng.range(0.08, 0.4)
      const length = height * rng.range(0.08, 0.13) * rootPower
      const rise = trunkWidth * rng.range(0.8, 1.7)
      const knee: Point = [x + s * trunkWidth * rng.range(1.1, 1.8), y + rng.range(-2, 2)]
      const kneeWidth = trunkWidth * rng.range(0.45, 0.6)

      // Наплыв: вогнутая дуга от ствола к корню, низ уходит внутрь ствола.
      const axis = trunkAxis(rise)
      const edge = axis + s * trunkWidth * 0.3
      out.limbs.push(
        `M${pt([edge, y - rise])}Q${pt([edge + s * trunkWidth * 0.1, knee[1] - kneeWidth / 2])} ${pt([knee[0], knee[1] - kneeWidth / 2])}` +
          `L${pt([knee[0], knee[1] + kneeWidth / 2])}L${pt([x, y + 3])}L${pt([axis, y - rise])}Z`,
      )
      out.limbs.push(jointPath(knee, kneeWidth / 2))

      // Корень выгибается дугой над землёй и уходит в склон.
      const end: Point = [knee[0] + Math.cos(angle) * length, knee[1] + Math.sin(angle) * length * 0.4 + length * 0.12]
      const mid: Point = [(knee[0] + end[0]) / 2, (knee[1] + end[1]) / 2 - length * rng.range(0.06, 0.12)]
      out.limbs.push(limbPath(knee, mid, end, kneeWidth, 2))

      if (rng.chance(0.7)) {
        const t = rng.range(0.3, 0.55)
        const from: Point = [
          (1 - t) ** 2 * knee[0] + 2 * t * (1 - t) * mid[0] + t * t * end[0],
          (1 - t) ** 2 * knee[1] + 2 * t * (1 - t) * mid[1] + t * t * end[1],
        ]
        const subAngle = angle + s * rng.range(0.3, 0.6)
        const subLength = length * rng.range(0.3, 0.5)
        const subEnd: Point = [from[0] + Math.cos(subAngle) * subLength, from[1] + Math.sin(subAngle) * subLength * 0.5 + 2]
        const subMid: Point = [(from[0] + subEnd[0]) / 2, (from[1] + subEnd[1]) / 2 - subLength * 0.06]
        out.limbs.push(limbPath(from, subMid, subEnd, kneeWidth * (1 - t) * 0.75, 0.5))
      }
    }
  } else if (roots) {
    const count = 3 + Math.floor(rng.next() * 3)
    for (let i = 0; i < count; i++) {
      const left = i % 2 === 0
      const base: Point = [x + rng.range(-0.25, 0.25) * trunkWidth, y - rng.range(0, 0.15) * trunkWidth]
      const angle = left ? Math.PI - rng.range(0.05, 0.45) : rng.range(0.05, 0.45)
      const length = height * rng.range(0.08, 0.16)
      const end: Point = [base[0] + Math.cos(angle) * length, base[1] + Math.sin(angle) * length * 0.35 + 2]
      const n = norm(end[0] - base[0], end[1] - base[1])
      const bend = rng.range(-0.2, 0.2) * length
      const mid: Point = [(base[0] + end[0]) / 2 + n[0] * bend, (base[1] + end[1]) / 2 + n[1] * bend - length * 0.12]
      out.limbs.push(limbPath(base, mid, end, trunkWidth * rng.range(0.4, 0.6), 0.6))
      if (rng.chance(0.6)) curl(end, angle, length * 0.5, left ? -1 : 1)
    }
  }

  return out
}
