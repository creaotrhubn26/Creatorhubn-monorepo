/**
 * Leadgrid Canvas realtime — ekte multi-penn over WebSocket.
 *
 * Path: /ws/leadgrid-canvas?notatId=<uuid>
 *
 * Live Collab v1 pollet (delte notater hentet på nytt hvert intervall);
 * dette er den ekte kanalen: strøk relayes til alle i samme notat-rom i
 * det de tegnes. Append-only-modellen (PencilKit-strøk legges bare til)
 * gjør konfliktfri merging triviell — sletting/visking forsones fortsatt
 * via den eksisterende PUT/poll-syklusen, som består som fallback.
 *
 * Auth: Authorization: Bearer verifiseres mot canonical session storage og
 * aktuell user-version; deretter verifiseres notat-tilgangen mot databasen.
 *
 * Skala: in-memory per instance (samme avgrensning som dance-realtime).
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { Pool } from "pg";
import crypto from "crypto";
import { getCanvasAuthorization } from "./leadgrid-canvas-authorization.js";
import { LEADGRID_CANVAS_FEATURE_KEYS } from "./leadgrid-entitlement-guard.js";
import {
  resolveAuthoritativeAuthSession,
  type AuthoritativeAuthSession,
  type AuthoritativeAuthSessionResolution,
} from "./auth-session-authority.js";
import {
  parseWebSocketRequestUrl,
  resolveWebSocketPathOwner,
} from "./websocket-path-policy.js";
import { resolveCanonicalOrgAccess } from "./org-status-enforcement.js";
import { consumeSharedCanvasRateLimit } from "./leadgrid-canvas-rate-limit.js";

interface CanvasKlient {
  ws: WebSocket;
  klientId: string;
  token: string;
  userId: string;
  navn: string;
  notatId: string;
  organizationId: string;
  canWrite: boolean;
  revalidating: boolean;
  isAlive: boolean;
  messageWindowStartedAt: number;
  messageCount: number;
  messageBytes: number;
}

type SesjonsMap = Map<string, { userId: string; email?: string; name?: string }>;

export type CanvasRealtimeOptions = {
  heartbeatIntervalMs?: number;
  accessRevalidationIntervalMs?: number;
  resolveSession?: (
    token: string,
  ) => Promise<AuthoritativeAuthSessionResolution>;
  resolveAccess?: (
    userId: string,
    notatId: string,
    organizationId: string,
  ) => Promise<CanvasAccess | null>;
  maxPendingAuthentications?: number;
  maxHandshakeAttemptsPerMinute?: number;
  maxConnections?: number;
  maxConnectionsPerUser?: number;
  maxConnectionsPerNote?: number;
  messageRateWindowMs?: number;
  maxMessagesPerWindow?: number;
  maxMessageBytesPerWindow?: number;
  consumeHandshakeRate?: () => Promise<{ allowed: boolean }>;
};

type CanvasAccess = {
  organizationId: string;
  canWrite: boolean;
};

const CANVAS_NOTE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canvasBearerToken(
  authorization: string | string[] | undefined,
): string | null {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (typeof value !== "string") return null;
  return value.match(/^Bearer\s+([^\s]+)$/i)?.[1] ?? null;
}

export async function resolveCanvasRealtimeAccess(
  pool: Pool,
  userId: string,
  notatId: string,
  organizationId: string,
): Promise<CanvasAccess | null> {
  const tenantAccess = await resolveCanonicalOrgAccess(
    pool,
    userId,
    organizationId,
  );
  if (!tenantAccess?.canRead) return null;
  const entitlement = await pool.query<{ state: string }>(
    `SELECT state
       FROM leadgrid_org_entitlements
      WHERE organization_id = $1
        AND feature_key = ANY($2::text[])`,
    [organizationId, LEADGRID_CANVAS_FEATURE_KEYS],
  );
  if (
    entitlement.rows.length > 0
    && entitlement.rows.every((row) => row.state === "locked")
  ) return null;
  const note = await pool.query<{ user_id: string; delt: boolean }>(
    `SELECT user_id, delt FROM leadgrid_canvas_notater
      WHERE id = $1 AND organization_id = $2
        AND (user_id = $3 OR delt) AND slettet_at IS NULL
      LIMIT 1`,
    [notatId, organizationId, userId],
  );
  const row = note.rows[0];
  if (!row) return null;
  if (row.user_id !== userId) {
    return { organizationId, canWrite: false };
  }
  const authorization = await getCanvasAuthorization(
    pool,
    userId,
    organizationId,
  );
  return {
    organizationId,
    canWrite: tenantAccess.canWrite && authorization.canWrite,
  };
}

export function createCanvasRealtimeServer(
  server: Server,
  pool: Pool,
  activeSessions: SesjonsMap,
  options: CanvasRealtimeOptions = {},
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 600_000 });
  const klienter = new Map<string, CanvasKlient>();
  let pendingAuthentications = 0;
  let handshakeWindowStartedAt = Date.now();
  let handshakeAttempts = 0;
  const maxPendingAuthentications = Math.max(
    1,
    options.maxPendingAuthentications ?? 32,
  );
  const maxHandshakeAttemptsPerMinute = Math.max(
    1,
    options.maxHandshakeAttemptsPerMinute ?? 1_200,
  );
  const maxConnections = Math.max(1, options.maxConnections ?? 500);
  const maxConnectionsPerUser = Math.max(
    1,
    options.maxConnectionsPerUser ?? 8,
  );
  const maxConnectionsPerNote = Math.max(
    1,
    options.maxConnectionsPerNote ?? 50,
  );
  const messageRateWindowMs = Math.max(
    1_000,
    options.messageRateWindowMs ?? 10_000,
  );
  const maxMessagesPerWindow = Math.max(
    1,
    options.maxMessagesPerWindow ?? 120,
  );
  const maxMessageBytesPerWindow = Math.max(
    1_024,
    options.maxMessageBytesPerWindow ?? 8 * 1024 * 1024,
  );
  const resolveSession = options.resolveSession ?? ((token: string) =>
    resolveAuthoritativeAuthSession({
      pool,
      token,
      activeSessions: activeSessions as Map<string, AuthoritativeAuthSession>,
    }));
  const resolveAccess = options.resolveAccess ?? ((
    userId: string,
    notatId: string,
    organizationId: string,
  ) => resolveCanvasRealtimeAccess(pool, userId, notatId, organizationId));
  const consumeHandshakeRate = options.consumeHandshakeRate ?? (() =>
    consumeSharedCanvasRateLimit(pool, {
      operation: "realtime-handshake",
      // Preserve the existing global handshake budget across every instance.
      // No bearer token or user identifier is persisted in the bucket table.
      identity: "global",
      limit: maxHandshakeAttemptsPerMinute,
      windowMs: 60_000,
      mode: "handshake",
    }));

  server.on("upgrade", (req, socket, head) => {
    const url = parseWebSocketRequestUrl(req.url);
    if (!url || resolveWebSocketPathOwner(url.pathname) !== "leadgrid-canvas") return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  function broadcast(notatId: string, payload: unknown, unntattKlientId?: string): void {
    const data = JSON.stringify(payload);
    for (const k of klienter.values()) {
      if (k.notatId !== notatId) continue;
      if (unntattKlientId && k.klientId === unntattKlientId) continue;
      if (k.ws.readyState !== WebSocket.OPEN) continue;
      try { k.ws.send(data); } catch { /* ignore */ }
    }
  }

  function tilstede(notatId: string): Array<{ userId: string; displayName: string }> {
    const sett = new Set<string>();
    const ut: Array<{ userId: string; displayName: string }> = [];
    for (const k of klienter.values()) {
      if (k.notatId !== notatId || sett.has(k.userId)) continue;
      sett.add(k.userId);
      ut.push({ userId: k.userId, displayName: k.navn });
    }
    return ut;
  }

  wss.on("connection", (ws, req) => {
    const now = Date.now();
    if (now - handshakeWindowStartedAt >= 60_000) {
      handshakeWindowStartedAt = now;
      handshakeAttempts = 0;
    }
    if (handshakeAttempts >= maxHandshakeAttemptsPerMinute) {
      ws.close(1013, "handshake_rate_limited");
      return;
    }
    handshakeAttempts += 1;
    if (pendingAuthentications >= maxPendingAuthentications) {
      ws.close(1013, "authentication_capacity");
      return;
    }
    pendingAuthentications += 1;
    void (async () => {
      const url = parseWebSocketRequestUrl(req.url);
      if (!url) {
        ws.close(1008, "invalid_request_target");
        return;
      }
      const notatId = url.searchParams.get("notatId") || "";
      if (!CANVAS_NOTE_ID.test(notatId)) {
        ws.close(1008, "invalid_note");
        return;
      }
      const queryOrganizationId = (
        url.searchParams.get("organizationId") || ""
      ).trim();
      const rawHeaderOrganizationId = req.headers["x-organization-id"];
      const headerOrganizationId = (
        Array.isArray(rawHeaderOrganizationId)
          ? rawHeaderOrganizationId[0]
          : rawHeaderOrganizationId || ""
      ).trim();
      if (
        !queryOrganizationId
        || queryOrganizationId.length > 200
        || (headerOrganizationId && headerOrganizationId !== queryOrganizationId)
      ) {
        ws.close(
          1008,
          headerOrganizationId && headerOrganizationId !== queryOrganizationId
            ? "organization_mismatch"
            : "organization_required",
        );
        return;
      }

      const headerToken = canvasBearerToken(req.headers.authorization);
      const allowLegacyQueryToken = /^(1|true)$/i.test(
        process.env.CANVAS_ALLOW_QUERY_TOKEN ?? "",
      );
      const queryToken = allowLegacyQueryToken
        ? (url.searchParams.get("token") || "")
        : "";
      const token = headerToken ?? queryToken;
      if (!token) {
        ws.close(1008, "auth_required");
        return;
      }

      try {
        const rate = await consumeHandshakeRate();
        if (!rate.allowed) {
          ws.close(1013, "handshake_rate_limited");
          return;
        }
      } catch {
        // Realtime auth work must not fail open across a DB outage: otherwise
        // every instance independently admits the full handshake budget.
        ws.close(1011, "rate_limit_unavailable");
        return;
      }

      let sesjon: AuthoritativeAuthSession;
      try {
        const resolution = await resolveSession(token);
        if (resolution.status === "unavailable") {
          ws.close(1011, "session_authority_unavailable");
          return;
        }
        if (resolution.status !== "authenticated") {
          ws.close(1008, "auth_required");
          return;
        }
        sesjon = resolution.session;
      } catch {
        ws.close(1011, "session_authority_unavailable");
        return;
      }

      let access: CanvasAccess | null;
      try {
        access = await resolveAccess(
          sesjon.userId,
          notatId,
          queryOrganizationId,
        );
      } catch {
        ws.close(1011, "db_error");
        return;
      }
      if (!access) {
        ws.close(1008, "not_found");
        return;
      }

      const userConnections = [...klienter.values()]
        .filter((client) => client.userId === sesjon.userId).length;
      const noteConnections = [...klienter.values()]
        .filter((client) => client.notatId === notatId).length;
      if (
        klienter.size >= maxConnections ||
        userConnections >= maxConnectionsPerUser ||
        noteConnections >= maxConnectionsPerNote
      ) {
        ws.close(1013, "connection_capacity");
        return;
      }

      const klientId = crypto.randomUUID();
      const navn = sesjon.name || sesjon.email || "Kollega";
      const klient: CanvasKlient = {
        ws,
        klientId,
        token,
        userId: sesjon.userId,
        navn,
        notatId,
        organizationId: access.organizationId,
        canWrite: access.canWrite,
        revalidating: false,
        isAlive: true,
        messageWindowStartedAt: Date.now(),
        messageCount: 0,
        messageBytes: 0,
      };
      klienter.set(klientId, klient);

      ws.send(JSON.stringify({
        type: "access",
        canWrite: klient.canWrite,
        legacyAuth: !headerToken,
      }));
      ws.send(JSON.stringify({
        type: "presence:snapshot",
        users: tilstede(notatId).filter((u) => u.userId !== sesjon.userId),
      }));
      broadcast(notatId, {
        type: "presence:join",
        userId: sesjon.userId,
        displayName: navn,
      }, klientId);

      ws.on("pong", () => { klient.isAlive = true; });

      ws.on("message", (rå) => {
        const now = Date.now();
        if (now - klient.messageWindowStartedAt >= messageRateWindowMs) {
          klient.messageWindowStartedAt = now;
          klient.messageCount = 0;
          klient.messageBytes = 0;
        }
        const rawBytes = Buffer.isBuffer(rå)
          ? rå.byteLength
          : Buffer.byteLength(String(rå), "utf8");
        klient.messageCount += 1;
        klient.messageBytes += rawBytes;
        if (
          klient.messageCount > maxMessagesPerWindow ||
          klient.messageBytes > maxMessageBytesPerWindow
        ) {
          ws.close(1008, "message_rate_limited");
          return;
        }
        let melding: Record<string, unknown>;
        try {
          melding = JSON.parse(String(rå));
        } catch { return; }
        // Strøk-relay: base64-PKDrawing-delta (cap 512 kB per melding).
        if (melding.type === "strokes"
            && typeof melding.strokes === "string"
            && melding.strokes.length <= 512_000) {
          if (!klient.canWrite) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "error", error: "read_only" }));
            }
            return;
          }
          broadcast(notatId, {
            type: "strokes",
            strokes: melding.strokes,
            fra: navn,
          }, klientId);
        }
      });

      ws.on("close", () => {
        klienter.delete(klientId);
        const fortsattInne = [...klienter.values()]
          .some((k) => k.notatId === notatId && k.userId === sesjon.userId);
        if (!fortsattInne) {
          broadcast(notatId, {
            type: "presence:leave",
            userId: sesjon.userId,
            displayName: navn,
          });
        }
      });
    })().finally(() => {
      pendingAuthentications = Math.max(0, pendingAuthentications - 1);
    });
  });

  async function revalidate(klient: CanvasKlient): Promise<void> {
    if (klient.revalidating || klient.ws.readyState !== WebSocket.OPEN) return;
    klient.revalidating = true;
    try {
      const resolution = await resolveSession(klient.token);
      if (
        resolution.status !== "authenticated"
        || resolution.session.userId !== klient.userId
      ) {
        klient.ws.close(
          resolution.status === "unavailable" ? 1011 : 1008,
          resolution.status === "unavailable"
            ? "session_authority_unavailable"
            : "session_revoked",
        );
        return;
      }
      const access = await resolveAccess(
        klient.userId,
        klient.notatId,
        klient.organizationId,
      );
      if (!access || access.organizationId !== klient.organizationId) {
        klient.ws.close(1008, "access_revoked");
        return;
      }
      if (access.canWrite !== klient.canWrite) {
        klient.canWrite = access.canWrite;
        klient.ws.send(JSON.stringify({
          type: "access",
          canWrite: klient.canWrite,
          legacyAuth: false,
        }));
      }
    } catch {
      klient.ws.close(1011, "access_check_failed");
    } finally {
      klient.revalidating = false;
    }
  }

  // Keep-alive: ping hvert 30. sekund, døde sockets ryddes.
  const intervall = setInterval(() => {
    for (const [id, k] of klienter) {
      if (!k.isAlive) {
        try { k.ws.terminate(); } catch { /* ignore */ }
        klienter.delete(id);
        continue;
      }
      k.isAlive = false;
      try { k.ws.ping(); } catch { /* ignore */ }
    }
  }, Math.max(10, options.heartbeatIntervalMs ?? 30_000));
  const tilgangsintervall = setInterval(() => {
    for (const klient of klienter.values()) void revalidate(klient);
  }, Math.max(10, options.accessRevalidationIntervalMs ?? 30_000));
  wss.on("close", () => {
    clearInterval(intervall);
    clearInterval(tilgangsintervall);
  });

  return wss;
}
