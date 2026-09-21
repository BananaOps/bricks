import type {
  Board,
  Brick,
  CapacityReport,
  CreateBrickInput,
  CreateTeamInput,
  CreateThemeInput,
  Dependency,
  Team,
  Theme,
  UpdateBrickInput,
  UpdateTeamInput,
  UpdateThemeInput,
} from '../types'

/**
 * Base URL of the Go API. Empty in development, where Vite proxies /api to the
 * backend so the browser only ever talks to one origin.
 */
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

/** Roadmap loaded on boot. */
export const ROADMAP_ID = import.meta.env.VITE_ROADMAP_ID || 'rm-2026'

/**
 * An API call that came back with a non-2xx status.
 *
 * The server answers validation failures in French with a human-readable
 * `error` field, so `message` is safe to show in a toast as-is.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch (cause) {
    // fetch only rejects when the request never completed — the API is down or
    // unreachable. Say so, rather than surfacing "Failed to fetch".
    throw new ApiError(0, 'Le serveur est injoignable.', { cause })
  }

  if (!res.ok) {
    let message = `Erreur ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // A non-JSON error body (a proxy's HTML 502, say) leaves the status only.
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  getBoard: (roadmapId = ROADMAP_ID) => request<Board>(`/api/v1/roadmaps/${roadmapId}/board`),

  getCapacity: (roadmapId = ROADMAP_ID) =>
    request<CapacityReport>(`/api/v1/roadmaps/${roadmapId}/capacity`),

  createBrick: (input: CreateBrickInput, roadmapId = ROADMAP_ID) =>
    request<Brick>(`/api/v1/roadmaps/${roadmapId}/bricks`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateBrick: (id: string, patch: UpdateBrickInput) =>
    request<Brick>(`/api/v1/bricks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteBrick: (id: string) => request<void>(`/api/v1/bricks/${id}`, { method: 'DELETE' }),

  createDependency: (fromId: string, toId: string, roadmapId = ROADMAP_ID) =>
    request<Dependency>(`/api/v1/roadmaps/${roadmapId}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ fromId, toId }),
    }),

  deleteDependency: (id: string) =>
    request<void>(`/api/v1/dependencies/${id}`, { method: 'DELETE' }),

  // ---- équipes

  createTeam: (input: CreateTeamInput, roadmapId = ROADMAP_ID) =>
    request<Team>(`/api/v1/roadmaps/${roadmapId}/teams`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateTeam: (id: string, patch: UpdateTeamInput) =>
    request<Team>(`/api/v1/teams/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  /**
   * Supprime une équipe.
   *
   * `reassignTo` dit où part son travail. Sans cette cible, le serveur refuse
   * en 409 dès que l'équipe porte des briques : perdre un pan du plan d'un
   * seul clic n'est pas une erreur rattrapable.
   */
  deleteTeam: (id: string, reassignTo?: string) =>
    request<void>(`/api/v1/teams/${id}${reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ''}`, {
      method: 'DELETE',
    }),

  /** Renumérote les équipes ; renvoie le plateau réordonné. */
  reorderTeams: (ids: string[], roadmapId = ROADMAP_ID) =>
    request<Board>(`/api/v1/roadmaps/${roadmapId}/teams/order`, {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    }),

  // ---- thèmes

  createTheme: (input: CreateThemeInput, roadmapId = ROADMAP_ID) =>
    request<Theme>(`/api/v1/roadmaps/${roadmapId}/themes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateTheme: (id: string, patch: UpdateThemeInput) =>
    request<Theme>(`/api/v1/themes/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteTheme: (id: string, reassignTo?: string) =>
    request<void>(`/api/v1/themes/${id}${reassignTo ? `?reassignTo=${encodeURIComponent(reassignTo)}` : ''}`, {
      method: 'DELETE',
    }),

  reorderThemes: (ids: string[], roadmapId = ROADMAP_ID) =>
    request<Board>(`/api/v1/roadmaps/${roadmapId}/themes/order`, {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    }),
}
