import { describe, expect, it } from 'vitest'
import { clampCapacity, clampEtp, clampWindow, fmt, windowLabel } from './format'

describe('fmt', () => {
  it('écrit les décimales à la française', () => {
    expect(fmt(2.5)).toBe('2,5')
    expect(fmt(3)).toBe('3')
    expect(fmt(0.5)).toBe('0,5')
  })

  it('arrondit au dixième', () => {
    expect(fmt(2.46)).toBe('2,5')
    expect(fmt(1 / 3)).toBe('0,3')
  })
})

describe('windowLabel', () => {
  it('donne un seul mois pour une brique courte', () => {
    expect(windowLabel(0, 1)).toBe('janv.')
  })

  it('donne les deux bornes incluses pour une brique longue', () => {
    expect(windowLabel(0, 5)).toBe('janv. → mai')
  })

  it('ne déborde pas de décembre', () => {
    expect(windowLabel(11, 3)).toBe('déc. → déc.')
  })
})

describe('clampEtp', () => {
  it('cale la charge sur le pas de 0,5', () => {
    expect(clampEtp(1.3)).toBe(1.5)
    expect(clampEtp(1.2)).toBe(1)
  })

  it('respecte les bornes d’une brique', () => {
    expect(clampEtp(0)).toBe(0.5)
    expect(clampEtp(99)).toBe(6)
  })
})

// Une squad peut porter bien plus que la charge maximale d'un seul bloc :
// seul le pas de 0,5 est commun aux deux.
describe('clampCapacity', () => {
  it('va au-delà du plafond d’une brique', () => {
    expect(clampCapacity(12)).toBe(12)
    expect(clampCapacity(7.5)).toBe(7.5)
  })

  it('garde le pas de 0,5', () => {
    expect(clampCapacity(4.3)).toBe(4.5)
  })

  it('respecte ses propres bornes', () => {
    expect(clampCapacity(0)).toBe(0.5)
    expect(clampCapacity(-4)).toBe(0.5)
    expect(clampCapacity(1000)).toBe(100)
  })
})

describe('clampWindow', () => {
  it('rogne une fenêtre qui dépasserait décembre', () => {
    expect(clampWindow(10, 6)).toEqual({ startMonth: 10, duration: 2 })
  })

  it('laisse intacte une fenêtre qui tient dans l’année', () => {
    expect(clampWindow(2, 3)).toEqual({ startMonth: 2, duration: 3 })
  })

  it('ramène un mois hors bornes dans l’année', () => {
    expect(clampWindow(-2, 3)).toEqual({ startMonth: 0, duration: 3 })
    expect(clampWindow(99, 3)).toEqual({ startMonth: 11, duration: 1 })
  })
})
