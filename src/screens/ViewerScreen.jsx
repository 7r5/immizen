import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { getAssetUrl, getVideoUrl } from "../api/immich";
import { useDpadViewer } from "../hooks/useDpad";
import AuthImage from "../components/AuthImage";

const INTERVALS = [3, 5, 10];
const UI_HIDE_DELAY = 3000;

export default function ViewerScreen() {
  const { token, serverUrl, screenParams, goBack } = useApp();
  const { assets, startIndex = 0 } = screenParams;

  const [index, setIndex] = useState(startIndex);
  const [playing, setPlaying] = useState(false);
  const [intervalSec, setIntervalSec] = useState(5);
  const [uiVisible, setUiVisible] = useState(true);

  const asset = assets?.[index];
  const isVideo = asset?.type === "VIDEO";

  const slideshowRef = useRef(null);
  const uiTimerRef = useRef(null);
  const totalCount = assets?.length ?? 0;

  const showUiTemporarily = useCallback(() => {
    setUiVisible(true);
    clearTimeout(uiTimerRef.current);
    if (playing) {
      uiTimerRef.current = setTimeout(() => setUiVisible(false), UI_HIDE_DELAY);
    }
  }, [playing]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % totalCount);
    showUiTemporarily();
  }, [totalCount, showUiTemporarily]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + totalCount) % totalCount);
    showUiTemporarily();
  }, [totalCount, showUiTemporarily]);

  const toggleSlideshow = useCallback(() => {
    setPlaying((p) => {
      const next = !p;
      if (next) {
        uiTimerRef.current = setTimeout(
          () => setUiVisible(false),
          UI_HIDE_DELAY,
        );
      } else {
        clearTimeout(uiTimerRef.current);
        setUiVisible(true);
      }
      return next;
    });
  }, []);

  // slideshow interval
  useEffect(() => {
    if (!playing) {
      clearInterval(slideshowRef.current);
      return;
    }
    slideshowRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % totalCount);
    }, intervalSec * 1000);
    return () => clearInterval(slideshowRef.current);
  }, [playing, intervalSec, totalCount]);

  // cleanup on unmount
  useEffect(
    () => () => {
      clearInterval(slideshowRef.current);
      clearTimeout(uiTimerRef.current);
    },
    [],
  );

  useDpadViewer({
    count: totalCount,
    onPrev: goPrev,
    onNext: goNext,
    onToggleSlideshow: toggleSlideshow,
    onBack: () => {
      setPlaying(false);
      goBack();
    },
  });

  if (!asset) return null;

  const mediaSrc = isVideo
    ? getVideoUrl(serverUrl, token, asset.id)
    : getAssetUrl(serverUrl, token, asset.id);

  return (
    <div className="viewer-screen" onClick={showUiTemporarily}>
      {isVideo ? (
        <video
          key={asset.id}
          className="viewer-media"
          src={mediaSrc}
          autoPlay
          controls={false}
          loop
        />
      ) : (
        <AuthImage key={asset.id} url={mediaSrc} className="viewer-media" />
      )}

      {/* bottom overlay UI */}
      <div className={`viewer-overlay ${uiVisible ? "visible" : "hidden"}`}>
        <div className="viewer-counter">
          {index + 1} / {totalCount}
        </div>

        <button
          className={`slideshow-btn ${playing ? "playing" : ""}`}
          onClick={toggleSlideshow}
        >
          {playing ? "⏸ Pause slideshow" : "▶ Start slideshow"}
        </button>

        <div className="interval-selector">
          {INTERVALS.map((s) => (
            <button
              key={s}
              className={`interval-btn ${intervalSec === s ? "active" : ""}`}
              onClick={() => setIntervalSec(s)}
            >
              {s}s
            </button>
          ))}
        </div>

        <button
          className="viewer-back-btn"
          onClick={() => {
            setPlaying(false);
            goBack();
          }}
        >
          ‹ Back
        </button>
      </div>
    </div>
  );
}
