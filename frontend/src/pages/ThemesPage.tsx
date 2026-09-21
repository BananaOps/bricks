import { useMemo, useState } from 'react'
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
import { THEME_ICONS, findThemeIcon } from '../lib/themeIcons'
import type { Theme } from '../types'

export interface ThemesPageProps {
  board: BoardState
  onOpenRoadmap: () => void
}

/** Couleur de départ d'un nouveau thème. */
const DEFAULT_BASE = '#2563EB'

/**
 * Gestion des thèmes.
 *
 * Un thème est à la fois l'axe de la vue Revue et l'identité visuelle d'une
 * brique. Seule sa couleur de base se choisit : le serveur en dérive le fond,
 * l'encre et le trait, ce qui garantit qu'un titre reste lisible sur son propre
 * remplissage — une palette saisie à quatre mains ne le garantit pas.
 */
export function ThemesPage({ board, onOpenRoadmap }: ThemesPageProps) {
  const data = board.board
  const [pendingDelete, setPendingDelete] = useState<Theme | null>(null)
  const [newName, setNewName] = useState('')
  const [newBase, setNewBase] = useState(DEFAULT_BASE)

  const themes = useMemo(() => data?.themes ?? [], [data])
  const bricks = useMemo(() => data?.bricks ?? [], [data])

  const usage = useMemo(() => {
    const out: Record<string, number> = {}
    for (const brick of bricks) {
      if (brick.themeId) out[brick.themeId] = (out[brick.themeId] ?? 0) + 1
    }
    return out
  }, [bricks])

  function move(index: number, delta: number) {
    const next = [...themes]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(index + delta, 0, moved)
    void board.reorderThemes(next.map((t) => t.id))
  }

  function submitNew(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    void board.createTheme({ name, base: newBase, iconPath: THEME_ICONS[0]?.path ?? '' }).then((ok) => {
      if (ok) setNewName('')
    })
  }

  return (
    <PageShell
      title="Thèmes"
      count={`${themes.length} thèmes`}
      lead="Un thème range une brique par intention plutôt que par équipe : c’est l’axe de la vue Revue, et la couleur que porte le bloc sur la grille. Seule la couleur de base se choisit — le fond, l’encre et le trait en découlent pour que le titre reste lisible."
      onOpenRoadmap={onOpenRoadmap}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {themes.map((theme, index) => (
          <ConfigCard key={theme.id}>
            <ReorderHandle
              label={theme.name}
              isFirst={index === 0}
              isLast={index === themes.length - 1}
              onUp={() => move(index, -1)}
              onDown={() => move(index, 1)}
            />

            <ColorField
              value={theme.base}
              label={`Couleur de ${theme.name}`}
              onCommit={(base) => void board.updateTheme(theme.id, { base })}
            />

            <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <EditableText
                value={theme.name}
                ariaLabel={`Nom du thème ${theme.name}`}
                onCommit={(name) => void board.updateTheme(theme.id, { name })}
                style={{ font: '500 13.5px/1.4 var(--sans)' }}
              />
              <IconPicker
                value={theme.iconPath}
                themeName={theme.name}
                onSelect={(iconPath) => void board.updateTheme(theme.id, { iconPath })}
              />
            </div>

            <BrickPreview theme={theme} />

            <div
              style={{
                width: 74,
                flex: 'none',
                font: "400 11px/1.4 var(--mono)",
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--muted-2)',
              }}
            >
              {usage[theme.id] ?? 0} brique{(usage[theme.id] ?? 0) > 1 ? 's' : ''}
            </div>

            <DeleteButton
              label={`Supprimer le thème ${theme.name}`}
              onClick={() => setPendingDelete(theme)}
            />
          </ConfigCard>
        ))}
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
        <div style={{ flex: 'none' }}>
          <span className="bk-label">Couleur</span>
          <ColorField value={newBase} label="Couleur du nouveau thème" onCommit={setNewBase} />
        </div>

        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <label className="bk-label" htmlFor="new-theme-name">
            Nouveau thème
          </label>
          <input
            id="new-theme-name"
            className="bk-field"
            value={newName}
            placeholder="Intention portée par ces briques"
            onChange={(e) => setNewName(e.target.value)}
          />
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
          title={`Supprimer le thème « ${pendingDelete.name} » ?`}
          impact={
            (usage[pendingDelete.id] ?? 0) > 0
              ? `${usage[pendingDelete.id]} brique${
                  (usage[pendingDelete.id] ?? 0) > 1 ? 's portent' : ' porte'
                } ce thème. Une brique de projet doit en porter un, donc elles adopteront celui choisi ci-dessous.`
              : 'Aucune brique ne porte ce thème. Il disparaîtra simplement des filtres et de la vue Revue.'
          }
          targets={
            (usage[pendingDelete.id] ?? 0) > 0
              ? themes.filter((t) => t.id !== pendingDelete.id).map((t) => ({ id: t.id, label: t.name }))
              : []
          }
          confirmLabel="Supprimer le thème"
          onCancel={() => setPendingDelete(null)}
          onConfirm={(reassignTo) => {
            setPendingDelete(null)
            void board.deleteTheme(pendingDelete.id, reassignTo)
          }}
        />
      ) : null}
    </PageShell>
  )
}

