import { MinHeap } from './MinHeap.js';
import { haversineMeters } from '../utils/geo.js';

export class PathFinder {
    computeSearchEvents(graph, startNodeId, goalNodeId, algorithm = 'astar') {
        const nodeCount = graph.nodes.length;

        const gScore = Array(nodeCount).fill(Infinity);
        const fScore = Array(nodeCount).fill(Infinity);
        const cameFrom = new Map();

        const closedSet = new Set();
        const openSetMembership = new Set();
        const queue = new MinHeap();

        let serial = 0;
        let expandedNodes = 0;
        let inspectedEdges = 0;
        let relaxedEdges = 0;

        const events = [];

        const pushToQueue = (nodeId, priority) => {
            queue.push({ nodeId, priority, serial: serial++ });
        };

        gScore[startNodeId] = 0;
        fScore[startNodeId] = algorithm === 'astar'
            ? this.#heuristic(graph, startNodeId, goalNodeId)
            : 0;

        pushToQueue(startNodeId, fScore[startNodeId]);
        openSetMembership.add(startNodeId);
        events.push({ type: 'open', nodeId: startNodeId });

        while (queue.size() > 0) {
            const entry = queue.pop();
            const currentNodeId = entry.nodeId;

            if (closedSet.has(currentNodeId)) continue;
            if (!openSetMembership.has(currentNodeId)) continue;

            openSetMembership.delete(currentNodeId);
            events.push({ type: 'current', nodeId: currentNodeId });

            if (currentNodeId === goalNodeId) {
                const pathNodeIds = this.#reconstructPath(cameFrom, goalNodeId);

                events.push({
                    type: 'path',
                    pathNodeIds,
                    costMeters: gScore[goalNodeId]
                });

                return {
                    events,
                    meta: {
                        found: true,
                        algorithm,
                        costMeters: gScore[goalNodeId],
                        expandedNodes,
                        inspectedEdges,
                        relaxedEdges,
                        pathNodeCount: pathNodeIds.length,
                        pathEdgeCount: Math.max(0, pathNodeIds.length - 1)
                    }
                };
            }

            closedSet.add(currentNodeId);
            expandedNodes++;
            events.push({ type: 'closed', nodeId: currentNodeId });

            const neighbors = graph.adjacency.get(currentNodeId) || [];
            for (const neighbor of neighbors) {
                inspectedEdges++;
                events.push({ type: 'edgeInspect', segmentKey: neighbor.segmentKey });

                if (closedSet.has(neighbor.to)) continue;

                const tentativeG = gScore[currentNodeId] + neighbor.w;
                if (tentativeG < gScore[neighbor.to]) {
                    cameFrom.set(neighbor.to, currentNodeId);
                    gScore[neighbor.to] = tentativeG;

                    const heuristicValue = algorithm === 'astar'
                        ? this.#heuristic(graph, neighbor.to, goalNodeId)
                        : 0;

                    fScore[neighbor.to] = tentativeG + heuristicValue;
                    pushToQueue(neighbor.to, fScore[neighbor.to]);
                    openSetMembership.add(neighbor.to);

                    relaxedEdges++;
                    events.push({ type: 'edgeRelax', segmentKey: neighbor.segmentKey });
                    events.push({ type: 'open', nodeId: neighbor.to });
                }
            }
        }

        return {
            events,
            meta: {
                found: false,
                algorithm,
                costMeters: Infinity,
                expandedNodes,
                inspectedEdges,
                relaxedEdges,
                pathNodeCount: 0,
                pathEdgeCount: 0
            }
        };
    }

    #heuristic(graph, nodeIdA, nodeIdB) {
        const a = graph.nodes[nodeIdA];
        const b = graph.nodes[nodeIdB];
        return haversineMeters(a.lat, a.lng, b.lat, b.lng);
    }

    #reconstructPath(cameFrom, goalNodeId) {
        const path = [goalNodeId];
        let current = goalNodeId;

        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            path.push(current);
        }

        path.reverse();
        return path;
    }
}