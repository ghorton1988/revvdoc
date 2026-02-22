'use client';

/**
 * useGeoLocation — wrapper around navigator.geolocation.watchPosition().
 *
 * Used by TechLocationBroadcaster on the technician's active job page.
 * Automatically clears the watcher on unmount.
 *
 * Position updates are passed to the callback with throttle logic applied
 * by the TechLocationBroadcaster component (>10m moved AND >5s elapsed).
 */

import { useState, useEffect, useRef } from 'react';

export interface GeoState {
  position: GeolocationPosition | null;
  error: string | null;
  supported: boolean;
}

export function useGeoLocation(enabled: boolean): GeoState {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !supported) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition(pos);
        setError(null);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please enable it in your browser settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable. Check your device GPS.');
            break;
          case err.TIMEOUT:
            setError('Location request timed out. Retrying…');
            break;
          default:
            setError('Unable to determine location.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, supported]);

  return { position, error, supported };
}
