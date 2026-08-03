import './App.css'
import { AppProvider, useApp } from './context/AppContext'
import AlbumsScreen from './screens/AlbumsScreen'
import AlbumDetailScreen from './screens/AlbumDetailScreen'
import ViewerScreen from './screens/ViewerScreen'

function ConnectingScreen({ error }) {
  return (
    <div className="connecting-screen">
      {error ? (
        <>
          <div className="connecting-icon error-icon">✕</div>
          <h2>Connection failed</h2>
          <p className="connecting-error">{error}</p>
          <p className="connecting-hint">Check your .env.local credentials and Immich server.</p>
        </>
      ) : (
        <>
          <div className="connecting-spinner" />
          <h2>Connecting to Immich…</h2>
        </>
      )}
    </div>
  )
}

function Router() {
  const { status, error, currentScreen } = useApp()

  if (status === 'connecting') return <ConnectingScreen />
  if (status === 'error') return <ConnectingScreen error={error} />

  switch (currentScreen) {
    case 'albums': return <AlbumsScreen />
    case 'albumDetail': return <AlbumDetailScreen />
    case 'viewer': return <ViewerScreen />
    default: return <AlbumsScreen />
  }
}

function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}

export default App
