/** Shapes returned by the Go API. Field names match its JSON exactly. */

/** The two block types the inspector toggles between. */
export type Kind = 'work' | 'absence'

export interface Roadmap {
  id: string
  name: string
  year: number
}

/** A row of the capacity view. `capacity` is the ETP ceiling drawn as the dashed line. */
export interface Team {
  id: string
  name: string
  capacity: number
  position: number
}

/**
 * A row of the review view, and the colour identity of a work brick.
 *
 * The palette travels with the data so themes stay renameable and extensible
 * without touching the frontend.
 */
export interface Theme {
  id: string
  name: string
  base: string
  tint: string
  ink: string
  line: string
  iconPath: string
  position: number
}

/** One block on the grid. `themeId` is null exactly when `kind` is 'absence'. */
export interface Brick {
  id: string
  roadmapId: string
  teamId: string
  themeId: string | null
  kind: Kind
  title: string
  etp: number
  startMonth: number
  duration: number
  link: string
}

/** A directed sequencing link between two bricks. */
export interface Dependency {
  id: string
  fromId: string
  toId: string
}

/** The whole board, loaded in one request. */
export interface Board {
  roadmap: Roadmap
  teams: Team[]
  themes: Theme[]
  bricks: Brick[]
  dependencies: Dependency[]
}

export interface TeamCapacity {
  teamId: string
  capacity: number
  load: number[]
  peak: number
  overloaded: boolean
  overloadedMonths: number[]
  overflow: number
}

export interface CapacityReport {
  teams: TeamCapacity[]
  totalCapacity: number
  totalLoad: number[]
  overloadedTeams: number
  overloadedMonths: number[]
}

/** Fields accepted when creating a brick; the server fills in the rest. */
export interface CreateBrickInput {
  teamId: string
  title: string
  startMonth: number
  themeId?: string | null
  kind?: Kind
  etp?: number
  duration?: number
  link?: string
}

/** Every field optional: a patch carries only what actually changed. */
export type UpdateBrickInput = Partial<Omit<Brick, 'id' | 'roadmapId'>>

/** Champs acceptés à la création d'une équipe. */
export interface CreateTeamInput {
  name: string
  capacity: number
}

/** Un patch ne porte que ce qui change. */
export type UpdateTeamInput = Partial<Pick<Team, 'name' | 'capacity'>>

/**
 * Champs acceptés à la création d'un thème.
 *
 * `base` suffit : le serveur en dérive le fond, l'encre et le trait, ce qui
 * garantit qu'une brique reste lisible sur son propre remplissage.
 */
export interface CreateThemeInput {
  name: string
  base: string
  iconPath?: string
}

/** Fournir une teinte explicite l'emporte sur la dérivation. */
export type UpdateThemeInput = Partial<Pick<Theme, 'name' | 'base' | 'tint' | 'ink' | 'line' | 'iconPath'>>
