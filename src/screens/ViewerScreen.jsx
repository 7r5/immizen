import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { getAssetUrl, getVideoUrl } from '../api/immich'
import AuthImage from '../components/AuthImage'

const INTERVALS = [3, 5, 10]
const UI_HIDE_DELAY = 3000
const MENU_COUNT = 5

const KEYS = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, BACK_ALT: 461 }

export default function ViewerScreen() {
  const { token, serverUrl, screenParams, goBack } = useApp()
  const { assets, startIndex = 0 } = screenParams

  const [index, setIndex] = useState(startIndex)
  const [playing, setPlaying] = useState(false)
  const [intervalSec, setIntervalSec] = useState(5)
  const [uiVisible, setUiVisible] = useState(true)
  const [menuMode, setMenuMode] = useState(false)
  const [menuIndex, setMenuIndex] = useState(0)

  const asset = assets?.[index]
  const isVideo = asset?.type === 'VIDEO'
  const slideshowRef = useRef(null)
  const uiTimerRef = useRef(null)
  const totalCount = assets?.length ?? 0

  const scheduleUiHide = useCallback(() => {
    clearTimeout(uiTimerRef.current)
    uiTimerRef.current = setTimeout(() => setUiVisible(false), UI_HIDE_DELAY)
  }, [])

  const showUi = useCallback(() => {
    setUiVisible(true)
    clearTimeout(uiTimerRef.current)
  }, [])

  const toggleSlideshow = useCallback(() => {
    setPlaying((p) => {
      if (!p) scheduleUiHide()
      else { clearTimeout(uiTimerRef.current); setUiVisible(true) }
      return !p
    })
  }, [scheduleUiHide])

  useEffect(() => {
    if (!playing) { clearInterval(slideshowRef.current); return }
    slideshowRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % totalCount)
    }, intervalSec * 1000)
    return () => clearInterval(slideshowRef.current)
  }, [playing, intervalSec, totalCount])

  useEffect(() => () => {
    clearInterval(slideshowRef.current)
    clearTimeout(uiTimerRef.current)
  }, [])

  const activateMenu = useCallback((i) => {
    if (i === 0) { toggleSlideshow(); return }
    if (i >= 1 && i <= 3) { setIntervalSec(INTERVALS[i - 1]); return }
    if (i === 4) { setPlaying(false); goBack() }
  }, [toggleSlideshow, goBack])

  useEffect(() => {
    const onKey = (e) => {
      const k = e.keyCode
      const isBack = k === KEYS.BACK || k === KEYS.BACK_ALT

      if (menuMode) {
        e.preventDefault()
        if (k === KEYS.LEFT)  { setMenuIndex((i) => Math.max(i - 1, 0)); return }
        if (k === KEYS.RIGHT) { setMenuIndex((i) => Math.min(i + 1, MENU_COUNT - 1)); return }
        if (k === KEYS.ENTER) { activateMenu(menuIndex); return }
        if (k === KEYS.UP || isBack) { setMenuMode(false); showUi(); return }
        return
      }

      if (k === KEYS.LEFT)  { e.preventDefault(); setIndex((i) => (i - 1 + totalCount) % totalCount); showUi(); return }
      if (k === KEYS.RIGHT) { e.preventDefault(); setIndex((i) => (i + 1) % totalCount); showUi(); return }
      if (k === KEYS.DOWN)  { e.preventDefault(); setMenuMode(true); setMenuIndex(0); showUi(); return }
      if (k === KEYS.ENTER) { e.preventDefault(); toggleSlideshow(); return }
      if (isBack)           { e.preventDefault(); setPlaying(false); goBack() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuMode, menuIndex, totalCount, activateMenu, toggleSlideshow, showUi, goBack])

  if (!asset) return null

  const mediaSrc = isVideo
    ? getVideoUrl(serverUrl, token, asset.id)
    : getAssetUrl(serverUrl, token, asset.id)

  return (
    <div className="viewer-screen" onClick={showUi}>
      {isVideo ? (
        <video key={asset.id} className="viewer-media" src={mediaSrc} autoPlay controls={false} loop />
      ) : (
        <AuthImage key={asset.id} url={mediaSrc} className="viewer-media" />
      )}

      <div className={`viewer-overlay ${uiVisible ? 'visible' : 'hidden'}`}>
        <div className="viewer-counter">{index + 1} / {totalCount}</div>

        <button
          className={`slideshow-btn ${playing ? 'playing' : ''} ${menuMode && menuIndex === 0 ? 'menu-focused' : ''}`}
          onClick={toggleSlideshow}
        >
          {playing ? '⏸ Pause slideshow' : '▶ Start slideshow'}
        </button>

        <div className="interval-selector">
          {INTERVALS.map((s, i) => (
            <button
              key={s}
              className={`interval-btn ${intervalSec === s ? 'active' : ''} ${menuMode && menuIndex === i + 1 ? 'menu-focused' : ''}`}
              onClick={() => setIntervalSec(s)}
            >
              {s}s
            </button>
          ))}
        </div>

        <button
          className={`viewer-back-btn ${menuMode && menuIndex === 4 ? 'menu-focused' : ''}`}
          onClick={() => { setPlaying(false); goBack() }}
        >
          &#8249; Back
        </button>
      </div>

      {menuMode && (
        <div className="viewer-hint">&#8592;&#8594; navigate &nbsp; Enter select &nbsp; &#8593; exit menu</div>
      )}
    </div>
  )
}
