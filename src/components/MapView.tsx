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
  /** Compass heading in degrees clockwise from North (0–360). Drives the direction cone. */
  heading?: number | null;
  /** GPS accuracy radius in meters. Drives the accuracy circle. */
  gpsAccuracy?: number | null;
}

// ─── Direction-Aware User Location Icon ───────────────────────────────────────

/**
 * Builds a Leaflet DivIcon that shows:
 *  • A Google-Maps-style blue dot (always shown)
 *  • A pulsing accuracy ring (always shown)
 *  • A semi-transparent flashlight-beam cone (only when heading is available)
 *    The entire icon div is rotated by `heading` degrees so the cone points
 *    in the compass direction the device is facing.
 */
function buildUserDirectionIcon(heading: number | null): L.DivIcon {
  const hasHeading = heading !== null;
  const rotation = hasHeading ? heading! : 0;

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:80px;height:80px;position:relative;
        transform:rotate(${rotation}deg);
        transform-origin:40px 40px;
        pointer-events:none;
      ">
        ${hasHeading ? `
        <!-- Flashlight beam cone: two overlapping SVG paths for depth -->
        <svg width="80" height="80" viewBox="0 0 80 80"
             style="position:absolute;inset:0;overflow:visible">
          <!-- Outer glow: wide and very transparent -->
          <path d="M 40 40 L 5 4 Q 40 -7 75 4 Z"
                fill="rgba(66,133,244,0.15)"/>
          <!-- Inner beam: narrow and opaque -->
          <path d="M 40 40 L 20 7 Q 40 1 60 7 Z"
                fill="rgba(66,133,244,0.52)"/>
        </svg>
        ` : ''}

        <!-- Pulsing accuracy ring -->
        <div style="
          position:absolute;width:26px;height:26px;border-radius:50%;
          border:2px solid rgba(66,133,244,0.45);
          top:50%;left:50%;transform:translate(-50%,-50%);
          animation:user-dir-ping 2.1s ease-out infinite;
        "></div>

        <!-- Blue dot -->
        <div style="
          position:absolute;width:16px;height:16px;border-radius:50%;
          background:#4285f4;border:2.5px solid #fff;
          box-shadow:0 2px 10px rgba(66,133,244,0.75);
          top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;
        "></div>
      </div>

      <style>
        @keyframes user-dir-ping {
          0%   { opacity: .85; transform: translate(-50%,-50%) scale(.65); }
          100% { opacity: 0;   transform: translate(-50%,-50%) scale(2.5); }
        }
      </style>
    `,
    iconSize: [80, 80],
    iconAnchor: [40, 40],
  });
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
  heading = null,
  gpsAccuracy = null,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);

  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);
  const meshLayerRef = useRef<L.FeatureGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  /** Leaflet circle showing the GPS accuracy radius (the translucent blue area). */
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  // Tracks the last destination node ID whose bounds we fitted, so we only
  // call fitBounds once when a new route is first drawn — never on GPS updates.
  const lastFittedDestRef = useRef<string | null>(null);

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

    // Listen for zoom events to update live zoom percentage display
    newMap.on('zoom zoomend', () => {
      setCurrentZoom(newMap.getZoom());
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
      accuracyCircleRef.current = null;
    };
  }, []); // Run once on mount only

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

  // 3. Update view center when the parent explicitly re-centers (no active route)
  useEffect(() => {
    if (map && route.length === 0) {
      map.setView([latitude, longitude], zoom);
    }
  }, [map, latitude, longitude]);

  // 4. Render Store Markers
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    stores.forEach((store) => {
      if (store.latitude === null || store.longitude === null) return;

      const isSchool = store.id === 'kalawana-national-school-landmark' || store.name.toLowerCase().includes('kalawana');
      const catColor = isSchool ? '#a855f7' : (store.categories?.color || 'var(--color-primary)');
      const isDestination = route.length > 0 && route[route.length - 1].store_id === store.id;

      const customIcon = L.divIcon({
        className: 'custom-map-pin-wrapper',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
            ${isDestination || isSchool ? `
              <div style="
                position: absolute;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: ${catColor};
                opacity: 0.4;
                animation: map-pin-pulse 1.8s infinite ease-in-out;
              "></div>
            ` : ''}
            <div style="
              width: 30px;
              height: 30px;
              border-radius: 50%;
              background: ${catColor};
              border: 2.5px solid #fff;
              box-shadow: 0 2px 10px rgba(0,0,0,0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #fff;
              font-size: ${isSchool ? '0.9rem' : '0.75rem'};
              font-weight: 800;
              z-index: 10;
              overflow: hidden;
            ">
              ${isSchool ? '🏫' : (store.logo_url ? `
                <img src="${store.logo_url}" alt="${store.name}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
              ` : `
                ${store.name[0]}
              `)}
            </div>
          </div>
          <style>
            @keyframes map-pin-pulse {
              0% { transform: scale(0.6); opacity: 0.7; }
              100% { transform: scale(1.6); opacity: 0; }
            }
          </style>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([store.latitude, store.longitude], { icon: customIcon });

      marker.bindPopup(`
        <div style="color: #0b0f1a; padding: 0.3rem; font-family: sans-serif; min-width: 160px;">
          <h4 style="margin: 0 0 0.25rem 0; font-weight: 800; font-size: 0.95rem; line-height: 1.2;">${store.name}</h4>
          <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: #64748b;">
            ${isSchool ? 'GCP2+5C6, Kalawana · Sri Lanka' : `Floor: ${store.floor || '1'} · ${store.categories?.name || 'Exhibitor'}`}
          </p>
          ${isSchool ? `
            <a href="/map3d" style="
              display: block;
              background: linear-gradient(135deg, #a855f7, #6366f1);
              color: #fff;
              padding: 0.4rem;
              border-radius: 6px;
              font-size: 0.75rem;
              font-weight: 700;
              text-decoration: none;
              text-align: center;
              box-shadow: 0 2px 8px rgba(168,85,247,0.3);
            ">🏫 Open 3D School Map</a>
          ` : `
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
          `}
        </div>
      `);

      markersLayer.addLayer(marker);
    });
  }, [map, stores, route]);

  // 5. Render User Location Marker + GPS Accuracy Circle + Compass Direction Cone
  useEffect(() => {
    if (!map) return;

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    if (userLat !== null && userLng !== null) {
      if (gpsAccuracy !== null && gpsAccuracy > 0) {
        accuracyCircleRef.current = L.circle([userLat, userLng], {
          radius: gpsAccuracy,
          color: '#4285f4',
          weight: 1,
          opacity: 0.35,
          fillColor: '#4285f4',
          fillOpacity: 0.09,
          interactive: false,
        }).addTo(map);
      }

      const icon = buildUserDirectionIcon(heading);

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLat, userLng]);
        userMarkerRef.current.setIcon(icon);
      } else {
        userMarkerRef.current = L.marker([userLat, userLng], { icon }).addTo(map);
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }
  }, [map, userLat, userLng, heading, gpsAccuracy]);

  // 6. Render Route Polyline
  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) return;

    routeLayer.clearLayers();

    if (!route || route.length < 2) {
      lastFittedDestRef.current = null;
      return;
    }

    const coordinates = route.map((node) => [node.latitude, node.longitude] as [number, number]);

    const routeCasing = L.polyline(coordinates, {
      color: 'rgba(34, 211, 238, 0.22)',
      weight: 12,
      lineCap: 'round',
      lineJoin: 'round',
    });

    const routeCore = L.polyline(coordinates, {
      color: '#22d3ee',
      weight: 6,
      opacity: 1.0,
      dashArray: '0, 14',
      lineCap: 'round',
      lineJoin: 'round',
    });

    routeLayer.addLayer(routeCasing);
    routeLayer.addLayer(routeCore);

    const destId = route[route.length - 1].id;
    if (destId !== lastFittedDestRef.current) {
      lastFittedDestRef.current = destId;
      map.fitBounds(routeCore.getBounds(), { padding: [60, 60] });
    }
  }, [map, route]);

  // 7. Draw Graph Mesh (Admin only)
  useEffect(() => {
    const meshLayer = meshLayerRef.current;
    if (!map || !meshLayer) return;

    meshLayer.clearLayers();

    if (!showGraphMesh || nodes.length === 0) return;

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
            color: 'rgba(34, 211, 238, 0.45)',
            weight: 2,
            dashArray: '5, 5',
          }
        );
        meshLayer.addLayer(line);
      }
    });

    nodes.forEach((node) => {
      let color = '#94a3b8';
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

  // Zoom Percentage calculation (Max Zoom = 20)
  const zoomPercentage = Math.round((currentZoom / 20) * 100);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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

      {/* Floating Zoom Percentage Display Badge */}
      <div
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.82)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '20px',
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#fff',
          fontSize: '0.75rem',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span style={{ opacity: 0.85, fontSize: '0.8rem' }}>🔍</span>
        <span>{zoomPercentage}% Zoom</span>
      </div>
    </div>
  );
}
