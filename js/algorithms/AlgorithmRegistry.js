import { AStarPathfinder } from './pathfinders/AStarPathfinder.js';
import { DijkstraPathfinder } from './pathfinders/DijkstraPathfinder.js';
import { BidirectionalDijkstraPathfinder } from './pathfinders/BidirectionalDijkstraPathfinder.js';
import { WeightedAStarPathfinder } from './pathfinders/WeightedAStarPathfinder.js';
import { GreedyBestFirstPathfinder } from './pathfinders/GreedyBestFirstPathfinder.js';
import { BFSPathfinder } from './pathfinders/BFSPathfinder.js';

export const AlgorithmRegistry = {
    astar: () => new AStarPathfinder(),
    dijkstra: () => new DijkstraPathfinder(),
    bidijkstra: () => new BidirectionalDijkstraPathfinder(),
    wastar: () => new WeightedAStarPathfinder({ epsilon: 1.5 }),
    greedy: () => new GreedyBestFirstPathfinder(),
    bfs: () => new BFSPathfinder()
};