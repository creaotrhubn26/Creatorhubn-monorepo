/**
 * WebSocket Chat Server
 * 
 * Handles real-time messaging between admin and users.
 * Message types: chat_message, typing_indicator, presence_update
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { Pool } from 'pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import * as schema from '../migrations/schema.js';
import { loadPersistedAuthSession } from './auth-session-store.js';
import { canAccessProject } from './project-team-routes.js';
import { canAccessRoleRoomProject } from './role-room-projects-routes.js';
import crypto from 'crypto';

type DB = NodePgDatabase<typeof schema>;

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  /** Live Set room, e.g. 'liveset:projectId:shootingDayId'. Undefined for plain chat clients. */
  room?:       string;
  role?:       string;
  connectedAt: Date;
  /**
   * True once the socket presented a valid bearer token at handshake (or via a
   * later `auth` message). Chat send/receive is gated on this — an
   * unauthenticated socket may never be trusted with an identity.
   */
  authenticated: boolean;
  /** The server-verified user id (from the session), never a client-claimed one. */
  authUserId?: string;
  /** The server-verified email (from the session) — used for channel-name membership matching. */
  authEmail?: string;
}

// Slice 9D.5.D — module-level handle slik at route-handlers kan
// broadcaste events uten å gå via WebSocketServer-instansen.
let activeChatClients: Map<string, ConnectedClient> | null = null;

/**
 * Broadcast en JSON-payload til alle åpne sockets eid av userId.
 * Matches only on the server-verified identity (authUserId) — an
 * unauthenticated socket that merely claimed `?userId=victim` is never a target.
 */
export function broadcastChatEventToUser(userId: string, message: unknown): void {
  if (!activeChatClients) return;
  const data = JSON.stringify(message);
  for (const client of activeChatClients.values()) {
    if (
      client.authenticated &&
      client.authUserId === userId &&
      client.ws.readyState === WebSocket.OPEN
    ) {
      try { client.ws.send(data); } catch { /* ignore */ }
    }
  }
}

/**
 * Slice 9X.39 — Broadcast til alle klienter i et spesifikt rom.
 * Wedding-flyten bruker `room=wedding:${weddingId}` på connect.
 * Returnerer antall klienter som mottok meldingen.
 */
export function broadcastEventToRoom(room: string, message: unknown): number {
  if (!activeChatClients) return 0;
  const data = JSON.stringify(message);
  let count = 0;
  for (const client of activeChatClients.values()) {
    if (client.room === room && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(data);
        count++;
      } catch {
        // Ignore failed send
      }
    }
  }
  return count;
}

