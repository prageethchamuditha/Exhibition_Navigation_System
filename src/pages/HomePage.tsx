import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Navigation,
  User,
  Store,
  LogOut,
  CalendarDays,
  ArrowRight,
  Star,
  Search,
  Bell,
} from 'lucide-react';
import { supabase, type Exhibition, type Store as StoreType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { GPSPermissionBanner } from '../components/GPSPermissionBanner';

export function HomePage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUnread = (e: Event) => {
      setUnreadNotifications((e as CustomEvent).detail);
    };
    window.addEventListener('announcements-unread-count', handleUnread);
    window.dispatchEvent(new CustomEvent('request-announcements-unread-count'));

    return () => {
      window.removeEventListener('announcements-unread-count', handleUnread);
    };
  }, []);

  const handleOpenAnnouncements = () => {
    window.dispatchEvent(new CustomEvent('open-announcements-history'));
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      // Fetch both active exhibitions and stores concurrently
      const [exhibitionsRes, storesRes] = await Promise.all([
        supabase
          .from('exhibitions')
          .select('*')
          .eq('is_active', true)
          .order('is_featured', { ascending: false })
          .limit(4),
        supabase
          .from('stores')
          .select(`
            *,
            categories:category_id (id, name, color),
            exhibitions:exhibition_id (id, title)
          `)
          .eq('is_active', true)
          .limit(6),
      ]);

      setExhibitions(exhibitionsRes.data || []);
      setStores(storesRes.data || []);
    } catch (err) {
      console.error('Error loading homepage dashboard resources:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <>
      <GPSPermissionBanner />
      <div className="profile-page" style={{ maxWidth: 840, paddingBottom: '3rem' }}>
        
        {/* Brand Welcome Banner */}
        <header className="glass home-header" style={{
          padding: '2.25rem 2rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle background glow effect */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'var(--color-primary)',
            filter: 'blur(60px)',
            opacity: 0.4,
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <div className="brand-icon" style={{ width: 60, height: 60, borderRadius: '14px', flexShrink: 0 }}>
              <MapPin size={28} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                Exhibition Navigator
              </h1>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.925rem', marginTop: '0.2rem' }}>
                Welcome, {profile?.name || 'Visitor'}! Navigate booths, explore promos, and view schedules.
              </p>
            </div>
          </div>

          <div className="home-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Link to="/search" className="btn btn-ghost btn-sm">
              <Search size={14} style={{ marginRight: 4 }} />
              Search Directory
            </Link>
            <button
              onClick={handleOpenAnnouncements}
              className="btn btn-ghost btn-sm btn-icon"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="View Announcements"
            >
              <Bell size={16} />
              {unreadNotifications > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '1px',
                  right: '1px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 4px #ef4444',
                }} />
              )}
            </button>
            <Link to="/profile" className="btn btn-ghost btn-sm">
              <User size={14} style={{ marginRight: 4 }} />
              My Profile
            </Link>
            <button className="btn btn-danger btn-sm" onClick={handleSignOut}>
              <LogOut size={14} style={{ marginRight: 4 }} />
              Sign Out
            </button>
          </div>
        </header>

        {/* Primary Call-to-Action: Open Map button */}
        <section className="glass home-map-cta" style={{
          padding: '1.5rem 1.75rem',
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(34,211,238,0.06) 100%)',
          borderColor: 'rgba(99,102,241,0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Interactive Floor Map</h2>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Locate stores, draw routes, and track your GPS location in real time.
            </p>
          </div>
          <Link to="/map" className="btn btn-primary" style={{ padding: '0.65rem 1.25rem', gap: '0.4rem' }}>
            <Navigation size={15} style={{ transform: 'rotate(45deg)' }} />
            Open Map
            <ArrowRight size={14} />
          </Link>
        </section>

        {/* Main Dashboard Panels Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          
          {/* Exhibitions Panel */}
          <section className="glass" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Featured Exhibitions</h3>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem', margin: 0 }}>Discover ongoing events & summits</p>
              </div>
              <Link to="/exhibitions" style={{ fontSize: '0.8rem', color: 'var(--color-primary-h)', fontWeight: 600, textDecoration: 'none' }}>
                View All Events →
              </Link>
            </div>

            {loading ? (
              <div className="spinner" style={{ margin: '2rem auto' }} />
            ) : exhibitions.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                No active exhibitions found.
              </p>
            ) : (
              <div className="home-grid-exhibitions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {exhibitions.map((ex) => (
                  <Link
                    key={ex.id}
                    to={`/exhibitions/${ex.id}`}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '1rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'flex',
                      gap: '0.875rem',
                      alignItems: 'center',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  >
                    {ex.image_url ? (
                      <img src={ex.image_url} alt="" style={{ width: 44, height: 44, borderRadius: '6px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: '6px', background: 'var(--color-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CalendarDays size={18} color="var(--color-muted)" />
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ex.title}
                        </h4>
                        {ex.is_featured && <Star size={11} fill="var(--color-warning)" color="var(--color-warning)" />}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                        {ex.location || 'Exhibition Area'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Active Stores Panel */}
          <section className="glass" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Participant Exhibitors</h3>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem', margin: 0 }}>Browse directory and booths list</p>
              </div>
              <Link to="/stores" style={{ fontSize: '0.8rem', color: 'var(--color-primary-h)', fontWeight: 600, textDecoration: 'none' }}>
                View All Stores →
              </Link>
            </div>

            {loading ? (
              <div className="spinner" style={{ margin: '2rem auto' }} />
            ) : stores.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
                No active stores found.
              </p>
            ) : (
              <div className="home-grid-stores" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                {stores.map((st) => (
                  <Link
                    key={st.id}
                    to={`/stores/${st.id}`}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      padding: '1rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'center',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  >
                    {st.logo_url ? (
                      <img src={st.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: '6px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '6px', background: 'var(--color-surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Store size={16} color="var(--color-muted)" />
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {st.name}
                      </h4>
                      <span style={{ fontSize: '0.725rem', color: 'var(--color-muted)' }}>
                        Floor {st.floor || '1'} {st.categories ? `· ${st.categories.name}` : ''}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </>
  );
}
