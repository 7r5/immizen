import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "../context/AppContext";
import { fetchUptimeData, getLatestHeartbeat, STATUS } from "../api/uptime";
import { useDpad1D } from "../hooks/useDpad";
import MainLayout from "./MainLayout";

const UPTIME_URL = import.meta.env.VITE_UPTIME_URL || "";
const UPTIME_USER = import.meta.env.VITE_UPTIME_USER || "";
const UPTIME_PASSWORD = import.meta.env.VITE_UPTIME_PASSWORD || "";
const REFRESH_INTERVAL = 30_000;

const STATUS_DOT = {
  [STATUS.UP]: { color: "#4ade80", label: "UP" },
  [STATUS.DOWN]: { color: "#f87171", label: "DOWN" },
  [STATUS.PENDING]: { color: "#facc15", label: "PENDING" },
  [STATUS.MAINTENANCE]: { color: "#60a5fa", label: "MAINTENANCE" },
};

const STATUS_COLOR = {
  [STATUS.UP]: "#4ade80",
  [STATUS.DOWN]: "#f87171",
  [STATUS.PENDING]: "#facc15",
  [STATUS.MAINTENANCE]: "#60a5fa",
};

const BAR_SEGMENTS = 60;

function HeartbeatBar({ beats }) {
  const visible = (beats ?? []).slice(-BAR_SEGMENTS);
  // left-pad with nulls so the bar is always full width
  const padded = Array(BAR_SEGMENTS - visible.length).fill(null).concat(visible);
  return (
    <div className="hb-bar">
      {padded.map((beat, i) => (
        <span
          key={i}
          className="hb-segment"
          style={{ background: beat ? STATUS_COLOR[beat.status] ?? "#555" : "#2a2a2a" }}
        />
      ))}
    </div>
  );
}

function statusOf(heartbeat) {
  if (!heartbeat) return STATUS.PENDING;
  return heartbeat.status;
}

export default function UptimeScreen() {
  const { goBack } = useApp();
  const [data, setData] = useState(null); // { monitors, heartbeats }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusRegion, setFocusRegion] = useState("content");
  const focusedRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchUptimeData(UPTIME_URL, UPTIME_USER, UPTIME_PASSWORD)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  const monitorList = data
    ? Object.values(data.monitors).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const { focusIndex } = useDpad1D({
    count: monitorList.length,
    enabled: focusRegion === "content" && !loading,
    onBack: goBack,
  });

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: "nearest" });
  }, [focusIndex]);

  return (
    <MainLayout
      focusRegion={focusRegion}
      onContentFocus={() => setFocusRegion("content")}
    >
      <div className="uptime-screen">
        <div className="uptime-header">
          <h1 className="uptime-title">Uptime</h1>
          {!loading && !error && (
            <span className="uptime-subtitle">
              {monitorList.length} monitors
            </span>
          )}
        </div>

        {loading && (
          <div className="loading-state">
            <div className="connecting-spinner" />
            <p>Connecting to Uptime Kuma…</p>
          </div>
        )}

        {error && !loading && (
          <div className="uptime-error">
            <div className="connecting-icon error-icon">✕</div>
            <p>{error}</p>
            <p className="connecting-hint">
              Check <code>VITE_UPTIME_URL</code>, <code>VITE_UPTIME_USER</code>,
              and <code>VITE_UPTIME_PASSWORD</code> in <code>.env.local</code>
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="uptime-list">
            {monitorList.map((monitor, i) => {
              const hb = getLatestHeartbeat(data.heartbeats, monitor.id);
              const st = statusOf(hb);
              const dot = STATUS_DOT[st] ?? STATUS_DOT[STATUS.PENDING];
              const isFocused = focusRegion === "content" && focusIndex === i;

              return (
                <div
                  key={monitor.id}
                  ref={isFocused ? focusedRef : null}
                  className={`uptime-item ${isFocused ? "focused" : ""}`}
                >
                  <span
                    className="uptime-dot"
                    style={{ background: dot.color }}
                  />
                  <span className="uptime-name">{monitor.name}</span>
                  <HeartbeatBar beats={data.heartbeats[monitor.id]} />
                  <span className="uptime-status" style={{ color: dot.color }}>
                    {dot.label}
                  </span>
                  {hb?.ping != null && (
                    <span className="uptime-ping">{hb.ping} ms</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
