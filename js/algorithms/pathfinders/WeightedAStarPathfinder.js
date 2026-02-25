import { BasePathfinder } from './BasePathfinder.js';
import { haversineMeters } from '../../utils/geo.js';

export class WeightedAStarPathfinder extends BasePathfinder {
    constructor({ epsilon = 1.5 } = {}) {
        super();
        this.epsilon = epsilon;
    }

    computeSearchEvents(graph, startNodeId, goalNodeId) {
        return this.runBestFirstSearch(graph, startNodeId, goalNodeId);
    }

    getHeuristicMeters(graph, nodeIdA, nodeIdB) {
        const a = graph.nodes[nodeIdA];
        const b = graph.nodes[nodeIdB];
        return haversineMeters(a.lat, a.lng, b.lat, b.lng);
    }

    getPriority(gMeters, hMeters) {
        return gMeters + this.epsilon * hMeters;
    }

    getAlgorithmMeta(base) {
        return {
            ...base,
            algorithmKey: 'wastar',
            algorithmName: `Weighted A* (ε=${this.epsilon})`,
            optimal: false,
            notes: 'Trades optimality for speed by inflating the heuristic.'
        };
    }
}