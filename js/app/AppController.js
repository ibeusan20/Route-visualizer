import { UIController } from '../ui/UIController.js';
import { MapManager } from '../map/MapManager.js';
import { OverpassService } from '../services/OverpassService.js';
import { RoadGraphBuilder } from '../graph/RoadGraphBuilder.js';
import { SearchAnimator } from '../animation/SearchAnimator.js';

import { RoadRenderer } from '../renderers/RoadRenderer.js';
import { SearchRenderer } from '../renderers/SearchRenderer.js';

import { AlgorithmRegistry } from '../algorithms/AlgorithmRegistry.js';

export class AppController {
    constructor() {
        this.ui = new UIController();
        this.mapManager = new MapManager();

        this.roadRenderer = new RoadRenderer(this.mapManager);
        this.searchRenderer = new SearchRenderer(this.mapManager);

        this.overpassService = new OverpassService();
        this.roadGraphBuilder = new RoadGraphBuilder();
        this.animator = new SearchAnimator();

        this.state = {
            graph: null,
            startNodeId: null,
            endNodeId: null,
            loadingRoads: false,
            counters: null
        };
    }

    init() {
        this.ui.bindHandlers({
            onLoadRoads: () => this.loadRoadNetworkFromCurrentView(),
            onClearPoints: () => this.clearPoints(),
            onResetColors: () => this.resetColors(),
            onStart: () => this.startSearch(),
            onPause: () => this.togglePause()
        });

        this.mapManager.onMapClick((event) => this.handleMapClick(event));
        this.ui.setStatus('Move the map to an area and click "Load roads (view)".');
        this.ui.setStats('');
    }

    async loadRoadNetworkFromCurrentView() {
        if (this.state.loadingRoads) return;

        this.stopAndResetSearch(true);
        this.clearPointsOnly(false);

        this.roadRenderer.clear();
        this.searchRenderer.clearAll();

        this.state.graph = null;
        this.state.loadingRoads = true;
        this.ui.setLoadButtonDisabled(true);

        const zoom = this.mapManager.getZoom();
        const areaKm2 = this.mapManager.getViewportAreaKm2();

        if (zoom < 14) {
            this.ui.setStatus(`Zoom is ${zoom}. Recommended zoom is >= 14 for a cleaner demo.`);
        } else if (areaKm2 > 25) {
            this.ui.setStatus(`Current view is large (~${areaKm2.toFixed(1)} km²). Loading may be slower.`);
        }

        try {
            const profile = this.ui.getSelectedProfile();
            this.ui.setStatus('Loading road network from Overpass API...');

            const overpassJson = await this.overpassService.fetchRoadData(this.mapManager.getBounds(), profile);
            const graph = this.roadGraphBuilder.buildFromOverpass(overpassJson, profile);

            if (!graph.nodes.length || !graph.segments.size) {
                throw new Error('No usable roads found in this view. Try another area or zoom in.');
            }

            this.state.graph = graph;
            this.roadRenderer.renderGraph(graph);

            this.ui.setStats(this.buildBaseStatsText());
            this.ui.setStatus(`Road network loaded. Click A then B. (nodes: ${graph.nodes.length}, segments: ${graph.segments.size})`);
        } catch (error) {
            console.error(error);
            this.ui.setStatus(`Road loading failed: ${error.message}`);
            this.ui.setStats('');
        } finally {
            this.state.loadingRoads = false;
            this.ui.setLoadButtonDisabled(false);
        }
    }

    handleMapClick(event) {
        if (!this.state.graph) {
            this.ui.setStatus('Load roads first.');
            return;
        }

        const nearest = this.findNearestGraphNode(event.latlng);
        if (!nearest) {
            this.ui.setStatus('No road node found in loaded network.');
            return;
        }

        this.stopAndResetSearch(true);

        if (this.state.startNodeId === null || (this.state.startNodeId !== null && this.state.endNodeId !== null)) {
            this.state.startNodeId = nearest.id;
            this.state.endNodeId = null;
            this.ui.setStatus(`Point A set (snapped to road node id ${nearest.id}). Click point B.`);
        } else {
            if (nearest.id === this.state.startNodeId) {
                this.ui.setStatus('Point B cannot be the same node as point A.');
                return;
            }
            this.state.endNodeId = nearest.id;
            this.ui.setStatus(`Point B set (node id ${nearest.id}). Ready to run.`);
        }

        this.redrawStartEndMarkers();
        this.ui.setStats(this.buildBaseStatsText());
    }

