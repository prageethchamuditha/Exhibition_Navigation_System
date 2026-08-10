import { useState } from 'react';
import {
  Settings,
  RotateCcw,
  Save,
  X,
  Maximize2,
  Move,
  Compass,
  ArrowUp,
  Building,
  Plus,
  Trash2,
  Globe,
  Palette,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { type CalibrationConfig, type BuildingConfig, getDefaultBuildings } from './KalawanaSchool3DLayer';

interface Kalawana3DCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CalibrationConfig;
  onChange: (newConfig: CalibrationConfig) => void;
  onSaveAsDefault: () => void;
  onResetDefaults: () => void;
  onCancel: () => void;
}

export function Kalawana3DCalibrationModal({
  isOpen,
  config,
  onChange,
  onSaveAsDefault,
  onResetDefaults,
  onCancel,
}: Kalawana3DCalibrationModalProps) {
  const [activeTab, setActiveTab] = useState<'global' | 'building'>('building');

  if (!isOpen) return null;

  const buildings = config.buildings || getDefaultBuildings();
  const activeBuildings = buildings.filter((b) => !b.isDeleted);
  const selectedId = config.selectedBuildingId || (activeBuildings[0]?.id ?? null);
  const currentBuilding = activeBuildings.find((b) => b.id === selectedId) || activeBuildings[0];

  const handleGlobalSlider = (field: keyof CalibrationConfig, value: number) => {
    onChange({
      ...config,
      [field]: value,
    });
  };

  const handleUpdateBuilding = (updated: Partial<BuildingConfig>) => {
    if (!currentBuilding) return;
    const nextBuildings = buildings.map((b) =>
      b.id === currentBuilding.id ? { ...b, ...updated } : b
    );
    onChange({
      ...config,
      buildings: nextBuildings,
      selectedBuildingId: currentBuilding.id,
    });
  };

  const handleSelectBuilding = (id: string) => {
    onChange({
      ...config,
      selectedBuildingId: id,
    });
  };

  const handleAddBuilding = () => {
    const newId = `b-custom-${Date.now()}`;
    const nextNum = buildings.length + 1;
    const newBuilding: BuildingConfig = {
      id: newId,
      name: `Custom Building #${nextNum}`,
      corners: [
        [380, 260],
        [400, 260],
        [400, 280],
        [380, 280],
      ],
      cat: 'main',
      height: 4.2,
      roof: 'hip',
      scaleMultiplier: 1.0,
      latOffsetMeters: 0,
      lngOffsetMeters: 0,
      altitudeMeters: 0,
      wallColor: '#c9b28a',
      roofColor: '#b0503a',
      isDeleted: false,
    };
    onChange({
      ...config,
      buildings: [...buildings, newBuilding],
      selectedBuildingId: newId,
    });
  };

  const handleDeleteBuilding = () => {
    if (!currentBuilding) return;
    if (!confirm(`Are you sure you want to delete "${currentBuilding.name}"?`)) return;

    const nextBuildings = buildings.map((b) =>
      b.id === currentBuilding.id ? { ...b, isDeleted: true } : b
    );
    const remaining = nextBuildings.filter((b) => !b.isDeleted);
    onChange({
      ...config,
      buildings: nextBuildings,
      selectedBuildingId: remaining[0]?.id ?? null,
    });
  };

  const activeIndex = activeBuildings.findIndex((b) => b.id === currentBuilding?.id);
  const handlePrevBuilding = () => {
    if (activeIndex > 0) {
      handleSelectBuilding(activeBuildings[activeIndex - 1].id);
    }
  };
  const handleNextBuilding = () => {
    if (activeIndex < activeBuildings.length - 1) {
      handleSelectBuilding(activeBuildings[activeIndex + 1].id);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 75,
        left: 16,
        width: 340,
        maxHeight: 'calc(100vh - 90px)',
        overflowY: 'auto',
        background: 'rgba(10, 10, 26, 0.94)',
        backdropFilter: 'blur(18px)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: 16,
        padding: '1.1rem',
        color: '#fff',
        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
        zIndex: 1000,
        pointerEvents: 'auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
          <Settings size={17} color="#a855f7" /> 3D Building Editor
          <span style={{ fontSize: '0.62rem', padding: '0.15rem 0.4rem', borderRadius: 6, background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', color: '#c084fc', fontWeight: 600 }}>Admin</span>
        </div>
        <button
          onClick={onCancel}
          title="Cancel & Revert Changes"
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 6,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3, marginBottom: '0.75rem' }}>
        <button
          onClick={() => setActiveTab('building')}
          style={{
            flex: 1,
            padding: '0.35rem',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'building' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'none',
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Building size={13} /> Building Editor
        </button>
        <button
          onClick={() => setActiveTab('global')}
          style={{
            flex: 1,
            padding: '0.35rem',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'global' ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'none',
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Globe size={13} /> Global Map
        </button>
      </div>

      {activeTab === 'building' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.78rem' }}>
          {/* Building Selection & Add / Delete toolbar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontSize: '0.75rem' }}>Selected Building</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={handleAddBuilding}
                  title="Add New 3D Building"
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: 6,
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#34d399',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Plus size={11} /> Add
                </button>
                {currentBuilding && (
                  <button
                    onClick={handleDeleteBuilding}
                    title="Delete Selected Building"
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6,
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={handlePrevBuilding}
                disabled={activeIndex <= 0}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  padding: 4,
                  borderRadius: 6,
                  cursor: activeIndex > 0 ? 'pointer' : 'default',
                  opacity: activeIndex > 0 ? 1 : 0.4,
                }}
              >
                <ChevronLeft size={14} />
              </button>

              <select
                value={selectedId || ''}
                onChange={(e) => handleSelectBuilding(e.target.value)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(99,102,241,0.4)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                {activeBuildings.map((b) => (
                  <option key={b.id} value={b.id} style={{ background: '#0a0a1a', color: '#fff' }}>
                    {b.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextBuilding}
                disabled={activeIndex >= activeBuildings.length - 1}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  padding: 4,
                  borderRadius: 6,
                  cursor: activeIndex < activeBuildings.length - 1 ? 'pointer' : 'default',
                  opacity: activeIndex < activeBuildings.length - 1 ? 1 : 0.4,
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {currentBuilding && (
            <>
              {/* Building Name Input */}
              <div>
                <label style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 2 }}>
                  Building Display Name
                </label>
                <input
                  type="text"
                  value={currentBuilding.name}
                  onChange={(e) => handleUpdateBuilding({ name: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.75rem',
                  }}
                />
              </div>

              {/* Individual Scale & Height */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Maximize2 size={12} color="#a855f7" /> Scale & Height
                  </span>
                  <span style={{ fontWeight: 700, color: '#a855f7' }}>
                    {((currentBuilding.scaleMultiplier ?? 1.0)).toFixed(2)}x ({(currentBuilding.height * (currentBuilding.scaleMultiplier ?? 1.0)).toFixed(1)}m)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.05"
                  value={currentBuilding.scaleMultiplier ?? 1.0}
                  onChange={(e) => handleUpdateBuilding({ scaleMultiplier: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
                />
              </div>

              {/* Position Offsets (N/S & E/W) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: '#22d3ee', fontSize: '0.72rem' }}>N/S Shift</span>
                    <span style={{ fontWeight: 700, color: '#22d3ee', fontSize: '0.72rem' }}>{currentBuilding.latOffsetMeters ?? 0}m</span>
                  </div>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="0.5"
                    value={currentBuilding.latOffsetMeters ?? 0}
                    onChange={(e) => handleUpdateBuilding({ latOffsetMeters: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: '#22d3ee', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: '#3b82f6', fontSize: '0.72rem' }}>E/W Shift</span>
                    <span style={{ fontWeight: 700, color: '#3b82f6', fontSize: '0.72rem' }}>{currentBuilding.lngOffsetMeters ?? 0}m</span>
                  </div>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="0.5"
                    value={currentBuilding.lngOffsetMeters ?? 0}
                    onChange={(e) => handleUpdateBuilding({ lngOffsetMeters: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Elevation Shift */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ArrowUp size={12} color="#10b981" /> Elevation Offset
                  </span>
                  <span style={{ fontWeight: 700, color: '#10b981' }}>{currentBuilding.altitudeMeters ?? 0}m</span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="20"
                  step="0.5"
                  value={currentBuilding.altitudeMeters ?? 0}
                  onChange={(e) => handleUpdateBuilding({ altitudeMeters: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
                />
              </div>

              {/* Colors (Wall & Roof) */}
              <div>
                <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Palette size={12} color="#ec4899" /> Wall & Roof Colors
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 2 }}>Wall Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="color"
                        value={currentBuilding.wallColor || '#c9b28a'}
                        onChange={(e) => handleUpdateBuilding({ wallColor: e.target.value })}
                        style={{ width: 26, height: 26, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none' }}
                      />
                      <input
                        type="text"
                        value={currentBuilding.wallColor || '#c9b28a'}
                        onChange={(e) => handleUpdateBuilding({ wallColor: e.target.value })}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, padding: '0.2rem', fontSize: '0.7rem' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 2 }}>Roof Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="color"
                        value={currentBuilding.roofColor || '#b0503a'}
                        onChange={(e) => handleUpdateBuilding({ roofColor: e.target.value })}
                        style={{ width: 26, height: 26, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'none' }}
                      />
                      <input
                        type="text"
                        value={currentBuilding.roofColor || '#b0503a'}
                        onChange={(e) => handleUpdateBuilding({ roofColor: e.target.value })}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, padding: '0.2rem', fontSize: '0.7rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Roof Shape Selector */}
              <div>
                <label style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}>Roof Shape / Style</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleUpdateBuilding({ roof: 'hip' })}
                    style={{
                      flex: 1,
                      padding: '0.35rem',
                      borderRadius: 6,
                      border: (currentBuilding.roof ?? 'hip') === 'hip' ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.12)',
                      background: (currentBuilding.roof ?? 'hip') === 'hip' ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    📐 Hip (Pyramid)
                  </button>

                  <button
                    onClick={() => handleUpdateBuilding({ roof: 'flat' })}
                    style={{
                      flex: 1,
                      padding: '0.35rem',
                      borderRadius: 6,
                      border: (currentBuilding.roof ?? 'hip') === 'flat' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.12)',
                      background: (currentBuilding.roof ?? 'hip') === 'flat' ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
                      color: '#fff',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🏢 Flat Roof
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Global Map Calibration Controls */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.8rem' }}>
          {/* Scale Multiplier / Drawing Size */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <Maximize2 size={13} color="#6366f1" /> Campus Scale
              </span>
              <span style={{ fontWeight: 700, color: '#a855f7' }}>{config.scaleMultiplier.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.02"
              value={config.scaleMultiplier}
              onChange={(e) => handleGlobalSlider('scaleMultiplier', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
            />
          </div>

          {/* Rotation Angle */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <Compass size={13} color="#ec4899" /> Rotation Angle
              </span>
              <span style={{ fontWeight: 700, color: '#ec4899' }}>{config.rotationAngle}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={config.rotationAngle}
              onChange={(e) => handleGlobalSlider('rotationAngle', parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: '#ec4899', cursor: 'pointer' }}
            />
          </div>

          {/* N / S Position Offset */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <Move size={13} color="#22d3ee" /> Campus N/S Shift
              </span>
              <span style={{ fontWeight: 700, color: '#22d3ee' }}>{config.latOffsetMeters}m</span>
            </div>
            <input
              type="range"
              min="-300"
              max="300"
              step="1"
              value={config.latOffsetMeters}
              onChange={(e) => handleGlobalSlider('latOffsetMeters', parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: '#22d3ee', cursor: 'pointer' }}
            />
          </div>

          {/* E / W Position Offset */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <Move size={13} color="#3b82f6" /> Campus E/W Shift
              </span>
              <span style={{ fontWeight: 700, color: '#3b82f6' }}>{config.lngOffsetMeters}m</span>
            </div>
            <input
              type="range"
              min="-300"
              max="300"
              step="1"
              value={config.lngOffsetMeters}
              onChange={(e) => handleGlobalSlider('lngOffsetMeters', parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
            />
          </div>

          {/* Altitude Offset */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                <ArrowUp size={13} color="#10b981" /> Campus Elevation
              </span>
              <span style={{ fontWeight: 700, color: '#10b981' }}>{config.altitudeMeters}m</span>
            </div>
            <input
              type="range"
              min="-20"
              max="100"
              step="1"
              value={config.altitudeMeters}
              onChange={(e) => handleGlobalSlider('altitudeMeters', parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      {/* Footer Action Buttons */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem' }}>
        <button
          onClick={onResetDefaults}
          title="Reset to default configuration"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '0.45rem',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={12} /> Reset
        </button>

        <button
          onClick={onCancel}
          title="Cancel & Revert unsaved preview changes"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '0.45rem',
            borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <X size={12} /> Cancel
        </button>

        <button
          onClick={onSaveAsDefault}
          title="Save layout as default configuration"
          style={{
            flex: 1.3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '0.45rem',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            border: 'none',
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          }}
        >
          <Save size={12} /> Save as Default
        </button>
      </div>
    </div>
  );
}
