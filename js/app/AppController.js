import { UIController } from '../ui/UIController.js';
import { MapManager } from '../map/MapManager.js';
import { OverpassService } from '../services/OverpassService.js';
import { RoadGraphBuilder } from '../graph/RoadGraphBuilder.js';
import { Pathfinder } from '../algorithms/PathFinder.js';
import { SearchAnimator } from '../animation/SearchAnimator.js';

export class AppController {
    constructor() {
        this.ui = new UIController();
        this.mapManager = new MapManager();
        this.overpassService = new OverpassService();
        this.roadGraphBuilder = new RoadGraphBuilder();
        this.pathfinder = new Pathfinder();
        this.animator = new SearchAnimator();

        this.state = {
            graph: null,
            startNodeId: null,
            endNodeId: null,
            loadingRoads: false,
            searchCounters: null
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

        this.#resetSearchVisualization(true);
        this.#clearPointsOnly(false);

        this.mapManager.clearRoads();
        this.mapManager.clearAllOverlays();

        this.state.graph = null;
        this.state.loadingRoads = true;
        this.ui.setLoadButtonDisabled(true);

        const zoom = this.mapManager.getZoom();
        const areaKm2 = this.mapManager.getViewportAreaKm2();
        if (zoom < 14) {
            this.ui.setStatus(`Zoom is ${zoom}. Recommended zoom is >= 14 for a cleaner demo.`);
        }
        if (areaKm2 > 25) {
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
            this.mapManager.renderRoadGraph(graph);

            this.ui.setStats(this.#buildBaseStatsText());
            this.ui.setStatus(
                `Road network loaded. Click A then B. (nodes: ${graph.nodes.length}, segments: ${graph.segments.size})`
            );
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

        const nearestNode = this.#findNearestGraphNode(event.latlng);
        if (!nearestNode) {
            this.ui.setStatus('No road node found in loaded network.');
            return;
        }

        this.#resetSearchVisualization(true);

        if (this.state.startNodeId === null || (this.state.startNodeId !== null && this.state.endNodeId !== null)) {
            this.state.startNodeId = nearestNode.id;
            this.state.endNodeId = null;
            this.ui.setStatus(`Point A set (snapped to road node id ${nearestNode.id}). Click point B.`);
        } else {
            if (nearestNode.id === this.state.startNodeId) {
                this.ui.setStatus('Point B cannot be the same node as point A.');
                return;
            }

            this.state.endNodeId = nearestNode.id;
            this.ui.setStatus(`Point B set (node id ${nearestNode.id}). Ready to run.`);
        }

        this.#redrawStartEndMarkers();
        this.ui.setStats(this.#buildBaseStatsText());
    }

    clearPoints() {
        this.#resetSearchVisualization(true);
        this.#clearPointsOnly(true);
        this.ui.setStatus('Points A/B cleared. Click map to place A then B.');
    }

    resetColors() {
        this.#resetSearchVisualization(false);
        this.#redrawStartEndMarkers();

        if (this.state.graph) {
            this.ui.setStats(this.#buildBaseStatsText());
        } else {
            this.ui.setStats('');
        }

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

        const algorithm = this.ui.getSelectedAlgorithm();
        const result = this.pathfinder.computeSearchEvents(
            this.state.graph,
            this.state.startNodeId,
            this.state.endNodeId,
            algorithm
        );

        if (!result.events.length) {
            this.ui.setStatus('No animation events generated.');
            return;
        }

        this.#resetSearchVisualization(true);
        this.#initializeSearchCounters();

        this.ui.setPauseButtonLabel('Pause');
        this.ui.setStatus(`Animation started (${algorithm === 'astar' ? 'A*' : 'Dijkstra'}).`);
        this.#updateLiveStats();

        this.animator.start({
            events: result.events,
            meta: result.meta,
            speedProvider: () => this.ui.getAnimationSpeedMs(),
            onEvent: (event, currentIndex, totalEvents, meta) => {
                this.#applySearchEvent(event);
                this.#updateLiveStats({ currentIndex, totalEvents, meta });
            },
            onComplete: (meta) => {
                this.ui.setPauseButtonLabel('Pause');
                if (meta?.found) {
                    this.ui.setStatus(`Finished. Route found (${meta.algorithm === 'astar' ? 'A*' : 'Dijkstra'}).`);
                } else {
                    this.ui.setStatus(`Finished. No route found (${meta?.algorithm === 'astar' ? 'A*' : 'Dijkstra'}).`);
                }

                this.#redrawStartEndMarkers();
                this.#updateLiveStats(null, meta);
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

    #findNearestGraphNode(latlng) {
        let bestNode = null;
        let bestDistance = Infinity;

        for (const node of this.state.graph.nodes) {
            const distance = this.mapManager.distanceMeters(latlng, { lat: node.lat, lng: node.lng });
            if (distance < bestDistance) {
                bestDistance = distance;
                bestNode = node;
            }
        }

        return bestNode;
    }

    #clearPointsOnly(updateStats) {
        this.state.startNodeId = null;
        this.state.endNodeId = null;
        this.mapManager.clearStartEndMarkers();

        if (updateStats) {
            this.ui.setStats(this.state.graph ? this.#buildBaseStatsText() : '');
        }
    }

    #redrawStartEndMarkers() {
        const startNode = this.state.graph && this.state.startNodeId !== null
            ? this.state.graph.nodes[this.state.startNodeId]
            : null;

        const endNode = this.state.graph && this.state.endNodeId !== null
            ? this.state.graph.nodes[this.state.endNodeId]
            : null;

        this.mapManager.drawStartEndMarkers(startNode, endNode);
    }

    #resetSearchVisualization(keepStats = false) {
        this.animator.stop();
        this.ui.setPauseButtonLabel('Pause');

        if (!this.state.graph) {
            if (!keepStats) this.ui.setStats('');
            return;
        }

        this.mapManager.clearSearchNodeMarkers();
        this.mapManager.clearFinalPathOverlay();
        this.mapManager.resetRoadStyles();

        this.state.searchCounters = null;

        if (!keepStats) {
            this.ui.setStats(this.#buildBaseStatsText());
        }
    }

    #initializeSearchCounters() {
        this.state.searchCounters = {
            openNodeIds: new Set(),
            closedCount: 0,
            inspectedSegmentKeys: new Set(),
            relaxedSegmentKeys: new Set(),
            pathFound: false,
            pathNodeCount: 0,
            pathCostMeters: null
        };
    }

    #applySearchEvent(event) {
        const graph = this.state.graph;
        const counters = this.state.searchCounters;
        if (!graph || !counters) return;

        switch (event.type) {
            case 'open': {
                const node = graph.nodes[event.nodeId];
                this.mapManager.setSearchNodeState(event.nodeId, node, 'open');
                counters.openNodeIds.add(event.nodeId);
                break;
            }

            case 'current': {
                const node = graph.nodes[event.nodeId];
                this.mapManager.setSearchNodeState(event.nodeId, node, 'current');
                break;
            }

            case 'closed': {
                const node = graph.nodes[event.nodeId];
                this.mapManager.setSearchNodeState(event.nodeId, node, 'closed');
                counters.closedCount++;
                break;
            }

            case 'edgeInspect':
                this.mapManager.setRoadSegmentState(event.segmentKey, 'inspect');
                counters.inspectedSegmentKeys.add(event.segmentKey);
                break;

            case 'edgeRelax':
                this.mapManager.setRoadSegmentState(event.segmentKey, 'relax');
                counters.relaxedSegmentKeys.add(event.segmentKey);
                break;

            case 'path': {
                const latLngs = [];

                for (let i = 0; i < event.pathNodeIds.length; i++) {
                    const nodeId = event.pathNodeIds[i];
                    const node = graph.nodes[nodeId];

                    this.mapManager.setSearchNodeState(nodeId, node, 'path');
                    latLngs.push([node.lat, node.lng]);

                    if (i < event.pathNodeIds.length - 1) {
                        const nextNode = graph.nodes[event.pathNodeIds[i + 1]];
                        const segmentKey = this.#buildSegmentKeyFromPathNodes(node.osmId, nextNode.osmId);
                        this.mapManager.setRoadSegmentState(segmentKey, 'path');
                    }
                }

                this.mapManager.drawFinalPath(latLngs);
                counters.pathFound = true;
                counters.pathNodeCount = event.pathNodeIds.length;
                counters.pathCostMeters = event.costMeters;

                this.#redrawStartEndMarkers();
                break;
            }

            default:
                break;
        }
    }

    #buildSegmentKeyFromPathNodes(osmNodeIdA, osmNodeIdB) {
        return osmNodeIdA < osmNodeIdB
            ? `${osmNodeIdA}-${osmNodeIdB}`
            : `${osmNodeIdB}-${osmNodeIdA}`;
    }

    #buildBaseStatsText() {
        const graph = this.state.graph;
        if (!graph) return '';

        return [
            `Graph nodes: ${graph.nodes.length}`,
            `Road segments: ${graph.segments.size}`,
            `Directed edges: ${graph.directedEdgesCount}`,
            `OSM ways: ${graph.osmWaysCount}`,
            `Profile: ${graph.profile === 'car' ? 'Car' : 'Walk'}`,
            `A: ${this.state.startNodeId ?? '-'}`,
            `B: ${this.state.endNodeId ?? '-'}`
        ].join('\n');
    }

    #updateLiveStats(progressOverride = null, finalMeta = null) {
        const graph = this.state.graph;
        const counters = this.state.searchCounters;

        if (!graph || !counters) {
            this.ui.setStats(this.#buildBaseStatsText());
            return;
        }

        const progress = progressOverride || this.animator.getProgress();
        const meta = progress.meta || finalMeta || null;

        const lines = [
            `Algorithm: ${meta?.algorithm === 'astar' ? 'A*' : (meta?.algorithm === 'dijkstra' ? 'Dijkstra' : '-')}`,
            `Animation step: ${progress.index ?? 0}/${progress.total ?? 0}`,
            `Open nodes seen: ${counters.openNodeIds.size}`,
            `Closed nodes: ${counters.closedCount}`,
            `Inspected segments: ${counters.inspectedSegmentKeys.size}`,
            `Relaxed segments: ${counters.relaxedSegmentKeys.size}`,
            `A: ${this.state.startNodeId ?? '-'}`,
            `B: ${this.state.endNodeId ?? '-'}`
        ];

        if (counters.pathFound) {
            lines.push(`Route found: YES`);
            lines.push(`Path nodes: ${counters.pathNodeCount}`);
            lines.push(`Path cost: ${counters.pathCostMeters.toFixed(1)} m`);
        } else {
            lines.push(`Route found: not yet / no`);
        }

        if (finalMeta) {
            lines.push('');
            lines.push('Execution summary:');
            lines.push(`- expanded nodes: ${finalMeta.expandedNodes}`);
            lines.push(`- inspected edges: ${finalMeta.inspectedEdges}`);
            lines.push(`- relaxed edges: ${finalMeta.relaxedEdges}`);
            lines.push(`- path edges: ${finalMeta.pathEdgeCount}`);
        }

        this.ui.setStats(lines.join('\n'));
    }
}