/**
 * Sélecteur de couleur natif doublé d'une pastille cliquable.
 *
 * `<input type="color">` ouvre le sélecteur du système, mais son rendu par
 * défaut jure avec le reste : il est donc rendu transparent au-dessus d'une
 * pastille dessinée, qui garde l'apparence de l'application.
 */
function ColorField({
  value,
  label,
  onCommit,
}: {
  value: string
  label: string
  onCommit: (value: string) => void
}) {
  return (
    <label
      title={value}
      style={{
        position: 'relative',
        width: 38,
        height: 38,
        flex: 'none',
        borderRadius: 9,
        background: value,
        border: '1px solid rgb(24 24 27 / .12)',
        boxShadow: 'inset 0 1px 2px rgb(255 255 255 / .28)',
        cursor: 'pointer',
        display: 'block',
      }}
    >
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onCommit(e.target.value.toUpperCase())}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
      />
    </label>
  )
}

/** Choix de l'icône du thème dans une bibliothèque bornée. */
function IconPicker({
  value,
  themeName,
  onSelect,
}: {
  value: string
  themeName: string
  onSelect: (path: string) => void
}) {
  const selected = findThemeIcon(value)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      {THEME_ICONS.map((icon) => {
        const on = selected?.id === icon.id
        return (
          <button
            key={icon.id}
            type="button"
            title={icon.label}
            aria-label={`Icône ${icon.label} pour ${themeName}`}
            aria-pressed={on}
            onClick={() => onSelect(icon.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 6,
              color: on ? 'var(--accent-strong)' : 'var(--muted-2)',
              background: on ? 'var(--accent-soft)' : 'transparent',
              border: `1px solid ${on ? 'var(--accent-line)' : 'transparent'}`,
            }}
          >
            <Icon path={icon.path} size={13} strokeWidth={1.35} />
          </button>
        )
      })}
    </div>
  )
}

/**
 * Aperçu d'une brique portant le thème.
 *
 * Les quatre teintes ne se jugent pas en pastilles : ce qui compte est la
 * lisibilité du titre sur le fond, qu'on ne voit qu'en les assemblant.
 */
function BrickPreview({ theme }: { theme: Theme }) {
  return (
    <div
      aria-hidden
      style={{
        width: 128,
        height: 42,
        flex: 'none',
        display: 'flex',
        overflow: 'hidden',
        borderRadius: 8,
        background: theme.tint,
        border: `1px solid ${theme.line}`,
      }}
    >
      <div style={{ width: 3, flex: 'none', background: theme.base }} />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '5px 8px',
        }}
      >
        <span
          style={{
            font: "600 11px/1.2 var(--sans)",
            color: theme.ink,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {theme.name}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              font: "500 9.5px/1 var(--mono)",
              color: theme.ink,
              opacity: 0.85,
            }}
          >
            2
          </span>
          <span style={{ flex: 1 }} />
          {theme.iconPath ? (
            <Icon path={theme.iconPath} size={11} strokeWidth={1.35} style={{ color: theme.ink, opacity: 0.55 }} />
          ) : null}
        </span>
      </div>
    </div>
  )
}
