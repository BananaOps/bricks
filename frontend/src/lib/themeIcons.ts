/**
 * Icônes proposées aux thèmes.
 *
 * Un thème stocke un tracé SVG libre, mais laisser quelqu'un taper une
 * commande `d` à la main est une invitation à l'erreur : le choix se fait donc
 * dans une bibliothèque, dessinée sur la même grille 14×14 que le reste des
 * icônes de l'application.
 */
export interface ThemeIcon {
  id: string
  label: string
  path: string
}

export const THEME_ICONS: ThemeIcon[] = [
  { id: 'card', label: 'Paiement', path: 'M1.6 4h10.8v6.4H1.6zM1.6 6.4h10.8M3.6 8.6h2.2' },
  { id: 'stack', label: 'Socle', path: 'M2 2.4h10v3.4H2zM2 8.2h10v3.4H2zM4 4.1h1.6M4 9.9h1.6' },
  {
    id: 'shield',
    label: 'Conformité',
    path: 'M7 1.8l4.3 1.6v3.3c0 2.6-1.8 4.4-4.3 5.5-2.5-1.1-4.3-2.9-4.3-5.5V3.4zM5.2 6.9l1.4 1.4 2.4-2.6',
  },
  {
    id: 'user',
    label: 'Client',
    path: 'M7 7.2a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2.5 12c.6-1.9 2.3-3.1 4.5-3.1s3.9 1.2 4.5 3.1',
  },
  {
    id: 'database',
    label: 'Données',
    path: 'M7 4.3c2.7 0 4.9-.8 4.9-1.7S9.7.9 7 .9 2.1 1.7 2.1 2.6 4.3 4.3 7 4.3zM2.1 2.6v8.8c0 1 2.2 1.7 4.9 1.7s4.9-.7 4.9-1.7V2.6M2.1 7c0 1 2.2 1.7 4.9 1.7s4.9-.7 4.9-1.7',
  },
  { id: 'layers', label: 'Dette', path: 'M7 1.9l5 2.5-5 2.5-5-2.5zM2 7.5l5 2.5 5-2.5M2 10.2l5 2.5 5-2.5' },
  { id: 'chart', label: 'Pilotage', path: 'M2.4 11.6V7M7 11.6V2.6M11.6 11.6V8.4M1.2 11.6h11.6' },
  { id: 'spark', label: 'Innovation', path: 'M7 1.4l1.5 3.8L12.3 6.7 8.5 8.2 7 12l-1.5-3.8L1.7 6.7 5.5 5.2z' },
  { id: 'globe', label: 'International', path: 'M7 12.2A5.2 5.2 0 107 1.8a5.2 5.2 0 000 10.4zM1.8 7h10.4M7 1.8c1.3 1.4 2 3.2 2 5.2s-.7 3.8-2 5.2c-1.3-1.4-2-3.2-2-5.2s.7-3.8 2-5.2z' },
  { id: 'flag', label: 'Jalon', path: 'M3.2 12.4V2M3.2 2.6h7l-1.4 2.5 1.4 2.5h-7' },
  { id: 'wrench', label: 'Outillage', path: 'M9.2 1.9a3.2 3.2 0 00-3 4.3L2 10.4l1.6 1.6 4.2-4.2a3.2 3.2 0 004.3-3l-2 2-1.9-1.9z' },
  { id: 'bolt', label: 'Performance', path: 'M7.8 1.4L3.2 7.8h3.2l-.6 4.8 4.6-6.4H7.2z' },
]

/** Retrouve l'icône correspondant à un tracé, pour cocher la sélection. */
export function findThemeIcon(path: string): ThemeIcon | undefined {
  return THEME_ICONS.find((icon) => icon.path === path)
}
