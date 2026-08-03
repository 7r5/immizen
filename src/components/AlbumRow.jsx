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

  // slide the row to keep focused card visible
  useEffect(() => {
    if (!rowRef.current) return;
    const cardWidth = 340; // card width + gap
    rowRef.current.style.transform = `translateX(${-activeCol * cardWidth}px)`;
  }, [activeCol]);

  return (
    <div className={`album-row ${focused ? "row-focused" : ""}`}>
      <h2 className="row-title">{title}</h2>
      <div className="row-track-wrapper">
        <div className="row-track" ref={rowRef}>
          {albums.map((album, i) => (
            <AlbumCard
              key={album.id}
              album={album}
              focused={focused && activeCol === i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
