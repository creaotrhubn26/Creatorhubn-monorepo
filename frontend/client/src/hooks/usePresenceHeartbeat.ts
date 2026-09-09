import { useEffect, useRef } from 'react';
import authSessionService from '../components/role-room/services/authSessionService';

/**
 * Pinger POST /api/presence/heartbeat hvert 30 sek mens tab er aktiv.
 * Pauser når tab er hidden (sparer batteri + servers).
 * Markerer is_idle=true hvis ingen input på 15+ min.
 *
 * Bruker auth-token fra localStorage (samme som adminRoomApi).
 */

const HEARTBEAT_INTERVAL_MS = 30_000;
const IDLE_THRESHOLD_MS = 15 * 60 * 1000;
const INPUT_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'scroll'];

export function usePresenceHeartbeat(enabled = true): void {
  const lastInputRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    const markInput = () => { lastInputRef.current = Date.now(); };
    for (const event of INPUT_EVENTS) {
      window.addEventListener(event, markInput, { passive: true });
    }

    async function ping() {
      // Role Room kan ha både et eldre CreatorHub-token og en aktiv
      // Role Room-sesjon i localStorage. Session-servicen kjenner hvilken
      // token som faktisk er aktiv og prioriterer den samme veien som resten
      // av Role Room-API-et.
      const authHeaders = authSessionService.getAuthHeadersSync();
      if (!authHeaders.Authorization) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

      const isIdle = Date.now() - lastInputRef.current > IDLE_THRESHOLD_MS;
      const route = typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`.slice(0, 200)
        : null;

      try {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          credentials: 'include',
          body: JSON.stringify({ route, idle: isIdle }),
          keepalive: true,
        });
      } catch {
        // Stille — neste tick prøver igjen.
      }
    }

    // Første ping rett etter mount, deretter hver 30s
    void ping();
    timerRef.current = setInterval(() => { void ping(); }, HEARTBEAT_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        lastInputRef.current = Date.now();
        void ping();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      for (const event of INPUT_EVENTS) {
        window.removeEventListener(event, markInput);
      }
    };
  }, [enabled]);
}
