import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { ArrowLeft, Layers, RotateCcw, ZoomIn, ZoomOut, GraduationCap, Navigation, MapPin, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, type Store } from '../lib/supabase';
import {
  createKalawanaSchool3DLayer,
  getSavedCalibration,
  saveCalibration,
  saveCalibrationToSupabase,
  fetchCalibrationFromSupabase,
  DEFAULT_CALIBRATION,
  type KalawanaCustomLayerInterface,
  type CalibrationConfig,
} from '../components/KalawanaSchool3DLayer';
import { Kalawana3DCalibrationModal } from '../components/Kalawana3DCalibrationModal';

// Register the MapLibre GL worker URL
maplibregl.setWorkerUrl(workerUrl as unknown as string);

// ── GCP2+5C6, Kalawana — Coordinates [lng, lat] ─────────────────
// Kalawana National School (Central College), Sabaragamuwa Province, Sri Lanka
const KALAWANA_SCHOOL_CENTER: [number, number] = [80.4010, 6.5355];
const SCHOOL_ZOOM = 18.2;
const SCHOOL_PITCH = 58;
const SCHOOL_BEARING = -15;

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export function Map3DPage() {
  const { profile } = useAuth();
  const isMainAdmin = profile?.role === 'admin';

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const customLayerRef = useRef<KalawanaCustomLayerInterface | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [is3D, setIs3D] = useState(true);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Calibration state
  const [savedCalibration, setSavedCalibration] = useState<CalibrationConfig>(getSavedCalibration());
  const [calibration, setCalibration] = useState<CalibrationConfig>(getSavedCalibration());
  const initialSavedRef = useRef<CalibrationConfig>(getSavedCalibration());
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync calibration from Supabase database on mount for cross-browser consistency
  useEffect(() => {
    fetchCalibrationFromSupabase().then((remoteConfig) => {
      if (remoteConfig) {
        setSavedCalibration(remoteConfig);
        setCalibration(remoteConfig);
        initialSavedRef.current = remoteConfig;
        customLayerRef.current?.setCalibration(remoteConfig, false);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenCalibration = () => {
    if (!isMainAdmin) return;
    const currentSaved = getSavedCalibration();
    initialSavedRef.current = currentSaved;
    setSavedCalibration(currentSaved);
    const activeConfig = { ...currentSaved, showSelectionHighlight: true };
    setCalibration(activeConfig);
    customLayerRef.current?.setCalibration(activeConfig, false);
    setShowCalibrationModal(true);
  };

  const handleCalibrationChange = (newConfig: CalibrationConfig) => {
    const updated = { ...newConfig, showSelectionHighlight: true };
    setCalibration(updated);
    // Live update in memory preview (cache) without saving to storage yet
    customLayerRef.current?.setCalibration(updated, false);
  };

  const handleSaveAsDefault = async () => {
    const cleanConfig = { ...calibration, showSelectionHighlight: false, selectedBuildingId: null };
    saveCalibration(cleanConfig);
    setSavedCalibration(cleanConfig);
    setCalibration(cleanConfig);
    customLayerRef.current?.setCalibration(cleanConfig, true);
    setShowCalibrationModal(false);
    showToast('💾 Saving 3D Calibration to database...');

    const dbSaved = await saveCalibrationToSupabase(cleanConfig);
    if (dbSaved) {
      showToast('✅ Saved globally to database! All browsers updated.');
    } else {
      showToast('⚠️ Saved locally to browser cache.');
    }
  };

  const handleResetDefaults = () => {
    const resetConfig = { ...DEFAULT_CALIBRATION, showSelectionHighlight: true };
    setCalibration(resetConfig);
    customLayerRef.current?.setCalibration(resetConfig, false);
  };

  const handleCancelCalibration = () => {
    const revertTo = initialSavedRef.current || savedCalibration;
    const cleanRevert = { ...revertTo, showSelectionHighlight: false, selectedBuildingId: null };
    setCalibration(cleanRevert);
    customLayerRef.current?.setCalibration(cleanRevert, false);
    setShowCalibrationModal(false);
  };

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
      center: KALAWANA_SCHOOL_CENTER,
      zoom: SCHOOL_ZOOM,
      pitch: SCHOOL_PITCH,
      bearing: SCHOOL_BEARING,
    });

    map.current = m;

    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    m.on('error', (e) => {
      console.error('[MapLibre error]', e);
    });

    m.on('load', () => {
      setMapLoaded(true);

      // ── Dark theme overrides ───────────────────────────────
      if (m.getLayer('background')) {
        m.setPaintProperty('background', 'background-color', '#0d1117');
      }
      if (m.getLayer('water')) {
        m.setPaintProperty('water', 'fill-color', '#0a1628');
      }
      ['highway_minor', 'highway_major_inner', 'highway_major_casing', 'highway_motorway_inner', 'highway_motorway_casing'].forEach((id) => {
        if (m.getLayer(id)) m.setPaintProperty(id, 'line-color', '#1e2a3a');
      });

      if (m.getLayer('building')) {
        m.setPaintProperty('building', 'fill-color', '#1a2035');
        m.setPaintProperty('building', 'fill-outline-color', '#0f3460');
      }

      // ── Three.js Kalawana National School 3D Layer ──────────
      if (!m.getLayer('kalawana-school-3d')) {
        const layer = createKalawanaSchool3DLayer('kalawana-school-3d', calibration);
        customLayerRef.current = layer;

        layer.setSelectedBuildingHandler((buildingId) => {
          if (buildingId) {
            setCalibration((prev) => {
              const updated = { ...prev, selectedBuildingId: buildingId };
              layer.setCalibration(updated, false);
              return updated;
            });
            setShowCalibrationModal(true);
          }
        });

        m.addLayer(layer);
      }



      // ── Kalawana School Grounds Perimeter Boundary ─────────
      m.addSource('school-campus-boundary', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [80.3992, 6.5342],
              [80.4024, 6.5342],
              [80.4024, 6.5365],
              [80.3992, 6.5365],
              [80.3992, 6.5342],
            ]],
          },
        },
      });

      m.addLayer({
        id: 'school-boundary-fill',
        type: 'fill',
        source: 'school-campus-boundary',
        paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.08 },
      });

      m.addLayer({
        id: 'school-boundary-line',
        type: 'line',
        source: 'school-campus-boundary',
        paint: {
          'line-color': '#a855f7',
          'line-width': 3,
          'line-opacity': 0.9,
          'line-dasharray': [4, 2],
        },
      });
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // ── Add store markers & school facility markers ───────────────
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

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
      center: KALAWANA_SCHOOL_CENTER,
      zoom: SCHOOL_ZOOM,
      pitch: SCHOOL_PITCH,
      bearing: SCHOOL_BEARING,
      duration: 1200,
    });
  };

  const toggle3D = () => {
    map.current?.easeTo({ pitch: is3D ? 0 : SCHOOL_PITCH, duration: 800 });
    setIs3D(!is3D);
  };

  const flyToStore = (store: Store) => {
    if (!store.latitude || !store.longitude) return;
    map.current?.flyTo({
      center: [store.longitude, store.latitude],
      zoom: 19,
      pitch: 65,
      bearing: SCHOOL_BEARING,
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
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <GraduationCap size={16} color="#a855f7" /> Kalawana School (3D School)
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <MapPin size={10} color="#22d3ee" /> GCP2+5C6, Kalawana · Sri Lanka
            </div>
          </div>
        </div>

        {isMainAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', pointerEvents: 'auto' }}>
            <button
              onClick={() => {
                if (showCalibrationModal) handleCancelCalibration();
                else handleOpenCalibration();
              }}
              title="Calibrate 3D Model Scale, Position & Rotation (Main Admin Only)"
              style={{
                padding: '0.45rem 0.85rem', borderRadius: 10,
                background: showCalibrationModal
                  ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                  : 'rgba(10,10,26,0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(99,102,241,0.4)', color: '#fff',
                fontSize: '0.78rem', fontWeight: 600,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                cursor: 'pointer',
              }}
            >
              <Settings size={14} color="#a855f7" />
              Calibrate Size/Pos
            </button>
          </div>
        )}
      </div>

      {/* ── Toast notification popup ─────────────────── */}
      {toastMessage && (
        <div style={{
          position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1100, background: 'rgba(16, 185, 129, 0.95)', color: '#fff',
          padding: '0.6rem 1.2rem', borderRadius: 10, backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)', fontWeight: 600, fontSize: '0.85rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          {toastMessage}
        </div>
      )}

      {/* ── Calibration Control Floating Panel (Main Admin Only) ─────── */}
      {isMainAdmin && (
        <Kalawana3DCalibrationModal
          isOpen={showCalibrationModal}
          onClose={handleCancelCalibration}
          config={calibration}
          onChange={handleCalibrationChange}
          onSaveAsDefault={handleSaveAsDefault}
          onResetDefaults={handleResetDefaults}
          onCancel={handleCancelCalibration}
        />
      )}

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
          }}>🏫</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>
            Loading 3D School…
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
            GCP2+5C6, Kalawana · Sri Lanka
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
