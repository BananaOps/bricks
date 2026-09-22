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
      /**
       * Défilement du cadre au moment de la prise.
       *
       * Le bloc vit dans le contenu qui défile : si la grille avance sous un
       * pointeur immobile, le bloc recule d'autant à l'écran. Les déplacements
       * ci-dessous cumulent donc le trajet du pointeur et celui du défilement,
       * faute de quoi le bloc se décrocherait du curseur.
       */
      startScrollLeft: number
      startScrollTop: number
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

/**
 * Largeur de la bande, le long des bords du cadre, qui entraîne le défilement.
 *
 * Sans elle, un bloc ne peut rejoindre que les mois déjà visibles : sur une
 * fenêtre étroite, décembre devient tout simplement inatteignable à la souris.
 */
export const EDGE_ZONE = 72

/** Vitesse maximale du défilement de bord, en pixels par image. */
export const EDGE_SPEED = 20

/**
 * Vitesse de défilement sur un axe, d'après la distance aux deux bords.
 *
 * Elle croît à mesure que le pointeur s'enfonce dans la bande : effleurer le
 * bord fait avancer doucement, s'y coller fait avancer vite.
 */
export function edgeVelocity(distanceToStart: number, distanceToEnd: number): number {
  if (distanceToStart < EDGE_ZONE) {
    return -EDGE_SPEED * Math.min(1, (EDGE_ZONE - distanceToStart) / EDGE_ZONE)
  }
  if (distanceToEnd < EDGE_ZONE) {
    return EDGE_SPEED * Math.min(1, (EDGE_ZONE - distanceToEnd) / EDGE_ZONE)
  }
  return 0
}

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
/**
 * Ligne visée par un point vertical donné.
 *
 * Au-delà de la première et de la dernière, la plus proche l'emporte plutôt que
 * rien : glisser sous la dernière équipe veut manifestement dire « celle-ci »,
 * et exiger un survol exact ferait retomber le bloc à sa place sans explication.
 */
