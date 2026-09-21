import { useLayoutEffect, useState } from 'react'

/**
 * Largeur intérieure d'un élément, suivie au fil des redimensionnements.
 *
 * `useLayoutEffect` plutôt que `useEffect` : la mesure a lieu avant la peinture,
 * donc la grille s'affiche directement à la bonne largeur au lieu de naître
 * étroite puis de s'élargir d'un bond au premier rendu.
 *
 * La valeur vient de `contentRect`, qui exclut la barre de défilement verticale :
 * la grille remplit l'espace réellement disponible plutôt que de passer
 * quelques pixels dessous.
 */
export function useElementWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    setWidth(element.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (measured != null) setWidth(measured)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
