import { useApp } from "../context/AppContext";
import { useDpad1D } from "../hooks/useDpad";

const MENU_ITEMS = [
  { id: "albums", label: "Albums", icon: "▦" },
  { id: "uptime", label: "Uptime", icon: "◉" },
];

export default function MainLayout({ children, focusRegion, onContentFocus }) {
  const { currentScreen, navigate } = useApp();

  const { focusIndex } = useDpad1D({
    count: MENU_ITEMS.length,
    enabled: focusRegion === "sidebar",
    onSelect: (i) => {
      const item = MENU_ITEMS[i];
      if (item.id !== currentScreen) navigate(item.id);
      else onContentFocus?.();
    },
    onRight: () => onContentFocus?.(),
  });

  return (
    <div className="tv-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">immizen</span>
        </div>
        <nav className="sidebar-nav">
          {MENU_ITEMS.map((item, i) => (
            <div
              key={item.id}
              className={[
                "sidebar-item",
                currentScreen === item.id ? "active" : "",
                focusRegion === "sidebar" && focusIndex === i ? "focused" : "",
              ].join(" ")}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
            </div>
          ))}
        </nav>
      </aside>
      <main className="content-area">{children}</main>
    </div>
  );
}
