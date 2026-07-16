import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Clock, ArrowLeft, Store, Star } from 'lucide-react';
import { supabase, type Store as StoreType, type Category } from '../lib/supabase';

export function StoreDirectoryPage() {
  const [stores, setStores] = useState<StoreType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [storesRes, categoriesRes] = await Promise.all([
        supabase
          .from('stores')
          .select(`
            *,
            categories:category_id (id, name, color),
            exhibitions:exhibition_id (id, title)
          `)
          .eq('is_active', true)
          .order('name'),
        supabase.from('categories').select('*').order('name'),
      ]);

      setStores(storesRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (err) {
      console.error('Error loading store directory data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter stores based on search, category and floor selections
  const filteredStores = stores.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (st.description && st.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = !selectedCategory || st.category_id === selectedCategory;
    const matchesFloor = !selectedFloor || st.floor === selectedFloor;

    return matchesSearch && matchesCategory && matchesFloor;
  });

  // Extract unique floor levels present in stores
  const floorLevels = Array.from(
    new Set(stores.map((s) => s.floor).filter(Boolean))
  ).sort();

  return (
    <div className="profile-page" style={{ maxWidth: 800 }}>
      {/* Header Back button */}
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
          Exhibitor Directory
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
          Explore stores, food stalls, booths, and special deals
        </p>
      </header>

      {/* Directory Search & Filters Panel */}
      <section className="glass" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="search-wrap" style={{ width: '100%' }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search exhibitors by name or brand keywords..."
            className="search-input"
            style={{ width: '100%', paddingLeft: '2.6rem' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.7rem' }}>Filter by Category</label>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.7rem' }}>Filter by Floor</label>
            <select
              className="form-select"
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
            >
              <option value="">All Floors</option>
              {floorLevels.map((fl) => (
                <option key={fl} value={fl!}>
                  Floor {fl}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Quick Category Chips */}
      <section style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button
          className={`btn btn-sm ${!selectedCategory ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setSelectedCategory('')}
          style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              borderColor: selectedCategory === cat.id ? undefined : `${cat.color || 'var(--color-border)'}40`,
            }}
          >
            {cat.name}
          </button>
        ))}
      </section>

      {/* Stores Directory Grid */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass skeleton" style={{ height: '90px', width: '100%' }} />
          ))
        ) : filteredStores.length === 0 ? (
          <div className="glass" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
            <Store size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <p style={{ fontSize: '0.95rem' }}>No exhibitors match your filters.</p>
          </div>
        ) : (
          filteredStores.map((st) => (
            <Link
              key={st.id}
              to={`/stores/${st.id}`}
              className="glass"
              style={{
                display: 'flex',
                padding: '1.25rem',
                textDecoration: 'none',
                color: 'inherit',
                gap: '1rem',
                alignItems: 'center',
                transition: 'border-color 0.2s, transform 0.2s',
                borderLeft: `5px solid ${st.categories?.color || 'var(--color-border)'}`,
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
              {st.logo_url ? (
                <img
                  src={st.logo_url}
                  alt={st.name}
                  style={{ width: 48, height: 48, borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '8px',
                    background: 'var(--color-surface2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Store size={22} color="var(--color-muted)" />
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{st.name}</h2>
                  {st.categories && (
                    <span
                      className="badge"
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.1rem 0.4rem',
                        background: `${st.categories.color}15`,
                        color: st.categories.color || 'var(--color-text)',
                        borderColor: `${st.categories.color}35`,
                      }}
                    >
                      {st.categories.name}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: '0.825rem',
                    color: 'var(--color-muted)',
                    marginTop: '0.25rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {st.description || 'No description provided.'}
                </p>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                    <MapPin size={12} />
                    Floor {st.floor || '1'}
                    {st.exhibitions ? ` · ${st.exhibitions.title}` : ''}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                    <Clock size={12} />
                    {st.opening_time ? st.opening_time.substring(0, 5) : '09:00'} -{' '}
                    {st.closing_time ? st.closing_time.substring(0, 5) : '18:00'}
                  </span>
                </div>
              </div>

              {/* Promo tag indicators */}
              {(st.phone || st.website) && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <Star size={16} color="var(--color-warning)" fill="var(--color-warning)15" />
                </div>
              )}
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
