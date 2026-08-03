import { useApp } from "../context/AppContext";
import { getAlbumThumbnailUrl } from "../api/immich";
import AuthImage from "./AuthImage";

export default function AlbumCard({
  album,
  focused,
  focusRef,
  index = 0,
  onSelect,
}) {
  const { token, serverUrl } = useApp();
  const thumbUrl = getAlbumThumbnailUrl(
    serverUrl,
    token,
    album.albumThumbnailAssetId,
  );

  return (
    <button
      type="button"
      ref={focusRef}
      className={`album-card ${focused ? "focused" : ""}`}
      style={{ "--stagger-index": Math.min(index, 12) }}
      tabIndex={focused ? 0 : -1}
      aria-label={`${album.albumName}, ${album.assetCount ?? 0} elementos`}
      onClick={onSelect}
    >
      <div className="album-card-thumb">
        {thumbUrl ? (
          <AuthImage url={thumbUrl} className="album-card-img" alt="" />
        ) : (
          <div className="album-card-placeholder">◈</div>
        )}
        <div className="album-card-gradient" />
      </div>
      <div className="album-card-info">
        <div className="album-card-name">{album.albumName}</div>
        <div className="album-card-count">{album.assetCount ?? 0} items</div>
      </div>
    </button>
  );
}
