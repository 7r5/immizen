import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useApp } from "../context/AppContext";
import {
  getAssetUrl,
  getVideoUrl,
  getThumbnailUrl,
  getAssetPeople,
} from "../api/immich";
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

// Tizen's webview ignores video rotation metadata, so we counter-rotate to
// match Immich's orientation (stored as an EXIF value: 6=90°, 8=270°, 3=180°).
// For sideways rotations the box is swapped to the 1920x1080 viewer's other axis
// so object-fit: contain still fits without stretching.
const VIEWER_WIDTH = 1920;
const VIEWER_HEIGHT = 1080;

function computeVideoLayout(asset, videoSize, rotationOverride = null) {
  const orientation = Number(asset?.exifInfo?.orientation) || 1;
  const rotationByOrientation = {
    1: 0,
    2: 0,
    3: 180,
    4: 180,
    5: 90,
    6: 90,
    7: 270,
    8: 270,
  };
  const mirrorX = orientation === 2 || orientation === 5 || orientation === 7;
  const mirrorY = orientation === 4;
  const quarterTurn = orientation >= 5 && orientation <= 8;

  const exif = asset?.exifInfo ?? {};
  const exifWidth = Number(exif.exifImageWidth ?? exif.width ?? 0);
  const exifHeight = Number(exif.exifImageHeight ?? exif.height ?? 0);
  const decodedWidth = Number(videoSize?.width ?? 0);
  const decodedHeight = Number(videoSize?.height ?? 0);

  let rotation = rotationByOrientation[orientation] ?? 0;

  const expectedPortrait =
    exifWidth > 0 && exifHeight > 0 ? exifHeight > exifWidth : null;
  const decodedPortrait =
    decodedWidth > 0 && decodedHeight > 0 ? decodedHeight > decodedWidth : null;

  // Immich stores display-oriented dimensions and browsers apply rotation metadata, but
  // Tizen's webview may not. Compare what the player actually decoded against the intended
  // orientation: if they already match, the player rotated it and we must not rotate again.
  if (quarterTurn) {
    if (decodedPortrait !== null && expectedPortrait !== null) {
      rotation = decodedPortrait === expectedPortrait ? 0 : rotation;
    } else if (decodedPortrait !== null) {
      rotation = decodedPortrait ? 0 : rotation;
    } else if (expectedPortrait) {
      rotation = 0;
    }
  }

  // Manual override for on-device diagnosis; wins over any computed rotation.
  if (rotationOverride !== null) rotation = rotationOverride;

  const sideways = rotation === 90 || rotation === 270;
  const sourceWidth = decodedWidth || exifWidth;
  const sourceHeight = decodedHeight || exifHeight;

  const debug = {
    orientation,
    isTizen: typeof window !== "undefined" && Boolean(window.tizen),
    exifWidth,
    exifHeight,
    decodedWidth,
    decodedHeight,
    rotation,
    manual: rotationOverride,
    mirrorX,
    mirrorY,
    boxWidth: null,
    boxHeight: null,
  };

  if (rotation === 0) {
    if (mirrorX || mirrorY) {
      const mirrorTransforms = [];
      if (mirrorX) mirrorTransforms.push("scaleX(-1)");
      if (mirrorY) mirrorTransforms.push("scaleY(-1)");
      return { style: { transform: mirrorTransforms.join(" ") }, debug };
    }
    return { style: undefined, debug };
  }

  // translateZ(0) pushes the <video> onto a GPU texture layer so the rotation applies to
  // the pixels; on Tizen's hardware video plane a plain 2D rotate only turns the box.
  const transforms = [
    "translate(-50%, -50%)",
    "translateZ(0)",
    `rotate(${rotation}deg)`,
    mirrorX ? "scaleX(-1)" : null,
    mirrorY ? "scaleY(-1)" : null,
  ]
    .filter(Boolean)
    .join(" ");

  // Box is built from the real content aspect so object-fit: contain never stretches.
  const displayWidth = sideways ? sourceHeight : sourceWidth;
  const displayHeight = sideways ? sourceWidth : sourceHeight;

  if (displayWidth > 0 && displayHeight > 0) {
    const scale = Math.min(
      VIEWER_WIDTH / displayWidth,
      VIEWER_HEIGHT / displayHeight,
    );
    const fittedWidth = Math.round(displayWidth * scale);
    const fittedHeight = Math.round(displayHeight * scale);
    const preRotateWidth = sideways ? fittedHeight : fittedWidth;
    const preRotateHeight = sideways ? fittedWidth : fittedHeight;
    debug.boxWidth = preRotateWidth;
    debug.boxHeight = preRotateHeight;
    return {
      style: {
        top: "50%",
        left: "50%",
        right: "auto",
        bottom: "auto",
        width: `${preRotateWidth}px`,
        height: `${preRotateHeight}px`,
        maxWidth: "none",
        maxHeight: "none",
        transform: transforms,
        willChange: "transform",
        backfaceVisibility: "hidden",
      },
      debug,
    };
  }

  // Dimensions unknown yet: swap the viewer box for sideways turns so contain never stretches.
  const fallbackWidth = sideways ? VIEWER_HEIGHT : VIEWER_WIDTH;
  const fallbackHeight = sideways ? VIEWER_WIDTH : VIEWER_HEIGHT;
  debug.boxWidth = fallbackWidth;
  debug.boxHeight = fallbackHeight;
  return {
    style: {
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      width: `${fallbackWidth}px`,
      height: `${fallbackHeight}px`,
      maxWidth: "none",
      maxHeight: "none",
      transform: transforms,
      willChange: "transform",
      backfaceVisibility: "hidden",
    },
    debug,
  };
}

