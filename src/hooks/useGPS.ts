import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GPSPermission = 'granted' | 'denied' | 'prompt' | 'unavailable' | 'loading';

export interface GPSState {
  permission: GPSPermission;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  requestPermission: () => void;
}

// Anonymous visitors get a stable session_id from localStorage
function getAnonymousSessionId(): string {
  const key = 'exnav_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// How often to push location to Supabase (ms)
const SYNC_INTERVAL_MS = 10_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGPS(): GPSState {
  const { user } = useAuth();
  const [permission, setPermission] = useState<GPSPermission>('loading');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // BUG FIX: use refs to prevent duplicate watchers & intervals
  const watchIdRef = useRef<number | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestCoordsRef = useRef<{ lat: number; lng: number; acc: number | null } | null>(null);
  // Track if we already inserted the initial anonymous row
  const anonRowIdRef = useRef<string | null>(null);

  // Push location to Supabase visitor_locations
  const syncLocation = useCallback(async () => {
    if (!latestCoordsRef.current) return;
    const { lat, lng, acc } = latestCoordsRef.current;

    if (user?.id) {
      // Authenticated: upsert by user_id (unique constraint)
      await supabase
        .from('visitor_locations')
        .upsert(
          {
            user_id: user.id,
            session_id: null,
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    } else {
      // Anonymous: update existing row by its known UUID, or insert once
      // BUG FIX: Never upsert on 'id' (auto-generated) — it always inserts new rows.
      // Instead: insert once, save the returned id, then UPDATE by that id.
      if (anonRowIdRef.current) {
        // Update the existing row
        await supabase
          .from('visitor_locations')
          .update({
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            updated_at: new Date().toISOString(),
          })
          .eq('id', anonRowIdRef.current);
      } else {
        // First sync for this anonymous session — insert a new row
        const { data } = await supabase
          .from('visitor_locations')
          .insert({
            user_id: null,
            session_id: getAnonymousSessionId(),
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (data?.id) {
          anonRowIdRef.current = data.id;
        }
      }
    }
  }, [user]);

  // BUG FIX: Guard against duplicate watchers — only start if not already running
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setPermission('unavailable');
      setError('GPS is not supported by your browser.');
      return;
    }

    // Don't start a second watcher if one is already active
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        setLatitude(lat);
        setLongitude(lng);
        setAccuracy(acc);
        setError(null);
        setPermission('granted');
        latestCoordsRef.current = { lat, lng, acc };
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied');
          setError('GPS permission denied. Please enable location access in your browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('GPS signal unavailable. Please try again outside or near a window.');
        } else {
          setError('GPS request timed out. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    // Start periodic sync — guard against duplicate intervals
    if (syncTimerRef.current === null) {
      syncTimerRef.current = setInterval(syncLocation, SYNC_INTERVAL_MS);
    }
  }, [syncLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (syncTimerRef.current !== null) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  }, []);

  // Check permission state and start tracking on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermission('unavailable');
      return;
    }

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        setPermission(result.state as GPSPermission);
        if (result.state === 'granted') startTracking();

        // Listen for future permission changes
        result.addEventListener('change', () => {
          setPermission(result.state as GPSPermission);
          if (result.state === 'granted') startTracking();
          else stopTracking();
        });
      })
      .catch(() => {
        // navigator.permissions API not supported — try tracking directly
        startTracking();
      });

    return stopTracking;
  }, []); // Empty deps: only run on mount/unmount — startTracking guards itself internally

  // When user logs in/out, reset the anon row ref and restart sync
  useEffect(() => {
    anonRowIdRef.current = null;
  }, [user?.id]);

  const requestPermission = useCallback(() => {
    startTracking();
  }, [startTracking]);

  return { permission, latitude, longitude, accuracy, error, requestPermission };
}
