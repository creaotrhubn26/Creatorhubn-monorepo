/**
 * Leadgrid real-time event broadcaster.
 *
 * Backend → iPad live-updates uten polling. Bygger på 'ws'-pakken
 * (eksisterende i node_modules, brukes av attachCaptureWebSocket).
 *
 * Subscription-modell:
 *   - Klient kobler til /ws/leadgrid?token=<bearer>
 *   - Backend autentiserer mot activeSessions
 *   - Klient sender JSON {type: "subscribe", channels: ["org:<uuid>", "user:<id>"]}
 *   - Backend pusher events filtrert på channel
 *
 * Events:
 *   - lead.scored      (channel: org:<uuid>)
 *   - recommendation.created (channel: org:<uuid> + user:<id>)
 *   - followup.due     (channel: user:<id>)
 *   - nba.updated      (channel: org:<uuid>)
 *
 * Skaleringseffekt:
 *   - Når flere selgere ser samme org, slipper hver iPad å polle
 *     /api/leadgrid/intelligence/follow-up-queue hvert 30. sek.
 *   - Pushen kommer i samme sving som Intelligence Engine emitter
 *     webhooks → samme persist-grense (fire-and-forget).
 */

import type { Server as HTTPServer } from "http";
import type { Pool } from "pg";
import { WebSocketServer, WebSocket } from "ws";
import { URL } from "url";

type SessionData = {
  userId: string;
  role?: string;
  email?: string;
  [key: string]: unknown;
};

interface Client {
  ws: WebSocket;
  userId: string;
  channels: Set<string>;
  lastPing: number;
}

class LeadgridRealtimeServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<Client>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  attach(
    httpServer: HTTPServer,
    _pool: Pool,
    activeSessions: Map<string, SessionData>,
  ): void {
    this.wss = new WebSocketServer({ noServer: true });

    httpServer.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== "/ws/leadgrid") return;

      // Auth via token query-param eller Authorization-header
      let token: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) token = authHeader.slice(7);
      else token = url.searchParams.get("token");

      if (!token || !activeSessions.has(token)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const session = activeSessions.get(token)!;

      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        const client: Client = {
          ws,
          userId: session.userId,
          channels: new Set(),
          lastPing: Date.now(),
        };
        this.clients.add(client);

        ws.on("message", (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === "subscribe" && Array.isArray(msg.channels)) {
              for (const ch of msg.channels) {
                if (typeof ch === "string" && ch.length > 0 && ch.length < 200) {
                  client.channels.add(ch);
                }
              }
              ws.send(
                JSON.stringify({
                  type: "subscribed",
                  channels: Array.from(client.channels),
                }),
              );
            } else if (
              msg.type === "unsubscribe" &&
              Array.isArray(msg.channels)
            ) {
              for (const ch of msg.channels) client.channels.delete(ch);
            } else if (msg.type === "pong") {
              client.lastPing = Date.now();
            }
          } catch {
            // Ignorer dårlige meldinger
          }
        });

        ws.on("close", () => {
          this.clients.delete(client);
        });

        ws.on("error", () => {
          // Errors er allerede håndtert av close-eventen.
        });

        ws.send(JSON.stringify({ type: "ready", userId: session.userId }));
      });
    });

    // Heartbeat hvert 30. sek — drep klienter som ikke pinger på 90s
    this.heartbeatInterval = setInterval(() => {
      const cutoff = Date.now() - 90_000;
      for (const c of this.clients) {
        if (c.lastPing < cutoff) {
          try {
            c.ws.close();
          } catch {
            /* noop */
          }
          this.clients.delete(c);
        } else {
          try {
            c.ws.send(JSON.stringify({ type: "ping" }));
          } catch {
            /* noop */
          }
        }
      }
    }, 30_000);
    this.heartbeatInterval.unref?.();

    console.log(
      "[leadgrid-realtime] WebSocket server attached at /ws/leadgrid",
    );
  }

  /**
   * Broadcast et event til alle klienter abonnert på channel.
   */
  emit(event: { type: string; channel: string; data: unknown }): void {
    const payload = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });
    for (const c of this.clients) {
      if (c.channels.has(event.channel) && c.ws.readyState === WebSocket.OPEN) {
        try {
          c.ws.send(payload);
        } catch {
          /* noop */
        }
      }
    }
  }

  /**
   * Snapshot for observability
   */
  snapshot(): { clients: number; total_subscriptions: number } {
    let totalSubs = 0;
    for (const c of this.clients) totalSubs += c.channels.size;
    return { clients: this.clients.size, total_subscriptions: totalSubs };
  }
}

export const leadgridRealtime = new LeadgridRealtimeServer();

/**
 * Convenience-helpers: broadcast Intelligence-engine-events.
 *
 * Disse er trygge no-ops hvis ingen klienter er koblet til — de
 * itererer kun over `this.clients` som da er tom.
 */
export function broadcastLeadScored(
  orgId: string,
  leadId: string,
  payload: Record<string, unknown>,
): void {
  leadgridRealtime.emit({
    type: "lead.scored",
    channel: `org:${orgId}`,
    data: { lead_id: leadId, ...payload },
  });
}

export function broadcastRecommendation(
  orgId: string,
  userId: string | null,
  payload: Record<string, unknown>,
): void {
  leadgridRealtime.emit({
    type: "recommendation.created",
    channel: `org:${orgId}`,
    data: payload,
  });
  if (userId) {
    leadgridRealtime.emit({
      type: "recommendation.created",
      channel: `user:${userId}`,
      data: payload,
    });
  }
}

export function broadcastNbaUpdated(
  orgId: string,
  leadId: string,
  payload: Record<string, unknown>,
): void {
  leadgridRealtime.emit({
    type: "nba.updated",
    channel: `org:${orgId}`,
    data: { lead_id: leadId, ...payload },
  });
}

export function broadcastFollowupDue(
  userId: string,
  payload: Record<string, unknown>,
): void {
  leadgridRealtime.emit({
    type: "followup.due",
    channel: `user:${userId}`,
    data: payload,
  });
}

/**
 * Broadcast et nytt lead som dukker opp på kartet — typisk fra
 * batch-research, manuell add-lead, eller market-scan import.
 * Driver pulse-animasjon på iPad-pinen så salgskonsulenten ser
 * når et nytt lead lander uten å måtte refresh.
 *
 * `source` lar UI velge animasjon: 'batch' = subtil pulse, 'manual'
 * = sterkere pulse, 'discovery' = ekstra glow. Frontend kan ignorere.
 */
export function broadcastLeadCreated(
  orgId: string | null,
  userId: string | null,
  payload: {
    lead_id: string;
    organization_id?: string | null;
    project_id?: string | null;
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    source: "batch" | "manual" | "discovery" | "market_scan" | "import";
    batch_id?: string | null;
    [key: string]: unknown;
  },
): void {
  const data: Record<string, unknown> = { ...payload };
  if (orgId) {
    leadgridRealtime.emit({
      type: "lead.created",
      channel: `org:${orgId}`,
      data,
    });
  }
  if (userId) {
    leadgridRealtime.emit({
      type: "lead.created",
      channel: `user:${userId}`,
      data,
    });
  }
}
