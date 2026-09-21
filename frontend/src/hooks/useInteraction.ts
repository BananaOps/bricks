import { useCallback, useEffect, useRef, useState } from 'react'
import { clampEtp, MONTHS, MONTHS_PER_YEAR } from '../lib/format'
import type { Layout, Metrics } from '../lib/layout'
import type { Brick } from '../types'

/**
 * A pointer gesture in flight.
 *
 * Gestures live here rather than in board state so the grid stays truthful:
 * nothing is written until the pointer comes up, and an abandoned drag leaves
 * no trace.
 */
export type Interaction =
  | {
      mode: 'drag'
      id: string
      startX: number
      startY: number
      dx: number
      dy: number
      /** Where the brick would land if released now. */
      targetMonth: number
      targetTeam: string
      /** False until the pointer travels far enough to count as a drag. */
      moved: boolean
    }
  | { mode: 'resize-etp'; id: string; startY: number; originEtp: number; etp: number }
  | { mode: 'resize-window'; id: string; startX: number; originDuration: number; duration: number }
  | { mode: 'link'; id: string; x: number; y: number }

/** Pointer travel, in pixels, that separates a click from a drag. */
const DRAG_THRESHOLD = 4

export interface InteractionCallbacks {
  /** The pointer came up on a brick without moving: treat it as a selection. */
  onClick: (id: string) => void
  onMove: (id: string, teamId: string, startMonth: number) => void
  onResizeEtp: (id: string, etp: number) => void
  onResizeWindow: (id: string, duration: number) => void
  onLink: (fromId: string, toId: string) => void
}

export interface InteractionApi {
  interaction: Interaction | null
  startDrag: (event: React.PointerEvent, id: string) => void
  startResizeEtp: (event: React.PointerEvent, id: string) => void
  startResizeWindow: (event: React.PointerEvent, id: string) => void
  startLink: (event: React.PointerEvent, id: string) => void
}

/**
 * Turns pointer gestures on the grid into board edits.
 *
 * Listeners sit on the window, not the brick, so a fast drag that outruns the
 * cursor still tracks and still commits when the button is released outside the
 * element it started on.
 */
