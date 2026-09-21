import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '../api/client'
import type {
  Board,
  Brick,
  CreateBrickInput,
  CreateTeamInput,
  CreateThemeInput,
  Dependency,
  UpdateBrickInput,
  UpdateTeamInput,
  UpdateThemeInput,
} from '../types'

/**
 * An action that reverses a mutation, together with the label shown in the
 * toast and in the command palette.
 *
 * Undo is expressed as a compensating API call rather than by restoring a
 * client snapshot, so the server and the screen never disagree about what
 * happened — a snapshot would silently diverge the moment a call failed.
 */
interface UndoEntry {
  label: string
  revert: () => Promise<void>
}

export interface Toast {
  id: number
  text: string
  /** Set when the toast reports a failure, which suppresses the undo button. */
  tone: 'info' | 'error'
}

/** How long a toast stays on screen. */
const TOAST_MS = 4200

/** Undo depth; deeper than this and the history stops being a working memory. */
const HISTORY_LIMIT = 25

export interface BoardState {
  board: Board | null
  loading: boolean
  /** Set when the initial load failed; mutations report through toasts instead. */
  error: string | null
  toast: Toast | null
  canUndo: boolean
  reload: () => Promise<void>
  /** Relit le plateau sans repasser par l'écran de chargement. */
  refresh: () => Promise<void>
  dismissToast: () => void
  notify: (text: string, tone?: Toast['tone']) => void
  createBrick: (input: CreateBrickInput) => Promise<Brick | null>
  updateBrick: (id: string, patch: UpdateBrickInput, label: string) => Promise<void>
  deleteBrick: (id: string) => Promise<void>
  createDependency: (fromId: string, toId: string) => Promise<void>
  deleteDependency: (id: string) => Promise<void>
  undo: () => Promise<void>

  // Configuration du plateau. Ces écritures ne rejoignent pas la pile
  // d'annulation : ce sont des gestes de formulaire, délibérés et relisibles,
  // là où un glisser se joue en une fraction de seconde.
  createTeam: (input: CreateTeamInput) => Promise<boolean>
  updateTeam: (id: string, patch: UpdateTeamInput) => Promise<boolean>
  deleteTeam: (id: string, reassignTo?: string) => Promise<boolean>
  reorderTeams: (ids: string[]) => Promise<boolean>
  createTheme: (input: CreateThemeInput) => Promise<boolean>
  updateTheme: (id: string, patch: UpdateThemeInput) => Promise<boolean>
  deleteTheme: (id: string, reassignTo?: string) => Promise<boolean>
  reorderThemes: (ids: string[]) => Promise<boolean>
}

/**
 * Loads a roadmap and mutates it.
 *
 * Edits are optimistic: the grid moves on the pointer-up, and a failed call
 * rolls the change back and says why. The alternative — waiting for a round
 * trip before the brick moves — makes dragging feel broken on any real network.
 */
