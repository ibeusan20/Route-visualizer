import { APP_CONFIG } from '../config.js';

export class ReferenceRoutingService {
    constructor(config = APP_CONFIG.referenceRouting) {
        this.baseUrl = config.baseUrl;
        this.profile = config.profile;
        this.geometries = config.geometries;
        this.overview = config.overview;
    }

    /**
     * Fetch reference route from OSRM.
     * OSRM expects lon,lat order in URL.
     * Returns { latLngs, distanceMeters, durationSeconds }.
     */
    async fetchRoute(startLatLng, endLatLng) {
        const url =
            `${this.baseUrl}/route/v1/${this.profile}` +
            `/${startLatLng.lng},${startLatLng.lat};${endLatLng.lng},${endLatLng.lat}` +
            `?overview=${encodeURIComponent(this.overview)}` +
            `&geometries=${encodeURIComponent(this.geometries)}`;

        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`OSRM HTTP ${res.status}`);
        }

        const data = await res.json();
        if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
            throw new Error(`OSRM error: ${data.code || 'Unknown'}`);
        }

        const route = data.routes[0];
        const coords = route.geometry?.coordinates;
        if (!coords || !coords.length) {
            throw new Error('OSRM route has no geometry.');
        }

        // Convert [lon, lat] -> [lat, lon] for Leaflet
        const latLngs = coords.map(([lon, lat]) => [lat, lon]);

        return {
            latLngs,
            distanceMeters: route.distance,
            durationSeconds: route.duration
        };
    }
}