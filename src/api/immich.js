// In dev the Vite proxy handles CORS; in production (Tizen) use the full URL directly.
const BASE = (serverUrl) => import.meta.env.DEV ? '' : serverUrl.replace(/\/$/, '')

export async function login(serverUrl, email, password) {
    const url = `${BASE(serverUrl)}/api/auth/login`
    let res
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
    } catch {
        // network-level failure: wrong IP, server down, CORS preflight blocked, etc.
        throw new Error(`Cannot reach server at ${BASE(serverUrl)} — check the IP/port and that Immich is running.`)
    }
    if (res.status === 401) throw new Error('Wrong email or password (401).')
    if (!res.ok) throw new Error(`Server responded with HTTP ${res.status}.`)
    const data = await res.json()
    if (!data.accessToken) throw new Error('Login succeeded but no access token was returned.')
    return data.accessToken
}

export async function getAlbums(serverUrl, token) {
    const res = await fetch(`${BASE(serverUrl)}/api/albums`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Failed to fetch albums: ${res.status}`)
    return res.json()
}

export async function getSharedAlbums(serverUrl, token) {
    const res = await fetch(`${BASE(serverUrl)}/api/albums?shared=true`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Failed to fetch shared albums: ${res.status}`)
    return res.json()
}

export async function getAlbum(serverUrl, token, albumId) {
    const res = await fetch(`${BASE(serverUrl)}/api/albums/${albumId}`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Failed to fetch album: ${res.status}`)
    return res.json()
}

export function getThumbnailUrl(serverUrl, token, assetId, size = 'thumbnail') {
    return `${BASE(serverUrl)}/api/assets/${assetId}/thumbnail?size=${size}&accessToken=${token}`
}

export function getAssetUrl(serverUrl, token, assetId) {
    return `${BASE(serverUrl)}/api/assets/${assetId}/original?accessToken=${token}`
}

export function getVideoUrl(serverUrl, token, assetId) {
    return `${BASE(serverUrl)}/api/assets/${assetId}/video/playback?accessToken=${token}`
}

export function getAlbumThumbnailUrl(serverUrl, token, albumThumbnailAssetId) {
    if (!albumThumbnailAssetId) return null
    return getThumbnailUrl(serverUrl, token, albumThumbnailAssetId, 'thumbnail')
}
