/**
 * La marque : une brique isométrique 2×2.
 *
 * Une seule forme sert du favicon au rail sombre ; seules les valeurs changent.
 * Les trois faces prennent trois valeurs de cobalt pour que le volume se lise
 * sans contour, et chaque tenon est doublé d'une ellipse décalée de deux unités
 * vers le bas qui lui donne son épaisseur.
 */

/** Fonds sur lesquels la marque doit tenir. */
export type LogoTone = 'light' | 'dark' | 'mono' | 'onBlue'

interface Palette {
  /** Face gauche, la plus sombre. */
  left: string
  /** Face droite, valeur intermédiaire. */
  right: string
  /** Face supérieure, la plus claire : c'est elle qui porte la lecture. */
  top: string
  /** Dessus du tenon. */
  stud: string
  /** Tranche du tenon, décalée sous le dessus. */
  studEdge: string
}

/**
 * Les quatre déclinaisons de la charte.
 *
 * Exportée parce que le favicon vit dans un fichier statique, hors de portée
 * du composant : c'est la référence contre laquelle son accord est vérifié.
 */
export const LOGO_PALETTES: Record<LogoTone, Palette> = {
  light: { left: '#1D4ED8', right: '#2563EB', top: '#3B82F6', stud: '#93C5FD', studEdge: '#1D4ED8' },
  // Sur fond sombre, la face haute est éclaircie et les tenons remontent en
  // bleu très pâle : le contraste de la face supérieure tient seul la lecture.
  dark: { left: '#1D4ED8', right: '#2563EB', top: '#60A5FA', stud: '#DBEAFE', studEdge: '#1D4ED8' },
  mono: { left: '#18181B', right: '#3F3F46', top: '#71717A', stud: '#E4E4E7', studEdge: '#3F3F46' },
  onBlue: { left: '#1E40AF', right: '#1D4ED8', top: '#FFFFFF', stud: '#EFF6FF', studEdge: '#1D4ED8' },
}

/** Les trois faces de la brique, en coordonnées du viewBox 64×64. */
const FACES = {
  left: 'M8 24v14l24 14V38z',
  right: 'M56 24v14L32 52V38z',
  top: 'M32 10l24 14-24 14L8 24z',
} as const

/** Centres des quatre tenons sur la face supérieure. */
const STUDS = [
  { cx: 32, cy: 17 },
  { cx: 44, cy: 24 },
  { cx: 20, cy: 24 },
  { cx: 32, cy: 31 },
] as const

/**
 * Taille en deçà de laquelle la tranche des tenons est abandonnée.
 *
 * À cette échelle, les deux ellipses superposées se confondent en une tache :
 * la version simplifiée reste plus nette qu'un détail qui ne se résout pas.
 */
const EDGE_THRESHOLD = 48

export interface LogoProps {
  /** Côté du carré, en pixels. */
  size?: number
  tone?: LogoTone
  /** Texte alternatif ; sans lui la marque est décorative et masquée aux lecteurs d'écran. */
  title?: string
  style?: React.CSSProperties
}

export function Logo({ size = 32, tone = 'light', title, style }: LogoProps) {
  const palette = LOGO_PALETTES[tone]
  const withEdges = size >= EDGE_THRESHOLD

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      style={{ flex: 'none', ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={FACES.left} fill={palette.left} />
      <path d={FACES.right} fill={palette.right} />
      <path d={FACES.top} fill={palette.top} />

      {withEdges
        ? STUDS.map((stud) => (
            <ellipse
              key={`edge-${stud.cx}-${stud.cy}`}
              cx={stud.cx}
              cy={stud.cy + 2}
              rx={5.2}
              ry={3}
              fill={palette.studEdge}
            />
          ))
        : null}

      {STUDS.map((stud) => (
        <ellipse key={`${stud.cx}-${stud.cy}`} cx={stud.cx} cy={stud.cy} rx={5.2} ry={3} fill={palette.stud} />
      ))}
    </svg>
  )
}

export interface WordmarkProps {
  /** Ligne secondaire, séparée par un filet vertical. */
  tagline?: string
  size?: 'large' | 'small'
}

/**
 * Signature horizontale : la marque suivie du nom.
 *
 * La charte fixe la marge minimale à la hauteur d'un tenon — six unités du
 * viewBox, soit un peu moins de 10 % du côté — d'où l'écart entre les deux.
 */
export function Wordmark({ tagline, size = 'large' }: WordmarkProps) {
  const large = size === 'large'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: large ? 13 : 10 }}>
      <Logo size={large ? 34 : 22} title="Bricks" />
      <span
        style={{
          font: `600 ${large ? '26px' : '17px'}/1 var(--sans)`,
          letterSpacing: large ? '-0.03em' : '-0.02em',
          color: 'var(--ink)',
        }}
      >
        Bricks
      </span>
      {tagline ? (
        <>
          <span style={{ width: 1, height: 16, background: 'var(--line)' }} />
          <span style={{ font: "400 14px/1 var(--sans)", color: 'var(--muted-2)' }}>{tagline}</span>
        </>
      ) : null}
    </div>
  )
}
