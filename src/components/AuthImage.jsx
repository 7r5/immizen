import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";

// Module-level cache survives re-renders; blob URLs persist for the session lifetime.
const blobCache = new Map();

export default function AuthImage({ url, className, alt = '', objectFit = 'cover', style }) {
  const { token } = useApp();
  const [src, setSrc] = useState(() => blobCache.get(url) ?? null);

  useEffect(() => {
    if (!url || !token) return;
    if (blobCache.has(url)) {
      setSrc(blobCache.get(url));
      return;
    }

    let cancelled = false;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        if (cancelled) return;
        const objUrl = URL.createObjectURL(blob);
        blobCache.set(url, objUrl);
        setSrc(objUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [url, token]);

  const baseStyle = { width: '100%', height: '100%', objectFit, display: 'block', ...style };

  if (!src)
    return <div className={`auth-img-placeholder${className ? ` ${className}` : ''}`} style={baseStyle} />;
  return <img className={className} src={src} alt={alt} style={baseStyle} />;
}
