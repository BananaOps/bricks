import { dependencyPath, type Layout } from '../lib/layout'
import type { Dependency } from '../types'

export interface DependencyLayerProps {
  dependencies: Dependency[]
  layout: Layout
  /** Brick under the pointer; its links come forward and the rest recede. */
  hoveredId: string | null
  labelWidth: number
  /** Endpoint of a link currently being dragged, in grid coordinates. */
  pending: { fromId: string; x: number; y: number } | null
}

/**
 * Dependency arrows, drawn as two SVG layers.
 *
 * Quiet links go underneath the bricks and highlighted ones on top: an arrow
 * that matters should not be interrupted by the blocks it passes over, while
 * forty background arrows crossing every brick would make the grid unreadable.
 */
export function DependencyLayer({
  dependencies,
  layout,
  hoveredId,
  labelWidth,
  pending,
}: DependencyLayerProps) {
  const quiet: { key: string; curve: string; arrow: string; opacity: number }[] = []
  const loud: { key: string; curve: string; arrow: string }[] = []

  for (const dep of dependencies) {
    const from = layout.boxes[dep.fromId]
    const to = layout.boxes[dep.toId]
    // In review mode, or under a theme filter, one end may not be on screen.
    if (!from || !to) continue

    const geometry = dependencyPath(from, to)
    if (hoveredId === dep.fromId || hoveredId === dep.toId) {
      loud.push({ key: dep.id, ...geometry })
    } else {
      // Hovering a brick pushes every unrelated arrow far back rather than
      // hiding it, so the surrounding structure stays perceptible.
      quiet.push({ key: dep.id, ...geometry, opacity: hoveredId ? 0.12 : 0.5 })
    }
  }

  if (pending) {
    const from = layout.boxes[pending.fromId]
    if (from) {
      // The live link leaves the brick's left edge and follows the pointer.
      loud.push({
        key: 'pending',
        curve: `M${from.x} ${from.centerY} C${from.x - 45} ${from.centerY} ${pending.x + 45} ${pending.y} ${pending.x} ${pending.y}`,
        arrow: '',
      })
    }
  }

  const frame = {
    position: 'absolute' as const,
    left: labelWidth,
    top: 0,
    width: layout.gridWidth,
    height: layout.totalHeight,
    pointerEvents: 'none' as const,
    overflow: 'visible' as const,
  }
  const viewBox = `0 0 ${layout.gridWidth} ${layout.totalHeight}`

  return (
    <>
      <svg style={{ ...frame, zIndex: 0 }} viewBox={viewBox} aria-hidden>
        {quiet.map((d) => (
          <g key={d.key}>
            <path d={d.curve} fill="none" stroke="#a1a1aa" strokeWidth={1.5} strokeOpacity={d.opacity} />
            <path d={d.arrow} fill="#a1a1aa" fillOpacity={d.opacity} />
          </g>
        ))}
      </svg>

      <svg style={{ ...frame, zIndex: 20 }} viewBox={viewBox} aria-hidden>
        {loud.map((d) => (
          <g key={d.key}>
            <path d={d.curve} fill="none" stroke="var(--accent)" strokeWidth={2} />
            {d.arrow ? <path d={d.arrow} fill="var(--accent)" /> : null}
          </g>
        ))}
      </svg>
    </>
  )
}
