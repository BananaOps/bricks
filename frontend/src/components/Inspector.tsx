import { DURATION_OPTIONS, ETP_LADDER, fmt, MONTHS, windowLabel } from '../lib/format'
import type { Brick, Dependency, Team, Theme, UpdateBrickInput } from '../types'
import { lookOf } from './BrickBlock'
import { Icon, ICONS } from './Icon'

export interface InspectorProps {
  brick: Brick
  teams: Team[]
  themes: Theme[]
  bricks: Brick[]
  dependencies: Dependency[]
  /** Peak load and ceiling of the brick's team, for the capacity hint. */
  teamPeak: number
  onPatch: (patch: UpdateBrickInput, label: string) => void
  onDelete: () => void
  onRemoveDependency: (id: string) => void
  onClose: () => void
}

/**
 * Editor for the selected brick.
 *
 * Everything here is also reachable by dragging on the grid; the panel exists
 * for the cases direct manipulation handles badly — renaming, pasting a link,
 * setting an exact window — and for showing the consequences of a change, like
 * the team's resulting peak load.
 */
export function Inspector({
  brick,
  teams,
  themes,
  bricks,
  dependencies,
  teamPeak,
  onPatch,
  onDelete,
  onRemoveDependency,
  onClose,
}: InspectorProps) {
  const absence = brick.kind === 'absence'
  const look = lookOf(brick, themes)
  const team = teams.find((t) => t.id === brick.teamId)
  const themeName = themes.find((t) => t.id === brick.themeId)?.name ?? ''
  const overCapacity = team ? teamPeak > team.capacity + 1e-6 : false

  const links = [
    ...dependencies.filter((d) => d.toId === brick.id).map((d) => ({ dep: d, direction: 'in' as const })),
    ...dependencies.filter((d) => d.fromId === brick.id).map((d) => ({ dep: d, direction: 'out' as const })),
  ]

  return (
    <aside
      aria-label="Détail de la brique"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 372,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--line)',
        boxShadow: '-16px 0 40px rgb(24 24 27 / .1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 11,
          padding: '15px 16px 13px',
          borderBottom: '1px solid var(--line-soft)',
        }}
      >
        <div
          style={{
            width: 31,
            height: 31,
            borderRadius: 8,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: absence ? 'var(--line-soft)' : look.tint,
            border: `1px ${absence ? 'dashed var(--line-strong)' : `solid ${look.line}`}`,
            color: absence ? 'var(--muted)' : look.ink,
          }}
        >
          {look.iconPath ? <Icon path={look.iconPath} size={15} strokeWidth={1.35} /> : null}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: "500 10.5px/1 var(--sans)",
              letterSpacing: '.05em',
              textTransform: 'uppercase',
              color: 'var(--muted-2)',
            }}
          >
            {absence ? 'Absence' : themeName}
          </div>
          <div
            style={{
              font: "600 15px/1.35 var(--sans)",
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
              marginTop: 5,
            }}
          >
            {brick.title}
          </div>
        </div>

        <button type="button" className="bk-icon-button" onClick={onClose} aria-label="Fermer le panneau">
          <Icon path={ICONS.close} strokeWidth={1.5} />
        </button>
      </div>

      <div
        className="bk-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div>
          <label className="bk-label" htmlFor="brick-title">
            Titre
          </label>
          <input
            id="brick-title"
            className="bk-field"
            value={brick.title}
            onChange={(e) => onPatch({ title: e.target.value }, 'Renommage')}
          />
        </div>

        <div>
          <span className="bk-label">Type de bloc</span>
          <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 9, background: 'var(--line-soft)' }}>
            {[
              { id: 'work' as const, label: 'Projet' },
              { id: 'absence' as const, label: 'Absence' },
            ].map((kind) => {
              const on = brick.kind === kind.id
              return (
                <button
                  key={kind.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    if (!on) onPatch({ kind: kind.id }, 'Changement de type')
                  }}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '6px 10px',
                    borderRadius: 7,
                    font: "500 12.5px/1.3 var(--sans)",
                    background: on ? 'var(--surface)' : 'transparent',
                    color: on ? 'var(--ink)' : 'var(--muted-2)',
                    boxShadow: on ? '0 1px 2px rgb(24 24 27 / .1)' : 'none',
                  }}
                >
                  {kind.label}
                </button>
              )
            })}
          </div>
        </div>

        {!absence ? (
          <div>
            <span className="bk-label">Thème</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {themes.map((theme) => {
                const on = brick.themeId === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onPatch({ themeId: theme.id }, 'Changement de thème')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '7px 10px',
                      borderRadius: 8,
                      font: "500 12.5px/1.3 var(--sans)",
                      background: on ? 'var(--accent-soft)' : 'transparent',
                      color: on ? 'var(--ink)' : 'var(--muted)',
                    }}
                  >
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: theme.base, flex: 'none' }} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{theme.name}</span>
                    {on ? (
                      <Icon path={ICONS.check} strokeWidth={1.7} style={{ color: 'var(--accent)' }} />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div>
          <label className="bk-label" htmlFor="brick-team">
            Équipe
          </label>
          <select
            id="brick-team"
            className="bk-select"
            value={brick.teamId}
            onChange={(e) => onPatch({ teamId: e.target.value }, 'Changement d’équipe')}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                Squad {t.name} · {fmt(t.capacity)} ETP
              </option>
            ))}
          </select>
          <div
            style={{
              font: "400 11.5px/1.4 var(--sans)",
              color: overCapacity ? 'var(--danger-ink)' : 'var(--muted-2)',
              marginTop: 6,
            }}
          >
            Pointe de charge {fmt(teamPeak)} / {fmt(team?.capacity ?? 0)} ETP
            {overCapacity ? ' · en surcharge' : ''}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ font: "500 12px/1 var(--sans)", color: 'var(--muted)' }}>Charge</span>
            <span
              style={{
                font: "500 12px/1 var(--mono)",
                color: 'var(--ink)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {fmt(brick.etp)} ETP
            </span>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {ETP_LADDER.map((step) => (
              <button
                key={step}
                type="button"
                title={`${fmt(step)} ETP`}
                aria-label={`${fmt(step)} ETP`}
                onClick={() => onPatch({ etp: step }, 'Charge modifiée')}
                style={{
                  flex: 1,
                  height: 26,
                  borderRadius: 6,
                  background: brick.etp >= step ? 'var(--accent)' : 'var(--line-soft)',
                  transition: 'background 100ms',
                }}
              />
            ))}
          </div>
          <div style={{ font: "400 11.5px/1.4 var(--sans)", color: 'var(--muted-2)', marginTop: 7 }}>
            {absence
              ? 'Retiré de la capacité de l’équipe · ↑ ↓ au clavier'
              : 'Hauteur de la brique · ↑ ↓ au clavier'}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ font: "500 12px/1 var(--sans)", color: 'var(--muted)' }}>Fenêtre</span>
            <span style={{ font: "400 12px/1 var(--mono)", color: 'var(--muted-2)' }}>
              {windowLabel(brick.startMonth, brick.duration)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              className="bk-select"
              aria-label="Mois de départ"
              value={brick.startMonth}
              onChange={(e) => onPatch({ startMonth: Number(e.target.value) }, 'Déplacement')}
              style={{ flex: 1, minWidth: 0 }}
            >
              {MONTHS.map((label, month) => (
                <option key={label} value={month}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="bk-select"
              aria-label="Durée"
              value={brick.duration}
              onChange={(e) => onPatch({ duration: Number(e.target.value) }, 'Durée modifiée')}
              style={{ width: 96 }}
            >
              {DURATION_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} mois
                </option>
              ))}
            </select>
          </div>
        </div>

        {!absence ? (
          <div>
            <label className="bk-label" htmlFor="brick-link">
              Lien
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 11px',
                border: '1px solid var(--line)',
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: "600 9px/1 var(--mono)",
                  color: 'var(--accent-strong)',
                  flex: 'none',
                }}
              >
                N
              </span>
              <input
                id="brick-link"
                value={brick.link}
                placeholder="https://"
                onChange={(e) => onPatch({ link: e.target.value }, 'Lien modifié')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  background: 'transparent',
                  font: "400 12.5px/1.4 var(--mono)",
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              padding: '11px 13px',
              border: '1px dashed var(--line-strong)',
              borderRadius: 9,
              background: 'var(--canvas)',
              font: "400 12px/1.55 var(--sans)",
              color: 'var(--muted)',
              textWrap: 'pretty',
            }}
          >
            Une absence retire des ETP de la capacité de l’équipe sans porter de thème. Elle se cale au
            bas de la pile et n’apparaît pas en revue.
          </p>
        )}

        <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ font: "600 12.5px/1 var(--sans)", color: 'var(--ink)' }}>Dépendances</span>
            <span
              style={{
                font: "400 11.5px/1 var(--mono)",
                color: 'var(--muted-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {links.length} lien{links.length > 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {links.map(({ dep, direction }) => {
              const otherId = direction === 'in' ? dep.fromId : dep.toId
              const other = bricks.find((b) => b.id === otherId)
              if (!other) return null
              const otherTeam = teams.find((t) => t.id === other.teamId)
              return (
                <div
                  key={dep.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '9px 10px',
                    border: '1px solid var(--line-soft)',
                    borderRadius: 8,
                    background: 'var(--canvas)',
                  }}
                >
                  <span
                    style={{
                      font: "500 13px/1 var(--mono)",
                      color: direction === 'in' ? 'var(--accent)' : 'var(--muted-2)',
                      flex: 'none',
                    }}
                  >
                    {direction === 'in' ? '↓' : '↑'}
                  </span>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2.5,
                      background: lookOf(other, themes).base,
                      flex: 'none',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        font: "500 12.5px/1.3 var(--sans)",
                        color: 'var(--ink)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {other.title}
                    </div>
                    <div style={{ font: "400 11.5px/1.3 var(--sans)", color: 'var(--muted-2)', marginTop: 2 }}>
                      {direction === 'in' ? 'Entrant' : 'Sortant'} · {otherTeam?.name} ·{' '}
                      {MONTHS[other.startMonth]}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="bk-danger-link"
                    aria-label={`Supprimer le lien vers ${other.title}`}
                    onClick={() => onRemoveDependency(dep.id)}
                    style={{ padding: 2, flex: 'none', display: 'flex' }}
                  >
                    <Icon path={ICONS.close} size={12} strokeWidth={1.5} />
                  </button>
                </div>
              )
            })}
          </div>

          <p style={{ margin: '9px 0 0', font: "400 11.5px/1.5 var(--sans)", color: 'var(--muted-2)' }}>
            Tirez le point bleu à gauche d’une brique vers une autre pour créer un lien.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 11,
          padding: '13px 16px',
          borderTop: '1px solid var(--line-soft)',
          background: 'var(--canvas)',
        }}
      >
        <button type="button" className="bk-danger-link" onClick={onDelete}>
          Supprimer
        </button>
        <button type="button" className="bk-dark-button" onClick={onClose}>
          Fermer
        </button>
      </div>
    </aside>
  )
}
