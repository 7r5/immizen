import { useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import { useDpad1D } from "../hooks/useDpad";

const MENU_ITEMS = [
  { id: "albums", label: "Álbumes", icon: "▦" },
  { id: "uptime", label: "Uptime", icon: "◉" },
];

export default function MainLayout({ children, focusRegion, onContentFocus }) {
  const { currentScreen, navigate, goBack } = useApp();
  const itemRefs = useRef([]);

  const activateItem = (index) => {
    const item = MENU_ITEMS[index];
    if (!item) return;
    if (item.id !== currentScreen) navigate(item.id);
    else onContentFocus?.();
  };

  const { focusIndex } = useDpad1D({
    count: MENU_ITEMS.length,
    enabled: focusRegion === "sidebar",
    onSelect: activateItem,
    onBack: goBack,
    onRight: () => onContentFocus?.(),
  });

  useEffect(() => {
    if (focusRegion !== "sidebar") return;
    const item = itemRefs.current[focusIndex];
    if (!item) return;
    try {
      item.focus({ preventScroll: true });
    } catch {
      item.focus();
    }
  }, [focusIndex, focusRegion]);

  return (
    <div className="tv-layout">
      <aside className="sidebar" aria-label="Navegación principal">
        <div className="sidebar-logo">
          <span className="logo-icon" aria-hidden="true">
            ◈
          </span>
          <span className="logo-text">immizen</span>
        </div>
        <nav className="sidebar-nav" aria-label="Secciones">
          {MENU_ITEMS.map((item, i) => (
            <button
              type="button"
              key={item.id}
              ref={(element) => {
                itemRefs.current[i] = element;
              }}
              className={[
                "sidebar-item",
                currentScreen === item.id ? "active" : "",
                focusRegion === "sidebar" && focusIndex === i ? "focused" : "",
              ].join(" ")}
              tabIndex={focusRegion === "sidebar" && focusIndex === i ? 0 : -1}
              aria-current={currentScreen === item.id ? "page" : undefined}
              onClick={() => activateItem(i)}
            >
              <span className="sidebar-item-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="sidebar-item-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="content-area" id="main-content">
        {children}
      </main>
    </div>
  );
}
