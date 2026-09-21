/** Grid constants and French-locale formatting shared across the app. */

/** The grid is exactly one calendar year wide. */
export const MONTHS_PER_YEAR = 12

export const MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
] as const

/** ETP bounds, mirroring the server's validation. */
export const MIN_ETP = 0.5
export const MAX_ETP = 6
export const ETP_STEP = 0.5

/**
 * Bornes de capacité d'une équipe, reprises du serveur.
 *
 * Distinctes de celles d'une brique : une squad peut porter bien plus que la
 * charge maximale d'un seul bloc, seul le pas de 0,5 est commun.
 */
export const MIN_CAPACITY = 0.5
export const MAX_CAPACITY = 100

/** Steps offered by the inspector's load ladder. */
export const ETP_LADDER = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5] as const

/** Durations offered by the inspector's window selector. */
export const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 12] as const

/** Quarter labels for a given year, e.g. "Q1 2026". */
export function quarters(year: number) {
  return [0, 1, 2, 3].map((q) => ({ index: q, name: `Q${q + 1} ${year}` }))
}

/** One decimal, French decimal comma: 2.5 → "2,5", 3 → "3". */
export function fmt(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',')
}

/** "janv." or "janv. → mai" when the brick spans more than one month. */
export function windowLabel(startMonth: number, duration: number): string {
  const start = MONTHS[startMonth] ?? ''
  if (duration <= 1) return start
  return `${start} → ${MONTHS[Math.min(MONTHS_PER_YEAR - 1, startMonth + duration - 1)] ?? ''}`
}

/** Snaps a load to the nearest legal 0.5 step within [MIN_ETP, MAX_ETP]. */
export function clampEtp(etp: number): number {
  const snapped = Math.round(etp / ETP_STEP) * ETP_STEP
  return Math.min(MAX_ETP, Math.max(MIN_ETP, snapped))
}

/** Ramène une capacité d'équipe au pas de 0,5 le plus proche, dans ses bornes. */
export function clampCapacity(capacity: number): number {
  const snapped = Math.round(capacity / ETP_STEP) * ETP_STEP
  return Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, snapped))
}

/** Keeps a window inside the year: a brick never spills past December. */
export function clampWindow(startMonth: number, duration: number) {
  const start = Math.min(MONTHS_PER_YEAR - 1, Math.max(0, startMonth))
  return { startMonth: start, duration: Math.min(Math.max(1, duration), MONTHS_PER_YEAR - start) }
}
