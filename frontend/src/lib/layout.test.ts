import { describe, expect, it } from 'vitest'
import type { Brick, Dependency, Team, Theme } from '../types'
import { METRICS, computeLayout, metricsFor, monthlyLoad, packRow, relatedBricks, wouldCycle } from './layout'

function work(id: string, teamId: string, etp: number, startMonth: number, duration: number, themeId = 't1'): Brick {
  return { id, roadmapId: 'rm', teamId, themeId, kind: 'work', title: id, etp, startMonth, duration, link: '' }
}

function absence(id: string, teamId: string, etp: number, startMonth: number, duration: number): Brick {
  return { id, roadmapId: 'rm', teamId, themeId: null, kind: 'absence', title: 'Congés', etp, startMonth, duration, link: '' }
}

const teams: Team[] = [
  { id: 'a', name: 'Alpha', capacity: 3, position: 0 },
  { id: 'b', name: 'Bravo', capacity: 5, position: 1 },
]

const themes: Theme[] = [
  { id: 't1', name: 'Thème 1', base: '#111', tint: '#eee', ink: '#222', line: '#ddd', iconPath: '', position: 0 },
  { id: 't2', name: 'Thème 2', base: '#333', tint: '#fff', ink: '#444', line: '#ccc', iconPath: '', position: 1 },
]

describe('packRow', () => {
  it('stacks bricks that share a month so they never overlap', () => {
    const { placed } = packRow([work('x', 'a', 1, 0, 3), work('y', 'a', 1, 1, 2)], 40)
    const [first, second] = placed

    expect(first!.base).toBe(0)
    // The second brick overlaps months 1–2, so it rests on top of the first.
    expect(second!.base).toBe(40)
  })

  it('places bricks side by side when their months do not touch', () => {
    const { placed, maxPile } = packRow([work('x', 'a', 1, 0, 2), work('y', 'a', 1, 5, 2)], 40)

    expect(placed.every((p) => p.base === 0)).toBe(true)
    expect(maxPile).toBe(40)
  })

  it('sinks absences to the bottom so remaining headroom stays legible', () => {
    const { placed } = packRow([work('x', 'a', 1, 3, 2), absence('leave', 'a', 1, 3, 2)], 40)
    const leave = placed.find((p) => p.brick.id === 'leave')!
    const project = placed.find((p) => p.brick.id === 'x')!

    expect(leave.base).toBe(0)
    expect(project.base).toBe(40)
  })

  it('derives height from load', () => {
    const { placed } = packRow([work('x', 'a', 2.5, 0, 1)], 40)
    expect(placed[0]!.height).toBe(100)
  })

  it('reports the tallest column as the pile height', () => {
    const { maxPile } = packRow([work('x', 'a', 1, 0, 6), work('y', 'a', 2, 2, 2)], 40)
    expect(maxPile).toBe(120)
  })

  it('orders deterministically regardless of input order', () => {
    const bricks = [work('x', 'a', 1, 0, 3), work('y', 'a', 1, 1, 2), work('z', 'a', 2, 4, 2)]
    const forward = packRow(bricks, 40).placed.map((p) => p.brick.id)
    const backward = packRow([...bricks].reverse(), 40).placed.map((p) => p.brick.id)

    expect(forward).toEqual(backward)
  })
})

describe('monthlyLoad', () => {
  it('spreads a brick across every month it spans', () => {
    expect(monthlyLoad([work('x', 'a', 1.5, 2, 3)])).toEqual([0, 0, 1.5, 1.5, 1.5, 0, 0, 0, 0, 0, 0, 0])
  })

  it('counts absences, which consume real capacity', () => {
    const load = monthlyLoad([work('x', 'a', 3, 7, 1), absence('leave', 'a', 1, 7, 1)])
    expect(load[7]).toBe(4)
  })

  it('never reads past December', () => {
    expect(monthlyLoad([work('x', 'a', 1, 11, 1)])).toHaveLength(12)
  })
})

