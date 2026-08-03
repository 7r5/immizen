import { useEffect } from "react";
import { preloadImage } from "../components/AuthImage";
import { getAssetUrl } from "../api/immich";

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
            // skip videos — too large to buffer
            if (!asset || asset.type === "VIDEO") continue;
            preloadImage(getAssetUrl(serverUrl, token, asset.id), token);
        }
    }, [assets, index, serverUrl, token]);
}
