import { useState, useEffect, useMemo, useRef } from "react";
import { useApp } from "../context/AppContext";
import { getAlbums, getSharedAlbums, getAlbumAssetSample } from "../api/immich";
import { useDpadGrid } from "../hooks/useDpad";
import MainLayout from "./MainLayout";
import AlbumCard from "../components/AlbumCard";

const ALBUM_GRID_COLS = 2;

export default function AlbumsScreen() {
  const { token, serverUrl, navigate, goBack } = useApp();
  const [ownAlbums, setOwnAlbums] = useState([]);
  const [sharedAlbums, setSharedAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [focusRegion, setFocusRegion] = useState("content"); // 'sidebar' | 'content'
  const [albumDateMetaById, setAlbumDateMetaById] = useState({});
  const stateActionRef = useRef(null);
  const focusedCardRef = useRef(null);
  const albumDateCacheRef = useRef(new Map());

  const monthLabel = (date) =>
    date.toLocaleDateString("es-MX", { month: "short" }).replace(".", "");

  const parseAssetDate = (asset) => {
    const exif = asset?.exifInfo ?? {};
    const candidate =
      asset?.localDateTime ?? exif?.dateTimeOriginal ?? asset?.fileCreatedAt;
    if (!candidate) return null;
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const summarizeAlbumDates = (assets) => {
    const sampleDates = assets
      .map((asset) => parseAssetDate(asset))
      .filter((value) => value !== null)
      .sort((left, right) => left - right);

    if (sampleDates.length === 0) {
      return { year: 0, periodLabel: "Fecha desconocida" };
    }

    const first = sampleDates[0];
    const last = sampleDates[sampleDates.length - 1];
    const year = last.getFullYear();
    const sameYear = first.getFullYear() === last.getFullYear();
    const sameMonth = sameYear && first.getMonth() === last.getMonth();

    if (sameMonth) {
      return {
        year,
        periodLabel: `${monthLabel(first)} ${year}`,
      };
    }

    if (sameYear) {
      return {
        year,
        periodLabel: `${monthLabel(first)} - ${monthLabel(last)} ${year}`,
      };
    }

    return {
      year,
      periodLabel: `${monthLabel(first)} ${first.getFullYear()} - ${monthLabel(last)} ${last.getFullYear()}`,
    };
  };

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

  const allAlbums = [...ownAlbums, ...sharedAlbums];

  useEffect(() => {
    if (loading || allAlbums.length === 0) {
      setAlbumDateMetaById({});
      return;
    }

    let active = true;
    const uniqueAlbums = allAlbums.filter(
      (album, index, source) =>
        source.findIndex((entry) => entry.id === album.id) === index,
    );

    Promise.all(
      uniqueAlbums.map(async (album) => {
        const cached = albumDateCacheRef.current.get(album.id);
        if (cached) return [album.id, cached];
        try {
          const sampleAssets = await getAlbumAssetSample(
            serverUrl,
            token,
            album.id,
            5,
          );
          const meta = summarizeAlbumDates(sampleAssets);
          albumDateCacheRef.current.set(album.id, meta);
          return [album.id, meta];
        } catch {
          const fallback = { year: 0, periodLabel: "Fecha desconocida" };
          albumDateCacheRef.current.set(album.id, fallback);
          return [album.id, fallback];
        }
      }),
    ).then((entries) => {
      if (!active) return;
      setAlbumDateMetaById(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [allAlbums, loading, serverUrl, token]);

  const orderedAlbums = useMemo(() => {
    const withDates = allAlbums.map((album) => ({
      album,
      meta: albumDateMetaById[album.id] ?? {
        year: 0,
        periodLabel: "Fecha desconocida",
      },
    }));

    withDates.sort((left, right) => {
      if (right.meta.year !== left.meta.year)
        return right.meta.year - left.meta.year;
      return left.album.albumName.localeCompare(right.album.albumName, "es");
    });

    return withDates;
  }, [albumDateMetaById, allAlbums]);

  const sections = useMemo(() => {
    const groups = new Map();
    orderedAlbums.forEach((entry, index) => {
      const year = entry.meta.year > 0 ? String(entry.meta.year) : "Sin año";
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push({ ...entry, index });
    });
    return [...groups.entries()].map(([year, items]) => ({ year, items }));
  }, [orderedAlbums]);

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

  const { focusIndex, setFocusIndex } = useDpadGrid({
    count: orderedAlbums.length,
    cols: ALBUM_GRID_COLS,
    enabled: focusRegion === "content" && !loading,
    onSelect: (index) => {
      if (error || orderedAlbums.length === 0) {
        retry();
        return;
      }
      const album = orderedAlbums[index]?.album;
      openAlbum(album);
    },
    onBack: goBack,
    onSidebarFocus: () => setFocusRegion("sidebar"),
  });

  useEffect(() => {
    if (focusRegion === "content" && !loading && orderedAlbums.length === 0) {
      stateActionRef.current?.focus();
    }
  }, [focusRegion, loading, orderedAlbums.length]);

  useEffect(() => {
    const focusedCard = focusedCardRef.current;
    if (!focusedCard) return;
    focusedCard.scrollIntoView({ block: "nearest", inline: "nearest" });
    focusedCard.focus({ preventScroll: true });
  }, [focusIndex]);

  return (
    <MainLayout
      focusRegion={focusRegion}
      onContentFocus={() => {
        setFocusRegion("content");
        setFocusIndex(0);
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
      ) : orderedAlbums.length === 0 ? (
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
          <div className="albums-grid-sections" aria-label="Todos los álbumes">
            {sections.map((section) => (
              <section className="albums-year-section" key={section.year}>
                <h2 className="albums-year-title">
                  {section.year} <span>({section.items.length} álbumes)</span>
                </h2>
                <div className="albums-grid">
                  {section.items.map(({ album, index, meta }) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      periodLabel={meta.periodLabel}
                      isShared={Boolean(album?.shared || album?.isShared)}
                      index={index}
                      focused={
                        focusRegion === "content" && focusIndex === index
                      }
                      focusRef={focusIndex === index ? focusedCardRef : null}
                      onSelect={() => openAlbum(album)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
