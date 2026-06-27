// @ts-nocheck
/**
 * useCaptureRealtime — sanntid fra Capture-appen til web-workspacet.
 *
 * Kobler til den eksisterende capture-WebSocket-en
 * (`/api/capture/ws/sessions/:sessionId?token=…`, rom-scopet per session,
 * `broadcastCaptureEvent` fyrer på asset-opplasting/rating/selections). Bruker
 * web sin egen session-token (creatorhub_auth_token) — samme som validerer
 * mot creatorhub_auth_sessions. På hver hendelse kalles onEvent (typisk refetch),
 * så panelene oppdateres INSTANT i stedet for poll-forsinkelse. Poll forblir
 * fallback når WS er nede. Auto-reconnect.
 */
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

// Prod-backend (WS kan ikke gå via Vercel-rewrites — direkte til Render).
const WS_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BASE)
  ? import.meta.env.VITE_WS_BASE
  : 'wss://creatorhub-backend-rtbl.onrender.com';

export function useCaptureRealtime(projectId: string, onEvent?: (payload: any) => void) {
  const [live, setLive] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!projectId || projectId === 'sample') return;
    const token = localStorage.getItem('creatorhub_auth_token') || localStorage.getItem('token') || localStorage.getItem('role_room_auth_token');
    if (!token) return;

    let alive = true;
    let ws: WebSocket | null = null;
    let retry: any = null;

    const connect = async () => {
      if (!alive) return;
      // Finn aktiv capture-session for prosjektet.
      let sid: string | null = null;
      try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/capture-status`); sid = r?.session?.id || null; } catch { /* */ }
      if (!sid || !alive) { retry = setTimeout(connect, 15000); return; } // ingen session ennå — prøv igjen senere
      try {
        ws = new WebSocket(`${WS_BASE}/api/capture/ws/sessions/${sid}?token=${encodeURIComponent(token)}`);
        ws.onopen = () => { if (alive) setLive(true); };
        ws.onmessage = (ev) => {
          let payload: any = null;
          try { payload = JSON.parse(ev.data); } catch { /* heartbeat/non-json */ }
          if (payload?.type === 'ping' || payload?.heartbeat) return;
          onEventRef.current && onEventRef.current(payload);
        };
        ws.onclose = () => { if (alive) { setLive(false); retry = setTimeout(connect, 5000); } };
        ws.onerror = () => { try { ws && ws.close(); } catch { /* */ } };
      } catch { retry = setTimeout(connect, 8000); }
    };
    connect();

    // Pause/gjenoppta ved fane-bytte (spar tilkobling).
    const onVis = () => { if (!document.hidden && (!ws || ws.readyState > 1)) connect(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      alive = false; clearTimeout(retry); document.removeEventListener('visibilitychange', onVis);
      try { ws && ws.close(); } catch { /* */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return { live };
}
