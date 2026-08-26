import type { IncomingMessage, Server as HttpServer } from "http";
import type { Duplex } from "stream";
import { createHash, randomBytes } from "crypto";
import type express from "express";
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
      kind: "milestones.updated";
      projectId: string;
      timestamp: string;
    }
  /// Samkjøringsboardet eller sjekklisten i Team Workspace endret seg —
  /// åpne Oversikt-faner hos andre team-medlemmer refetcher.
  | {
      kind: "board.updated";
      projectId: string;
      timestamp: string;
    }
  /// Ny/endret/slettet melding eller reaksjon i en prosjekt-chatkanal —
  /// åpne chat-paneler refetcher og oppdaterer uleste-tellere.
  | {
      kind: "chat.message";
      channelId: string;
      projectId: string;
      timestamp: string;
    }
  /// Noen skriver i en prosjekt-chatkanal (throttlet fra klienten).
  | {
      kind: "chat.typing";
      channelId: string;
      name: string;
      timestamp: string;
    }
  /// Du ble @-nevnt i en prosjekt-chatkanal.
  | {
      kind: "chat.mention";
      channelId: string;
      projectId: string;
      fromName: string;
      timestamp: string;
    }
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
    }
  /// Shot-list item gained or lost a captured asset link (via the
  /// iPad ``linkShotToAsset`` PATCH). Live Set dashboards observe to
  /// refresh thumbnails without polling.
  | {
      kind: "shot.captured";
      projectId: string;
      shotId: string;
      capturedAssetId: string | null;
      timestamp: string;
    }
  /// Photographer manually toggled a shot's completion flag (without
  /// linking an asset — e.g. "got it on the backup body"). Same
  /// audience as ``shot.captured``: dashboards refresh their summary
  /// counters + tile state.
  | {
      kind: "shot.completion-toggled";
      projectId: string;
      shotId: string;
      isCompleted: boolean;
      timestamp: string;
    }
  /// Phase 5.3 — multi-photographer presence. Fires when an iPad
  /// connects to a session OR sends an explicit join via the
  /// presence endpoint. `actorUserId` and `displayName` identify
  /// the new peer so existing connected iPads can render an
  /// avatar in the StatusBar.
  | {
      kind: "presence.joined";
      sessionId: string;
      actorUserId: string;
      displayName: string | null;
      timestamp: string;
    }
  /// Counterpart to `presence.joined` — fires when an iPad
  /// explicitly leaves OR when its presence entry expires from the
  /// stale-cleanup pass (~5 min idle).
  | {
      kind: "presence.left";
      sessionId: string;
      actorUserId: string;
      timestamp: string;
    }
  /// Phase 5.3 — broadcast when ANY photographer with access to
  /// the session changes a label axis (rating / pick flag /
  /// rejected / colorLabel) on an asset. Other iPads in the same
  /// shoot reconcile their local SessionStore by re-fetching the
  /// asset row. `actorUserId` lets the receiver suppress the echo
  /// of its own change (we'd otherwise round-trip our own toggle
  /// and clobber it).
  | {
      kind: "asset.labels-changed";
      assetId: string;
      sessionId: string;
      actorUserId: string;
      rating: number | null;
      colorLabel: string | null;
      flaggedForClient: boolean | null;
      rejected: boolean | null;
      timestamp: string;
    }
  /// Shot-list full upsert (web shotlist legger til shots, per-shot
  /// kommentarer, redigering/sletting). Web-tabs + iPad observerer og
  /// refetcher — i dag en sjelden hendelse, så refetch-per-event er billig.
  | {
      kind: "shot.list-updated";
      projectId: string;
      timestamp: string;
    }
  /// Moodboard-studio tilstedeværelse: en fotograf/editor åpnet eller
  /// forlot prosjektets moodboard. Broadcastes til de ANDRE som ser på
  /// akkurat nå, så avatar-raden holder seg synk uten polling.
  | {
      kind: "moodboard.presence";
      projectId: string;
      actorUserId: string;
      actorName: string | null;
      joined: boolean;
      timestamp: string;
    }
  /// Slice 9X.82 — videograf-leveranse: klient legger inn timecode-
  /// kommentar (Frame.io-stil) på en CinematicVideoPlayer/Audio.
  /// Brukt for både video-, audio- og chapter-comments.
  | {
      kind: "video.comment-added";
      galleryId: string;
      chapterId: string | null;
      timecodeSec: number;
      commentId: string;
      clientLabel: string | null;
      category: string | null;
      priority: string | null;
      timestamp: string;
    }
  /// Slice 9X.80 — klient submitter favoritt-utvalg (Pixieset).
  | {
      kind: "gallery.selection-submitted";
      galleryId: string;
      clientEmail: string | null;
      clientName: string | null;
      selectedCount: number;
      submissionNote: string | null;
      timestamp: string;
    }
  /// Video Room (produsent-side versjonsgjennomgang, project_video_versions/
  /// project_video_comments) fikk en ny versjon, kommentar, godkjenning eller
  /// chapter-endring. Broadcastes til prosjektets ANDRE team-medlemmer (ikke
  /// aktøren selv) slik at VideoRoomTab refetcher instant i stedet for å
  /// vente på neste besøk/reload — samme "bare refetch"-mønster som
  /// shot.list-updated, men fanet ut til hele teamet i stedet for kun
  /// aktørens egne enheter.
  | {
      kind: "video-room.updated";
      projectId: string;
      reason: "version" | "comment" | "approval" | "chapters";
      timestamp: string;
    }
  /// Sound Room (Audio Showcase, audio_review_projects/-versions/-comments,
  /// koblet til workspace-prosjektet via bro-tabellen project_audio_rooms)
  /// fikk en ny versjon, kommentar (fra eier ELLER bandmedlem via delt lenke)
  /// eller godkjenning. `projectId` er WORKSPACE-prosjektets id (ikke
  /// audio_review_projects-id) — samme id-rom som video-room.updated, slik
  /// at TeamWorkspacePage kan filtrere likt for begge rom-typene.
  | {
      kind: "sound-room.updated";
      projectId: string;
      reason: "version" | "comment" | "approval";
      timestamp: string;
    };

