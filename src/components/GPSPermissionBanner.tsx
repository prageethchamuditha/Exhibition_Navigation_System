import { MapPin, AlertTriangle, X } from 'lucide-react';
import { useGPS } from '../hooks/useGPS';

interface GPSPermissionBannerProps {
  onDismiss?: () => void;
}

export function GPSPermissionBanner({ onDismiss }: GPSPermissionBannerProps) {
  const { permission, error, requestPermission } = useGPS();

  // Only show if GPS is denied or errored
  if (permission === 'granted' || permission === 'loading' || permission === 'unavailable') {
    return null;
  }

  return (
    <div className="gps-banner">
      <div className="glass alert alert-warning" style={{ borderRadius: '1rem' }}>
        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, marginBottom: '0.2rem', fontSize: '0.875rem' }}>
            {permission === 'denied' ? 'GPS access denied' : 'GPS not active'}
          </p>
          <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
            {error ?? 'Enable location access to use navigation features.'}
          </p>
          {permission !== 'denied' && (
            <button
              className="btn btn-sm btn-ghost"
              style={{ marginTop: '0.6rem' }}
              onClick={requestPermission}
            >
              <MapPin size={14} />
              Enable GPS
            </button>
          )}
          {permission === 'denied' && (
            <p style={{ fontSize: '0.78rem', opacity: 0.65, marginTop: '0.4rem' }}>
              Go to your browser settings → Site permissions → Location → Allow.
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              opacity: 0.6,
              padding: '0.2rem',
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

