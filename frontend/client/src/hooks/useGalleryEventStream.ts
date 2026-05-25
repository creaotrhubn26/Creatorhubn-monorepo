/**
 * useGalleryEventStream — Slice 9X.85
 *
 * Lytter på backend sin per-bruker WS (/api/ipad/ws/events?token=...) og
 * surfacer galleri-relaterte broadcast-events til admin-UI:
 *   - "video.comment-added"          — ny klient-kommentar på timecode
 *   - "gallery.selection-submitted"  — klient submittet favoritt-utvalg
 *
 * Hook returnerer ingen state — den invaliderer React Query-cache og
 * kaller `onEvent`-callback med en formatert payload som caller-en kan
 * vise som toast. Holder seg stille (returnerer null) hvis bruker ikke
 * er innlogget eller env mangler WS-URL.
 *
 * Bruk:
 *   useGalleryEventStream({
 *     onEvent: (e) => enqueueSnackbar(e.message),
 *   });
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CREATORHUB_AUTH_TOKEN_KEY } from '@/lib/creatorhubGoogleAuth';

interface GalleryEventMessage {
  kind: 'video.comment-added' | 'gallery.selection-submitted';
  message: string;
  galleryId: string;
  raw: Record<string, unknown>;
}

interface Options {
  enabled?: boolean;
  onEvent?: (event: GalleryEventMessage) => void;
}

function buildWsUrl(token: string): string | null {
  if (typeof window === 'undefined') return null;
  const configured = typeof import.meta.env.VITE_WS_URL === 'string'
    ? (import.meta.env.VITE_WS_URL as string).trim() : '';
  const apiTarget = typeof import.meta.env.VITE_API_PROXY_TARGET === 'string'
    ? (import.meta.env.VITE_API_PROXY_TARGET as string).trim() : '';
  const isProd = !import.meta.env.DEV
    && !['localhost', '127.0.0.1'].includes(window.location.hostname);
  // Prod uten eksplisitt WS-URL: returner null så vi ikke spammer
  // koblings-feil mot Vercel (som ikke proxy-er WS).
  if (isProd && !configured) return null;
  const base = configured
    || (apiTarget || `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${window.location.host}`)
      .replace(/^http/i, 'ws');
  try {
    const url = new URL(base);
    url.pathname = '/api/ipad/ws/events';
    url.searchParams.set('token', token);
    return url.toString();
  } catch {
    return null;
  }
}

export function useGalleryEventStream({ enabled = true, onEvent }: Options = {}): void {
  const queryClient = useQueryClient();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const token = window.localStorage.getItem(CREATORHUB_AUTH_TOKEN_KEY);
    if (!token) return;
    const wsUrl = buildWsUrl(token);
    if (!wsUrl) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.addEventListener('open', () => {
        attempts = 0;
      });
      ws.addEventListener('message', (e) => {
        try {
          const payload = JSON.parse(e.data) as Record<string, unknown>;
          if (payload?.kind === 'video.comment-added') {
            const galleryId = String(payload.galleryId || '');
            const label = (payload.clientLabel as string | null) || 'En klient';
            const cat = payload.category ? ` (${payload.category})` : '';
            queryClient.invalidateQueries({
              queryKey: ['/api/photographer/galleries', galleryId, 'video-comments'],
            });
            queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
            onEventRef.current?.({
              kind: 'video.comment-added',
              message: `${label} la til en kommentar${cat}`,
              galleryId,
              raw: payload,
            });
            return;
          }
          if (payload?.kind === 'gallery.selection-submitted') {
            const galleryId = String(payload.galleryId || '');
            const label = (payload.clientName as string | null) || (payload.clientEmail as string | null) || 'En klient';
            const count = Number(payload.selectedCount ?? 0);
            queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
            onEventRef.current?.({
              kind: 'gallery.selection-submitted',
              message: `${label} submittet utvalg (${count} bilder)`,
              galleryId,
              raw: payload,
            });
            return;
          }
        } catch {
          // ignore malformed frames
        }
      });
      ws.addEventListener('close', () => {
        scheduleReconnect();
      });
      ws.addEventListener('error', () => {
        try { ws?.close(); } catch { /* */ }
      });
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(30000, 1000 * Math.pow(2, attempts));
      attempts++;
      reconnectTimer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch { /* */ }
    };
  }, [enabled, queryClient]);
}

export default useGalleryEventStream;
