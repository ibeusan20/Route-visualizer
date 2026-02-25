export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(a));
}

export function edgeKeyFromOsmNodeIds(osmNodeIdA, osmNodeIdB) {
    return osmNodeIdA < osmNodeIdB
        ? `${osmNodeIdA}-${osmNodeIdB}`
        : `${osmNodeIdB}-${osmNodeIdA}`;
}

export function estimateViewportAreaKm2(bounds) {
    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    const width = haversineMeters(south, west, south, east);
    const height = haversineMeters(south, west, north, west);

    return (width * height) / 1_000_000;
}