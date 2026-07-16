import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User, Mail, Phone, Shield, MapPin,
  Navigation, LogOut, Edit2, Check, X, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGPS } from '../hooks/useGPS';
import { GPSPermissionBanner } from '../components/GPSPermissionBanner';

export function ProfilePage() {
  const { user, profile, signOut, updateProfile, loading } = useAuth();
  const { permission, latitude, longitude, accuracy, requestPermission } = useGPS();
  const navigate = useNavigate();

  const [editingName, setEditingName] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      await signOut();
      navigate('/login');
    } catch {
      setSignOutLoading(false);
    }
  };

  const startEditName = () => {
    setNameValue(profile?.name ?? '');
    setEditingName(true);
    setSaveError('');
  };

  const startEditPhone = () => {
    setPhoneValue(profile?.phone ?? '');
    setEditingPhone(true);
    setSaveError('');
  };

  const saveName = async () => {
    if (!nameValue.trim()) { setSaveError('Name cannot be empty.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      await updateProfile({ name: nameValue.trim() });
      setEditingName(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const savePhone = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await updateProfile({ phone: phoneValue.trim() || null as unknown as string });
      setEditingPhone(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const avatarLetter = (profile?.name ?? user?.email ?? 'G')[0].toUpperCase();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  return (
    <>
      {!bannerDismissed && <GPSPermissionBanner onDismiss={() => setBannerDismissed(true)} />}

      <div className="profile-page">
        {/* Back */}
        <Link
          to="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-muted)', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1.5rem' }}
        >
          <ArrowLeft size={16} />
          Back to Map
        </Link>

        {/* Avatar + Name header */}
        <div className="glass" style={{ padding: '1.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="avatar-ring">{avatarLetter}</div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.2 }}>
                {profile?.name ?? 'Visitor'}
              </h1>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                {user?.email ?? 'Guest session'}
              </p>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {profile?.is_anonymous && (
                  <span className="badge badge-anon">Guest</span>
                )}
                <span className={`badge ${profile?.role === 'admin' ? 'badge-admin' : 'badge-visitor'}`}>
                  <Shield size={10} />
                  {profile?.role ?? 'visitor'}
                </span>
                <span className={`badge ${permission === 'granted' ? 'badge-gps-on' : 'badge-gps-off'}`}>
                  <Navigation size={10} />
                  GPS {permission === 'granted' ? 'active' : permission}
                </span>
              </div>
            </div>
          </div>

          {saveError && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {saveError}
            </div>
          )}

          {/* Info rows */}
          <div>
            {/* Name row */}
            <div className="info-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                <User size={15} />
                <span style={{ fontWeight: 600, color: 'var(--color-muted)' }}>Name</span>
              </div>
              {editingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'flex-end' }}>
                  <input
                    id="profile-name-input"
                    className="form-input"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    style={{ maxWidth: 200, padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
                    autoFocus
                  />
                  <button className="btn btn-sm btn-primary" onClick={saveName} disabled={saving} aria-label="Save name">
                    {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Check size={14} />}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditingName(false)} aria-label="Cancel">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.9rem' }}>{profile?.name ?? '—'}</span>
                  {!profile?.is_anonymous && (
                    <button className="btn btn-sm btn-ghost" onClick={startEditName} aria-label="Edit name" style={{ padding: '0.3rem 0.5rem' }}>
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Email row */}
            <div className="info-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                <Mail size={15} />
                <span style={{ fontWeight: 600 }}>Email</span>
              </div>
              <span style={{ fontSize: '0.9rem', color: profile?.is_anonymous ? 'var(--color-muted)' : 'inherit' }}>
                {user?.email ?? 'Not set (guest)'}
              </span>
            </div>

            {/* Phone row */}
            <div className="info-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                <Phone size={15} />
                <span style={{ fontWeight: 600 }}>Phone</span>
              </div>
              {editingPhone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'flex-end' }}>
                  <input
                    id="profile-phone-input"
                    className="form-input"
                    type="tel"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    style={{ maxWidth: 200, padding: '0.4rem 0.75rem', fontSize: '0.875rem' }}
                    autoFocus
                    placeholder="+94 71 234 5678"
                  />
                  <button className="btn btn-sm btn-primary" onClick={savePhone} disabled={saving} aria-label="Save phone">
                    {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Check size={14} />}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditingPhone(false)} aria-label="Cancel">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.9rem', color: profile?.phone ? 'inherit' : 'var(--color-muted)' }}>
                    {profile?.phone ?? 'Not set'}
                  </span>
                  {!profile?.is_anonymous && (
                    <button className="btn btn-sm btn-ghost" onClick={startEditPhone} aria-label="Edit phone" style={{ padding: '0.3rem 0.5rem' }}>
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* GPS Card */}
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Navigation size={16} style={{ color: 'var(--color-accent)' }} />
            Location Status
          </h2>

          {permission === 'granted' && latitude !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginBottom: '0.2rem', fontWeight: 600 }}>LATITUDE</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{latitude.toFixed(6)}</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '0.75rem', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginBottom: '0.2rem', fontWeight: 600 }}>LONGITUDE</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{longitude!.toFixed(6)}</div>
                </div>
              </div>
              {accuracy !== null && (
                <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', textAlign: 'center' }}>
                  Accuracy: ±{Math.round(accuracy)}m · Syncing every 10s
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
                {permission === 'denied'
                  ? 'GPS access denied. Enable it in browser settings to use navigation.'
                  : 'GPS not yet active. Tap the button to start tracking.'}
              </p>
              {permission !== 'denied' && (
                <button className="btn btn-ghost btn-sm" onClick={requestPermission} id="profile-enable-gps">
                  <MapPin size={14} />
                  Enable GPS
                </button>
              )}
            </div>
          )}
        </div>

        {/* Account info */}
        <div className="glass" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={16} style={{ color: 'var(--color-primary-h)' }} />
            Account
          </h2>
          <div className="info-row">
            <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)', fontWeight: 600 }}>Role</span>
            <span className={`badge ${profile?.role === 'admin' ? 'badge-admin' : 'badge-visitor'}`}>
              {profile?.role ?? 'visitor'}
            </span>
          </div>
          <div className="info-row">
            <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)', fontWeight: 600 }}>Member since</span>
            <span style={{ fontSize: '0.875rem' }}>
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : '—'}
            </span>
          </div>
          {profile?.role === 'admin' && (
            <div className="info-row">
              <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)', fontWeight: 600 }}>Admin Console</span>
              <Link to="/admin/dashboard" className="btn btn-sm btn-primary" id="profile-admin-link">
                Go to Admin Panel
              </Link>
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          id="profile-signout"
          className="btn btn-danger btn-full"
          onClick={handleSignOut}
          disabled={signOutLoading}
        >
          {signOutLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <LogOut size={16} />}
          {signOutLoading ? 'Signing out…' : 'Sign Out'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '1.5rem' }}>
          Exhibition Navigation System · v1.0
        </p>
      </div>
    </>
  );
}
