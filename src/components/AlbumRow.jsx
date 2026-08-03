import { useRef, useEffect } from "react";
import AlbumCard from "./AlbumCard";

export default function AlbumRow({
  title,
  albums,
  activeCol,
  focused,
  onSelect,
}) {
  const rowRef = useRef(null);
  const wrapperRef = useRef(null);
  const activeCardRef = useRef(null);

  // Center the active card where possible using its real rendered dimensions.
  useEffect(() => {
    const row = rowRef.current;
    const wrapper = wrapperRef.current;
    const card = activeCardRef.current;
    if (!row || !wrapper || !card) return;

    const maxOffset = Math.max(row.scrollWidth - wrapper.clientWidth, 0);
    const centeredOffset =
      card.offsetLeft - (wrapper.clientWidth - card.offsetWidth) / 2;
    const offset = Math.min(Math.max(centeredOffset, 0), maxOffset);
    row.style.transform = `translateX(${-offset}px)`;

    if (!focused) return;
    try {
      card.focus({ preventScroll: true });
    } catch {
      card.focus();
    }
  }, [activeCol, albums.length, focused]);

  return (
    <div className={`album-row ${focused ? "row-focused" : ""}`}>
      <h2 className="row-title">{title}</h2>
      <div className="row-track-wrapper" ref={wrapperRef}>
        <div className="row-track" ref={rowRef}>
          {albums.map((album, i) => (
            <AlbumCard
              key={album.id}
              album={album}
              index={i}
              focused={focused && activeCol === i}
              focusRef={activeCol === i ? activeCardRef : null}
              onSelect={() => onSelect?.(album, i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
