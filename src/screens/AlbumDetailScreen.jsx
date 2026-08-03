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

export default function AlbumDetailScreen() {
  const { token, serverUrl, screenParams, navigate, goBack } = useApp();
  const { albumId, albumName } = screenParams;
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // How many asset cells are currently in the DOM
  const [renderCount, setRenderCount] = useState(PAGE);
  const focusedRef = useRef(null);

  useEffect(() => {
    setError(null);
    setRenderCount(PAGE);
    getAlbum(serverUrl, token, albumId)
      .then(async (album) => {
        let found = album.assets ?? album.albumAssets ?? [];
        // Newer Immich versions don't embed assets; fall back to the assets endpoint.
        if (found.length === 0 && (album.assetCount ?? 0) > 0) {
          found = await getAlbumAssets(serverUrl, token, albumId);
        }
        if (found.length === 0) {
          setError(
            `0 assets returned. Album keys: [${Object.keys(album).join(", ")}] assetCount=${album.assetCount}`,
          );
        }
        setAssets(found);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [albumId, token, serverUrl]);

  const { focusIndex } = useDpadGrid({
    count: assets.length,
    cols: COLS,
    onSelect: (i) => navigate("viewer", { assets, startIndex: i }),
    onBack: goBack,
    enabled: !loading,
  });

  // Extend the render window before the user reaches its edge
  useEffect(() => {
    if (focusIndex + LOAD_AHEAD >= renderCount && renderCount < assets.length) {
      setRenderCount((c) => Math.min(c + PAGE, assets.length));
    }
  }, [focusIndex, renderCount, assets.length]);

  // scroll focused thumbnail into view
  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusIndex]);

  return (
    <div className="fullscreen-screen album-detail-screen">
      <header className="detail-header">
        <button className="back-btn" onClick={goBack}>
          ‹
        </button>
        <h1 className="detail-title">{albumName}</h1>
        <span className="detail-count">{assets.length} items</span>
      </header>

      {loading ? (
        <div className="loading-state">
          <div className="connecting-spinner" />
          <p>Loading…</p>
        </div>
      ) : error ? (
        <div className="loading-state">
          <p
            style={{
              color: "#f87171",
              fontSize: 26,
              maxWidth: 1400,
              wordBreak: "break-all",
            }}
          >
            {error}
          </p>
        </div>
      ) : (
        <div className="asset-grid" style={{ "--cols": COLS }}>
          {assets.slice(0, renderCount).map((asset, i) => (
            <div
              key={asset.id}
              ref={focusIndex === i ? focusedRef : null}
              className={`asset-thumb ${focusIndex === i ? "focused" : ""}`}
              style={{ "--stagger-index": Math.min(i % PAGE, 30) }}
            >
              <AuthImage
                url={getThumbnailUrl(serverUrl, token, asset.id, "thumbnail")}
                alt=""
              />
              {asset.type === "VIDEO" && <div className="video-badge">▶</div>}
              {asset.exifInfo?.city && (
                <div className="thumb-location">
                  📍{" "}
                  {[asset.exifInfo.city, asset.exifInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
