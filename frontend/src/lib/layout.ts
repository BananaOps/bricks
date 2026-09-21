/**
 * The grid's geometry engine.
 *
 * Everything here is pure: rows in, pixel boxes out. Keeping the maths free of
 * React means the stacking and capacity rules can be tested directly, and the
 * components stay a thin rendering pass over the result.
 */
import type { Brick, Dependency, Team, Theme } from '../types'
import { MONTHS_PER_YEAR } from './format'

/** Row height per ETP and column width per month, by density. */
export interface Metrics {
  /** Pixels of row height one ETP occupies. */
  unit: number
  /** Pixels of grid width one month occupies. */
  monthWidth: number
  /** Width of the sticky left column holding row labels. */
  labelWidth: number
  /** Breathing room below the deepest brick in a row. */
  bottomPadding: number
}

/**
 * Mesures de base par densité.
 *
 * `monthWidth` est ici un **plancher**, pas une largeur définitive : les douze
 * colonnes s'étirent pour occuper la place disponible, et ne retombent sur
 * cette valeur que lorsque la fenêtre devient trop étroite — auquel cas la
 * grille défile horizontalement.
 */
export const METRICS: Record<Density, Metrics> = {
  comfortable: { unit: 42, monthWidth: 96, labelWidth: 248, bottomPadding: 10 },
  compact: { unit: 32, monthWidth: 78, labelWidth: 248, bottomPadding: 10 },
}

/**
 * Adapte les mesures à la largeur réellement offerte au tableau.
 *
 * Une année tient toujours en douze colonnes : à largeur fixe, un grand écran
 * laisserait un tiers de la page vide à droite. Les mois se partagent donc
 * l'espace restant une fois la colonne des libellés retirée, sans jamais
 * descendre sous le plancher de leur densité.
 */
export function metricsFor(density: Density, availableWidth: number): Metrics {
  const base = METRICS[density]
  const usable = availableWidth - base.labelWidth
  if (usable <= 0) return base

  // Largeur fractionnaire assumée : les douze colonnes totalisent alors
  // exactement `usable`, là où un arrondi laisserait un liseré blanc à droite.
  return { ...base, monthWidth: Math.max(base.monthWidth, usable / MONTHS_PER_YEAR) }
}

export type Density = 'comfortable' | 'compact'
export type BlockStyle = 'tinted' | 'solid'
export type ViewMode = 'capacity' | 'review'

/** A brick placed in a row: `base` is its offset above the row's floor. */
export interface PlacedBrick {
  brick: Brick
  /** Pixels between the row floor and the bottom of this brick. */
  base: number
  /** Pixel height, derived from the brick's ETP. */
  height: number
}

export interface PackResult {
  placed: PlacedBrick[]
  /** Height of the tallest column of stacked bricks. */
  maxPile: number
  /** Stack height reached in each month, used to find free space. */
  stack: number[]
}

/**
 * Stacks a row's bricks so none overlap in time.
 *
 * Each brick sits on top of whatever already occupies the months it spans, so a
 * row reads as a skyline: its height at any month is that month's total load.
 *
 * Absences sink to the bottom of the pile — they are a fact of the calendar
 * that project work has to build on top of, so showing them underneath is what
 * makes the remaining headroom legible.
 *
 * Ties break by earlier start, then longer duration, then heavier load, which
 * keeps the result stable across re-renders rather than reshuffling on every
 * unrelated edit.
 */
export function packRow(bricks: Brick[], unit: number): PackResult {
  const stack = new Array<number>(MONTHS_PER_YEAR).fill(0)
  const placed: PlacedBrick[] = []

  const ordered = [...bricks].sort((a, b) => {
    const absence = (x: Brick) => (x.kind === 'absence' ? 0 : 1)
    return (
      absence(a) - absence(b) ||
      a.startMonth - b.startMonth ||
      b.duration - a.duration ||
      b.etp - a.etp
    )
  })

  for (const brick of ordered) {
    const height = brick.etp * unit
    const last = Math.min(MONTHS_PER_YEAR, brick.startMonth + brick.duration)

    // The brick rests on the highest point under any month it covers.
    let base = 0
    for (let m = brick.startMonth; m < last; m++) base = Math.max(base, stack[m] ?? 0)
    for (let m = brick.startMonth; m < last; m++) stack[m] = base + height

    placed.push({ brick, base, height })
  }

  return { placed, maxPile: Math.max(0, ...stack), stack }
}

