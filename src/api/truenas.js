// Connects to TrueNAS SCALE via its DDP WebSocket API and returns one snapshot of CPU/RAM.
export function fetchTrueNASStats(baseUrl, apiKey) {
    return new Promise((resolve, reject) => {
        // in dev, route through Vite proxy to bypass CORS and self-signed cert
        const wsUrl = import.meta.env.DEV
            ? `ws://${window.location.host}/truenas-ws`
            : `${baseUrl.replace(/^https?/, "wss")}/api/v2.0/websocket`;

        let ws;
        let timer;
        let settled = false;

        const done = (result, err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { ws.close(); } catch (_) { }
            if (err) reject(err);
            else resolve(result);
        };

        try {
            ws = new WebSocket(wsUrl);
        } catch (e) {
            reject(new Error(`WebSocket open failed: ${e.message}`));
            return;
        }

        timer = setTimeout(() => done(null, new Error("TrueNAS stats timeout")), 10000);

        ws.onopen = () => {
            ws.send(JSON.stringify({ id: "1", msg: "connect", version: "1", support: ["1"] }));
        };

        ws.onmessage = (e) => {
            let msg;
            try { msg = JSON.parse(e.data); } catch { return; }

            if (msg.msg === "connected") {
                ws.send(JSON.stringify({
                    id: "2", msg: "method",
                    method: "auth.login_with_api_key",
                    params: [apiKey],
                }));
                return;
            }

            if (msg.id === "2" && msg.msg === "result") {
                if (!msg.result) { done(null, new Error("TrueNAS API key rejected")); return; }
                ws.send(JSON.stringify({
                    id: "3", msg: "sub",
                    name: "reporting.realtime",
                    params: [{ cpu: { percentage: true }, memory: true }],
                }));
                return;
            }

            // first realtime update — grab values and disconnect
            if (msg.msg === "changed" && msg.collection === "reporting.realtime") {
                const cpu = msg.fields?.cpu?.average?.usage ?? null;
                const memTotal = msg.fields?.memory?.physical_memory_total ?? null;
                const memAvail = msg.fields?.memory?.physical_memory_available ?? null;
                const ramPct = memTotal && memAvail != null
                    ? ((memTotal - memAvail) / memTotal) * 100
                    : null;
                done({ cpu, ram: ramPct, memTotal, memUsed: memTotal != null ? memTotal - memAvail : null });
            }
        };

        ws.onerror = () => done(null, new Error("TrueNAS WebSocket error"));
    });
}
