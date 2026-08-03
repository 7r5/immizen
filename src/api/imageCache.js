const blobCache = new Map();
const pendingRequests = new Map();

export function getCachedImageUrl(url) {
    return blobCache.get(url) ?? null;
}

export function loadImage(url, token) {
    if (!url || !token) return Promise.reject(new Error("Missing image URL or token."));
    if (blobCache.has(url)) return Promise.resolve(blobCache.get(url));
    if (pendingRequests.has(url)) return pendingRequests.get(url);

    const request = fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((response) => {
            if (!response.ok) throw new Error(`Image request failed (${response.status}).`);
            return response.blob();
        })
        .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            blobCache.set(url, blobUrl);
            return blobUrl;
        })
        .finally(() => pendingRequests.delete(url));

    pendingRequests.set(url, request);
    return request;
}

export function preloadImage(url, token) {
    return loadImage(url, token).catch(() => null);
}