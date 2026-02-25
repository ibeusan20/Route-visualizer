import { MinHeap } from '../MinHeap.js';

export class BasePathfinder {
    constructor() {
        if (new.target === BasePathfinder) {
            throw new Error('BasePathfinder is abstract. Extend it and implement required methods.');
        }
    }

    /**
     * Public entry point used by the app.
     * Must return:
     *  - events: array of animation events
     *  - meta: summary info
     */
    computeSearchEvents(graph, startNodeId, goalNodeId) {
        throw new Error('computeSearchEvents() must be implemented by subclasses.');
    }

    /**
     * Shared helper for algorithms that use a priority queue (A*, Dijkstra, Greedy, Weighted A*).
     * Subclasses typically override:
     *  - getHeuristicMeters()
     *  - getPriority()
     *  - getAlgorithmMeta()
     */
    runBestFirstSearch(graph, startNodeId, goalNodeId) {
        const nodeCount = graph.nodes.length;

        const gScore = Array(nodeCount).fill(Infinity);
        const fScore = Array(nodeCount).fill(Infinity);
        const cameFrom = new Map();

        const closedSet = new Set();
        const openMembership = new Set();
        const queue = new MinHeap();

        let serial = 0;
        let expandedNodes = 0;
        let inspectedEdges = 0;
        let relaxedEdges = 0;

        const events = [];

        const push = (nodeId, priority) => {
            queue.push({ nodeId, priority, serial: serial++ });
        };

        gScore[startNodeId] = 0;
        const hStart = this.getHeuristicMeters(graph, startNodeId, goalNodeId);
        const pStart = this.getPriority(0, hStart);
        fScore[startNodeId] = pStart;

        push(startNodeId, pStart);
        openMembership.add(startNodeId);
        events.push({ type: 'open', nodeId: startNodeId });

        while (queue.size() > 0) {
            const entry = queue.pop();
            const current = entry.nodeId;

            if (closedSet.has(current)) continue;
            if (!openMembership.has(current)) continue;

            openMembership.delete(current);
            events.push({ type: 'current', nodeId: current });

            if (current === goalNodeId) {
                const pathNodeIds = this.reconstructPath(cameFrom, goalNodeId);
                events.push({ type: 'path', pathNodeIds, costMeters: gScore[goalNodeId] });

                const meta = this.getAlgorithmMeta({
                    found: true,
                    costMeters: gScore[goalNodeId],
                    expandedNodes,
                    inspectedEdges,
                    relaxedEdges,
                    pathNodeCount: pathNodeIds.length,
                    pathEdgeCount: Math.max(0, pathNodeIds.length - 1)
                });

                return { events, meta };
            }

            closedSet.add(current);
            expandedNodes++;
            events.push({ type: 'closed', nodeId: current });

            const neighbors = graph.adjacency.get(current) || [];
            for (const nb of neighbors) {
                inspectedEdges++;
                events.push({ type: 'edgeInspect', segmentKey: nb.segmentKey });

                if (closedSet.has(nb.to)) continue;

                const tentativeG = gScore[current] + nb.w;
                if (tentativeG < gScore[nb.to]) {
                    cameFrom.set(nb.to, current);
                    gScore[nb.to] = tentativeG;

                    const h = this.getHeuristicMeters(graph, nb.to, goalNodeId);
                    const priority = this.getPriority(tentativeG, h);
                    fScore[nb.to] = priority;

                    push(nb.to, priority);
                    openMembership.add(nb.to);

                    relaxedEdges++;
                    events.push({ type: 'edgeRelax', segmentKey: nb.segmentKey });
                    events.push({ type: 'open', nodeId: nb.to });
                }
            }
        }

        const meta = this.getAlgorithmMeta({
            found: false,
            costMeters: Infinity,
            expandedNodes,
            inspectedEdges,
            relaxedEdges,
            pathNodeCount: 0,
            pathEdgeCount: 0
        });

        return { events, meta };
    }

    reconstructPath(cameFrom, goalNodeId) {
        const path = [goalNodeId];
        let current = goalNodeId;

        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            path.push(current);
        }

        path.reverse();
        return path;
    }

    // ---------- Hooks for subclasses ----------

    getHeuristicMeters(graph, nodeIdA, nodeIdB) {
        // Default: no heuristic (Dijkstra-style). Override for A* / greedy / weighted A*.
        return 0;
    }

    getPriority(gMeters, hMeters) {
        // Default: Dijkstra priority
        return gMeters;
    }

    getAlgorithmMeta(base) {
        // Subclasses override with { algorithmKey, algorithmName, optimal, notes? }
        return {
            ...base,
            algorithmKey: 'base',
            algorithmName: 'Base',
            optimal: false
        };
    }
}