const blobCache = new Map();
const pendingRequests = new Map();
const MAX_CACHE_ENTRIES = 72;
const MAX_CACHE_BYTES = 192 * 1024 * 1024;
let cacheBytes = 0;

function touchEntry(url, entry) {
    blobCache.delete(url);
    blobCache.set(url, entry);
    return entry.blobUrl;
}

function evictOldEntries(protectedUrl) {
    for (const [url, entry] of blobCache) {
        if (blobCache.size <= MAX_CACHE_ENTRIES && cacheBytes <= MAX_CACHE_BYTES) break;
        if (url === protectedUrl) continue;
        blobCache.delete(url);
        cacheBytes -= entry.size;
        URL.revokeObjectURL(entry.blobUrl);
    }
}

function decodeImage(blobUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const decoded = typeof image.decode === "function"
                ? image.decode().catch(() => undefined)
                : Promise.resolve();
            decoded.then(resolve);
        };
        image.onerror = () => reject(new Error("Downloaded image could not be decoded."));
        image.src = blobUrl;
    });
}

export function getCachedImageUrl(url) {
    const entry = blobCache.get(url);
    return entry ? touchEntry(url, entry) : null;
}

export function loadImage(url, token) {
    if (!url || !token) return Promise.reject(new Error("Missing image URL or token."));
    const cached = blobCache.get(url);
    if (cached) return Promise.resolve(touchEntry(url, cached));
    if (pendingRequests.has(url)) return pendingRequests.get(url);

    const request = fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((response) => {
            if (!response.ok) throw new Error(`Image request failed (${response.status}).`);
            return response.blob();
        })
        .then(async (blob) => {
            const blobUrl = URL.createObjectURL(blob);
            try {
                await decodeImage(blobUrl);
            } catch (error) {
                URL.revokeObjectURL(blobUrl);
                throw error;
            }
            blobCache.set(url, { blobUrl, size: blob.size });
            cacheBytes += blob.size;
            evictOldEntries(url);
            return blobUrl;
        })
        .finally(() => pendingRequests.delete(url));

    pendingRequests.set(url, request);
    return request;
}

export function preloadImage(url, token) {
    return loadImage(url, token).catch(() => null);
}