/**
 * Every icon in the app is a single stroked path on a 14×14 grid, so one
 * component covers them all — including theme icons, whose paths come from the
 * database rather than this file.
 */
export interface IconProps {
  path: string
  size?: number
  viewBox?: string
  strokeWidth?: number
  style?: React.CSSProperties
  title?: string
}

export function Icon({ path, size = 13, viewBox = '0 0 14 14', strokeWidth = 1.4, style, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      style={{ flex: 'none', ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={path}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Paths for the app's own chrome. Theme icons live in the database. */
export const ICONS = {
  search: 'M9.4 9.4l2.6 2.6',
  calendar: 'M2 5.8h10M4.8 1.8v1.6M9.2 1.8v1.6',
  close: 'M3 3l8 8M11 3l-8 8',
  plus: 'M7 2.5v9M2.5 7h9',
  check: 'M2.5 7.4l3 3 6-6.4',
  absence: 'M2.6 3.7h8.8v7.6H2.6zM2.6 6.2h8.8M4.9 2v1.6M9.1 2v1.6',
  externalLink: 'M4.5 2H2.5v7.5H10V7.5M6.5 2H10v3.5M9.8 2.2L5.5 6.5',
} as const

/** The search glyph needs a circle alongside its handle path. */
export function SearchIcon({ size = 13, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flex: 'none', ...style }} aria-hidden>
      <circle cx="6.2" cy="6.2" r="4.2" stroke="currentColor" strokeWidth="1.4" />
      <path d={ICONS.search} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** The calendar glyph needs its frame rect. */
export function CalendarIcon({ size = 12, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ flex: 'none', ...style }} aria-hidden>
      <rect x="2" y="3" width="10" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d={ICONS.calendar} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
