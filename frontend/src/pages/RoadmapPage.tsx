import { useCallback, useMemo, useRef, useState } from 'react'
import { Board } from '../components/Board'
import type { Draft } from '../components/BoardRow'
import { lookOf } from '../components/BrickBlock'
import { OverloadBanner, StatusBar } from '../components/Chrome'
import { CommandPalette, type Command } from '../components/CommandPalette'
import { Inspector } from '../components/Inspector'
import { FilterBar, TopBar } from '../components/TopBar'
import type { BoardState } from '../hooks/useBoard'
import { useHotkeys } from '../hooks/useHotkeys'
import { useElementWidth } from '../hooks/useElementWidth'
import { applyPreview, useInteraction } from '../hooks/useInteraction'
import { clampEtp, clampWindow, fmt, MONTHS, MONTHS_PER_YEAR } from '../lib/format'
import {
  computeLayout,
  metricsFor,
  relatedBricks,
  type BlockStyle,
  type Density,
  type Layout,
  type ViewMode,
} from '../lib/layout'
import type { UpdateBrickInput } from '../types'

/**
 * Where the "today" marker sits, as a fractional month.
 *
 * The board is a planning year rather than a live calendar, so the marker only
 * appears when the roadmap's year is the current one.
 */
function todayPosition(year: number): number | null {
  const now = new Date()
  if (now.getFullYear() !== year) return null
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate()
  return now.getMonth() + (now.getDate() - 1) / daysInMonth
}

/** Placeholder layout held by the ref until the first render computes a real one. */
const EMPTY_LAYOUT: Layout = {
  rows: [],
  boxes: {},
  rowOffsets: [],
  totalHeight: 0,
  gridWidth: 0,
  totalLoad: [],
  totalCapacity: 0,
  overloadedTeams: new Set(),
  overloadedMonths: new Set(),
}

/** Presentation options, reachable from the command palette. */
interface ViewSettings {
  density: Density
  blockStyle: BlockStyle
  showToday: boolean
}

export interface RoadmapPageProps {
  board: BoardState
}

/**
 * La grille : une année de travail, une ligne par équipe ou par thème.
 *
 * Toute la manipulation directe vit ici — glisser, redimensionner, lier — ce
 * qui explique la densité d'état local : une interaction en cours n'a de sens
 * que sur cet écran et ne doit rien laisser derrière elle en le quittant.
 */
