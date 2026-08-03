import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "../context/AppContext";
import { fetchUptimeData, getLatestHeartbeat, STATUS } from "../api/uptime";
import { fetchTrueNASStats } from "../api/truenas";
import { useDpad1D } from "../hooks/useDpad";
import MainLayout from "./MainLayout";

const UPTIME_URL = import.meta.env.VITE_UPTIME_URL || "";
const UPTIME_USER = import.meta.env.VITE_UPTIME_USER || "";
const UPTIME_PASSWORD = import.meta.env.VITE_UPTIME_PASSWORD || "";
const TRUENAS_URL = import.meta.env.VITE_TRUENAS_URL || "";
const TRUENAS_KEY = import.meta.env.VITE_TRUENAS_KEY || "";
const REFRESH_INTERVAL = 30_000;
const UPTIME_CONFIGURED = Boolean(UPTIME_URL);

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
  const padded = Array(BAR_SEGMENTS - visible.length)
    .fill(null)
    .concat(visible);
  return (
    <div className="hb-bar" aria-hidden="true">
      {padded.map((beat, i) => (
        <span
          key={i}
          className="hb-segment"
          style={{
            background: beat
              ? (STATUS_COLOR[beat.status] ?? "#555")
              : "#2a2a2a",
          }}
        />
      ))}
    </div>
  );
}

function statusOf(heartbeat) {
  if (!heartbeat) return STATUS.PENDING;
  return heartbeat.status;
}

function fmt(bytes) {
  const gb = bytes / 1024 ** 3;
  return gb >= 10 ? `${Math.round(gb)} GB` : `${gb.toFixed(1)} GB`;
}

function StatBar({ label, pct, detail }) {
  const pctSafe = pct != null ? Math.min(100, Math.max(0, pct)) : null;
  return (
    <div className="stat-bar-row">
      <span className="stat-bar-label">{label}</span>
      <div
        className="stat-bar-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={pctSafe != null ? Math.round(pctSafe) : undefined}
      >
        {pctSafe != null && (
          <div className="stat-bar-fill" style={{ width: `${pctSafe}%` }} />
        )}
      </div>
      <span className="stat-bar-pct">
        {pctSafe != null ? `${Math.round(pctSafe)}%` : "—"}
      </span>
      {detail && <span className="stat-bar-detail">{detail}</span>}
    </div>
  );
}