export function createWebSocketServer(
  server: Server,
  db: DB,
  pool: Pool,
  // Typed loosely to sidestep Map invariance against the caller's
  // ActiveSessionData; we only ever read `.userId`.
  activeSessions: Map<string, any>,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<string, ConnectedClient>();
  activeChatClients = clients;

  /**
   * Resolve a bearer token to a verified session (in-memory first, then the
   * persisted auth-session store). Mirrors realtime-user-events.ts's
   * resolveBearerSession. Returns null for any unknown/expired token — callers
   * treat that as unauthenticated (fail closed).
   */
  async function resolveWsSession(token: string): Promise<{ userId: string; email?: string } | null> {
    const t = (token || '').trim();
    if (!t) return null;
    const inMem = activeSessions.get(t);
    if (inMem?.userId) return { userId: String(inMem.userId), email: inMem.email ? String(inMem.email) : undefined };
    try {
      const persisted = await loadPersistedAuthSession<{
        userId: string; email: string; name: string; role: string; loginAt: string;
        [k: string]: unknown;
      }>(pool, t);
      if (persisted?.userId) {
        activeSessions.set(t, persisted);
        return { userId: String(persisted.userId), email: persisted.email ? String(persisted.email) : undefined };
      }
    } catch {
      // Treat store errors as unauthenticated.
    }
    return null;
  }

  /**
   * Parse the projectId out of a Live Set room key ('liveset:<projectId>:<shootingDayId>').
   * Returns null for any non-liveset room (those are not project-authorized here).
   */
  function parseLiveSetProjectId(roomKey?: string): string | null {
    if (!roomKey || !roomKey.startsWith('liveset:')) return null;
    const parts = roomKey.split(':');
    return parts[1] || null;
  }

  /**
   * Parse the weddingId out of a wedding-room key ('wedding:<weddingId>').
   * Returns null for any non-wedding room (those keep their existing behavior).
   */
  function parseWeddingId(roomKey?: string): string | null {
    if (!roomKey || !roomKey.startsWith('wedding:')) return null;
    const id = roomKey.slice('wedding:'.length);
    return id || null;
  }

  /**
   * Authorize a user to read/write a chat channel. Mirrors the prod-verified
   * membership predicate used by the REST GET /api/communication/conversations
   * privacy fix (communication-routes.ts): a user may access a channel when it is
   * brand-new (they are creating it), named for them (dm-admin-<id> DMs), lists
   * them in settings.participants, has an explicit participant row, or they have
   * already sent a message in it. Everything else is rejected so an authenticated
   * user cannot inject into — or silently self-join (via ensureParticipant) and
   * then eavesdrop on — another tenant's conversation. Fails closed on error.
   */
  async function canAccessChannel(channelId: string, userId: string, email?: string): Promise<boolean> {
    if (!channelId || !userId) return false;
    // Shared support lobby fallback stays open (the default channel id).
    if (channelId === 'general') return true;
    try {
      const chan = await pool.query(
        `SELECT name, settings FROM communication_channels WHERE id = $1 LIMIT 1`,
        [channelId],
      );
      // Channel does not exist yet → the sender is creating it. Allow.
      if ((chan.rowCount ?? 0) === 0) return true;

      const row = chan.rows[0] as { name?: string; settings?: any };
      // Match membership against BOTH the verified userId and the verified email
      // — a faithful superset of the REST /conversations predicate. Messages and
      // participant rows may key on either (the chat widget persists sender_id as
      // the user's email), so matching only userId would false-block a legitimate
      // first reply in a channel where the user appears solely by email.
      const identifiers = [String(userId)];
      if (email) identifiers.push(String(email));
      const needles = identifiers.map((v) => v.toLowerCase());
      // Channel named for this user (covers dm-admin-<userId> and email-named channels).
      if (row.name) {
        const name = String(row.name).toLowerCase();
        if (needles.some((n) => n && name.includes(n))) return true;
      }
      // settings.participants includes one of the identifiers.
      const parts = row.settings?.participants;
      if (Array.isArray(parts) && parts.some((p: unknown) => identifiers.includes(String(p)))) return true;
      // Explicit participant row (user_id keyed by userId or email).
      const pr = await pool.query(
        `SELECT 1 FROM communication_participants WHERE channel_id = $1 AND user_id = ANY($2::text[]) LIMIT 1`,
        [channelId, identifiers],
      );
      if ((pr.rowCount ?? 0) > 0) return true;
      // Has previously sent a message here → an established member.
      const mr = await pool.query(
        `SELECT 1 FROM communication_messages WHERE channel_id = $1 AND sender_id = ANY($2::text[]) LIMIT 1`,
        [channelId, identifiers],
      );
      return (mr.rowCount ?? 0) > 0;
    } catch (e) {
      console.error('[WS] canAccessChannel error:', e);
      return false; // fail closed
    }
  }

  /**
   * Authorize a socket to subscribe to a wedding real-time room
   * ('wedding:<weddingId>'). Two legitimate audiences exist:
   *   - The couple, who open /wedding/client/:token and connect UNauthenticated
   *     with userId='couple:<shareToken>'. Authorized iff that share token
   *     resolves to THIS wedding (client_settings->>'accessToken') and client
   *     access is still enabled. This closes anonymous eavesdropping: previously
   *     any socket could pass ?room=wedding:<anyId> and receive the feed
   *     without possessing the wedding's share token.
   *   - The photographer/team, who connect authenticated (bearer). Authorized
   *     iff they own the wedding (photographer_id) or can access its linked
   *     project (owner or active team member) — a superset of the REST
   *     photographer check (wedding-routes.ts), so no legitimate crew is blocked.
   * Fails closed on error.
   */
  async function canAccessWeddingRoom(
    weddingId: string,
    opts: { authUserId?: string; coupleToken?: string },
  ): Promise<boolean> {
    if (!weddingId) return false;
    try {
      const { authUserId, coupleToken } = opts;
      // Couple share-token path (unauthenticated).
      if (coupleToken !== undefined) {
        const t = coupleToken.trim();
        if (!t) return false;
        const r = await pool.query(
          `SELECT 1 FROM wedding_timelines
            WHERE id = $1
              AND (client_settings->>'accessToken') = $2
              AND client_access_enabled = true
            LIMIT 1`,
          [weddingId, t],
        );
        return (r.rowCount ?? 0) > 0;
      }
      // Authenticated photographer/team path.
      if (authUserId) {
        const w = await pool.query(
          `SELECT photographer_id, project_id FROM wedding_timelines WHERE id = $1 LIMIT 1`,
          [weddingId],
        );
        if ((w.rowCount ?? 0) === 0) return false;
        const row = w.rows[0] as { photographer_id?: string | null; project_id?: string | null };
        if (row.photographer_id && String(row.photographer_id) === String(authUserId)) return true;
        if (row.project_id && (await canAccessProject(pool, authUserId, String(row.project_id)))) return true;
        return false;
      }
      return false;
    } catch (e) {
      console.error('[WS] canAccessWeddingRoom error:', e);
      return false; // fail closed
    }
  }

  /** Active participant user-ids for a channel (empty set on error). */
  async function channelParticipantIds(channelId: string): Promise<Set<string>> {
    try {
      const rows = await db
        .select({ userId: schema.communicationParticipants.userId })
        .from(schema.communicationParticipants)
        .where(
          and(
            eq(schema.communicationParticipants.channelId, channelId),
            eq(schema.communicationParticipants.isActive, true),
          ),
        );
      return new Set(rows.map((r) => r.userId).filter((u): u is string => !!u));
    } catch {
      return new Set();
    }
  }

  /**
   * Ensure the sender is recorded as a participant of the channel. The table has
   * no unique constraint on (channel_id, user_id), so we SELECT-then-INSERT.
   * This self-populates membership so participant-scoped delivery works for
   * ad-hoc channels created on the fly.
   */
  async function ensureParticipant(channelId: string, userId: string): Promise<void> {
    if (!userId) return;
    try {
      const existing = await db
        .select({ id: schema.communicationParticipants.id })
        .from(schema.communicationParticipants)
        .where(
          and(
            eq(schema.communicationParticipants.channelId, channelId),
            eq(schema.communicationParticipants.userId, userId),
          ),
        )
        .limit(1);
      if (existing.length === 0) {
        await db.insert(schema.communicationParticipants).values({
          channelId,
          userId,
          role: 'member',
          joinedAt: new Date().toISOString(),
          isActive: true,
        });
      }
    } catch (e) {
      console.error('[WS] ensureParticipant error:', e);
    }
  }

  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname || '/';
      if (pathname === '/ws' || pathname.startsWith('/ws/')) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
        return;
      }
    } catch {
      // Ignore malformed upgrade URL and let other listeners handle it.
    }

    // If this is the only upgrade listener, proactively close unsupported paths.
    if (server.listeners('upgrade').length <= 1) {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const clientId = crypto.randomUUID();
    const url    = new URL(req.url || '/', `http://${req.headers.host}`);
    // The `?userId=` query param is NO LONGER trusted for identity — it is kept
    // only as a provisional label for unauthenticated sockets (which cannot
    // send/receive chat). The real identity comes from the verified token below.
    const queryUserId = url.searchParams.get('userId') || 'anonymous';
    const handshakeToken = url.searchParams.get('token') || '';
    const room   = url.searchParams.get('room')   || undefined;
    const role   = url.searchParams.get('role')   || undefined;

    let connectedUserId = queryUserId;
    let authenticated = false;

    const record: ConnectedClient = {
      ws, userId: connectedUserId,
      // Live Set and wedding rooms are NOT honored until the connecting socket
      // is authorized (below): liveset requires an authenticated token; wedding
      // requires the couple's share token or authenticated photographer/team
      // access. Other room types keep their existing behavior.
      room: (parseLiveSetProjectId(room) || parseWeddingId(room)) ? undefined : room,
      role, connectedAt: new Date(),
      authenticated: false,
    };
    clients.set(clientId, record);

    // Resolve the bearer token, then finalise identity and announce presence.
    // Message listeners are attached synchronously below so nothing is missed
    // while this resolves; chat handlers gate on `authenticated`.
    void (async () => {
      const session = handshakeToken ? await resolveWsSession(handshakeToken) : null;
      if (session?.userId) {
        authenticated = true;
        connectedUserId = session.userId;
        record.authenticated = true;
        record.authUserId = session.userId;
        record.userId = session.userId;
        record.authEmail = session.email;
      }

      // Authorize Live Set room subscription. The socket must be authenticated
      // AND a member (owner or RBAC role) of the addressed role-room project.
      // This closes both anonymous eavesdropping via ?room=liveset:* and
      // cross-project access by an arbitrary authenticated user (who could
      // otherwise read AND inject roll/cut/note events into another
      // production's live set). The membership predicate is the same one now
      // enforced on the liveset REST endpoints (role-room-projects-routes), so
      // the two layers are consistent — no legitimate crew member is blocked.
      // Other room types (wedding client view, plain chat) are unaffected.
      const lsProject = parseLiveSetProjectId(room);
      if (lsProject) {
        const lsAllowed = authenticated
          && (await canAccessRoleRoomProject(pool, connectedUserId, lsProject));
        if (lsAllowed) {
          record.room = room;
        } else {
          record.room = undefined;
          try {
            ws.send(JSON.stringify({
              type: 'error',
              payload: {
                message: 'forbidden_room',
                code: authenticated ? 'liveset_forbidden' : 'auth_required',
                room,
              },
              timestamp: new Date().toISOString(),
            }));
          } catch { /* ignore */ }
        }
      }

      // Authorize wedding real-time room subscription. The couple connects
      // UNauthenticated with userId='couple:<shareToken>'; the photographer/team
      // connect authenticated. A 'couple:' socket is always evaluated on the
      // share token (never routed to the photographer path by an incidental
      // leftover bearer). Anyone else — an arbitrary authenticated user, or an
      // anonymous socket without the share token — is denied, closing the
      // cross-wedding eavesdrop on ?room=wedding:<anyId>.
      const weddingId = parseWeddingId(room);
      if (weddingId) {
        const isCouple = queryUserId.startsWith('couple:');
        const allowed = await canAccessWeddingRoom(weddingId, {
          authUserId: !isCouple && authenticated ? connectedUserId : undefined,
          coupleToken: isCouple ? queryUserId.slice('couple:'.length) : undefined,
        });
        if (allowed) {
          record.room = room;
        } else {
          record.room = undefined;
          try {
            ws.send(JSON.stringify({
              type: 'error',
              payload: { message: 'forbidden_room', code: 'wedding_forbidden', room },
              timestamp: new Date().toISOString(),
            }));
          } catch { /* ignore */ }
        }
      }
      console.log(`[WS] Client connected: ${connectedUserId} (${clientId}) auth=${authenticated}. Total: ${clients.size}`);

      // Send connection confirmation (reports the verified identity + auth state)
      ws.send(JSON.stringify({
        type: 'connection_established',
        payload: { clientId, userId: connectedUserId, authenticated, connectedClients: clients.size },
        timestamp: new Date().toISOString(),
      }));

      // Broadcast presence update (identity is the server-bound connectedUserId).
      broadcast(clients, {
        type: 'presence_update',
        payload: { userId: connectedUserId, status: 'online' },
        timestamp: new Date().toISOString(),
        userId: connectedUserId,
      }, clientId);
    })();

    ws.on('message', async (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());

        switch (data.type) {
          case 'auth': {
            // Identity is ONLY established by a verified bearer token — never by
            // a client-claimed userId. A token may be presented here (in
            // addition to the handshake query) e.g. after a token refresh.
            const authToken =
              typeof data.token === 'string' ? data.token
                : typeof data.payload?.token === 'string' ? data.payload.token
                  : '';
            const session = authToken ? await resolveWsSession(authToken) : null;
            if (session?.userId) {
              authenticated = true;
              connectedUserId = session.userId;
              const rec = clients.get(clientId);
              if (rec) { rec.authenticated = true; rec.authUserId = session.userId; rec.userId = session.userId; }
            }

            ws.send(JSON.stringify({
              type: 'auth_ack',
              payload: { userId: authenticated ? connectedUserId : null, authenticated },
              timestamp: new Date().toISOString(),
            }));
            break;
          }

          case 'event': {
            // Realtime events are relayed to other connected clients, which run
            // handlers keyed by event.type (item_selected, project_updated,
            // notifications, …). An UNauthenticated socket may not inject them —
            // this closes anonymous, cross-client event spoofing into every
            // logged-in user's UI. NOTE: these events still carry no
            // server-verified project binding, so delivery remains a global
            // fan-out among authenticated sockets; per-tenant scoping is a
            // separate, larger change tracked for a future round.
            if (!authenticated) {
              ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'unauthenticated', code: 'auth_required' },
                timestamp: new Date().toISOString(),
              }));
              break;
            }
            const eventPayload = data.event;
            if (!eventPayload || typeof eventPayload !== 'object') {
              ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'Invalid realtime event payload' },
                timestamp: new Date().toISOString(),
              }));
              break;
            }

            broadcast(clients, {
              type: 'event',
              event: eventPayload,
              timestamp: new Date().toISOString(),
            }, clientId);
            break;
          }

          case 'chat_message': {
            // Chat is fully gated: an unauthenticated socket may neither send
            // (impersonation) nor implicitly receive (cross-tenant read).
            if (!authenticated) {
              ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'unauthenticated', code: 'auth_required' },
                timestamp: new Date().toISOString(),
              }));
              break;
            }

            // Persist message to database
            const msgId = data.payload?.id || crypto.randomUUID();
            const channelId = data.conversationId || data.payload?.conversationId || 'general';
            const content = data.payload?.content || '';
            // Sender is ALWAYS the server-verified identity — client-supplied
            // data.userId is ignored so a caller cannot post as someone else.
            const senderId = connectedUserId;
            const now = new Date().toISOString();

            // Authorize the channel for this sender (mirrors the REST membership
            // predicate). Blocks posting into — and, via ensureParticipant,
            // silently self-joining then eavesdropping on — a conversation the
            // sender has no relationship to.
            if (!(await canAccessChannel(channelId, senderId, record.authEmail))) {
              ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'forbidden_channel', code: 'forbidden_channel', conversationId: channelId },
                timestamp: new Date().toISOString(),
              }));
              break;
            }

            if (content.trim()) {
              try {
                // Ensure channel exists
                const existing = await db
                  .select({ id: schema.communicationChannels.id })
                  .from(schema.communicationChannels)
                  .where(eq(schema.communicationChannels.id, channelId))
                  .limit(1);

                if (existing.length === 0) {
                  await db.insert(schema.communicationChannels).values({
                    id: channelId,
                    name: `Chat ${channelId}`,
                    type: 'chat',
                    isActive: true,
                    createdAt: now,
                    updatedAt: now,
                  });
                }

                await db.insert(schema.communicationMessages).values({
                  id: msgId,
                  channelId,
                  senderId,
                  messageType: data.payload?.messageType || 'text',
                  content,
                  metadata: data.payload?.metadata || {},
                  isRead: false,
                  isPriority: false,
                  isSystemGenerated: false,
                  createdAt: data.payload?.timestamp || now,
                  updatedAt: now,
                });

                // Self-populate membership so participant-scoped delivery works.
                await ensureParticipant(channelId, senderId);
              } catch (dbErr) {
                console.error('[WS] DB persist error:', dbErr);
              }
            }

            // Deliver only to authenticated participants of this channel — no
            // longer a system-wide fan-out to every connected socket.
            const participants = await channelParticipantIds(channelId);
            broadcastToChannelParticipants(clients, participants, {
              type: 'chat_message',
              payload: {
                ...data.payload,
                id: msgId,
                senderId,
                status: 'delivered',
              },
              timestamp: new Date().toISOString(),
              userId: senderId,
              conversationId: channelId,
            }, clientId);

            // Acknowledge to sender
            ws.send(JSON.stringify({
              type: 'message_ack',
              payload: { id: msgId, status: 'delivered' },
              timestamp: new Date().toISOString(),
            }));
            break;
          }

          case 'typing_indicator': {
            // No anonymous typing noise attributed to unauthenticated sockets.
            if (!authenticated) break;
            // Identity is server-bound (never the client-claimed data.userId).
            broadcast(clients, {
              type: 'typing_indicator',
              payload: data.payload,
              timestamp: new Date().toISOString(),
              userId: connectedUserId,
              conversationId: data.conversationId,
            }, clientId);
            break;
          }

          case 'presence_update': {
            // No anonymous presence spoofing; server-generated presence on
            // connect/disconnect is emitted separately and is unaffected.
            if (!authenticated) break;
            // Identity is server-bound (never the client-claimed data.userId).
            broadcast(clients, {
              type: 'presence_update',
              payload: data.payload,
              timestamp: new Date().toISOString(),
              userId: connectedUserId,
            }, clientId);
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({
              type: 'pong',
              payload: { projectId: data.projectId || null },
              timestamp: new Date().toISOString(),
            }));
            break;
          }

          // ── Live Set room events ─────────────────────────────────────────
          case 'liveset:join': {
            // Room membership is authoritatively granted by the authenticated
            // handshake (?room=) path above; here we only (re)affirm it for an
            // authenticated socket and return the state snapshot. An
            // unauthenticated socket gets NO room (fail closed) — but no error,
            // to avoid racing the async handshake auth on the client's
            // connect-time join.
            const joinRoom = typeof data.payload?.room === 'string' && data.payload.room
              ? data.payload.room
              : `liveset:${data.projectId}:${data.shootingDayId}`;
            const joinProject = parseLiveSetProjectId(joinRoom);
            // Re-affirm the room only for an authenticated MEMBER of the project
            // (same predicate as the handshake gate and the REST endpoints).
            if (authenticated && joinProject
                && (await canAccessRoleRoomProject(pool, connectedUserId, joinProject))) {
              const c = clients.get(clientId);
              if (c) {
                c.room = joinRoom;
                c.role = data.payload?.role ?? c.role;
              }
            }
            // Optionally: send back a state snapshot from DB (TODO [Studio])
            ws.send(JSON.stringify({
              type: 'liveset:state_snapshot',
              payload: { message: 'TODO: attach persisted state here' },
              timestamp: new Date().toISOString(),
            }));
            break;
          }

          case 'join_session': {
            // A collaboration session room may only be joined by an
            // authenticated socket. Sessions carry no server-side membership
            // model (client-supplied ids), so authentication is the ceiling —
            // it closes anonymous room-join, presence spoofing, and forged
            // participant_joined / session_updated events into another user's
            // session room.
            if (!authenticated) {
              ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'unauthenticated', code: 'auth_required' },
                timestamp: new Date().toISOString(),
              }));
              break;
            }
            const sessionId = typeof data.sessionId === 'string' ? data.sessionId : '';
            if (!sessionId) {
              ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'Missing sessionId for join_session' },
                timestamp: new Date().toISOString(),
              }));
              break;
            }

            const client = clients.get(clientId);
            if (client) {
              client.room = `session:${sessionId}`;
            }

            const participant = {
              id: clientId,
              userId: connectedUserId,
              name: connectedUserId,
              email: '',
              role: role || 'editor',
              status: 'online',
              lastSeen: new Date().toISOString(),
              permissions: {
                canEdit: true,
                canComment: true,
                canShare: true,
                canDelete: false,
                canInvite: true,
              },
            };

            ws.send(JSON.stringify({
              type: 'session_updated',
              session: {
                id: sessionId,
                status: 'active',
              },
              timestamp: new Date().toISOString(),
            }));

            broadcastToRoom(clients, `session:${sessionId}`, {
              type: 'participant_joined',
              participant,
              timestamp: new Date().toISOString(),
            }, clientId);
            break;
          }

          case 'leave_session': {
            const client = clients.get(clientId);
            const activeRoom = client?.room;
            if (client) {
              client.room = undefined;
            }

            if (activeRoom) {
              broadcastToRoom(clients, activeRoom, {
                type: 'participant_left',
                participantId: clientId,
                timestamp: new Date().toISOString(),
              }, clientId);
            }

            ws.send(JSON.stringify({
              type: 'session_updated',
              session: null,
              timestamp: new Date().toISOString(),
            }));
            break;
          }

          case 'end_session': {
            const client = clients.get(clientId);
            const activeRoom = client?.room;
            if (client) {
              client.room = undefined;
            }

            if (activeRoom) {
              broadcastToRoom(clients, activeRoom, {
                type: 'session_updated',
                session: {
                  id: activeRoom.replace(/^session:/, ''),
                  status: 'ended',
                },
                timestamp: new Date().toISOString(),
              }, clientId);
            }
            break;
          }

          case 'liveset:roll':
          case 'liveset:cut':
          case 'liveset:circle':
          case 'liveset:note':
          case 'liveset:setup_done':
          case 'liveset:cursor': {
            // Relay only from an authenticated socket, and only into the room it
            // was authorized into on join — never a client-supplied room. An
            // unauthorized socket never had record.room set, so it cannot relay.
            const senderRoom = clients.get(clientId)?.room;
            if (!authenticated || !senderRoom || !senderRoom.startsWith('liveset:')) break;
            broadcastToRoom(clients, senderRoom, {
              type:          data.type,
              payload:       data.payload,
              // Identity is the server-side one, never the client-claimed data.userId.
              userId:        connectedUserId,
              projectId:     data.projectId,
              shootingDayId: data.shootingDayId,
              timestamp:     new Date().toISOString(),
            }, clientId);
            break;
          }

          default:
            console.log(`[WS] Unknown message type: ${data.type}`);
        }
      } catch (err) {
        console.error('[WS] Failed to handle message:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${connectedUserId} (${clientId}). Total: ${clients.size}`);

      broadcast(clients, {
        type: 'presence_update',
        payload: { userId: connectedUserId, status: 'offline' },
        timestamp: new Date().toISOString(),
        userId: connectedUserId,
      });
    });

    ws.on('error', (err) => {
      console.error(`[WS] Client error (${clientId}):`, err.message);
      clients.delete(clientId);
    });
  });

  console.log('[WS] WebSocket server attached on /ws');
  return wss;
}

