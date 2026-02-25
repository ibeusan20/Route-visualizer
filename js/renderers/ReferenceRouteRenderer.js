import { MAP_STYLES } from '../config.js';

export class ReferenceRouteRenderer {
    constructor(mapManager) {
        this.layer = mapManager.layers.overlays;
        this.polyline = null;

        this.cachedLatLngs = null;
        this.visible = false;

        this.distanceMeters = null;
        this.durationSeconds = null;
    }

    setVisible(visible) {
        this.visible = Boolean(visible);

        if (!this.visible) {
            this.hide();
            return;
        }

        if (this.cachedLatLngs && this.cachedLatLngs.length) {
            this.show(this.cachedLatLngs);
        }
    }

    setRoute(latLngs, { distanceMeters = null, durationSeconds = null } = {}) {
        this.cachedLatLngs = latLngs;
        this.distanceMeters = distanceMeters;
        this.durationSeconds = durationSeconds;

        if (this.visible) {
            this.show(latLngs);
        }
    }

    show(latLngs) {
        this.cachedLatLngs = latLngs;

        if (this.polyline) {
            this.polyline.setLatLngs(latLngs);
            this.updateTooltip();
            return;
        }

        this.polyline = L.polyline(latLngs, MAP_STYLES.referenceRoute.polyline).addTo(this.layer);
        this.updateTooltip();
    }

    updateTooltip() {
        if (!this.polyline) return;

        const distText = this.distanceMeters != null && isFinite(this.distanceMeters)
            ? `${this.distanceMeters.toFixed(0)} m`
            : '-';

        const durText = this.durationSeconds != null && isFinite(this.durationSeconds)
            ? this.formatDuration(this.durationSeconds)
            : '-';

        const content = `Reference (OSRM)\nDistance: ${distText}\nDuration: ${durText}`;

        // bindTooltip once, then update via setTooltipContent
        if (!this.polyline.getTooltip()) {
            this.polyline.bindTooltip(content, { sticky: true, direction: 'top' });
        } else {
            this.polyline.setTooltipContent(content);
        }
    }

    formatDuration(seconds) {
        const s = Math.max(0, Math.floor(seconds));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = s % 60;

        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${r}s`;
        return `${r}s`;
    }

    hide() {
        if (this.polyline) {
            this.layer.removeLayer(this.polyline);
            this.polyline = null;
        }
    }

    clear() {
        this.hide();
        this.cachedLatLngs = null;
        this.distanceMeters = null;
        this.durationSeconds = null;
    }
}