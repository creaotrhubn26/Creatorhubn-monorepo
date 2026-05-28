import { useEffect, useRef } from 'react';

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

function getAuthToken(): string {
  // Role Room lagrer tokenet i role_room_auth_token (TOKEN_STORAGE_KEY).
  // Uten denne fallback-en sendes presence/heartbeat uten Bearer-token
  // når brukeren kom inn via Role Room-flowen → 401 hvert 30. sek.
  return (
    window.localStorage.getItem('creatorhub_auth_token')
    || window.localStorage.getItem('role_room_auth_token')
    || window.localStorage.getItem('authToken')
    || ''
  );
}

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
      const token = getAuthToken();
      if (!token) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      const isIdle = Date.now() - lastInputRef.current > IDLE_THRESHOLD_MS;
      const route = typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`.slice(0, 200)
        : null;

      try {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
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
