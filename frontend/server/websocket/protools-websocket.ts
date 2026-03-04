/**
 * Pro Tools WebSocket Server
 * Real-time synchronization between Pro Tools plugin and web application
 * 
 * Endpoint: /ws/protools/:sessionId
 * 
 * Message Types:
 * - playhead_update: Bidirectional playhead sync
 * - comment_added: New comment notification
 * - comment_updated: Comment status change
 * - metadata_update: Session metadata changes
 * - participant_joined/left: Collaboration events
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { db } from '../db';
import { proToolsSessions, proToolsParticipants, proToolsEvents } from '../../shared/protools-schema';
import { eq, and } from 'drizzle-orm';

interface ProToolsWebSocketMessage {
  type: 'playhead_update' | 'comment_added' | 'comment_updated' | 'metadata_update' | 'participant_joined' | 'participant_left' | 'ping' | 'pong';
  sessionId: string;
  userId?: string;
  data?: any;
  timestamp?: number;
}

interface ConnectedClient {
  ws: WebSocket;
  sessionId: string;
  userId: string;
  lastPing: number;
}

export class ProToolsWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient[]> = new Map(); // sessionId -> clients[]
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/protools/:sessionId',
    });

    this.setupConnectionHandling();
    this.startPingInterval();
    
    console.log('🎵 Pro Tools WebSocket server initialized on /ws/protools/:sessionId');
  }

  private setupConnectionHandling() {
    this.wss.on('connection', async (ws: WebSocket, req: any) => {
      try {
        // Extract sessionId from URL path
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const sessionId = url.pathname.split('/').pop() || '';
        
        if (!sessionId) {
          ws.close(1008, 'Session ID required');
          return;
        }

        // Extract userId from query or headers (should be authenticated)
        const userId = req.headers['user-id'] || url.searchParams.get('userId') || 'anonymous';
        
        // Verify session exists and user has access
        const [session] = await db
          .select()
          .from(proToolsSessions)
          .where(eq(proToolsSessions.id, sessionId))
          .limit(1);

        if (!session) {
          ws.close(1008, 'Session not found');
          return;
        }

        // Check if user is participant or owner
        const [participant] = await db
          .select()
          .from(proToolsParticipants)
          .where(and(
            eq(proToolsParticipants.sessionId, sessionId),
            eq(proToolsParticipants.userId, userId)
          ))
          .limit(1);

        if (!participant && session.ownerId !== userId) {
          ws.close(1003, 'Access denied');
          return;
        }

        // Add client to session
        const client: ConnectedClient = {
          ws,
          sessionId,
          userId,
          lastPing: Date.now(),
        };

        if (!this.clients.has(sessionId)) {
          this.clients.set(sessionId, []);
        }
        this.clients.get(sessionId)!.push(client);

        console.log(`🎵 Pro Tools WebSocket: Client connected to session ${sessionId} (user: ${userId})`);

        // Update participant online status
        if (participant) {
          await db
            .update(proToolsParticipants)
            .set({ isOnline: true, lastSeen: new Date() })
            .where(eq(proToolsParticipants.id, participant.id));
        }

        // Log participant join event
        await db.insert(proToolsEvents).values({
          id: crypto.randomUUID(),
          sessionId: sessionId,
          userId: userId,
          eventType: 'participant_join',
          eventData: { connectionType: 'websocket' },
        });

        // Broadcast participant joined to other clients
        this.broadcastToSession(sessionId, {
          type: 'participant_joined',
          sessionId,
          userId,
          data: { timestamp: Date.now() },
        }, userId);

        // Handle messages
        ws.on('message', async (data: Buffer) => {
          try {
            const message: ProToolsWebSocketMessage = JSON.parse(data.toString());
            await this.handleMessage(client, message);
          } catch (error) {
            console.error('Error handling WebSocket message:', error);
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Invalid message format',
            }));
          }
        });

        // Handle close
        ws.on('close', async () => {
          this.removeClient(sessionId, client);
          
          // Update participant offline status
          if (participant) {
            await db
              .update(proToolsParticipants)
              .set({ isOnline: false, lastSeen: new Date() })
              .where(eq(proToolsParticipants.id, participant.id));
          }

          // Log participant leave event
          await db.insert(proToolsEvents).values({
            id: crypto.randomUUID(),
            sessionId: sessionId,
            userId: userId,
            eventType: 'participant_leave',
            eventData: { connectionType: 'websocket' },
          });

          // Broadcast participant left
          this.broadcastToSession(sessionId, {
            type: 'participant_left',
            sessionId,
            userId,
            data: { timestamp: Date.now() },
          }, userId);

          console.log(`🎵 Pro Tools WebSocket: Client disconnected from session ${sessionId} (user: ${userId})`);
        });

        // Handle errors
        ws.on('error', (error) => {
          console.error(`🎵 Pro Tools WebSocket error for session ${sessionId}:`, error);
        });

        // Send welcome message
        ws.send(JSON.stringify({
          type: 'connected',
          sessionId,
          userId,
          timestamp: Date.now(),
        }));

      } catch (error) {
        console.error('Error setting up WebSocket connection:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  private async handleMessage(client: ConnectedClient, message: ProToolsWebSocketMessage) {
    const { type, data } = message;

    switch (type) {
      case 'ping':
        client.lastPing = Date.now();
        client.ws.send(JSON.stringify({
          type: 'pong',
          sessionId: client.sessionId,
          timestamp: Date.now(),
        }));
        break;

      case 'playhead_update':
        // Update playhead position and broadcast to other clients
        await this.handlePlayheadUpdate(client, data);
        break;

      case 'comment_added':
        // Broadcast new comment to all clients
        this.broadcastToSession(client.sessionId, {
          type: 'comment_added',
          sessionId: client.sessionId,
          userId: client.userId,
          data,
        }, client.userId);
        break;

      case 'metadata_update':
        // Broadcast metadata update
        this.broadcastToSession(client.sessionId, {
          type: 'metadata_update',
          sessionId: client.sessionId,
          userId: client.userId,
          data,
        }, client.userId);
        break;

      default:
        console.warn(`Unknown message type: ${type}`);
    }
  }

  private async handlePlayheadUpdate(client: ConnectedClient, data: any) {
    const { timecode, transportPosition, isPlaying } = data;

    // Update session last activity
    await db
      .update(proToolsSessions)
      .set({ lastActivity: new Date() })
      .where(eq(proToolsSessions.id, client.sessionId));

    // Log playhead update event
    await db.insert(proToolsEvents).values({
      id: crypto.randomUUID(),
      sessionId: client.sessionId,
      userId: client.userId,
      eventType: 'mix_change',
      eventData: {
        playheadUpdate: true,
        timecode,
        transportPosition,
        isPlaying,
      },
      sessionTimecode: timecode || null,
      transportPosition: transportPosition || null,
    });

    // Broadcast to other clients in the session
    this.broadcastToSession(client.sessionId, {
      type: 'playhead_update',
      sessionId: client.sessionId,
      userId: client.userId,
      data: {
        timecode,
        transportPosition,
        isPlaying,
        timestamp: Date.now(),
      },
    }, client.userId);
  }

  private broadcastToSession(sessionId: string, message: ProToolsWebSocketMessage, excludeUserId?: string) {
    const clients = this.clients.get(sessionId) || [];
    
    clients.forEach((client) => {
      if (client.userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error broadcasting to client:', error);
        }
      }
    });
  }

  private removeClient(sessionId: string, client: ConnectedClient) {
    const clients = this.clients.get(sessionId);
    if (clients) {
      const index = clients.indexOf(client);
      if (index > -1) {
        clients.splice(index, 1);
      }
      if (clients.length === 0) {
        this.clients.delete(sessionId);
      }
    }
  }

  private startPingInterval() {
    // Send ping every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      this.clients.forEach((clients, sessionId) => {
        clients.forEach((client) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            // Check if client hasn't responded to ping in 60 seconds
            if (Date.now() - client.lastPing > 60000) {
              console.log(`Closing stale connection for session ${sessionId}`);
              client.ws.close(1000, 'Connection timeout');
              this.removeClient(sessionId, client);
            } else {
              client.ws.send(JSON.stringify({
                type: 'ping',
                sessionId,
                timestamp: Date.now(),
              }));
            }
          }
        });
      });
    }, 30000);
  }

  /**
   * Send message to specific session (called from API routes)
   */
  public sendToSession(sessionId: string, message: ProToolsWebSocketMessage) {
    this.broadcastToSession(sessionId, message);
  }

  /**
   * Get connected clients count for a session
   */
  public getSessionClientCount(sessionId: string): number {
    return this.clients.get(sessionId)?.length || 0;
  }

  /**
   * Close all connections for a session
   */
  public closeSession(sessionId: string) {
    const clients = this.clients.get(sessionId) || [];
    clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, 'Session closed');
      }
    });
    this.clients.delete(sessionId);
  }

  /**
   * Cleanup
   */
  public close() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.wss.close();
  }
}

let proToolsWSS: ProToolsWebSocketServer | null = null;

export function initializeProToolsWebSocket(server: Server): ProToolsWebSocketServer {
  if (!proToolsWSS) {
    proToolsWSS = new ProToolsWebSocketServer(server);
  }
  return proToolsWSS;
}

export function getProToolsWebSocket(): ProToolsWebSocketServer | null {
  return proToolsWSS;
}























