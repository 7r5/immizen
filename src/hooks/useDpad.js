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

const isBackKey = (code) => code === KEYS.BACK || code === KEYS.BACK_ALT

/**
 * Manages D-pad focus for a rows-based Netflix layout.
 * rows: array of row lengths, e.g. [5, 3]
 * Returns { activeRow, activeCol, setFocus }
 */
export function useDpadRows({ rows, onSelect, onBack, onSidebarFocus, enabled = true }) {
    const [activeRow, setActiveRow] = useState(0)
    const [activeCol, setActiveCol] = useState(0)

    const handleKey = useCallback((e) => {
        const code = e.keyCode

        if (isBackKey(code) && onBack) {
            e.preventDefault()
            onBack()
            return
        }
        if (!enabled) return

        const rowIndex = Math.min(activeRow, Math.max(rows.length - 1, 0))
        const colIndex = Math.min(activeCol, Math.max((rows[rowIndex] ?? 0) - 1, 0))

        if (code === KEYS.ENTER) {
            e.preventDefault()
            onSelect?.(rowIndex, colIndex)
            return
        }
        if (rows.length === 0) {
            if (code === KEYS.LEFT && onSidebarFocus) {
                e.preventDefault()
                onSidebarFocus()
            }
            return
        }
        if (code === KEYS.RIGHT) {
            e.preventDefault()
            const rowLen = rows[rowIndex] ?? 0
            setActiveCol((c) => Math.min(c + 1, Math.max(rowLen - 1, 0)))
            return
        }
        if (code === KEYS.LEFT) {
            e.preventDefault()
            if (colIndex === 0) {
                onSidebarFocus?.()
            } else {
                setActiveCol((c) => c - 1)
            }
            return
        }
        if (code === KEYS.DOWN) {
            e.preventDefault()
            const nextRow = Math.min(rowIndex + 1, rows.length - 1)
            setActiveRow(nextRow)
            setActiveCol((c) => Math.min(c, (rows[nextRow] ?? 1) - 1))
            return
        }
        if (code === KEYS.UP) {
            e.preventDefault()
            const prevRow = Math.max(rowIndex - 1, 0)
            setActiveRow(prevRow)
            setActiveCol((c) => Math.min(c, (rows[prevRow] ?? 1) - 1))
        }
    }, [enabled, activeRow, activeCol, rows, onSelect, onBack, onSidebarFocus])

    useEffect(() => {
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [handleKey])

    const safeRow = Math.min(activeRow, Math.max(rows.length - 1, 0))
    const safeCol = Math.min(activeCol, Math.max((rows[safeRow] ?? 0) - 1, 0))
    const setFocus = (row, col) => {
        const nextRow = Math.min(Math.max(row, 0), Math.max(rows.length - 1, 0))
        setActiveRow(nextRow)
        setActiveCol(Math.min(Math.max(col, 0), Math.max((rows[nextRow] ?? 0) - 1, 0)))
    }

    return { activeRow: safeRow, activeCol: safeCol, setFocus }
}

/**
 * Manages D-pad focus for a 2D grid (single flat index, wraps by cols).
 * Returns { focusIndex, setFocusIndex }
 */
export function useDpadGrid({ count, cols, onSelect, onBack, enabled = true }) {
    const [focusIndex, setFocusIndex] = useState(0)

    const handleKey = useCallback((e) => {
        const code = e.keyCode

        if (isBackKey(code) && onBack) {
            e.preventDefault()
            onBack()
            return
        }
        if (!enabled) return

        if (code === KEYS.ENTER) {
            e.preventDefault()
            onSelect?.(focusIndex)
            return
        }
        if (count <= 0) return
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

    return {
        focusIndex: Math.min(focusIndex, Math.max(count - 1, 0)),
        setFocusIndex,
    }
}

/**
 * Manages D-pad focus for a 1D list (sidebar, interval selector, etc).
 * Returns { focusIndex, setFocusIndex }
 */
export function useDpad1D({ count, onSelect, onBack, onLeft, onRight, enabled = true }) {
    const [focusIndex, setFocusIndex] = useState(0)

    const handleKey = useCallback((e) => {
        const code = e.keyCode

        if (isBackKey(code) && onBack) {
            e.preventDefault()
            onBack()
            return
        }
        if (!enabled) return

        if (code === KEYS.ENTER) {
            e.preventDefault()
            onSelect?.(focusIndex)
            return
        }
        if (code === KEYS.LEFT) {
            e.preventDefault()
            onLeft?.()
            return
        }
        if (code === KEYS.RIGHT) {
            e.preventDefault()
            onRight?.()
            return
        }
        if (count <= 0) return
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
    }, [enabled, focusIndex, count, onSelect, onBack, onLeft, onRight])

    useEffect(() => {
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [handleKey])

    return {
        focusIndex: Math.min(focusIndex, Math.max(count - 1, 0)),
        setFocusIndex,
    }
}
