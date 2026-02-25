import { haversineMeters, edgeKeyFromOsmNodeIds } from '../utils/geo.js';

export class RoadGraphBuilder {
    buildFromOverpass(overpassJson, profile) {
        const elements = Array.isArray(overpassJson?.elements) ? overpassJson.elements : [];

        const osmNodes = new Map(); // osmNodeId -> { lat, lng }
        const ways = [];

        for (const element of elements) {
            if (element.type === 'node' && typeof element.lat === 'number' && typeof element.lon === 'number') {
                osmNodes.set(element.id, { lat: element.lat, lng: element.lon });
                continue;
            }

            if (
                element.type === 'way' &&
                Array.isArray(element.nodes) &&
                element.nodes.length >= 2 &&
                element.tags?.highway &&
                this.#canTraverseWay(element, profile)
            ) {
                ways.push(element);
            }
        }

        const nodes = []; // internal nodes: index -> { id, osmId, lat, lng }
        const adjacency = new Map(); // internalNodeId -> [{ to, w, segmentKey }]
        const segments = new Map(); // segmentKey -> segment metadata
        const osmToInternalNodeId = new Map();

        let directedEdgesCount = 0;

        const ensureInternalNode = (osmNodeId) => {
            const existing = osmToInternalNodeId.get(osmNodeId);
            if (existing !== undefined) return existing;

            const osmNode = osmNodes.get(osmNodeId);
            if (!osmNode) return null;

            const internalNodeId = nodes.length;
            nodes.push({
                id: internalNodeId,
                osmId: osmNodeId,
                lat: osmNode.lat,
                lng: osmNode.lng
            });

            osmToInternalNodeId.set(osmNodeId, internalNodeId);
            adjacency.set(internalNodeId, []);
            return internalNodeId;
        };

        const addDirectedEdge = (fromId, toId, weight, segmentKey) => {
            adjacency.get(fromId).push({ to: toId, w: weight, segmentKey });
            directedEdgesCount++;
        };

        const ensureSegment = (osmNodeIdA, osmNodeIdB, internalNodeIdA, internalNodeIdB, lengthMeters) => {
            const segmentKey = edgeKeyFromOsmNodeIds(osmNodeIdA, osmNodeIdB);

            if (!segments.has(segmentKey)) {
                const a = nodes[internalNodeIdA];
                const b = nodes[internalNodeIdB];

                segments.set(segmentKey, {
                    key: segmentKey,
                    osmNodeIdA,
                    osmNodeIdB,
                    internalNodeIdA,
                    internalNodeIdB,
                    lengthMeters,
                    coordinates: [
                        [a.lat, a.lng],
                        [b.lat, b.lng]
                    ]
                });
            }

            return segmentKey;
        };

        for (const way of ways) {
            const directionMode = this.#getWayDirectionMode(way, profile);
            const osmNodeList = way.nodes;

            for (let i = 0; i < osmNodeList.length - 1; i++) {
                const osmNodeIdA = osmNodeList[i];
                const osmNodeIdB = osmNodeList[i + 1];

                if (osmNodeIdA === osmNodeIdB) continue;

                const osmA = osmNodes.get(osmNodeIdA);
                const osmB = osmNodes.get(osmNodeIdB);
                if (!osmA || !osmB) continue;

                const internalA = ensureInternalNode(osmNodeIdA);
                const internalB = ensureInternalNode(osmNodeIdB);
                if (internalA === null || internalB === null) continue;

                const lengthMeters = haversineMeters(osmA.lat, osmA.lng, osmB.lat, osmB.lng);
                const segmentKey = ensureSegment(osmNodeIdA, osmNodeIdB, internalA, internalB, lengthMeters);

                if (directionMode === 'forward') {
                    addDirectedEdge(internalA, internalB, lengthMeters, segmentKey);
                } else if (directionMode === 'reverse') {
                    addDirectedEdge(internalB, internalA, lengthMeters, segmentKey);
                } else {
                    addDirectedEdge(internalA, internalB, lengthMeters, segmentKey);
                    addDirectedEdge(internalB, internalA, lengthMeters, segmentKey);
                }
            }
        }

        return {
            profile,
            nodes,
            adjacency,
            segments,
            directedEdgesCount,
            osmWaysCount: ways.length
        };
    }

    #canTraverseWay(way, profile) {
        const tags = way.tags || {};
        const highway = String(tags.highway || '');
        if (!highway) return false;

        if (profile === 'car') {
            if (tags.access === 'no' || tags.motor_vehicle === 'no' || tags.vehicle === 'no') return false;

            const blockedForCar = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway']);
            if (blockedForCar.has(highway)) return false;

            return true;
        }

        // walk profile
        if (tags.access === 'no' || tags.foot === 'no') return false;
        return true;
    }

    #getWayDirectionMode(way, profile) {
        if (profile === 'walk') {
            // Simplified for demo clarity (treat as bidirectional)
            return 'both';
        }

        const tags = way.tags || {};
        const oneway = String(tags.oneway || '').toLowerCase();

        if (oneway === 'yes' || oneway === '1' || oneway === 'true') return 'forward';
        if (oneway === '-1') return 'reverse';

        if (String(tags.junction || '').toLowerCase() === 'roundabout') return 'forward';

        return 'both';
    }
}