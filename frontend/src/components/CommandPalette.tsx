import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchIcon } from './Icon'

/** One row of the palette. */
export interface Command {
  id: string
  group: string
  label: string
  meta: string
  dot: string
  run: () => void
}

export interface CommandPaletteProps {
  commands: Command[]
  onClose: () => void
  /** Called when the query matches nothing and the user presses Enter. */
  onCreateFromQuery?: (title: string) => void
}

/**
 * Search-and-act overlay.
 *
 * It searches bricks and teams and runs view commands from the same field,
 * which is what makes ⌘K worth reaching for on a board of fifty blocks — the
 * alternative is scrolling to find the thing, then hunting for the control.
 */
export function CommandPalette({ commands, onClose, onCreateFromQuery }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.meta}`.toLowerCase().includes(q))
  }, [commands, query])

  // A shrinking result list must not leave the highlight pointing past the end.
  const index = Math.min(activeIndex, Math.max(0, matches.length - 1))

  const groups = useMemo(() => {
    const out: { label: string; items: { command: Command; index: number }[] }[] = []
    matches.forEach((command, i) => {
      const group = out.find((g) => g.label === command.group)
      if (group) group.items.push({ command, index: i })
      else out.push({ label: command.group, items: [{ command, index: i }] })
    })
    return out
  }, [matches])

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(Math.min(matches.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const chosen = matches[index]
      if (chosen) chosen.run()
      else if (query.trim() && onCreateFromQuery) onCreateFromQuery(query.trim())
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgb(24 24 27 / .3)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 88,
        zIndex: 80,
        animation: 'bkFade 120ms ease-out',
      }}
    >
      <div
        role="dialog"
        aria-label="Rechercher ou agir"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 560,
          maxWidth: 'calc(100% - 40px)',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgb(24 24 27 / .28)',
          overflow: 'hidden',
          animation: 'bkRise 140ms ease-out',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '14px 16px',
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          <SearchIcon size={15} style={{ color: '#a1a1aa' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Chercher une brique, une équipe, une action…"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              font: "400 15px/1.3 var(--sans)",
              color: 'var(--ink)',
            }}
          />
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 5,
              border: '1px solid var(--line)',
              font: "500 10.5px/1.4 var(--mono)",
              color: 'var(--muted-2)',
            }}
          >
            esc
          </span>
        </div>

        <div className="bk-scroll" style={{ maxHeight: 340, overflowY: 'auto', padding: 8 }}>
          {groups.map((group) => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <div
                style={{
                  padding: '7px 10px 5px',
                  font: "500 10.5px/1 var(--sans)",
                  letterSpacing: '.05em',
                  textTransform: 'uppercase',
                  color: 'var(--muted-2)',
                }}
              >
                {group.label}
              </div>
              {group.items.map(({ command, index: i }) => (
                <div
                  key={command.id}
                  onClick={command.run}
                  onPointerEnter={() => setActiveIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: i === index ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 2.5, background: command.dot, flex: 'none' }} />
                  <span
                    style={{
                      font: "500 13.5px/1.3 var(--sans)",
                      color: 'var(--ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 330,
                    }}
                  >
                    {command.label}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ font: "400 11.5px/1 var(--mono)", color: 'var(--muted-2)', flex: 'none' }}>
                    {command.meta}
                  </span>
                </div>
              ))}
            </div>
          ))}

          {matches.length === 0 ? (
            <div
              style={{
                padding: '26px 12px',
                textAlign: 'center',
                font: "400 13px/1.5 var(--sans)",
                color: 'var(--muted-2)',
              }}
            >
              Aucun résultat. ⏎ crée une brique avec ce titre dans la première équipe.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
