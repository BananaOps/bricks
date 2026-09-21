import { Icon, ICONS } from './Icon'

export interface OverloadBannerProps {
  teamCount: number
  /** Month indices over capacity, ascending. */
  months: number[]
  monthLabels: readonly string[]
  focused: boolean
  onToggleFocus: () => void
}

/**
 * Standing alert for teams past their ceiling.
 *
 * It sits above the grid rather than inside it because overload is a property
 * of the whole plan, and the one action that helps — hiding every row that is
 * fine — belongs next to the statement of the problem.
 */
export function OverloadBanner({
  teamCount,
  months,
  monthLabels,
  focused,
  onToggleFocus,
}: OverloadBannerProps) {
  const first = months[0]
  const last = months[months.length - 1]
  const range =
    months.length === 0
      ? ''
      : months.length > 1
        ? `${monthLabels[first!]} → ${monthLabels[last!]}`
        : (monthLabels[first!] ?? '')

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '9px 20px',
        background: 'var(--danger-soft)',
        borderBottom: '1px solid var(--danger-line)',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 17,
          height: 17,
          borderRadius: 99,
          background: 'var(--danger)',
          color: '#fff',
          font: "700 11px/1 var(--sans)",
          flex: 'none',
        }}
      >
        !
      </span>
      <span style={{ font: "600 12.5px/1.3 var(--sans)", color: 'var(--danger-ink)' }}>
        {teamCount} équipe{teamCount > 1 ? 's dépassent leur capacité' : ' dépasse sa capacité'}
      </span>
      <span style={{ font: "400 12.5px/1.3 var(--sans)", color: 'var(--danger)', whiteSpace: 'nowrap' }}>
        {range}
      </span>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onToggleFocus}
        aria-pressed={focused}
        style={{
          padding: '5px 11px',
          borderRadius: 7,
          whiteSpace: 'nowrap',
          font: "600 12px/1.3 var(--sans)",
          background: focused ? 'var(--danger-ink)' : 'var(--surface)',
          color: focused ? '#fff' : 'var(--danger-ink)',
          border: `1px solid ${focused ? 'var(--danger-ink)' : 'var(--danger-line)'}`,
        }}
      >
        {focused ? 'Tout afficher' : 'Isoler'}
      </button>
    </div>
  )
}

/** Keyboard shortcuts advertised in the status bar. */
const HINTS = [
  { key: '⌘K', label: 'Chercher / agir' },
  { key: '← →', label: 'Décaler d’un mois' },
  { key: '⇧← →', label: 'Durée' },
  { key: '↑ ↓', label: 'Charge' },
]

export function StatusBar({ summary }: { summary: string }) {
  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 20px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
      }}
    >
      <span
        style={{
          font: "400 11.5px/1.3 var(--mono)",
          color: 'var(--muted-2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {summary}
      </span>
      <span style={{ flex: 1 }} />
      {HINTS.map((hint) => (
        <div key={hint.key} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <span className="bk-kbd">{hint.key}</span>
          <span style={{ font: "400 11.5px/1 var(--sans)", color: 'var(--muted-2)' }}>{hint.label}</span>
        </div>
      ))}
    </footer>
  )
}

export interface ToastBarProps {
  text: string
  tone: 'info' | 'error'
  canUndo: boolean
  onUndo: () => void
}

/**
 * Transient confirmation of the last edit.
 *
 * Every mutation is one gesture away from being wrong, so the toast carries the
 * undo rather than making the user find it. Failures skip it: there is nothing
 * to undo when nothing was saved.
 */
export function ToastBar({ text, tone, canUndo, onUndo }: ToastBarProps) {
  const error = tone === 'error'
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 52,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '9px 11px 9px 14px',
        borderRadius: 10,
        background: error ? 'var(--danger-ink)' : 'var(--ink)',
        boxShadow: '0 8px 24px rgb(24 24 27 / .28)',
        animation: 'bkRise 160ms ease-out',
        zIndex: 60,
      }}
    >
      {error ? <Icon path={ICONS.close} size={12} style={{ color: '#fff' }} /> : null}
      <span
        style={{
          font: "500 12.5px/1.3 var(--sans)",
          color: error ? '#fff' : 'var(--line-soft)',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
      {!error && canUndo ? (
        <button
          type="button"
          onClick={onUndo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '4px 9px',
            borderRadius: 7,
            background: 'var(--ink-2)',
            color: '#fff',
            font: "500 12px/1 var(--sans)",
            whiteSpace: 'nowrap',
          }}
        >
          Annuler
          <span style={{ font: "500 10px/1.4 var(--mono)", color: 'var(--muted-2)' }}>⌘Z</span>
        </button>
      ) : null}
    </div>
  )
}
