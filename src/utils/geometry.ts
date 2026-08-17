/**
 * Geometry and Building Rectangle Obstacle Avoidance Utilities
 */

import { type NavigationNode } from '../lib/supabase';
import { getDistance } from './dijkstra';

export interface BuildingRectangle {
  id: string;
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Default pre-defined building rectangles (e.g. Kalawana School / Katubedda area blocks)
 */
export const DEFAULT_BUILDING_RECTANGLES: BuildingRectangle[] = [
  {
    id: 'block-katubedda-residential-1',
    name: 'Residential Block A (Katubedda-Piliyandala Rd)',
    minLat: 6.534200,
    maxLat: 6.535300,
    minLng: 80.399500,
    maxLng: 80.400800,
  },
  {
    id: 'block-school-main-building',
    name: 'Kalawana School Main Hall',
    minLat: 6.535100,
    maxLat: 6.535700,
    minLng: 80.400500,
    maxLng: 80.401500,
  },
];

/**
 * Check if a lat/lng point is inside a building rectangle
 */
export function isPointInRectangle(lat: number, lng: number, rect: BuildingRectangle): boolean {
  return (
    lat >= rect.minLat &&
    lat <= rect.maxLat &&
    lng >= rect.minLng &&
    lng <= rect.maxLng
  );
}

/**
 * 2D Line segment intersection check between segment (p1 -> p2) and (p3 -> p4)
 * Coordinates are formatted as [lng, lat] or [x, y].
 */
export function doSegmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  function ccw(A: [number, number], B: [number, number], C: [number, number]): boolean {
    return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
  }

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Check if a line segment between (lat1, lng1) and (lat2, lng2) intersects a building rectangle.
 */
export function segmentIntersectsRectangle(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  rect: BuildingRectangle
): boolean {
  // If either endpoint is inside the rectangle, it intersects
  if (isPointInRectangle(lat1, lng1, rect) || isPointInRectangle(lat2, lng2, rect)) {
    return true;
  }

  // Define the 4 boundary segments of the rectangle:
  // NW: (maxLat, minLng), NE: (maxLat, maxLng), SE: (minLat, maxLng), SW: (minLat, minLng)
  const nw: [number, number] = [rect.minLng, rect.maxLat];
  const ne: [number, number] = [rect.maxLng, rect.maxLat];
  const se: [number, number] = [rect.maxLng, rect.minLat];
  const sw: [number, number] = [rect.minLng, rect.minLat];

  const p1: [number, number] = [lng1, lat1];
  const p2: [number, number] = [lng2, lat2];

  return (
    doSegmentsIntersect(p1, p2, nw, ne) ||
    doSegmentsIntersect(p1, p2, ne, se) ||
    doSegmentsIntersect(p1, p2, se, sw) ||
    doSegmentsIntersect(p1, p2, sw, nw)
  );
}

/**
 * Check if a segment intersects ANY building rectangle in a list.
 */
export function segmentIntersectsAnyBuilding(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  buildings: BuildingRectangle[]
): boolean {
  return buildings.some((rect) => segmentIntersectsRectangle(lat1, lng1, lat2, lng2, rect));
}

/**
 * Convert meters to lat/lng offsets near mid-latitude
 */
function metersToLatLngOffset(meters: number, lat: number): { latOffset: number; lngOffset: number } {
  const earthRadius = 6371000; // meters
  const latOffset = (meters / earthRadius) * (180 / Math.PI);
  const lngOffset = (meters / (earthRadius * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return { latOffset, lngOffset };
}

/**
 * Generate tight perimeter corner waypoints around a building rectangle with a safety buffer.
 * "Auto-narrowing" around the rectangle perimeter.
 */
export function getBuildingCornerWaypoints(
  rect: BuildingRectangle,
  bufferMeters = 2
): {
  nw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
  se: { lat: number; lng: number };
  sw: { lat: number; lng: number };
} {
  const midLat = (rect.minLat + rect.maxLat) / 2;
  const { latOffset, lngOffset } = metersToLatLngOffset(bufferMeters, midLat);

  return {
    nw: { lat: rect.maxLat + latOffset, lng: rect.minLng - lngOffset },
    ne: { lat: rect.maxLat + latOffset, lng: rect.maxLng + lngOffset },
    se: { lat: rect.minLat - latOffset, lng: rect.maxLng + lngOffset },
    sw: { lat: rect.minLat - latOffset, lng: rect.minLng - lngOffset },
  };
}

/**
 * Contour a segment (start -> end) tightly around a building rectangle perimeter.
 * Returns intermediate perimeter waypoints if the segment crosses the building rectangle.
 */
export function contourSegmentAroundRectangle(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  rect: BuildingRectangle,
  bufferMeters = 2
): { latitude: number; longitude: number }[] {
  if (!segmentIntersectsRectangle(lat1, lng1, lat2, lng2, rect)) {
    return [{ latitude: lat2, longitude: lng2 }];
  }

  const corners = getBuildingCornerWaypoints(rect, bufferMeters);
  const candidateCorners = [corners.nw, corners.ne, corners.se, corners.sw];

  // Find the corner nearest to start and corner nearest to end that avoid interior collision
  let bestCorners: { lat: number; lng: number }[] = [];
  let minTotalDist = Infinity;

  // Try routing via 1 corner or 2 adjacent corners
  for (const c1 of candidateCorners) {
    const dist1 = getDistance(lat1, lng1, c1.lat, c1.lng) + getDistance(c1.lat, c1.lng, lat2, lng2);
    if (!segmentIntersectsRectangle(lat1, lng1, c1.lat, c1.lng, rect) &&
        !segmentIntersectsRectangle(c1.lat, c1.lng, lat2, lng2, rect)) {
      if (dist1 < minTotalDist) {
        minTotalDist = dist1;
        bestCorners = [c1];
      }
    }

    for (const c2 of candidateCorners) {
      if (c1 === c2) continue;
      const dist2 =
        getDistance(lat1, lng1, c1.lat, c1.lng) +
        getDistance(c1.lat, c1.lng, c2.lat, c2.lng) +
        getDistance(c2.lat, c2.lng, lat2, lng2);

      if (!segmentIntersectsRectangle(lat1, lng1, c1.lat, c1.lng, rect) &&
          !segmentIntersectsRectangle(c1.lat, c1.lng, c2.lat, c2.lng, rect) &&
          !segmentIntersectsRectangle(c2.lat, c2.lng, lat2, lng2, rect)) {
        if (dist2 < minTotalDist) {
          minTotalDist = dist2;
          bestCorners = [c1, c2];
        }
      }
    }
  }

  if (bestCorners.length > 0) {
    return [
      ...bestCorners.map((c) => ({ latitude: c.lat, longitude: c.lng })),
      { latitude: lat2, longitude: lng2 },
    ];
  }

  // Fallback to NE corner if no clear corner path was computed
  return [
    { latitude: corners.ne.lat, longitude: corners.ne.lng },
    { latitude: lat2, longitude: lng2 },
  ];
}

/**
 * Takes a full calculated route (array of NavigationNodes) and processes all segments
 * to auto-contour around any building rectangles crossed by the route.
 */
export function contourPathAroundBuildings(
  route: NavigationNode[],
  buildings: BuildingRectangle[],
  bufferMeters = 2.5
): NavigationNode[] {
  if (route.length < 2 || buildings.length === 0) return route;

  const result: NavigationNode[] = [route[0]];

  for (let i = 0; i < route.length - 1; i++) {
    const current = route[i];
    const next = route[i + 1];

    let currentLat = current.latitude;
    let currentLng = current.longitude;
    let addedSubNodes: { latitude: number; longitude: number }[] = [];

    for (const rect of buildings) {
      if (segmentIntersectsRectangle(currentLat, currentLng, next.latitude, next.longitude, rect)) {
        const contourPts = contourSegmentAroundRectangle(
          currentLat,
          currentLng,
          next.latitude,
          next.longitude,
          rect,
          bufferMeters
        );
        addedSubNodes = contourPts;
        break; // Process first intersecting rectangle for this segment
      }
    }

    if (addedSubNodes.length > 0) {
      addedSubNodes.forEach((pt, idx) => {
        const isLast = idx === addedSubNodes.length - 1;
        result.push({
          id: isLast ? next.id : `contour-node-${i}-${idx}-${Date.now()}`,
          label: isLast ? next.label : 'Building Perimeter Detour',
          latitude: pt.latitude,
          longitude: pt.longitude,
          floor: next.floor || null,
          type: isLast ? next.type : 'path',
          store_id: isLast ? next.store_id : null,
          created_at: new Date().toISOString(),
        });
      });
    } else {
      result.push(next);
    }
  }

  return result;
}
