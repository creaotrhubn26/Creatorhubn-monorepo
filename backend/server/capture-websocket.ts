import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Duplex } from 'stream';
import { createHash } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import type { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { captureSessions } from '../migrations/capture-schema.js';
import { loadPersistedAuthSession } from './auth-session-store.js';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

const SESSION_PATH_RE = /^\/api\/capture\/ws\/sessions\/([0-9a-f-]{36})$/;

const sessionClients = new Map<string, Set<WebSocket>>();

export function broadcastCaptureEvent(sessionId: string, payload: unknown): void {
  const clients = sessionClients.get(sessionId);
  if (!clients || clients.size === 0) return;
  const message = JSON.stringify({
    type: 'capture_event',
    sessionId,
    payload,
    serverTime: new Date().toISOString(),
  });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch {
        // swallow — socket will close itself and we'll clean up in the close handler
      }
    }
  }
}

async function resolveBearerSession(
  pool: Pool,
  activeSessions: Map<string, SessionData> | undefined,
  token: string,
): Promise<SessionData | null> {
  if (!token) return null;
  const inMemory = activeSessions?.get(token) ?? null;
  if (inMemory) return inMemory;
  const persisted = await loadPersistedAuthSession<SessionData>(pool, token);
  if (persisted) {
    activeSessions?.set(token, persisted);
    return persisted;
  }
  return null;
}

async function ownsSession(
  pool: Pool,
  sessionId: string,
  ownerUserId: string,
): Promise<boolean> {
  const db = drizzle(pool);
  const rows = await db
    .select({ id: captureSessions.id })
    .from(captureSessions)
    .where(
      and(eq(captureSessions.id, sessionId), eq(captureSessions.ownerUserId, ownerUserId)),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Helper-token-fallback for Creatorhub One Desk. Brukes når query
 * `token` ikke matcher en user-session — vi sjekker da om det er en
 * gyldig DIT helper-token, og om så er, om dens project_id matcher
 * capture-sessionens project_id.
 *
 * Token-mønsteret er identisk med backend/server/dit-backup-routes.ts:
 *   SHA-256-hashes og sammenlignes med token_hash i dit_helper_tokens.
 *   Sjekker revoked_at IS NULL AND expires_at > now().
 *
 * Returnerer true hvis Desk skal få lov å subscribe.
 */
async function helperTokenAuthorizes(
  pool: Pool,
  sessionId: string,
  token: string,
): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  try {
    const tokenRows = await pool.query<{ project_id: string }>(
      `SELECT project_id FROM dit_helper_tokens
       WHERE token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > now()`,
      [tokenHash],
    );
    if (tokenRows.rows.length === 0) return false;
    const projectId = tokenRows.rows[0].project_id;

    const sessionRows = await pool.query<{ project_id: string | null }>(
      `SELECT project_id FROM capture_sessions WHERE id = $1`,
      [sessionId],
    );
    if (sessionRows.rows.length === 0) return false;
    return sessionRows.rows[0].project_id === projectId;
  } catch {
    return false;
  }
}

export function attachCaptureWebSocket(
  server: HttpServer,
  pool: Pool,
  activeSessions?: Map<string, SessionData>,
): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const match = url.pathname.match(SESSION_PATH_RE);
    if (!match) return;

    const sessionId = match[1];
    const token = (url.searchParams.get('token') ?? '').trim();

    void (async () => {
      const session = await resolveBearerSession(pool, activeSessions, token);
      if (session?.userId) {
        const owns = await ownsSession(pool, sessionId, session.userId);
        if (!owns) {
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          registerClient(sessionId, ws);
        });
        return;
      }

      // Fallback: DIT helper-token (Creatorhub One Desk). Tillates hvis
      // tokenets project_id matcher capture_sessionens project_id.
      const helperAuthorized = await helperTokenAuthorizes(pool, sessionId, token);
      if (helperAuthorized) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          registerClient(sessionId, ws);
        });
        return;
      }

      socket.destroy();
    })().catch(() => {
      socket.destroy();
    });
  });
}

function registerClient(sessionId: string, ws: WebSocket): void {
  const set = sessionClients.get(sessionId) ?? new Set<WebSocket>();
  set.add(ws);
  sessionClients.set(sessionId, set);

  ws.send(
    JSON.stringify({
      type: 'connection_established',
      sessionId,
      serverTime: new Date().toISOString(),
    }),
  );

  ws.on('pong', () => {
    // heartbeat: node ws emits this on incoming pongs; no-op handler keeps socket alive
  });

  ws.on('close', () => {
    set.delete(ws);
    if (set.size === 0) {
      sessionClients.delete(sessionId);
    }
  });

  ws.on('error', () => {
    try {
      ws.terminate();
    } catch {
      // ignore
    }
  });
}

/** Exposed for tests + diagnostics. */
export function connectedClientCount(sessionId: string): number {
  return sessionClients.get(sessionId)?.size ?? 0;
}