/** ETP consumed in each month. Absences count: leave eats real capacity. */
export function monthlyLoad(bricks: Brick[]): number[] {
  const load = new Array<number>(MONTHS_PER_YEAR).fill(0)
  for (const b of bricks) {
    const last = Math.min(MONTHS_PER_YEAR, b.startMonth + b.duration)
    for (let m = b.startMonth; m < last; m++) load[m] = (load[m] ?? 0) + b.etp
  }
  return load
}

/** Absorbs float error so a load exactly at capacity is never an overload. */
const EPSILON = 1e-6

/** A fully measured row, ready to render. */
export interface LayoutRow {
  id: string
  name: string
  /** Theme swatch in review mode; undefined in capacity mode. */
  dotColor?: string
  /** ETP ceiling in capacity mode; null for theme rows, which have none. */
  capacity: number | null
  bricks: PlacedBrick[]
  load: number[]
  peak: number
  overloaded: boolean
  overloadedMonths: number[]
  /** Total row height in pixels. */
  height: number
  /** Distance from the row top to the floor bricks rest on. */
  floorY: number
  /** Distance from the row top to the capacity line. */
  capacityY: number
  /** Stack height per month, used to place the quick-add affordance. */
  stack: number[]
}

/** Absolute pixel box of a brick within the whole grid. */
export interface BrickBox {
  x: number
  y: number
  width: number
  height: number
  centerY: number
}

export interface Layout {
  rows: LayoutRow[]
  /** Pixel box of every visible brick, keyed by id. */
  boxes: Record<string, BrickBox>
  /** Top offset of each row, for hit-testing a drag against team rows. */
  rowOffsets: { id: string; y: number; height: number }[]
  totalHeight: number
  /** Width of the twelve month columns. */
  gridWidth: number
  /** Board-wide load per month, driving the month and quarter headers. */
  totalLoad: number[]
  totalCapacity: number
  /** Teams currently past their ceiling. */
  overloadedTeams: Set<string>
  /** Union of every team's offending months. */
  overloadedMonths: Set<number>
}

export interface LayoutInput {
  teams: Team[]
  themes: Theme[]
  bricks: Brick[]
  view: ViewMode
  metrics: Metrics
}

/**
 * Measures the whole board.
 *
 * Capacity mode gives one row per team, sized to the team's ceiling so the
 * dashed capacity line sits at a consistent place and overflow is visible above
 * it. Review mode groups the same bricks by theme instead, drops absences —
 * which carry no theme — and hides empty rows.
 */
