import { useEffect, useState, useRef } from 'react';
import { Megaphone, Volume2, VolumeX, X } from 'lucide-react';
import { supabase, type Announcement } from '../lib/supabase';

export function LiveBroadcastBanner() {
  const [activeBroadcast, setActiveBroadcast] = useState<Announcement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    fetchActiveBroadcast();

    // Subscribe to announcements realtime updates
    const channelName = `live-broadcast-${Math.random().toString(36).substring(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements',
        },
        (payload) => {
          const eventType = payload.eventType;
          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            const ann = payload.new as Announcement;
            if (ann.type === 'broadcast') {
              if (ann.is_active) {
                // Check if visitor dismissed this specific broadcast run before
                const dismissedTime = sessionStorage.getItem('dismissed_broadcast_time');
                if (dismissedTime !== ann.updated_at) {
                  setActiveBroadcast(ann);
                  setIsDismissed(false);
                }
              } else {
                setActiveBroadcast(null);
                setIsPlaying(false);
              }
            }
          } else if (eventType === 'DELETE') {
            const oldId = payload.old.id;
            setActiveBroadcast((prev) => (prev?.id === oldId ? null : prev));
            setIsPlaying(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchActiveBroadcast() {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('type', 'broadcast')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        const b = data[0];
        const dismissedTime = sessionStorage.getItem('dismissed_broadcast_time');
        if (dismissedTime !== b.updated_at) {
          setActiveBroadcast(b);
        }
      }
    } catch (err) {
      console.error('Error fetching active broadcast:', err);
    }
  }

  const handleListen = () => {
    setIsPlaying(true);
    if (iframeRef.current && youtubeId) {
      iframeRef.current.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=0&playsinline=1&enablejsapi=1`;
    }
  };

  const handleMute = () => {
    setIsPlaying(false);
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
  };

  const handleDismiss = () => {
    if (activeBroadcast) {
      sessionStorage.setItem('dismissed_broadcast_time', activeBroadcast.updated_at);
    }
    setIsDismissed(true);
    setIsPlaying(false);
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
  };

  const youtubeId = activeBroadcast?.message || '';

  // React to realtime broadcast updates if the user is already listening
  useEffect(() => {
    if (isPlaying && iframeRef.current && youtubeId) {
      iframeRef.current.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=0&playsinline=1&enablejsapi=1`;
    }
  }, [youtubeId, isPlaying]);

  if (!activeBroadcast || isDismissed) return null;

  return (
    <div
      className="glass"
      style={{
        position: 'fixed',
        top: 'calc(12px + var(--safe-top, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '520px',
        zIndex: 9999,
        padding: '0.75rem 1rem',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(239, 68, 68, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
        {/* Pulsing broadcast icon */}
        <div style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
          <div
            className="live-dot-pulse"
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
            }}
          />
          <Megaphone size={14} color="#f87171" style={{ position: 'absolute', top: -14, left: -2 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Live Audio Guide
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isPlaying ? 'Streaming live audio...' : 'Host is broadcasting announcement'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {isPlaying ? (
          <button
            onClick={handleMute}
            className="btn btn-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <VolumeX size={12} />
            Mute
          </button>
        ) : (
          <button
            onClick={handleListen}
            className="btn btn-sm btn-primary"
            style={{
              padding: '0.25rem 0.6rem',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Volume2 size={12} />
            Listen
          </button>
        )}

        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-muted)',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
          }}
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>

      {/* 
        Always-in-DOM YouTube Iframe for iOS gesture tracking compatibility.
        iOS Safari freezes player if width/height is too small or if it is offscreen/hidden.
        We keep it 200px x 120px and position it layered behind the viewport elements using zIndex.
      */}
      {youtubeId && (
        <iframe
          ref={iframeRef}
          width="200"
          height="120"
          src="about:blank"
          title="Live Broadcast Audio Stream"
          allow="autoplay; encrypted-media"
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            width: '200px',
            height: '120px',
            zIndex: -1000,
            pointerEvents: 'none',
            opacity: 0.99,
            border: 'none',
          }}
        />
      )}
    </div>
  );
}
