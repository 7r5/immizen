import { useState, useEffect, useCallback } from 'react'

// Tizen remote key codes
const KEYS = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACK: 10009,
    BACK_ALT: 461, // some Tizen models
}

/**
 * Manages D-pad focus for a rows-based Netflix layout.
 * rows: array of row lengths, e.g. [5, 3]
 * Returns { activeRow, activeCol, setFocus }
 */
export function useDpadRows({ rows, onSelect, onBack, onSidebarFocus, enabled = true }) {
    const [activeRow, setActiveRow] = useState(0)
    const [activeCol, setActiveCol] = useState(0)

    const handleKey = useCallback((e) => {
        if (!enabled) return
        const code = e.keyCode

        if (code === KEYS.ENTER) {
            e.preventDefault()
            onSelect?.(activeRow, activeCol)
            return
        }
        if (code === KEYS.BACK || code === KEYS.BACK_ALT) {
            e.preventDefault()
            onBack?.()
            return
        }
        if (code === KEYS.RIGHT) {
            e.preventDefault()
            const rowLen = rows[activeRow] ?? 0
            setActiveCol((c) => Math.min(c + 1, rowLen - 1))
            return
        }
        if (code === KEYS.LEFT) {
            e.preventDefault()
            if (activeCol === 0) {
                onSidebarFocus?.()
            } else {
                setActiveCol((c) => c - 1)
            }
            return
        }
        if (code === KEYS.DOWN) {
            e.preventDefault()
            const nextRow = Math.min(activeRow + 1, rows.length - 1)
            setActiveRow(nextRow)
            setActiveCol((c) => Math.min(c, (rows[nextRow] ?? 1) - 1))
            return
        }
        if (code === KEYS.UP) {
            e.preventDefault()
            const prevRow = Math.max(activeRow - 1, 0)
            setActiveRow(prevRow)
            setActiveCol((c) => Math.min(c, (rows[prevRow] ?? 1) - 1))
        }
    }, [enabled, activeRow, activeCol, rows, onSelect, onBack, onSidebarFocus])

    useEffect(() => {
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [handleKey])

    const setFocus = (row, col) => { setActiveRow(row); setActiveCol(col) }

    return { activeRow, activeCol, setFocus }
}

/**
 * Manages D-pad focus for a 2D grid (single flat index, wraps by cols).
 * Returns { focusIndex, setFocusIndex }
 */
export function useDpadGrid({ count, cols, onSelect, onBack, enabled = true }) {
    const [focusIndex, setFocusIndex] = useState(0)

    const handleKey = useCallback((e) => {
        if (!enabled) return
        const code = e.keyCode

        if (code === KEYS.ENTER) {
            e.preventDefault()
            onSelect?.(focusIndex)
            return
        }
        if (code === KEYS.BACK || code === KEYS.BACK_ALT) {
            e.preventDefault()
            onBack?.()
            return
        }
        if (code === KEYS.RIGHT) {
            e.preventDefault()
            setFocusIndex((i) => Math.min(i + 1, count - 1))
            return
        }
        if (code === KEYS.LEFT) {
            e.preventDefault()
            setFocusIndex((i) => Math.max(i - 1, 0))
            return
        }
        if (code === KEYS.DOWN) {
            e.preventDefault()
            setFocusIndex((i) => Math.min(i + cols, count - 1))
            return
        }
        if (code === KEYS.UP) {
            e.preventDefault()
            setFocusIndex((i) => Math.max(i - cols, 0))
        }
    }, [enabled, focusIndex, count, cols, onSelect, onBack])

    useEffect(() => {
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [handleKey])

    return { focusIndex, setFocusIndex }
}

/**
 * Manages D-pad focus for a 1D list (sidebar, interval selector, etc).
 * Returns { focusIndex, setFocusIndex }
 */
export function useDpad1D({ count, onSelect, onBack, onRight, enabled = true }) {
    const [focusIndex, setFocusIndex] = useState(0)

    const handleKey = useCallback((e) => {
        if (!enabled) return
        const code = e.keyCode

        if (code === KEYS.ENTER) {
            e.preventDefault()
            onSelect?.(focusIndex)
            return
        }
        if (code === KEYS.BACK || code === KEYS.BACK_ALT) {
            e.preventDefault()
            onBack?.()
            return
        }
        if (code === KEYS.DOWN) {
            e.preventDefault()
            setFocusIndex((i) => Math.min(i + 1, count - 1))
            return
        }
        if (code === KEYS.UP) {
            e.preventDefault()
            setFocusIndex((i) => Math.max(i - 1, 0))
            return
        }
        if (code === KEYS.RIGHT) {
            e.preventDefault()
            onRight?.()
        }
    }, [enabled, focusIndex, count, onSelect, onBack, onRight])

    useEffect(() => {
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [handleKey])

    return { focusIndex, setFocusIndex }
}

/**
 * Manages D-pad focus for the viewer (left/right navigation + enter for slideshow).
 */
export function useDpadViewer({ count, onPrev, onNext, onToggleSlideshow, onBack, enabled = true }) {
    const handleKey = useCallback((e) => {
        if (!enabled) return
        const code = e.keyCode

        if (code === KEYS.LEFT) { e.preventDefault(); onPrev?.(); return }
        if (code === KEYS.RIGHT) { e.preventDefault(); onNext?.(); return }
        if (code === KEYS.ENTER) { e.preventDefault(); onToggleSlideshow?.(); return }
        if (code === KEYS.BACK || code === KEYS.BACK_ALT) { e.preventDefault(); onBack?.() }
    }, [enabled, onPrev, onNext, onToggleSlideshow, onBack, count])

    useEffect(() => {
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [handleKey])
}
