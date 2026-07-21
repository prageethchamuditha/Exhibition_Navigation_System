import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Route,
  X,
  Search,
  Navigation,
  CalendarDays,
  Store,
  ArrowLeft,
  Bell,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GPSPermissionBanner } from '../components/GPSPermissionBanner';
import {
  supabase,
  type Store as StoreType,
  type NavigationNode,
  type NavigationEdge,
} from '../lib/supabase';
import { MapView } from '../components/MapView';
import { calculateShortestPath, findClosestNode, getDistance, getHeading } from '../utils/dijkstra';
import { logAnalyticsEvent } from '../lib/analytics';

export function MapPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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

  // Database Resources
  const [stores, setStores] = useState<StoreType[]>([]);
  const [nodes, setNodes] = useState<NavigationNode[]>([]);
  const [edges, setEdges] = useState<NavigationEdge[]>([]);
  const [loading, setLoading] = useState(true);

  // Geolocation tracking state
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null); // metres
  const [snappedToNode, setSnappedToNode] = useState<string | null>(null); // label of entrance used as fallback start
  const [, setGpsError] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(false);

  // When GPS accuracy is worse than this threshold (metres), we snap the
  // route start to the nearest entrance node instead of trusting raw GPS.
  const GPS_ACCURACY_THRESHOLD = 20;

  // Selected mock starting node (if GPS is disabled)
  const [mockStartNodeId, setMockStartNodeId] = useState('');

  // Destination / Navigation states
  const [selectedDestinationStoreId, setSelectedDestinationStoreId] = useState('');
  const [selectedDestinationNodeId, setSelectedDestinationNodeId] = useState('');
  const [calculatedRoute, setCalculatedRoute] = useState<NavigationNode[]>([]);
  const [totalDistance, setTotalDistance] = useState(0); // in meters
  const [guideSteps, setGuideSteps] = useState<string[]>([]);
  const [navigationActive, setNavigationActive] = useState(false);
  const [mapTheme, setMapTheme] = useState<'dark' | 'streets' | 'light'>('dark');
  const [showMesh, setShowMesh] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // Bottom sheet drag state (Google Maps style)
  const [navSheetExpanded, setNavSheetExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetDragStartY = useRef<number | null>(null);
  const sheetDragDelta = useRef<number>(0);

  const handleSheetTouchStart = useCallback((e: React.TouchEvent) => {
    sheetDragStartY.current = e.touches[0].clientY;
    sheetDragDelta.current = 0;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handleSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (sheetDragStartY.current === null) return;
    const delta = e.touches[0].clientY - sheetDragStartY.current;
    sheetDragDelta.current = delta;
    // Resist drag past limits
    const clamped = navSheetExpanded
      ? Math.max(0, Math.min(delta, 300))   // expanded: only allow dragging DOWN
      : Math.max(-300, Math.min(delta, 0)); // collapsed: only allow dragging UP
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${clamped}px)`;
    }
  }, [navSheetExpanded]);

  const handleSheetTouchEnd = useCallback(() => {
    const delta = sheetDragDelta.current;
    sheetDragStartY.current = null;
    sheetDragDelta.current = 0;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
      sheetRef.current.style.transform = 'translateY(0)';
    }
    if (delta < -60) setNavSheetExpanded(true);   // dragged up → expand
    if (delta > 60)  setNavSheetExpanded(false);  // dragged down → collapse
  }, []);


  // Search dropdown trigger query
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Leaflet map center anchor
  const [mapCenterLat, setMapCenterLat] = useState(6.9271);
  const [mapCenterLng, setMapCenterLng] = useState(79.8612);
  // Tracks whether the map has already been centered on a real GPS fix,
  // so the node/store fallback doesn't overwrite it.
  const hasGPSCenteredRef = useRef(false);

  // Geolocation watch listener ID
  const geoWatchIdRef = useRef<number | null>(null);
  const lastLoggedDestinationRef = useRef('');

  useEffect(() => {
    loadNavigationResources();
    startLocationTracking();

    return () => {
      if (geoWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
    };
  }, []);

  async function loadNavigationResources() {
    try {
      setLoading(true);
      const [storesRes, nodesRes, edgesRes] = await Promise.all([
        supabase
          .from('stores')
          .select(`
            *,
            categories:category_id (id, name, color),
            exhibitions:exhibition_id (id, title)
          `)
          .eq('is_active', true),
        supabase.from('navigation_nodes').select('*'),
        supabase.from('navigation_edges').select('*'),
      ]);

      const activeStores = storesRes.data || [];
      const navigationNodes = nodesRes.data || [];
      const navigationEdges = edgesRes.data || [];

      setStores(activeStores);
      setNodes(navigationNodes);
      setEdges(navigationEdges);

      // Set default mock start node selection
      const entrances = navigationNodes.filter((n) => n.type === 'entrance');
      if (entrances.length > 0) {
        setMockStartNodeId(entrances[0].id);
      } else if (navigationNodes.length > 0) {
        setMockStartNodeId(navigationNodes[0].id);
      }

      // Detect default map center based on nodes or active stores coordinates.
      // Only apply if GPS hasn't already provided a real position — we don't
      // want to overwrite a GPS center with the first node/store in the list.
      if (!hasGPSCenteredRef.current) {
        if (navigationNodes.length > 0) {
          setMapCenterLat(navigationNodes[0].latitude);
          setMapCenterLng(navigationNodes[0].longitude);
        } else if (activeStores.length > 0 && activeStores[0].latitude) {
          setMapCenterLat(activeStores[0].latitude);
          setMapCenterLng(activeStores[0].longitude!);
        }
      }
    } catch (err) {
      console.error('Error fetching navigation data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Geolocation trigger
  function startLocationTracking() {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setMockMode(true);
      return;
    }

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        setUserLat(lat);
        setUserLng(lng);
        setGpsAccuracy(accuracy ?? null);
        setGpsError(null);
        setMockMode(false);

        // On the first real GPS fix, center the map on the user and mark it
        // so the node/store fallback in loadNavigationResources never overrides it.
        if (!hasGPSCenteredRef.current) {
          hasGPSCenteredRef.current = true;
          setMapCenterLat(lat);
          setMapCenterLng(lng);
        }
      },
      (error) => {
        console.warn('GPS location tracking error:', error.message);
        setGpsError('GPS permission denied or signal lost. Switch to mockup selector.');
        setMockMode(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Handle deep-linking navigation targets via ?to= query parameters
  // Handle deep-linking navigation targets via query parameters
  useEffect(() => {
    const toParam = searchParams.get('to');
    const toNodeParam = searchParams.get('toNode');
    if (toParam && stores.length > 0) {
      setSelectedDestinationStoreId(toParam);
      setSelectedDestinationNodeId('');
      setSearchParams({});
    } else if (toNodeParam && nodes.length > 0) {
      setSelectedDestinationNodeId(toNodeParam);
      setSelectedDestinationStoreId('');
      setSearchParams({});
    }
  }, [searchParams, stores, nodes]);

  // Main pathfinder computation trigger
  useEffect(() => {
    if (selectedDestinationStoreId || selectedDestinationNodeId) {
      calculateRoutePath();
    } else {
      setCalculatedRoute([]);
      setTotalDistance(0);
      setGuideSteps([]);
      setNavigationActive(false);
      lastLoggedDestinationRef.current = '';
    }
  }, [selectedDestinationStoreId, selectedDestinationNodeId, userLat, userLng, mockMode, mockStartNodeId, nodes, edges]);

  // Compute route path
  function calculateRoutePath() {
    if (!selectedDestinationStoreId && !selectedDestinationNodeId) return;

    let targetLat: number | null = null;
    let targetLng: number | null = null;
    let targetLabel = '';

    // 1. Find destination target coordinates
    if (selectedDestinationStoreId) {
      const destinationStore = stores.find((s) => s.id === selectedDestinationStoreId);
      if (!destinationStore) return;
      targetLabel = destinationStore.name;
      targetLat = destinationStore.latitude;
      targetLng = destinationStore.longitude;
    } else if (selectedDestinationNodeId) {
      const destinationNode = nodes.find((n) => n.id === selectedDestinationNodeId);
      if (!destinationNode) return;
      targetLabel = destinationNode.label;
      targetLat = destinationNode.latitude;
      targetLng = destinationNode.longitude;
    }

    const destId = selectedDestinationStoreId || selectedDestinationNodeId;
    if (destId && destId !== lastLoggedDestinationRef.current) {
      lastLoggedDestinationRef.current = destId;
      logAnalyticsEvent('route_calculation', destId, targetLabel);
    }

    if (targetLat === null || targetLng === null) {
      console.warn('Destination target is missing coordinates.');
      return;
    }

    // 2. Determine starting coordinates
    let startLat = mapCenterLat;
    let startLng = mapCenterLng;
    let startLabel = 'Starting Entrance';

    if (userLat !== null && userLng !== null && !mockMode) {
      startLat = userLat;
      startLng = userLng;
      startLabel = 'Your Location';
    } else if (mockStartNodeId) {
      const mockNode = nodes.find((n) => n.id === mockStartNodeId);
      if (mockNode) {
        startLat = mockNode.latitude;
        startLng = mockNode.longitude;
        startLabel = mockNode.label;
      }
    } else if (nodes.length > 0) {
      const entrances = nodes.filter((n) => n.type === 'entrance');
      const fallbackNode = entrances.length > 0 ? entrances[0] : nodes[0];
      startLat = fallbackNode.latitude;
      startLng = fallbackNode.longitude;
      startLabel = fallbackNode.label;
    }

    // 3. Try to calculate network Dijkstra path first (if nodes exist)
    let path: NavigationNode[] = [];
    if (nodes.length > 0) {
      // Find IDs of nodes that are actually connected by edges
      const connectedNodeIds = new Set<string>();
      edges.forEach((edge) => {
        connectedNodeIds.add(edge.from_node_id);
        connectedNodeIds.add(edge.to_node_id);
      });
      // Filter list of nodes to only those that have connections (or are entrances)
      const connectedNodes = nodes.filter((n) => connectedNodeIds.has(n.id) || n.type === 'entrance');
      const searchNodesList = connectedNodes.length > 0 ? connectedNodes : nodes;

      let startNode: NavigationNode | undefined;
      const entranceNodes = nodes.filter((n) => n.type === 'entrance');

      if (userLat !== null && userLng !== null && !mockMode) {
        const poorGps = gpsAccuracy !== null && gpsAccuracy > GPS_ACCURACY_THRESHOLD;

        if (poorGps && entranceNodes.length > 0) {
          // GPS is too imprecise — snap to the nearest known entrance node
          // instead of using the raw (potentially wrong) GPS coordinate.
          const nearestEntrance = findClosestNode(userLat, userLng, entranceNodes);
          startNode = nearestEntrance ?? undefined;
          setSnappedToNode(startNode?.label ?? null);
        } else {
          // GPS is accurate enough — use the closest CONNECTED node to real position.
          const closest = findClosestNode(userLat, userLng, searchNodesList);
          startNode = closest ?? undefined;
          setSnappedToNode(null);
        }
      } else {
        // Mock mode — use the manually selected start node.
        startNode = nodes.find((n) => n.id === mockStartNodeId);
        setSnappedToNode(null);
      }

      // Last-resort fallback if nothing matched above
      if (!startNode) {
        startNode = entranceNodes.length > 0 ? entranceNodes[0] : nodes[0];
        setSnappedToNode(startNode?.label ?? null);
      }

      let endNode = selectedDestinationStoreId
        ? (nodes.find((n) => n.store_id === selectedDestinationStoreId) || findClosestNode(targetLat, targetLng, searchNodesList))
        : nodes.find((n) => n.id === selectedDestinationNodeId);

      if (startNode && endNode) {
        path = calculateShortestPath(startNode.id, endNode.id, nodes, edges);
      }
    }

    // Create virtual start node representing actual user position
    const userStartVirtualNode: NavigationNode = {
      id: 'actual-start-virtual',
      label: startLabel,
      latitude: startLat,
      longitude: startLng,
      floor: path[0]?.floor || null,
      type: 'poi',
      store_id: null,
      created_at: new Date().toISOString()
    };

    // Create virtual end node representing actual target position
    const destEndVirtualNode: NavigationNode = {
      id: 'actual-end-virtual',
      label: targetLabel,
      latitude: targetLat,
      longitude: targetLng,
      floor: path[path.length - 1]?.floor || null,
      type: 'store',
      store_id: null,
      created_at: new Date().toISOString()
    };

    // 4. Connect actual locations with Dijkstra path if found
    let finalRoute = [...path];
    if (path.length > 0) {
      const startDist = getDistance(startLat, startLng, path[0].latitude, path[0].longitude);
      const endDist = getDistance(path[path.length - 1].latitude, path[path.length - 1].longitude, targetLat, targetLng);

      // Prepend user location if it is not already identical to the nearest node
      if (startDist > 2) {
        finalRoute.unshift(userStartVirtualNode);
      }
      // Append destination location if it is not already identical to the final node
      if (endDist > 2) {
        finalRoute.push(destEndVirtualNode);
      }
    }

    // 5. Fallback to direct routing if network is empty, target is disconnected, or start/end are same
    if (finalRoute.length === 0) {
      const lineDist = getDistance(startLat, startLng, targetLat, targetLng);
      const heading = getHeading(startLat, startLng, targetLat, targetLng);

      setCalculatedRoute([userStartVirtualNode, destEndVirtualNode]);
      setTotalDistance(Math.round(lineDist));
      setGuideSteps([
        `Start from ${startLabel}`,
        `Head ${heading} for ${Math.round(lineDist)} meters directly to ${targetLabel} (Direct Path)`,
        `Arrive at ${targetLabel}`
      ]);
      setNavigationActive(true);
      return;
    }

    // 6. Build network route guidance steps
    setCalculatedRoute(finalRoute);
    setNavigationActive(true);

    if (finalRoute.length > 1) {
      let distanceMeters = 0;
      const steps: string[] = [];

      for (let i = 0; i < finalRoute.length - 1; i++) {
        const from = finalRoute[i];
        const to = finalRoute[i + 1];
        const segmentDist = getDistance(from.latitude, from.longitude, to.latitude, to.longitude);
        distanceMeters += segmentDist;

        if (i === 0) {
          steps.push(`Start from ${from.label}`);
        }
        
        let directionStr = 'Continue straight';
        if (to.floor && from.floor && to.floor !== from.floor) {
          directionStr = `Take escalator/lift to Floor ${to.floor}`;
        } else if (to.id === 'actual-end-virtual') {
          directionStr = `Walk to destination ${to.label}`;
        } else if (to.type === 'poi') {
          directionStr = `Walk towards ${to.label}`;
        } else if (to.type === 'store') {
          directionStr = `Proceed to ${to.label}`;
        } else if (to.type === 'entrance') {
          directionStr = `Head to ${to.label}`;
        } else {
          directionStr = `Walk towards ${to.label}`;
        }

        steps.push(`${directionStr} for ${Math.round(segmentDist)} meters`);
      }

      steps.push(`Arrive at ${targetLabel}`);
      setTotalDistance(Math.round(distanceMeters));
      setGuideSteps(steps);
    } else if (finalRoute.length === 1) {
      setTotalDistance(0);
      setGuideSteps([`You are already at ${targetLabel}.`]);
    }
  }


  const handleRecenterLocation = () => {
    if (!mockMode && userLat !== null && userLng !== null) {
      setMapCenterLat(userLat);
      setMapCenterLng(userLng);
    } else if (mockMode && mockStartNodeId) {
      const node = nodes.find((n) => n.id === mockStartNodeId);
      if (node) {
        setMapCenterLat(node.latitude);
        setMapCenterLng(node.longitude);
      }
    }
  };

  const filteredSearchStores = storeSearchQuery.trim()
    ? stores.filter((st) =>
        st.name.toLowerCase().includes(storeSearchQuery.toLowerCase())
      )
    : [];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  return (
    <>
      <GPSPermissionBanner />
      <div className="home-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        
        {/* Top Floating Control Bar */}
        <header className="glass map-topbar" style={{
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          zIndex: 1000,
          padding: '0.6rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          borderRadius: '0',
          borderBottom: '1px solid var(--color-border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
          {/* Left: Back + Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface2)', width: 32, height: 32, borderRadius: '6px', color: 'var(--color-text)', flexShrink: 0 }}>
              <ArrowLeft size={16} />
            </Link>
            <div className="map-brand-text">
              <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                Interactive Floor Map
              </h2>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-muted)' }}>
                Exhibition Navigation System
              </span>
            </div>
          </div>

          {/* Right: desktop nav links */}
          <div className="map-topbar-links" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
            <Link to="/search" className="btn btn-ghost btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
              <Search size={14} style={{ marginRight: 4 }} />
              Search
            </Link>
            <button
              onClick={handleOpenAnnouncements}
              className="btn btn-ghost btn-sm btn-icon"
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '30px', width: '30px', padding: 0 }}
              title="View Announcements"
            >
              <Bell size={14} />
              {unreadNotifications > 0 && (
                <span style={{
                  position: 'absolute', top: '1px', right: '1px',
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#ef4444', boxShadow: '0 0 4px #ef4444',
                }} />
              )}
            </button>
            <Link to="/exhibitions" className="btn btn-ghost btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
              <CalendarDays size={14} style={{ marginRight: 4 }} />
              Exhibitions
            </Link>
            <Link to="/stores" className="btn btn-ghost btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
              <Store size={14} style={{ marginRight: 4 }} />
              Stores
            </Link>
            {profile?.role === 'admin' && (
              <a href="/admin/" className="btn btn-ghost btn-sm" style={{ padding: '0.35rem 0.65rem', border: '1px dashed var(--color-warning)', color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                Admin
              </a>
            )}
          </div>

          {/* Mobile-only: bell icon inline */}
          <div className="map-topbar-mobile-icons" style={{ display: 'none', gap: '0.35rem', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={handleOpenAnnouncements}
              className="btn btn-ghost btn-sm btn-icon"
              style={{ position: 'relative', width: 36, height: 36, padding: 0 }}
              title="Announcements"
            >
              <Bell size={16} />
              {unreadNotifications > 0 && (
                <span style={{ position: 'absolute', top: '3px', right: '3px', width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
              )}
            </button>
          </div>
        </header>

        {/* Mobile bottom quick-nav bar */}
        <nav className="map-mobile-bottomnav" style={{
          display: 'none',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'rgba(11,15,26,0.92)',
          borderTop: '1px solid var(--color-border)',
          padding: '0.4rem 0.5rem',
          paddingBottom: 'calc(0.4rem + var(--safe-bottom, 0px))',
          justifyContent: 'space-around',
          alignItems: 'center',
          gap: '0.25rem',
        }}>
          <Link to="/search" className="btn btn-ghost btn-sm" style={{ flexDirection: 'column', gap: '0.15rem', padding: '0.35rem 0.5rem', fontSize: '0.6rem', minHeight: 'unset' }}>
            <Search size={18} />
            Search
          </Link>
          <Link to="/exhibitions" className="btn btn-ghost btn-sm" style={{ flexDirection: 'column', gap: '0.15rem', padding: '0.35rem 0.5rem', fontSize: '0.6rem', minHeight: 'unset' }}>
            <CalendarDays size={18} />
            Events
          </Link>
          <Link to="/stores" className="btn btn-ghost btn-sm" style={{ flexDirection: 'column', gap: '0.15rem', padding: '0.35rem 0.5rem', fontSize: '0.6rem', minHeight: 'unset' }}>
            <Store size={18} />
            Stores
          </Link>
          {profile?.role === 'admin' && (
            <a href="/admin/" className="btn btn-ghost btn-sm" style={{ flexDirection: 'column', gap: '0.15rem', padding: '0.35rem 0.5rem', fontSize: '0.6rem', color: 'var(--color-warning)', minHeight: 'unset', display: 'inline-flex', alignItems: 'center' }}>
              <Navigation size={18} />
              Admin
            </a>
          )}
        </nav>

        {/* Full Screen Map Canvas Container */}
        <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
          <MapView
            latitude={mapCenterLat}
            longitude={mapCenterLng}
            stores={stores}
            userLat={mockMode ? null : userLat}
            userLng={mockMode ? null : userLng}
            route={calculatedRoute}
            theme={mapTheme}
            showGraphMesh={showMesh}
            nodes={nodes}
            edges={edges}
          />

          {/* Floating Recenter Location Button */}
          <button
            onClick={handleRecenterLocation}
            className="btn btn-primary map-recenter-btn"
            style={{
              position: 'absolute',
              bottom: navigationActive ? '230px' : '20px',
              right: '20px',
              zIndex: 1000,
              borderRadius: '50%',
              width: '46px',
              height: '46px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
              transition: 'bottom 0.3s ease, right 0.3s ease',
            }}
            title="Recenter Map"
          >
            <Navigation size={18} style={{ transform: 'rotate(45deg)' }} />
          </button>

          {/* Floating Category Legend overlay */}
          <div className="glass map-legend-panel" style={{
            position: 'absolute',
            bottom: navigationActive ? '230px' : '20px',
            left: '20px',
            zIndex: 1000,
            padding: showLegend ? '0.75rem 1rem' : '0.5rem 0.75rem',
            borderRadius: '10px',
            maxWidth: '220px',
            transition: 'bottom 0.3s ease, left 0.3s ease',
          }}>
            {!showLegend ? (
              <button
                onClick={() => setShowLegend(true)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: 0 }}
              >
                <Store size={14} /> Show Legend
              </button>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.04em' }}>MAP LEGEND</span>
                  <button
                    onClick={() => setShowLegend(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '0.7rem' }}
                  >
                    Hide
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee', display: 'inline-block' }} />
                    <span>User Location</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                    <span>Navigation Route</span>
                  </div>
                  
                  <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '0.25rem', paddingTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>CATEGORIES</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.725rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
                      <span>General Booths</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.725rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee', display: 'inline-block' }} />
                      <span>Entrances</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.725rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
                      <span>Points of Interest</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Search Panel */}
          <div className="map-search-panel" style={{
            position: 'absolute',
            top: '4.85rem',
            left: '1rem',
            width: '320px',
            maxHeight: '350px',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div className="glass" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '12px' }}>
              <Search size={16} color="var(--color-muted)" />
              <input
                type="text"
                placeholder="Search target store/booth..."
                className="search-input"
                style={{ background: 'transparent', border: 'none', width: '100%', outline: 'none', padding: '0.25rem 0' }}
                value={storeSearchQuery}
                onChange={(e) => setStoreSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
              />
              {storeSearchQuery && (
                <button
                  onClick={() => {
                    setStoreSearchQuery('');
                    setSelectedDestinationStoreId('');
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <X size={14} color="var(--color-muted)" />
                </button>
              )}
            </div>

            {/* Live dropdown results */}
            {isSearchFocused && filteredSearchStores.length > 0 && (
              <div className="glass" style={{
                marginTop: '0.35rem',
                background: 'var(--color-surface)',
                borderRadius: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '0.25rem 0',
                display: 'flex',
                flexDirection: 'column',
              }}>
                {filteredSearchStores.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      setSelectedDestinationStoreId(st.id);
                      setStoreSearchQuery(st.name);
                      setIsSearchFocused(false);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      padding: '0.65rem 1rem',
                      color: 'var(--color-text)',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>{st.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>Floor {st.floor || '1'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map Controls (Theme & Admin Graph Mesh toggle) */}
          <div className="glass map-controls-panel" style={{
            position: 'absolute',
            top: '4.85rem',
            right: '1rem',
            width: '200px',
            zIndex: 999,
            padding: '0.75rem',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--color-muted)', fontWeight: 700, marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                Map Style
              </label>
              <select
                className="form-select"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', width: '100%' }}
                value={mapTheme}
                onChange={(e) => setMapTheme(e.target.value as any)}
              >
                <option value="dark">Dark Matter</option>
                <option value="streets">OSM Streets</option>
                <option value="light">Positron Light</option>
              </select>
            </div>

            {profile?.role === 'admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="mesh-toggle"
                  checked={showMesh}
                  onChange={(e) => setShowMesh(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="mesh-toggle" style={{ fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                  Show Path Nodes
                </label>
              </div>
            )}
          </div>

          {/* Mock Location Selector Panel (Renders when GPS signal is inactive) */}
          {mockMode && nodes.length > 0 && (
            <div className="glass map-mock-panel" style={{
              position: 'absolute',
              top: profile?.role === 'admin' ? '12.25rem' : '9.5rem',
              right: '1rem',
              width: '200px',
              zIndex: 999,
              padding: '0.75rem',
              borderRadius: '12px',
            }}>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-warning)', fontWeight: 700, marginBottom: '0.25rem' }}>
                📍 MOCK START LOCATION
              </label>
              <select
                className="form-select"
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem', width: '100%' }}
                value={mockStartNodeId}
                onChange={(e) => setMockStartNodeId(e.target.value)}
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label}
                  </option>
                ))}
              </select>
            </div>
          )}


          {/* Bottom Navigation Panel — Google Maps-style draggable bottom sheet */}
          {navigationActive && (
            <div
              ref={sheetRef}
              className={`glass map-nav-panel${navSheetExpanded ? ' map-nav-expanded' : ''}`}
              style={{
                position: 'absolute',
                bottom: '1rem',
                left: '1rem',
                right: '1rem',
                maxHeight: '200px',
                zIndex: 1000,
                borderRadius: 'var(--radius-xl)',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
                willChange: 'transform',
              }}
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
            >
              {/* Drag handle — visible only on mobile via CSS */}
              <div
                className="nav-sheet-handle"
                onClick={() => setNavSheetExpanded(v => !v)}
                style={{
                  display: 'none', /* shown via CSS on mobile */
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '0 0 0.25rem',
                  cursor: 'grab',
                  touchAction: 'none',
                }}
              >
                <div style={{
                  width: 40, height: 4, borderRadius: 999,
                  background: 'rgba(255,255,255,0.2)',
                }} />
              </div>

              {/* Summary row — always visible */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ width: 42, height: 42, background: 'rgba(99,102,241,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary-h)', flexShrink: 0 }}>
                    <Route size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      Navigating to {selectedDestinationStoreId
                        ? (stores.find((s) => s.id === selectedDestinationStoreId)?.name || 'Exhibitor')
                        : (nodes.find((n) => n.id === selectedDestinationNodeId)?.label || 'Facility')}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: 0 }}>
                      <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{totalDistance} m</span>
                      {' · '}Est: {totalDistance / 1.0 < 60 ? '< 1 min' : `${Math.ceil(totalDistance / 1.0 / 60)} min`}
                      {/* GPS accuracy indicator — only shown when real GPS is active */}
                      {!mockMode && gpsAccuracy !== null && (
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.05rem 0.4rem',
                          borderRadius: '4px',
                          color: gpsAccuracy <= 5
                            ? '#22c55e'
                            : gpsAccuracy <= 15
                              ? '#eab308'
                              : '#f97316',
                          background: gpsAccuracy <= 5
                            ? 'rgba(34,197,94,0.1)'
                            : gpsAccuracy <= 15
                              ? 'rgba(234,179,8,0.1)'
                              : 'rgba(249,115,22,0.1)',
                          border: `1px solid ${gpsAccuracy <= 5
                            ? 'rgba(34,197,94,0.25)'
                            : gpsAccuracy <= 15
                              ? 'rgba(234,179,8,0.25)'
                              : 'rgba(249,115,22,0.25)'}`,
                        }}>
                          📍 ±{Math.round(gpsAccuracy)} m
                        </span>
                      )}
                    </p>
                    {/* Entrance-snap notice — shown when poor GPS caused fallback */}
                    {snappedToNode && !mockMode && (
                      <p style={{
                        fontSize: '0.72rem',
                        color: '#f97316',
                        margin: '0.2rem 0 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}>
                        <span style={{ opacity: 0.8 }}>⚠️</span>
                        Weak GPS — routing from <strong style={{ color: '#fb923c' }}>{snappedToNode}</strong>
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                  {/* Expand/collapse toggle — visible on mobile */}
                  <button
                    className="nav-sheet-toggle"
                    onClick={() => setNavSheetExpanded(v => !v)}
                    style={{
                      display: 'none', /* shown via CSS on mobile */
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '50%',
                      width: 30, height: 30,
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--color-muted)',
                      transition: 'transform 0.3s',
                      transform: navSheetExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                    aria-label={navSheetExpanded ? 'Collapse' : 'Expand'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setSelectedDestinationStoreId('');
                      setSelectedDestinationNodeId('');
                      setStoreSearchQuery('');
                      setNavSheetExpanded(false);
                    }}
                    style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.8rem' }}
                  >
                    ✕ Clear
                  </button>
                </div>
              </div>

              {/* Step guidance — hidden when collapsed, visible when expanded on mobile */}
              <div className="nav-sheet-steps" style={{ overflowY: 'auto', paddingRight: '0.5rem', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                {guideSteps.map((step, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: idx === 0 ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: idx === 0 ? 'var(--color-accent)' : 'var(--color-muted)' }}>{idx + 1}</span>
                    </div>
                    <span style={{ color: idx === 0 ? 'var(--color-accent)' : 'inherit', fontWeight: idx === 0 ? 600 : 400, lineHeight: 1.4 }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