    clearPoints() {
        this.stopAndResetSearch(true);
        this.clearPointsOnly(true);
        this.ui.setStatus('Points A/B cleared. Click map to place A then B.');
    }

    resetColors() {
        this.stopAndResetSearch(false);
        this.redrawStartEndMarkers();

        this.ui.setStats(this.state.graph ? this.buildBaseStatsText() : '');
        this.ui.setStatus('Search colors reset. A/B markers remain.');
    }

    startSearch() {
        if (!this.state.graph) {
            this.ui.setStatus('Load roads first.');
            return;
        }
        if (this.state.startNodeId === null || this.state.endNodeId === null) {
            this.ui.setStatus('Place points A and B on the map first.');
            return;
        }
        if (this.state.startNodeId === this.state.endNodeId) {
            this.ui.setStatus('A and B must be different nodes.');
            return;
        }

        const key = this.ui.getSelectedAlgorithm();
        const factory = AlgorithmRegistry[key];

        if (!factory) {
            this.ui.setStatus(`Unknown algorithm: ${key}`);
            return;
        }

        const pathfinder = factory();
        const result = pathfinder.computeSearchEvents(this.state.graph, this.state.startNodeId, this.state.endNodeId);

        if (!result.events.length) {
            this.ui.setStatus('No animation events generated.');
            return;
        }

        this.stopAndResetSearch(true);
        this.initializeCounters();

        this.ui.setPauseButtonLabel('Pause');
        this.ui.setStatus(`Animation started (${result.meta.algorithmName}).`);
        this.updateLiveStats({ currentIndex: 0, totalEvents: result.events.length, meta: result.meta });

        this.animator.start({
            events: result.events,
            meta: result.meta,
            speedProvider: () => this.ui.getAnimationSpeedMs(),
            onEvent: (event, currentIndex, totalEvents, meta) => {
                this.applyEvent(event);
                this.updateLiveStats({ currentIndex, totalEvents, meta });
            },
            onComplete: (meta) => {
                this.ui.setPauseButtonLabel('Pause');

                if (meta?.found) this.ui.setStatus(`Finished. Route found (${meta.algorithmName}).`);
                else this.ui.setStatus(`Finished. No route found (${meta?.algorithmName || 'unknown'}).`);

                this.redrawStartEndMarkers();
                this.updateLiveStats(null, meta);
            }
        });
    }

    togglePause() {
        const status = this.animator.togglePause();

        if (!status.running) {
            this.ui.setStatus('No active animation.');
            return;
        }

        if (status.paused) {
            this.ui.setPauseButtonLabel('Resume');
            this.ui.setStatus('Animation paused.');
        } else {
            this.ui.setPauseButtonLabel('Pause');
            this.ui.setStatus('Animation resumed.');
        }
    }

    // ---------- Helpers ----------

    findNearestGraphNode(latlng) {
        let bestNode = null;
        let bestDistance = Infinity;

        for (const node of this.state.graph.nodes) {
            const d = this.mapManager.distanceMeters(latlng, { lat: node.lat, lng: node.lng });
            if (d < bestDistance) {
                bestDistance = d;
                bestNode = node;
            }
        }
        return bestNode;
    }

    clearPointsOnly(updateStats) {
        this.state.startNodeId = null;
        this.state.endNodeId = null;
        this.searchRenderer.clearStartEndMarkers();

        if (updateStats) {
            this.ui.setStats(this.state.graph ? this.buildBaseStatsText() : '');
        }
    }

    redrawStartEndMarkers() {
        const startNode = this.state.graph && this.state.startNodeId !== null
            ? this.state.graph.nodes[this.state.startNodeId]
            : null;

        const endNode = this.state.graph && this.state.endNodeId !== null
            ? this.state.graph.nodes[this.state.endNodeId]
            : null;

        this.searchRenderer.drawStartEnd(startNode, endNode);
    }

    stopAndResetSearch(keepStats = false) {
        this.animator.stop();
        this.ui.setPauseButtonLabel('Pause');

        if (!this.state.graph) {
            if (!keepStats) this.ui.setStats('');
            return;
        }

        this.searchRenderer.clearSearchMarkers();
        this.searchRenderer.clearFinalPath();
        this.roadRenderer.resetStyles();

        this.state.counters = null;

        if (!keepStats) {
            this.ui.setStats(this.buildBaseStatsText());
        }
    }

    initializeCounters() {
        this.state.counters = {
            openNodes: new Set(),
            closedCount: 0,
            inspectedSegments: new Set(),
            relaxedSegments: new Set(),
            pathFound: false,
            pathNodeCount: 0,
            pathCostMeters: null
        };
    }

