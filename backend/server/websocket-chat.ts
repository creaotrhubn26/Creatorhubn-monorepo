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
  async function resolveWsSession(token: string): Promise<{ userId: string } | null> {
    const t = (token || '').trim();
    if (!t) return null;
    const inMem = activeSessions.get(t);
    if (inMem?.userId) return { userId: String(inMem.userId) };
    try {
      const persisted = await loadPersistedAuthSession<{
        userId: string; email: string; name: string; role: string; loginAt: string;
        [k: string]: unknown;
      }>(pool, t);
      if (persisted?.userId) {
        activeSessions.set(t, persisted);
        return { userId: String(persisted.userId) };
      }
    } catch {
      // Treat store errors as unauthenticated.
    }
    return null;
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
      ws, userId: connectedUserId, room, role, connectedAt: new Date(),
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
            // Client announces which room it is in
            const c = clients.get(clientId);
            if (c) {
              c.room = data.payload?.room
                ?? `liveset:${data.projectId}:${data.shootingDayId}`;
              c.role = data.payload?.role ?? c.role;
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
            const senderRoom   = clients.get(clientId)?.room
              ?? `liveset:${data.projectId}:${data.shootingDayId}`;
            // Relay the message to everyone else in the same room
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
