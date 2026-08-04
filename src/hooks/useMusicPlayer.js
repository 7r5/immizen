import { useState, useEffect, useRef } from 'react'

function shuffleTracks(tracks) {
    const order = [...tracks]
    for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
            ;[order[i], order[j]] = [order[j], order[i]]
    }
    return order
}

export default function useMusicPlayer({ playing, tracks }) {
    const [trackOrder, setTrackOrder] = useState(() => shuffleTracks(tracks))
    const [trackIndex, setTrackIndex] = useState(0)
    const [audioError, setAudioError] = useState(null)
    const audioRef = useRef(null)
    // Ref so the trackIndex effect can read current playing without it as a dep
    const playingRef = useRef(playing)

    useEffect(() => { playingRef.current = playing }, [playing])

    useEffect(() => {
        setTrackOrder(shuffleTracks(tracks))
        setTrackIndex(0)
    }, [tracks])

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
        if (!audio || trackOrder.length === 0) return
        const onEnded = () => setTrackIndex((i) => (i + 1) % trackOrder.length)
        audio.addEventListener('ended', onEnded)
        return () => audio.removeEventListener('ended', onEnded)
    }, [trackOrder.length])

    // Swap track source; resume playback if slideshow is running
    useEffect(() => {
        const audio = audioRef.current
        if (!audio || trackOrder.length === 0) return
        setAudioError(null)
        audio.src = trackOrder[trackIndex % trackOrder.length]
        if (playingRef.current) {
            audio.play().catch(() => setAudioError('La reproducción de música fue bloqueada.'))
        }
    }, [trackIndex, trackOrder])

    // Start / pause in sync with slideshow
    useEffect(() => {
        const audio = audioRef.current
        if (!audio || trackOrder.length === 0) return
        if (playing) {
            audio.play().catch(() => setAudioError('La reproducción de música fue bloqueada.'))
        }
        else audio.pause()
    }, [playing, trackOrder.length])

    const encodedTrackName = trackOrder.length > 0
        ? trackOrder[trackIndex % trackOrder.length]
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
        if (trackOrder.length < 2) return
        setTrackIndex((i) => (i + 1) % trackOrder.length)
    }

    return { trackName, audioError, skipTrack }
}
