import { ghostLabel } from '../hooks/useInteraction'
import { fmt, MONTHS_PER_YEAR } from '../lib/format'
import type { BlockStyle, LayoutRow, Metrics } from '../lib/layout'
import type { Brick, Team, Theme } from '../types'
import { BrickBlock, LandingGhost } from './BrickBlock'
import { Icon, ICONS } from './Icon'

/** The quick-add draft open in some cell of the grid. */
export interface Draft {
  rowId: string
  month: number
  text: string
}

export interface BoardRowProps {
  row: LayoutRow
  index: number
  metrics: Metrics
  blockStyle: BlockStyle
  review: boolean
  themes: Theme[]
  teams: Team[]
  selectedId: string | null
  hoveredId: string | null
  relatedIds: Set<string>
  /** Null when no filter is active; otherwise a theme id or 'absence'. */
  themeFilter: string | null
  /** True while only overloaded teams are being shown and this row is not one. */
  faded: boolean
  draft: Draft | null
  dragging: { id: string; dx: number; dy: number; targetMonth: number; targetTeam: string } | null
  /** The brick being dragged, which may have started in a different row. */
  draggingBrick: Brick | null
  onDraftChange: (text: string) => void
  onDraftCommit: () => void
  onDraftCancel: () => void
  onOpenDraft: (rowId: string, month: number) => void
  onAddAbsence: (rowId: string, month: number) => void
  onHover: (id: string | null) => void
  onBrickPointerDown: (event: React.PointerEvent, id: string) => void
  onResizeEtp: (event: React.PointerEvent, id: string) => void
  onResizeWindow: (event: React.PointerEvent, id: string) => void
  onStartLink: (event: React.PointerEvent, id: string) => void
}

/** True when the brick survives the active theme filter. */
function matchesFilter(brick: Brick, filter: string | null): boolean {
  if (!filter) return true
  if (filter === 'absence') return brick.kind === 'absence'
  return brick.kind !== 'absence' && brick.themeId === filter
}

