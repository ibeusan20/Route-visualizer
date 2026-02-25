import { MAP_STYLES } from '../config.js';
import { edgeKeyFromOsmNodeIds } from '../utils/geo.js';

export class SearchRenderer {
    constructor(mapManager) {
        this.mapManager = mapManager;

        this.searchNodesLayer = mapManager.layers.searchNodes;
        this.overlaysLayer = mapManager.layers.overlays;

        this.searchNodeMarkers = new Map(); // nodeId -> circleMarker
        this.startMarker = null;
        this.endMarker = null;
        this.finalPathOverlay = null;
    }

    clearSearchMarkers() {
        this.searchNodesLayer.clearLayers();
        this.searchNodeMarkers.clear();
    }

    clearFinalPath() {
        if (this.finalPathOverlay) {
            this.overlaysLayer.removeLayer(this.finalPathOverlay);
            this.finalPathOverlay = null;
        }
    }

    clearStartEndMarkers() {
        if (this.startMarker) {
            this.overlaysLayer.removeLayer(this.startMarker);
            this.startMarker = null;
        }
        if (this.endMarker) {
            this.overlaysLayer.removeLayer(this.endMarker);
            this.endMarker = null;
        }
    }

    clearAll() {
        this.clearSearchMarkers();
        this.clearFinalPath();
        this.clearStartEndMarkers();
    }

    setNodeState(nodeId, node, stateName) {
        let marker = this.searchNodeMarkers.get(nodeId);
        if (!marker) {
            marker = L.circleMarker([node.lat, node.lng], MAP_STYLES.searchNodes.open)
                .addTo(this.searchNodesLayer);
            this.searchNodeMarkers.set(nodeId, marker);
        }
        marker.setStyle(MAP_STYLES.searchNodes[stateName] || MAP_STYLES.searchNodes.open);
    }

    drawStartEnd(startNode, endNode) {
        this.clearStartEndMarkers();

        if (startNode) {
            this.startMarker = L.circleMarker([startNode.lat, startNode.lng], MAP_STYLES.markers.start)
                .addTo(this.overlaysLayer)
                .bindTooltip('A', { permanent: true, direction: 'top', offset: [0, -8] });
        }

        if (endNode) {
            this.endMarker = L.circleMarker([endNode.lat, endNode.lng], MAP_STYLES.markers.end)
                .addTo(this.overlaysLayer)
                .bindTooltip('B', { permanent: true, direction: 'top', offset: [0, -8] });
        }
    }

    drawFinalPath(graph, pathNodeIds) {
        this.clearFinalPath();

        const latLngs = [];
        for (const id of pathNodeIds) {
            const n = graph.nodes[id];
            latLngs.push([n.lat, n.lng]);
        }

        this.finalPathOverlay = L.polyline(latLngs, MAP_STYLES.overlays.finalPath)
            .addTo(this.overlaysLayer);
    }

    static getSegmentKeyBetweenGraphNodes(graph, nodeIdA, nodeIdB) {
        const a = graph.nodes[nodeIdA];
        const b = graph.nodes[nodeIdB];
        return edgeKeyFromOsmNodeIds(a.osmId, b.osmId);
    }
}