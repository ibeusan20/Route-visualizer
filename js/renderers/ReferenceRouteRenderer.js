import { MAP_STYLES } from '../config.js';

export class ReferenceRouteRenderer {
    constructor(mapManager) {
        this.layer = mapManager.layers.overlays;
        this.polyline = null;
        this.cachedLatLngs = null;
        this.visible = false;
    }

    setVisible(visible) {
        this.visible = Boolean(visible);

        if (!this.visible) {
            this.hide();
            return;
        }

        // If there are any cached coords, show them immediately
        if (this.cachedLatLngs && this.cachedLatLngs.length) {
            this.show(this.cachedLatLngs);
        }
    }

    setRoute(latLngs) {
        this.cachedLatLngs = latLngs;

        if (this.visible) {
            this.show(latLngs);
        }
    }

    show(latLngs) {
        this.cachedLatLngs = latLngs;

        if (this.polyline) {
            this.polyline.setLatLngs(latLngs);
            return;
        }

        this.polyline = L.polyline(latLngs, MAP_STYLES.referenceRoute.polyline).addTo(this.layer);
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
    }
}