/** One team row (capacity view) or theme row (review view). */
export function BoardRow({
  row,
  index,
  metrics,
  blockStyle,
  review,
  themes,
  teams,
  selectedId,
  hoveredId,
  relatedIds,
  themeFilter,
  faded,
  draft,
  dragging,
  draggingBrick,
  onDraftChange,
  onDraftCommit,
  onDraftCancel,
  onOpenDraft,
  onAddAbsence,
  onHover,
  onBrickPointerDown,
  onResizeEtp,
  onResizeWindow,
  onStartLink,
}: BoardRowProps) {
  const { monthWidth, labelWidth, bottomPadding } = metrics
  const zebra = index % 2 === 1 ? 'var(--surface-alt)' : 'var(--surface)'
  const capacityHeight = row.floorY - row.capacityY

  // The landing ghost belongs to whichever row the drag is currently over,
  // which is often not the row the brick started in.
  const ghostBrick = dragging && !review && dragging.targetTeam === row.id ? draggingBrick : null

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        height: row.height,
        width: labelWidth + monthWidth * MONTHS_PER_YEAR,
        flex: 'none',
        background: zebra,
        borderBottom: '1px solid var(--line-soft)',
        opacity: faded ? 0.35 : 1,
        transition: 'opacity 150ms',
        // The row receiving a drag rises above its neighbours so the landing
        // ghost is not clipped by the row below.
        zIndex: dragging && dragging.targetTeam === row.id ? 30 : 1,
      }}
    >
      <div
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 6,
          width: labelWidth,
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: 6,
          padding: `0 16px ${bottomPadding + 2}px 16px`,
          background: zebra,
          borderRight: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 3,
              flex: 'none',
              background: row.dotColor ?? (row.overloaded ? 'var(--danger)' : 'var(--line-strong)'),
            }}
          />
          <span
            style={{
              font: `${review ? '600 14px' : '500 13px'}/1.3 var(--sans)`,
              color: 'var(--ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {row.name}
          </span>
          {row.overloaded ? (
            <span
              title="Dépassement à la pointe de charge"
              style={{
                padding: '1.5px 6px',
                borderRadius: 99,
                background: 'var(--danger-chip)',
                color: 'var(--danger-ink)',
                font: "600 10px/1.5 var(--mono)",
                fontVariantNumeric: 'tabular-nums',
                flex: 'none',
              }}
            >
              +{fmt(row.peak - (row.capacity ?? 0))}
            </span>
          ) : null}
        </div>

        {row.capacity != null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 15 }}>
            <div
              style={{
                width: 74,
                height: 4,
                borderRadius: 99,
                background: 'var(--line-soft)',
                overflow: 'hidden',
                flex: 'none',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (row.peak / (row.capacity || row.peak || 1)) * 100)}%`,
                  borderRadius: 99,
                  background: row.overloaded ? 'var(--danger)' : '#a1a1aa',
                }}
              />
            </div>
            <span
              style={{
                font: "400 10.5px/1 var(--mono)",
                fontVariantNumeric: 'tabular-nums',
                color: row.overloaded ? 'var(--danger-ink)' : 'var(--muted-2)',
                flex: 'none',
              }}
            >
              {fmt(row.peak)} / {fmt(row.capacity)}
            </span>
          </div>
        ) : null}
      </div>

      <div style={{ position: 'relative', width: monthWidth * MONTHS_PER_YEAR, flex: 'none' }}>
        {/* Months past capacity get a red wash, so overload reads before any number does. */}
        {row.overloadedMonths.map((m) => (
          <div
            key={`over-${m}`}
            style={{
              position: 'absolute',
              left: m * monthWidth,
              top: 0,
              width: monthWidth,
              height: row.height,
              background: 'var(--danger-soft)',
              zIndex: 0,
            }}
          />
        ))}

        {row.capacity != null ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: row.capacityY,
              height: 0,
              borderTop: `1px dashed ${row.overloaded ? '#fca5a5' : 'var(--line)'}`,
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
        ) : null}

        {/* Clicking empty space in a month adds work there — no dialog, no menu. */}
        {!review
          ? Array.from({ length: MONTHS_PER_YEAR }, (_, month) => {
              const free = capacityHeight - (row.stack[month] ?? 0)
              return (
                <div
                  key={`cell-${month}`}
                  className="bk-cell"
                  onClick={() => onOpenDraft(row.id, month)}
                  style={{
                    position: 'absolute',
                    left: month * monthWidth,
                    top: 0,
                    width: monthWidth,
                    height: row.height,
                    cursor: 'copy',
                    zIndex: 1,
                  }}
                >
                  <div
                    className="bk-add"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: row.capacityY + Math.max(2, (free - 26) / 2),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      pointerEvents: 'none',
                    }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        background: 'var(--surface)',
                        border: '1px solid var(--accent-line)',
                        color: 'var(--accent)',
                        boxShadow: '0 1px 2px rgb(24 24 27 / .08)',
                      }}
                    >
                      <Icon path={ICONS.plus} size={11} strokeWidth={1.9} />
                    </span>
                    <span
                      onClick={(event) => {
                        event.stopPropagation()
                        onAddAbsence(row.id, month)
                      }}
                      title="Ajouter une absence"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        background: 'var(--surface)',
                        border: '1px dashed #a1a1aa',
                        color: 'var(--muted-2)',
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgb(24 24 27 / .08)',
                      }}
                    >
                      <Icon path={ICONS.absence} size={11} strokeWidth={1.25} />
                    </span>
                  </div>
                </div>
              )
            })
          : null}

        {row.bricks.map((placed) => {
          const brick = placed.brick
          const team = teams.find((t) => t.id === brick.teamId)
          const isDragging = dragging?.id === brick.id
          return (
            <BrickBlock
              key={brick.id}
              brick={brick}
              themes={themes}
              teamName={team?.name ?? ''}
              box={{
                left: brick.startMonth * monthWidth + 3,
                top: row.floorY - placed.base - placed.height,
                width:
                  Math.min(MONTHS_PER_YEAR - brick.startMonth, brick.duration) * monthWidth - 6,
                height: placed.height,
              }}
              blockStyle={blockStyle}
              review={review}
              selected={!review && selectedId === brick.id}
              hovered={!review && hoveredId === brick.id && !dragging}
              dimmed={
                !matchesFilter(brick, themeFilter) ||
                (hoveredId !== null && !relatedIds.has(brick.id)) ||
                faded
              }
              dragging={Boolean(isDragging)}
              dragOffset={{ dx: dragging?.dx ?? 0, dy: dragging?.dy ?? 0 }}
              onPointerDown={(event) => onBrickPointerDown(event, brick.id)}
              onPointerEnter={() => onHover(brick.id)}
              onPointerLeave={() => onHover(null)}
              onResizeEtp={(event) => onResizeEtp(event, brick.id)}
              onResizeWindow={(event) => onResizeWindow(event, brick.id)}
              onStartLink={(event) => onStartLink(event, brick.id)}
            />
          )
        })}

        {draft && draft.rowId === row.id ? (
          <div
            style={{
              position: 'absolute',
              left: draft.month * monthWidth + 3,
              top:
                row.capacityY +
                Math.max(2, capacityHeight - (row.stack[draft.month] ?? 0) - metrics.unit),
              width: Math.min(MONTHS_PER_YEAR - draft.month, 2) * monthWidth - 6,
              height: metrics.unit - 4,
              background: 'var(--surface)',
              border: '1.5px solid var(--accent)',
              borderRadius: 8,
              padding: '0 9px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 6px 18px rgb(37 99 235 / .18)',
              zIndex: 45,
            }}
          >
            <input
              autoFocus
              value={draft.text}
              placeholder="Nom du sujet, ⏎ pour créer"
              onChange={(event) => onDraftChange(event.target.value)}
              onBlur={onDraftCommit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onDraftCommit()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  onDraftCancel()
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                font: "600 12px/1.3 var(--sans)",
                color: 'var(--ink)',
                padding: 0,
              }}
            />
          </div>
        ) : null}

        {ghostBrick && dragging ? (
          <LandingGhost
            left={dragging.targetMonth * monthWidth + 3}
            bottom={bottomPadding}
            width={
              Math.min(MONTHS_PER_YEAR - dragging.targetMonth, ghostBrick.duration) * monthWidth - 6
            }
            height={ghostBrick.etp * metrics.unit}
            label={ghostLabel(dragging.targetMonth, row.name)}
          />
        ) : null}
      </div>
    </div>
  )
}
