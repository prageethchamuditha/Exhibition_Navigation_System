import { type NavigationNode, type NavigationEdge } from '../lib/supabase';

/**
 * Equirectangular approximation for short-range distance (< 1 km).
 *
 * Unlike Haversine (which assumes a spherical Earth and is designed for
 * global-scale distances), equirectangular projects coordinates onto a flat
 * plane using the mid-latitude as a correction factor. This gives far higher
 * floating-point precision when coordinate deltas are tiny (e.g. 0.00005°),
 * which is exactly the case in indoor/campus navigation where nodes may be
 * only 3–20 metres apart.
 *
 * At distances below 1 km the error vs. the true geodesic is < 0.01%,
 * while Haversine accumulates noticeable rounding error at sub-metre deltas.
 */
export function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters

  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const φMid = (φ1 + φ2) / 2; // mid-latitude for longitude correction

  const Δφ = φ2 - φ1;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Correct longitude difference for latitude (distances shrink near poles)
  const x = Δλ * Math.cos(φMid);
  const y = Δφ;

  return R * Math.sqrt(x * x + y * y); // Distance in meters
}

/**
 * Geographically locate the nearest node to an arbitrary lat/lng coordinate.
 */
export function findClosestNode(
  latitude: number,
  longitude: number,
  nodes: NavigationNode[]
): NavigationNode | null {
  if (nodes.length === 0) return null;

  let closestNode: NavigationNode | null = null;
  let minDistance = Infinity;

  nodes.forEach((node) => {
    const dist = getDistance(latitude, longitude, node.latitude, node.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestNode = node;
    }
  });

  return closestNode;
}

interface GraphAdjacency {
  [nodeId: string]: Array<{ toId: string; weight: number }>;
}

/**
 * Compute the shortest path between start and end node IDs using Dijkstra's algorithm.
 */
export function calculateShortestPath(
  startId: string,
  endId: string,
  nodes: NavigationNode[],
  edges: NavigationEdge[]
): NavigationNode[] {
  if (!startId || !endId || nodes.length === 0) return [];
  if (startId === endId) {
    const node = nodes.find((n) => n.id === startId);
    return node ? [node] : [];
  }

  // 1. Build Adjacency Graph
  const graph: GraphAdjacency = {};
  nodes.forEach((n) => {
    graph[n.id] = [];
  });

  edges.forEach((edge) => {
    // Ensure both nodes exist in nodes list
    if (graph[edge.from_node_id] && graph[edge.to_node_id]) {
      const weight = edge.distance > 0 ? edge.distance : 1;
      
      graph[edge.from_node_id].push({ toId: edge.to_node_id, weight });
      
      if (edge.is_bidirectional) {
        graph[edge.to_node_id].push({ toId: edge.from_node_id, weight });
      }
    }
  });

  // 2. Initialize Dijkstra tables
  const distances: { [nodeId: string]: number } = {};
  const previous: { [nodeId: string]: string | null } = {};
  const unvisited = new Set<string>();

  nodes.forEach((n) => {
    distances[n.id] = Infinity;
    previous[n.id] = null;
    unvisited.add(n.id);
  });

  distances[startId] = 0;

  // 3. Dijkstra loop
  while (unvisited.size > 0) {
    // Find node with minimum distance in unvisited set
    let currentId: string | null = null;
    let minDistance = Infinity;

    unvisited.forEach((id) => {
      if (distances[id] < minDistance) {
        minDistance = distances[id];
        currentId = id;
      }
    });

    // If target is unreachable or all remaining nodes are infinity, stop
    if (currentId === null || minDistance === Infinity) {
      break;
    }

    // Found target
    if (currentId === endId) {
      break;
    }

    unvisited.delete(currentId);

    // Update neighbors
    const neighbors = graph[currentId] || [];
    neighbors.forEach((neighbor) => {
      if (unvisited.has(neighbor.toId)) {
        const alt = distances[currentId!] + neighbor.weight;
        if (alt < distances[neighbor.toId]) {
          distances[neighbor.toId] = alt;
          previous[neighbor.toId] = currentId;
        }
      }
    });
  }

  // 4. Reconstruct path
  const pathIds: string[] = [];
  let curr: string | null = endId;

  // If no path was found
  if (previous[endId] === null && startId !== endId) {
    return [];
  }

  while (curr !== null) {
    pathIds.unshift(curr);
    curr = previous[curr];
  }

  // Map IDs to actual Node objects
  const nodeMap = new Map(nodes.map((id) => [id.id, id]));
  return pathIds.map((id) => nodeMap.get(id)!).filter(Boolean);
}

/**
 * Calculate compass heading (bearing) direction between two coordinate points.
 * Returns a 16-point compass direction for finer indoor turn guidance.
 */
export function getHeading(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  const b = (bearing + 360) % 360; // Normalize to [0, 360)

  // 16-point compass: each sector is 22.5° wide
  if (b >= 348.75 || b < 11.25)   return 'North';
  if (b >= 11.25  && b < 33.75)   return 'North-Northeast';
  if (b >= 33.75  && b < 56.25)   return 'Northeast';
  if (b >= 56.25  && b < 78.75)   return 'East-Northeast';
  if (b >= 78.75  && b < 101.25)  return 'East';
  if (b >= 101.25 && b < 123.75)  return 'East-Southeast';
  if (b >= 123.75 && b < 146.25)  return 'Southeast';
  if (b >= 146.25 && b < 168.75)  return 'South-Southeast';
  if (b >= 168.75 && b < 191.25)  return 'South';
  if (b >= 191.25 && b < 213.75)  return 'South-Southwest';
  if (b >= 213.75 && b < 236.25)  return 'Southwest';
  if (b >= 236.25 && b < 258.75)  return 'West-Southwest';
  if (b >= 258.75 && b < 281.25)  return 'West';
  if (b >= 281.25 && b < 303.75)  return 'West-Northwest';
  if (b >= 303.75 && b < 326.25)  return 'Northwest';
  return 'North-Northwest';
}
