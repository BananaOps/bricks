import { CalendarIcon, Icon, ICONS, SearchIcon } from './Icon'

/** Collaborators shown as a stacked avatar cluster. */
const COLLABORATORS = [
  { initials: 'ML', background: 'var(--accent)', color: '#fff' },
  { initials: 'TD', background: '#0d9488', color: '#fff' },
  { initials: 'AR', background: '#db2777', color: '#fff' },
  { initials: '+5', background: 'var(--line-soft)', color: 'var(--muted)' },
]

export interface TopBarProps {
  roadmapName: string
  viewLabel: string
  onOpenPalette: () => void
}

export function TopBar({ roadmapName, viewLabel, onOpenPalette }: TopBarProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            font: "600 15px/1.2 var(--sans)",
            letterSpacing: '-0.015em',
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
          }}
        >
          {roadmapName}
        </h1>
        <span style={{ font: "400 13px/1.2 var(--sans)", color: 'var(--muted-2)', whiteSpace: 'nowrap' }}>
          {viewLabel}
        </span>
      </div>

      <button type="button" className="bk-search" onClick={onOpenPalette}>
        <SearchIcon style={{ color: '#a1a1aa' }} />
        <span style={{ flex: 1, font: "400 13px/1.2 var(--sans)", color: 'var(--muted-2)' }}>
          Rechercher ou agir…
        </span>
        <span
          style={{
            padding: '2px 5px',
            borderRadius: 5,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            font: "500 10.5px/1.4 var(--mono)",
            color: 'var(--muted-2)',
          }}
        >
          ⌘K
        </span>
      </button>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center' }} aria-label="Collaborateurs">
        {COLLABORATORS.map((person, i) => (
          <div
            key={person.initials}
            title={person.initials}
            style={{
              width: 26,
              height: 26,
              borderRadius: 99,
              marginLeft: -7,
              border: '2px solid #fff',
              background: person.background,
              color: person.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: "600 10.5px/1 var(--sans)",
              zIndex: COLLABORATORS.length - i,
            }}
          >
            {person.initials}
          </div>
        ))}
      </div>

      <button type="button" className="bk-ghost-button">
        <Icon path={ICONS.export} />
        Exporter
      </button>
      <button type="button" className="bk-primary-button">
        Partager
      </button>
    </header>
  )
}

export interface FilterBarProps {
  view: 'capacity' | 'review'
  onViewChange: (view: 'capacity' | 'review') => void
  themes: { id: string; name: string; base: string }[]
  themeFilter: string | null
  onThemeFilterChange: (id: string | null) => void
  showDependencies: boolean
  onToggleDependencies: () => void
  onGoToToday: () => void
}

/** View switch, theme filter chips, and the dependency toggle. */
export function FilterBar({
  view,
  onViewChange,
  themes,
  themeFilter,
  onThemeFilterChange,
  showDependencies,
  onToggleDependencies,
  onGoToToday,
}: FilterBarProps) {
  const tabs = [
    { id: 'capacity' as const, label: 'Capacité' },
    { id: 'review' as const, label: 'Revue' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        rowGap: 9,
        gap: 14,
        padding: '9px 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div
        role="tablist"
        aria-label="Vue"
        style={{ display: 'flex', padding: 3, gap: 2, borderRadius: 9, background: 'var(--line-soft)' }}
      >
        {tabs.map((tab) => {
          const on = view === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onViewChange(tab.id)}
              style={{
                padding: '5px 13px',
                borderRadius: 7,
                font: "500 12.5px/1.3 var(--sans)",
                background: on ? 'var(--surface)' : 'transparent',
                color: on ? 'var(--ink)' : 'var(--muted-2)',
                boxShadow: on ? '0 1px 2px rgb(24 24 27 / .1)' : 'none',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--line)' }} />

      <div
        style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, flex: '1 1 300px', minWidth: 0 }}
      >
        {themes.map((theme) => {
          const on = themeFilter === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={on}
              onClick={() => onThemeFilterChange(on ? null : theme.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px 4px 8px',
                borderRadius: 99,
                font: "500 12px/1.3 var(--sans)",
                whiteSpace: 'nowrap',
                border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                background: on ? 'var(--ink)' : 'var(--surface)',
                color: on ? '#fff' : 'var(--muted)',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2.5, background: theme.base, flex: 'none' }} />
              {theme.name}
            </button>
          )
        })}

        <button
          type="button"
          aria-pressed={themeFilter === 'absence'}
          onClick={() => onThemeFilterChange(themeFilter === 'absence' ? null : 'absence')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px 4px 8px',
            borderRadius: 99,
            font: "500 12px/1.3 var(--sans)",
            whiteSpace: 'nowrap',
            border: `1px dashed ${themeFilter === 'absence' ? 'var(--ink)' : 'var(--line-strong)'}`,
            background: themeFilter === 'absence' ? 'var(--ink)' : 'var(--surface)',
            color: themeFilter === 'absence' ? '#fff' : 'var(--muted)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: 'repeating-linear-gradient(135deg, #d4d4d8 0 2px, #fff 2px 4px)',
              flex: 'none',
            }}
          />
          Absences
        </button>

        {themeFilter ? (
          <button
            type="button"
            onClick={() => onThemeFilterChange(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 99,
              font: "500 12px/1 var(--sans)",
              color: 'var(--muted-2)',
            }}
          >
            <Icon path={ICONS.close} size={10} viewBox="0 0 12 12" strokeWidth={1.5} />
            Tout afficher
          </button>
        ) : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={showDependencies}
        onClick={onToggleDependencies}
        style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}
      >
        <span
          style={{
            width: 26,
            height: 15,
            borderRadius: 99,
            padding: 2,
            background: showDependencies ? 'var(--accent)' : 'var(--line-strong)',
            transition: 'background 120ms',
            flex: 'none',
          }}
        >
          <span
            style={{
              display: 'block',
              width: 11,
              height: 11,
              borderRadius: 99,
              background: '#fff',
              transform: showDependencies ? 'translateX(11px)' : 'translateX(0)',
              transition: 'transform 120ms',
            }}
          />
        </span>
        <span
          style={{
            font: "500 12.5px/1 var(--sans)",
            color: showDependencies ? 'var(--ink)' : 'var(--muted-2)',
          }}
        >
          Liens
        </span>
      </button>

      <button
        type="button"
        className="bk-ghost-button"
        onClick={onGoToToday}
        style={{ padding: '6px 11px', font: "500 12.5px/1 var(--sans)" }}
      >
        <CalendarIcon />
        Aujourd’hui
      </button>
    </div>
  )
}
