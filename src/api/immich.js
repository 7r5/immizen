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

// Newer Immich versions don't embed assets in the album response; use the search API.
export async function getAlbumAssets(serverUrl, token, albumId) {
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    }
    const pageSize = 1000
    const allItems = []
    let page = 1

    while (page <= 100) {
        const res = await fetch(`${BASE(serverUrl)}/api/search/metadata`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ albumIds: [albumId], size: pageSize, page }),
        })
        if (!res.ok) throw new Error(`Search metadata failed: ${res.status}`)
        const data = await res.json()
        // Response shape varies: { assets: { items: [...] } } or { items: [...] } or plain array.
        const items = data?.assets?.items ?? data?.assets ?? data?.items ?? (Array.isArray(data) ? data : null)
        if (!Array.isArray(items)) throw new Error(`Unexpected search response. Keys: [${Object.keys(data).join(', ')}]`)
        allItems.push(...items)

        const reportedNextPage = data?.assets?.nextPage ?? data?.nextPage
        if (reportedNextPage != null && Number(reportedNextPage) > page) {
            page = Number(reportedNextPage)
        } else if (items.length === pageSize) {
            page += 1
        } else {
            break
        }
    }

    return allItems
}

// These return clean URLs without ?accessToken — auth is sent via Authorization header in AuthImage.
export function getThumbnailUrl(serverUrl, _token, assetId, size = 'thumbnail') {
    return `${BASE(serverUrl)}/api/assets/${assetId}/thumbnail?size=${size}`
}

export function getAssetUrl(serverUrl, _token, assetId) {
    return `${BASE(serverUrl)}/api/assets/${assetId}/original`
}

// Videos use ?accessToken= because <video> src cannot set Authorization header.
export function getVideoUrl(serverUrl, token, assetId) {
    return `${BASE(serverUrl)}/api/assets/${assetId}/video/playback?accessToken=${encodeURIComponent(token)}`
}

export function getAlbumThumbnailUrl(serverUrl, _token, albumThumbnailAssetId) {
    if (!albumThumbnailAssetId) return null
    return getThumbnailUrl(serverUrl, null, albumThumbnailAssetId, 'thumbnail')
}