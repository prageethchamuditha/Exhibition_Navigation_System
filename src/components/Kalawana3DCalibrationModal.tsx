import { Settings, RotateCcw, Save, X, Maximize2, Move, Compass, ArrowUp } from 'lucide-react';
import {
  type CalibrationConfig,
  DEFAULT_CALIBRATION,
} from './KalawanaSchool3DLayer';

interface Kalawana3DCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CalibrationConfig;
  onChange: (newConfig: CalibrationConfig) => void;
}

export function Kalawana3DCalibrationModal({
  isOpen,
  onClose,
  config,
  onChange,
}: Kalawana3DCalibrationModalProps) {
  if (!isOpen) return null;

  const handleSlider = (field: keyof CalibrationConfig, value: number) => {
    onChange({
      ...config,
      [field]: value,
    });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_CALIBRATION });
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: 16,
        width: 320,
        background: 'rgba(10, 10, 26, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: 16,
        padding: '1.2rem',
        color: '#fff',
        boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
        zIndex: 1000,
        pointerEvents: 'auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
          <Settings size={17} color="#a855f7" /> 3D Model Calibration
        </div>
        <button
          onClick={onClose}
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.8rem' }}>

        {/* Scale Multiplier / Drawing Size */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <Maximize2 size={13} color="#6366f1" /> Drawing Size (Scale)
            </span>
            <span style={{ fontWeight: 700, color: '#a855f7' }}>{config.scaleMultiplier.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="3.0"
            step="0.02"
            value={config.scaleMultiplier}
            onChange={(e) => handleSlider('scaleMultiplier', parseFloat(e.target.value))}
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
            onChange={(e) => handleSlider('rotationAngle', parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#ec4899', cursor: 'pointer' }}
          />
        </div>

        {/* N / S Position Offset */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <Move size={13} color="#22d3ee" /> N/S Offset (North + / South -)
            </span>
            <span style={{ fontWeight: 700, color: '#22d3ee' }}>{config.latOffsetMeters}m</span>
          </div>
          <input
            type="range"
            min="-300"
            max="300"
            step="1"
            value={config.latOffsetMeters}
            onChange={(e) => handleSlider('latOffsetMeters', parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#22d3ee', cursor: 'pointer' }}
          />
        </div>

        {/* E / W Position Offset */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <Move size={13} color="#3b82f6" /> E/W Offset (East + / West -)
            </span>
            <span style={{ fontWeight: 700, color: '#3b82f6' }}>{config.lngOffsetMeters}m</span>
          </div>
          <input
            type="range"
            min="-300"
            max="300"
            step="1"
            value={config.lngOffsetMeters}
            onChange={(e) => handleSlider('lngOffsetMeters', parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
          />
        </div>

        {/* Altitude Offset */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <ArrowUp size={13} color="#10b981" /> Elevation Offset
            </span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>{config.altitudeMeters}m</span>
          </div>
          <input
            type="range"
            min="-20"
            max="100"
            step="1"
            value={config.altitudeMeters}
            onChange={(e) => handleSlider('altitudeMeters', parseInt(e.target.value, 10))}
            style={{ width: '100%', accentColor: '#10b981', cursor: 'pointer' }}
          />
        </div>

      </div>

      {/* Footer Action Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem' }}>
        <button
          onClick={handleReset}
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
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={12} /> Reset Defaults
        </button>

        <button
          onClick={onClose}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '0.45rem',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            border: 'none',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Save size={12} /> Done / Save
        </button>
      </div>
    </div>
  );
}
