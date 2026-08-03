import { useApp } from "../context/AppContext";
import { getAlbumThumbnailUrl } from "../api/immich";

export default function AlbumCard({ album, focused }) {
  const { token, serverUrl } = useApp();
  const thumbUrl = getAlbumThumbnailUrl(
    serverUrl,
    token,
    album.albumThumbnailAssetId,
  );

  return (
    <div className={`album-card ${focused ? "focused" : ""}`}>
      <div className="album-card-thumb">
        {thumbUrl ? (
          <img src={thumbUrl} alt={album.albumName} loading="lazy" />
        ) : (
          <div className="album-card-placeholder">◈</div>
        )}
        <div className="album-card-gradient" />
      </div>
      <div className="album-card-info">
        <div className="album-card-name">{album.albumName}</div>
        <div className="album-card-count">{album.assetCount ?? 0} items</div>
      </div>
    </div>
  );
}