export function nearestRow(rows: Layout['rowOffsets'], y: number): string | null {
  let best: { id: string; distance: number } | null = null
  for (const row of rows) {
    if (y >= row.y && y <= row.y + row.height) return row.id
    const distance = y < row.y ? row.y - y : y - (row.y + row.height)
    if (!best || distance < best.distance) best = { id: row.id, distance }
  }
  return best?.id ?? null
}

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
  /** Le cadre défilant, pour entraîner la grille quand on glisse vers un bord. */
  scrollRef: React.RefObject<HTMLDivElement | null>,
  callbacks: InteractionCallbacks,
): InteractionApi {
  const [interaction, setInteraction] = useState<Interaction | null>(null)

  /** Dernière position connue du pointeur, relue par la boucle de défilement. */
  const pointer = useRef({ x: 0, y: 0 })

  /**
   * Amplitude de défilement du cadre, relevée au début du geste.
   *
   * Un bloc en cours de glisser porte un `transform` qui étend la zone
   * défilable du conteneur : plus il s'éloigne, plus le cadre croit pouvoir
   * défiler, et la grille file dans le vide. Le maximum est donc figé avant
   * qu'un transform n'entre en jeu, et le défilement s'y tient.
   */
  const scrollBounds = useRef({ maxLeft: 0, maxTop: 0 })

  const captureScrollBounds = useCallback(() => {
    const el = scrollRef.current
    scrollBounds.current = el
      ? {
          maxLeft: Math.max(0, el.scrollWidth - el.clientWidth),
          maxTop: Math.max(0, el.scrollHeight - el.clientHeight),
        }
      : { maxLeft: 0, maxTop: 0 }
  }, [scrollRef])

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
    let edgeFrame: number | null = null

    /**
     * Recalcule l'état du geste pour une position de pointeur donnée.
     *
     * Séparé de l'écouteur : la boucle de défilement de bord doit le rejouer
     * alors que le pointeur n'a pas bougé, puisque c'est la grille qui avance
     * sous lui.
     */
    function updateFrom(clientX: number, clientY: number) {
      const active = current.current
      if (!active) return
      const { metrics: m } = latest.current
      const l = layoutRef.current
      const scroller = scrollRef.current

      switch (active.mode) {
        case 'drag': {
          const brick = latest.current.bricks.find((b) => b.id === active.id)
          if (!brick) return

          // Trajet du pointeur, augmenté de ce que la grille a défilé depuis la
          // prise : sans ce cumul, le bloc se décrocherait du curseur dès que
          // le défilement de bord entre en jeu.
          const dx =
            clientX - active.startX + ((scroller?.scrollLeft ?? 0) - active.startScrollLeft)
          const dy =
            clientY - active.startY + ((scroller?.scrollTop ?? 0) - active.startScrollTop)

          // The row under the brick's centre wins, not the row under the
          // cursor: the pointer often sits near an edge while the block as a
          // whole is plainly over one row.
          const box = l.boxes[active.id]
          let targetTeam = active.targetTeam
          if (box) {
            const centre = box.y + dy + box.height / 2
            targetTeam = nearestRow(l.rowOffsets, centre) ?? targetTeam
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
          const steps = Math.round((active.startY - clientY) / (m.unit / 2)) * 0.5
          setInteraction({ ...active, etp: clampEtp(active.originEtp + steps) })
          return
        }

        case 'resize-window': {
          const brick = latest.current.bricks.find((b) => b.id === active.id)
          if (!brick) return
          const months = Math.round((clientX - active.startX) / m.monthWidth)
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
            x: clientX - origin.left - m.labelWidth,
            y: clientY - origin.top,
          })
        }
      }
    }

    /**
     * Entraîne la grille quand le geste approche d'un bord du cadre.
     *
     * La boucle ne tourne que pendant un glisser ou un tracé de lien, et
     * s'arrête d'elle-même dès que le pointeur quitte les bandes de bord.
     */
    function edgeStep() {
      edgeFrame = null
      const active = current.current
      const scroller = scrollRef.current
      if (!active || !scroller) return
      if (active.mode !== 'drag' && active.mode !== 'link') return

      const rect = scroller.getBoundingClientRect()
      const { x, y } = pointer.current
      const vx = edgeVelocity(x - rect.left, rect.right - x)
      const vy = edgeVelocity(y - rect.top, rect.bottom - y)

      if (vx !== 0 || vy !== 0) {
        const before = { left: scroller.scrollLeft, top: scroller.scrollTop }
        const { maxLeft, maxTop } = scrollBounds.current
        // Bornes relevées avant le geste, et non lues à l'instant : le bloc
        // translaté aurait sinon repoussé la limite au fil du glisser.
        scroller.scrollLeft = Math.min(maxLeft, Math.max(0, before.left + vx))
        scroller.scrollTop = Math.min(maxTop, Math.max(0, before.top + vy))
        // Rejouer le geste après un défilement effectif seulement : en butée,
        // l'état n'a pas changé et un rendu de plus n'apporterait rien.
        if (scroller.scrollLeft !== before.left || scroller.scrollTop !== before.top) {
          updateFrom(x, y)
        }
      }

      edgeFrame = requestAnimationFrame(edgeStep)
    }

    function onPointerMove(event: PointerEvent) {
      pointer.current = { x: event.clientX, y: event.clientY }
      if (!current.current) return
      updateFrom(event.clientX, event.clientY)
      if (edgeFrame === null) edgeFrame = requestAnimationFrame(edgeStep)
    }

    function onPointerUp(event: PointerEvent) {
      if (edgeFrame !== null) {
        cancelAnimationFrame(edgeFrame)
        edgeFrame = null
      }
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
      if (edgeFrame !== null) cancelAnimationFrame(edgeFrame)
    }
  }, [gridOrigin, layoutRef, scrollRef])

  const startDrag = useCallback(
    (event: React.PointerEvent, id: string) => {
      event.stopPropagation()
      const brick = brickById(id)
      if (!brick) return
      pointer.current = { x: event.clientX, y: event.clientY }
      captureScrollBounds()
      setInteraction({
        mode: 'drag',
        id,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: scrollRef.current?.scrollLeft ?? 0,
        startScrollTop: scrollRef.current?.scrollTop ?? 0,
        dx: 0,
        dy: 0,
        targetMonth: brick.startMonth,
        targetTeam: brick.teamId,
        moved: false,
      })
    },
    [brickById, captureScrollBounds, scrollRef],
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
      pointer.current = { x: event.clientX, y: event.clientY }
      captureScrollBounds()
      const origin = gridOrigin()
      setInteraction({
        mode: 'link',
        id,
        x: event.clientX - origin.left - metrics.labelWidth,
        y: event.clientY - origin.top,
      })
    },
    [captureScrollBounds, gridOrigin, metrics.labelWidth],
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
