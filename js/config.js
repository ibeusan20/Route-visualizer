export const APP_CONFIG = {
    map: {
        initialCenter: [46.3057, 16.3366], // Varaždin-ish
        initialZoom: 15,
        tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        tileOptions: {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }
    },
    overpass: {
        endpoint: 'https://overpass-api.de/api/interpreter',
        timeoutSeconds: 25,

        smartLoading: {
            // do ove veličine (km²) povlači “full” mrežu (gradska razina)
            fullMaxAreaKm2: 25,

            // do ove veličine (km² povlači "coarse" (glavne ceste), 1 upit
            coarseMaxAreaKm2: 400,

            // do ove veličine pokušaj "coarse + tiling"
            tiledMaxAreaKm2: 2500,

            // tile ciljna veličina (km²) - veće područje = više tileova
            targetTileAreaKm2: 60,

            // limit tileova (da ne ubiješ server i browser)
            maxTiles: 16,

            // pauza između tile upita (ms) - budi pristojan prema Overpassu
            delayBetweenTilesMs: 450,

            // retry za povremene greške (429/5xx)
            maxRetries: 3
        }
    },
    referenceRouting: {
        // Default OSRM server (demo). Good for car/driving only on the demo host.
        endpoints: {
            car: {
                baseUrl: 'https://router.project-osrm.org',
                profile: 'driving'
            },
            walk: {
                baseUrl: 'https://router.project-osrm.org',
                profile: 'foot' // will likely NOT work on the demo server
            }
        },
        geometries: 'geojson',
        overview: 'full'
    }
};

export const SEGMENT_VISUAL_PRIORITY = {
    base: 0,
    inspect: 1,
    relax: 2,
    path: 3
};

export const MAP_STYLES = {
    roads: {
        base: { color: '#a8a8a8', weight: 2.0, opacity: 0.65 },
        inspect: { color: '#ffd54a', weight: 2.8, opacity: 0.95 },
        relax: { color: '#47b3ff', weight: 3.2, opacity: 0.95 },
        path: { color: '#14b85a', weight: 5.8, opacity: 1.0 }
    },
    searchNodes: {
        open: { radius: 3.8, color: '#0f5dc4', weight: 1, fillColor: '#2b8cff', fillOpacity: 0.95 },
        current: { radius: 4.8, color: '#4d2ac9', weight: 2, fillColor: '#7a4dff', fillOpacity: 1.0 },
        closed: { radius: 3.8, color: '#c26110', weight: 1, fillColor: '#ff8c2b', fillOpacity: 0.95 },
        path: { radius: 4.5, color: '#0b7d3b', weight: 2, fillColor: '#14b85a', fillOpacity: 1.0 }
    },
    markers: {
        start: { radius: 8, color: '#fff', weight: 2, fillColor: '#e53935', fillOpacity: 1.0 },
        end: { radius: 8, color: '#fff', weight: 2, fillColor: '#1e88e5', fillOpacity: 1.0 }
    },
    overlays: {
        finalPath: { color: '#14b85a', weight: 7.5, opacity: 0.85 }
    },
    referenceRoute: {
        polyline: {
            color: '#ff2bd6',
            weight: 6,
            opacity: 0.9,
            dashArray: '10 10'
        }
    }
};