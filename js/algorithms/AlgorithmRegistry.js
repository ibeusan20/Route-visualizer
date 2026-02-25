import { AStarPathfinder } from './pathfinders/AStarPathfinder.js';
import { DijkstraPathfinder } from './pathfinders/DijkstraPathfinder.js';
import { BidirectionalDijkstraPathfinder } from './pathfinders/BidirectionalDijkstraPathfinder.js';
import { WeightedAStarPathfinder } from './pathfinders/WeightedAStarPathfinder.js';
import { GreedyBestFirstPathfinder } from './pathfinders/GreedyBestFirstPathfinder.js';
import { BFSPathfinder } from './pathfinders/BFSPathfinder.js';

/**
 * Strategy Registry (single source of truth)
 * - UI is populated from here
 * - App uses this to create algorithm strategies
 */
export class AlgorithmRegistry {
    static getDefaultKey() {
        return 'astar';
    }

    /**
     * @returns {Array<{ key: string, label: string, factory: () => any }>}
     */
    static getAll() {
        return [
            {
                key: 'dijkstra',
                label: 'Dijkstra (optimal)',
                factory: () => new DijkstraPathfinder()
            },
            {
                key: 'astar',
                label: 'A* (optimal)',
                factory: () => new AStarPathfinder()
            },
            {
                key: 'bidijkstra',
                label: 'Bidirectional Dijkstra (optimal, faster)',
                factory: () => new BidirectionalDijkstraPathfinder()
            },
            {
                key: 'wastar',
                label: 'Weighted A* ε=1.5 (faster, not optimal)',
                factory: () => new WeightedAStarPathfinder({ epsilon: 1.5 })
            },
            {
                key: 'greedy',
                label: 'Greedy Best-First (very fast, not optimal)',
                factory: () => new GreedyBestFirstPathfinder()
            },
            {
                key: 'bfs',
                label: 'BFS (fast hops, ignores weights)',
                factory: () => new BFSPathfinder()
            }
        ];
    }

    /**
     * Create a strategy instance by key.
     */
    static create(key) {
        const def = this.getAll().find(x => x.key === key);
        if (!def) {
            throw new Error(`Unknown algorithm key: ${key}`);
        }
        return def.factory();
    }
}