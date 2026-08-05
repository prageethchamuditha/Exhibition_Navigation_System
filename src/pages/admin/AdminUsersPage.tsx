import { useEffect, useState } from 'react';
import { Search, Edit2, Trash2, Check, UserCheck, Plus, Eye, EyeOff } from 'lucide-react';
import { supabase, type Profile } from '../../lib/supabase';
import { AdminTable } from '../../components/admin/AdminTable';
import { AdminModal } from '../../components/admin/AdminModal';
import { useAuth } from '../../contexts/AuthContext';

export function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentUserRow, setCurrentUserRow] = useState<Partial<Profile> | null>(null);
  const [editEmailOrUsername, setEditEmailOrUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  
  // Add User Form States
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addRole, setAddRole] = useState<'visitor' | 'admin' | 'store_admin'>('visitor');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'store_admin'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenEdit = (profile: Profile) => {
    setCurrentUserRow(profile);
    const email = profile.email || '';
    if (email.endsWith('@exnav.local')) {
      setEditEmailOrUsername(email.split('@')[0]);
    } else {
      setEditEmailOrUsername(email);
    }
    setEditPassword('');
    setShowEditPassword(false);
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (profile: Profile) => {
    setCurrentUserRow(profile);
    setFormError('');
    setIsDeleteModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserRow || !currentUserRow.id) return;

    try {
      setSubmitting(true);
      setFormError('');

      // Format target email
      const cleanInput = editEmailOrUsername.trim();
      if (!cleanInput) {
        throw new Error('Username or email is required.');
      }
      
      const formattedEmail = cleanInput.includes('@') 
        ? cleanInput 
        : `${cleanInput}@exnav.local`;

      // If email/username changed, call the secure RPC to update auth.users & profiles.email
      if (formattedEmail !== currentUserRow.email) {
        const { error: rpcError } = await supabase.rpc('update_user_email', {
          user_id: currentUserRow.id,
          new_email: formattedEmail,
        });
        if (rpcError) throw rpcError;
      }

      // If password field is filled, call the secure RPC to update password
      const cleanPassword = editPassword.trim();
      if (cleanPassword) {
        if (cleanPassword.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }
        const { error: rpcPwdError } = await supabase.rpc('update_user_password', {
          user_id: currentUserRow.id,
          new_password: cleanPassword,
        });
        if (rpcPwdError) throw rpcPwdError;
      }

      const payload = {
        name: currentUserRow.name || null,
        phone: currentUserRow.phone || null,
        role: currentUserRow.role || 'visitor',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', currentUserRow.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!currentUserRow || !currentUserRow.id) return;

    try {
      setSubmitting(true);
      setFormError('');

      // Call the secure RPC function to delete the user from auth.users (cascades to profiles)
      const { error } = await supabase.rpc('delete_user', { user_id: currentUserRow.id });

      if (error) throw error;

      setIsDeleteModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete user account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAdd = () => {
    setAddUsername('');
    setAddPassword('');
    setShowAddPassword(false);
    setAddName('');
    setAddPhone('');
    setAddRole('visitor');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError('');

      const cleanUsername = addUsername.trim();
      const cleanPassword = addPassword.trim();
      const cleanName = addName.trim();
      const cleanPhone = addPhone.trim();

      if (!cleanUsername) throw new Error('Username or email is required.');
      if (cleanPassword.length < 6) throw new Error('Password must be at least 6 characters.');
      if (!cleanName) throw new Error('Full Name is required.');

      const { error } = await supabase.rpc('create_new_user', {
        username_or_email: cleanUsername,
        password_text: cleanPassword,
        display_name_text: cleanName,
        phone_text: cleanPhone,
        role_text: addRole,
      });

      if (error) throw error;

      setIsAddModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = u.name && u.name.toLowerCase().includes(q);
    const emailMatch = u.email && u.email.toLowerCase().includes(q);
    const phoneMatch = u.phone && u.phone.includes(q);
    return nameMatch || emailMatch || phoneMatch;
  });

  const columns = [
    {
      key: 'name',
      label: 'Display Name',
      render: (row: Profile) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name || 'No Name'}</div>
          {row.phone && <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>{row.phone}</div>}
        </div>
      ),
    },
    {
      key: 'username',
      label: 'Username / Email',
      render: (row: Profile) => {
        const email = row.email || '';
        if (email.endsWith('@exnav.local')) {
          const username = email.split('@')[0];
          return (
            <div>
              <div style={{ fontWeight: 500, color: 'var(--color-primary-h)' }}>{username}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Local Account</div>
            </div>
          );
        }
        return <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{email || 'N/A'}</div>;
      },
    },
    {
      key: 'role',
      label: 'Account Role',
      render: (row: Profile) => (
        <span className={`badge badge-${row.role}`}>
          {row.role}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Registered On',
      render: (row: Profile) => (
        <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          {new Date(row.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: Profile) => {
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
              title={isSelf ? 'Cannot delete your own account' : 'Delete User'}
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
          <h1>System Staff Accounts</h1>
          <p>Manage administrators and store admin accounts</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            className="badge badge-info"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <UserCheck size={14} />
            Staff Accounts: {users.length}
          </div>
          <button
            className="btn btn-primary"
            onClick={handleOpenAdd}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={16} />
            Add User
          </button>
        </div>
      </header>

      {/* Table Toolbar */}
      <section className="data-table-wrap">
        <div className="data-table-toolbar">
          <div className="search-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, email or username..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <AdminTable
          columns={columns}
          rows={filteredUsers}
          loading={loading}
          emptyMessage="No admin or store admin accounts found."
        />
      </section>

      {/* Edit Form Modal */}
      {isEditModalOpen && currentUserRow && (
        <AdminModal
          title="Edit System User"
          onClose={() => setIsEditModalOpen(false)}
        >
          <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && (
              <div className="alert alert-error">
                <span>{formError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="user-username">Username or Email *</label>
              <input
                id="user-username"
                type="text"
                className="form-input"
                required
                value={editEmailOrUsername}
                onChange={(e) => setEditEmailOrUsername(e.target.value)}
                placeholder="e.g. admin or admin@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="user-name">Full Name</label>
              <input
                id="user-name"
                type="text"
                className="form-input"
                value={currentUserRow.name || ''}
                onChange={(e) => setCurrentUserRow({ ...currentUserRow, name: e.target.value })}
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="user-phone">Phone Number</label>
              <input
                id="user-phone"
                type="text"
                className="form-input"
                value={currentUserRow.phone || ''}
                onChange={(e) => setCurrentUserRow({ ...currentUserRow, phone: e.target.value })}
                placeholder="e.g. +1234567890"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-password">New Password (leave blank to keep current)</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="edit-password"
                  type={showEditPassword ? 'text' : 'password'}
                  className="form-input"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                >
                  {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="user-role">Account Role *</label>
              <select
                id="user-role"
                className="form-input"
                required
                value={currentUserRow.role || 'visitor'}
                onChange={(e) => setCurrentUserRow({ ...currentUserRow, role: e.target.value as 'visitor' | 'admin' | 'store_admin' })}
              >
                <option value="visitor">Visitor</option>
                <option value="admin">Administrator</option>
                <option value="store_admin">Store Administrator</option>
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
      {isDeleteModalOpen && currentUserRow && (
        <AdminModal
          title="Confirm Delete User"
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
            <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Delete User?</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to permanently delete the registered user account for <strong>{currentUserRow.name || currentUserRow.email || 'this user'}</strong>? This will clear all their access.
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

      {/* Add User Modal */}
      {isAddModalOpen && (
        <AdminModal
          title="Add New System User"
          onClose={() => setIsAddModalOpen(false)}
        >
          <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && (
              <div className="alert alert-error">
                <span>{formError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="add-username">Username or Email *</label>
              <input
                id="add-username"
                type="text"
                className="form-input"
                required
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="e.g. admin or admin@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="add-password">Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="add-password"
                  type={showAddPassword ? 'text' : 'password'}
                  className="form-input"
                  required
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowAddPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-muted)',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  aria-label={showAddPassword ? 'Hide password' : 'Show password'}
                >
                  {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="add-name">Full Name *</label>
              <input
                id="add-name"
                type="text"
                className="form-input"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="add-phone">Phone Number</label>
              <input
                id="add-phone"
                type="text"
                className="form-input"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                placeholder="e.g. +1234567890"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="add-role">Account Role *</label>
              <select
                id="add-role"
                className="form-input"
                required
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as 'visitor' | 'admin' | 'store_admin')}
              >
                <option value="visitor">Visitor</option>
                <option value="admin">Administrator</option>
                <option value="store_admin">Store Administrator</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsAddModalOpen(false)}
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
                Create Account
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </main>
  );
}
