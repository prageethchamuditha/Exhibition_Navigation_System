import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeft, Layers, RotateCcw, ZoomIn, ZoomOut, Building2, Navigation } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, type Store } from '../lib/supabase';

// University of Moratuwa — center coordinates [lng, lat]
const UOM_CENTER: [number, number] = [79.9003, 6.7967];
const UOM_ZOOM = 17;
const UOM_PITCH = 58;
const UOM_BEARING = -20;

// Free OpenFreeMap vector tiles — positron (light/neutral base we'll override to dark)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export function Map3DPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // ── Load stores from Supabase ────────────────────────────────
  useEffect(() => {
    supabase
      .from('stores')
      .select('*, categories:category_id(id, name, color)')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .then(({ data }) => {
        if (data) setStores(data as Store[]);
      });
  }, []);

  // ── Initialise MapLibre map ──────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: UOM_CENTER,
      zoom: UOM_ZOOM,
      pitch: UOM_PITCH,
      bearing: UOM_BEARING,
      antialias: true,
    });

    map.current = m;

    // Compass + zoom controls
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    m.on('load', () => {
      setMapLoaded(true);

      // ── Override base map colours to dark theme ───────────────
      if (m.getLayer('background')) {
        m.setPaintProperty('background', 'background-color', '#0d1117');
      }
      if (m.getLayer('water')) {
        m.setPaintProperty('water', 'fill-color', '#0a1628');
      }
      ['road_minor', 'road_secondary_tertiary', 'road_trunk_primary', 'road_motorway'].forEach((id) => {
        if (m.getLayer(id)) m.setPaintProperty(id, 'line-color', '#1e2a3a');
      });

      // ── Recolour the existing building-3d layer ───────────────
      if (m.getLayer('building-3d')) {
        m.setPaintProperty('building-3d', 'fill-extrusion-color', '#16213e');
        m.setPaintProperty('building-3d', 'fill-extrusion-opacity', 0.9);
      }
      if (m.getLayer('building')) {
        m.setPaintProperty('building', 'fill-color', '#1a2035');
        m.setPaintProperty('building', 'fill-outline-color', '#0f3460');
      }

      // ── Purple roof highlight (thin layer on top of buildings) ─
      m.addLayer({
        id: 'uom-buildings-roof',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#6366f1',
          'fill-extrusion-height': ['+', ['coalesce', ['get', 'render_height'], 8], 0.5],
          'fill-extrusion-base': ['coalesce', ['get', 'render_height'], 8],
          'fill-extrusion-opacity': 0.6,
        },
      });

      // ── UoM campus boundary polygon ───────────────────────────
      m.addSource('uom-campus', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [79.8975, 6.7950],
              [79.9035, 6.7950],
              [79.9040, 6.7985],
              [79.8978, 6.7988],
              [79.8975, 6.7950],
            ]],
          },
        },
      });

      m.addLayer({
        id: 'uom-campus-fill',
        type: 'fill',
        source: 'uom-campus',
        paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.05 },
      });

      m.addLayer({
        id: 'uom-campus-outline',
        type: 'line',
        source: 'uom-campus',
        paint: {
          'line-color': '#6366f1',
          'line-width': 2.5,
          'line-opacity': 0.8,
          'line-dasharray': [4, 3],
        },
      });
    }); // ← end of m.on('load', ...)

    return () => {
      m.remove();
      map.current = null;
    };
  }, []); // ← end of useEffect

  // ── Add store markers once map + stores are ready ────────────
  useEffect(() => {
    if (!mapLoaded || !map.current || stores.length === 0) return;

    // Remove old markers
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    stores.forEach((store) => {
      if (!store.latitude || !store.longitude) return;

      const el = document.createElement('div');
      el.style.cssText = `
        width: 36px; height: 36px; border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #a855f7);
        border: 2.5px solid rgba(255,255,255,0.8);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; box-shadow: 0 4px 16px rgba(99,102,241,0.55);
        font-size: 14px; color: white; font-weight: 700;
        transition: transform 0.2s;
      `;
      el.textContent = (store.name?.[0] ?? '?').toUpperCase();
      el.title = store.name;

      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.25)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
      el.addEventListener('click', () => setSelectedStore(store));

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([store.longitude, store.latitude])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [mapLoaded, stores]);

  // ── Controls ─────────────────────────────────────────────────
  const resetView = () => {
    map.current?.flyTo({
      center: UOM_CENTER,
      zoom: UOM_ZOOM,
      pitch: UOM_PITCH,
      bearing: UOM_BEARING,
      duration: 1200,
    });
  };

  const toggle3D = () => {
    map.current?.easeTo({ pitch: is3D ? 0 : UOM_PITCH, duration: 800 });
    setIs3D(!is3D);
  };

  const flyToStore = (store: Store) => {
    if (!store.latitude || !store.longitude) return;
    map.current?.flyTo({
      center: [store.longitude, store.latitude],
      zoom: 19,
      pitch: 65,
      bearing: UOM_BEARING,
      duration: 1400,
    });
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0a0a1a' }}>

      {/* Map container */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* ── Top bar ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 16, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.75rem', pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', pointerEvents: 'auto' }}>
          <Link
            to="/map"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.9rem', borderRadius: 10,
              background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
              textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
          >
            <ArrowLeft size={15} /> Back to Map
          </Link>

          <div style={{
            padding: '0.45rem 1rem', borderRadius: 10,
            background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(99,102,241,0.35)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>
              🎓 University of Moratuwa
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
              3D Campus View · Exhibition Navigation
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', pointerEvents: 'auto' }}>
          <div style={{
            padding: '0.45rem 0.85rem', borderRadius: 10,
            background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
            fontSize: '0.78rem', fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <Building2 size={13} color="#a855f7" />
            {stores.length} Exhibitors
          </div>
        </div>
      </div>

      {/* ── Left control buttons ─────────────────────── */}
      <div style={{
        position: 'absolute', top: '50%', left: 16,
        transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        {[
          { icon: <ZoomIn size={16} />, title: 'Zoom In', onClick: () => map.current?.zoomIn() },
          { icon: <ZoomOut size={16} />, title: 'Zoom Out', onClick: () => map.current?.zoomOut() },
          { icon: <RotateCcw size={16} />, title: 'Reset View', onClick: resetView },
          { icon: <Layers size={16} />, title: is3D ? 'Switch to 2D' : 'Switch to 3D', onClick: toggle3D, active: is3D },
        ].map((btn, i) => (
          <button
            key={i}
            title={btn.title}
            onClick={btn.onClick}
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: btn.active
                ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                : 'rgba(10,10,26,0.85)',
              backdropFilter: 'blur(12px)',
              border: btn.active
                ? '1px solid rgba(99,102,241,0.5)'
                : '1px solid rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              transition: 'all 0.2s',
            }}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* ── Bottom exhibitor pill bar ─────────────────── */}
      {stores.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 16, left: 16, right: 60,
          background: 'rgba(10,10,26,0.88)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
          padding: '0.75rem 1rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          maxHeight: 110, overflowX: 'auto', overflowY: 'hidden',
        }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', minWidth: 'max-content' }}>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              EXHIBITORS
            </span>
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => { setSelectedStore(store); flyToStore(store); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.8rem', borderRadius: 20,
                  background: selectedStore?.id === store.id
                    ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                    : 'rgba(255,255,255,0.07)',
                  border: selectedStore?.id === store.id
                    ? '1px solid rgba(99,102,241,0.5)'
                    : '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                  whiteSpace: 'nowrap', transition: 'all 0.2s',
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 800,
                }}>
                  {store.name?.[0]?.toUpperCase()}
                </span>
                {store.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Selected store info card ──────────────────── */}
      {selectedStore && (
        <div style={{
          position: 'absolute', top: 80, right: 16, width: 260,
          background: 'rgba(10,10,26,0.92)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99,102,241,0.35)', borderRadius: 14,
          padding: '1rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          animation: 'fadeInRight 0.25s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 800, color: '#fff',
            }}>
              {selectedStore.name?.[0]?.toUpperCase()}
            </div>
            <button
              onClick={() => setSelectedStore(null)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
            >×</button>
          </div>

          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: 4 }}>
            {selectedStore.name}
          </div>

          {selectedStore.description && (
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              {selectedStore.description.slice(0, 100)}{selectedStore.description.length > 100 ? '…' : ''}
            </div>
          )}

          {selectedStore.floor && (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.75rem' }}>
              📍 Floor {selectedStore.floor}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => flyToStore(selectedStore)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                padding: '0.45rem', borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                border: 'none', color: '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              <Navigation size={13} /> Fly To
            </button>
            <Link
              to={`/stores/${selectedStore.id}`}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0.45rem', borderRadius: 8,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontWeight: 600, fontSize: '0.78rem', textDecoration: 'none',
              }}
            >
              Details
            </Link>
          </div>
        </div>
      )}

      {/* ── Loading overlay ───────────────────────────── */}
      {!mapLoaded && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#0a0a1a', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1rem',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem',
          }}>🎓</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
            Loading 3D Campus…
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
            University of Moratuwa · OpenStreetMap
          </div>
          <div className="spinner" style={{ width: 28, height: 28, borderTopColor: '#6366f1', marginTop: 8 }} />
        </div>
      )}

      <style>{`
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .maplibregl-ctrl-group {
          background: rgba(10,10,26,0.85) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          backdrop-filter: blur(12px) !important;
          border-radius: 10px !important;
        }
        .maplibregl-ctrl-group button {
          background: none !important;
          border-bottom-color: rgba(255,255,255,0.1) !important;
        }
        .maplibregl-ctrl-group button span { filter: invert(1) !important; }
        .maplibregl-ctrl-compass { filter: invert(1) !important; }
        .maplibregl-ctrl-attrib {
          background: rgba(10,10,26,0.7) !important;
          color: rgba(255,255,255,0.4) !important;
          font-size: 10px !important;
          border-radius: 6px !important;
        }
        .maplibregl-ctrl-attrib a { color: rgba(255,255,255,0.5) !important; }
      `}</style>
    </div>
  );
}
