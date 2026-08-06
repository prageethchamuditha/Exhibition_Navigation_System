import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre GL v6 + Vite: must set worker URL before any Map instance is created.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { type Store, type NavigationNode, type NavigationEdge } from '../lib/supabase';
import { createKalawanaSchool3DLayer } from './KalawanaSchool3DLayer';

// Register worker — safe to call multiple times (idempotent)
maplibregl.setWorkerUrl(workerUrl as unknown as string);

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

interface MapView3DProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  stores?: Store[];
  userLat?: number | null;
  userLng?: number | null;
  route?: NavigationNode[];
  showGraphMesh?: boolean;
  nodes?: NavigationNode[];
  edges?: NavigationEdge[];
}

export function MapView3D({
  latitude,
  longitude,
  zoom = 18,
  stores = [],
  userLat = null,
  userLng = null,
  route = [],
  showGraphMesh = false,
  nodes = [],
  edges = [],
}: MapView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const storeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastFittedDestRef = useRef<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);

  // ── 1. Initialise MapLibre map (once on mount) ───────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const m = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [longitude, latitude],
      zoom,
      pitch: 55,
      bearing: -15,
      attributionControl: false,
    });

    mapRef.current = m;

    m.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      'bottom-right'
    );

    m.on('zoom', () => {
      setCurrentZoom(m.getZoom());
    });

    m.on('error', (e) => console.error('[MapView3D]', e));

    m.on('load', () => {
      // ── Dark theme overrides ─────────────────────────────────
      if (m.getLayer('background'))
        m.setPaintProperty('background', 'background-color', '#0d1117');
      if (m.getLayer('water'))
        m.setPaintProperty('water', 'fill-color', '#0a1628');
      [
        'highway_minor',
        'highway_major_inner',
        'highway_major_casing',
        'highway_motorway_inner',
        'highway_motorway_casing',
      ].forEach((id) => {
        if (m.getLayer(id)) m.setPaintProperty(id, 'line-color', '#1e2a3a');
      });
      if (m.getLayer('building')) {
        m.setPaintProperty('building', 'fill-color', '#1a2035');
        m.setPaintProperty('building', 'fill-outline-color', '#0f3460');
      }

      // ── Three.js Kalawana National School 3D Layer ──────────
      if (!m.getLayer('kalawana-school-3d')) {
        m.addLayer(createKalawanaSchool3DLayer('kalawana-school-3d'));
      }

      setMapLoaded(true);
    });

    return () => {
      m.remove();
      mapRef.current = null;
      storeMarkersRef.current = [];
      userMarkerRef.current = null;
      setMapLoaded(false);
    };
  }, []); // Run once on mount

  // ── 2. Update view center when parent explicitly re-centers ───
  useEffect(() => {
    const m = mapRef.current;
    if (m && mapLoaded && route.length === 0) {
      m.flyTo({ center: [longitude, latitude], zoom, speed: 1.2 });
    }
  }, [latitude, longitude, zoom, mapLoaded, route.length]);

  // ── 3. Render Store Markers ──────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapLoaded) return;

    storeMarkersRef.current.forEach((mk) => mk.remove());
    storeMarkersRef.current = [];

    stores.forEach((store) => {
      if (store.latitude === null || store.longitude === null) return;

      const isSchool =
        store.id === 'kalawana-national-school-landmark' ||
        store.name.toLowerCase().includes('kalawana');
      const catColor = isSchool
        ? '#a855f7'
        : store.categories?.color || 'var(--color-primary)';
      const isDestination =
        route.length > 0 && route[route.length - 1].store_id === store.id;

      const el = document.createElement('div');
      el.className = 'custom-map-pin-wrapper';
      el.style.cssText =
        'position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:34px;cursor:pointer;';
      el.innerHTML = `
        ${
          isDestination || isSchool
            ? `<div style="position:absolute;width:48px;height:48px;border-radius:50%;background:${catColor};opacity:0.4;animation:map-pin-pulse 1.8s infinite ease-in-out;"></div>`
            : ''
        }
        <div style="width:30px;height:30px;border-radius:50%;background:${catColor};border:2.5px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${
          isSchool ? '0.9rem' : '0.75rem'
        };font-weight:800;z-index:10;overflow:hidden;">
          ${
            isSchool
              ? '🏫'
              : store.logo_url
              ? `<img src="${store.logo_url}" alt="${store.name}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
              : store.name[0]
          }
        </div>
      `;

      const popupHtml = `
        <div style="color:#0b0f1a;padding:0.3rem;font-family:sans-serif;min-width:160px;">
          <h4 style="margin:0 0 0.25rem 0;font-weight:800;font-size:0.95rem;line-height:1.2;">${
            store.name
          }</h4>
          <p style="margin:0 0 0.5rem 0;font-size:0.75rem;color:#64748b;">
            ${
              isSchool
                ? 'GCP2+5C6, Kalawana · Sri Lanka'
                : `Floor: ${store.floor || '1'} · ${
                    store.categories?.name || 'Exhibitor'
                  }`
            }
          </p>
          ${
            isSchool
              ? `<span style="display:block;background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;padding:0.4rem;border-radius:6px;font-size:0.75rem;font-weight:700;text-align:center;">🏫 3D Kalawana Landmark</span>`
              : `<a href="/stores/${store.id}" style="display:block;background:#6366f1;color:#fff;padding:0.35rem;border-radius:4px;font-size:0.75rem;font-weight:700;text-decoration:none;text-align:center;">View Profile</a>`
          }
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 20 }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([store.longitude, store.latitude])
        .setPopup(popup)
        .addTo(m);

      storeMarkersRef.current.push(marker);
    });
  }, [mapLoaded, stores, route]);

  // ── 4. Render User Location Marker ───────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapLoaded) return;

    if (userLat !== null && userLng !== null) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([userLng, userLat]);
      } else {
        const el = document.createElement('div');
        el.style.cssText = 'position:relative;width:14px;height:14px;';
        el.innerHTML = `
          <div style="width:14px;height:14px;border-radius:50%;background:#22d3ee;border:2px solid #fff;box-shadow:0 0 6px rgba(34,211,238,0.6);"></div>
          <div class="mv3d-user-dot" style="position:absolute;inset:-8px;border-radius:50%;border:2px solid rgba(34,211,238,0.4);"></div>
        `;
        userMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([userLng, userLat])
          .addTo(m);
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }
  }, [mapLoaded, userLat, userLng]);

  // ── 5. Render Route Polyline ──────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapLoaded) return;

    const sourceId = 'route-source';
    const casingId = 'route-casing-layer';
    const coreId = 'route-core-layer';

    if (m.getLayer(coreId)) m.removeLayer(coreId);
    if (m.getLayer(casingId)) m.removeLayer(casingId);
    if (m.getSource(sourceId)) m.removeSource(sourceId);

    if (!route || route.length < 2) {
      lastFittedDestRef.current = null;
      return;
    }

    const coords = route.map((n) => [n.longitude, n.latitude]);

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    };

    m.addSource(sourceId, { type: 'geojson', data: geojson });

    m.addLayer({
      id: casingId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#22d3ee', 'line-width': 14, 'line-opacity': 0.2 },
    });

    m.addLayer({
      id: coreId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#22d3ee',
        'line-width': 6,
        'line-dasharray': [0, 2],
      },
    });

    const destId = route[route.length - 1].id;
    if (destId !== lastFittedDestRef.current) {
      lastFittedDestRef.current = destId;
      const bounds = coords.reduce(
        (b, c) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
      );
      m.fitBounds(bounds, { padding: 80, maxZoom: 19 });
    }
  }, [mapLoaded, route]);

  // ── 6. Render Graph Mesh (Admin only) ─────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapLoaded) return;

    const sourceId = 'mesh-source';
    ['mesh-edges', 'mesh-nodes'].forEach((id) => {
      if (m.getLayer(id)) m.removeLayer(id);
    });
    if (m.getSource(sourceId)) m.removeSource(sourceId);

    if (!showGraphMesh || nodes.length === 0) return;

    const features: GeoJSON.Feature[] = [];

    edges.forEach((edge) => {
      const fromN = nodes.find((n) => n.id === edge.from_node_id);
      const toN = nodes.find((n) => n.id === edge.to_node_id);
      if (fromN && toN) {
        features.push({
          type: 'Feature',
          properties: { kind: 'edge' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [fromN.longitude, fromN.latitude],
              [toN.longitude, toN.latitude],
            ],
          },
        });
      }
    });

    nodes.forEach((n) => {
      features.push({
        type: 'Feature',
        properties: { kind: 'node', label: n.label, type: n.type },
        geometry: { type: 'Point', coordinates: [n.longitude, n.latitude] },
      });
    });

    m.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });

    m.addLayer({
      id: 'mesh-edges',
      type: 'line',
      source: sourceId,
      filter: ['==', ['get', 'kind'], 'edge'],
      paint: {
        'line-color': '#22d3ee',
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.5,
      },
    });

    m.addLayer({
      id: 'mesh-nodes',
      type: 'circle',
      source: sourceId,
      filter: ['==', ['get', 'kind'], 'node'],
      paint: {
        'circle-radius': 5.5,
        'circle-color': [
          'match',
          ['get', 'type'],
          'entrance',
          '#22d3ee',
          'poi',
          '#a78bfa',
          'store',
          '#34d399',
          'emergency',
          '#f43f5e',
          '#94a3b8',
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.9,
      },
    });
  }, [mapLoaded, showGraphMesh, nodes, edges]);

  // Zoom Percentage calculation (Max Zoom = 20)
  const zoomPercentage = Math.round((currentZoom / 20) * 100);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Pulsing animation for user dot */}
      <style>{`
        .mv3d-user-dot {
          animation: mv3d-ping 1.6s infinite ease-out;
        }
        @keyframes mv3d-ping {
          0%   { box-shadow: 0 0 0 0   rgba(34,211,238,0.55), 0 0 6px rgba(34,211,238,0.6); }
          70%  { box-shadow: 0 0 0 12px rgba(34,211,238,0),   0 0 6px rgba(34,211,238,0.6); }
          100% { box-shadow: 0 0 0 0   rgba(34,211,238,0),   0 0 6px rgba(34,211,238,0.6); }
        }
        /* Match Leaflet MapView style on the MapLibre controls */
        .mv3d-wrap .maplibregl-ctrl-group {
          background: rgba(10,10,26,0.85) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          backdrop-filter: blur(12px) !important;
          border-radius: 10px !important;
        }
        .mv3d-wrap .maplibregl-ctrl-group button { background: none !important; }
        .mv3d-wrap .maplibregl-ctrl-group button span { filter: invert(1) !important; }
        .mv3d-wrap .maplibregl-ctrl-compass { filter: invert(1) !important; }
      `}</style>

      <div
        ref={containerRef}
        className="mv3d-wrap"
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