export function computeLayout({ teams, themes, bricks, view, metrics }: LayoutInput): Layout {
  const { unit, monthWidth, bottomPadding } = metrics
  const review = view === 'review'

  // Overload is always judged per team, even in review mode, so the banner and
  // the filter chips keep saying the same thing across both views.
  const overloadedTeams = new Set<string>()
  const overloadedMonths = new Set<number>()
  const loadByTeam: Record<string, number[]> = {}

  for (const team of teams) {
    const load = monthlyLoad(bricks.filter((b) => b.teamId === team.id))
    loadByTeam[team.id] = load
    load.forEach((v, m) => {
      if (v > team.capacity + EPSILON) {
        overloadedTeams.add(team.id)
        overloadedMonths.add(m)
      }
    })
  }

  const sources = review
    ? themes.map((t) => ({
        id: t.id,
        name: t.name,
        dotColor: t.base,
        capacity: null as number | null,
        list: bricks.filter((b) => b.kind !== 'absence' && b.themeId === t.id),
      }))
    : teams.map((t) => ({
        id: t.id,
        name: t.name,
        dotColor: undefined,
        capacity: t.capacity as number | null,
        list: bricks.filter((b) => b.teamId === t.id),
      }))

  const rows: LayoutRow[] = []
  const boxes: Record<string, BrickBox> = {}
  const rowOffsets: { id: string; y: number; height: number }[] = []
  let y = 0

  for (const source of sources) {
    // An empty theme row carries no information; an empty team row still shows
    // capacity going unused, which is worth seeing.
    if (review && source.list.length === 0) continue

    const packed = packRow(source.list, unit)
    const load = source.capacity != null ? (loadByTeam[source.id] ?? []) : monthlyLoad(source.list)
    const peak = Math.max(0, ...load)

    // A team row is at least as tall as its ceiling, so the capacity line holds
    // still while bricks move around beneath it.
    const capacityHeight = source.capacity != null ? source.capacity * unit : packed.maxPile
    const overflow = source.capacity != null ? Math.max(0, packed.maxPile - capacityHeight) : 0
    const height = Math.max(overflow + capacityHeight + bottomPadding + 8, unit + 22)
    const floorY = height - bottomPadding
    const capacityY = floorY - capacityHeight

    const overloadedRowMonths: number[] = []
    if (source.capacity != null) {
      load.forEach((v, m) => {
        if (v > source.capacity! + EPSILON) overloadedRowMonths.push(m)
      })
    }

    for (const p of packed.placed) {
      const x = p.brick.startMonth * monthWidth + 3
      const width = Math.min(MONTHS_PER_YEAR - p.brick.startMonth, p.brick.duration) * monthWidth - 6
      const top = floorY - p.base - p.height
      boxes[p.brick.id] = { x, y: y + top, width, height: p.height, centerY: y + top + p.height / 2 }
    }

    rows.push({
      id: source.id,
      name: source.name,
      ...(source.dotColor ? { dotColor: source.dotColor } : {}),
      capacity: source.capacity,
      bricks: packed.placed,
      load,
      peak,
      overloaded: overloadedRowMonths.length > 0,
      overloadedMonths: overloadedRowMonths,
      height,
      floorY,
      capacityY,
      stack: packed.stack,
    })

    if (!review) rowOffsets.push({ id: source.id, y, height })
    y += height
  }

  return {
    rows,
    boxes,
    rowOffsets,
    totalHeight: Math.max(y, 200),
    gridWidth: monthWidth * MONTHS_PER_YEAR,
    totalLoad: monthlyLoad(bricks),
    totalCapacity: teams.reduce((sum, t) => sum + t.capacity, 0),
    overloadedTeams,
    overloadedMonths,
  }
}

/**
 * Builds the curve and arrowhead for a dependency arrow.
 *
 * The link leaves the right edge of the source and enters the left edge of the
 * target. Control-point reach grows with horizontal distance so short hops stay
 * tight while long ones sweep clear of the bricks between them.
 */
export function dependencyPath(from: BrickBox, to: BrickBox) {
  const x1 = from.x + from.width
  const y1 = from.centerY
  const x2 = to.x
  const y2 = to.centerY
  const reach = Math.max(36, Math.min(120, Math.abs(x2 - x1) * 0.6 + 28))
  return {
    curve: `M${x1} ${y1} C${x1 + reach} ${y1} ${x2 - reach} ${y2} ${x2} ${y2}`,
    arrow: `M${x2} ${y2} L${x2 - 7.5} ${y2 - 4.2} L${x2 - 7.5} ${y2 + 4.2} Z`,
  }
}

/** Ids reachable from `id` in one hop, in either direction, plus `id` itself. */
export function relatedBricks(deps: Dependency[], id: string | null): Set<string> {
  const related = new Set<string>()
  if (!id) return related
  related.add(id)
  for (const d of deps) {
    if (d.fromId === id) related.add(d.toId)
    if (d.toId === id) related.add(d.fromId)
  }
  return related
}

/** True when adding from→to would close a loop, mirroring the server's check. */
export function wouldCycle(deps: Dependency[], from: string, to: string): boolean {
  if (from === to) return true
  const next = new Map<string, string[]>()
  for (const d of deps) next.set(d.fromId, [...(next.get(d.fromId) ?? []), d.toId])

  // A cycle appears exactly when `to` can already reach `from`.
  const seen = new Set([to])
  const stack = [to]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === from) return true
    for (const n of next.get(cur) ?? []) {
      if (!seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  return false
}
