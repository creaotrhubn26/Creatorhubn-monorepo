import type { IncomingMessage, Server as HttpServer } from "http";
import type { Duplex } from "stream";
import { WebSocket, WebSocketServer } from "ws";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";

/**
 * User-scoped realtime events channel. Complements the existing
 * per-session ``attachCaptureWebSocket`` — that one fans out events
 * inside a single capture session (tethered camera control, live
 * preview), while this one delivers cross-session events to the
 * owner-user (iPad gets notified when a client hearts a photo, signs
 * a quote, leaves a comment, etc.).
 *
 * Why a separate channel?
 *   * Different authorization model: session-scoped WS checks
 *     ``session.ownerUserId``; this channel authorises by the bearer
 *     token only, then routes by userId.
 *   * Different lifecycle: the iPad needs to subscribe on sign-in
 *     and keep the socket open across app launches. Session-scoped
 *     WS is created + torn down per capture session.
 *   * Different fanout: this channel broadcasts to all sockets
 *     belonging to a user (their iPad + web tabs), so hearts + signs
 *     land immediately wherever the photographer is looking.
 *
 * Protocol: server → client JSON frames
 *   { type: "connection_established", serverTime }
 *   { type: "user_event", event: UserEvent, serverTime }
 *   UserEvent is a discriminated union on ``kind``; unknown kinds
 *   are preserved verbatim so older clients can safely drop frames.
 *
 * The broadcast helper is exported so route handlers (client-gallery
 * heart endpoint, quote sign endpoint, etc.) can notify without
 * knowing the socket plumbing.
 */

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  [key: string]: unknown;
}

/// Supported event shapes. Each event is tagged with a ``kind`` so
/// the client can switch on it without `instanceof` checks. Adding a
/// new kind is additive — old clients ignore unknown kinds.
export type UserEvent =
  | {
      kind: "asset.hearted";
      assetId: string;
      sessionId: string;
      clientName: string | null;
      hearted: boolean;
      timestamp: string;
    }
  | {
      kind: "asset.commented";
      assetId: string;
      sessionId: string;
      clientName: string | null;
      preview: string;
      timestamp: string;
    }
  | {
      kind: "quote.signed";
      quoteId: string;
      clientName: string | null;
      signerKind: "client" | "photographer";
      timestamp: string;
    }
  | {
      kind: "contract.signed";
      contractId: string;
      clientName: string | null;
      signerKind: "client" | "photographer";
      timestamp: string;
    };

export const USER_EVENTS_WS_PATH = "/api/ipad/ws/events";

/// Client registry: userId → set of open WebSocket instances. A
/// single photographer might have two tabs + one iPad, and we want
/// every event to reach every socket. Map-keyed on userId rather
/// than token so a token refresh doesn't require reconnecting.
const userClients = new Map<string, Set<WebSocket>>();

/// Broadcast an event to every socket currently bound to
/// ``userId``. No-op when nobody is connected (common — the iPad
/// sleeps, the photographer's on lunch). Errors during send are
/// swallowed because the socket's own ``error``/``close`` handlers
/// will clean up the entry.
export function broadcastUserEvent(userId: string, event: UserEvent): void {
  const clients = userClients.get(userId);
  if (!clients || clients.size === 0) return;
  const message = JSON.stringify({
    type: "user_event",
    event,
    serverTime: new Date().toISOString(),
  });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch {
        // handler will clean up
      }
    }
  }
}

/// Return the number of sockets currently bound to ``userId``.
/// Exposed for tests + diagnostics; not a load-bearing API.
export function connectedUserClientCount(userId: string): number {
  return userClients.get(userId)?.size ?? 0;
}

/// Test-only: drop every registered socket. Lets the vitest suite
/// reset state between cases without exposing the Map itself.
export function resetUserClientsForTests(): void {
  for (const set of userClients.values()) {
    for (const ws of set) {
      try {
        ws.close();
      } catch { /* ignore */ }
    }
  }
  userClients.clear();
}

/// Internal registry API exposed only for the test harness to
/// simulate "a client is connected". Production code goes through
/// the HTTP upgrade path.
export function registerUserClientForTests(
  userId: string,
  ws: WebSocket,
): () => void {
  return registerClient(userId, ws);
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

export function attachUserEventsWebSocket(
  server: HttpServer,
  pool: Pool,
  activeSessions?: Map<string, SessionData>,
): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname !== USER_EVENTS_WS_PATH) return;

    const token = (url.searchParams.get("token") ?? "").trim();

    void (async () => {
      const session = await resolveBearerSession(pool, activeSessions, token);
      if (!session?.userId) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        registerClient(session.userId, ws);
      });
    })().catch(() => {
      socket.destroy();
    });
  });
}

function registerClient(userId: string, ws: WebSocket): () => void {
  const set = userClients.get(userId) ?? new Set<WebSocket>();
  set.add(ws);
  userClients.set(userId, set);

  try {
    ws.send(
      JSON.stringify({
        type: "connection_established",
        serverTime: new Date().toISOString(),
      }),
    );
  } catch { /* closed before first frame */ }

  const cleanup = () => {
    set.delete(ws);
    if (set.size === 0) {
      userClients.delete(userId);
    }
  };

  ws.on("close", cleanup);
  ws.on("error", () => {
    try {
      ws.terminate();
    } catch { /* ignore */ }
  });

  return cleanup;
}
