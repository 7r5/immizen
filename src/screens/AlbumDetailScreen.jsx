import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { getAlbum, getThumbnailUrl } from "../api/immich";
import { useDpadGrid } from "../hooks/useDpad";
import AuthImage from "../components/AuthImage";

const COLS = 5;

export default function AlbumDetailScreen() {
  const { token, serverUrl, screenParams, navigate, goBack } = useApp();
  const { albumId, albumName } = screenParams;
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const focusedRef = useRef(null);

  useEffect(() => {
    setError(null);
    getAlbum(serverUrl, token, albumId)
      .then((album) => {
        // Try both common field names across Immich versions
        const found = album.assets ?? album.albumAssets ?? [];
        setAssets(found);
        if (found.length === 0) {
          setError(`API returned 0 assets. Raw keys: ${Object.keys(album).join(', ')}. assetCount=${album.assetCount}`);
        }
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [albumId, token, serverUrl]);

  const { focusIndex } = useDpadGrid({
    count: assets.length,
    cols: COLS,
    onSelect: (i) => navigate("viewer", { assets, startIndex: i }),
    onBack: goBack,
    enabled: !loading,
  });

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
          <p style={{ color: '#f87171', fontSize: 26, maxWidth: 1400, wordBreak: 'break-all' }}>{error}</p>
        </div>
      ) : (
        <div className="asset-grid" style={{ "--cols": COLS }}>
          {assets.map((asset, i) => (
            <div
              key={asset.id}
              ref={focusIndex === i ? focusedRef : null}
              className={`asset-thumb ${focusIndex === i ? "focused" : ""}`}
            >
              <AuthImage
                url={getThumbnailUrl(serverUrl, token, asset.id, "thumbnail")}
                alt=""
              />
              {asset.type === "VIDEO" && <div className="video-badge">▶</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
