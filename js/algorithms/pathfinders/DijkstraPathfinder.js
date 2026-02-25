import { BasePathfinder } from './BasePathfinder.js';

export class DijkstraPathfinder extends BasePathfinder {
    computeSearchEvents(graph, startNodeId, goalNodeId) {
        return this.runBestFirstSearch(graph, startNodeId, goalNodeId);
    }

    getHeuristicMeters() {
        return 0;
    }

    getPriority(gMeters) {
        return gMeters;
    }

    getAlgorithmMeta(base) {
        return {
            ...base,
            algorithmKey: 'dijkstra',
            algorithmName: 'Dijkstra',
            optimal: true,
            notes: 'No heuristic; explores by accumulated distance.'
        };
    }
}