export const USER_EVENTS_WS_PATH = "/api/ipad/ws/events";
export const USER_EVENTS_TICKET_PATH = "/api/realtime/user-events-ticket";
export const USER_EVENTS_TICKET_TTL_MS = 30_000;

interface PendingUserEventsTicket {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

interface UserEventsTicketDeps {
  app: express.Application;
  requireUserSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string } | null;
}

const pendingUserEventsTickets = new Map<string, PendingUserEventsTicket>();
const MAX_PENDING_TICKETS_PER_USER = 4;

function hashUserEventsTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("base64url");
}

function pruneUserEventsTickets(now: number): void {
  for (const [ticketHash, record] of pendingUserEventsTickets) {
    if (record.expiresAt <= now) pendingUserEventsTickets.delete(ticketHash);
  }
}

/**
 * Issues a short-lived, single-use credential for the browser WebSocket
 * handshake. Only a hash is retained server-side; the bearer/session token
 * therefore never needs to appear in a WebSocket URL.
 */
export function issueUserEventsTicket(
  userId: string,
  now = Date.now(),
): { ticket: string; expiresAt: string } {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("userId is required");
  pruneUserEventsTickets(now);

  const existingForUser = [...pendingUserEventsTickets.entries()]
    .filter(([, record]) => record.userId === normalizedUserId)
    .sort((a, b) => a[1].issuedAt - b[1].issuedAt);
  while (existingForUser.length >= MAX_PENDING_TICKETS_PER_USER) {
    const oldest = existingForUser.shift();
    if (oldest) pendingUserEventsTickets.delete(oldest[0]);
  }

  const ticket = randomBytes(32).toString("base64url");
  const expiresAt = now + USER_EVENTS_TICKET_TTL_MS;
  pendingUserEventsTickets.set(hashUserEventsTicket(ticket), {
    userId: normalizedUserId,
    issuedAt: now,
    expiresAt,
  });
  return { ticket, expiresAt: new Date(expiresAt).toISOString() };
}

/** Consume-before-upgrade makes the ticket replay-resistant. */
export function consumeUserEventsTicket(
  ticket: string,
  now = Date.now(),
): { userId: string } | null {
  const normalizedTicket = ticket.trim();
  if (!normalizedTicket) return null;
  const ticketHash = hashUserEventsTicket(normalizedTicket);
  const record = pendingUserEventsTickets.get(ticketHash) ?? null;
  // Delete even expired tickets before returning so every credential is
  // single-use regardless of handshake outcome.
  pendingUserEventsTickets.delete(ticketHash);
  if (!record || record.expiresAt <= now) return null;
  return { userId: record.userId };
}

export function resetUserEventsTicketsForTests(): void {
  pendingUserEventsTickets.clear();
}

export function setupUserEventsTicketRoute({
  app,
  requireUserSession,
}: UserEventsTicketDeps): void {
  app.post(USER_EVENTS_TICKET_PATH, (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const issued = issueUserEventsTicket(session.userId);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.status(201).json({
      ...issued,
      websocketPath: USER_EVENTS_WS_PATH,
    });
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

    const ticket = (url.searchParams.get("ticket") ?? "").trim();
    const token = (url.searchParams.get("token") ?? "").trim();

    void (async () => {
      // Browser clients use a short-lived, single-use ticket. The token query
      // remains as a compatibility bridge for native/older clients and must
      // not be used by new web code.
      const ticketSession = ticket ? consumeUserEventsTicket(ticket) : null;
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
