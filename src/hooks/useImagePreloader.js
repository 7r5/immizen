import { useEffect } from "react";
import { preloadImage } from "../api/imageCache";
import { getAssetUrl, getThumbnailUrl } from "../api/immich";

const AHEAD = 2;
const BEHIND = 1;

export default function useImagePreloader({ assets, index, serverUrl, token }) {
    useEffect(() => {
        if (!assets?.length || !serverUrl || !token) return;
        const total = assets.length;
        for (let offset = -BEHIND; offset <= AHEAD; offset++) {
            if (offset === 0) continue;
            const i = (index + offset + total) % total;
            const asset = assets[i];
            // Skip videos — the browser handles those as streaming media.
            if (!asset || asset.type === "VIDEO") continue;
            preloadImage(getAssetUrl(serverUrl, token, asset.id), token);
            preloadImage(getThumbnailUrl(serverUrl, token, asset.id, "preview"), token);
        }
    }, [assets, index, serverUrl, token]);
}
