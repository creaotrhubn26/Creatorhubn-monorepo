import type { IncomingMessage, Server as HttpServer } from "http";
import type { Duplex } from "stream";
import type express from "express";
import { WebSocket, WebSocketServer } from "ws";
import type { Pool } from "pg";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import {
  USER_EVENTS_PROTOCOL_VERSION,
  type UserEvent,
  type UserEventsFrame,
} from "../../frontend/shared/realtime-user-events-contract.js";
import {
  consumeUserEventsTicket,
  issueUserEventsTicket,
  USER_EVENTS_TICKET_TTL_MS,
} from "./realtime-user-event-ticket-store.js";
import { publishRealtimeUserEvent } from "./realtime-user-event-fanout.js";

export {
  consumeUserEventsTicket,
  issueUserEventsTicket,
  USER_EVENTS_TICKET_TTL_MS,
} from "./realtime-user-event-ticket-store.js";

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
 *     ``session.ownerUserId``; this channel consumes a short-lived
 *     user-scoped ticket, then routes by userId.
 *   * Different lifecycle: the iPad needs to subscribe on sign-in
 *     and keep the socket open across app launches. Session-scoped
 *     WS is created + torn down per capture session.
 *   * Different fanout: this channel broadcasts to all sockets
 *     belonging to a user (their iPad + web tabs), so hearts + signs
 *     land immediately wherever the photographer is looking.
 *
 * Protocol: server → client JSON frames
 *   { version: 1, type: "connection_established", serverTime }
 *   { version: 1, type: "user_event", event: UserEvent, serverTime }
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

export type { UserEvent } from "../../frontend/shared/realtime-user-events-contract.js";

export const USER_EVENTS_WS_PATH = "/api/ipad/ws/events";
export const USER_EVENTS_TICKET_PATH = "/api/realtime/user-events-ticket";

export function isLegacyUserEventsTokenAllowed(): boolean {
  const configured = process.env.REALTIME_ALLOW_LEGACY_TOKEN?.trim().toLowerCase();
  if (!configured) return true;
  return !["0", "false", "no", "off"].includes(configured);
}

interface UserEventsTicketDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string } | null;
}

export function setupUserEventsTicketRoute({
  app,
  pool,
  requireUserSession,
}: UserEventsTicketDeps): void {
  app.post(USER_EVENTS_TICKET_PATH, async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const issued = await issueUserEventsTicket(pool, session.userId);
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.status(201).json({
        ...issued,
        websocketPath: USER_EVENTS_WS_PATH,
        protocolVersion: USER_EVENTS_PROTOCOL_VERSION,
      });
    } catch (error) {
      console.error("Failed to issue realtime user-events ticket:", error);
      res.status(503).json({ error: "realtime_ticket_store_unavailable" });
    }
  });
}

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
  deliverUserEventLocally(userId, event);
  void publishRealtimeUserEvent(userId, event).catch((error) => {
    console.error(
      "[realtime-fanout] Could not publish user event:",
      error instanceof Error ? error.message : "unknown error",
    );
  });
}

/// Deliver only to sockets owned by this process. Redis subscribers call this
/// path directly so a remote event is never published back into the channel.
export function deliverUserEventLocally(userId: string, event: UserEvent): void {
  const clients = userClients.get(userId);
  if (!clients || clients.size === 0) return;
  const frame = {
    version: USER_EVENTS_PROTOCOL_VERSION,
    type: "user_event",
    event,
    serverTime: new Date().toISOString(),
  } satisfies UserEventsFrame;
  const message = JSON.stringify(frame);
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

    const ticket = (url.searchParams.get("ticket") ?? "").trim();
    const token = isLegacyUserEventsTokenAllowed()
      ? (url.searchParams.get("token") ?? "").trim()
      : "";

    void (async () => {
      // Browser clients use a short-lived, single-use ticket. The token query
      // remains behind a kill switch only for native/older clients. Disable it
      // after the ticket-capable Capture build is the enforced minimum.
      const ticketSession = ticket
        ? await consumeUserEventsTicket(pool, ticket)
        : null;
      const bearerSession = ticket
        ? null
        : await resolveBearerSession(pool, activeSessions, token);
      const userId = ticketSession?.userId ?? bearerSession?.userId ?? null;
      if (!userId) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        registerClient(userId, ws);
      });
    })().catch(() => {
      socket.destroy();
    });
  });

  // Keep-alive sweep — the iPad keeps this socket open across app launches, so
  // half-open connections are likely; without it userClients grows unbounded
  // and broadcastUserEvent fans out to dead sockets. Terminate any that missed
  // the previous ping.
  const heartbeat = setInterval(() => {
    for (const set of userClients.values()) {
      for (const ws of set) {
        const live = ws as LiveWebSocket;
        if (live.isAlive === false) {
          try { ws.terminate(); } catch { /* ignore */ }
          continue;
        }
        live.isAlive = false;
        try { ws.ping(); } catch { /* ignore */ }
      }
    }
  }, 30000);
  heartbeat.unref?.();
  wss.on("close", () => clearInterval(heartbeat));
  server.on("close", () => {
    clearInterval(heartbeat);
    wss.close();
  });
}

type LiveWebSocket = WebSocket & { isAlive?: boolean };

function registerClient(userId: string, ws: WebSocket): () => void {
  const set = userClients.get(userId) ?? new Set<WebSocket>();
  set.add(ws);
  userClients.set(userId, set);
  (ws as LiveWebSocket).isAlive = true;
  ws.on("pong", () => {
    (ws as LiveWebSocket).isAlive = true;
  });

  try {
    const frame = {
      version: USER_EVENTS_PROTOCOL_VERSION,
      type: "connection_established",
      serverTime: new Date().toISOString(),
    } satisfies UserEventsFrame;
    ws.send(JSON.stringify(frame));
  } catch { /* closed before first frame */ }

  const cleanup = () => {
    set.delete(ws);
    if (set.size === 0) {
      userClients.delete(userId);
    }
  };

  ws.on("close", cleanup);
  ws.on("error", () => {
    // RT-3: kall cleanup() eksplisitt før terminate slik at Map-entry
    // fjernes selv om 'close' skulle forsinkes (terminate's close-
    // event er da idempotent — set.delete er no-op andre gang).
    cleanup();
    try {
      ws.terminate();
    } catch { /* ignore */ }
  });

  return cleanup;
}