function broadcast(
  clients: Map<string, ConnectedClient>,
  message: unknown,
  excludeClientId?: string
) {
  const data = JSON.stringify(message);
  for (const [id, client] of clients) {
    if (id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

/**
 * Deliver a chat message only to authenticated sockets whose verified user id
 * is an active participant of the channel (plus never to anonymous sockets).
 * This replaces the old system-wide fan-out that let any socket read every
 * conversation.
 */
function broadcastToChannelParticipants(
  clients: Map<string, ConnectedClient>,
  participantUserIds: Set<string>,
  message: unknown,
  excludeClientId?: string,
) {
  const data = JSON.stringify(message);
  for (const [id, client] of clients) {
    if (
      id !== excludeClientId &&
      client.ws.readyState === WebSocket.OPEN &&
      client.authenticated &&
      client.authUserId != null &&
      participantUserIds.has(client.authUserId)
    ) {
      client.ws.send(data);
    }
  }
}

/** Broadcast only to clients in a specific Live Set room. */
function broadcastToRoom(
  clients: Map<string, ConnectedClient>,
  room: string,
  message: unknown,
  excludeClientId?: string
) {
  const data = JSON.stringify(message);
  for (const [id, client] of clients) {
    if (id !== excludeClientId && client.room === room && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}