export function useInteraction(
  bricks: Brick[],
  /**
   * The current layout, read lazily.
   *
   * It arrives as a ref rather than a value because the layout depends on the
   * gesture in flight — a resize repacks its row live — so computing it before
   * this hook runs would be circular. Pointer handlers only ever read it after
   * a render has committed, by which point the ref is current.
   */
  layoutRef: React.RefObject<Layout>,
  metrics: Metrics,
  gridRef: React.RefObject<HTMLDivElement | null>,
  callbacks: InteractionCallbacks,
): InteractionApi {
  const [interaction, setInteraction] = useState<Interaction | null>(null)

  // Mutable mirrors keep the window listeners free of stale closures without
  // re-subscribing on every render.
  const latest = useRef({ bricks, metrics, callbacks })
  latest.current = { bricks, metrics, callbacks }

  const current = useRef<Interaction | null>(null)
  current.current = interaction

  const brickById = useCallback(
    (id: string) => latest.current.bricks.find((b) => b.id === id),
    [],
  )

  const gridOrigin = useCallback(() => {
    const rect = gridRef.current?.getBoundingClientRect()
    return { left: rect?.left ?? 0, top: rect?.top ?? 0 }
  }, [gridRef])

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const active = current.current
      if (!active) return
      const { metrics: m } = latest.current
      const l = layoutRef.current

      switch (active.mode) {
        case 'drag': {
          const dx = event.clientX - active.startX
          const dy = event.clientY - active.startY
          const brick = latest.current.bricks.find((b) => b.id === active.id)
          if (!brick) return

          // The row under the brick's centre wins, not the row under the
          // cursor: the pointer often sits near an edge while the block as a
          // whole is plainly over one row.
          const box = l.boxes[active.id]
          let targetTeam = active.targetTeam
          if (box) {
            const centre = box.y + dy + box.height / 2
            const row = l.rowOffsets.find((r) => centre >= r.y && centre <= r.y + r.height)
            if (row) targetTeam = row.id
          }

          const months = Math.round(dx / m.monthWidth)
          const targetMonth = Math.max(
            0,
            Math.min(MONTHS_PER_YEAR - brick.duration, brick.startMonth + months),
          )

          setInteraction({
            ...active,
            dx,
            dy,
            targetMonth,
            targetTeam,
            moved:
              active.moved || Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD,
          })
          return
        }

        case 'resize-etp': {
          // Dragging up grows the block, so the sign is inverted; half a row
          // unit per 0.5 ETP keeps the handle tracking the block's own edge.
          const steps = Math.round((active.startY - event.clientY) / (m.unit / 2)) * 0.5
          setInteraction({ ...active, etp: clampEtp(active.originEtp + steps) })
          return
        }

        case 'resize-window': {
          const brick = latest.current.bricks.find((b) => b.id === active.id)
          if (!brick) return
          const months = Math.round((event.clientX - active.startX) / m.monthWidth)
          setInteraction({
            ...active,
            duration: Math.max(
              1,
              Math.min(MONTHS_PER_YEAR - brick.startMonth, active.originDuration + months),
            ),
          })
          return
        }

        case 'link': {
          const origin = gridOrigin()
          setInteraction({
            ...active,
            x: event.clientX - origin.left - m.labelWidth,
            y: event.clientY - origin.top,
          })
        }
      }
    }

    function onPointerUp(event: PointerEvent) {
      const active = current.current
      if (!active) return
      setInteraction(null)

      const { callbacks: cb } = latest.current
      const brick = latest.current.bricks.find((b) => b.id === active.id)
      if (!brick) return

      switch (active.mode) {
        case 'drag': {
          // A press that never travelled is a click, and clicking a brick opens it.
          if (!active.moved) {
            cb.onClick(active.id)
            return
          }
          if (active.targetMonth !== brick.startMonth || active.targetTeam !== brick.teamId) {
            cb.onMove(active.id, active.targetTeam, active.targetMonth)
          }
          return
        }

        case 'resize-etp': {
          if (active.etp !== brick.etp) cb.onResizeEtp(active.id, active.etp)
          return
        }

        case 'resize-window': {
          if (active.duration !== brick.duration) cb.onResizeWindow(active.id, active.duration)
          return
        }

        case 'link': {
          // The drop target is whatever brick sits under the pointer; the DOM
          // knows that far more cheaply than re-deriving it from geometry.
          const element = document.elementFromPoint(event.clientX, event.clientY)
          const host = element?.closest<HTMLElement>('[data-brick]')
          const target = host?.dataset['brick']
          if (target && target !== active.id) cb.onLink(active.id, target)
        }
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [gridOrigin, layoutRef])

  const startDrag = useCallback(
    (event: React.PointerEvent, id: string) => {
      event.stopPropagation()
      const brick = brickById(id)
      if (!brick) return
      setInteraction({
        mode: 'drag',
        id,
        startX: event.clientX,
        startY: event.clientY,
        dx: 0,
        dy: 0,
        targetMonth: brick.startMonth,
        targetTeam: brick.teamId,
        moved: false,
      })
    },
    [brickById],
  )

  const startResizeEtp = useCallback(
    (event: React.PointerEvent, id: string) => {
      event.stopPropagation()
      const brick = brickById(id)
      if (!brick) return
      setInteraction({
        mode: 'resize-etp',
        id,
        startY: event.clientY,
        originEtp: brick.etp,
        etp: brick.etp,
      })
    },
    [brickById],
  )

  const startResizeWindow = useCallback(
    (event: React.PointerEvent, id: string) => {
      event.stopPropagation()
      const brick = brickById(id)
      if (!brick) return
      setInteraction({
        mode: 'resize-window',
        id,
        startX: event.clientX,
        originDuration: brick.duration,
        duration: brick.duration,
      })
    },
    [brickById],
  )

  const startLink = useCallback(
    (event: React.PointerEvent, id: string) => {
      event.stopPropagation()
      const origin = gridOrigin()
      setInteraction({
        mode: 'link',
        id,
        x: event.clientX - origin.left - metrics.labelWidth,
        y: event.clientY - origin.top,
      })
    },
    [gridOrigin, metrics.labelWidth],
  )

  return { interaction, startDrag, startResizeEtp, startResizeWindow, startLink }
}

/**
 * Folds an in-flight resize into the brick list.
 *
 * Resizing has to repack the row live — growing a block pushes its neighbours
 * up — so the preview goes through the layout engine. Dragging does not: it
 * renders as a translated copy plus a landing ghost, leaving the row it came
 * from undisturbed until the drop.
 */
export function applyPreview(bricks: Brick[], interaction: Interaction | null): Brick[] {
  if (!interaction) return bricks
  switch (interaction.mode) {
    case 'resize-etp':
      return bricks.map((b) => (b.id === interaction.id ? { ...b, etp: interaction.etp } : b))
    case 'resize-window':
      return bricks.map((b) =>
        b.id === interaction.id ? { ...b, duration: interaction.duration } : b,
      )
    default:
      return bricks
  }
}

/** Label shown on the landing ghost while dragging: "avr. · Payment". */
export function ghostLabel(month: number, teamName: string): string {
  return `${MONTHS[month] ?? ''} · ${teamName}`
}