export default function UptimeScreen() {
  const { goBack } = useApp();
  const [data, setData] = useState(
    UPTIME_CONFIGURED ? null : { monitors: {}, heartbeats: {} },
  );
  const [loading, setLoading] = useState(UPTIME_CONFIGURED);
  const [error, setError] = useState(null);
  const [sysStats, setSysStats] = useState(null);
  const [sysError, setSysError] = useState(null);
  const [focusRegion, setFocusRegion] = useState("content");
  const focusedRef = useRef(null);
  const listRef = useRef(null);
  const stateActionRef = useRef(null);
  const requestIdRef = useRef(0);
  const statsRequestIdRef = useRef(0);

  const loadStats = useCallback(() => {
    if (TRUENAS_URL && TRUENAS_KEY) {
      const requestId = ++statsRequestIdRef.current;
      fetchTrueNASStats(TRUENAS_URL, TRUENAS_KEY)
        .then((s) => {
          if (requestId !== statsRequestIdRef.current) return;
          setSysStats(s);
          setSysError(null);
        })
        .catch((err) => {
          if (requestId !== statsRequestIdRef.current) return;
          console.error("[TrueNAS]", err.message);
          setSysError(err.message);
        });
    }
  }, []);

  const load = useCallback(() => {
    if (UPTIME_CONFIGURED) {
      const requestId = ++requestIdRef.current;
      fetchUptimeData(UPTIME_URL, UPTIME_USER, UPTIME_PASSWORD)
        .then((d) => {
          if (requestId !== requestIdRef.current) return;
          setData(d);
          setError(null);
          setLoading(false);
        })
        .catch((err) => {
          if (requestId !== requestIdRef.current) return;
          setError(err.message);
          setLoading(false);
        });
    }
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => {
      clearInterval(id);
      requestIdRef.current += 1;
      statsRequestIdRef.current += 1;
    };
  }, [load]);

  const retry = () => {
    setError(null);
    if (!data) setLoading(true);
    load();
  };

  const monitorList = data
    ? Object.values(data.monitors).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const { focusIndex } = useDpad1D({
    count: monitorList.length,
    enabled: focusRegion === "content" && !loading,
    onSelect: UPTIME_CONFIGURED && monitorList.length === 0 ? retry : undefined,
    onBack: goBack,
    onLeft: () => setFocusRegion("sidebar"),
  });

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: "nearest" });
    if (focusRegion !== "content") return;
    const focusTarget =
      monitorList.length > 0 ? listRef.current : stateActionRef.current;
    focusTarget?.focus({ preventScroll: true });
  }, [focusIndex, focusRegion, monitorList.length]);

  return (
    <MainLayout
      focusRegion={focusRegion}
      onContentFocus={() => setFocusRegion("content")}
    >
      <div className="uptime-screen">
        <div className="uptime-header">
          <h1 className="uptime-title">Uptime</h1>
          {data && (
            <span className="uptime-subtitle">
              {monitorList.length} monitors
            </span>
          )}
          {sysStats && (
            <div className="uptime-sys-stats">
              <StatBar label="CPU" pct={sysStats.cpu} />
              <StatBar
                label="RAM"
                pct={sysStats.ram}
                detail={
                  sysStats.memUsed != null && sysStats.memTotal != null
                    ? `${fmt(sysStats.memUsed)} / ${fmt(sysStats.memTotal)}`
                    : null
                }
              />
            </div>
          )}
          {sysError && (
            <span
              className="uptime-sys-error"
              title={sysError}
              aria-label={`Error NAS: ${sysError}`}
            >
              NAS ✕
            </span>
          )}
          {error && data && (
            <span className="uptime-refresh-error" role="status">
              No se pudo actualizar; mostrando los últimos datos.
            </span>
          )}
        </div>

        {loading && !data && (
          <div className="loading-state" role="status" aria-live="polite">
            <div className="connecting-spinner" aria-hidden="true" />
            <p>Conectando con Uptime Kuma…</p>
          </div>
        )}

        {error && !loading && !data && (
          <div className="uptime-error" role="alert">
            <div className="connecting-icon error-icon" aria-hidden="true">
              ✕
            </div>
            <p>{error}</p>
            <p className="connecting-hint">
              Revisa <code>VITE_UPTIME_URL</code>, <code>VITE_UPTIME_USER</code>
              y <code>VITE_UPTIME_PASSWORD</code> en <code>.env.local</code>.
            </p>
            <button
              ref={stateActionRef}
              className={`state-action ${focusRegion === "content" ? "focused" : ""}`}
              onClick={retry}
            >
              Reintentar
            </button>
          </div>
        )}

        {data && monitorList.length === 0 && (
          <div className="state-panel" role="status">
            <h2>
              {UPTIME_CONFIGURED
                ? "No hay monitores configurados"
                : "Uptime Kuma no está configurado"}
            </h2>
            {!UPTIME_CONFIGURED && (
              <p>Añade VITE_UPTIME_URL para mostrar monitores.</p>
            )}
            {UPTIME_CONFIGURED && (
              <button
                ref={stateActionRef}
                className={`state-action ${focusRegion === "content" ? "focused" : ""}`}
                onClick={retry}
              >
                Actualizar
              </button>
            )}
          </div>
        )}

        {data && monitorList.length > 0 && (
          <div
            ref={listRef}
            className="uptime-list"
            role="list"
            aria-label="Monitores"
            aria-activedescendant={`monitor-${monitorList[focusIndex]?.id}`}
            tabIndex={focusRegion === "content" ? 0 : -1}
          >
            {monitorList.map((monitor, i) => {
              const hb = getLatestHeartbeat(data.heartbeats, monitor.id);
              const st = statusOf(hb);
              const dot = STATUS_DOT[st] ?? STATUS_DOT[STATUS.PENDING];
              const isFocused = focusRegion === "content" && focusIndex === i;

              return (
                <div
                  id={`monitor-${monitor.id}`}
                  key={monitor.id}
                  ref={isFocused ? focusedRef : null}
                  className={`uptime-item ${isFocused ? "focused" : ""}`}
                  role="listitem"
                  aria-label={`${monitor.name}: ${dot.label}${hb?.ping != null ? `, ${hb.ping} milisegundos` : ""}`}
                >
                  <span
                    className="uptime-dot"
                    style={{ background: dot.color }}
                    aria-hidden="true"
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
