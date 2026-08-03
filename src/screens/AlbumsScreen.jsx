import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { getAlbums, getSharedAlbums } from "../api/immich";
import { useDpadRows } from "../hooks/useDpad";
import MainLayout from "./MainLayout";
import AlbumRow from "../components/AlbumRow";

export default function AlbumsScreen() {
  const { token, serverUrl, navigate, goBack } = useApp();
  const [ownAlbums, setOwnAlbums] = useState([]);
  const [sharedAlbums, setSharedAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [focusRegion, setFocusRegion] = useState("content"); // 'sidebar' | 'content'
  const stateActionRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getAlbums(serverUrl, token),
      getSharedAlbums(serverUrl, token),
    ])
      .then(([own, shared]) => {
        if (!active) return;
        setOwnAlbums(own);
        // filter out albums already in own list to avoid duplicates
        const ownIds = new Set(own.map((a) => a.id));
        setSharedAlbums(shared.filter((a) => !ownIds.has(a.id)));
        setError(null);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message || "No se pudieron cargar los álbumes.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, serverUrl, reloadKey]);

  const rowData = [
    ...(ownAlbums.length > 0
      ? [{ title: "Tus álbumes", albums: ownAlbums }]
      : []),
    ...(sharedAlbums.length > 0
      ? [{ title: "Compartidos contigo", albums: sharedAlbums }]
      : []),
  ];

  const retry = () => {
    setError(null);
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  const openAlbum = (album) => {
    if (!album) return;
    navigate("albumDetail", {
      albumId: album.id,
      albumName: album.albumName,
    });
  };

  const { activeRow, activeCol, setFocus } = useDpadRows({
    rows: rowData.map((r) => r.albums.length),
    enabled: focusRegion === "content" && !loading,
    onSelect: (row, col) => {
      if (error || rowData.length === 0) {
        retry();
        return;
      }
      const album = rowData[row]?.albums[col];
      openAlbum(album);
    },
    onBack: goBack,
    onSidebarFocus: () => setFocusRegion("sidebar"),
  });

  useEffect(() => {
    if (focusRegion === "content" && !loading && rowData.length === 0) {
      stateActionRef.current?.focus();
    }
  }, [focusRegion, loading, rowData.length]);

  return (
    <MainLayout
      focusRegion={focusRegion}
      onContentFocus={() => {
        setFocusRegion("content");
        setFocus(0, 0);
      }}
    >
      {loading ? (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="connecting-spinner" aria-hidden="true" />
          <p>Cargando álbumes…</p>
        </div>
      ) : error ? (
        <div className="state-panel" role="alert">
          <h1>No se pudieron cargar los álbumes</h1>
          <p>{error}</p>
          <button
            ref={stateActionRef}
            className={`state-action ${focusRegion === "content" ? "focused" : ""}`}
            onClick={retry}
          >
            Reintentar
          </button>
        </div>
      ) : rowData.length === 0 ? (
        <div className="state-panel" role="status">
          <h1>No hay álbumes disponibles</h1>
          <p>Crea o comparte un álbum en Immich y vuelve a intentarlo.</p>
          <button
            ref={stateActionRef}
            className={`state-action ${focusRegion === "content" ? "focused" : ""}`}
            onClick={retry}
          >
            Actualizar
          </button>
        </div>
      ) : (
        <div className="albums-content">
          {rowData.map((row, ri) => (
            <AlbumRow
              key={row.title}
              title={row.title}
              albums={row.albums}
              focused={focusRegion === "content" && activeRow === ri}
              activeCol={activeRow === ri ? activeCol : 0}
              onSelect={openAlbum}
            />
          ))}
        </div>
      )}
    </MainLayout>
  );
}
