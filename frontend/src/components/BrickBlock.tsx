import { fmt, MONTHS, windowLabel } from '../lib/format'
import type { BlockStyle } from '../lib/layout'
import type { Brick, Theme } from '../types'
import { Icon, ICONS } from './Icon'

/** Neutral palette for absences, which carry no theme. */
export const ABSENCE_LOOK = {
  base: '#71717a',
  tint: 'var(--line-soft)',
  ink: 'var(--muted)',
  line: 'var(--line-strong)',
  iconPath: ICONS.absence,
}

/** Colours and glyph for a brick: its theme, or the neutral absence look. */
export function lookOf(brick: Brick, themes: Theme[]) {
  if (brick.kind === 'absence') return ABSENCE_LOOK
  const theme = themes.find((t) => t.id === brick.themeId) ?? themes[0]
  return {
    base: theme?.base ?? ABSENCE_LOOK.base,
    tint: theme?.tint ?? ABSENCE_LOOK.tint,
    ink: theme?.ink ?? ABSENCE_LOOK.ink,
    line: theme?.line ?? ABSENCE_LOOK.line,
    iconPath: theme?.iconPath ?? '',
  }
}

/** Below this height there is no room for a second line of content. */
const SHORT_BRICK = 34

export interface BrickBlockProps {
  brick: Brick
  themes: Theme[]
  /** Absolute position within its row, in pixels. */
  box: { left: number; top: number; width: number; height: number }
  blockStyle: BlockStyle
  /** Review mode shows which team owns the brick and disables editing. */
  review: boolean
  teamName: string
  selected: boolean
  hovered: boolean
  /** Filtered out or unrelated to what is hovered: present but pushed back. */
  dimmed: boolean
  dragging: boolean
  dragOffset: { dx: number; dy: number }
  onPointerDown: (event: React.PointerEvent) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  onResizeEtp: (event: React.PointerEvent) => void
  onResizeWindow: (event: React.PointerEvent) => void
  onStartLink: (event: React.PointerEvent) => void
}

/**
 * One block on the grid.
 *
 * Its two dimensions are the data: height is load, width is the window it
 * spans. That is why the resize handles edit the brick directly instead of
 * opening a form — the shape and the plan are the same thing.
 */