export function RoadmapPage({ board }: RoadmapPageProps) {

  const [view, setView] = useState<ViewMode>('capacity')
  const [settings, setSettings] = useState<ViewSettings>({
    density: 'comfortable',
    blockStyle: 'tinted',
    showToday: true,
  })
  const [showDependencies, setShowDependencies] = useState(true)
  const [themeFilter, setThemeFilter] = useState<string | null>(null)
  const [focusOverload, setFocusOverload] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<Layout>(EMPTY_LAYOUT)

  // Le tableau occupe toute la largeur offerte : les douze mois se partagent la
  // place restante, sans jamais passer sous le plancher de leur densité.
  const boardWidth = useElementWidth(scrollRef)
  const metrics = useMemo(
    () => metricsFor(settings.density, boardWidth),
    [settings.density, boardWidth],
  )
  const data = board.board
  const review = view === 'review'

  const bricks = useMemo(() => data?.bricks ?? [], [data])
  const teams = useMemo(() => data?.teams ?? [], [data])
  const themes = useMemo(() => data?.themes ?? [], [data])
  const dependencies = useMemo(() => data?.dependencies ?? [], [data])

  const selected = bricks.find((b) => b.id === selectedId) ?? null

  // ---- editing

  const patchSelected = useCallback(
    (patch: UpdateBrickInput, label: string) => {
      if (selectedId) void board.updateBrick(selectedId, patch, label)
    },
    [board, selectedId],
  )

  const commitMove = useCallback(
    (id: string, teamId: string, startMonth: number) => {
      const brick = bricks.find((b) => b.id === id)
      if (!brick) return
      const team = teams.find((t) => t.id === teamId)
      void board.updateBrick(id, { teamId, startMonth }, `Déplacement de « ${brick.title} »`)
      board.notify(`« ${brick.title} » → ${MONTHS[startMonth]} · ${team?.name ?? ''}`)
    },
    [board, bricks, teams],
  )

  const commitEtp = useCallback(
    (id: string, etp: number) => {
      const brick = bricks.find((b) => b.id === id)
      if (!brick) return
      void board.updateBrick(id, { etp }, `Charge de « ${brick.title} »`)
      board.notify(`« ${brick.title} » à ${fmt(etp)} ETP`)
    },
    [board, bricks],
  )

  const commitDuration = useCallback(
    (id: string, duration: number) => {
      const brick = bricks.find((b) => b.id === id)
      if (!brick) return
      void board.updateBrick(id, { duration }, `Durée de « ${brick.title} »`)
      board.notify(`« ${brick.title} » sur ${duration} mois`)
    },
    [board, bricks],
  )

  const interaction = useInteraction(bricks, layoutRef, metrics, gridRef, scrollRef, {
    onClick: (id) => {
      setSelectedId(id)
      setInspectorOpen(true)
    },
    onMove: commitMove,
    onResizeEtp: commitEtp,
    onResizeWindow: commitDuration,
    onLink: (fromId, toId) => void board.createDependency(fromId, toId),
  })

  const previewBricks = useMemo(
    () => applyPreview(bricks, interaction.interaction),
    [bricks, interaction.interaction],
  )

  const layout = useMemo(
    () => computeLayout({ teams, themes, bricks: previewBricks, view, metrics }),
    [teams, themes, previewBricks, view, metrics],
  )
  // Published for the pointer handlers, which hit-test rows against the layout
  // that is on screen rather than the one that produced the gesture.
  layoutRef.current = layout

  const relatedIds = useMemo(
    () => relatedBricks(dependencies, hoveredId),
    [dependencies, hoveredId],
  )

  // ---- creation

  const commitDraft = useCallback(() => {
    if (!draft) return
    const title = draft.text.trim()
    setDraft(null)
    if (!title) return

    const themeId = themeFilter && themeFilter !== 'absence' ? themeFilter : themes[0]?.id
    void board
      .createBrick({
        teamId: draft.rowId,
        title,
        startMonth: draft.month,
        ...(themeId ? { themeId } : {}),
        duration: Math.min(2, MONTHS_PER_YEAR - draft.month),
      })
      .then((brick) => {
        if (!brick) return
        setSelectedId(brick.id)
        board.notify(`« ${title} » créée · ${MONTHS[draft.month]}`)
      })
  }, [board, draft, themeFilter, themes])

  const addAbsence = useCallback(
    (teamId: string, month: number) => {
      const team = teams.find((t) => t.id === teamId)
      setDraft(null)
      void board
        .createBrick({ teamId, title: 'Absence', kind: 'absence', startMonth: month, etp: 1, duration: 1 })
        .then((brick) => {
          if (!brick) return
          setSelectedId(brick.id)
          setInspectorOpen(true)
          board.notify(`Absence ajoutée · ${MONTHS[month]} · ${team?.name ?? ''}`)
        })
    },
    [board, teams],
  )

  // ---- navigation

  const goToToday = useCallback(() => {
    const position = todayPosition(data?.roadmap.year ?? new Date().getFullYear())
    if (position == null) return
    scrollRef.current?.scrollTo({
      left: Math.max(0, position * metrics.monthWidth - 220),
      behavior: 'smooth',
    })
  }, [data, metrics.monthWidth])

  const focusBrick = useCallback(
    (id: string) => {
      const brick = bricks.find((b) => b.id === id)
      if (!brick) return
      scrollRef.current?.scrollTo({
        left: Math.max(0, brick.startMonth * metrics.monthWidth - 180),
        behavior: 'smooth',
      })
      setSelectedId(id)
      setInspectorOpen(true)
      setPaletteOpen(false)
      setHoveredId(id)
    },
    [bricks, metrics.monthWidth],
  )

  // ---- keyboard

  useHotkeys(
    {
      openPalette: () => setPaletteOpen(true),
      undo: () => void board.undo(),
      escape: () => {
        setPaletteOpen(false)
        setInspectorOpen(false)
        setDraft(null)
      },
      nudgeWindow: (delta, resizing) => {
        if (!selected) return
        if (resizing) {
          const { duration } = clampWindow(selected.startMonth, selected.duration + delta)
          if (duration !== selected.duration) commitDuration(selected.id, duration)
        } else {
          const startMonth = Math.max(
            0,
            Math.min(MONTHS_PER_YEAR - selected.duration, selected.startMonth + delta),
          )
          if (startMonth !== selected.startMonth) commitMove(selected.id, selected.teamId, startMonth)
        }
      },
      nudgeEtp: (delta) => {
        if (!selected) return
        const etp = clampEtp(selected.etp + delta)
        if (etp !== selected.etp) commitEtp(selected.id, etp)
      },
      remove: () => {
        if (!selected) return
        void board.deleteBrick(selected.id)
        setSelectedId(null)
        setInspectorOpen(false)
      },
    },
    Boolean(selected),
  )

  // ---- command palette

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = []

    for (const brick of bricks.slice(0, 200)) {
      const team = teams.find((t) => t.id === brick.teamId)
      list.push({
        id: `brick-${brick.id}`,
        group: 'Briques',
        label: brick.title,
        meta: `${team?.name ?? ''} · ${MONTHS[brick.startMonth]}`,
        dot: lookOf(brick, themes).base,
        run: () => focusBrick(brick.id),
      })
    }

    for (const team of teams) {
      list.push({
        id: `team-${team.id}`,
        group: 'Équipes',
        label: `Squad ${team.name}`,
        meta: `${fmt(team.capacity)} ETP de capacité`,
        dot: layout.overloadedTeams.has(team.id) ? 'var(--danger)' : 'var(--line-strong)',
        run: () => {
          setThemeFilter(null)
          setFocusOverload(false)
          setPaletteOpen(false)
        },
      })
    }

    const action = (id: string, label: string, meta: string, run: () => void): Command => ({
      id,
      group: 'Actions',
      label,
      meta,
      dot: 'var(--accent)',
      run: () => {
        run()
        setPaletteOpen(false)
      },
    })

    list.push(
      action(
        'focus',
        layout.overloadedTeams.size
          ? focusOverload
            ? 'Afficher toutes les équipes'
            : 'Isoler les équipes en surcharge'
          : 'Aucune surcharge à isoler',
        'Vue',
        () => setFocusOverload((v) => !v),
      ),
      action('today', 'Aller à aujourd’hui', 'Navigation', goToToday),
      action(
        'view',
        review ? 'Repasser en vue Capacité' : 'Passer en vue Revue',
        'Vue',
        () => setView(review ? 'capacity' : 'review'),
      ),
      action('deps', showDependencies ? 'Masquer les liens' : 'Afficher les liens', 'Vue', () =>
        setShowDependencies((v) => !v),
      ),
      action(
        'density',
        settings.density === 'compact' ? 'Densité aérée' : 'Densité compacte',
        'Affichage',
        () =>
          setSettings((s) => ({
            ...s,
            density: s.density === 'compact' ? 'comfortable' : 'compact',
          })),
      ),
      action(
        'blockStyle',
        settings.blockStyle === 'solid' ? 'Briques teintées' : 'Briques pleines',
        'Affichage',
        () =>
          setSettings((s) => ({ ...s, blockStyle: s.blockStyle === 'solid' ? 'tinted' : 'solid' })),
      ),
      action(
        'today-marker',
        settings.showToday ? 'Masquer le repère du jour' : 'Afficher le repère du jour',
        'Affichage',
        () => setSettings((s) => ({ ...s, showToday: !s.showToday })),
      ),
      action('undo', 'Annuler la dernière action', '⌘Z', () => void board.undo()),
    )

    return list
  }, [
    bricks, teams, themes, layout.overloadedTeams, focusOverload, goToToday, review,
    showDependencies, settings, board, focusBrick,
  ])

  // ---- render

  // App ne monte cette page qu'une fois le plateau chargé ; la garde reste pour
  // satisfaire le typage et couvrir un rechargement en cours.
  if (!data) return null

  const marker = settings.showToday ? todayPosition(data.roadmap.year) : null
  const projectCount = bricks.filter((b) => b.kind !== 'absence').length
  const absenceCount = bricks.length - projectCount

  const dragging =
    interaction.interaction?.mode === 'drag' && interaction.interaction.moved
      ? {
          id: interaction.interaction.id,
          dx: interaction.interaction.dx,
          dy: interaction.interaction.dy,
          targetMonth: interaction.interaction.targetMonth,
          targetTeam: interaction.interaction.targetTeam,
        }
      : null

  const pendingLink =
    interaction.interaction?.mode === 'link'
      ? {
          fromId: interaction.interaction.id,
          x: interaction.interaction.x,
          y: interaction.interaction.y,
        }
      : null

  const selectedTeamPeak = selected
    ? Math.max(0, ...(layout.rows.find((r) => r.id === selected.teamId)?.load ?? [0]))
    : 0

  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        // Sans cela, la grille défilante prend la hauteur de son contenu et
        // pousse la page entière au-delà de la fenêtre au lieu de défiler.
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
        <TopBar
          roadmapName={data.roadmap.name}
          viewLabel={review ? 'Revue par thème' : 'Capacité par équipe'}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <FilterBar
          view={view}
          onViewChange={(next) => {
            setView(next)
            setHoveredId(null)
            setDraft(null)
            setInspectorOpen(false)
          }}
          themes={themes}
          themeFilter={themeFilter}
          onThemeFilterChange={setThemeFilter}
          showDependencies={showDependencies}
          onToggleDependencies={() => setShowDependencies((v) => !v)}
          onGoToToday={goToToday}
        />

        {layout.overloadedTeams.size > 0 && !review ? (
          <OverloadBanner
            teamCount={layout.overloadedTeams.size}
            months={[...layout.overloadedMonths].sort((a, b) => a - b)}
            monthLabels={MONTHS}
            focused={focusOverload}
            onToggleFocus={() => setFocusOverload((v) => !v)}
          />
        ) : null}

        <Board
          ref={scrollRef}
          gridRef={gridRef}
          layout={layout}
          metrics={metrics}
          view={view}
          blockStyle={settings.blockStyle}
          year={data.roadmap.year}
          teams={teams}
          themes={themes}
          dependencies={dependencies}
          showDependencies={showDependencies}
          todayPosition={marker}
          selectedId={selectedId}
          hoveredId={hoveredId}
          relatedIds={relatedIds}
          themeFilter={themeFilter}
          focusOverload={focusOverload}
          draft={draft}
          dragging={dragging}
          draggingBrick={dragging ? (bricks.find((b) => b.id === dragging.id) ?? null) : null}
          pendingLink={pendingLink}
          onDraftChange={(text) => setDraft((d) => (d ? { ...d, text } : d))}
          onDraftCommit={commitDraft}
          onDraftCancel={() => setDraft(null)}
          onOpenDraft={(rowId, month) => {
            if (interaction.interaction) return
            setDraft({ rowId, month, text: '' })
            setInspectorOpen(false)
          }}
          onAddAbsence={addAbsence}
          onHover={(id) => {
            if (!interaction.interaction) setHoveredId(id)
          }}
          onBrickPointerDown={interaction.startDrag}
          onResizeEtp={interaction.startResizeEtp}
          onResizeWindow={interaction.startResizeWindow}
          onStartLink={interaction.startLink}
        />

        <StatusBar
          summary={`${projectCount} briques · ${absenceCount} absences · ${layout.overloadedTeams.size} équipes en surcharge`}
        />

        {paletteOpen ? (
          <CommandPalette
            commands={commands}
            onClose={() => setPaletteOpen(false)}
            onCreateFromQuery={(title) => {
              const team = teams[0]
              if (!team) return
              setPaletteOpen(false)
              void board
                .createBrick({ teamId: team.id, title, startMonth: 0 })
                .then((brick) => brick && focusBrick(brick.id))
            }}
          />
        ) : null}

        {inspectorOpen && selected && !review ? (
          <Inspector
            brick={selected}
            teams={teams}
            themes={themes}
            bricks={bricks}
            dependencies={dependencies}
            teamPeak={selectedTeamPeak}
            onPatch={patchSelected}
            onDelete={() => {
              void board.deleteBrick(selected.id)
              setSelectedId(null)
              setInspectorOpen(false)
            }}
            onRemoveDependency={(id) => void board.deleteDependency(id)}
            onClose={() => setInspectorOpen(false)}
          />
        ) : null}
    </div>
  )
}
