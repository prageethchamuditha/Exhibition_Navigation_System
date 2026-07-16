import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Check, Navigation2, Network, Link2 } from 'lucide-react';
import { supabase, type NavigationNode, type NavigationEdge, type Store, type NodeType } from '../../lib/supabase';
import { AdminTable } from '../../components/admin/AdminTable';
import { AdminModal } from '../../components/admin/AdminModal';

export function AdminNodesPage() {
  const [nodes, setNodes] = useState<NavigationNode[]>([]);
  const [edges, setEdges] = useState<NavigationEdge[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'nodes' | 'edges'>('nodes');

  // Modals state
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [isDeleteNodeModalOpen, setIsDeleteNodeModalOpen] = useState(false);
  const [currentNode, setCurrentNode] = useState<Partial<NavigationNode> | null>(null);

  const [isEdgeModalOpen, setIsEdgeModalOpen] = useState(false);
  const [isDeleteEdgeModalOpen, setIsDeleteEdgeModalOpen] = useState(false);
  const [currentEdge, setCurrentEdge] = useState<Partial<NavigationEdge> | null>(null);

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      setLoading(true);
      const [nodesRes, edgesRes, storesRes] = await Promise.all([
        supabase.from('navigation_nodes').select('*').order('label'),
        supabase.from('navigation_edges').select(`
          *,
          from_node:from_node_id (id, label),
          to_node:to_node_id (id, label)
        `),
        supabase.from('stores').select('*').order('name'),
      ]);

      setNodes(nodesRes.data || []);
      setEdges(edgesRes.data || []);
      setStores(storesRes.data || []);
    } catch (err) {
      console.error('Error loading navigation nodes page data:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- NODE CRUD FUNCTIONS ---
  const handleOpenAddNode = () => {
    setCurrentNode({
      label: '',
      latitude: 0,
      longitude: 0,
      floor: '1',
      type: 'path',
      store_id: '',
    });
    setFormError('');
    setIsNodeModalOpen(true);
  };

  const handleOpenEditNode = (node: NavigationNode) => {
    setCurrentNode(node);
    setFormError('');
    setIsNodeModalOpen(true);
  };

  const handleOpenDeleteNode = (node: NavigationNode) => {
    setCurrentNode(node);
    setIsDeleteNodeModalOpen(true);
  };

  const handleNodeFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentNode) return;
    if (!currentNode.label || currentNode.latitude === undefined || currentNode.longitude === undefined) {
      setFormError('Label and Coordinates are required');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const payload = {
        label: currentNode.label,
        latitude: Number(currentNode.latitude),
        longitude: Number(currentNode.longitude),
        floor: currentNode.floor || null,
        type: (currentNode.type as NodeType) || 'path',
        store_id: currentNode.store_id || null,
      };

      if (currentNode.id) {
        const { error } = await supabase
          .from('navigation_nodes')
          .update(payload)
          .eq('id', currentNode.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('navigation_nodes')
          .insert(payload);
        if (error) throw error;
      }

      setIsNodeModalOpen(false);
      loadAllData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNodeDeleteConfirm = async () => {
    if (!currentNode?.id) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('navigation_nodes')
        .delete()
        .eq('id', currentNode.id);
      if (error) throw error;
      setIsDeleteNodeModalOpen(false);
      loadAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  // --- EDGE CRUD FUNCTIONS ---
  const handleOpenAddEdge = () => {
    setCurrentEdge({
      from_node_id: nodes[0]?.id || '',
      to_node_id: nodes[1]?.id || '',
      distance: 5.0,
      is_bidirectional: true,
    });
    setFormError('');
    setIsEdgeModalOpen(true);
  };

  const handleOpenDeleteEdge = (edge: NavigationEdge) => {
    setCurrentEdge(edge);
    setIsDeleteEdgeModalOpen(true);
  };

  const handleEdgeFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEdge) return;
    if (!currentEdge.from_node_id || !currentEdge.to_node_id) {
      setFormError('Both From and To nodes are required');
      return;
    }
    if (currentEdge.from_node_id === currentEdge.to_node_id) {
      setFormError('Cannot connect a node to itself');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      const payload = {
        from_node_id: currentEdge.from_node_id,
        to_node_id: currentEdge.to_node_id,
        distance: Number(currentEdge.distance) || 1.0,
        is_bidirectional: !!currentEdge.is_bidirectional,
      };

      const { error } = await supabase
        .from('navigation_edges')
        .insert(payload);
      if (error) throw error;

      setIsEdgeModalOpen(false);
      loadAllData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Operation failed. Edge connection might already exist.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdgeDeleteConfirm = async () => {
    if (!currentEdge?.id) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('navigation_edges')
        .delete()
        .eq('id', currentEdge.id);
      if (error) throw error;
      setIsDeleteEdgeModalOpen(false);
      loadAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredNodes = nodes.filter((n) =>
    n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const nodeColumns = [
    {
      key: 'label',
      label: 'Label / Name',
      render: (row: NavigationNode) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Navigation2 size={14} className={`node-type-${row.type}`} />
          <span style={{ fontWeight: 600 }}>{row.label}</span>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Node Type',
      render: (row: NavigationNode) => (
        <span style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{row.type}</span>
      ),
    },
    {
      key: 'coords',
      label: 'Coordinates (Lat / Lng)',
      render: (row: NavigationNode) => (
        <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>
          {row.latitude.toFixed(6)}, {row.longitude.toFixed(6)}
        </span>
      ),
    },
    {
      key: 'floor',
      label: 'Floor',
      width: '80px',
      render: (row: NavigationNode) => <span>{row.floor || '1'}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '120px',
      render: (row: NavigationNode) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => handleOpenEditNode(row)}
            title="Edit node"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="btn btn-danger btn-sm btn-icon"
            onClick={() => handleOpenDeleteNode(row)}
            title="Delete node"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const edgeColumns = [
    {
      key: 'connection',
      label: 'Connection',
      render: (row: NavigationEdge) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Network size={14} color="var(--color-primary-h)" />
          <span style={{ fontWeight: 600 }}>{row.from_node?.label || 'Unknown'}</span>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>
            {row.is_bidirectional ? '◀ ─ ▶' : '─ ─ ▶'}
          </span>
          <span style={{ fontWeight: 600 }}>{row.to_node?.label || 'Unknown'}</span>
        </div>
      ),
    },
    {
      key: 'distance',
      label: 'Distance (Weight)',
      render: (row: NavigationEdge) => <span>{row.distance} m</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '80px',
      render: (row: NavigationEdge) => (
        <button
          className="btn btn-danger btn-sm btn-icon"
          onClick={() => handleOpenDeleteEdge(row)}
          title="Remove edge connection"
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Navigation Nodes</h1>
          <p>Map out indoor pathways, exits, and waypoints</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={handleOpenAddEdge} disabled={nodes.length < 2}>
            <Link2 size={16} />
            Connect Nodes
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddNode}>
            <Plus size={16} />
            Add Node
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeTab === 'nodes' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('nodes')}
        >
          Nodes List
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'edges' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('edges')}
        >
          Edges (Path Connections)
        </button>
      </div>

      {activeTab === 'nodes' ? (
        <section className="data-table-wrap">
          <div className="data-table-toolbar">
            <div className="search-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search nodes by label or type..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <AdminTable
            columns={nodeColumns}
            rows={filteredNodes}
            loading={loading}
            emptyMessage="No nodes mapped yet."
          />
        </section>
      ) : (
        <section className="data-table-wrap">
          <AdminTable
            columns={edgeColumns}
            rows={edges}
            loading={loading}
            emptyMessage="No path connections established between nodes."
          />
        </section>
      )}

      {/* NODE MODAL */}
      {isNodeModalOpen && currentNode && (
        <AdminModal
          title={currentNode.id ? 'Edit Node' : 'Add Node'}
          onClose={() => setIsNodeModalOpen(false)}
        >
          <form onSubmit={handleNodeFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && (
              <div className="alert alert-error">
                <span>{formError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="node-label">Label *</label>
              <input
                id="node-label"
                type="text"
                className="form-input"
                required
                value={currentNode.label || ''}
                onChange={(e) => setCurrentNode({ ...currentNode, label: e.target.value })}
                placeholder="e.g. Entrance Gate 1, Corner Hall A"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="node-type">Node Type</label>
                <select
                  id="node-type"
                  className="form-select"
                  value={currentNode.type || 'path'}
                  onChange={(e) => setCurrentNode({ ...currentNode, type: e.target.value as NodeType })}
                >
                  <option value="path">Pathway Intersection</option>
                  <option value="entrance">Entrance / Exit</option>
                  <option value="poi">Point of Interest (POI)</option>
                  <option value="store">Store Booth Location</option>
                  <option value="emergency">Emergency Exit Path</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="node-floor">Floor</label>
                <input
                  id="node-floor"
                  type="text"
                  className="form-input"
                  value={currentNode.floor || ''}
                  onChange={(e) => setCurrentNode({ ...currentNode, floor: e.target.value })}
                  placeholder="e.g. 1"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="node-lat">Latitude *</label>
                <input
                  id="node-lat"
                  type="number"
                  step="any"
                  className="form-input"
                  required
                  value={currentNode.latitude || ''}
                  onChange={(e) => setCurrentNode({ ...currentNode, latitude: Number(e.target.value) })}
                  placeholder="e.g. 6.92712"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="node-lng">Longitude *</label>
                <input
                  id="node-lng"
                  type="number"
                  step="any"
                  className="form-input"
                  required
                  value={currentNode.longitude || ''}
                  onChange={(e) => setCurrentNode({ ...currentNode, longitude: Number(e.target.value) })}
                  placeholder="e.g. 79.86121"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="node-store">Link to Store (Optional)</label>
              <select
                id="node-store"
                className="form-select"
                value={currentNode.store_id || ''}
                onChange={(e) => setCurrentNode({ ...currentNode, store_id: e.target.value })}
              >
                <option value="">None</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsNodeModalOpen(false)}
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

      {/* EDGE MODAL */}
      {isEdgeModalOpen && currentEdge && (
        <AdminModal
          title="Connect Nodes (Add Edge)"
          onClose={() => setIsEdgeModalOpen(false)}
        >
          <form onSubmit={handleEdgeFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && (
              <div className="alert alert-error">
                <span>{formError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="edge-from">From Node</label>
              <select
                id="edge-from"
                className="form-select"
                value={currentEdge.from_node_id || ''}
                onChange={(e) => setCurrentEdge({ ...currentEdge, from_node_id: e.target.value })}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} ({n.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edge-to">To Node</label>
              <select
                id="edge-to"
                className="form-select"
                value={currentEdge.to_node_id || ''}
                onChange={(e) => setCurrentEdge({ ...currentEdge, to_node_id: e.target.value })}
              >
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} ({n.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edge-dist">Distance (Weight in meters)</label>
              <input
                id="edge-dist"
                type="number"
                step="any"
                className="form-input"
                value={currentEdge.distance || ''}
                onChange={(e) => setCurrentEdge({ ...currentEdge, distance: Number(e.target.value) })}
                placeholder="e.g. 5.5"
              />
            </div>

            <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={!!currentEdge.is_bidirectional}
                    onChange={(e) => setCurrentEdge({ ...currentEdge, is_bidirectional: e.target.checked })}
                  />
                  <span className="toggle-track" />
                </label>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Bidirectional Connection</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIsEdgeModalOpen(false)}
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
                Add Connection
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {/* Node Delete Confirmation Modal */}
      {isDeleteNodeModalOpen && currentNode && (
        <AdminModal
          title="Delete Node?"
          onClose={() => setIsDeleteNodeModalOpen(false)}
          maxWidth={400}
        >
          <div style={{ textAlign: 'center' }}>
            <div className="confirm-icon">
              <Trash2 size={24} color="var(--color-danger)" />
            </div>
            <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Delete Node?</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to delete node <strong>{currentNode.label}</strong>? This will remove all associated path connections (edges).
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setIsDeleteNodeModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleNodeDeleteConfirm}
                disabled={submitting}
              >
                {submitting ? <span className="spinner" /> : <Trash2 size={16} />}
                Delete
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Edge Delete Confirmation Modal */}
      {isDeleteEdgeModalOpen && currentEdge && (
        <AdminModal
          title="Delete Edge Connection?"
          onClose={() => setIsDeleteEdgeModalOpen(false)}
          maxWidth={400}
        >
          <div style={{ textAlign: 'center' }}>
            <div className="confirm-icon">
              <Trash2 size={24} color="var(--color-danger)" />
            </div>
            <h3 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>Delete Connection?</h3>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to sever this connection between these nodes?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setIsDeleteEdgeModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleEdgeDeleteConfirm}
                disabled={submitting}
              >
                {submitting ? <span className="spinner" /> : <Trash2 size={16} />}
                Delete Edge
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </main>
  );
}
