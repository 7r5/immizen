import { useMemo } from "react";
import "./App.css";
import { AppProvider, useApp } from "./context/AppContext";
import AlbumsScreen from "./screens/AlbumsScreen";
import AlbumDetailScreen from "./screens/AlbumDetailScreen";
import ViewerScreen from "./screens/ViewerScreen";
import UptimeScreen from "./screens/UptimeScreen";

function createUiTheme() {
  const safeHues = [0, 10, 165, 185, 215, 245, 280, 325];
  const hue = safeHues[Math.floor(Math.random() * safeHues.length)];
  return {
    "--ui-accent": `hsl(${hue} 95% 62%)`,
    "--ui-accent-soft": `hsla(${hue}, 95%, 62%, 0.14)`,
    "--ui-accent-soft-strong": `hsla(${hue}, 95%, 62%, 0.24)`,
    "--ui-accent-glow": `hsla(${hue}, 95%, 62%, 0.38)`,
    "--ui-accent-muted": `hsla(${hue}, 95%, 72%, 0.92)`,
  };
}

function ConnectingScreen({ error }) {
  const serverUrl = import.meta.env.VITE_IMMICH_URL;
  const email = import.meta.env.VITE_IMMICH_EMAIL;
  return (
    <div
      className="connecting-screen"
      role={error ? "alert" : "status"}
      aria-live="polite"
    >
      {error ? (
        <>
          <div className="connecting-icon error-icon" aria-hidden="true">
            ✕
          </div>
          <h2>No se pudo conectar</h2>
          <p className="connecting-error">{error}</p>
          <div className="connecting-diagnostics">
            <p>
              <span className="diag-label">URL:</span>{" "}
              {serverUrl || <em>sin configurar</em>}
            </p>
            <p>
              <span className="diag-label">Correo:</span>{" "}
              {email ? "configurado" : <em>sin configurar</em>}
            </p>
          </div>
          <p className="connecting-hint">
            Edita <code>.env.local</code> y reinicia la aplicación.
          </p>
        </>
      ) : (
        <>
          <div className="connecting-spinner" aria-hidden="true" />
          <h2>Conectando con Immich…</h2>
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
    case "uptime":
      return <UptimeScreen />;
    default:
      return <AlbumsScreen />;
  }
}

function App() {
  const themeVars = useMemo(() => createUiTheme(), []);

  return (
    <div className="app-shell" style={themeVars}>
      <AppProvider>
        <Router />
      </AppProvider>
    </div>
  );
}

export default App;
