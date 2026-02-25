import { BasePathfinder } from './BasePathfinder.js';

export class BFSPathfinder extends BasePathfinder {
    computeSearchEvents(graph, startNodeId, goalNodeId) {
        const cameFrom = new Map();
        const visited = new Set([startNodeId]);
        const queue = [startNodeId];

        const events = [];
        let expandedNodes = 0;
        let inspectedEdges = 0;
        let relaxedEdges = 0;

        events.push({ type: 'open', nodeId: startNodeId });

        while (queue.length > 0) {
            const current = queue.shift();
            events.push({ type: 'current', nodeId: current });

            if (current === goalNodeId) {
                const pathNodeIds = this.reconstructPath(cameFrom, goalNodeId);
                // BFS cost here is not real meters; still computes a "meter-ish" sum using graph weights along the reconstructed path.
                const costMeters = this.#estimateMetersFromPath(graph, pathNodeIds);

                events.push({ type: 'path', pathNodeIds, costMeters });

                return {
                    events,
                    meta: {
                        found: true,
                        algorithmKey: 'bfs',
                        algorithmName: 'BFS (unweighted hops)',
                        optimal: false,
                        notes: 'Fast but ignores distances; minimizes hops, not meters.',
                        costMeters,
                        expandedNodes,
                        inspectedEdges,
                        relaxedEdges,
                        pathNodeCount: pathNodeIds.length,
                        pathEdgeCount: Math.max(0, pathNodeIds.length - 1)
                    }
                };
            }

            expandedNodes++;
            events.push({ type: 'closed', nodeId: current });

            const neighbors = graph.adjacency.get(current) || [];
            for (const nb of neighbors) {
                inspectedEdges++;
                events.push({ type: 'edgeInspect', segmentKey: nb.segmentKey });

                if (visited.has(nb.to)) continue;

                visited.add(nb.to);
                cameFrom.set(nb.to, current);
                queue.push(nb.to);

                relaxedEdges++;
                events.push({ type: 'edgeRelax', segmentKey: nb.segmentKey });
                events.push({ type: 'open', nodeId: nb.to });
            }
        }

        return {
            events,
            meta: {
                found: false,
                algorithmKey: 'bfs',
                algorithmName: 'BFS (unweighted hops)',
                optimal: false,
                notes: 'No route found.',
                costMeters: Infinity,
                expandedNodes,
                inspectedEdges,
                relaxedEdges,
                pathNodeCount: 0,
                pathEdgeCount: 0
            }
        };
    }

    #estimateMetersFromPath(graph, pathNodeIds) {
        let sum = 0;
        for (let i = 0; i < pathNodeIds.length - 1; i++) {
            const a = pathNodeIds[i];
            const b = pathNodeIds[i + 1];
            const neighbors = graph.adjacency.get(a) || [];
            const edge = neighbors.find(x => x.to === b);
            if (edge) sum += edge.w;
        }
        return sum;
    }

    getAlgorithmMeta(base) {
        return {
            ...base,
            algorithmKey: 'bfs',
            algorithmName: 'BFS (unweighted hops)',
            optimal: false
        };
    }
}