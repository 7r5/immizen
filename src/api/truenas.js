// Fetches a single CPU + RAM snapshot from TrueNAS SCALE via its REST reporting API.
export async function fetchTrueNASStats(baseUrl, apiKey) {
    // in dev use Vite proxy (avoids self-signed cert); in prod call directly
    const base = import.meta.env.DEV ? '/truenas-api' : baseUrl;

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    // REST API passes positional WebSocket params as [graphs_list, query_object]
    const res = await fetch(`${base}/api/v2.0/reporting/get_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify([
            [{ name: 'cpu' }, { name: 'memory' }],
            { start: 'now-2m', end: 'now', step: 10, aggregate: true },
        ]),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.log('[TrueNAS REST] error body', body);
        throw new Error(`TrueNAS API ${res.status}: ${body.slice(0, 200)}`);
    }

    const graphs = await res.json();
    console.log('[TrueNAS REST] graphs', graphs);

    let cpu = null, ram = null, memTotal = null, memUsed = null;

    for (const graph of graphs) {
        if (graph.name === 'cpu') {
            const legend = graph.legend ?? [];
            const idleIdx = legend.indexOf('idle');
            const latest = graph.data?.at(-1);
            if (latest && idleIdx > 0) {
                cpu = 100 - latest[idleIdx];
            } else if (graph.aggregations?.mean) {
                // aggregations omit the 'time' column so shift index by 1
                const iIdx = idleIdx - 1;
                if (iIdx >= 0) cpu = 100 - graph.aggregations.mean[iIdx];
            }
        }

        if (graph.name === 'memory') {
            const legend = graph.legend ?? [];
            const latest = graph.data?.at(-1);
            if (latest) {
                const usedIdx = legend.indexOf('used');
                const freeIdx = legend.indexOf('free');
                const buffIdx = legend.indexOf('buffers');
                const cachIdx = legend.indexOf('cached');
                if (usedIdx > 0 && freeIdx > 0) {
                    const used = latest[usedIdx];
                    const free = latest[freeIdx];
                    const buffers = buffIdx > 0 ? latest[buffIdx] : 0;
                    const cached = cachIdx > 0 ? latest[cachIdx] : 0;
                    memTotal = used + free + buffers + cached;
                    memUsed = used;
                    ram = (used / memTotal) * 100;
                }
            }
        }
    }

    return { cpu, ram, memTotal, memUsed };
}