export function useBoard(): BoardState {
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [history, setHistory] = useState<UndoEntry[]>([])

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastSeq = useRef(0)

  const notify = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastSeq.current
    setToast({ id, text, tone })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current))
    }, TOAST_MS)
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBoard(await api.getBoard())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const remember = useCallback((entry: UndoEntry) => {
    setHistory((h) => [...h, entry].slice(-HISTORY_LIMIT))
  }, [])

  /** Reports a failed mutation without pushing it onto the undo stack. */
  const fail = useCallback(
    (err: unknown, fallback: string) => {
      notify(err instanceof ApiError ? err.message : fallback, 'error')
    },
    [notify],
  )

  /**
   * Relit le plateau sans repasser par l'écran de chargement.
   *
   * Les écritures de configuration touchent plusieurs tables à la fois — une
   * suppression avec réaffectation déplace des briques — donc relire coûte une
   * requête et garantit l'accord avec le serveur, là où reconstituer l'effet
   * à la main multiplierait les cas à tenir.
   */
  const refresh = useCallback(async () => {
    try {
      setBoard(await api.getBoard())
    } catch (err) {
      fail(err, 'Rechargement impossible.')
    }
  }, [fail])

  const createBrick = useCallback(
    async (input: CreateBrickInput): Promise<Brick | null> => {
      // Creates await the server rather than guessing an id: they come from a
      // deliberate action — typing a title, clicking add — where a round trip
      // is imperceptible, unlike a drag.
      try {
        const brick = await api.createBrick(input)
        setBoard((b) => (b ? { ...b, bricks: [...b.bricks, brick] } : b))
        remember({
          label: `Création de « ${brick.title} »`,
          revert: async () => {
            await api.deleteBrick(brick.id)
            setBoard((b) => (b ? { ...b, bricks: b.bricks.filter((x) => x.id !== brick.id) } : b))
          },
        })
        return brick
      } catch (err) {
        fail(err, 'Création impossible.')
        return null
      }
    },
    [fail, remember],
  )

  const updateBrick = useCallback(
    async (id: string, patch: UpdateBrickInput, label: string) => {
      const previous = board?.bricks.find((b) => b.id === id)
      if (!previous) return

      // Only the fields the patch actually touches are captured, so undoing a
      // move does not also revert an unrelated rename made in between.
      const inverse: UpdateBrickInput = {}
      for (const key of Object.keys(patch) as (keyof UpdateBrickInput)[]) {
        // @ts-expect-error — key indexes both objects identically.
        inverse[key] = previous[key]
      }

      const apply = (values: UpdateBrickInput) =>
        setBoard((b) =>
          b ? { ...b, bricks: b.bricks.map((x) => (x.id === id ? { ...x, ...values } : x)) } : b,
        )

      apply(patch)
      try {
        const saved = await api.updateBrick(id, patch)
        // Adopt the server's row: it may have clamped or normalised a field.
        setBoard((b) => (b ? { ...b, bricks: b.bricks.map((x) => (x.id === id ? saved : x)) } : b))
        remember({
          label,
          revert: async () => {
            const restored = await api.updateBrick(id, inverse)
            setBoard((b) =>
              b ? { ...b, bricks: b.bricks.map((x) => (x.id === id ? restored : x)) } : b,
            )
          },
        })
      } catch (err) {
        apply(inverse)
        fail(err, 'Modification impossible.')
      }
    },
    [board, fail, remember],
  )

  const deleteBrick = useCallback(
    async (id: string) => {
      const brick = board?.bricks.find((b) => b.id === id)
      if (!brick) return
      // Captured before the delete cascades them away on the server.
      const orphaned = board?.dependencies.filter((d) => d.fromId === id || d.toId === id) ?? []

      setBoard((b) =>
        b
          ? {
              ...b,
              bricks: b.bricks.filter((x) => x.id !== id),
              dependencies: b.dependencies.filter((d) => d.fromId !== id && d.toId !== id),
            }
          : b,
      )

      try {
        await api.deleteBrick(id)
        remember({
          label: `Suppression de « ${brick.title} »`,
          revert: async () => {
            // The server mints a fresh id, so the restored brick's links have
            // to be rebuilt against it rather than the id that just vanished.
            const restored = await api.createBrick({
              teamId: brick.teamId,
              title: brick.title,
              startMonth: brick.startMonth,
              themeId: brick.themeId,
              kind: brick.kind,
              etp: brick.etp,
              duration: brick.duration,
              link: brick.link,
            })
            const links: Dependency[] = []
            for (const d of orphaned) {
              try {
                links.push(
                  await api.createDependency(
                    d.fromId === id ? restored.id : d.fromId,
                    d.toId === id ? restored.id : d.toId,
                  ),
                )
              } catch {
                // A link whose other end has since been deleted simply cannot
                // come back; restoring the brick is still worth doing.
              }
            }
            setBoard((b) =>
              b
                ? { ...b, bricks: [...b.bricks, restored], dependencies: [...b.dependencies, ...links] }
                : b,
            )
          },
        })
      } catch (err) {
        setBoard((b) =>
          b
            ? { ...b, bricks: [...b.bricks, brick], dependencies: [...b.dependencies, ...orphaned] }
            : b,
        )
        fail(err, 'Suppression impossible.')
      }
    },
    [board, fail, remember],
  )

  const createDependency = useCallback(
    async (fromId: string, toId: string) => {
      try {
        const dep = await api.createDependency(fromId, toId)
        setBoard((b) => (b ? { ...b, dependencies: [...b.dependencies, dep] } : b))
        const target = board?.bricks.find((x) => x.id === toId)
        notify(`Lien créé vers « ${target?.title ?? '…'} »`)
        remember({
          label: 'Nouveau lien',
          revert: async () => {
            await api.deleteDependency(dep.id)
            setBoard((b) => (b ? { ...b, dependencies: b.dependencies.filter((d) => d.id !== dep.id) } : b))
          },
        })
      } catch (err) {
        fail(err, 'Lien impossible.')
      }
    },
    [board, fail, notify, remember],
  )

  const deleteDependency = useCallback(
    async (id: string) => {
      const dep = board?.dependencies.find((d) => d.id === id)
      if (!dep) return

      setBoard((b) => (b ? { ...b, dependencies: b.dependencies.filter((d) => d.id !== id) } : b))
      try {
        await api.deleteDependency(id)
        remember({
          label: 'Suppression d’un lien',
          revert: async () => {
            const restored = await api.createDependency(dep.fromId, dep.toId)
            setBoard((b) => (b ? { ...b, dependencies: [...b.dependencies, restored] } : b))
          },
        })
      } catch (err) {
        setBoard((b) => (b ? { ...b, dependencies: [...b.dependencies, dep] } : b))
        fail(err, 'Suppression du lien impossible.')
      }
    },
    [board, fail, remember],
  )

  // ---- configuration du plateau

  /**
   * Enveloppe commune aux écritures de configuration.
   *
   * Elles renvoient un booléen plutôt que de lever : les pages Équipes et
   * Thèmes s'en servent pour décider de fermer un formulaire ou de le laisser
   * ouvert avec la saisie intacte, ce qu'une exception rendrait plus lourd.
   */
  const configWrite = useCallback(
    async (run: () => Promise<void>, success: string, fallback: string): Promise<boolean> => {
      try {
        await run()
        notify(success)
        return true
      } catch (err) {
        fail(err, fallback)
        return false
      }
    },
    [fail, notify],
  )

  const createTeam = useCallback(
    (input: CreateTeamInput) =>
      configWrite(
        async () => {
          const team = await api.createTeam(input)
          setBoard((b) => (b ? { ...b, teams: [...b.teams, team] } : b))
        },
        `Équipe « ${input.name} » créée`,
        'Création impossible.',
      ),
    [configWrite],
  )

  const updateTeam = useCallback(
    (id: string, patch: UpdateTeamInput) =>
      configWrite(
        async () => {
          const team = await api.updateTeam(id, patch)
          setBoard((b) => (b ? { ...b, teams: b.teams.map((t) => (t.id === id ? team : t)) } : b))
        },
        'Équipe mise à jour',
        'Modification impossible.',
      ),
    [configWrite],
  )

  const deleteTeam = useCallback(
    (id: string, reassignTo?: string) => {
      const name = board?.teams.find((t) => t.id === id)?.name ?? ''
      return configWrite(
        async () => {
          await api.deleteTeam(id, reassignTo)
          await refresh()
        },
        `Équipe « ${name} » supprimée`,
        'Suppression impossible.',
      )
    },
    [board, configWrite, refresh],
  )

  const reorderTeams = useCallback(
    (ids: string[]) =>
      configWrite(
        async () => setBoard(await api.reorderTeams(ids)),
        'Ordre des équipes enregistré',
        'Réordonnancement impossible.',
      ),
    [configWrite],
  )

  const createTheme = useCallback(
    (input: CreateThemeInput) =>
      configWrite(
        async () => {
          const theme = await api.createTheme(input)
          setBoard((b) => (b ? { ...b, themes: [...b.themes, theme] } : b))
        },
        `Thème « ${input.name} » créé`,
        'Création impossible.',
      ),
    [configWrite],
  )

  const updateTheme = useCallback(
    (id: string, patch: UpdateThemeInput) =>
      configWrite(
        async () => {
          const theme = await api.updateTheme(id, patch)
          setBoard((b) => (b ? { ...b, themes: b.themes.map((t) => (t.id === id ? theme : t)) } : b))
        },
        'Thème mis à jour',
        'Modification impossible.',
      ),
    [configWrite],
  )

  const deleteTheme = useCallback(
    (id: string, reassignTo?: string) => {
      const name = board?.themes.find((t) => t.id === id)?.name ?? ''
      return configWrite(
        async () => {
          await api.deleteTheme(id, reassignTo)
          await refresh()
        },
        `Thème « ${name} » supprimé`,
        'Suppression impossible.',
      )
    },
    [board, configWrite, refresh],
  )

  const reorderThemes = useCallback(
    (ids: string[]) =>
      configWrite(
        async () => setBoard(await api.reorderThemes(ids)),
        'Ordre des thèmes enregistré',
        'Réordonnancement impossible.',
      ),
    [configWrite],
  )

  const undo = useCallback(async () => {
    const entry = history[history.length - 1]
    if (!entry) return
    setHistory((h) => h.slice(0, -1))
    try {
      await entry.revert()
      notify(`${entry.label} — annulé`)
    } catch (err) {
      // The board may now disagree with the server, so re-read it rather than
      // leaving a half-reverted screen in place.
      fail(err, 'Annulation impossible.')
      await reload()
    }
  }, [fail, history, notify, reload])

  return useMemo(
    () => ({
      board,
      loading,
      error,
      toast,
      canUndo: history.length > 0,
      reload,
      refresh,
      dismissToast,
      notify,
      createBrick,
      updateBrick,
      deleteBrick,
      createDependency,
      deleteDependency,
      undo,
      createTeam,
      updateTeam,
      deleteTeam,
      reorderTeams,
      createTheme,
      updateTheme,
      deleteTheme,
      reorderThemes,
    }),
    [
      board, loading, error, toast, history.length, reload, refresh, dismissToast, notify,
      createBrick, updateBrick, deleteBrick, createDependency, deleteDependency, undo,
      createTeam, updateTeam, deleteTeam, reorderTeams,
      createTheme, updateTheme, deleteTheme, reorderThemes,
    ],
  )
}
