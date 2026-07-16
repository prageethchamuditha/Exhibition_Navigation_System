import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Check, Tag } from 'lucide-react';
import { supabase, type Category } from '../../lib/supabase';
import { AdminModal } from '../../components/admin/AdminModal';

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Partial<Category> | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenAdd = () => {
    setCurrentCategory({
      name: '',
      icon: 'Tag',
      color: '#6366f1',
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setCurrentCategory(category);
    setFormError('');
    setIsFormModalOpen(true);
  };

  const handleOpenDelete = (category: Category) => {
    setCurrentCategory(category);
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCategory) return;
    if (!currentCategory.name) {
      setFormError('Category name is required');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const payload = {
        name: currentCategory.name,
        icon: currentCategory.icon || null,
        color: currentCategory.color || null,
      };

      if (currentCategory.id) {
        // Update
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', currentCategory.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('categories')
          .insert(payload);
        if (error) throw error;
      }

      setIsFormModalOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!currentCategory?.id) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', currentCategory.id);
      if (error) throw error;
      setIsDeleteModalOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Categories</h1>
          <p>Manage categories for stores and facilities</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} />
          Add Category
        </button>
      </header>

      {/* Grid of Categories */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass skeleton" style={{ height: '100px', width: '100%' }} />
          ))
        ) : categories.length === 0 ? (
          <div className="glass" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--color-muted)' }}>
            No categories defined.
          </div>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="glass"
              style={{
                padding: '1.25rem',
                borderLeft: `5px solid ${cat.color || 'var(--color-primary)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    background: `${cat.color || 'var(--color-primary)'}15`,
                    color: cat.color || 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Tag size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{cat.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                    Color: {cat.color || 'Default'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => handleOpenEdit(cat)}
                  title="Edit Category"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  onClick={() => handleOpenDelete(cat)}
                  title="Delete Category"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Add / Edit Form Modal */}
      {isFormModalOpen && currentCategory && (
        <AdminModal
          title={currentCategory.id ? 'Edit Category' : 'Add Category'}
          onClose={() => setIsFormModalOpen(false)}
        >
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && (
              <div className="alert alert-error">
                <span>{formError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="cat-name">Category Name *</label>
              <input
                id="cat-name"
                type="text"
                className="form-input"
                required
                value={currentCategory.name || ''}
                onChange={(e) => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                placeholder="e.g. Food, Clothing, Electronics"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cat-color">Color Picker</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input
                  id="cat-color"
                  type="color"
                  style={{
                    width: '46px',
                    height: '40px',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                  value={currentCategory.color || '#6366f1'}
                  onChange={(e) => setCurrentCategory({ ...currentCategory, color: e.target.value })}
                />
                <input
                  type="text"
                  className="form-input"
                  value={currentCategory.color || ''}
                  onChange={(e) => setCurrentCategory({ ...currentCategory, color: e.target.value })}
                  placeholder="#hexcode"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cat-icon">Icon Name</label>
              <input
                id="cat-icon"
                type="text"
                className="form-input"
                value={currentCategory.icon || ''}
                onChange={(e) => setCurrentCategory({ ...currentCategory, icon: e.target.value })}
                placeholder="e.g. ShoppingBag, Coffee, Laptop"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsFormModalOpen(false)}
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
                Save
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && currentCategory && (
        <AdminModal
          title="Confirm Delete"
          onClose={() => setIsDeleteModalOpen(false)}
          maxWidth={400}
        >
          <div style={{ textAlign: 'center' }}>
            <div className="confirm-icon">
              <Trash2 size={24} color="var(--color-danger)" />
            </div>
            <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Delete Category?</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to delete <strong>{currentCategory.name}</strong>? Stores set to this category will no longer have a category label.
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