describe('computeLayout — capacity view', () => {
  const metrics = METRICS.comfortable

  it('gives one row per team, even when the team has nothing planned', () => {
    const layout = computeLayout({ teams, themes, bricks: [work('x', 'a', 1, 0, 2)], view: 'capacity', metrics })
    expect(layout.rows.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('flags only the teams past their ceiling', () => {
    const bricks = [work('x', 'a', 2, 0, 2), work('y', 'a', 2, 1, 2), work('z', 'b', 2, 0, 3)]
    const layout = computeLayout({ teams, themes, bricks, view: 'capacity', metrics })

    expect([...layout.overloadedTeams]).toEqual(['a'])
    expect([...layout.overloadedMonths]).toEqual([1])
    expect(layout.rows.find((r) => r.id === 'a')!.peak).toBe(4)
  })

  it('treats a load exactly at capacity as full, not overloaded', () => {
    const bricks = [work('x', 'a', 0.5, 0, 1), work('y', 'a', 1.5, 0, 1), work('z', 'a', 1, 0, 1)]
    const layout = computeLayout({ teams, themes, bricks, view: 'capacity', metrics })

    expect(layout.rows[0]!.peak).toBeCloseTo(3)
    expect(layout.overloadedTeams.size).toBe(0)
  })

  it('puts the capacity line at the ceiling so it holds still as bricks move', () => {
    const layout = computeLayout({ teams, themes, bricks: [work('x', 'a', 1, 0, 2)], view: 'capacity', metrics })
    const row = layout.rows[0]!

    expect(row.floorY - row.capacityY).toBe(3 * metrics.unit)
  })

  it('grows the row above the capacity line when the pile overflows', () => {
    const withinBudget = computeLayout({ teams, themes, bricks: [work('x', 'a', 3, 0, 2)], view: 'capacity', metrics })
    const overflowing = computeLayout({ teams, themes, bricks: [work('x', 'a', 3, 0, 2), work('y', 'a', 2, 0, 2)], view: 'capacity', metrics })

    expect(overflowing.rows[0]!.height).toBeGreaterThan(withinBudget.rows[0]!.height)
  })

  it('sums the whole board for the month and quarter headers', () => {
    const bricks = [work('x', 'a', 2, 0, 2), work('y', 'b', 1, 0, 1)]
    const layout = computeLayout({ teams, themes, bricks, view: 'capacity', metrics })

    expect(layout.totalCapacity).toBe(8)
    expect(layout.totalLoad[0]).toBe(3)
    expect(layout.totalLoad[1]).toBe(2)
  })

  it('positions bricks so wider windows span more columns', () => {
    const layout = computeLayout({ teams, themes, bricks: [work('x', 'a', 1, 2, 3)], view: 'capacity', metrics })
    const box = layout.boxes['x']!

    expect(box.x).toBe(2 * metrics.monthWidth + 3)
    expect(box.width).toBe(3 * metrics.monthWidth - 6)
  })

  it('clips a brick that would otherwise run past December', () => {
    const layout = computeLayout({ teams, themes, bricks: [work('x', 'a', 1, 10, 6)], view: 'capacity', metrics })
    expect(layout.boxes['x']!.width).toBe(2 * metrics.monthWidth - 6)
  })
})

describe('computeLayout — review view', () => {
  const metrics = METRICS.comfortable

  it('groups by theme and drops empty ones', () => {
    const layout = computeLayout({ teams, themes, bricks: [work('x', 'a', 1, 0, 2, 't1')], view: 'review', metrics })
    expect(layout.rows.map((r) => r.id)).toEqual(['t1'])
  })

  it('hides absences, which carry no theme', () => {
    const bricks = [work('x', 'a', 1, 0, 2, 't1'), absence('leave', 'a', 1, 0, 1)]
    const layout = computeLayout({ teams, themes, bricks, view: 'review', metrics })

    expect(layout.rows[0]!.bricks.map((p) => p.brick.id)).toEqual(['x'])
  })

  it('still reports team overloads, so the banner reads the same in both views', () => {
    const bricks = [work('x', 'a', 2, 0, 2, 't1'), work('y', 'a', 2, 1, 2, 't1')]
    const layout = computeLayout({ teams, themes, bricks, view: 'review', metrics })

    expect([...layout.overloadedTeams]).toEqual(['a'])
  })
})

describe('compact density', () => {
  it('shortens rows and narrows columns without changing what is planned', () => {
    const bricks = [work('x', 'a', 2, 0, 3)]
    const roomy = computeLayout({ teams, themes, bricks, view: 'capacity', metrics: METRICS.comfortable })
    const tight = computeLayout({ teams, themes, bricks, view: 'capacity', metrics: METRICS.compact })

    expect(tight.rows[0]!.height).toBeLessThan(roomy.rows[0]!.height)
    expect(tight.gridWidth).toBeLessThan(roomy.gridWidth)
    expect(tight.rows[0]!.peak).toBe(roomy.rows[0]!.peak)
  })
})

describe('relatedBricks', () => {
  const deps: Dependency[] = [
    { id: 'd1', fromId: 'a', toId: 'b' },
    { id: 'd2', fromId: 'c', toId: 'a' },
    { id: 'd3', fromId: 'x', toId: 'y' },
  ]

  it('collects both directions plus the brick itself', () => {
    expect(relatedBricks(deps, 'a')).toEqual(new Set(['a', 'b', 'c']))
  })

  it('is empty when nothing is hovered', () => {
    expect(relatedBricks(deps, null).size).toBe(0)
  })
})

describe('wouldCycle', () => {
  const deps: Dependency[] = [
    { id: 'd1', fromId: 'a', toId: 'b' },
    { id: 'd2', fromId: 'b', toId: 'c' },
  ]

  it.each([
    ['a brick onto itself', 'a', 'a', true],
    ['the direct reverse of an existing link', 'b', 'a', true],
    ['a transitive loop', 'c', 'a', true],
    ['a forward link', 'a', 'c', false],
    ['an unrelated branch', 'a', 'd', false],
  ])('detects %s', (_label, from, to, expected) => {
    expect(wouldCycle(deps, from as string, to as string)).toBe(expected)
  })
})

describe('metricsFor', () => {
  it('étire les douze mois pour remplir la largeur offerte', () => {
    const metrics = metricsFor('comfortable', 2048)
    // 2048 - 248 de libellés, partagés en douze colonnes.
    expect(metrics.monthWidth).toBeCloseTo(150)
    expect(metrics.monthWidth * 12 + metrics.labelWidth).toBeCloseTo(2048)
  })

  // Sous le plancher, la grille défile plutôt que d'écraser les colonnes au
  // point de rendre les titres illisibles.
  it('ne descend jamais sous le plancher de sa densité', () => {
    expect(metricsFor('comfortable', 600).monthWidth).toBe(METRICS.comfortable.monthWidth)
    expect(metricsFor('compact', 600).monthWidth).toBe(METRICS.compact.monthWidth)
  })

  it('retombe sur les mesures de base tant que rien n’est mesuré', () => {
    expect(metricsFor('comfortable', 0)).toEqual(METRICS.comfortable)
  })

  it('garde la densité compacte plus dense à largeur égale', () => {
    expect(metricsFor('compact', 2048).unit).toBeLessThan(metricsFor('comfortable', 2048).unit)
  })

  it('remplit la largeur jusqu’au dernier pixel, sans liseré à droite', () => {
    for (const width of [1440, 1537, 1920, 2561]) {
      const metrics = metricsFor('comfortable', width)
      expect(metrics.monthWidth * 12 + metrics.labelWidth).toBeCloseTo(width)
    }
  })
})