    applyEvent(event) {
        const graph = this.state.graph;
        const c = this.state.counters;
        if (!graph || !c) return;

        switch (event.type) {
            case 'open': {
                const node = graph.nodes[event.nodeId];
                this.searchRenderer.setNodeState(event.nodeId, node, 'open');
                c.openNodes.add(event.nodeId);
                break;
            }

            case 'current': {
                const node = graph.nodes[event.nodeId];
                this.searchRenderer.setNodeState(event.nodeId, node, 'current');
                break;
            }

            case 'closed': {
                const node = graph.nodes[event.nodeId];
                this.searchRenderer.setNodeState(event.nodeId, node, 'closed');
                c.closedCount++;
                break;
            }

            case 'edgeInspect':
                this.roadRenderer.setSegmentState(event.segmentKey, 'inspect');
                c.inspectedSegments.add(event.segmentKey);
                break;

            case 'edgeRelax':
                this.roadRenderer.setSegmentState(event.segmentKey, 'relax');
                c.relaxedSegments.add(event.segmentKey);
                break;

            case 'path': {
                // Mark nodes + mark segments along the path + draw overlay
                for (let i = 0; i < event.pathNodeIds.length; i++) {
                    const id = event.pathNodeIds[i];
                    const node = graph.nodes[id];
                    this.searchRenderer.setNodeState(id, node, 'path');

                    if (i < event.pathNodeIds.length - 1) {
                        const nextId = event.pathNodeIds[i + 1];
                        const segKey = SearchRenderer.getSegmentKeyBetweenGraphNodes(graph, id, nextId);
                        this.roadRenderer.setSegmentState(segKey, 'path');
                    }
                }

                this.searchRenderer.drawFinalPath(graph, event.pathNodeIds);

                c.pathFound = true;
                c.pathNodeCount = event.pathNodeIds.length;
                c.pathCostMeters = event.costMeters;

                this.redrawStartEndMarkers();
                break;
            }

            default:
                break;
        }
    }

    buildBaseStatsText() {
        const g = this.state.graph;
        if (!g) return '';

        return [
            `Graph nodes: ${g.nodes.length}`,
            `Road segments: ${g.segments.size}`,
            `Directed edges: ${g.directedEdgesCount}`,
            `OSM ways: ${g.osmWaysCount}`,
            `Profile: ${g.profile === 'car' ? 'Car' : 'Walk'}`,
            `A: ${this.state.startNodeId ?? '-'}`,
            `B: ${this.state.endNodeId ?? '-'}`
        ].join('\n');
    }

    updateLiveStats(progressOverride = null, finalMeta = null) {
        const g = this.state.graph;
        const c = this.state.counters;

        if (!g || !c) {
            this.ui.setStats(this.buildBaseStatsText());
            return;
        }

        const progress = progressOverride || this.animator.getProgress();
        const meta = finalMeta || progress.meta || null;

        const lines = [
            `Algorithm: ${meta?.algorithmName || '-'}`,
            `Optimal: ${meta?.optimal ? 'YES' : 'NO'}`,
            `Animation step: ${progress.index ?? 0}/${progress.total ?? 0}`,
            `Open nodes seen: ${c.openNodes.size}`,
            `Closed nodes: ${c.closedCount}`,
            `Inspected segments: ${c.inspectedSegments.size}`,
            `Relaxed segments: ${c.relaxedSegments.size}`,
            `A: ${this.state.startNodeId ?? '-'}`,
            `B: ${this.state.endNodeId ?? '-'}`
        ];

        if (c.pathFound) {
            lines.push(`Route found: YES`);
            lines.push(`Path nodes: ${c.pathNodeCount}`);
            lines.push(`Path cost: ${c.pathCostMeters.toFixed(1)} m`);
        } else {
            lines.push(`Route found: not yet / no`);
        }

        if (meta?.notes) {
            lines.push(`Notes: ${meta.notes}`);
        }

        if (finalMeta) {
            lines.push('');
            lines.push('Execution summary:');
            lines.push(`- expanded nodes: ${finalMeta.expandedNodes ?? '-'}`);
            lines.push(`- inspected edges: ${finalMeta.inspectedEdges ?? '-'}`);
            lines.push(`- relaxed edges: ${finalMeta.relaxedEdges ?? '-'}`);
            lines.push(`- path edges: ${finalMeta.pathEdgeCount ?? '-'}`);
        }

        this.ui.setStats(lines.join('\n'));
    }
}