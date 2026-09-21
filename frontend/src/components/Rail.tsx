import type { Route } from '../hooks/useRoute'
import { Icon } from './Icon'
import { Logo } from './Logo'

/**
 * Destinations du rail.
 *
 * Le rail ne montre que des pages qui existent : un bouton inerte apprend au
 * lecteur à ne plus faire confiance à la navigation.
 */
const SECTIONS: { id: Route; label: string; path: string }[] = [
  { id: 'roadmap', label: 'Roadmap', path: 'M2.5 4.5h13M2.5 9h9M2.5 13.5h6' },
  {
    id: 'teams',
    label: 'Équipes',
    path: 'M6.5 8a2.4 2.4 0 100-4.8 2.4 2.4 0 000 4.8zM2 14.5c.6-2.1 2.3-3.4 4.5-3.4s3.9 1.3 4.5 3.4M12 5.2a2 2 0 010 3.9M13.2 14.5c-.2-1.4-.7-2.5-1.5-3.2',
  },
  {
    id: 'themes',
    label: 'Thèmes',
    path: 'M7 1.9l5 2.5-5 2.5-5-2.5zM2 7.5l5 2.5 5-2.5M2 10.2l5 2.5 5-2.5',
  },
]

export interface RailProps {
  active: Route
  onNavigate: (route: Route) => void
}

/** Navigation principale de l'application. */
export function Rail({ active, onNavigate }: RailProps) {
  return (
    <nav
      aria-label="Navigation principale"
      style={{
        width: 60,
        flex: 'none',
        background: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 0 16px',
        gap: 22,
      }}
    >
      <Logo size={30} tone="dark" title="Bricks" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        {SECTIONS.map((section) => {
          const on = section.id === active
          return (
            <button
              key={section.id}
              type="button"
              title={section.label}
              aria-label={section.label}
              aria-current={on ? 'page' : undefined}
              onClick={() => onNavigate(section.id)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: on ? '#fff' : 'var(--muted-2)',
                background: on ? 'var(--ink-2)' : 'transparent',
              }}
            >
              <Icon path={section.path} size={17} viewBox="0 0 18 18" strokeWidth={1.5} />
            </button>
          )
        })}
      </div>

    </nav>
  )
}
