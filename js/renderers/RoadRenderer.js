import { MAP_STYLES, SEGMENT_VISUAL_PRIORITY } from '../config.js';

export class RoadRenderer {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.layerGroup = mapManager.layers.roads;

        this.segmentLines = new Map();  // segmentKey -> polyline
        this.segmentState = new Map();  // segmentKey -> base|inspect|relax|path
    }

    clear() {
        this.layerGroup.clearLayers();
        this.segmentLines.clear();
        this.segmentState.clear();
    }

    renderGraph(graph) {
        this.clear();

        for (const segment of graph.segments.values()) {
            const line = L.polyline(segment.coordinates, MAP_STYLES.roads.base).addTo(this.layerGroup);
            this.segmentLines.set(segment.key, line);
            this.segmentState.set(segment.key, 'base');
        }
    }

    resetStyles() {
        for (const [key, line] of this.segmentLines.entries()) {
            line.setStyle(MAP_STYLES.roads.base);
            this.segmentState.set(key, 'base');
        }
    }

    setSegmentState(segmentKey, nextState) {
        const line = this.segmentLines.get(segmentKey);
        if (!line) return;

        const current = this.segmentState.get(segmentKey) || 'base';
        const currP = SEGMENT_VISUAL_PRIORITY[current] ?? 0;
        const nextP = SEGMENT_VISUAL_PRIORITY[nextState] ?? 0;
        if (nextP < currP) return;

        this.segmentState.set(segmentKey, nextState);
        line.setStyle(MAP_STYLES.roads[nextState] || MAP_STYLES.roads.base);
    }
}