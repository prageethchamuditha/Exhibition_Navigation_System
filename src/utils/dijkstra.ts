import { type NavigationNode, type NavigationEdge } from '../lib/supabase';

/**
 * Haversine formula to compute distance in meters between two coordinates.
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
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
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
 * Calculate compass heading (bearing) direction between two coordinate points
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
  const normalizedBearing = (bearing + 360) % 360;

  if (normalizedBearing >= 337.5 || normalizedBearing < 22.5) return 'North';
  if (normalizedBearing >= 22.5 && normalizedBearing < 67.5) return 'North-East';
  if (normalizedBearing >= 67.5 && normalizedBearing < 112.5) return 'East';
  if (normalizedBearing >= 112.5 && normalizedBearing < 157.5) return 'South-East';
  if (normalizedBearing >= 157.5 && normalizedBearing < 202.5) return 'South';
  if (normalizedBearing >= 202.5 && normalizedBearing < 247.5) return 'South-West';
  if (normalizedBearing >= 247.5 && normalizedBearing < 292.5) return 'West';
  return 'North-West';
}

