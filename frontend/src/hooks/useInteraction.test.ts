import { describe, expect, it } from 'vitest'
import { EDGE_SPEED, EDGE_ZONE, edgeVelocity, nearestRow } from './useInteraction'

describe('edgeVelocity', () => {
  it('ne défile pas quand le pointeur est loin des deux bords', () => {
    expect(edgeVelocity(400, 400)).toBe(0)
    expect(edgeVelocity(EDGE_ZONE, EDGE_ZONE)).toBe(0)
  })

  it('recule vers le début près du bord gauche ou haut', () => {
    expect(edgeVelocity(0, 500)).toBe(-EDGE_SPEED)
    expect(edgeVelocity(EDGE_ZONE / 2, 500)).toBeCloseTo(-EDGE_SPEED / 2)
  })

  it('avance vers la fin près du bord droit ou bas', () => {
    expect(edgeVelocity(500, 0)).toBe(EDGE_SPEED)
    expect(edgeVelocity(500, EDGE_ZONE / 2)).toBeCloseTo(EDGE_SPEED / 2)
  })

  // Effleurer le bord fait avancer doucement, s'y coller fait avancer vite.
  it('accélère à mesure que le pointeur s’enfonce dans la bande', () => {
    const light = edgeVelocity(500, EDGE_ZONE - 5)
    const deep = edgeVelocity(500, 5)
    expect(deep).toBeGreaterThan(light)
    expect(light).toBeGreaterThan(0)
  })

  // Un pointeur sorti du cadre donne une distance négative : la vitesse doit
  // rester bornée plutôt que de s'emballer.
  it('plafonne quand le pointeur sort du cadre', () => {
    expect(edgeVelocity(500, -300)).toBe(EDGE_SPEED)
    expect(edgeVelocity(-300, 500)).toBe(-EDGE_SPEED)
  })
})

describe('nearestRow', () => {
  const rows = [
    { id: 'a', y: 0, height: 100 },
    { id: 'b', y: 100, height: 100 },
    { id: 'c', y: 200, height: 100 },
  ]

  it('rend la ligne qui contient le point', () => {
    expect(nearestRow(rows, 50)).toBe('a')
    expect(nearestRow(rows, 150)).toBe('b')
    expect(nearestRow(rows, 250)).toBe('c')
  })

  // Glisser sous la dernière équipe veut manifestement dire « celle-ci » :
  // exiger un survol exact ferait retomber le bloc sans explication.
  it('rend la plus proche au-delà des bornes', () => {
    expect(nearestRow(rows, 900)).toBe('c')
    expect(nearestRow(rows, -400)).toBe('a')
  })

  it('rend null quand il n’y a aucune ligne', () => {
    expect(nearestRow([], 50)).toBeNull()
  })
})
