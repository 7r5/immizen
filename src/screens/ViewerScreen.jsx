import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { getAssetUrl, getVideoUrl, getThumbnailUrl } from "../api/immich";
import AuthImage from "../components/AuthImage";
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

export default function ViewerScreen() {
  const { token, serverUrl, screenParams, goBack } = useApp();
  const { assets, startIndex = 0 } = screenParams;

  const [index, setIndex] = useState(startIndex);
  const [direction, setDirection] = useState("next");
  const [prevAssetId, setPrevAssetId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [intervalSec, setIntervalSec] = useState(5);
  const [uiVisible, setUiVisible] = useState(true);
  const [menuMode, setMenuMode] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  // separate from prevAssetId: persists until the new blurred bg has fully faded in
  const [prevBgId, setPrevBgId] = useState(null);
  const { trackName, skipTrack } = useMusicPlayer({ playing, tracks: TRACKS });
  useImagePreloader({ assets, index, serverUrl, token });
  // skip button appears only when there are multiple tracks to cycle through
  const menuCount = TRACKS.length > 1 ? 6 : 5;

  const asset = assets?.[index];
  const isVideo = asset?.type === "VIDEO";
  const slideshowRef = useRef(null);
  const uiTimerRef = useRef(null);
  // ref so the interval callback always reads the latest index without being a closure dep
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  });
  const totalCount = assets?.length ?? 0;

  const scheduleUiHide = useCallback(() => {
    clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setUiVisible(false), UI_HIDE_DELAY);
  }, []);

  const showUi = useCallback(() => {
    setUiVisible(true);
    clearTimeout(uiTimerRef.current);
  }, []);

  const toggleSlideshow = useCallback(() => {
    setPlaying((p) => {
      if (!p) scheduleUiHide();
      else {
        clearTimeout(uiTimerRef.current);
        setUiVisible(true);
      }
      return !p;
    });
  }, [scheduleUiHide]);

  // Images: progress bar onAnimationEnd drives timing (no interval needed).
  // Videos: advance when the video clip ends naturally.
  const advanceSlide = useCallback(() => {
    const currentId = assets?.[indexRef.current]?.id ?? null;
    setPrevAssetId(currentId);
    setPrevBgId(currentId);
    setDirection("next");
    setIndex((i) => (i + 1) % totalCount);
  }, [totalCount]);

  useEffect(
    () => () => {
      clearInterval(slideshowRef.current);
      clearTimeout(uiTimerRef.current);
    },
    [],
  );

  const activateMenu = useCallback(
    (i) => {
      if (i === 0) {
        toggleSlideshow();
        return;
      }
      if (i >= 1 && i <= 3) {
        setIntervalSec(INTERVALS[i - 1]);
        return;
      }
      if (i === 4) {
        setPlaying(false);
        goBack();
      }
      if (i === 5) {
        skipTrack();
      }
    },
    [toggleSlideshow, goBack, skipTrack],
  );

  useEffect(() => {
    const onKey = (e) => {
      const k = e.keyCode;
      const isBack = k === KEYS.BACK || k === KEYS.BACK_ALT;

      if (menuMode) {
        e.preventDefault();
        if (k === KEYS.LEFT) {
          setMenuIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (k === KEYS.RIGHT) {
          setMenuIndex((i) => Math.min(i + 1, menuCount - 1));
          return;
        }
        if (k === KEYS.ENTER) {
          activateMenu(menuIndex);
          return;
        }
        if (k === KEYS.UP || isBack) {
          setMenuMode(false);
          showUi();
          return;
        }
        return;
      }

      if (k === KEYS.LEFT) {
        e.preventDefault();
        setPrevAssetId(assets?.[index]?.id ?? null);
        setPrevBgId(assets?.[index]?.id ?? null);
        setDirection("prev");
        setIndex((i) => (i - 1 + totalCount) % totalCount);
        showUi();
        return;
      }
      if (k === KEYS.RIGHT) {
        e.preventDefault();
        setPrevAssetId(assets?.[index]?.id ?? null);
        setPrevBgId(assets?.[index]?.id ?? null);
        setDirection("next");
        setIndex((i) => (i + 1) % totalCount);
        showUi();
        return;
      }
      if (k === KEYS.DOWN) {
        e.preventDefault();
        setMenuMode(true);
        setMenuIndex(0);
        showUi();
        return;
      }
      if (k === KEYS.ENTER) {
        e.preventDefault();
        toggleSlideshow();
        return;
      }
      if (isBack) {
        e.preventDefault();
        setPlaying(false);
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    menuMode,
    menuIndex,
    totalCount,
    activateMenu,
    toggleSlideshow,
    showUi,
    goBack,
    menuCount,
  ]);

  if (!asset) return null;

  const mediaSrc = isVideo
    ? getVideoUrl(serverUrl, token, asset.id)
    : getAssetUrl(serverUrl, token, asset.id);

  // only bgPanClass and portrait detection needed — foreground has no Ken Burns
  const { bgPanClass, isPortrait } = useMemo(() => {
    const exif = asset.exifInfo ?? {};
    const w = exif.exifImageWidth ?? 0;
    const h = exif.exifImageHeight ?? 0;
    const bgDirs = [
      "viewer-bg-pan-left",
      "viewer-bg-pan-right",
      "viewer-bg-pan-up",
      "viewer-bg-pan-down",
    ];
    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    return { bgPanClass: rand(bgDirs), isPortrait: h > w };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  const exif = asset.exifInfo ?? {};
  const takenAt = asset.localDateTime ?? asset.fileCreatedAt;
  const dateStr = takenAt
    ? new Date(takenAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  const camera = [exif.make, exif.model].filter(Boolean).join(" ");
  const tech = [
    exif.fNumber ? `f/${exif.fNumber}` : null,
    exif.exposureTime ? `1/${Math.round(1 / exif.exposureTime)}s` : null,
    exif.iso ? `ISO ${exif.iso}` : null,
    exif.focalLength ? `${exif.focalLength}mm` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const location = [exif.city, exif.country].filter(Boolean).join(", ");
  const dims =
    exif.exifImageWidth && exif.exifImageHeight
      ? `${exif.exifImageWidth} × ${exif.exifImageHeight}`
      : null;

  return (
    <div className="viewer-screen" onClick={showUi}>
      {/* prevBgId holds the old blurred bg at full opacity until the new one finishes fading in */}
      {!isVideo && prevBgId && prevBgId !== asset.id && (
        <AuthImage
          key={`bg-prev-${prevBgId}`}
          url={getThumbnailUrl(serverUrl, token, prevBgId, "preview")}
          objectFit="cover"
          className="viewer-bg viewer-bg-hold"
        />
      )}
      {/* new background: fades in over 1.5s, then pans; onAnimationEnd removes the hold layer */}
      {!isVideo && (
        <AuthImage
          key={`bg-${asset.id}`}
          url={getThumbnailUrl(serverUrl, token, asset.id, "preview")}
          objectFit="cover"
          className={`viewer-bg ${bgPanClass}`}
          onAnimationEnd={(e) => {
            if (e.animationName === "bgFadeIn") setPrevBgId(null);
          }}
        />
      )}
      {/* previous image cross-dissolves out; onAnimationEnd clears the ghost layer */}
      {prevAssetId && prevAssetId !== asset.id && !isVideo && (
        <AuthImage
          key={`prev-${prevAssetId}`}
          url={getAssetUrl(serverUrl, token, prevAssetId)}
          objectFit="cover"
          className={`viewer-media-exit anim-exit-${direction}`}
          onAnimationEnd={() => setPrevAssetId(null)}
        />
      )}
      {isVideo ? (
        <video
          key={asset.id}
          className="viewer-media"
          src={mediaSrc}
          autoPlay
          controls={false}
          loop={!playing}
          onEnded={playing ? advanceSlide : undefined}
        />
      ) : (
        /* No Ken Burns scale — pure cross-dissolve. Portrait uses contain so full photo is visible. */
        <AuthImage
          key={asset.id}
          url={mediaSrc}
          objectFit={playing && !isPortrait ? "cover" : "contain"}
          className={`viewer-media anim-enter-${direction}`}
        />
      )}

      {/* top-right info panel */}
      <div className={`viewer-info ${uiVisible ? "visible" : "hidden"}`}>
        {asset.originalFileName && (
          <div className="vi-filename">{asset.originalFileName}</div>
        )}
        {dateStr && <div className="vi-row">📅 {dateStr}</div>}
        {camera && <div className="vi-row">📷 {camera}</div>}
        {tech && <div className="vi-row vi-tech">{tech}</div>}
        {dims && <div className="vi-row">🖼 {dims}</div>}
        {location && <div className="vi-row">📍 {location}</div>}
      </div>

      <div className={`viewer-overlay ${uiVisible ? "visible" : "hidden"}`}>
        <div className="viewer-counter">
          {index + 1} / {totalCount}
        </div>

        {trackName && <div className="music-badge">&#9835; {trackName}</div>}

        <button
          className={`slideshow-btn ${playing ? "playing" : ""} ${menuMode && menuIndex === 0 ? "menu-focused" : ""}`}
          onClick={toggleSlideshow}
        >
          {playing ? "⏸ Pause slideshow" : "▶ Start slideshow"}
        </button>

        <div className="interval-selector">
          {INTERVALS.map((s, i) => (
            <button
              key={s}
              className={`interval-btn ${intervalSec === s ? "active" : ""} ${menuMode && menuIndex === i + 1 ? "menu-focused" : ""}`}
              onClick={() => setIntervalSec(s)}
            >
              {s}s
            </button>
          ))}
        </div>

        <button
          className={`viewer-back-btn ${menuMode && menuIndex === 4 ? "menu-focused" : ""}`}
          onClick={() => {
            setPlaying(false);
            goBack();
          }}
        >
          &#8249; Back
        </button>

        {TRACKS.length > 1 && (
          <button
            className={`skip-track-btn ${menuMode && menuIndex === 5 ? "menu-focused" : ""}`}
            onClick={skipTrack}
          >
            &#9197;
          </button>
        )}
      </div>

      <div className="viewer-vignette" />

      {/* progress bar only for images — its onAnimationEnd drives the slide advance */}
      {playing && !isVideo && (
        <div
          key={`progress-${index}-${intervalSec}`}
          className="viewer-progress"
          style={{
            animation: `progress-drain ${intervalSec}s linear forwards`,
          }}
          onAnimationEnd={advanceSlide}
        />
      )}

      {menuMode && (
        <div className="viewer-hint">
          &#8592;&#8594; navigate &nbsp; Enter select &nbsp; &#8593; exit menu
        </div>
      )}
    </div>
  );
}
