import { useEffect, useState } from 'react';
import { Search, MapPin, Activity } from 'lucide-react';
import { supabase, type Profile, type VisitorLocation } from '../../lib/supabase';
import { AdminTable } from '../../components/admin/AdminTable';

interface EnhancedVisitorProfile extends Profile {
  location?: VisitorLocation | null;
}

export function AdminVisitorsPage() {
  const [visitors, setVisitors] = useState<EnhancedVisitorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchVisitorsAndLocations();

    // Subscribe to visitor location updates in real-time
    const channelName = `live-visitors-${Math.random().toString(36).substring(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitor_locations' },
        () => {
          // Re-fetch when locations change
          fetchVisitorsAndLocations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchVisitorsAndLocations() {
    try {
      const [profilesRes, locationsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('visitor_locations').select('*').order('updated_at', { ascending: false }),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const profileList = profilesRes.data || [];
      const locationList = locationsRes.data || [];

      // Link locations to profiles
      const enhanced: EnhancedVisitorProfile[] = profileList.map((p) => {
        const loc = locationList.find((l) => l.user_id === p.id);
        return {
          ...p,
          location: loc || null,
        };
      });

      setVisitors(enhanced);
    } catch (err) {
      console.error('Error fetching visitors:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredVisitors = visitors.filter((v) =>
    (v.name && v.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.phone && v.phone.includes(searchQuery))
  );

  const columns = [
    {
      key: 'name',
      label: 'Visitor Name',
      render: (row: EnhancedVisitorProfile) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name || 'Anonymous Visitor'}</div>
          {row.phone && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{row.phone}</div>}
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Account Role',
      render: (row: EnhancedVisitorProfile) => (
        <span className={`badge badge-${row.role}`}>
          {row.role}
        </span>
      ),
    },
    {
      key: 'type',
      label: 'Session Type',
      render: (row: EnhancedVisitorProfile) => (
        <span className={`badge ${row.is_anonymous ? 'badge-anon' : 'badge-info'}`}>
          {row.is_anonymous ? 'Guest Session' : 'Registered'}
        </span>
      ),
    },
    {
      key: 'location',
      label: 'Last Known Location',
      render: (row: EnhancedVisitorProfile) => {
        const loc = row.location;
        return loc ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.825rem' }}>
            <MapPin size={12} color="var(--color-primary-h)" />
            {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}{' '}
            {loc.accuracy ? `(±${Math.round(loc.accuracy)}m)` : ''}
          </span>
        ) : (
          <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>No GPS coordinates</span>
        );
      },
    },
    {
      key: 'updated_at',
      label: 'Last Active',
      render: (row: EnhancedVisitorProfile) => {
        const dateVal = row.location?.updated_at || row.updated_at;
        return (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            {new Date(dateVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        );
      },
    },
  ];

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Visitor Logs & Real-Time GPS Tracking</h1>
          <p>Monitor live positions, coordinates, and registrations</p>
        </div>
        <div
          className="badge badge-success"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
          }}
        >
          <Activity size={14} className="spinner" style={{ animationDuration: '2s', borderTopColor: 'var(--color-success)' }} />
          Live GPS Monitoring Active
        </div>
      </header>

      {/* Table Toolbar */}
      <section className="data-table-wrap">
        <div className="data-table-toolbar">
          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by visitor name..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <AdminTable
          columns={columns}
          rows={filteredVisitors}
          loading={loading}
          emptyMessage="No visitors or sessions recorded."
        />
      </section>
    </main>
  );
}
