import { useState, useEffect, useRef } from 'react'

export default function useMusicPlayer({ playing, tracks }) {
    const [trackIndex, setTrackIndex] = useState(0)
    const audioRef = useRef(null)
    // Ref so the trackIndex effect can read current playing without it as a dep
    const playingRef = useRef(playing)

    useEffect(() => { playingRef.current = playing }, [playing])

    // Create the Audio element once and tear it down on unmount
    useEffect(() => {
        const audio = new Audio()
        audioRef.current = audio
        return () => { audio.pause(); audioRef.current = null }
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
        audio.src = tracks[trackIndex % tracks.length]
        if (playingRef.current) audio.play().catch(() => { })
    }, [trackIndex, tracks])

    // Start / pause in sync with slideshow
    useEffect(() => {
        const audio = audioRef.current
        if (!audio || tracks.length === 0) return
        if (playing) audio.play().catch(() => { })
        else audio.pause()
    }, [playing, tracks.length])

    const trackName = tracks.length > 0
        ? tracks[trackIndex % tracks.length]
            .split('/').pop()
            .replace(/\.[^.]+$/, '')
            .replace(/[-_]/g, ' ')
        : null

    const skipTrack = () => {
        if (tracks.length < 2) return
        setTrackIndex((i) => (i + 1) % tracks.length)
    }

    return { trackName, skipTrack }
}
