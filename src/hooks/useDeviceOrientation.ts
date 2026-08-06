import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompassPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';

export interface DeviceOrientationState {
  /** Device heading in degrees clockwise from North (0–360), or null if unavailable. */
  heading: number | null;
  /** Current permission status for the device compass. */
  permission: CompassPermission;
  /**
   * Call this inside a user-gesture handler (button click) to request
   * compass permission on iOS 13+. On Android this is a no-op.
   */
  requestPermission: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Linearly interpolate between two compass angles (handles 0°/360° wraparound).
 * alpha = 0 → stay at prev; alpha = 1 → jump immediately to next.
 * Using alpha = 0.18 gives a smooth ~5-frame lag which eliminates jitter.
 */
function lerpAngle(prev: number, next: number, alpha: number): number {
  let diff = next - prev;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (prev + alpha * diff + 360) % 360;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useDeviceOrientation
 *
 * Reads the device compass via the DeviceOrientation API with cross-platform support:
 *
 *  • iOS 13+  — requires an explicit user-gesture permission tap.
 *               Heading comes from `event.webkitCompassHeading` (0 = North).
 *
 *  • Android  — no permission step. Prefers the `deviceorientationabsolute`
 *               event (North-referenced); falls back to regular
 *               `deviceorientation` if absolute is unavailable.
 *
 *  • Desktop  — DeviceOrientationEvent exists but never fires meaningful
 *               values → heading stays null.
 *
 * The raw heading is smoothed with a low-pass angular interpolation filter
 * (α = 0.18) to eliminate compass jitter without introducing visible lag.
 */
export function useDeviceOrientation(): DeviceOrientationState {
  const [heading, setHeading] = useState<number | null>(null);
  const [permission, setPermission] = useState<CompassPermission>('unknown');

  // Track previous heading for the low-pass filter
  const prevHeadingRef = useRef<number | null>(null);
  // Track last time the 'deviceorientationabsolute' event fired on Android,
  // so we can ignore the lower-accuracy regular 'deviceorientation' event.
  const lastAbsoluteTimeRef = useRef<number>(0);

  /** Apply low-pass filter and update heading state. */
  const updateHeading = useCallback((raw: number) => {
    let smoothed = raw;
    if (prevHeadingRef.current !== null) {
      smoothed = lerpAngle(prevHeadingRef.current, raw, 0.18);
    }
    prevHeadingRef.current = smoothed;
    setHeading(Math.round(smoothed));
    setPermission('granted');
  }, []);

  /**
   * Handler for the `deviceorientationabsolute` event (Android).
   * alpha = 0 means the device's top edge points to magnetic North.
   * Convert: compassHeading = (360 - alpha) mod 360.
   */
  const handleAbsolute = useCallback(
    (event: DeviceOrientationEvent) => {
      if (event.alpha != null) {
        lastAbsoluteTimeRef.current = Date.now();
        updateHeading((360 - event.alpha) % 360);
      }
    },
    [updateHeading]
  );

  /**
   * Handler for the standard `deviceorientation` event.
   * On iOS:     `webkitCompassHeading` is present and gives true North heading.
   * On Android: `webkitCompassHeading` is absent; fall back to alpha only if
   *             `deviceorientationabsolute` hasn't fired recently (>200ms ago),
   *             because absolute is more accurate.
   */
  const handleOrientation = useCallback(
    (event: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      if (event.webkitCompassHeading != null) {
        // iOS: direct true-north heading
        updateHeading(event.webkitCompassHeading);
      } else if (
        event.alpha != null &&
        Date.now() - lastAbsoluteTimeRef.current > 200
      ) {
        // Android fallback when absolute event is not available
        updateHeading((360 - event.alpha) % 360);
      }
    },
    [updateHeading]
  );

  const startListening = useCallback(() => {
    // Prefer absolute (North-referenced) event on Android
    window.addEventListener(
      'deviceorientationabsolute',
      handleAbsolute as EventListener,
      true
    );
    // Standard event handles iOS webkitCompassHeading + Android fallback
    window.addEventListener(
      'deviceorientation',
      handleOrientation as EventListener,
      true
    );
  }, [handleAbsolute, handleOrientation]);

  const stopListening = useCallback(() => {
    window.removeEventListener(
      'deviceorientationabsolute',
      handleAbsolute as EventListener,
      true
    );
    window.removeEventListener(
      'deviceorientation',
      handleOrientation as EventListener,
      true
    );
  }, [handleAbsolute, handleOrientation]);

  /**
   * Must be called inside a user-gesture handler (button onClick).
   * On iOS 13+: prompts the system permission dialog.
   * On Android + desktop: starts listening immediately (no dialog needed).
   */
  const requestPermission = useCallback(async () => {
    // iOS 13+ requires explicit permission via a user gesture
    const DoE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };

    if (typeof DoE.requestPermission === 'function') {
      try {
        const result = await DoE.requestPermission();
        if (result === 'granted') {
          setPermission('granted');
          startListening();
        } else {
          setPermission('denied');
        }
      } catch {
        setPermission('denied');
      }
    } else {
      // Non-iOS: no permission needed, start immediately
      setPermission('granted');
      startListening();
    }
  }, [startListening]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setPermission('unavailable');
      return;
    }

    const DoE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };

    if (typeof DoE.requestPermission === 'function') {
      // iOS 13+: cannot start without a user gesture — show the enable button
      setPermission('unknown');
    } else {
      // Android & desktop: start listening immediately
      setPermission('granted');
      startListening();
    }

    return stopListening;
  }, [startListening, stopListening]);

  return { heading, permission, requestPermission };
}
