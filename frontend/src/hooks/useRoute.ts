import { useCallback, useEffect, useState } from 'react'

/** Les destinations du rail. */
export type Route = 'roadmap' | 'teams' | 'themes'

/** Fragment d'URL de chaque destination. */
const PATHS: Record<Route, string> = {
  roadmap: '#/',
  teams: '#/equipes',
  themes: '#/themes',
}

const ROUTES = Object.entries(PATHS) as [Route, string][]

function parse(hash: string): Route {
  const normalized = hash === '' || hash === '#' ? '#/' : hash
  const match = ROUTES.find(([, path]) => path === normalized)
  return match ? match[0] : 'roadmap'
}

export function pathOf(route: Route): string {
  return PATHS[route]
}

/**
 * Routage sur le fragment d'URL.
 *
 * Le fragment plutôt que l'History API : l'application est servie telle quelle
 * en développement comme en production, et un routage par chemin demanderait
 * une réécriture côté serveur pour que rafraîchir une page ne renvoie pas un
 * 404. Le fragment donne les mêmes liens partageables et le même
 * précédent/suivant sans rien exiger de l'hébergement.
 */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash))

  useEffect(() => {
    const onHashChange = () => setRoute(parse(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next: Route) => {
    // Écrire le fragment suffit : l'écouteur ci-dessus rend l'état et l'URL
    // cohérents, qu'on arrive par un clic ou par le bouton Précédent.
    window.location.hash = PATHS[next]
  }, [])

  return [route, navigate]
}
