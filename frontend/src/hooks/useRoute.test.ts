import { describe, expect, it } from 'vitest'
import { pathOf } from './useRoute'

describe('pathOf', () => {
  it('donne un fragment distinct par destination', () => {
    const paths = (['roadmap', 'teams', 'themes'] as const).map(pathOf)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('ancre la roadmap à la racine', () => {
    expect(pathOf('roadmap')).toBe('#/')
  })
})
