import { APP_CONFIG } from '../config.js';

export class OverpassService {
    constructor(endpoint = APP_CONFIG.overpass.endpoint, timeoutSeconds = APP_CONFIG.overpass.timeoutSeconds) {
        this.endpoint = endpoint;
        this.timeoutSeconds = timeoutSeconds;
    }

    async fetchRoadData(bounds, profile) {
        const query = this.buildRoadQuery(bounds, profile);

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=UTF-8'
            },
            body: query
        });

        if (!response.ok) {
            throw new Error(`Overpass HTTP ${response.status}`);
        }

        return response.json();
    }

    buildRoadQuery(bounds, profile) {
        const south = bounds.getSouth().toFixed(6);
        const west = bounds.getWest().toFixed(6);
        const north = bounds.getNorth().toFixed(6);
        const east = bounds.getEast().toFixed(6);

        const carHighways = [
            'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
            'unclassified', 'residential', 'living_street', 'service', 'road',
            'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'
        ];

        const walkExtraHighways = ['pedestrian', 'footway', 'path', 'steps', 'cycleway', 'track'];

        const highwayRegex = (profile === 'walk'
            ? [...carHighways, ...walkExtraHighways]
            : carHighways
        ).join('|');

        return `
[out:json][timeout:${this.timeoutSeconds}];
(
  way["highway"~"${highwayRegex}"](${south},${west},${north},${east});
);
(._;>;);
out body;
`.trim();
    }
}