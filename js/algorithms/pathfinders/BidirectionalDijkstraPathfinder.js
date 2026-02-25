import { BasePathfinder } from './BasePathfinder.js';
import { MinHeap } from '../MinHeap.js';

export class BidirectionalDijkstraPathfinder extends BasePathfinder {
    computeSearchEvents(graph, startNodeId, goalNodeId) {
        const nodeCount = graph.nodes.length;

        const distF = Array(nodeCount).fill(Infinity);
        const distB = Array(nodeCount).fill(Infinity);

        const prevF = new Map();
        const prevB = new Map();

        const closedF = new Set();
        const closedB = new Set();

        const openF = new Set();
        const openB = new Set();

        const pqF = new MinHeap();
        const pqB = new MinHeap();

        let serial = 0;
        const pushF = (nodeId, prio) => pqF.push({ nodeId, priority: prio, serial: serial++ });
        const pushB = (nodeId, prio) => pqB.push({ nodeId, priority: prio, serial: serial++ });

        const events = [];
        let expandedNodes = 0;
        let inspectedEdges = 0;
        let relaxedEdges = 0;

        distF[startNodeId] = 0;
        distB[goalNodeId] = 0;

        pushF(startNodeId, 0);
        pushB(goalNodeId, 0);

        openF.add(startNodeId);
        openB.add(goalNodeId);

        events.push({ type: 'open', nodeId: startNodeId });
        events.push({ type: 'open', nodeId: goalNodeId });

        let bestMeet = null;
        let bestCost = Infinity;

        const popValid = (pq, openSet, closedSet) => {
            while (pq.size() > 0) {
                const e = pq.pop();
                if (closedSet.has(e.nodeId)) continue;
                if (!openSet.has(e.nodeId)) continue;
                return e.nodeId;
            }
            return null;
        };

        // Helper to build a reversed adjacency for the backward search
        // (since the graph stores directed edges, incoming edges are needed for "backward Dijkstra")
        const incoming = this.#buildIncomingAdjacency(graph);

        while (pqF.size() > 0 || pqB.size() > 0) {
            const currentF = popValid(pqF, openF, closedF);
            const currentB = popValid(pqB, openB, closedB);

            if (currentF === null && currentB === null) break;

            // Expand forward step
            if (currentF !== null) {
                openF.delete(currentF);
                events.push({ type: 'current', nodeId: currentF });

                closedF.add(currentF);
                expandedNodes++;
                events.push({ type: 'closed', nodeId: currentF });

                if (closedB.has(currentF)) {
                    const candidate = distF[currentF] + distB[currentF];
                    if (candidate < bestCost) {
                        bestCost = candidate;
                        bestMeet = currentF;
                    }
                }

                for (const nb of (graph.adjacency.get(currentF) || [])) {
                    inspectedEdges++;
                    events.push({ type: 'edgeInspect', segmentKey: nb.segmentKey });

                    if (closedF.has(nb.to)) continue;

                    const nd = distF[currentF] + nb.w;
                    if (nd < distF[nb.to]) {
                        distF[nb.to] = nd;
                        prevF.set(nb.to, currentF);
                        pushF(nb.to, nd);
                        openF.add(nb.to);

                        relaxedEdges++;
                        events.push({ type: 'edgeRelax', segmentKey: nb.segmentKey });
                        events.push({ type: 'open', nodeId: nb.to });
                    }
                }
            }

            // Expand backward step (using incoming edges)
            if (currentB !== null) {
                openB.delete(currentB);
                events.push({ type: 'current', nodeId: currentB });

                closedB.add(currentB);
                expandedNodes++;
                events.push({ type: 'closed', nodeId: currentB });

                if (closedF.has(currentB)) {
                    const candidate = distF[currentB] + distB[currentB];
                    if (candidate < bestCost) {
                        bestCost = candidate;
                        bestMeet = currentB;
                    }
                }

                for (const nb of (incoming.get(currentB) || [])) {
                    inspectedEdges++;
                    events.push({ type: 'edgeInspect', segmentKey: nb.segmentKey });

                    if (closedB.has(nb.to)) continue;

                    const nd = distB[currentB] + nb.w;
                    if (nd < distB[nb.to]) {
                        distB[nb.to] = nd;
                        prevB.set(nb.to, currentB); // note: prevB points "towards goal"
                        pushB(nb.to, nd);
                        openB.add(nb.to);

                        relaxedEdges++;
                        events.push({ type: 'edgeRelax', segmentKey: nb.segmentKey });
                        events.push({ type: 'open', nodeId: nb.to });
                    }
                }
            }

            // Stopping condition: if it already found a meet, and the smallest fronts cannot beat bestCost
            const minF = this.#peekPriority(pqF);
            const minB = this.#peekPriority(pqB);
            const bound = (minF ?? Infinity) + (minB ?? Infinity);
            if (bestMeet !== null && bound >= bestCost) {
                break;
            }
        }

        if (bestMeet === null || !isFinite(bestCost)) {
            return {
                events,
                meta: {
                    found: false,
                    algorithmKey: 'bidijkstra',
                    algorithmName: 'Bidirectional Dijkstra',
                    optimal: true,
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

        const pathNodeIds = this.#reconstructBidirectionalPath(prevF, prevB, startNodeId, goalNodeId, bestMeet);
        events.push({ type: 'path', pathNodeIds, costMeters: bestCost });

        return {
            events,
            meta: {
                found: true,
                algorithmKey: 'bidijkstra',
                algorithmName: 'Bidirectional Dijkstra',
                optimal: true,
                notes: 'Often faster than classic Dijkstra by meeting in the middle.',
                costMeters: bestCost,
                expandedNodes,
                inspectedEdges,
                relaxedEdges,
                pathNodeCount: pathNodeIds.length,
                pathEdgeCount: Math.max(0, pathNodeIds.length - 1)
            }
        };
    }

    #buildIncomingAdjacency(graph) {
        const incoming = new Map();
        for (const node of graph.nodes) incoming.set(node.id, []);

        for (const [from, edges] of graph.adjacency.entries()) {
            for (const e of edges) {
                // incoming for 'to' should include edge leading from 'to' back to 'from'
                incoming.get(e.to).push({ to: from, w: e.w, segmentKey: e.segmentKey });
            }
        }
        return incoming;
    }

    #peekPriority(heap) {
        const p = heap.peek();
        return p ? p.priority : null;
    }

    #reconstructBidirectionalPath(prevF, prevB, start, goal, meet) {
        // start -> meet using prevF
        const left = [];
        let cur = meet;
        left.push(cur);
        while (cur !== start && prevF.has(cur)) {
            cur = prevF.get(cur);
            left.push(cur);
        }
        left.reverse(); // now start..meet

        // meet -> goal using prevB (prevB points from a node to the next node towards goal)
        const right = [];
        cur = meet;
        while (cur !== goal && prevB.has(cur)) {
            cur = prevB.get(cur);
            right.push(cur);
        }

        return left.concat(right); // start..meet..goal
    }
}