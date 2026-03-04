/**
 * Split Sheet WebSocket Server
 * Real-time collaboration for split sheets
 * 
 * Endpoint: /ws/split-sheets/:splitSheetId
 * 
 * Message Types:
 * - contributor_update: Contributor changes
 * - percentage_update: Percentage changes
 * - status_update: Status changes
 * - presence_update: User presence
 * - lock_update: Editing locks
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface SplitSheetWebSocketMessage {
  type: 'contributor_update' | 'percentage_update' | 'status_update' | 'presence_update' | 'lock_update' | 'ping' | 'pong';
  splitSheetId: string;
  userId?: string;
  data?: any;
  timestamp?: number;
}

interface ConnectedClient {
  ws: WebSocket;
  splitSheetId: string;
  userId: string;
  lastPing: number;
  isEditing?: boolean;
  editingSection?: string;
}

export class SplitSheetWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient[]> = new Map(); // splitSheetId -> clients[]
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/split-sheets/:splitSheetId',
    });

    this.setupConnectionHandling();
    this.startPingInterval();
    
    console.log('📄 Split Sheet WebSocket server initialized on /ws/split-sheets/:splitSheetId');
  }

  private setupConnectionHandling() {
    this.wss.on('connection', async (ws: WebSocket, req: any) => {
      try {
        // Extract splitSheetId from URL path
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const pathParts = url.pathname.split('/');
        const splitSheetId = pathParts[pathParts.length - 1] || '';
        
        if (!splitSheetId) {
          ws.close(1008, 'Split Sheet ID required');
          return;
        }

        // Extract userId from query or headers
        const userId = req.headers['user-id'] || url.searchParams.get('userId') || 'anonymous';
        
        // Verify split sheet exists and user has access
        const checkQuery = sql`
          SELECT ss.* FROM split_sheets ss
          LEFT JOIN split_sheet_contributors ssc ON ss.id = ssc.split_sheet_id
          WHERE ss.id = ${splitSheetId} AND (ss.user_id = ${userId} OR ssc.user_id = ${userId})
        `;
        const checkResult = await db.execute(checkQuery);

        if (checkResult.rows.length === 0) {
          ws.close(1008, 'Split sheet not found or access denied');
          return;
        }

        // Add client to split sheet
        const client: ConnectedClient = {
          ws,
          splitSheetId,
          userId,
          lastPing: Date.now()
        };

        if (!this.clients.has(splitSheetId)) {
          this.clients.set(splitSheetId, []);
        }
        this.clients.get(splitSheetId)!.push(client);

        // Notify others of new presence
        this.broadcastToSplitSheet(splitSheetId, {
          type: 'presence_update',
          splitSheetId,
          userId,
          data: {
            action: 'joined',
            userId,
            timestamp: Date.now()
          },
          timestamp: Date.now()
        }, userId);

        // Send current presence
        const currentClients = this.clients.get(splitSheetId) || [];
        ws.send(JSON.stringify({
          type: 'presence_update',
          splitSheetId,
          data: {
            users: currentClients.map(c => ({
              userId: c.userId,
              isEditing: c.isEditing,
              editingSection: c.editingSection
            }))
          },
          timestamp: Date.now()
        }));

        // Handle messages
        ws.on('message', async (message: string) => {
          try {
            const msg: SplitSheetWebSocketMessage = JSON.parse(message.toString());
            await this.handleMessage(client, msg);
          } catch (error) {
            console.error('Error handling message:', error);
          }
        });

        // Handle disconnect
        ws.on('close', () => {
          this.removeClient(splitSheetId, userId);
          this.broadcastToSplitSheet(splitSheetId, {
            type: 'presence_update',
            splitSheetId,
            userId,
            data: {
              action: 'left',
              userId,
              timestamp: Date.now()
            },
            timestamp: Date.now()
          }, userId);
        });

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.removeClient(splitSheetId, userId);
        });

      } catch (error) {
        console.error('Error setting up WebSocket connection:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  private async handleMessage(client: ConnectedClient, msg: SplitSheetWebSocketMessage) {
    switch (msg.type) {
      case 'pong':
        client.lastPing = Date.now();
        break;

      case 'contributor_update':
      case 'percentage_update':
      case 'status_update':
        // Broadcast to all other clients in the same split sheet
        this.broadcastToSplitSheet(client.splitSheetId, msg, client.userId);
        break;

      case 'lock_update':
        // Update client's editing state
        client.isEditing = msg.data?.isEditing || false;
        client.editingSection = msg.data?.section;
        // Broadcast lock update
        this.broadcastToSplitSheet(client.splitSheetId, msg, client.userId);
        break;

      case 'ping':
        client.ws.send(JSON.stringify({
          type: 'pong',
          splitSheetId: client.splitSheetId,
          timestamp: Date.now()
        }));
        break;
    }
  }

  private broadcastToSplitSheet(splitSheetId: string, message: SplitSheetWebSocketMessage, excludeUserId?: string) {
    const clients = this.clients.get(splitSheetId) || [];
    const messageStr = JSON.stringify(message);

    clients.forEach(client => {
      if (client.userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
        } catch (error) {
          console.error('Error broadcasting message:', error);
        }
      }
    });
  }

  private removeClient(splitSheetId: string, userId: string) {
    const clients = this.clients.get(splitSheetId);
    if (clients) {
      const index = clients.findIndex(c => c.userId === userId);
      if (index >= 0) {
        clients.splice(index, 1);
      }
      if (clients.length === 0) {
        this.clients.delete(splitSheetId);
      }
    }
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      this.clients.forEach((clients, splitSheetId) => {
        clients.forEach(client => {
          // Check if client is still alive
          if (now - client.lastPing > 60000) { // 60 seconds timeout
            console.log(`Client ${client.userId} timed out for split sheet ${splitSheetId}`);
            this.removeClient(splitSheetId, client.userId);
            client.ws.close(1000, 'Timeout');
          } else {
            // Send ping
            if (client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(JSON.stringify({
                type: 'ping',
                splitSheetId,
                timestamp: now
              }));
            }
          }
        });
      });
    }, 30000); // Ping every 30 seconds
  }

  public shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.clients.forEach(clients => {
      clients.forEach(client => {
        client.ws.close(1001, 'Server shutdown');
      });
    });
    this.clients.clear();
    this.wss.close();
  }
}























