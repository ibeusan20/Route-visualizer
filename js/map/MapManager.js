import { APP_CONFIG, MAP_STYLES, SEGMENT_VISUAL_PRIORITY } from '../config.js';
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

        this.roadLayersBySegmentKey = new Map();     // segmentKey -> Leaflet polyline
        this.roadStateBySegmentKey = new Map();      // segmentKey -> base|inspect|relax|path
        this.searchNodeLayersByNodeId = new Map();   // nodeId -> Leaflet circleMarker

        this.startMarker = null;
        this.endMarker = null;
        this.finalPathOverlay = null;
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

    clearRoads() {
        this.layers.roads.clearLayers();
        this.roadLayersBySegmentKey.clear();
        this.roadStateBySegmentKey.clear();
    }

    renderRoadGraph(graph) {
        this.clearRoads();

        for (const segment of graph.segments.values()) {
            const line = L.polyline(segment.coordinates, MAP_STYLES.roads.base).addTo(this.layers.roads);
            this.roadLayersBySegmentKey.set(segment.key, line);
            this.roadStateBySegmentKey.set(segment.key, 'base');
        }
    }

    resetRoadStyles() {
        for (const [segmentKey, line] of this.roadLayersBySegmentKey.entries()) {
            line.setStyle(MAP_STYLES.roads.base);
            this.roadStateBySegmentKey.set(segmentKey, 'base');
        }
    }

    setRoadSegmentState(segmentKey, nextState) {
        const line = this.roadLayersBySegmentKey.get(segmentKey);
        if (!line) return;

        const currentState = this.roadStateBySegmentKey.get(segmentKey) || 'base';
        const currentPriority = SEGMENT_VISUAL_PRIORITY[currentState] ?? 0;
        const nextPriority = SEGMENT_VISUAL_PRIORITY[nextState] ?? 0;

        if (nextPriority < currentPriority) {
            return;
        }

        this.roadStateBySegmentKey.set(segmentKey, nextState);
        line.setStyle(MAP_STYLES.roads[nextState] || MAP_STYLES.roads.base);
    }

    clearSearchNodeMarkers() {
        this.layers.searchNodes.clearLayers();
        this.searchNodeLayersByNodeId.clear();
    }

    setSearchNodeState(nodeId, node, stateName) {
        let marker = this.searchNodeLayersByNodeId.get(nodeId);

        if (!marker) {
            marker = L.circleMarker([node.lat, node.lng], MAP_STYLES.searchNodes.open)
                .addTo(this.layers.searchNodes);
            this.searchNodeLayersByNodeId.set(nodeId, marker);
        }

        marker.setStyle(MAP_STYLES.searchNodes[stateName] || MAP_STYLES.searchNodes.open);
    }

    clearFinalPathOverlay() {
        if (this.finalPathOverlay) {
            this.layers.overlays.removeLayer(this.finalPathOverlay);
            this.finalPathOverlay = null;
        }
    }

    drawFinalPath(latLngs) {
        this.clearFinalPathOverlay();

        this.finalPathOverlay = L.polyline(latLngs, MAP_STYLES.overlays.finalPath)
            .addTo(this.layers.overlays);
    }

    clearStartEndMarkers() {
        if (this.startMarker) {
            this.layers.overlays.removeLayer(this.startMarker);
            this.startMarker = null;
        }
        if (this.endMarker) {
            this.layers.overlays.removeLayer(this.endMarker);
            this.endMarker = null;
        }
    }

    drawStartEndMarkers(startNode, endNode) {
        this.clearStartEndMarkers();

        if (startNode) {
            this.startMarker = L.circleMarker([startNode.lat, startNode.lng], MAP_STYLES.markers.start)
                .addTo(this.layers.overlays)
                .bindTooltip('A', { permanent: true, direction: 'top', offset: [0, -8] });
        }

        if (endNode) {
            this.endMarker = L.circleMarker([endNode.lat, endNode.lng], MAP_STYLES.markers.end)
                .addTo(this.layers.overlays)
                .bindTooltip('B', { permanent: true, direction: 'top', offset: [0, -8] });
        }
    }

    clearAllOverlays() {
        this.clearSearchNodeMarkers();
        this.clearFinalPathOverlay();
        this.clearStartEndMarkers();
    }
}