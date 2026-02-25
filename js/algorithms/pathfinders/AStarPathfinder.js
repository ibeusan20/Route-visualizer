import { BasePathfinder } from './BasePathfinder.js';
import { haversineMeters } from '../../utils/geo.js';

export class AStarPathfinder extends BasePathfinder {
    computeSearchEvents(graph, startNodeId, goalNodeId) {
        return this.runBestFirstSearch(graph, startNodeId, goalNodeId);
    }

    getHeuristicMeters(graph, nodeIdA, nodeIdB) {
        const a = graph.nodes[nodeIdA];
        const b = graph.nodes[nodeIdB];
        return haversineMeters(a.lat, a.lng, b.lat, b.lng);
    }

    getPriority(gMeters, hMeters) {
        return gMeters + hMeters;
    }

    getAlgorithmMeta(base) {
        return {
            ...base,
            algorithmKey: 'astar',
            algorithmName: 'A*',
            optimal: true,
            notes: 'Uses straight-line distance as heuristic.'
        };
    }
}