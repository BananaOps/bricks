import { ToastBar } from './components/Chrome'
import { Rail } from './components/Rail'
import { Wordmark } from './components/Logo'
import { useBoard } from './hooks/useBoard'
import { useRoute } from './hooks/useRoute'
import { RoadmapPage } from './pages/RoadmapPage'
import { TeamsPage } from './pages/TeamsPage'
import { ThemesPage } from './pages/ThemesPage'

/**
 * Coquille de l'application : le rail, et la page courante.
 *
 * Le plateau est chargé ici plutôt que dans chaque page. Les trois écrans
 * regardent les mêmes données sous des angles différents — la grille, ses
 * lignes, l'identité de ses briques — donc changer de page ne doit ni relire
 * l'API ni faire clignoter un écran de chargement.
 */
export default function App() {
  const board = useBoard()
  const [route, navigate] = useRoute()

  return (
    // La coquille fait exactement une hauteur de fenêtre et ne défile jamais :
    // c'est la grille qui défile dans son propre cadre, ce qui garde l'en-tête,
    // la barre de filtres et la ligne d'état en place.
    <div
      style={{
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',
        background: 'var(--canvas)',
        position: 'relative',
      }}
    >
      <Rail active={route} onNavigate={navigate} />
      {renderPage()}

      {/*
        Le toast vit ici plutôt que dans chaque page : toutes les écritures
        passent par le même hook, et une confirmation qui n'apparaîtrait que
        sur un écran laisserait les deux autres muets — y compris sur un échec.
      */}
      {board.toast ? (
        <ToastBar
          text={board.toast.text}
          tone={board.toast.tone}
          canUndo={board.canUndo && route === 'roadmap'}
          onUndo={() => void board.undo()}
        />
      ) : null}
    </div>
  )

  function renderPage() {
    if (board.loading) return <Splash message="Chargement de la roadmap…" />
    if (board.error || !board.board) {
      return (
        <Splash
          message={board.error ?? 'Roadmap introuvable.'}
          onRetry={() => void board.reload()}
        />
      )
    }

    switch (route) {
      case 'teams':
        return <TeamsPage board={board} onOpenRoadmap={() => navigate('roadmap')} />
      case 'themes':
        return <ThemesPage board={board} onOpenRoadmap={() => navigate('roadmap')} />
      default:
        return <RoadmapPage board={board} />
    }
  }
}

function Splash({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        background: 'var(--canvas)',
      }}
    >
      <Wordmark tagline="Roadmap capacitaire" />
      <span style={{ font: "500 14px/1.4 var(--sans)", color: 'var(--muted)' }}>{message}</span>
      {onRetry ? (
        <button type="button" className="bk-ghost-button" onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  )
}
