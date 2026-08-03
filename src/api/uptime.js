import { io } from "socket.io-client";

// heartbeat status codes from Uptime Kuma
const STATUS = { DOWN: 0, UP: 1, PENDING: 2, MAINTENANCE: 3 };

export { STATUS };

/**
 * Connects to Uptime Kuma, authenticates, fetches all monitor data, then disconnects.
 * Returns { monitors, heartbeats } where:
 *   monitors  — object keyed by id: { id, name, type, url, ... }
 *   heartbeats — object keyed by id: array of heartbeat entries (latest last)
 */
export function fetchUptimeData(url, username, password) {
    return new Promise((resolve, reject) => {
        // in dev, route through Vite proxy to avoid CORS; in prod connect directly
        const socketUrl = import.meta.env.DEV ? window.location.origin : url;
        const socketPath = import.meta.env.DEV ? "/uptime-proxy/socket.io" : "/socket.io";

        const socket = io(socketUrl, {
            path: socketPath,
            // polling-only: avoids WebSocket upgrade which breaks through the Vite proxy
            transports: ["polling"],
            reconnection: false,
            timeout: 10000,
        });

        let monitors = null;
        let heartbeats = null;
        let settled = false;

        const tryResolve = () => {
            if (!settled && monitors !== null && heartbeats !== null) {
                settled = true;
                socket.disconnect();
                resolve({ monitors, heartbeats });
            }
        };

        socket.on("connect", () => {
            socket.emit("login", { username, password, token: "" }, (res) => {
                if (!res?.ok) {
                    settled = true;
                    socket.disconnect();
                    reject(new Error(res?.msg || "Login failed"));
                }
            });
        });

        socket.on("monitorList", (data) => {
            monitors = data;
            tryResolve();
        });

        socket.on("heartbeatList", (id, list, overwrite) => {
            if (!heartbeats) heartbeats = {};
            if (overwrite || !heartbeats[id]) {
                heartbeats[id] = list;
            } else {
                heartbeats[id] = [...heartbeats[id], ...list];
            }
            tryResolve();
        });

        socket.on("connect_error", (err) => {
            if (!settled) {
                settled = true;
                reject(new Error(`Connection error: ${err.message}`));
            }
        });

        // fallback timeout in case heartbeatList never fires (no monitors)
        setTimeout(() => {
            if (!settled && monitors !== null) {
                settled = true;
                socket.disconnect();
                resolve({ monitors, heartbeats: heartbeats ?? {} });
            }
        }, 5000);
    });
}

/** Returns the latest heartbeat entry for a monitor, or null. */
export function getLatestHeartbeat(heartbeats, monitorId) {
    const list = heartbeats[monitorId];
    if (!list || list.length === 0) return null;
    return list[list.length - 1];
}
