import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { LOGO_PALETTES } from './Logo'

/**
 * La charte fixe des proportions précises pour l'icône d'application. Le
 * favicon étant un fichier statique, rien ne le relie au composant : ce test
 * tient l'accord entre les deux.
 */
describe('favicon', () => {
  const svg = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8')

  it('respecte le rayon de 26 % du côté', () => {
    // 64 × 0,26 = 16,64
    expect(svg).toContain('rx="16.6"')
  })

  it('laisse une marge de 16 %, soit une marque à 68 %', () => {
    expect(svg).toContain('scale(0.68)')
    // (64 − 64 × 0,68) / 2 = 10,24
    expect(svg).toContain('translate(10.24 10.24)')
  })

  // Le favicon est un fichier statique : rien ne le force à suivre le
  // composant, sinon ce test.
  it('emploie exactement la déclinaison « sur cobalt » de la charte', () => {
    const palette = LOGO_PALETTES.onBlue
    expect(svg).toContain(`M8 24v14l24 14V38z" fill="${palette.left}"`)
    expect(svg).toContain(`M56 24v14L32 52V38z" fill="${palette.right}"`)
    expect(svg).toContain(`M32 10l24 14-24 14L8 24z" fill="${palette.top}"`)
    expect(svg).toContain(`fill="${palette.stud}"`)
    expect(svg).toContain(`fill="${palette.studEdge}"`)
  })

  it('garde les quatre tenons et leur tranche', () => {
    expect(svg.match(/<ellipse/g)).toHaveLength(8)
  })
})
