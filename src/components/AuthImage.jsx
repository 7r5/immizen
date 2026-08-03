import { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { getCachedImageUrl, loadImage } from "../api/imageCache";

export default function AuthImage({
  url,
  className,
  alt = "",
  objectFit = "cover",
  style,
  onAnimationEnd,
  onLoad,
  onError,
}) {
  const { token } = useApp();
  const [loadedImage, setLoadedImage] = useState(() => ({
    url,
    src: getCachedImageUrl(url),
  }));
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onLoadRef.current = onLoad;
    onErrorRef.current = onError;
  }, [onLoad, onError]);

  useEffect(() => {
    let active = true;
    const cachedUrl = getCachedImageUrl(url);

    if (cachedUrl) return undefined;

    loadImage(url, token)
      .then((blobUrl) => {
        if (!active) return;
        setLoadedImage({ url, src: blobUrl });
      })
      .catch((error) => {
        if (active) onErrorRef.current?.(error);
      });

    return () => {
      active = false;
    };
  }, [url, token]);

  const src =
    getCachedImageUrl(url) ??
    (loadedImage.url === url ? loadedImage.src : null);

  useEffect(() => {
    if (src) onLoadRef.current?.();
  }, [src]);

  const baseStyle = {
    width: "100%",
    height: "100%",
    objectFit,
    display: "block",
    ...style,
  };

  if (!src)
    return (
      <div
        className={`auth-img-placeholder${className ? ` ${className}` : ""}`}
        style={baseStyle}
      />
    );
  return (
    <img
      className={`img-loaded${className ? ` ${className}` : ""}`}
      src={src}
      alt={alt}
      style={baseStyle}
      onAnimationEnd={onAnimationEnd}
    />
  );
}
