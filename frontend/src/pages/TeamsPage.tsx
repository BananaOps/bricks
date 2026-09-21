import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, ICONS } from '../components/Icon'
import {
  ConfigCard,
  ConfirmDelete,
  DeleteButton,
  EditableText,
  PageShell,
  ReorderHandle,
} from '../components/PageShell'
import type { BoardState } from '../hooks/useBoard'
import { clampCapacity, fmt } from '../lib/format'
import { monthlyLoad } from '../lib/layout'
import type { Team } from '../types'

export interface TeamsPageProps {
  board: BoardState
  onOpenRoadmap: () => void
}

/** Capacités proposées à la création ; la saisie libre reste possible ensuite. */
const CAPACITY_PRESETS = [2, 2.5, 3, 3.5, 4, 4.5, 5] as const

/**
 * Gestion des équipes.
 *
 * Une équipe est une ligne de la grille et un plafond de charge. Changer sa
 * capacité déplace la ligne pointillée sous laquelle le travail doit tenir,
 * donc la page montre en face de chaque plafond la pointe réellement atteinte :
 * régler l'un sans voir l'autre revient à planifier à l'aveugle.
 */
export function TeamsPage({ board, onOpenRoadmap }: TeamsPageProps) {
  const data = board.board
  const [pendingDelete, setPendingDelete] = useState<Team | null>(null)
  const [newName, setNewName] = useState('')
  const [newCapacity, setNewCapacity] = useState(3)

  const teams = useMemo(() => data?.teams ?? [], [data])
  const bricks = useMemo(() => data?.bricks ?? [], [data])

  /** Pointe de charge et nombre de briques, par équipe. */
  const stats = useMemo(() => {
    const out: Record<string, { peak: number; bricks: number }> = {}
    for (const team of teams) {
      const owned = bricks.filter((b) => b.teamId === team.id)
      out[team.id] = { peak: Math.max(0, ...monthlyLoad(owned)), bricks: owned.length }
    }
    return out
  }, [teams, bricks])

  const totalCapacity = teams.reduce((sum, t) => sum + t.capacity, 0)

  function move(index: number, delta: number) {
    const next = [...teams]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(index + delta, 0, moved)
    void board.reorderTeams(next.map((t) => t.id))
  }

  function submitNew(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    void board.createTeam({ name, capacity: newCapacity }).then((ok) => {
      // Le formulaire ne se vide qu'en cas de succès : un nom refusé reste
      // saisi, prêt à être corrigé.
      if (ok) setNewName('')
    })
  }

  return (
    <PageShell
      title="Équipes"
      count={`${teams.length} squads · ${fmt(totalCapacity)} ETP`}
      lead="Chaque équipe est une ligne de la roadmap, et sa capacité le plafond sous lequel son travail doit tenir. La pointe affichée en face est la charge du mois le plus chargé de l’année, absences comprises."
      onOpenRoadmap={onOpenRoadmap}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {teams.map((team, index) => {
          const stat = stats[team.id] ?? { peak: 0, bricks: 0 }
          const over = stat.peak > team.capacity + 1e-6
          return (
            <ConfigCard key={team.id}>
              <ReorderHandle
                label={team.name}
                isFirst={index === 0}
                isLast={index === teams.length - 1}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
              />

              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  flex: 'none',
                  background: over ? 'var(--danger)' : 'var(--line-strong)',
                }}
              />

              <EditableText
                value={team.name}
                ariaLabel={`Nom de l’équipe ${team.name}`}
                onCommit={(name) => void board.updateTeam(team.id, { name })}
                style={{ flex: '1 1 0', minWidth: 0, font: '500 13.5px/1.4 var(--sans)' }}
              />

              <CapacityField
                capacity={team.capacity}
                label={`Capacité de ${team.name}`}
                onCommit={(capacity) => void board.updateTeam(team.id, { capacity })}
              />

              <div style={{ width: 168, flex: 'none' }}>
                <div
                  style={{
                    height: 4,
                    borderRadius: 99,
                    background: 'var(--line-soft)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (stat.peak / (team.capacity || stat.peak || 1)) * 100)}%`,
                      borderRadius: 99,
                      background: over ? 'var(--danger)' : '#a1a1aa',
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 6,
                    font: "400 11px/1 var(--mono)",
                    fontVariantNumeric: 'tabular-nums',
                    color: over ? 'var(--danger-ink)' : 'var(--muted-2)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  pointe {fmt(stat.peak)} · {stat.bricks} brique{stat.bricks > 1 ? 's' : ''}
                </div>
              </div>

              <DeleteButton
                label={`Supprimer l’équipe ${team.name}`}
                onClick={() => setPendingDelete(team)}
              />
            </ConfigCard>
          )
        })}
      </div>

      <form
        onSubmit={submitNew}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          marginTop: 18,
          padding: '15px 16px',
          background: 'var(--surface)',
          border: '1px dashed var(--line-strong)',
          borderRadius: 10,
        }}
      >
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <label className="bk-label" htmlFor="new-team-name">
            Nouvelle équipe
          </label>
          <input
            id="new-team-name"
            className="bk-field"
            value={newName}
            placeholder="Nom de la squad"
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>

        <div style={{ width: 150, flex: 'none' }}>
          <label className="bk-label" htmlFor="new-team-capacity">
            Capacité
          </label>
          <select
            id="new-team-capacity"
            className="bk-select"
            value={newCapacity}
            onChange={(e) => setNewCapacity(Number(e.target.value))}
          >
            {CAPACITY_PRESETS.map((n) => (
              <option key={n} value={n}>
                {fmt(n)} ETP
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="bk-primary-button" style={{ height: 38, flex: 'none' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon path={ICONS.plus} size={12} strokeWidth={1.9} />
            Ajouter
          </span>
        </button>
      </form>

      {pendingDelete ? (
        <ConfirmDelete
          title={`Supprimer l’équipe « ${pendingDelete.name} » ?`}
          impact={
            (stats[pendingDelete.id]?.bricks ?? 0) > 0
              ? `Cette équipe porte ${stats[pendingDelete.id]?.bricks} brique${
                  (stats[pendingDelete.id]?.bricks ?? 0) > 1 ? 's' : ''
                }. Rien ne sera perdu : le travail est transféré vers l’équipe choisie ci-dessous.`
              : 'Cette équipe ne porte aucune brique. La ligne disparaîtra simplement de la roadmap.'
          }
          targets={
            (stats[pendingDelete.id]?.bricks ?? 0) > 0
              ? teams
                  .filter((t) => t.id !== pendingDelete.id)
                  .map((t) => ({ id: t.id, label: `Squad ${t.name} · ${fmt(t.capacity)} ETP` }))
              : []
          }
          confirmLabel="Supprimer l’équipe"
          onCancel={() => setPendingDelete(null)}
          onConfirm={(reassignTo) => {
            setPendingDelete(null)
            void board.deleteTeam(pendingDelete.id, reassignTo)
          }}
        />
      ) : null}
    </PageShell>
  )
}

/**
 * Saisie d'une capacité en ETP.
 *
 * La valeur est bornée au même pas de 0,5 que la charge d'une brique : un
 * plafond qu'aucune combinaison de briques ne peut atteindre exactement
 * rendrait la ligne pointillée trompeuse.
 */
function CapacityField({
  capacity,
  label,
  onCommit,
}: {
  capacity: number
  label: string
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState(fmt(capacity))
  const committed = useRef(capacity)

  // Une capacité revenue du serveur — après un rechargement, ou parce qu'elle a
  // été calée sur le pas de 0,5 — doit reprendre la main sur le brouillon.
  useEffect(() => {
    if (capacity !== committed.current) {
      committed.current = capacity
      setDraft(fmt(capacity))
    }
  }, [capacity])

  function commit() {
    const parsed = Number(draft.replace(',', '.'))
    if (!Number.isFinite(parsed)) {
      setDraft(fmt(capacity))
      return
    }
    const snapped = clampCapacity(parsed)
    setDraft(fmt(snapped))
    if (snapped !== capacity) {
      committed.current = snapped
      onCommit(snapped)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      <input
        className="bk-field"
        aria-label={label}
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setDraft(fmt(capacity))
            e.currentTarget.blur()
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            setDraft(fmt(clampCapacity(Number(draft.replace(',', '.')) + (e.key === 'ArrowUp' ? 0.5 : -0.5))))
          }
        }}
        style={{
          width: 62,
          textAlign: 'right',
          font: "500 13px/1.4 var(--mono)",
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <span style={{ font: "400 12px/1 var(--sans)", color: 'var(--muted-2)' }}>ETP</span>
    </div>
  )
}
