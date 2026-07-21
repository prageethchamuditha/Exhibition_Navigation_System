import { useEffect, useState } from 'react';
import { Search, MapPin, Activity, Edit2, Trash2, Check } from 'lucide-react';
import { supabase, type Profile, type VisitorLocation } from '../../lib/supabase';
import { AdminTable } from '../../components/admin/AdminTable';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAuth } from '../../contexts/AuthContext';

interface EnhancedVisitorProfile extends Profile {
  location?: VisitorLocation | null;
}

export function AdminVisitorsPage() {
  const { user } = useAuth();
  const [visitors, setVisitors] = useState<EnhancedVisitorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentVisitor, setCurrentVisitor] = useState<Partial<EnhancedVisitorProfile> | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleOpenEdit = (visitor: EnhancedVisitorProfile) => {
    setCurrentVisitor(visitor);
    setFormError('');
    setIsEditModalOpen(false);
    setTimeout(() => setIsEditModalOpen(true), 0);
  };

  const handleOpenDelete = (visitor: EnhancedVisitorProfile) => {
    setCurrentVisitor(visitor);
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVisitor || !currentVisitor.id) return;

    try {
      setSubmitting(true);
      setFormError('');

      const payload = {
        name: currentVisitor.name || null,
        phone: currentVisitor.phone || null,
        role: currentVisitor.role || 'visitor',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', currentVisitor.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      fetchVisitorsAndLocations();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!currentVisitor || !currentVisitor.id) return;

    try {
      setSubmitting(true);

      // Call the secure RPC function to delete the user from auth.users (which cascades to profiles and visitor_locations)
      const { error } = await supabase.rpc('delete_user', { user_id: currentVisitor.id });

      if (error) throw error;

      setIsDeleteModalOpen(false);
      fetchVisitorsAndLocations();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete visitor profile');
    } finally {
      setSubmitting(false);
    }
  };

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
    {
      key: 'actions',
      label: 'Actions',
      render: (row: EnhancedVisitorProfile) => {
        const isSelf = user?.id === row.id;
        return (
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => handleOpenEdit(row)}
              title="Edit Profile"
            >
              <Edit2 size={12} />
            </button>
            <button
              className="btn btn-danger btn-sm btn-icon"
              onClick={() => handleOpenDelete(row)}
              title={isSelf ? 'Cannot delete your own account' : 'Delete Profile'}
              disabled={isSelf}
              style={isSelf ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              <Trash2 size={12} />
            </button>
          </div>
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

      {/* Edit Form Modal */}
      {isEditModalOpen && currentVisitor && (
        <AdminModal
          title="Edit Profile"
          onClose={() => setIsEditModalOpen(false)}
        >
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && (
              <div className="alert alert-error">
                <span>{formError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="visitor-name">Full Name</label>
              <input
                id="visitor-name"
                type="text"
                className="form-input"
                value={currentVisitor.name || ''}
                onChange={(e) => setCurrentVisitor({ ...currentVisitor, name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="visitor-phone">Phone Number</label>
              <input
                id="visitor-phone"
                type="text"
                className="form-input"
                value={currentVisitor.phone || ''}
                onChange={(e) => setCurrentVisitor({ ...currentVisitor, phone: e.target.value })}
                placeholder="e.g. +1234567890"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="visitor-role">Account Role *</label>
              <select
                id="visitor-role"
                className="form-input"
                required
                value={currentVisitor.role || 'visitor'}
                onChange={(e) => setCurrentVisitor({ ...currentVisitor, role: e.target.value as 'visitor' | 'admin' })}
              >
                <option value="visitor">Visitor</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsEditModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? <span className="spinner" /> : <Check size={16} />}
                Save Changes
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && currentVisitor && (
        <AdminModal
          title="Confirm Delete"
          onClose={() => setIsDeleteModalOpen(false)}
          maxWidth={400}
        >
          <div style={{ textAlign: 'center' }}>
            <div className="confirm-icon" style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--color-danger)15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <Trash2 size={24} color="var(--color-danger)" />
            </div>
            <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Delete Visitor?</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to delete the profile of <strong>{currentVisitor.name || 'Anonymous Visitor'}</strong>? This will permanently clear their details and active location tracking.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={submitting}
              >
                {submitting ? <span className="spinner" /> : <Trash2 size={16} />}
                Delete
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </main>
  );
}
