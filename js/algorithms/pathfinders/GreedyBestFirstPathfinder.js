import { BasePathfinder } from './BasePathfinder.js';
import { haversineMeters } from '../../utils/geo.js';

export class GreedyBestFirstPathfinder extends BasePathfinder {
    computeSearchEvents(graph, startNodeId, goalNodeId) {
        return this.runBestFirstSearch(graph, startNodeId, goalNodeId);
    }

    getHeuristicMeters(graph, nodeIdA, nodeIdB) {
        const a = graph.nodes[nodeIdA];
        const b = graph.nodes[nodeIdB];
        return haversineMeters(a.lat, a.lng, b.lat, b.lng);
    }

    getPriority(_gMeters, hMeters) {
        // Greedy: ignores accumulated cost, only chases the goal
        return hMeters;
    }

    getAlgorithmMeta(base) {
        return {
            ...base,
            algorithmKey: 'greedy',
            algorithmName: 'Greedy Best-First',
            optimal: false,
            notes: 'Very fast; ignores distance traveled so far, not guaranteed to find the shortest route.'
        };
    }
}