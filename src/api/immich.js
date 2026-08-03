const BASE = (serverUrl) => serverUrl.replace(/\/$/, '')

export async function login(serverUrl, email, password) {
    const res = await fetch(`${BASE(serverUrl)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error(`Login failed: ${res.status}`)
    const data = await res.json()
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
