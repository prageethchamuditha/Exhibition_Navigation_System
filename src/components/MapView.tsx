import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type Store, type NavigationNode, type NavigationEdge } from '../lib/supabase';

// Fix Leaflet default icon paths (important for vanilla leaflet in Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapViewProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  stores?: Store[];
  userLat?: number | null;
  userLng?: number | null;
  route?: NavigationNode[];
  theme?: 'dark' | 'streets' | 'light';
  showGraphMesh?: boolean;
  nodes?: NavigationNode[];
  edges?: NavigationEdge[];
}

export function MapView({
  latitude,
  longitude,
  zoom = 18,
  stores = [],
  userLat = null,
  userLng = null,
  route = [],
  theme = 'dark',
  showGraphMesh = false,
  nodes = [],
  edges = [],
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);
  const meshLayerRef = useRef<L.FeatureGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Map instance
    const newMap = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    // Create Layer groups
    const markersLayer = L.layerGroup().addTo(newMap);
    markersLayerRef.current = markersLayer;

    const routeLayer = L.featureGroup().addTo(newMap);
    routeLayerRef.current = routeLayer;

    const meshLayer = L.featureGroup().addTo(newMap);
    meshLayerRef.current = meshLayer;

    setMap(newMap);

    // Clean up on unmount
    return () => {
      newMap.remove();
      setMap(null);
      markersLayerRef.current = null;
      routeLayerRef.current = null;
      meshLayerRef.current = null;
      tileLayerRef.current = null;
    };
  }, [latitude, longitude, zoom]);

  // 2. Tile Layer Theme Manager
  useEffect(() => {
    if (!map) return;

    // Remove existing tile layer
    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
    if (theme === 'streets') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    } else if (theme === 'light') {
      url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
    }

    const tileLayer = L.tileLayer(url, { maxZoom: 20 });
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // Move to back
    tileLayer.bringToBack();
  }, [map, theme]);

  // 3. Update view center if coords change
  useEffect(() => {
    // Only center map if there is no active route navigation
    if (map && route.length === 0) {
      map.setView([latitude, longitude], zoom);
    }
  }, [map, latitude, longitude, zoom, route.length]);

  // 4. Render Store Markers
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    // Clear existing markers
    markersLayer.clearLayers();

    stores.forEach((store) => {
      if (store.latitude === null || store.longitude === null) return;

      const catColor = store.categories?.color || 'var(--color-primary)';
      const isDestination = route.length > 0 && route[route.length - 1].store_id === store.id;

      // Custom HTML pin (adds pulse effect if this store is the destination)
      const customIcon = L.divIcon({
        className: 'custom-map-pin-wrapper',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;">
            ${isDestination ? `
              <div style="
                position: absolute;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: ${catColor};
                opacity: 0.4;
                animation: map-pin-pulse 1.8s infinite ease-in-out;
              "></div>
            ` : ''}
            <div style="
              width: 26px;
              height: 26px;
              border-radius: 50%;
              background: ${catColor};
              border: 2.5px solid #fff;
              box-shadow: 0 2px 8px rgba(0,0,0,0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #fff;
              font-size: 0.75rem;
              font-weight: 800;
              z-index: 10;
            ">
              ${store.name[0]}
            </div>
          </div>
          <style>
            @keyframes map-pin-pulse {
              0% { transform: scale(0.6); opacity: 0.7; }
              100% { transform: scale(1.6); opacity: 0; }
            }
          </style>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const marker = L.marker([store.latitude, store.longitude], { icon: customIcon });

      // Info bubble popup with detail link
      marker.bindPopup(`
        <div style="color: #0b0f1a; padding: 0.25rem; font-family: sans-serif; min-width: 140px;">
          <h4 style="margin: 0 0 0.25rem 0; font-weight: 800; font-size: 0.95rem; line-height: 1.2;">${store.name}</h4>
          <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: #64748b;">
            Floor: ${store.floor || '1'} · ${store.categories?.name || 'Exhibitor'}
          </p>
          <a href="/stores/${store.id}" style="
            display: block;
            background: #6366f1;
            color: #fff;
            padding: 0.35rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 700;
            text-decoration: none;
            text-align: center;
            box-shadow: 0 2px 4px rgba(99,102,241,0.25);
          ">View Profile</a>
        </div>
      `);

      markersLayer.addLayer(marker);
    });
  }, [map, stores, route]);

  // 5. Render User Location Marker
  useEffect(() => {
    if (!map) return;

    if (userLat !== null && userLng !== null) {
      const userIcon = L.divIcon({
        className: 'user-map-pin',
        html: `
          <div style="position: relative;">
            <div style="
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: #22d3ee;
              border: 2px solid #fff;
              box-shadow: 0 0 6px rgba(34,211,238,0.6);
            "></div>
            <div style="
              position: absolute;
              inset: -8px;
              border-radius: 50%;
              border: 2px solid rgba(34,211,238,0.4);
              animation: map-ping 1.6s infinite ease-out;
            "></div>
          </div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLat, userLng]);
      } else {
        userMarkerRef.current = L.marker([userLat, userLng], { icon: userIcon }).addTo(map);
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }
  }, [map, userLat, userLng]);

  // 6. Render Route Polyline
  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) return;

    // Clear existing route drawings
    routeLayer.clearLayers();

    if (!route || route.length < 2) return;

    const coordinates = route.map((node) => [node.latitude, node.longitude] as [number, number]);

    // Draw dashed path polyline
    const polyline = L.polyline(coordinates, {
      color: '#6366f1',
      weight: 6,
      opacity: 0.9,
      dashArray: '12, 12',
    });

    routeLayer.addLayer(polyline);

    // Fit map bounds to show the entire route
    map.fitBounds(polyline.getBounds(), { padding: [60, 60] });
  }, [map, route]);

  // 7. Draw Graph Mesh (Admin only)
  useEffect(() => {
    const meshLayer = meshLayerRef.current;
    if (!map || !meshLayer) return;

    meshLayer.clearLayers();

    if (!showGraphMesh || nodes.length === 0) return;

    // 1. Draw connecting edges
    edges.forEach((edge) => {
      const fromNode = nodes.find((n) => n.id === edge.from_node_id);
      const toNode = nodes.find((n) => n.id === edge.to_node_id);
      if (fromNode && toNode) {
        const line = L.polyline(
          [
            [fromNode.latitude, fromNode.longitude],
            [toNode.latitude, toNode.longitude],
          ],
          {
            color: 'rgba(34, 211, 238, 0.45)', // cyan glow
            weight: 2,
            dashArray: '5, 5',
          }
        );
        meshLayer.addLayer(line);
      }
    });

    // 2. Draw nodes dots
    nodes.forEach((node) => {
      let color = '#94a3b8'; // default grey path
      if (node.type === 'entrance') color = '#22d3ee';
      else if (node.type === 'poi') color = '#a78bfa';
      else if (node.type === 'store') color = '#34d399';
      else if (node.type === 'emergency') color = '#f43f5e';

      const circle = L.circleMarker([node.latitude, node.longitude], {
        radius: 5.5,
        fillColor: color,
        color: '#fff',
        weight: 1.5,
        fillOpacity: 0.9,
      }).bindTooltip(node.label, { permanent: false, direction: 'top' });

      meshLayer.addLayer(circle);
    });
  }, [map, showGraphMesh, nodes, edges]);

  return (
    <div
      ref={mapContainerRef}
      className="map-container"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}
    />
  );
}
