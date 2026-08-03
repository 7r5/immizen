import { useState, useEffect, useRef } from 'react'

export default function useMusicPlayer({ playing, tracks }) {
    const [trackIndex, setTrackIndex] = useState(0)
    const [audioError, setAudioError] = useState(null)
    const audioRef = useRef(null)
    // Ref so the trackIndex effect can read current playing without it as a dep
    const playingRef = useRef(playing)

    useEffect(() => { playingRef.current = playing }, [playing])

    // Create the Audio element once and tear it down on unmount
    useEffect(() => {
        const audio = new Audio()
        const onError = () => setAudioError('No se pudo reproducir la música.')
        audio.addEventListener('error', onError)
        audioRef.current = audio
        return () => {
            audio.removeEventListener('error', onError)
            audio.pause()
            audio.removeAttribute('src')
            audioRef.current = null
        }
    }, [])

    // Auto-advance when the current track finishes
    useEffect(() => {
        const audio = audioRef.current
        if (!audio || tracks.length === 0) return
        const onEnded = () => setTrackIndex((i) => (i + 1) % tracks.length)
        audio.addEventListener('ended', onEnded)
        return () => audio.removeEventListener('ended', onEnded)
    }, [tracks.length])

    // Swap track source; resume playback if slideshow is running
    useEffect(() => {
        const audio = audioRef.current
        if (!audio || tracks.length === 0) return
        setAudioError(null)
        audio.src = tracks[trackIndex % tracks.length]
        if (playingRef.current) {
            audio.play().catch(() => setAudioError('La reproducción de música fue bloqueada.'))
        }
    }, [trackIndex, tracks])

    // Start / pause in sync with slideshow
    useEffect(() => {
        const audio = audioRef.current
        if (!audio || tracks.length === 0) return
        if (playing) {
            audio.play().catch(() => setAudioError('La reproducción de música fue bloqueada.'))
        }
        else audio.pause()
    }, [playing, tracks.length])

    const encodedTrackName = tracks.length > 0
        ? tracks[trackIndex % tracks.length]
            .split('/').pop()
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]/g, ' ')
        : null
    let trackName
    try {
        trackName = encodedTrackName ? decodeURIComponent(encodedTrackName) : null
    } catch {
        trackName = encodedTrackName
    }

    const skipTrack = () => {
        if (tracks.length < 2) return
        setTrackIndex((i) => (i + 1) % tracks.length)
    }

    return { trackName, audioError, skipTrack }
}
