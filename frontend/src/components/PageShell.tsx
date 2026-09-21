import { useEffect, useRef, useState } from 'react'
import { Icon, ICONS } from './Icon'

export interface PageShellProps {
  title: string
  /** Une phrase disant ce que la page gouverne, et pourquoi c'est structurant. */
  lead: string
  /** Compteur discret aligné à droite du titre, par exemple « 11 équipes ». */
  count: string
  onOpenRoadmap: () => void
  children: React.ReactNode
}

/**
 * Cadre commun aux pages de configuration.
 *
 * Même squelette que la roadmap — en-tête figé, contenu défilant dans son
 * propre cadre — pour que passer d'un écran à l'autre ne déplace rien.
 */
export function PageShell({ title, lead, count, onOpenRoadmap, children }: PageShellProps) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
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
            {title}
          </h1>
          <span style={{ font: "400 13px/1.2 var(--sans)", color: 'var(--muted-2)' }}>{count}</span>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" className="bk-ghost-button" onClick={onOpenRoadmap}>
          <Icon path="M11 3.5L6 8l5 4.5" strokeWidth={1.5} />
          Retour à la roadmap
        </button>
      </header>

      <div
        className="bk-scroll"
        style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', background: 'var(--canvas)' }}
      >
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 20px 56px' }}>
          <p
            style={{
              margin: '0 0 22px',
              font: "400 13.5px/1.6 var(--sans)",
              color: 'var(--muted)',
              textWrap: 'pretty',
            }}
          >
            {lead}
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}

/** Carte d'une ligne de configuration : une équipe, un thème. */
export function ConfigCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '13px 14px',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 10,
      }}
    >
      {children}
    </div>
  )
}

export interface ReorderHandleProps {
  onUp: () => void
  onDown: () => void
  isFirst: boolean
  isLast: boolean
  label: string
}

/**
 * Montée/descente d'une ligne.
 *
 * Deux boutons plutôt qu'un glisser : l'ordre est une propriété rarement
 * touchée, et des boutons restent accessibles au clavier sans rien réinventer.
 */
export function ReorderHandle({ onUp, onDown, isFirst, isLast, label }: ReorderHandleProps) {
  const style = (disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 15,
    borderRadius: 4,
    color: disabled ? 'var(--line-strong)' : 'var(--muted-2)',
    cursor: disabled ? 'default' : 'pointer',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
      <button
        type="button"
        onClick={onUp}
        disabled={isFirst}
        aria-label={`Monter ${label}`}
        style={style(isFirst)}
      >
        <Icon path="M2.5 8.5L7 4l4.5 4.5" size={11} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={isLast}
        aria-label={`Descendre ${label}`}
        style={style(isLast)}
      >
        <Icon path="M2.5 5.5L7 10l4.5-4.5" size={11} strokeWidth={1.6} />
      </button>
    </div>
  )
}

export interface EditableTextProps {
  value: string
  onCommit: (value: string) => void
  ariaLabel: string
  placeholder?: string
  style?: React.CSSProperties
}

/**
 * Champ texte qui n'écrit qu'une fois la saisie terminée.
 *
 * Enregistrer à chaque frappe enverrait une requête par caractère et ferait
 * échouer la validation sur les états intermédiaires — un nom vidé avant
 * d'être réécrit. L'écriture part donc au `blur` ou sur Entrée, et Échap rend
 * la valeur d'origine.
 */
export function EditableText({ value, onCommit, ariaLabel, placeholder, style }: EditableTextProps) {
  const [draft, setDraft] = useState(value)
  const committed = useRef(value)

  // Une valeur revenue du serveur — ou rendue par une annulation — doit
  // reprendre la main sur le brouillon local.
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value
      setDraft(value)
    }
  }, [value])

  function commit() {
    const next = draft.trim()
    if (next === value) return
    if (!next) {
      setDraft(value)
      return
    }
    committed.current = next
    onCommit(next)
  }

  return (
    <input
      className="bk-field"
      aria-label={ariaLabel}
      value={draft}
      placeholder={placeholder ?? ''}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setDraft(value)
          e.currentTarget.blur()
        }
      }}
      style={style ?? {}}
    />
  )
}

export interface ConfirmDeleteProps {
  title: string
  /** Ce que la suppression emporterait si rien n'était réaffecté. */
  impact: string
  /** Cibles possibles ; vide quand rien n'a besoin d'être déplacé. */
  targets: { id: string; label: string }[]
  confirmLabel: string
  onConfirm: (reassignTo: string | undefined) => void
  onCancel: () => void
}

/**
 * Confirmation d'une suppression, avec choix de la destination du travail.
 *
 * Le serveur refuse déjà de supprimer une ligne qui porte des briques sans
 * cible ; cette boîte fait de ce refus une décision explicite plutôt qu'une
 * erreur rencontrée après coup.
 */
export function ConfirmDelete({
  title,
  impact,
  targets,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDeleteProps) {
  const [target, setTarget] = useState(targets[0]?.id ?? '')
  const needsTarget = targets.length > 0

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgb(24 24 27 / .3)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 140,
        zIndex: 80,
        animation: 'bkFade 120ms ease-out',
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460,
          maxWidth: 'calc(100% - 40px)',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 60px rgb(24 24 27 / .28)',
          overflow: 'hidden',
          animation: 'bkRise 140ms ease-out',
        }}
      >
        <div style={{ padding: '18px 20px 16px' }}>
          <div style={{ font: "600 15px/1.35 var(--sans)", color: 'var(--ink)' }}>{title}</div>
          <p
            style={{
              margin: '8px 0 0',
              font: "400 13px/1.55 var(--sans)",
              color: 'var(--muted)',
              textWrap: 'pretty',
            }}
          >
            {impact}
          </p>

          {needsTarget ? (
            <div style={{ marginTop: 16 }}>
              <label className="bk-label" htmlFor="reassign-target">
                Transférer le travail vers
              </label>
              <select
                id="reassign-target"
                className="bk-select"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '13px 20px',
            borderTop: '1px solid var(--line-soft)',
            background: 'var(--canvas)',
          }}
        >
          <button type="button" className="bk-ghost-button" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(needsTarget ? target : undefined)}
            style={{
              padding: '8px 15px',
              borderRadius: 'var(--radius)',
              background: 'var(--danger)',
              color: '#fff',
              font: "600 12.5px/1 var(--sans)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Bouton de suppression d'une ligne de configuration. */
export function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="bk-icon-button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ flex: 'none' }}
    >
      <Icon path={ICONS.close} strokeWidth={1.5} />
    </button>
  )
}
