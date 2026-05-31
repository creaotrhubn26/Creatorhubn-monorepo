/**
 * Real-time collaboration skeleton — workflow-audit G25/J1.
 *
 * Dette er en kontrakts-definisjon + NO-OP-implementasjon for senere
 * WebSocket/Yjs-integrasjon. Ingenting persisterer i denne fila — den
 * eksisterer så fremtidige sesjoner kan svippe ut implementasjonen uten
 * å endre callsite.
 *
 * Tre planlagte mekanismer:
 *   1. Presence — vis hvem andre som ser på samme prosjekt nå (avatar-strip)
 *   2. Shared cursors — pos pos for hver collaborator (subtile sirkler)
 *   3. CRDT-state-sync — Yjs/Liveblocks erstatter autosave i en senere fase
 *
 * For nå returnerer hooken tom presence-array og no-op-broadcast.
 */
import React from 'react';

export interface DancePresenceUser {
  /** Stabil bruker-ID. */
  userId: string;
  /** Visningsnavn. */
  displayName: string;
  /** Avatar-farge (hex). */
  color: string;
  /** Sist sett (ms-epoch). Brukes for inaktiv-fade. */
  lastSeenMs: number;
}

export interface DancePresenceCursor {
  userId: string;
  /** Normalisert (0..1) på Fabric-stagen. Undefined = utenfor stage. */
  x?: number;
  y?: number;
}

export interface UseDanceRealtimePresenceOptions {
  projectId: string | null;
  /** Hopp over reell tilkobling — for tester. */
  disabled?: boolean;
}

export interface DanceRealtimeHandle {
  users: readonly DancePresenceUser[];
  cursors: readonly DancePresenceCursor[];
  /** Broadcast vår cursor til andre. NO-OP inntil WS-server-side er bygget. */
  broadcastCursor: (x: number | null, y: number | null) => void;
  /** Sant når socket er etablert. */
  connected: boolean;
}

/**
 * G25/J1 hovedhook. Senere implementasjon kobler til
 * `/api/dance/realtime?projectId=…` og bygger over en CRDT-protokoll.
 *
 * Inntil videre returnerer den NO-OP — så callsite (FormationsTabBody)
 * kan rendre presence-strip og cursor-overlays uten å vente på server-arbeid.
 */
export function useDanceRealtimePresence(
  options: UseDanceRealtimePresenceOptions,
): DanceRealtimeHandle {
  const [users] = React.useState<readonly DancePresenceUser[]>([]);
  const [cursors] = React.useState<readonly DancePresenceCursor[]>([]);
  const [connected] = React.useState<boolean>(false);

  // NO-OP — fremtidig: opprett WebSocket, lytt på presence-events, etc.
  React.useEffect(() => {
    if (options.disabled || !options.projectId) return;
    // TODO (G25): WebSocket-tilkobling
    //   const ws = new WebSocket(`/api/dance/realtime?projectId=${options.projectId}`);
    //   ws.onmessage = (msg) => { ... }
    //   return () => ws.close();
    return undefined;
  }, [options.disabled, options.projectId]);

  const broadcastCursor = React.useCallback((_x: number | null, _y: number | null): void => {
    // TODO (G25): send `{ type: 'cursor', x, y }` over WS
  }, []);

  return { users, cursors, broadcastCursor, connected };
}

/**
 * Backend-skeleton-spec (for referanse — IKKE implementert ennå):
 *
 *   Endpoint: GET /api/dance/realtime (upgrade til WebSocket)
 *   Query: ?projectId=<id>
 *   Auth: cookie/bearer (samme som /api/dance/formations)
 *
 *   Server pusher:
 *     { type: 'presence:join', userId, displayName, color }
 *     { type: 'presence:leave', userId }
 *     { type: 'cursor', userId, x, y }
 *
 *   Client sender:
 *     { type: 'cursor', x, y }    — broadcastes til andre clients i samme rom
 *     { type: 'ping' }            — keep-alive (server svarer 'pong')
 *
 *   Skala-strategi: ÉN socket per (userId, projectId). Server holder rom-
 *   medlemskap i memory + Redis pub/sub for multi-instance.
 */