// Immich duration comes as "H:MM:SS.mmm"; drop milliseconds and empty hours.
function formatDuration(raw) {
  if (!raw || typeof raw !== "string") return null;
  const [h = "0", m = "0", s = "0"] = raw.split(":");
  const hours = Number(h) || 0;
  const minutes = Number(m) || 0;
  const seconds = Math.floor(Number(s) || 0);
  if (!hours && !minutes && !seconds) return null;
  const ss = String(seconds).padStart(2, "0");
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!value || value <= 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unit = 0;
  let size = value;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

function formatShutter(exposureTime) {
  const seconds = Number(exposureTime);
  if (!seconds || seconds <= 0) return null;
  if (seconds >= 1)
    return `${seconds % 1 === 0 ? seconds : seconds.toFixed(1)} s`;
  return `1/${Math.round(1 / seconds)} s`;
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

function VideoCanvasMedia({
  slide,
  className,
  serverUrl,
  token,
  isActive,
  playing,
  onAnimationEnd,
  onEnded,
  onError,
  captureVideoDimensions,
  videoDimensions,
  manualRotation,
  onVideoRef,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);

  const layout = useMemo(
    () => computeVideoLayout(slide, videoDimensions[slide.id], manualRotation),
    [manualRotation, slide, videoDimensions],
  );

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawFrame = () => {
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      rafRef.current = window.requestAnimationFrame(drawFrame);
    };

    drawFrame();
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [layout, slide.id]);

  return (
    <>
      <video
        ref={(node) => {
          videoRef.current = node;
          if (onVideoRef) onVideoRef(node);
        }}
        className="viewer-video-hidden"
        src={getVideoUrl(serverUrl, token, slide.id)}
        autoPlay={isActive}
        controls={false}
        loop={false}
        playsInline
        onLoadedMetadata={(event) => captureVideoDimensions(slide.id, event.currentTarget)}
        onEnded={onEnded}
        onAnimationEnd={onAnimationEnd}
        onError={onError}
      />
      <canvas
        key={`canvas-${slide.id}`}
        ref={canvasRef}
        className={`viewer-media ${className}`.trim()}
        style={layout.style}
        onAnimationEnd={onAnimationEnd}
      />
    </>
  );
}

export default function ViewerScreen() {
  const { token, serverUrl, screenParams, goBack } = useApp();
  const { assets = [], startIndex = 0 } = screenParams;
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
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
  const [videoDimensions, setVideoDimensions] = useState({});
  const [manualRotation, setManualRotation] = useState(null);
  const [people, setPeople] = useState([]);
  const peopleCacheRef = useRef(new Map());
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
  const hasMusic = TRACKS.length > 1;
  const menuCount = hasMusic ? 9 : 8;

  useEffect(() => {
    if (!animationsEnabled) setPreviousSlide(null);
  }, [animationsEnabled]);

  useImagePreloader({ assets, index, serverUrl, token });

  useEffect(() => {
    indexRef.current = index;
    navigationIndexRef.current = index;
    setManualRotation(null);
  }, [index]);

  useEffect(() => () => clearTimeout(uiTimerRef.current), []);

  useEffect(() => {
    if (!isVideo || !activeVideoRef.current) return;
    activeVideoRef.current.play().catch(() => {
      setLoadError("La reproducción automática fue bloqueada.");
    });
  }, [index, isVideo]);

  useEffect(() => {
    if (!showInfo || !asset?.id) return;
    const cache = peopleCacheRef.current;
    if (cache.has(asset.id)) {
      setPeople(cache.get(asset.id));
      return;
    }
    let active = true;
    setPeople([]);
    getAssetPeople(serverUrl, token, asset.id)
      .then((list) => {
        cache.set(asset.id, list);
        if (active) setPeople(list);
      })
      .catch(() => {
        if (active) setPeople([]);
      });
    return () => {
      active = false;
    };
  }, [showInfo, asset?.id, serverUrl, token]);

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

  const captureVideoDimensions = useCallback((assetId, mediaElement) => {
    if (!assetId || !mediaElement) return;
    const width = Number(mediaElement.videoWidth || 0);
    const height = Number(mediaElement.videoHeight || 0);
    if (width <= 0 || height <= 0) return;
    setVideoDimensions((previous) => {
      const current = previous[assetId];
      if (current?.width === width && current?.height === height) {
        return previous;
      }
      return { ...previous, [assetId]: { width, height } };
    });
  }, []);

  const finishTransition = useCallback(
    (targetIndex, direction, requestId) => {
      if (requestId !== requestIdRef.current) return;
      const currentAsset = assets[indexRef.current];
      const nextAsset = assets[targetIndex];
      if (!nextAsset) return;
      if (animationsEnabled && currentAsset?.id !== nextAsset.id) {
        setPreviousSlide({
          asset: currentAsset,
          direction,
          transitionId: ++transitionIdRef.current,
        });
      } else {
        setPreviousSlide(null);
      }
      setIndex(targetIndex);
      setPendingSlide(null);
      setLoadError(null);
    },
    [animationsEnabled, assets],
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

  // Ref keeps the timer from restarting when unrelated state (e.g. animations
  // toggle) changes advanceSlide's identity.
  const advanceSlideRef = useRef(advanceSlide);
  useEffect(() => {
    advanceSlideRef.current = advanceSlide;
  }, [advanceSlide]);

  useEffect(() => {
    if (!playing || isVideo || pendingSlide || totalCount < 2) return;
    const timer = setTimeout(
      () => advanceSlideRef.current(),
      intervalSec * 1000,
    );
    return () => clearTimeout(timer);
  }, [index, intervalSec, isVideo, pendingSlide, playing, totalCount]);

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
      if (selectedIndex === 4) return setAnimationsEnabled((value) => !value);
      if (selectedIndex === 5)
        return setManualRotation((prev) =>
          prev == null ? 90 : (prev + 90) % 360,
        );
      if (selectedIndex === 6) return setShowInfo((visible) => !visible);
      if (selectedIndex === 7) {
        setPlaying(false);
        return goBack();
      }
      if (selectedIndex === 8) skipTrack();
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
    const isVideoAsset = asset?.type === "VIDEO";
    const takenAt =
      asset?.localDateTime ?? exif.dateTimeOriginal ?? asset?.fileCreatedAt;

    const rows = [];
    const addRow = (label, value) => {
      if (value !== null && value !== undefined && value !== "") {
        rows.push({ label, value });
      }
    };

    addRow("Tipo", isVideoAsset ? "Video" : "Foto");
    addRow(
      "Fecha",
      takenAt
        ? new Date(takenAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : null,
    );
    if (isVideoAsset) addRow("Duración", formatDuration(asset?.duration));
    addRow(
      "Resolución",
      exif.exifImageWidth && exif.exifImageHeight
        ? `${exif.exifImageWidth} x ${exif.exifImageHeight}`
        : null,
    );
    if (isVideoAsset && exif.fps)
      addRow("Cuadros", `${Math.round(exif.fps)} fps`);
    addRow("Tamaño", formatBytes(exif.fileSizeInByte));
    addRow("Cámara", [exif.make, exif.model].filter(Boolean).join(" "));
    addRow("Lente", exif.lensModel);
    addRow(
      "Ajustes",
      [
        exif.fNumber ? `f/${exif.fNumber}` : null,
        exif.exposureTime ? formatShutter(exif.exposureTime) : null,
        exif.iso ? `ISO ${exif.iso}` : null,
        exif.focalLength ? `${Math.round(exif.focalLength)} mm` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    );
    addRow(
      "Ubicación",
      [exif.city, exif.state, exif.country].filter(Boolean).join(", "),
    );
    addRow("Descripción", exif.description?.trim());
    if (exif.rating > 0) addRow("Valoración", "★".repeat(exif.rating));
    addRow(
      "Personas",
      people
        .filter((person) => person?.name && !person.isHidden)
        .map((person) => person.name)
        .join(", "),
    );

    return { filename: asset?.originalFileName, rows };
  }, [asset, people]);

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
      className={`viewer-bg ${className}`.trim()}
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
          style={
            computeVideoLayout(
              slide,
              videoDimensions[slide.id],
              slide.id === asset.id ? manualRotation : null,
            ).style
          }
          autoPlay={slide.id === asset.id}
          controls={false}
          loop={false}
          onEnded={slide.id === asset.id && playing ? advanceSlide : undefined}
          onLoadedMetadata={(event) =>
            captureVideoDimensions(slide.id, event.currentTarget)
          }
          onAnimationEnd={onAnimationEnd}
          onError={() => {
            if (slide.id === asset.id) {
              setLoadError("No se pudo reproducir el video.");
              if (playing) setTimeout(() => advanceSlide(), 0);
            }
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
      {isVideo && showInfo && (
        <div className="viewer-video-debug" role="status">
          {(() => {
            const d = computeVideoLayout(
              asset,
              videoDimensions[asset.id],
              manualRotation,
            ).debug;
            return (
              <>
                <div>tizen: {String(d.isTizen)}</div>
                <div>orientation: {d.orientation}</div>
                <div>
                  exif: {d.exifWidth}×{d.exifHeight}
                </div>
                <div>
                  decoded: {d.decodedWidth}×{d.decodedHeight}
                </div>
                <div>rotation: {d.rotation}°</div>
                <div>manual: {d.manual == null ? "auto" : `${d.manual}°`}</div>
                <div>
                  box: {d.boxWidth ?? "-"}×{d.boxHeight ?? "-"}
                </div>
                {(d.mirrorX || d.mirrorY) && (
                  <div>
                    mirror: {d.mirrorX ? "X" : ""}
                    {d.mirrorY ? "Y" : ""}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
      {previousSlide &&
        renderBackground(previousSlide.asset, "viewer-bg-leave")}
      {renderBackground(asset, animationsEnabled ? "viewer-bg-enter" : "")}
      {previousSlide &&
        renderForeground(
          previousSlide.asset,
          animationsEnabled
            ? `viewer-media-leave viewer-media-${previousSlide.direction}`
            : "",
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
        animationsEnabled
          ? `viewer-media-enter viewer-media-${previousSlide?.direction ?? "next"} ${playing && !isVideo ? motionClass(asset) : ""}`
          : "",
      )}
      {pendingSlide?.waitingForVideo && (
        <video
          key={`media-${pendingSlide.asset.id}`}
          className="viewer-video-preload"
          src={getVideoUrl(serverUrl, token, pendingSlide.asset.id)}
          muted
          preload="auto"
          onLoadedMetadata={(event) =>
            captureVideoDimensions(pendingSlide.asset.id, event.currentTarget)
          }
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
            if (playing) setTimeout(() => requestRelativeSlide(1), 0);
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
          {details.rows.map(({ label, value }) => (
            <div className="vi-row" key={label}>
              <span className="vi-label">{label}</span>
              <span className="vi-value">{value}</span>
            </div>
          ))}
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
            onClick={() => setAnimationsEnabled((value) => !value)}
            aria-pressed={animationsEnabled}
          >
            Animaciones: {animationsEnabled ? "Sí" : "No"}
          </button>
          <button
            type="button"
            ref={(element) => {
              menuButtonRefs.current[5] = element;
            }}
            className={`viewer-control ${menuIndex === 5 ? "menu-focused" : ""}`}
            onClick={() =>
              setManualRotation((prev) =>
                prev == null ? 90 : (prev + 90) % 360,
              )
            }
          >
            Rotar: {manualRotation == null ? "auto" : `${manualRotation}°`}
          </button>
          <button
            type="button"
            ref={(element) => {
              menuButtonRefs.current[6] = element;
            }}
            className={`viewer-control ${menuIndex === 6 ? "menu-focused" : ""}`}
            onClick={() => setShowInfo((visible) => !visible)}
            aria-pressed={showInfo}
          >
            Info
          </button>
          <button
            type="button"
            ref={(element) => {
              menuButtonRefs.current[7] = element;
            }}
            className={`viewer-control viewer-control-exit ${menuIndex === 7 ? "menu-focused" : ""}`}
            onClick={() => {
              setPlaying(false);
              goBack();
            }}
          >
            Salir
          </button>
          {hasMusic && (
            <button
              type="button"
              ref={(element) => {
                menuButtonRefs.current[8] = element;
              }}
              className={`viewer-control ${menuIndex === 8 ? "menu-focused" : ""}`}
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
    </div>
  );
}
