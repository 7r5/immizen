import "./App.css";
import { AppProvider, useApp } from "./context/AppContext";
import AlbumsScreen from "./screens/AlbumsScreen";
import AlbumDetailScreen from "./screens/AlbumDetailScreen";
import ViewerScreen from "./screens/ViewerScreen";

function ConnectingScreen({ error }) {
  const serverUrl = import.meta.env.VITE_IMMICH_URL;
  const email = import.meta.env.VITE_IMMICH_EMAIL;
  return (
    <div className="connecting-screen">
      {error ? (
        <>
          <div className="connecting-icon error-icon">✕</div>
          <h2>Connection failed</h2>
          <p className="connecting-error">{error}</p>
          <div className="connecting-diagnostics">
            <p>
              <span className="diag-label">URL:</span>{" "}
              {serverUrl || <em>not set</em>}
            </p>
            <p>
              <span className="diag-label">Email:</span>{" "}
              {email || <em>not set</em>}
            </p>
          </div>
          <p className="connecting-hint">
            Edit <code>.env.local</code> and restart the dev server.
          </p>
        </>
      ) : (
        <>
          <div className="connecting-spinner" />
          <h2>Connecting to Immich…</h2>
          <p className="connecting-hint">{serverUrl}</p>
        </>
      )}
    </div>
  );
}

function Router() {
  const { status, error, currentScreen } = useApp();

  if (status === "connecting") return <ConnectingScreen />;
  if (status === "error") return <ConnectingScreen error={error} />;

  switch (currentScreen) {
    case "albums":
      return <AlbumsScreen />;
    case "albumDetail":
      return <AlbumDetailScreen />;
    case "viewer":
      return <ViewerScreen />;
    default:
      return <AlbumsScreen />;
  }
}

function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}

export default App;
