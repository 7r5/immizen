import { useState, useEffect, useMemo, useRef } from "react";
import { useApp } from "../context/AppContext";
import { getAlbums, getSharedAlbums, getAlbumAssetSample } from "../api/immich";
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
  const [focusIndex, setFocusIndex] = useState(0);
  const stateActionRef = useRef(null);
  const focusedCardRef = useRef(null);
  const sectionRefs = useRef(new Map());
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

  const allAlbums = useMemo(
    () => [...ownAlbums, ...sharedAlbums],
    [ownAlbums, sharedAlbums],
  );

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

  const indexContextByAlbumIndex = useMemo(() => {
    const map = new Map();
    sections.forEach((section, sectionIndex) => {
      section.items.forEach((item, position) => {
        map.set(item.index, { sectionIndex, position, section });
      });
    });
    return map;
  }, [sections]);

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

  useEffect(() => {
    if (focusRegion === "content" && !loading && orderedAlbums.length === 0) {
      stateActionRef.current?.focus();
    }
  }, [focusRegion, loading, orderedAlbums.length]);

  useEffect(() => {
    const focusedCard = focusedCardRef.current;
    if (!focusedCard) return;
    const context = indexContextByAlbumIndex.get(focusIndex);
    if (!context) return;

    if (context.position === 0) {
      const sectionElement = sectionRefs.current.get(context.section.year);
      if (sectionElement) {
        sectionElement.scrollIntoView({ block: "start", inline: "nearest" });
        focusedCard.focus({ preventScroll: true });
        return;
      }
    }

    focusedCard.scrollIntoView({ block: "nearest", inline: "nearest" });
    focusedCard.focus({ preventScroll: true });
  }, [focusIndex, indexContextByAlbumIndex]);

  useEffect(() => {
    if (focusRegion !== "content" || loading || orderedAlbums.length === 0)
      return;

    const onKeyDown = (event) => {
      const key = event.keyCode;
      const current = indexContextByAlbumIndex.get(focusIndex);

      if (!current) return;

      if (key === 10009 || key === 461) {
        event.preventDefault();
        goBack();
        return;
      }

      if (key === 13) {
        event.preventDefault();
        openAlbum(orderedAlbums[focusIndex]?.album);
        return;
      }

      if (key === 39) {
        event.preventDefault();
        const nextItem = current.section.items[current.position + 1];
        if (nextItem) setFocusIndex(nextItem.index);
        return;
      }

      if (key === 37) {
        event.preventDefault();
        const prevItem = current.section.items[current.position - 1];
        if (prevItem) {
          setFocusIndex(prevItem.index);
        } else if (focusIndex === 0) {
          setFocusRegion("sidebar");
        }
        return;
      }

      if (key === 40) {
        event.preventDefault();
        const nextSection = sections[current.sectionIndex + 1];
        if (nextSection?.items?.length)
          setFocusIndex(nextSection.items[0].index);
        return;
      }

      if (key === 38) {
        event.preventDefault();
        const previousSection = sections[current.sectionIndex - 1];
        if (previousSection?.items?.length)
          setFocusIndex(previousSection.items[0].index);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    focusIndex,
    focusRegion,
    goBack,
    indexContextByAlbumIndex,
    loading,
    openAlbum,
    orderedAlbums,
    sections,
  ]);

  return (
    <MainLayout
      focusRegion={focusRegion}
      onContentFocus={() => {
        setFocusRegion("content");
        setFocusIndex((value) => Math.max(value, 0));
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
              <section
                className="albums-year-section"
                key={section.year}
                ref={(element) => {
                  if (!element) {
                    sectionRefs.current.delete(section.year);
                    return;
                  }
                  sectionRefs.current.set(section.year, element);
                }}
              >
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
