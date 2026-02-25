import { APP_CONFIG } from '../config.js';
import { haversineMeters, estimateViewportAreaKm2 } from '../utils/geo.js';

export class MapManager {
    constructor() {
        this.map = L.map('map', { preferCanvas: true }).setView(
            APP_CONFIG.map.initialCenter,
            APP_CONFIG.map.initialZoom
        );

        L.tileLayer(APP_CONFIG.map.tileUrl, APP_CONFIG.map.tileOptions).addTo(this.map);

        this.layers = {
            roads: L.layerGroup().addTo(this.map),
            searchNodes: L.layerGroup().addTo(this.map),
            overlays: L.layerGroup().addTo(this.map)
        };
    }

    onMapClick(handler) {
        this.map.on('click', handler);
    }

    getBounds() {
        return this.map.getBounds();
    }

    getZoom() {
        return this.map.getZoom();
    }

    getViewportAreaKm2() {
        return estimateViewportAreaKm2(this.map.getBounds());
    }

    distanceMeters(latLngA, latLngB) {
        return haversineMeters(latLngA.lat, latLngA.lng, latLngB.lat, latLngB.lng);
    }
}