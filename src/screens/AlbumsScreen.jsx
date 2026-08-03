import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { getAlbums, getSharedAlbums } from "../api/immich";
import { useDpadRows } from "../hooks/useDpad";
import MainLayout from "./MainLayout";
import AlbumRow from "../components/AlbumRow";

export default function AlbumsScreen() {
  const { token, serverUrl, navigate } = useApp();
  const [ownAlbums, setOwnAlbums] = useState([]);
  const [sharedAlbums, setSharedAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focusRegion, setFocusRegion] = useState("content"); // 'sidebar' | 'content'

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAlbums(serverUrl, token),
      getSharedAlbums(serverUrl, token),
    ])
      .then(([own, shared]) => {
        setOwnAlbums(own);
        // filter out albums already in own list to avoid duplicates
        const ownIds = new Set(own.map((a) => a.id));
        setSharedAlbums(shared.filter((a) => !ownIds.has(a.id)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, serverUrl]);

  const rows = [ownAlbums.length, sharedAlbums.length].filter((_, i) =>
    i === 0 ? ownAlbums.length > 0 : sharedAlbums.length > 0,
  );

  const rowData = [
    ...(ownAlbums.length > 0
      ? [{ title: "Your Albums", albums: ownAlbums }]
      : []),
    ...(sharedAlbums.length > 0
      ? [{ title: "Shared with you", albums: sharedAlbums }]
      : []),
  ];

  const { activeRow, activeCol, setFocus } = useDpadRows({
    rows: rowData.map((r) => r.albums.length),
    enabled: focusRegion === "content",
    onSelect: (row, col) => {
      const album = rowData[row]?.albums[col];
      if (album)
        navigate("albumDetail", {
          albumId: album.id,
          albumName: album.albumName,
        });
    },
    onSidebarFocus: () => setFocusRegion("sidebar"),
  });

  return (
    <MainLayout
      focusRegion={focusRegion}
      onContentFocus={() => {
        setFocusRegion("content");
        setFocus(0, 0);
      }}
    >
      {loading ? (
        <div className="loading-state">
          <div className="connecting-spinner" />
          <p>Loading albums…</p>
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
            />
          ))}
        </div>
      )}
    </MainLayout>
  );
}
