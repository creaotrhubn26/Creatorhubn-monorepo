/**
 * WebSocket Chat Server
 * 
 * Handles real-time messaging between admin and users.
 * Message types: chat_message, typing_indicator, presence_update
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../migrations/schema.js';
import crypto from 'crypto';

type DB = NodePgDatabase<typeof schema>;

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  /** Live Set room, e.g. 'liveset:projectId:shootingDayId'. Undefined for plain chat clients. */
  room?:       string;
  role?:       string;
  connectedAt: Date;
}

export function createWebSocketServer(server: Server, db: DB): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clients = new Map<string, ConnectedClient>();

  wss.on('connection', (ws, req) => {
    const clientId = crypto.randomUUID();
    const url    = new URL(req.url || '/', `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId') || 'anonymous';
    const room   = url.searchParams.get('room')   || undefined;
    const role   = url.searchParams.get('role')   || undefined;

    clients.set(clientId, { ws, userId, room, role, connectedAt: new Date() });
    console.log(`[WS] Client connected: ${userId} (${clientId}). Total: ${clients.size}`);

    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connection_established',
      payload: { clientId, userId, connectedClients: clients.size },
      timestamp: new Date().toISOString(),
    }));

    // Broadcast presence update
    broadcast(clients, {
      type: 'presence_update',
      payload: { userId, status: 'online' },
      timestamp: new Date().toISOString(),
      userId,
    }, clientId);

    ws.on('message', async (rawData) => {
      try {
        const data = JSON.parse(rawData.toString());

        switch (data.type) {
          case 'chat_message': {
            // Persist message to database
            const msgId = data.payload?.id || crypto.randomUUID();
            const channelId = data.conversationId || data.payload?.conversationId || 'general';
            const content = data.payload?.content || '';
            const senderId = data.userId || userId;
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
              } catch (dbErr) {
                console.error('[WS] DB persist error:', dbErr);
              }
            }

            // Broadcast to all other clients
            broadcast(clients, {
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
            broadcast(clients, {
              type: 'typing_indicator',
              payload: data.payload,
              timestamp: new Date().toISOString(),
              userId: data.userId || userId,
              conversationId: data.conversationId,
            }, clientId);
            break;
          }

          case 'presence_update': {
            broadcast(clients, {
              type: 'presence_update',
              payload: data.payload,
              timestamp: new Date().toISOString(),
              userId: data.userId || userId,
            }, clientId);
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
              userId:        data.userId ?? userId,
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
      console.log(`[WS] Client disconnected: ${userId} (${clientId}). Total: ${clients.size}`);

      broadcast(clients, {
        type: 'presence_update',
        payload: { userId, status: 'offline' },
        timestamp: new Date().toISOString(),
        userId,
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
