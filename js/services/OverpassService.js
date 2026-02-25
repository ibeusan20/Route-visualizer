import { APP_CONFIG } from '../config.js';

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export class OverpassService {
    constructor(endpoint = APP_CONFIG.overpass.endpoint, timeoutSeconds = APP_CONFIG.overpass.timeoutSeconds) {
        this.endpoint = endpoint;
        this.timeoutSeconds = timeoutSeconds;
        this.smart = APP_CONFIG.overpass.smartLoading;
    }

    /**
     * Smart loader:
     * - small area => full network
     * - medium area => coarse network (major roads)
     * - larger area => coarse + tiling
     *
     * Returns: { overpassJson, meta }
     */
    async fetchRoadDataSmart(bounds, profile, { areaKm2, onProgress } = {}) {
        const meta = {
            profile,
            detail: 'full',
            tiled: false,
            tiles: 1,
            areaKm2
        };

        if (!Number.isFinite(areaKm2)) {
            // fallback: treat as medium
            areaKm2 = this.smart.coarseMaxAreaKm2;
        }

        // Hard stop: too big for public Overpass + browser usage
        if (areaKm2 > this.smart.tiledMaxAreaKm2) {
            throw new Error(
                `Selected area is too large (~${areaKm2.toFixed(1)} km²). ` +
                `For reliability, zoom in or use a local extract/back-end approach.`
            );
        }

        // Choose detail level
        if (areaKm2 <= this.smart.fullMaxAreaKm2) {
            meta.detail = 'full';
            meta.tiled = false;
            meta.tiles = 1;

            onProgress?.({ phase: 'fetch', message: 'Overpass: fetching FULL network...' });
            const overpassJson = await this.#fetchSingle(bounds, profile, meta.detail, { onProgress });
            return { overpassJson, meta };
        }

        // medium => coarse single query
        if (areaKm2 <= this.smart.coarseMaxAreaKm2) {
            meta.detail = 'coarse';
            meta.tiled = false;
            meta.tiles = 1;

            onProgress?.({ phase: 'fetch', message: 'Overpass: fetching COARSE network (major roads)...' });
            const overpassJson = await this.#fetchSingle(bounds, profile, meta.detail, { onProgress });
            return { overpassJson, meta };
        }

        // larger => coarse + tiling
        meta.detail = 'coarse';
        meta.tiled = true;

        const tiles = this.#splitBoundsIntoTiles(bounds, areaKm2);
        meta.tiles = tiles.length;

        const elementsMap = new Map(); // key "type:id" => element
        let tileIndex = 0;

        for (const tile of tiles) {
            tileIndex++;

            onProgress?.({
                phase: 'tiles',
                message: `Overpass: tile ${tileIndex}/${tiles.length} (COARSE)...`
            });

            const tileJson = await this.#fetchSingle(tile, profile, meta.detail, { onProgress });

            const els = Array.isArray(tileJson?.elements) ? tileJson.elements : [];
            for (const el of els) {
                const k = `${el.type}:${el.id}`;
                if (!elementsMap.has(k)) {
                    elementsMap.set(k, el);
                }
            }

            await sleep(this.smart.delayBetweenTilesMs);
        }

        return {
            overpassJson: { elements: Array.from(elementsMap.values()) },
            meta
        };
    }

    // ---------- Internals ----------

    async #fetchSingle(bounds, profile, detail, { onProgress } = {}) {
        const query = this.buildRoadQuery(bounds, profile, detail);
        return this.#fetchWithRetry(query, { onProgress });
    }

    buildRoadQuery(bounds, profile, detail) {
        const south = bounds.getSouth().toFixed(6);
        const west = bounds.getWest().toFixed(6);
        const north = bounds.getNorth().toFixed(6);
        const east = bounds.getEast().toFixed(6);

        const highwayRegex = this.#getHighwayRegex(profile, detail);

        return `
[out:json][timeout:${this.timeoutSeconds}];
(
  way["highway"~"${highwayRegex}"](${south},${west},${north},${east});
);
(._;>;);
out body;
`.trim();
    }

    #getHighwayRegex(profile, detail) {
        // FULL = good for city / small region
        const carFull = [
            'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
            'unclassified', 'residential', 'living_street', 'service', 'road',
            'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'
        ];

        // COARSE = major roads only (much smaller)
        const carCoarse = [
            'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
            'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'
        ];

        const walkExtras = ['pedestrian', 'footway', 'path', 'steps', 'cycleway', 'track'];

        const walkFull = [...carFull, ...walkExtras];
        const walkCoarse = [...carCoarse, 'pedestrian', 'footway', 'path', 'track'];

        if (profile === 'walk') {
            return (detail === 'coarse' ? walkCoarse : walkFull).join('|');
        }
        return (detail === 'coarse' ? carCoarse : carFull).join('|');
    }

    #splitBoundsIntoTiles(bounds, areaKm2) {
        const target = this.smart.targetTileAreaKm2;
        const maxTiles = this.smart.maxTiles;

        // gridN ~ sqrt(area / target)
        let gridN = Math.ceil(Math.sqrt(areaKm2 / target));
        gridN = Math.max(1, gridN);

        // cap tiles
        while (gridN * gridN > maxTiles) {
            gridN--;
            if (gridN <= 1) break;
        }

        const s = bounds.getSouth();
        const w = bounds.getWest();
        const n = bounds.getNorth();
        const e = bounds.getEast();

        const tiles = [];
        const latStep = (n - s) / gridN;
        const lonStep = (e - w) / gridN;

        for (let r = 0; r < gridN; r++) {
            for (let c = 0; c < gridN; c++) {
                const ts = s + r * latStep;
                const tn = s + (r + 1) * latStep;
                const tw = w + c * lonStep;
                const te = w + (c + 1) * lonStep;

                // Leaflet-like bounds object stub with required getters
                tiles.push({
                    getSouth: () => ts,
                    getWest: () => tw,
                    getNorth: () => tn,
                    getEast: () => te
                });
            }
        }

        return tiles;
    }

    async #fetchWithRetry(query, { onProgress } = {}) {
        const retries = this.smart.maxRetries;
        let attempt = 0;

        while (true) {
            attempt++;
            try {
                const res = await fetch(this.endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                    body: query
                });

                if (!res.ok) {
                    // Some Overpass instances return 429/5xx under load or for heavy queries
                    const retryAfter = res.headers.get('Retry-After');
                    const status = res.status;

                    const isRetryable = status === 429 || status === 502 || status === 503 || status === 504;
                    if (isRetryable && attempt <= retries) {
                        const waitMs = retryAfter
                            ? Math.max(500, parseInt(retryAfter, 10) * 1000)
                            : 800 * attempt;

                        onProgress?.({ phase: 'retry', message: `Overpass: HTTP ${status}, retry in ${waitMs}ms (attempt ${attempt}/${retries})...` });
                        await sleep(waitMs);
                        continue;
                    }

                    throw new Error(`Overpass HTTP ${status}`);
                }

                return await res.json();
            } catch (err) {
                if (attempt <= retries) {
                    const waitMs = 800 * attempt;
                    onProgress?.({ phase: 'retry', message: `Overpass: network/error, retry in ${waitMs}ms (attempt ${attempt}/${retries})...` });
                    await sleep(waitMs);
                    continue;
                }
                throw err;
            }
        }
    }
}