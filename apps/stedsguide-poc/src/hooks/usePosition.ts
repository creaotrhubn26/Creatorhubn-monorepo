import { useEffect, useState } from 'react';
import type { LatLng } from '../data/types';

export type PositionStatus = 'locating' | 'ok' | 'denied' | 'unavailable' | 'demo';

/** Jernbanetorget, Oslo – brukes når ekte posisjon mangler. */
export const FALLBACK_POSITION: LatLng = { lat: 59.9111, lng: 10.7503 };

export interface PositionState {
  position: LatLng;
  status: PositionStatus;
}

/**
 * Følger enhetens posisjon. `override` (demo-posisjon) vinner alltid.
 * Uten tillatelse eller støtte faller vi tilbake til Oslo sentrum, med
 * tydelig status slik at UI-et kan si fra.
 */
export function usePosition(override: LatLng | null): PositionState {
  const [real, setReal] = useState<PositionState>({ position: FALLBACK_POSITION, status: 'locating' });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setReal({ position: FALLBACK_POSITION, status: 'unavailable' });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => setReal({ position: { lat: p.coords.latitude, lng: p.coords.longitude }, status: 'ok' }),
      (err) =>
        setReal({
          position: FALLBACK_POSITION,
          status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
        }),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  if (override) return { position: override, status: 'demo' };
  return real;
}
