import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, MapPin, ArrowLeft, CalendarDays, Star } from 'lucide-react';
import { supabase, type Exhibition } from '../lib/supabase';

export function ExhibitionDirectoryPage() {
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'upcoming' | 'ended'>('all');

  useEffect(() => {
    fetchExhibitions();
  }, []);

  async function fetchExhibitions() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exhibitions')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) throw error;
      setExhibitions(data || []);
    } catch (err) {
      console.error('Error fetching exhibitions:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter logic based on search queries and status categories
  const filteredExhibitions = exhibitions.filter((ex) => {
    const matchesSearch =
      ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ex.location && ex.location.toLowerCase().includes(searchQuery.toLowerCase()));

    const nowStr = new Date().toISOString().split('T')[0];
    const isUpcoming = ex.start_date && ex.start_date > nowStr;
    const isEnded = ex.end_date && ex.end_date < nowStr;
    const isActive = ex.is_active && !isUpcoming && !isEnded;

    if (filterStatus === 'active') return matchesSearch && isActive;
    if (filterStatus === 'upcoming') return matchesSearch && isUpcoming;
    if (filterStatus === 'ended') return matchesSearch && isEnded;

    return matchesSearch;
  });

  return (
    <div className="profile-page" style={{ maxWidth: 800 }}>
      {/* Back button */}
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: 'var(--color-muted)',
          textDecoration: 'none',
          fontSize: '0.875rem',
          marginBottom: '1.5rem',
        }}
      >
        <ArrowLeft size={16} />
        Back to Home
      </Link>

      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Exhibitions & Events
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
          Find active tradeshows, display galleries, and coordinate schedules
        </p>
      </header>

      {/* Toolbar / Search Panel */}
      <section className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="search-wrap" style={{ width: '100%' }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search exhibitions by name or hall location..."
            className="search-input"
            style={{ width: '100%', paddingLeft: '2.6rem' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Status buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['all', 'active', 'upcoming', 'ended'] as const).map((status) => (
            <button
              key={status}
              className={`btn btn-sm ${filterStatus === status ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilterStatus(status)}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem', textTransform: 'capitalize' }}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      {/* Directory Grid */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="glass skeleton" style={{ height: '140px', width: '100%' }} />
          ))
        ) : filteredExhibitions.length === 0 ? (
          <div className="glass" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
            <CalendarDays size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <p style={{ fontSize: '0.95rem' }}>No exhibitions found matching your search filters.</p>
          </div>
        ) : (
          filteredExhibitions.map((ex) => {
            const nowStr = new Date().toISOString().split('T')[0];
            const isUpcoming = ex.start_date && ex.start_date > nowStr;
            const isEnded = ex.end_date && ex.end_date < nowStr;
            let statusBadge = <span className="badge badge-success">Active Now</span>;

            if (isUpcoming) {
              statusBadge = <span className="badge badge-info">Upcoming</span>;
            } else if (isEnded) {
              statusBadge = <span className="badge badge-muted">Ended</span>;
            }

            return (
              <Link
                key={ex.id}
                to={`/exhibitions/${ex.id}`}
                className="glass"
                style={{
                  display: 'flex',
                  padding: '1.25rem',
                  textDecoration: 'none',
                  color: 'inherit',
                  gap: '1.25rem',
                  transition: 'border-color 0.2s, transform 0.2s',
                  alignItems: 'stretch',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {/* Visual Thumbnail */}
                {ex.image_url ? (
                  <img
                    src={ex.image_url}
                    alt={ex.title}
                    style={{ width: '100px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100px',
                      borderRadius: '8px',
                      background: 'var(--color-surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CalendarDays size={32} color="var(--color-muted)" />
                  </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>{ex.title}</h2>
                      {statusBadge}
                      {ex.is_featured && (
                        <span className="badge badge-warning" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Star size={10} fill="currentColor" />
                          Featured
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.4rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {ex.description || 'Join this custom navigation exhibition event.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                      <MapPin size={13} />
                      {ex.location || 'Exhibition Area'}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                      <Calendar size={13} />
                      {ex.start_date || '?'} to {ex.end_date || '?'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}
