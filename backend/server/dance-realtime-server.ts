/**
 * Dance realtime WebSocket server — workflow-audit G25/J1.
 *
 * Path: /ws/dance/realtime
 * Query: ?projectId=<id>&userId=<id>&displayName=<name>&color=<hex>
 *
 * Klienter i samme projectId-rom mottar:
 *   - presence:join når en ny klient kobler til
 *   - presence:leave når en klient kobler fra
 *   - cursor { userId, x, y } når andre flytter sin cursor
 *
 * Server keep-alive: ping hver 30s, klient svarer pong. Døde sockets
 * tas ned ved neste interval.
 *
 * Skala: in-memory per server-instance. For multi-instance må Redis
 * pub/sub legges på (TODO i kommentar i danceRealtimeClient.ts).
 *
 * Auth: forenklet — vi stoler på userId+displayName fra query. Hardening
 * via token-verifisering kommer i en senere PR (session-store-lookup).
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import crypto from 'crypto';

interface DanceClient {
  ws: WebSocket;
  clientId: string;
  userId: string;
  displayName: string;
  color: string;
  projectId: string;
  isAlive: boolean;
  connectedAt: Date;
}

const DEFAULT_COLOR_PALETTE = [
  '#a78bfa', '#fbbf24', '#34d399', '#60a5fa',
  '#ec4899', '#f87171', '#06b6d4', '#84cc16',
];

function pickColor(userId: string): string {
  // Deterministisk farge per user — stable across reconnects.
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return DEFAULT_COLOR_PALETTE[Math.abs(hash) % DEFAULT_COLOR_PALETTE.length];
}

export function createDanceRealtimeServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<string, DanceClient>();

  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname !== '/ws/dance/realtime') return;
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch {
      // Malformed URL — la andre listeners håndtere
    }
  });

  // Helper: send til alle i samme projectId-rom (except sender)
  function broadcast(projectId: string, payload: unknown, excludeClientId?: string): void {
    const data = JSON.stringify(payload);
    for (const c of clients.values()) {
      if (c.projectId !== projectId) continue;
      if (excludeClientId && c.clientId === excludeClientId) continue;
      if (c.ws.readyState !== WebSocket.OPEN) continue;
      try { c.ws.send(data); } catch { /* ignore */ }
    }
  }

  // Helper: hent presence-snapshot for et rom
  function presenceSnapshot(projectId: string): Array<{ userId: string; displayName: string; color: string }> {
    const seen = new Set<string>();
    const out: Array<{ userId: string; displayName: string; color: string }> = [];
    for (const c of clients.values()) {
      if (c.projectId !== projectId) continue;
      if (seen.has(c.userId)) continue;
      seen.add(c.userId);
      out.push({ userId: c.userId, displayName: c.displayName, color: c.color });
    }
    return out;
  }

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const projectId = url.searchParams.get('projectId') || '';
    const userId = url.searchParams.get('userId') || 'anonymous';
    const displayName = url.searchParams.get('displayName') || 'Anonymous';
    const color = url.searchParams.get('color') || pickColor(userId);

    if (!projectId) {
      ws.close(1008, 'projectId required');
      return;
    }

    const clientId = crypto.randomUUID();
    const client: DanceClient = {
      ws, clientId, userId, displayName, color, projectId,
      isAlive: true, connectedAt: new Date(),
    };
    clients.set(clientId, client);

    // Send snapshot av eksisterende presence til den nye klienten
    ws.send(JSON.stringify({
      type: 'presence:snapshot',
      users: presenceSnapshot(projectId),
    }));

    // Broadcast join til andre i samme rom
    broadcast(projectId, {
      type: 'presence:join',
      userId, displayName, color,
    }, clientId);

    ws.on('pong', () => { client.isAlive = true; });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!msg || typeof msg !== 'object') return;
        switch (msg.type) {
          case 'cursor': {
            // Broadcast cursor til andre i rommet — fall back på null hvis
            // utenfor stage.
            const x = typeof msg.x === 'number' ? msg.x : null;
            const y = typeof msg.y === 'number' ? msg.y : null;
            broadcast(projectId, {
              type: 'cursor',
              userId, x, y,
            }, clientId);
            break;
          }
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          }
          default:
            // Ukjent — ignorer stille
            break;
        }
      } catch {
        // JSON-parse-feil — ignorer
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      // Bare broadcast leave hvis ingen flere klienter har samme userId
      const stillPresent = Array.from(clients.values()).some((c) =>
        c.userId === userId && c.projectId === projectId
      );
      if (!stillPresent) {
        broadcast(projectId, {
          type: 'presence:leave',
          userId,
        });
      }
    });
  });

  // Keep-alive ping — clear ut døde sockets hvert 30. sekund
  const interval = setInterval(() => {
    for (const c of clients.values()) {
      if (!c.isAlive) {
        try { c.ws.terminate(); } catch { /* ignore */ }
        clients.delete(c.clientId);
        continue;
      }
      c.isAlive = false;
      try { c.ws.ping(); } catch { /* ignore */ }
    }
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  return wss;
}
