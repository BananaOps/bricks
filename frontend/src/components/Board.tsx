import { forwardRef } from 'react'
import { fmt, MONTHS, MONTHS_PER_YEAR, quarters } from '../lib/format'
import type { BlockStyle, Layout, Metrics, ViewMode } from '../lib/layout'
import type { Brick, Team, Theme } from '../types'
import { BoardRow, type Draft } from './BoardRow'
import { DependencyLayer } from './DependencyLayer'

export interface BoardProps {
  layout: Layout
  metrics: Metrics
  view: ViewMode
  blockStyle: BlockStyle
  year: number
  teams: Team[]
  themes: Theme[]
  dependencies: { id: string; fromId: string; toId: string }[]
  showDependencies: boolean
  /** Fractional month position of today's marker, e.g. 8.6 for late September. */
  todayPosition: number | null
  selectedId: string | null
  hoveredId: string | null
  relatedIds: Set<string>
  themeFilter: string | null
  /** Show only teams over capacity. */
  focusOverload: boolean
  draft: Draft | null
  dragging: { id: string; dx: number; dy: number; targetMonth: number; targetTeam: string } | null
  draggingBrick: Brick | null
  pendingLink: { fromId: string; x: number; y: number } | null
  gridRef: React.RefObject<HTMLDivElement | null>
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

/**
 * The scrolling grid: quarter and month headers, then one row per team or theme.
 *
 * The header and the left label column are sticky in opposite axes, so a team's
 * name and the month a brick sits in both stay readable however far the board
 * is scrolled.
 */
export const Board = forwardRef<HTMLDivElement, BoardProps>(function Board(props, scrollRef) {
  const {
    layout, metrics, view, blockStyle, year, teams, themes, dependencies, showDependencies,
    todayPosition, selectedId, hoveredId, relatedIds, themeFilter, focusOverload, draft,
    dragging, draggingBrick, pendingLink, gridRef,
  } = props

  const { monthWidth, labelWidth } = metrics
  const review = view === 'review'
  const contentWidth = labelWidth + layout.gridWidth

  return (
    <div
      ref={scrollRef}
      className="bk-scroll"
      style={{
        position: 'relative',
        flex: '1 1 0',
        // minHeight: 0 lets this box shrink to the space its parent has left,
        // so `overflow: auto` actually scrolls rather than the page growing.
        minHeight: 0,
        overflow: 'auto',
        background: 'var(--surface)',
      }}
    >
      <div style={{ position: 'relative', width: contentWidth, minWidth: '100%' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 12,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line-soft)' }}>
            <div style={cornerStyle(labelWidth, '9px 16px')}>
              <span
                style={{
                  font: "500 11px/1 var(--sans)",
                  letterSpacing: '.04em',
                  textTransform: 'uppercase',
                  color: 'var(--muted-2)',
                }}
              >
                {review ? 'Thème' : 'Équipe'}
              </span>
            </div>

            {quarters(year).map((q) => {
              // A quarter's headline number is its average monthly load: a peak
              // would make every quarter containing one busy month look full.
              const months = layout.totalLoad.slice(q.index * 3, q.index * 3 + 3)
              const average = months.reduce((a, b) => a + b, 0) / 3
              const over = [0, 1, 2].some((i) => layout.overloadedMonths.has(q.index * 3 + i))
              return (
                <div
                  key={q.index}
                  style={{
                    width: monthWidth * 3,
                    flex: 'none',
                    padding: '9px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    borderLeft: q.index === 0 ? 'none' : '1px solid var(--line)',
                  }}
                >
                  <span style={{ font: "600 12.5px/1 var(--sans)", letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                    {q.name}
                  </span>
                  <span
                    style={{
                      font: "400 11px/1 var(--mono)",
                      fontVariantNumeric: 'tabular-nums',
                      color: over ? 'var(--danger-ink)' : 'var(--muted-2)',
                    }}
                  >
                    {fmt(average)} / {fmt(layout.totalCapacity)}
                  </span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex' }}>
            <div style={cornerStyle(labelWidth, '7px 16px')}>
              <span style={{ font: "400 11px/1 var(--sans)", color: 'var(--muted-2)' }}>
                {review
                  ? `${layout.rows.length} thèmes`
                  : `${teams.length} squads · ${fmt(layout.totalCapacity)} ETP`}
              </span>
            </div>

            {MONTHS.map((label, month) => {
              const over = layout.overloadedMonths.has(month)
              const now = todayPosition != null && Math.floor(todayPosition) === month
              return (
                <div
                  key={label}
                  style={{
                    width: monthWidth,
                    flex: 'none',
                    padding: '7px 10px',
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 4,
                    borderLeft: month % 3 === 0 && month > 0 ? '1px solid var(--line)' : 'none',
                    background: now ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <span
                    style={{
                      font: `${now ? '600' : '500'} 11.5px/1 var(--sans)`,
                      color: now ? 'var(--accent-strong)' : 'var(--muted)',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      font: "400 10px/1 var(--mono)",
                      fontVariantNumeric: 'tabular-nums',
                      color: over ? 'var(--danger-ink)' : 'var(--muted-2)',
                    }}
                  >
                    {fmt(layout.totalLoad[month] ?? 0)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div ref={gridRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: labelWidth + i * 3 * monthWidth,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'var(--line)',
                zIndex: 7,
                pointerEvents: 'none',
              }}
            />
          ))}

          {todayPosition != null ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: labelWidth + todayPosition * monthWidth,
                top: 0,
                bottom: 0,
                width: 1.5,
                background: 'var(--accent)',
                opacity: 0.5,
                zIndex: 8,
                pointerEvents: 'none',
              }}
            />
          ) : null}

          {showDependencies && !review ? (
            <DependencyLayer
              dependencies={dependencies}
              layout={layout}
              hoveredId={hoveredId}
              labelWidth={labelWidth}
              pending={pendingLink}
            />
          ) : null}

          {layout.rows.map((row, index) => (
            <BoardRow
              key={row.id}
              row={row}
              index={index}
              metrics={metrics}
              blockStyle={blockStyle}
              review={review}
              themes={themes}
              teams={teams}
              selectedId={selectedId}
              hoveredId={hoveredId}
              relatedIds={relatedIds}
              themeFilter={themeFilter}
              faded={!review && focusOverload && !layout.overloadedTeams.has(row.id)}
              draft={draft}
              dragging={dragging}
              draggingBrick={draggingBrick}
              onDraftChange={props.onDraftChange}
              onDraftCommit={props.onDraftCommit}
              onDraftCancel={props.onDraftCancel}
              onOpenDraft={props.onOpenDraft}
              onAddAbsence={props.onAddAbsence}
              onHover={props.onHover}
              onBrickPointerDown={props.onBrickPointerDown}
              onResizeEtp={props.onResizeEtp}
              onResizeWindow={props.onResizeWindow}
              onStartLink={props.onStartLink}
            />
          ))}
        </div>
      </div>
    </div>
  )
})

function cornerStyle(width: number, padding: string): React.CSSProperties {
  return {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    width,
    flex: 'none',
    padding,
    background: 'var(--surface)',
    borderRight: '1px solid var(--line)',
    display: 'flex',
    alignItems: 'center',
  }
}

export { MONTHS_PER_YEAR }
