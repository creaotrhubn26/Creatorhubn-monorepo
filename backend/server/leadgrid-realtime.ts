/**
 * Leadgrid real-time event broadcaster.
 *
 * Backend → iPad live-updates uten polling. Bygger på 'ws'-pakken
 * (eksisterende i node_modules, brukes av attachCaptureWebSocket).
 *
 * Subscription-modell:
 *   - Klient veksler innlogget HTTPS-session mot en 30 s engangsbillett
 *   - Klient kobler til /ws/leadgrid?ticket=<single-use>
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
import type express from "express";
import type { Pool } from "pg";
import { WebSocketServer, WebSocket } from "ws";
import { URL } from "url";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import {
  consumeLeadgridRealtimeTicket,
  issueLeadgridRealtimeTicket,
} from "./leadgrid-realtime-ticket-store.js";

export const LEADGRID_REALTIME_TICKET_PATH = "/api/leadgrid/realtime/ticket";
export const LEADGRID_REALTIME_WS_PATH = "/ws/leadgrid";
export const LEADGRID_REALTIME_MAX_PAYLOAD_BYTES = 16 * 1024;
export const LEADGRID_REALTIME_MAX_CHANNELS = 32;
export const LEADGRID_REALTIME_MAX_PENDING_MESSAGES = 16;

export async function authenticateLeadgridRealtimeUpgrade(
  pool: Pick<Pool, "query">,
  requestUrl: string,
): Promise<{ userId: string } | null> {
  const url = new URL(requestUrl, "http://localhost");
  if (url.pathname !== LEADGRID_REALTIME_WS_PATH) return null;
  const ticket = (url.searchParams.get("ticket") ?? "").trim();
  if (!ticket) return null;
  return consumeLeadgridRealtimeTicket(pool, ticket);
}

export function setupLeadgridRealtimeTicketRoute(input: {
  app: express.Application;
  pool: Pool;
  requireUserSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string } | null;
}): void {
  input.app.post(LEADGRID_REALTIME_TICKET_PATH, async (req, res) => {
    const session = input.requireUserSession(req, res);
    if (!session) return;
    try {
      const issued = await issueLeadgridRealtimeTicket(
        input.pool,
        session.userId,
      );
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.status(201).json({
        ...issued,
        websocketPath: LEADGRID_REALTIME_WS_PATH,
      });
    } catch (error) {
      console.error(
        "[leadgrid-realtime] ticket issue failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      res.status(503).json({ error: "realtime_ticket_store_unavailable" });
    }
  });
}

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
  messageQueue: Promise<void>;
  pendingMessages: number;
}

export class LeadgridRealtimeServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<Client>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatRunning = false;

  attach(
    httpServer: HTTPServer,
    pool: Pool,
    _activeSessions: Map<string, SessionData>,
  ): void {
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: LEADGRID_REALTIME_MAX_PAYLOAD_BYTES,
    });

    httpServer.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== LEADGRID_REALTIME_WS_PATH) return;
      if (!(url.searchParams.get("ticket") ?? "").trim()) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      void authenticateLeadgridRealtimeUpgrade(pool, req.url ?? "/")
        .then((ticketSession) => {
          if (!ticketSession || !this.wss) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }
          this.wss.handleUpgrade(req, socket, head, (ws) => {
            const client: Client = {
              ws,
              userId: ticketSession.userId,
              channels: new Set(),
              lastPing: Date.now(),
              messageQueue: Promise.resolve(),
              pendingMessages: 0,
            };
            this.clients.add(client);

            ws.on("message", (raw) => {
              // ws does not await async listeners. Serializing per connection
              // prevents concurrent subscribe frames from racing past the cap.
              if (
                client.pendingMessages >= LEADGRID_REALTIME_MAX_PENDING_MESSAGES
              ) {
                ws.close(1008, "message_rate_limit");
                return;
              }
              client.pendingMessages += 1;
              client.messageQueue = client.messageQueue
                .then(async () => {
                  try {
                    const msg = JSON.parse(raw.toString());
                    if (
                      msg.type === "subscribe" &&
                      Array.isArray(msg.channels)
                    ) {
                      const denied: string[] = [];
                      let overflow = 0;
                      let authorizationChecks = 0;
                      for (const ch of msg.channels) {
                        if (
                          typeof ch !== "string" ||
                          ch.length === 0 ||
                          ch.length >= 200
                        ) {
                          continue;
                        }
                        if (client.channels.has(ch)) continue;
                        if (
                          client.channels.size >=
                            LEADGRID_REALTIME_MAX_CHANNELS ||
                          authorizationChecks >= LEADGRID_REALTIME_MAX_CHANNELS
                        ) {
                          overflow += 1;
                          continue;
                        }
                        authorizationChecks += 1;
                        if (await this.canSubscribe(pool, client.userId, ch)) {
                          client.channels.add(ch);
                        } else {
                          denied.push(ch);
                        }
                      }
                      ws.send(
                        JSON.stringify({
                          type: "subscribed",
                          channels: Array.from(client.channels),
                          ...(denied.length ? { denied } : {}),
                          ...(overflow
                            ? {
                                overflow,
                                channelLimit: LEADGRID_REALTIME_MAX_CHANNELS,
                              }
                            : {}),
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
                    // Ignore malformed client frames.
                  }
                })
                .finally(() => {
                  client.pendingMessages = Math.max(
                    0,
                    client.pendingMessages - 1,
                  );
                });
            });

            ws.on("close", () => this.clients.delete(client));
            ws.on("error", () => this.clients.delete(client));
            ws.send(
              JSON.stringify({ type: "ready", userId: ticketSession.userId }),
            );
          });
        })
        .catch(() => {
          socket.destroy();
        });
    });

    // Heartbeat hvert 30. sek — drep klienter som ikke pinger på 90s
    this.heartbeatInterval = setInterval(() => {
      if (this.heartbeatRunning) return;
      this.heartbeatRunning = true;
      void this.heartbeat(pool).finally(() => {
        this.heartbeatRunning = false;
      });
    }, 30_000);
    this.heartbeatInterval.unref?.();
    httpServer.on("close", () => {
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.wss?.close();
    });

    console.log(
      "[leadgrid-realtime] WebSocket server attached at /ws/leadgrid",
    );
  }

  /**
   * Authorize a subscribe request for a single channel against the
   * connecting user. `user:<id>` is allowed only for one's own id;
   * `org:<uuid>` requires organization membership. Unknown channel
   * shapes are denied by default (fail closed).
   */
  private async canSubscribe(
    pool: Pool,
    userId: string,
    channel: string,
  ): Promise<boolean> {
    const sep = channel.indexOf(":");
    if (sep <= 0) return false;
    const kind = channel.slice(0, sep);
    const id = channel.slice(sep + 1);
    if (!id) return false;
    if (kind === "user") {
      return id === userId;
    }
    if (kind === "org") {
      try {
        const { role } = await resolveEffectivePermissions(pool, id, userId);
        return Boolean(role);
      } catch {
        return false;
      }
    }
    return false;
  }

  /** Re-authorize live tenant channels so membership revocation takes effect. */
  private async heartbeat(pool: Pool): Promise<void> {
    const cutoff = Date.now() - 90_000;
    await Promise.all(
      [...this.clients].map(async (client) => {
        if (client.lastPing < cutoff) {
          try {
            client.ws.close(1008, "heartbeat_timeout");
          } catch {
            /* noop */
          }
          this.clients.delete(client);
          return;
        }
        const revoked: string[] = [];
        for (const channel of [...client.channels]) {
          if (!(await this.canSubscribe(pool, client.userId, channel))) {
            client.channels.delete(channel);
            revoked.push(channel);
          }
        }
        try {
          if (revoked.length) {
            client.ws.send(
              JSON.stringify({
                type: "authorization.updated",
                revoked,
                channels: [...client.channels],
              }),
            );
          }
          client.ws.send(JSON.stringify({ type: "ping" }));
        } catch {
          this.clients.delete(client);
        }
      }),
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
