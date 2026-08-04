import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { getAlbum, getAlbumAssets, getThumbnailUrl } from "../api/immich";
import { useDpadGrid } from "../hooks/useDpad";
import AuthImage from "../components/AuthImage";

const COLS = 5;
// How many thumbnails to render initially and per expansion step
const PAGE = 80;
// Expand the render window when focus is this many items from the loaded boundary
const LOAD_AHEAD = COLS * 4;
const albumAssetsCache = new Map();

export default function AlbumDetailScreen() {
  const { token, serverUrl, screenParams, navigate, goBack } = useApp();
  const { albumId, albumName } = screenParams;
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const focusedRef = useRef(null);
  const gridRef = useRef(null);
  const skipNextScrollRef = useRef(false);
  const didRestoreRef = useRef(false);

  useEffect(() => {
    const cachedAssets = albumAssetsCache.get(albumId);
    if (cachedAssets) {
      setAssets(cachedAssets);
      setError(null);
      setLoading(false);
      return undefined;
    }

    let active = true;
    getAlbum(serverUrl, token, albumId)
      .then(async (album) => {
        let found = album.assets ?? album.albumAssets ?? [];
        // Newer Immich versions don't embed assets; fall back to the assets endpoint.
        if (found.length === 0 && (album.assetCount ?? 0) > 0) {
          found = await getAlbumAssets(serverUrl, token, albumId);
        }
        if (found.length === 0 && (album.assetCount ?? 0) > 0) {
          throw new Error(
            "Immich informó elementos, pero no devolvió ninguno.",
          );
        }
        if (!active) return;
        const orderedAssets = [...found].reverse();
        albumAssetsCache.set(albumId, orderedAssets);
        setAssets(orderedAssets);
        setError(null);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [albumId, token, serverUrl, reloadKey]);

  const retry = () => {
    albumAssetsCache.delete(albumId);
    setError(null);
    setLoading(true);
    setReloadKey((value) => value + 1);
  };

  const isEmpty = !loading && !error && assets.length === 0;

  const { focusIndex, setFocusIndex } = useDpadGrid({
    count: assets.length,
    cols: COLS,
    onSelect: (i) => {
      if (error || isEmpty) return retry();
      if (assets[i]) {
        navigate("albumDetail", {
          albumId,
          albumName,
          returnFocusIndex: i,
          returnScrollTop: gridRef.current?.scrollTop ?? 0,
        });
        navigate("viewer", { assets, startIndex: i });
      }
    },
    onBack: goBack,
    enabled: !loading,
  });

  const renderCount = Math.min(
    assets.length,
    Math.max(PAGE, Math.ceil((focusIndex + LOAD_AHEAD + 1) / PAGE) * PAGE),
  );

  useEffect(() => {
    if (didRestoreRef.current) return;
    if (loading || error || isEmpty || assets.length === 0) return;

    const savedIndex = Number(screenParams.returnFocusIndex);
    const savedScrollTop = Number(screenParams.returnScrollTop);
    const hasSavedIndex = Number.isInteger(savedIndex);
    const hasSavedScroll = Number.isFinite(savedScrollTop);

    if (!hasSavedIndex && !hasSavedScroll) {
      didRestoreRef.current = true;
      return;
    }

    if (hasSavedScroll && gridRef.current) {
      gridRef.current.scrollTop = Math.max(savedScrollTop, 0);
    }

    if (hasSavedIndex) {
      const clampedIndex = Math.min(
        Math.max(savedIndex, 0),
        Math.max(assets.length - 1, 0),
      );
      skipNextScrollRef.current = true;
      setFocusIndex(clampedIndex);
    }

    didRestoreRef.current = true;
  }, [
    assets.length,
    error,
    isEmpty,
    loading,
    screenParams.returnFocusIndex,
    screenParams.returnScrollTop,
    setFocusIndex,
  ]);

  // Keep focused thumbnail visible while navigating with the remote.
  useEffect(() => {
    const focused = focusedRef.current;
    if (!focused) return;
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      focused.focus({ preventScroll: true });
      return;
    }
    focused.scrollIntoView({ block: "nearest", inline: "nearest" });
    focused.focus({ preventScroll: true });
  }, [focusIndex]);

  return (
    <div className="fullscreen-screen album-detail-screen">
      <header className="detail-header">
        <button className="back-btn" onClick={goBack} aria-label="Volver">
          ‹
        </button>
        <h1 className="detail-title">{albumName}</h1>
        <span className="detail-count">{assets.length} elementos</span>
      </header>

      {loading ? (
        <div className="loading-state" role="status" aria-live="polite">
          <div className="connecting-spinner" aria-hidden="true" />
          <p>Cargando…</p>
        </div>
      ) : error ? (
        <div className="state-panel" role="alert">
          <h2>No se pudo cargar el álbum</h2>
          <p>{error}</p>
          <button className="state-action focused" onClick={retry}>
            Reintentar
          </button>
        </div>
      ) : isEmpty ? (
        <div className="state-panel" role="status">
          <h2>Este álbum está vacío</h2>
          <button className="state-action focused" onClick={retry}>
            Actualizar
          </button>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="asset-grid"
          style={{ "--cols": COLS }}
          aria-label="Elementos del álbum"
        >
          {assets.slice(0, renderCount).map((asset, i) => (
            <button
              type="button"
              key={asset.id}
              ref={focusIndex === i ? focusedRef : null}
              className={`asset-thumb ${focusIndex === i ? "focused" : ""}`}
              style={{ "--stagger-index": Math.min(i % PAGE, 30) }}
              tabIndex={focusIndex === i ? 0 : -1}
              aria-label={`${asset.type === "VIDEO" ? "Video" : "Foto"}: ${asset.originalFileName ?? `elemento ${i + 1}`}`}
              onClick={() => {
                navigate("albumDetail", {
                  albumId,
                  albumName,
                  returnFocusIndex: i,
                  returnScrollTop: gridRef.current?.scrollTop ?? 0,
                });
                navigate("viewer", { assets, startIndex: i });
              }}
            >
              <AuthImage
                url={getThumbnailUrl(serverUrl, token, asset.id, "thumbnail")}
                alt=""
              />
              {asset.type === "VIDEO" && (
                <div className="video-badge" aria-hidden="true">
                  ▶
                </div>
              )}
              {asset.exifInfo?.city && (
                <div className="thumb-location">
                  📍{" "}
                  {[asset.exifInfo.city, asset.exifInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