export function BrickBlock({
  brick,
  themes,
  box,
  blockStyle,
  review,
  teamName,
  selected,
  hovered,
  dimmed,
  dragging,
  dragOffset,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onResizeEtp,
  onResizeWindow,
  onStartLink,
}: BrickBlockProps) {
  const absence = brick.kind === 'absence'
  const look = lookOf(brick, themes)
  const solid = blockStyle === 'solid' && !absence
  const short = box.height - 4 < SHORT_BRICK

  const fill = solid ? look.base : absence ? 'var(--line-soft)' : look.tint
  const ink = solid ? '#ffffff' : look.ink

  // Long titles get as many lines as the block's height can carry.
  const clamp = box.height < 62 ? 1 : box.height < 96 ? 2 : 3

  return (
    <div
      data-brick={brick.id}
      title={`${brick.title} · ${fmt(brick.etp)} ETP · ${windowLabel(brick.startMonth, brick.duration)}`}
      onPointerDown={review ? undefined : onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height - 4,
        background: fill,
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        border: `1px ${absence ? 'dashed' : 'solid'} ${
          absence ? 'var(--line)' : solid ? 'transparent' : look.line
        }`,
        cursor: review ? 'default' : dragging ? 'grabbing' : 'grab',
        boxShadow: selected
          ? '0 0 0 2px var(--accent), 0 6px 16px rgb(24 24 27 / .14)'
          : hovered
            ? '0 4px 14px rgb(24 24 27 / .12)'
            : '0 1px 1px rgb(24 24 27 / .04)',
        // A dragged brick stays visible in place as a faded original, so the
        // row it is leaving does not appear to lose a block mid-gesture.
        opacity: dragging ? 0.55 : dimmed ? 0.2 : 1,
        transform: dragging ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` : 'none',
        zIndex: dragging ? 50 : selected ? 14 : hovered ? 12 : 3,
        transition: dragging ? 'none' : 'opacity 130ms, box-shadow 130ms',
      }}
    >
      <div
        style={{
          width: 3,
          flex: 'none',
          background: absence
            ? 'repeating-linear-gradient(135deg, #a1a1aa 0 3px, transparent 3px 6px)'
            : solid
              ? 'rgba(255,255,255,.55)'
              : look.base,
        }}
      />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: short ? 'row' : 'column',
          alignItems: short ? 'center' : 'stretch',
          justifyContent: 'space-between',
          gap: short ? 6 : 3,
          padding: short ? '0 8px' : '6px 9px',
        }}
      >
        <div
          style={
            short
              ? {
                  font: "600 11.5px/1.2 var(--sans)",
                  letterSpacing: '-0.005em',
                  color: ink,
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }
              : {
                  font: `600 ${review ? '13.5px' : '12.5px'}/1.28 var(--sans)`,
                  letterSpacing: '-0.01em',
                  color: ink,
                  display: '-webkit-box',
                  WebkitLineClamp: clamp,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden',
                }
          }
        >
          {brick.title}
        </div>

        {short ? null : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
            <span
              style={{
                font: "500 10.5px/1 var(--mono)",
                fontVariantNumeric: 'tabular-nums',
                color: ink,
                opacity: 0.85,
                flex: 'none',
              }}
            >
              {fmt(brick.etp)}
            </span>
            {review ? (
              <span
                style={{
                  font: "400 11px/1 var(--sans)",
                  color: ink,
                  opacity: 0.7,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {teamName}
              </span>
            ) : null}
            <span style={{ flex: 1 }} />
            {brick.link && !absence ? (
              <Icon
                path={ICONS.externalLink}
                size={11}
                viewBox="0 0 12 12"
                strokeWidth={1.2}
                style={{ color: ink, opacity: 0.6 }}
              />
            ) : null}
            {look.iconPath ? (
              <Icon
                path={look.iconPath}
                size={12}
                strokeWidth={1.35}
                style={{ color: ink, opacity: 0.55 }}
              />
            ) : null}
          </div>
        )}
      </div>

      {/*
        Handles appear only on hover, and only outside review mode. Showing
        three grips on every one of fifty bricks would bury the plan under its
        own controls.
      */}
      {hovered && !review ? (
        <>
          <div
            onPointerDown={onResizeEtp}
            title="Hauteur = charge (crans de 0,5 ETP)"
            style={{
              position: 'absolute',
              top: -4,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 34,
              height: 8,
              borderRadius: 99,
              background: 'var(--ink)',
              border: '1.5px solid #fff',
              cursor: 'ns-resize',
              zIndex: 4,
            }}
          />
          <div
            onPointerDown={onResizeWindow}
            title="Largeur = durée en mois"
            style={{
              position: 'absolute',
              right: -4,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 8,
              height: 26,
              borderRadius: 99,
              background: 'var(--ink)',
              border: '1.5px solid #fff',
              cursor: 'ew-resize',
              zIndex: 4,
            }}
          />
          <div
            onPointerDown={onStartLink}
            title="Tirer une dépendance"
            style={{
              position: 'absolute',
              left: -7,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 13,
              height: 13,
              borderRadius: 99,
              background: 'var(--accent)',
              border: '2px solid #fff',
              cursor: 'crosshair',
              boxShadow: '0 1px 3px rgb(24 24 27 / .25)',
              zIndex: 4,
            }}
          />
        </>
      ) : null}
    </div>
  )
}

/** Outline showing where a dragged brick would land. */
export function LandingGhost({
  left,
  width,
  height,
  bottom,
  label,
}: {
  left: number
  width: number
  height: number
  bottom: number
  label: string
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left,
        bottom,
        width,
        height,
        border: '1.5px dashed var(--accent)',
        borderRadius: 8,
        background: 'var(--accent-soft)',
        display: 'flex',
        alignItems: 'flex-start',
        padding: 4,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          padding: '2px 6px',
          borderRadius: 5,
          background: 'var(--accent)',
          color: '#fff',
          font: "500 10.5px/1.4 var(--mono)",
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export { MONTHS }
