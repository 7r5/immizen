import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { getAssetUrl, getVideoUrl, getThumbnailUrl } from "../api/immich";
import AuthImage from "../components/AuthImage";
import { loadImage } from "../api/imageCache";
import useMusicPlayer from "../hooks/useMusicPlayer";
import useImagePreloader from "../hooks/useImagePreloader";
import TRACKS from "../config/music";

const INTERVALS = [3, 5, 10];
const UI_HIDE_DELAY = 3000;
const KEYS = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 10009,
  BACK_ALT: 461,
};

function isPortraitAsset(asset) {
  const exif = asset?.exifInfo ?? {};
  return (exif.exifImageHeight ?? 0) > (exif.exifImageWidth ?? 0);
}

function motionClass(asset) {
  if (!asset) return "";
  const hash = [...asset.id].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  const variants = isPortraitAsset(asset)
    ? [
        "viewer-motion-portrait-up",
        "viewer-motion-portrait-down",
        "viewer-motion-portrait-still",
      ]
    : [
        "viewer-motion-landscape-left",
        "viewer-motion-landscape-right",
        "viewer-motion-landscape-zoom",
      ];
  return variants[hash % variants.length];
}

export default function ViewerScreen() {
  const { token, serverUrl, screenParams, goBack } = useApp();
  const { assets = [], startIndex = 0 } = screenParams;
  const totalCount = assets.length;
  const initialIndex = Math.min(
    Math.max(startIndex, 0),
    Math.max(totalCount - 1, 0),
  );
  const [index, setIndex] = useState(initialIndex);
  const [previousSlide, setPreviousSlide] = useState(null);
  const [pendingSlide, setPendingSlide] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [intervalSec, setIntervalSec] = useState(5);
  const [uiVisible, setUiVisible] = useState(true);
  const [menuMode, setMenuMode] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const { trackName, audioError, skipTrack } = useMusicPlayer({
    playing,
    tracks: TRACKS,
  });
  const asset = assets[index];
  const isVideo = asset?.type === "VIDEO";
  const uiTimerRef = useRef(null);
  const requestIdRef = useRef(0);
  const navigationIndexRef = useRef(initialIndex);
  const indexRef = useRef(initialIndex);
  const transitionIdRef = useRef(0);
  const activeVideoRef = useRef(null);
  const menuButtonRefs = useRef([]);
  const menuCount = TRACKS.length > 1 ? 7 : 6;

  useImagePreloader({ assets, index, serverUrl, token });

  useEffect(() => {
    indexRef.current = index;
    navigationIndexRef.current = index;
  }, [index]);

  useEffect(() => () => clearTimeout(uiTimerRef.current), []);

  useEffect(() => {
    if (!isVideo || !activeVideoRef.current) return;
    activeVideoRef.current.play().catch(() => {
      setLoadError("La reproducción automática fue bloqueada.");
    });
  }, [index, isVideo]);

  useEffect(() => {
    if (!menuMode) return;
    const button = menuButtonRefs.current[menuIndex];
    if (!button) return;
    try {
      button.focus({ preventScroll: true });
    } catch {
      button.focus();
    }
  }, [menuIndex, menuMode]);

  const showUi = useCallback(() => {
    setUiVisible(true);
    clearTimeout(uiTimerRef.current);
  }, []);

  const hideUiLater = useCallback(() => {
    clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setUiVisible(false), UI_HIDE_DELAY);
  }, []);

  const finishTransition = useCallback(
    (targetIndex, direction, requestId) => {
      if (requestId !== requestIdRef.current) return;
      const currentAsset = assets[indexRef.current];
      const nextAsset = assets[targetIndex];
      if (!nextAsset) return;
      if (currentAsset?.id !== nextAsset.id) {
        setPreviousSlide({
          asset: currentAsset,
          direction,
          transitionId: ++transitionIdRef.current,
        });
      }
      setIndex(targetIndex);
      setPendingSlide(null);
      setLoadError(null);
    },
    [assets],
  );

  const requestSlide = useCallback(
    (targetIndex, direction, { manual = false } = {}) => {
      if (totalCount < 2 || !assets[targetIndex]) return;
      if (targetIndex === indexRef.current && !pendingSlide) return;

      const requestId = ++requestIdRef.current;
      const target = assets[targetIndex];
      const previewUrl = getThumbnailUrl(
        serverUrl,
        token,
        target.id,
        "preview",
      );
      navigationIndexRef.current = targetIndex;
      setLoadError(null);
      setPendingSlide({ asset: target, direction, requestId });
      if (manual) {
        setPlaying(false);
        showUi();
      }

      if (target.type === "VIDEO") {
        loadImage(previewUrl, token)
          .then(() => {
            if (requestId === requestIdRef.current) {
              setPendingSlide({
                asset: target,
                direction,
                requestId,
                waitingForVideo: true,
              });
            }
          })
          .catch(() => {
            if (requestId !== requestIdRef.current) return;
            navigationIndexRef.current = indexRef.current;
            setPendingSlide(null);
            setLoadError("No se pudo cargar el video.");
          });
        return;
      }

      Promise.all([
        loadImage(getAssetUrl(serverUrl, token, target.id), token),
        loadImage(previewUrl, token),
      ])
        .then(() => finishTransition(targetIndex, direction, requestId))
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          navigationIndexRef.current = indexRef.current;
          setPendingSlide(null);
          setLoadError("No se pudo cargar esta foto.");
        });
    },
    [
      assets,
      finishTransition,
      pendingSlide,
      serverUrl,
      showUi,
      token,
      totalCount,
    ],
  );

  const requestRelativeSlide = useCallback(
    (offset, manual = false) => {
      if (totalCount < 2) return;
      const targetIndex =
        (navigationIndexRef.current + offset + totalCount) % totalCount;
      requestSlide(targetIndex, offset < 0 ? "prev" : "next", { manual });
    },
    [requestSlide, totalCount],
  );

  const advanceSlide = useCallback(() => {
    if (!pendingSlide) requestRelativeSlide(1);
  }, [pendingSlide, requestRelativeSlide]);

  const toggleSlideshow = useCallback(() => {
    if (totalCount < 2) return;
    setPlaying((wasPlaying) => {
      if (wasPlaying) showUi();
      else {
        setMenuMode(false);
        hideUiLater();
      }
      return !wasPlaying;
    });
  }, [hideUiLater, showUi, totalCount]);

  const activateMenu = useCallback(
    (selectedIndex) => {
      if (selectedIndex === 0) return toggleSlideshow();
      if (selectedIndex >= 1 && selectedIndex <= 3)
        return setIntervalSec(INTERVALS[selectedIndex - 1]);
      if (selectedIndex === 4) return setShowInfo((visible) => !visible);
      if (selectedIndex === 5) {
        setPlaying(false);
        return goBack();
      }
      if (selectedIndex === 6) skipTrack();
    },
    [goBack, skipTrack, toggleSlideshow],
  );

  useEffect(() => {
    const onKey = (event) => {
      const key = event.keyCode;
      const isBack = key === KEYS.BACK || key === KEYS.BACK_ALT;
      if (menuMode) {
        const isMenuKey =
          key === KEYS.LEFT ||
          key === KEYS.RIGHT ||
          key === KEYS.ENTER ||
          key === KEYS.UP ||
          isBack;
        if (!isMenuKey) return;
        event.preventDefault();
        if (key === KEYS.LEFT)
          return setMenuIndex((value) => Math.max(value - 1, 0));
        if (key === KEYS.RIGHT)
          return setMenuIndex((value) => Math.min(value + 1, menuCount - 1));
        if (key === KEYS.ENTER) return activateMenu(menuIndex);
        if (key === KEYS.UP || isBack) {
          setMenuMode(false);
          showUi();
          if (playing) hideUiLater();
        }
        return;
      }
      if (key === KEYS.LEFT) {
        event.preventDefault();
        requestRelativeSlide(-1, true);
        return;
      }
      if (key === KEYS.RIGHT) {
        event.preventDefault();
        requestRelativeSlide(1, true);
        return;
      }
      if (key === KEYS.DOWN) {
        event.preventDefault();
        setMenuMode(true);
        setMenuIndex(0);
        showUi();
        return;
      }
      if (key === KEYS.ENTER) {
        event.preventDefault();
        toggleSlideshow();
        return;
      }
      if (isBack) {
        event.preventDefault();
        setPlaying(false);
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activateMenu,
    goBack,
    hideUiLater,
    menuCount,
    menuIndex,
    menuMode,
    playing,
    requestRelativeSlide,
    showUi,
    toggleSlideshow,
  ]);

  const details = useMemo(() => {
    const exif = asset?.exifInfo ?? {};
    const takenAt = asset?.localDateTime ?? asset?.fileCreatedAt;
    return {
      filename: asset?.originalFileName,
      date: takenAt
        ? new Date(takenAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : null,
      camera: [exif.make, exif.model].filter(Boolean).join(" "),
      tech: [
        exif.fNumber ? `f/${exif.fNumber}` : null,
        exif.exposureTime ? `1/${Math.round(1 / exif.exposureTime)}s` : null,
        exif.iso ? `ISO ${exif.iso}` : null,
        exif.focalLength ? `${exif.focalLength}mm` : null,
      ]
        .filter(Boolean)
        .join(" | "),
      dimensions:
        exif.exifImageWidth && exif.exifImageHeight
          ? `${exif.exifImageWidth} x ${exif.exifImageHeight}`
          : null,
      location: [exif.city, exif.country].filter(Boolean).join(", "),
    };
  }, [asset]);

  if (!asset) {
    return (
      <div className="viewer-screen">
        <div className="state-panel viewer-empty" role="alert">
          <h1>No hay elementos para mostrar</h1>
          <button className="state-action focused" onClick={goBack}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  const renderBackground = (slide, className) => (
    <AuthImage
      key={`background-${slide.id}`}
      url={getThumbnailUrl(serverUrl, token, slide.id, "preview")}
      objectFit="cover"
      className={`viewer-bg ${className}`}
    />
  );

  const renderForeground = (slide, className, onAnimationEnd) => {
    if (slide.type === "VIDEO") {
      return (
        <video
          key={`media-${slide.id}`}
          ref={slide.id === asset.id ? activeVideoRef : null}
          className={`viewer-media ${className}`}
          src={getVideoUrl(serverUrl, token, slide.id)}
          autoPlay={slide.id === asset.id}
          controls={false}
          loop={false}
          onEnded={slide.id === asset.id && playing ? advanceSlide : undefined}
          onAnimationEnd={onAnimationEnd}
          onError={() => {
            if (slide.id === asset.id)
              setLoadError("No se pudo reproducir el video.");
          }}
        />
      );
    }
    return (
      <AuthImage
        key={`media-${slide.id}`}
        url={getAssetUrl(serverUrl, token, slide.id)}
        objectFit="contain"
        className={`viewer-media ${className}`}
        onAnimationEnd={onAnimationEnd}
      />
    );
  };

  return (
    <div
      className="viewer-screen"
      onClick={showUi}
      role="region"
      aria-label="Visor de fotos y videos"
    >
      {previousSlide &&
        renderBackground(previousSlide.asset, "viewer-bg-leave")}
      {renderBackground(asset, "viewer-bg-enter")}
      {previousSlide &&
        renderForeground(
          previousSlide.asset,
          `viewer-media-leave viewer-media-${previousSlide.direction}`,
          (event) => {
            if (event.animationName !== "slideFadeOut") return;
            setPreviousSlide((current) =>
              current?.transitionId === previousSlide.transitionId
                ? null
                : current,
            );
          },
        )}
      {renderForeground(
        asset,
        `viewer-media-enter viewer-media-${previousSlide?.direction ?? "next"} ${playing && !isVideo ? motionClass(asset) : ""}`,
      )}
      {pendingSlide?.waitingForVideo && (
        <video
          key={`media-${pendingSlide.asset.id}`}
          className="viewer-video-preload"
          src={getVideoUrl(serverUrl, token, pendingSlide.asset.id)}
          muted
          preload="auto"
          onCanPlay={() =>
            finishTransition(
              assets.findIndex(
                (candidate) => candidate.id === pendingSlide.asset.id,
              ),
              pendingSlide.direction,
              pendingSlide.requestId,
            )
          }
          onError={() => {
            if (pendingSlide.requestId !== requestIdRef.current) return;
            navigationIndexRef.current = indexRef.current;
            setPendingSlide(null);
            setLoadError("No se pudo reproducir el video.");
          }}
        />
      )}
      <div className="viewer-vignette" />
      <div
        className={`viewer-status ${uiVisible ? "visible" : "hidden"}`}
        aria-live="polite"
      >
        <span>
          {index + 1} / {totalCount}
        </span>
        {playing && (
          <span className="viewer-status-playing">Reproduciendo</span>
        )}
        {trackName && !audioError && (
          <span className="viewer-status-track">Música: {trackName}</span>
        )}
        {audioError && (
          <span className="viewer-status-track viewer-status-track-error">
            {audioError}
          </span>
        )}
      </div>
      {showInfo && uiVisible && (
        <div
          className="viewer-info"
          role="status"
          aria-label="Información del elemento"
        >
          {details.filename && (
            <div className="vi-filename">{details.filename}</div>
          )}
          {details.date && <div className="vi-row">{details.date}</div>}
          {details.camera && <div className="vi-row">{details.camera}</div>}
          {details.tech && <div className="vi-row vi-tech">{details.tech}</div>}
          {details.dimensions && (
            <div className="vi-row">{details.dimensions}</div>
          )}
          {details.location && <div className="vi-row">{details.location}</div>}
        </div>
      )}
      {loadError && (
        <div className="viewer-message viewer-message-error" role="alert">
          {loadError}
        </div>
      )}
      {pendingSlide && (
        <div className="viewer-message" role="status" aria-live="polite">
          Cargando siguiente diapositiva…
        </div>
      )}
      {menuMode && (
        <div
          className="viewer-control-panel"
          role="toolbar"
          aria-label="Controles del visor"
        >
          <button
            type="button"
            ref={(element) => {
              menuButtonRefs.current[0] = element;
            }}
            className={`viewer-control-primary ${menuIndex === 0 ? "menu-focused" : ""}`}
            onClick={toggleSlideshow}
            aria-pressed={playing}
          >
            {playing ? "Pausar" : "Iniciar"}
          </button>
          <div className="interval-selector" aria-label="Intervalo">
            {INTERVALS.map((seconds, offset) => (
              <button
                type="button"
                key={seconds}
                ref={(element) => {
                  menuButtonRefs.current[offset + 1] = element;
                }}
                className={`interval-btn ${intervalSec === seconds ? "active" : ""} ${menuIndex === offset + 1 ? "menu-focused" : ""}`}
                onClick={() => setIntervalSec(seconds)}
                aria-pressed={intervalSec === seconds}
              >
                {seconds}s
              </button>
            ))}
          </div>
          <button
            type="button"
            ref={(element) => {
              menuButtonRefs.current[4] = element;
            }}
            className={`viewer-control ${menuIndex === 4 ? "menu-focused" : ""}`}
            onClick={() => setShowInfo((visible) => !visible)}
            aria-pressed={showInfo}
          >
            Info
          </button>
          <button
            type="button"
            ref={(element) => {
              menuButtonRefs.current[5] = element;
            }}
            className={`viewer-control viewer-control-exit ${menuIndex === 5 ? "menu-focused" : ""}`}
            onClick={() => {
              setPlaying(false);
              goBack();
            }}
          >
            Salir
          </button>
          {TRACKS.length > 1 && (
            <button
              type="button"
              ref={(element) => {
                menuButtonRefs.current[6] = element;
              }}
              className={`viewer-control ${menuIndex === 6 ? "menu-focused" : ""}`}
              onClick={skipTrack}
            >
              Siguiente música
            </button>
          )}
        </div>
      )}
      {uiVisible && !menuMode && (
        <div className="viewer-help" role="status">
          ↓ Controles&nbsp;&nbsp; · &nbsp;&nbsp;← → Navegar&nbsp;&nbsp; ·
          &nbsp;&nbsp;OK Reproducir/Pausar
        </div>
      )}
      {playing && !isVideo && !pendingSlide && totalCount > 1 && (
        <div
          key={`progress-${index}-${intervalSec}`}
          className="viewer-progress"
          aria-hidden="true"
          style={{
            animation: `progress-drain ${intervalSec}s linear forwards`,
          }}
          onAnimationEnd={(event) => {
            if (event.animationName === "progress-drain") advanceSlide();
          }}
        />
      )}
    </div>
  );
}
