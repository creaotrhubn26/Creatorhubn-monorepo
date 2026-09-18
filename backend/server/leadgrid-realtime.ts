/**
 * Leadgrid real-time event broadcaster.
 *
 * Backend → iPad live-updates uten polling. Bygger på 'ws'-pakken
 * (eksisterende i node_modules, brukes av attachCaptureWebSocket).
 *
 * Subscription-modell:
 *   - Klient kobler til /ws/leadgrid med Authorization: Bearer <token>
 *   - Backend autentiserer mot activeSessions
 *   - Klient sender JSON {type: "subscribe", channels: ["org:<uuid>"]}
 *   - Backend pusher events filtrert på channel
 *
 * Events:
 *   - lead.scored      (channel: org:<uuid>)
 *   - recommendation.created (channel: org:<uuid>)
 *   - followup.due     (channel: org:<uuid>)
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
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { createHash } from "crypto";
import { resolveEffectivePermissions } from "./lead-map-permission-routes.js";
import { resolveAuthoritativeAuthSession } from "./auth-session-authority.js";
import {
  parseWebSocketRequestUrl,
  resolveWebSocketPathOwner,
} from "./websocket-path-policy.js";

export type LeadgridRealtimeSessionData = {
  userId: string;
  role?: string;
  email?: string;
  [key: string]: unknown;
};

type PersistedRealtimeSession = LeadgridRealtimeSessionData & {
  email: string;
  name: string;
  role: string;
  loginAt: string;
};

interface Client {
  ws: WebSocket;
  token: string;
  userId: string;
  channels: Set<string>;
  lastPing: number;
  lastValidatedAt: number;
  validating: boolean;
  messageQueue: Promise<void>;
  pendingMessages: number;
  releaseConnection?: () => void;
  released?: boolean;
}

/**
 * Realtime carries tenant lead data, so its resource limits intentionally stay
 * much smaller than the HTTP API's general body limit.
 */
export const LEADGRID_REALTIME_MAX_PAYLOAD_BYTES = 16 * 1024;
export const LEADGRID_REALTIME_MAX_CHANNELS = 16;
export const LEADGRID_REALTIME_MAX_PENDING_MESSAGES = 8;
export const LEADGRID_REALTIME_MAX_CHANNEL_LENGTH = 64;

/**
 * Per-process connection ceilings. A token may represent several legitimate
 * tabs/devices, but never an unbounded number of sockets or concurrent
 * persistent-session lookups. The peer limit uses only the actual TCP peer;
 * forwarded headers are deliberately ignored because their trust boundary is
 * deployment-specific.
 */
export const LEADGRID_REALTIME_MAX_CONNECTIONS = 256;
export const LEADGRID_REALTIME_MAX_CONNECTIONS_PER_TOKEN = 4;
export const LEADGRID_REALTIME_MAX_CONNECTIONS_PER_USER = 8;
export const LEADGRID_REALTIME_MAX_CONNECTIONS_PER_REMOTE_PEER = 64;
export const LEADGRID_REALTIME_MAX_BUFFERED_AMOUNT_BYTES = 256 * 1024;
export const LEADGRID_REALTIME_CLOSE_GRACE_MS = 5_000;
export const LEADGRID_REALTIME_MAX_AUTH_WORK = 64;
export const LEADGRID_REALTIME_MAX_AUTH_WORK_PER_REMOTE_PEER = 8;
export const LEADGRID_REALTIME_AUTH_GLOBAL_BUCKET_CAPACITY = 600;
export const LEADGRID_REALTIME_AUTH_GLOBAL_REFILL_PER_SECOND = 10;
export const LEADGRID_REALTIME_AUTH_PEER_BUCKET_CAPACITY = 30;
export const LEADGRID_REALTIME_AUTH_PEER_REFILL_PER_SECOND = 0.5;
export const LEADGRID_REALTIME_AUTH_MAX_TRACKED_PEERS = 2_048;

/**
 * A tenant event is only delivered while auth is at most 15 seconds old.
 * The first event after expiry is dropped and starts one deduplicated refresh.
 */
export const LEADGRID_REALTIME_AUTHORIZATION_FRESHNESS_MS = 15_000;
export const LEADGRID_REALTIME_AUTHORIZATION_TIMEOUT_MS = 3_000;

const LEADGRID_ORG_CHANNEL_PATTERN =
  /^org:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PersistedSessionLoader = (
  pool: Pool,
  token: string,
) => Promise<PersistedRealtimeSession | null>;

async function resolveDefaultRealtimeSession(
  pool: Pool,
  token: string,
  activeSessions: Map<string, LeadgridRealtimeSessionData>,
): Promise<PersistedRealtimeSession | null> {
  const resolution = await resolveAuthoritativeAuthSession({
    pool,
    token,
    activeSessions,
  });
  if (resolution.status === "unavailable") {
    throw new Error("leadgrid_realtime_authority_unavailable");
  }
  return resolution.status === "authenticated"
    ? resolution.session as PersistedRealtimeSession
    : null;
}

type LeadgridRealtimeConnectionLimits = {
  global: number;
  perToken: number;
  perUser: number;
  perRemotePeer: number;
};

export type LeadgridRealtimeConnectionLimitScope =
  | "global"
  | "token"
  | "user"
  | "remote_peer";

export type LeadgridRealtimeUserAssociationResult =
  | { allowed: true }
  | { allowed: false; scope: "user" };

export type LeadgridRealtimeConnectionReservation = {
  associateUser: (userId: string) => LeadgridRealtimeUserAssociationResult;
  release: () => void;
};

export type LeadgridRealtimeConnectionReservationResult =
  | {
      allowed: true;
      reservation: LeadgridRealtimeConnectionReservation;
    }
  | {
      allowed: false;
      scope: LeadgridRealtimeConnectionLimitScope;
    };

function normalizePositiveLimit(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? Number(value)
    : fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function opaqueConnectionIdentity(
  kind: "token" | "user" | "peer",
  value: string,
) {
  return createHash("sha256").update(`${kind}:${value}`).digest("base64url");
}

function readRemotePeerAddress(socket: unknown): string | null {
  const remoteAddress = (socket as { remoteAddress?: unknown })?.remoteAddress;
  return typeof remoteAddress === "string" && remoteAddress.trim()
    ? remoteAddress.trim()
    : null;
}

/**
 * Synchronous reservations are atomic in a Node process: no async handshake
 * can start between the limit check and the counter increments. Reservations
 * are idempotently released so overlapping socket/error cleanup is safe.
 */
export class LeadgridRealtimeConnectionLimiter {
  private readonly limits: LeadgridRealtimeConnectionLimits;
  private active = 0;
  private readonly byToken = new Map<string, number>();
  private readonly byUser = new Map<string, number>();
  private readonly byRemotePeer = new Map<string, number>();

  constructor(limits: Partial<LeadgridRealtimeConnectionLimits> = {}) {
    this.limits = {
      global: normalizePositiveLimit(
        limits.global,
        LEADGRID_REALTIME_MAX_CONNECTIONS,
      ),
      perToken: normalizePositiveLimit(
        limits.perToken,
        LEADGRID_REALTIME_MAX_CONNECTIONS_PER_TOKEN,
      ),
      perUser: normalizePositiveLimit(
        limits.perUser,
        LEADGRID_REALTIME_MAX_CONNECTIONS_PER_USER,
      ),
      perRemotePeer: normalizePositiveLimit(
        limits.perRemotePeer,
        LEADGRID_REALTIME_MAX_CONNECTIONS_PER_REMOTE_PEER,
      ),
    };
  }

  reserve(
    token: string,
    remoteAddress?: string | null,
  ): LeadgridRealtimeConnectionReservationResult {
    const tokenKey = opaqueConnectionIdentity("token", token);
    const normalizedRemoteAddress = remoteAddress?.trim() || null;
    const remotePeerKey = normalizedRemoteAddress
      ? opaqueConnectionIdentity("peer", normalizedRemoteAddress)
      : null;

    if (this.active >= this.limits.global) {
      return { allowed: false, scope: "global" };
    }
    if ((this.byToken.get(tokenKey) ?? 0) >= this.limits.perToken) {
      return { allowed: false, scope: "token" };
    }
    if (
      remotePeerKey &&
      (this.byRemotePeer.get(remotePeerKey) ?? 0) >= this.limits.perRemotePeer
    ) {
      return { allowed: false, scope: "remote_peer" };
    }

    this.active += 1;
    this.byToken.set(tokenKey, (this.byToken.get(tokenKey) ?? 0) + 1);
    if (remotePeerKey) {
      this.byRemotePeer.set(
        remotePeerKey,
        (this.byRemotePeer.get(remotePeerKey) ?? 0) + 1,
      );
    }

    let released = false;
    let userKey: string | null = null;
    return {
      allowed: true,
      reservation: {
        associateUser: (userId) => {
          const normalizedUserId =
            typeof userId === "string" ? userId.trim() : "";
          if (released || !normalizedUserId) {
            return { allowed: false, scope: "user" };
          }
          const nextUserKey = opaqueConnectionIdentity(
            "user",
            normalizedUserId,
          );
          if (userKey === nextUserKey) return { allowed: true };
          if (userKey) return { allowed: false, scope: "user" };
          if ((this.byUser.get(nextUserKey) ?? 0) >= this.limits.perUser) {
            return { allowed: false, scope: "user" };
          }
          this.byUser.set(nextUserKey, (this.byUser.get(nextUserKey) ?? 0) + 1);
          userKey = nextUserKey;
          return { allowed: true };
        },
        release: () => {
          if (released) return;
          released = true;
          this.active = Math.max(0, this.active - 1);
          this.decrement(this.byToken, tokenKey);
          if (userKey) this.decrement(this.byUser, userKey);
          if (remotePeerKey) this.decrement(this.byRemotePeer, remotePeerKey);
        },
      },
    };
  }

  snapshot(): {
    active: number;
    activeTokens: number;
    activeUsers: number;
    activeRemotePeers: number;
  } {
    return {
      active: this.active,
      activeTokens: this.byToken.size,
      activeUsers: this.byUser.size,
      activeRemotePeers: this.byRemotePeer.size,
    };
  }

  private decrement(counts: Map<string, number>, key: string): void {
    const next = (counts.get(key) ?? 0) - 1;
    if (next <= 0) counts.delete(key);
    else counts.set(key, next);
  }
}

type LeadgridRealtimeHandshakeAdmissionLimits = {
  globalInFlight: number;
  perRemotePeerInFlight: number;
  globalBucketCapacity: number;
  globalRefillPerSecond: number;
  peerBucketCapacity: number;
  peerRefillPerSecond: number;
  maxTrackedPeers: number;
};

type HandshakeTokenBucket = {
  tokens: number;
  updatedAt: number;
  lastSeenAt: number;
};

export type LeadgridRealtimeHandshakeAdmissionScope =
  | "global_in_flight"
  | "remote_peer_in_flight"
  | "global_rate"
  | "remote_peer_rate"
  | "peer_state_capacity";

export type LeadgridRealtimeHandshakeAdmissionLease = {
  release: () => void;
};

export type LeadgridRealtimeHandshakeAdmissionResult =
  | { allowed: true; lease: LeadgridRealtimeHandshakeAdmissionLease }
  | { allowed: false; scope: LeadgridRealtimeHandshakeAdmissionScope };

/**
 * Bounds the database work started by WebSocket authentication separately
 * from socket counts. Token buckets stop fast rotating-bearer 401 floods,
 * while in-flight leases remain held until the raw loader settles (not merely
 * until the HTTP-facing authorization timeout fires).
 */
export class LeadgridRealtimeHandshakeAdmission {
  private readonly limits: LeadgridRealtimeHandshakeAdmissionLimits;
  private readonly now: () => number;
  private globalBucket: HandshakeTokenBucket;
  private globalInFlight = 0;
  private readonly inFlightByRemotePeer = new Map<string, number>();
  private readonly peerBuckets = new Map<string, HandshakeTokenBucket>();

  constructor(
    options: Partial<LeadgridRealtimeHandshakeAdmissionLimits> & {
      now?: () => number;
    } = {},
  ) {
    this.limits = {
      globalInFlight: normalizePositiveLimit(
        options.globalInFlight,
        LEADGRID_REALTIME_MAX_AUTH_WORK,
      ),
      perRemotePeerInFlight: normalizePositiveLimit(
        options.perRemotePeerInFlight,
        LEADGRID_REALTIME_MAX_AUTH_WORK_PER_REMOTE_PEER,
      ),
      globalBucketCapacity: normalizePositiveNumber(
        options.globalBucketCapacity,
        LEADGRID_REALTIME_AUTH_GLOBAL_BUCKET_CAPACITY,
      ),
      globalRefillPerSecond: normalizePositiveNumber(
        options.globalRefillPerSecond,
        LEADGRID_REALTIME_AUTH_GLOBAL_REFILL_PER_SECOND,
      ),
      peerBucketCapacity: normalizePositiveNumber(
        options.peerBucketCapacity,
        LEADGRID_REALTIME_AUTH_PEER_BUCKET_CAPACITY,
      ),
      peerRefillPerSecond: normalizePositiveNumber(
        options.peerRefillPerSecond,
        LEADGRID_REALTIME_AUTH_PEER_REFILL_PER_SECOND,
      ),
      maxTrackedPeers: normalizePositiveLimit(
        options.maxTrackedPeers,
        LEADGRID_REALTIME_AUTH_MAX_TRACKED_PEERS,
      ),
    };
    this.now = options.now ?? Date.now;
    const now = this.now();
    this.globalBucket = {
      tokens: this.limits.globalBucketCapacity,
      updatedAt: now,
      lastSeenAt: now,
    };
  }

  acquire(
    remoteAddress?: string | null,
  ): LeadgridRealtimeHandshakeAdmissionResult {
    const now = this.now();
    const peerKey = opaqueConnectionIdentity(
      "peer",
      remoteAddress?.trim() || "<unknown>",
    );
    this.refill(
      this.globalBucket,
      this.limits.globalBucketCapacity,
      this.limits.globalRefillPerSecond,
      now,
    );
    this.pruneIdlePeerBuckets(now);

    const existingPeerBucket = this.peerBuckets.get(peerKey);
    const peerBucket = existingPeerBucket ?? {
      tokens: this.limits.peerBucketCapacity,
      updatedAt: now,
      lastSeenAt: now,
    };
    if (existingPeerBucket) {
      this.refill(
        peerBucket,
        this.limits.peerBucketCapacity,
        this.limits.peerRefillPerSecond,
        now,
      );
    }

    if (this.globalInFlight >= this.limits.globalInFlight) {
      return { allowed: false, scope: "global_in_flight" };
    }
    if (
      (this.inFlightByRemotePeer.get(peerKey) ?? 0) >=
      this.limits.perRemotePeerInFlight
    ) {
      return { allowed: false, scope: "remote_peer_in_flight" };
    }
    if (this.globalBucket.tokens < 1) {
      return { allowed: false, scope: "global_rate" };
    }
    if (peerBucket.tokens < 1) {
      return { allowed: false, scope: "remote_peer_rate" };
    }
    if (
      !existingPeerBucket &&
      this.peerBuckets.size >= this.limits.maxTrackedPeers
    ) {
      return { allowed: false, scope: "peer_state_capacity" };
    }

    this.globalBucket.tokens -= 1;
    peerBucket.tokens -= 1;
    peerBucket.lastSeenAt = now;
    if (!existingPeerBucket) this.peerBuckets.set(peerKey, peerBucket);
    this.globalInFlight += 1;
    this.inFlightByRemotePeer.set(
      peerKey,
      (this.inFlightByRemotePeer.get(peerKey) ?? 0) + 1,
    );

    let released = false;
    return {
      allowed: true,
      lease: {
        release: () => {
          if (released) return;
          released = true;
          this.globalInFlight = Math.max(0, this.globalInFlight - 1);
          const next = (this.inFlightByRemotePeer.get(peerKey) ?? 0) - 1;
          if (next <= 0) this.inFlightByRemotePeer.delete(peerKey);
          else this.inFlightByRemotePeer.set(peerKey, next);
        },
      },
    };
  }

  snapshot(): {
    inFlight: number;
    inFlightRemotePeers: number;
    trackedRemotePeers: number;
  } {
    return {
      inFlight: this.globalInFlight,
      inFlightRemotePeers: this.inFlightByRemotePeer.size,
      trackedRemotePeers: this.peerBuckets.size,
    };
  }

  private refill(
    bucket: HandshakeTokenBucket,
    capacity: number,
    refillPerSecond: number,
    now: number,
  ): void {
    const elapsedMs = Math.max(0, now - bucket.updatedAt);
    if (elapsedMs > 0) {
      bucket.tokens = Math.min(
        capacity,
        bucket.tokens + (elapsedMs / 1_000) * refillPerSecond,
      );
      bucket.updatedAt = now;
    }
    bucket.lastSeenAt = now;
  }

  private pruneIdlePeerBuckets(now: number): void {
    if (this.peerBuckets.size === 0) return;
    const refillToFullMs =
      (this.limits.peerBucketCapacity / this.limits.peerRefillPerSecond) *
      1_000;
    const idleCutoff = now - Math.max(60_000, refillToFullMs * 2);
    for (const [peerKey, bucket] of this.peerBuckets) {
      if (
        bucket.lastSeenAt < idleCutoff &&
        !this.inFlightByRemotePeer.has(peerKey)
      ) {
        this.peerBuckets.delete(peerKey);
      }
    }
  }
}

class LeadgridRealtimeHandshakeAdmissionError extends Error {
  constructor(readonly scope: LeadgridRealtimeHandshakeAdmissionScope) {
    super("leadgrid_realtime_handshake_admission_denied");
  }
}

type LeadgridRealtimeServerOptions = {
  connectionLimiter?: LeadgridRealtimeConnectionLimiter;
  handshakeAdmission?: LeadgridRealtimeHandshakeAdmission;
  authorizationTimeoutMs?: number;
  environment?: string;
  loadPersistedSession?: PersistedSessionLoader;
  webSocketServerFactory?: () => WebSocketServer;
};

function withAuthorizationTimeout<T>(
  operation: Promise<T>,
  timeoutMs = LEADGRID_REALTIME_AUTHORIZATION_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("leadgrid_realtime_authorization_timeout"));
    }, timeoutMs);
    timeout.unref?.();

    operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function isCanonicalLeadgridRealtimeOrgChannel(
  channel: unknown,
): channel is string {
  return (
    typeof channel === "string" &&
    channel.length <= LEADGRID_REALTIME_MAX_CHANNEL_LENGTH &&
    LEADGRID_ORG_CHANNEL_PATTERN.test(channel)
  );
}

/**
 * Production deliberately ignores a local cache hit until the persistent
 * session has been checked. This makes logout/revocation authoritative across
 * processes. Tests/development retain the historical in-memory fallback.
 */
export async function resolveLeadgridRealtimeHandshakeSession(
  pool: Pool,
  token: string,
  activeSessions: Map<string, LeadgridRealtimeSessionData>,
  options: {
    environment?: string;
    timeoutMs?: number;
    loadPersistedSession?: PersistedSessionLoader;
  } = {},
): Promise<LeadgridRealtimeSessionData | null> {
  const environment = options.environment ?? process.env.NODE_ENV;
  const cached = activeSessions.get(token) ?? null;
  if (options.loadPersistedSession && environment !== "production" && cached) {
    return cached;
  }

  const persisted = await withAuthorizationTimeout(
    options.loadPersistedSession
      ? options.loadPersistedSession(pool, token)
      : resolveDefaultRealtimeSession(pool, token, activeSessions),
    options.timeoutMs,
  );
  if (persisted) {
    activeSessions.set(token, persisted);
    return persisted;
  }

  // A production cache entry without its authoritative persisted session is
  // revoked/expired, not a fallback credential.
  if (environment === "production") activeSessions.delete(token);
  return null;
}

export async function canAccessLeadgridRealtimeOrg(
  pool: Pool,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  try {
    const org = await pool.query<{ status: string }>(
      `SELECT status FROM organizations WHERE id::text = $1 LIMIT 1`,
      [organizationId],
    );
    if (
      !["active", "paused", "read_only"].includes(org.rows[0]?.status ?? "")
    ) {
      return false;
    }
    const { role } = await resolveEffectivePermissions(
      pool,
      organizationId,
      userId,
    );
    return Boolean(role);
  } catch {
    return false;
  }
}

/** Header-only auth: credentials in URL/query leak into common access logs. */
export function readLeadgridRealtimeBearer(
  authorization: string | string[] | undefined,
): string | null {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (typeof value !== "string" || !value.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Leadgrid-events carry tenant data. Personal, non-tenant notifications use
 * the separate `/api/ipad/ws/events` service, so `user:<id>` must never be an
 * authorization boundary here: a matching user id says nothing about current
 * membership in the event's organization.
 */
export async function canSubscribeLeadgridRealtimeChannel(
  pool: Pool,
  userId: string,
  channel: string,
): Promise<boolean> {
  if (!isCanonicalLeadgridRealtimeOrgChannel(channel)) return false;
  return canAccessLeadgridRealtimeOrg(pool, userId, channel.slice(4));
}

export function createLeadgridRealtimeWebSocketServer(): WebSocketServer {
  return new WebSocketServer({
    noServer: true,
    maxPayload: LEADGRID_REALTIME_MAX_PAYLOAD_BYTES,
  });
}

export class LeadgridRealtimeServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<Client>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly closingClients = new Map<Client, NodeJS.Timeout>();
  private authorizationContext: {
    pool: Pool;
    activeSessions: Map<string, LeadgridRealtimeSessionData>;
  } | null = null;
  private readonly connectionLimiter: LeadgridRealtimeConnectionLimiter;
  private readonly handshakeAdmission: LeadgridRealtimeHandshakeAdmission;
  private readonly authorizationTimeoutMs: number;
  private readonly environment?: string;
  private readonly loadPersistedSession?: PersistedSessionLoader;
  private readonly webSocketServerFactory: () => WebSocketServer;
  private readonly pendingHandshakeSessions = new Map<
    string,
    Promise<LeadgridRealtimeSessionData | null>
  >();

  constructor(options: LeadgridRealtimeServerOptions = {}) {
    this.connectionLimiter =
      options.connectionLimiter ?? new LeadgridRealtimeConnectionLimiter();
    this.handshakeAdmission =
      options.handshakeAdmission ?? new LeadgridRealtimeHandshakeAdmission();
    this.authorizationTimeoutMs = normalizePositiveLimit(
      options.authorizationTimeoutMs,
      LEADGRID_REALTIME_AUTHORIZATION_TIMEOUT_MS,
    );
    this.environment = options.environment;
    this.loadPersistedSession = options.loadPersistedSession;
    this.webSocketServerFactory =
      options.webSocketServerFactory ?? createLeadgridRealtimeWebSocketServer;
  }

  /**
   * Closing a raw socket cannot cancel the underlying pg query. Keep one
   * authoritative lookup per opaque bearer identity in flight so an attacker
   * cannot abort/reconnect repeatedly to multiply database work.
   */
  private resolveHandshakeSession(
    pool: Pool,
    token: string,
    activeSessions: Map<string, LeadgridRealtimeSessionData>,
    remoteAddress: string | null,
  ): Promise<LeadgridRealtimeSessionData | null> {
    const environment = this.environment ?? process.env.NODE_ENV;
    const cached = activeSessions.get(token) ?? null;
    if (
      this.loadPersistedSession &&
      environment !== "production" &&
      cached
    ) return Promise.resolve(cached);

    const tokenKey = opaqueConnectionIdentity("token", token);
    const existing = this.pendingHandshakeSessions.get(tokenKey);
    if (existing) return existing;

    const admission = this.handshakeAdmission.acquire(remoteAddress);
    if (!admission.allowed) {
      throw new LeadgridRealtimeHandshakeAdmissionError(admission.scope);
    }

    let rawLoader: Promise<PersistedRealtimeSession | null>;
    try {
      rawLoader = Promise.resolve(
        this.loadPersistedSession
          ? this.loadPersistedSession(pool, token)
          : resolveDefaultRealtimeSession(pool, token, activeSessions),
      );
    } catch (error) {
      rawLoader = Promise.reject(error);
    }

    const response = withAuthorizationTimeout(
      rawLoader,
      this.authorizationTimeoutMs,
    ).then((persisted) => {
      if (persisted) {
        activeSessions.set(token, persisted);
        return persisted;
      }
      if (environment === "production") activeSessions.delete(token);
      return null;
    });
    this.pendingHandshakeSessions.set(tokenKey, response);

    const releaseUnderlyingWork = () => {
      admission.lease.release();
      if (this.pendingHandshakeSessions.get(tokenKey) === response) {
        this.pendingHandshakeSessions.delete(tokenKey);
      }
    };
    void rawLoader.then(releaseUnderlyingWork, releaseUnderlyingWork);
    return response;
  }

  attach(
    httpServer: HTTPServer,
    pool: Pool,
    activeSessions: Map<string, LeadgridRealtimeSessionData>,
  ): void {
    this.authorizationContext = { pool, activeSessions };
    this.wss = this.webSocketServerFactory();

    httpServer.on("upgrade", async (req, socket, head) => {
      const url = parseWebSocketRequestUrl(req.url);
      if (!url || resolveWebSocketPathOwner(url.pathname) !== "leadgrid-realtime") {
        return;
      }

      // Header-only: query-param tokens blir eksplisitt avvist.
      const token = readLeadgridRealtimeBearer(req.headers.authorization);

      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      // Reserve before the first await so a burst using the same bearer cannot
      // race through the persistent-session handshake and multiply DB work.
      const remoteAddress = readRemotePeerAddress(socket);
      const reservationResult = this.connectionLimiter.reserve(
        token,
        remoteAddress,
      );
      if (!reservationResult.allowed) {
        socket.write(
          "HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nRetry-After: 1\r\n\r\n",
        );
        socket.destroy();
        return;
      }
      const { reservation } = reservationResult;
      const releasePendingReservation = () => reservation.release();
      socket.once("close", releasePendingReservation);

      const rejectPendingUpgrade = (response: string): void => {
        socket.off("close", releasePendingReservation);
        reservation.release();
        if (!socket.destroyed) socket.write(response);
        socket.destroy();
      };

      let session: LeadgridRealtimeSessionData | null = null;
      try {
        session = await this.resolveHandshakeSession(
          pool,
          token,
          activeSessions,
          remoteAddress,
        );
      } catch (error) {
        rejectPendingUpgrade(
          error instanceof LeadgridRealtimeHandshakeAdmissionError
            ? "HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nRetry-After: 1\r\n\r\n"
            : "HTTP/1.1 503 Service Unavailable\r\n\r\n",
        );
        return;
      }
      if (!session) {
        rejectPendingUpgrade("HTTP/1.1 401 Unauthorized\r\n\r\n");
        return;
      }
      if (socket.destroyed) {
        socket.off("close", releasePendingReservation);
        reservation.release();
        return;
      }
      const verifiedSession = session;
      const userAssociation = reservation.associateUser(verifiedSession.userId);
      if (!userAssociation.allowed) {
        rejectPendingUpgrade(
          "HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nRetry-After: 1\r\n\r\n",
        );
        return;
      }

      try {
        this.wss!.handleUpgrade(req, socket, head, (ws) => {
          // The WebSocket now owns the reservation instead of the raw
          // handshake socket. Both release paths are idempotent.
          socket.off("close", releasePendingReservation);
          const client: Client = {
            ws,
            token,
            userId: verifiedSession.userId,
            channels: new Set(),
            lastPing: Date.now(),
            lastValidatedAt: Date.now(),
            validating: false,
            messageQueue: Promise.resolve(),
            pendingMessages: 0,
            releaseConnection: reservation.release,
            released: false,
          };
          this.clients.add(client);

          ws.on("message", (raw) => {
            this.enqueueClientMessage(pool, client, raw);
          });

          ws.on("close", () => {
            this.releaseClient(client);
          });

          ws.on("error", () => {
            // Errors er allerede håndtert av close-eventen.
          });

          this.sendClientPayload(
            client,
            JSON.stringify({
              type: "ready",
              userId: verifiedSession.userId,
            }),
          );
        });
      } catch {
        rejectPendingUpgrade("HTTP/1.1 400 Bad Request\r\n\r\n");
      }
    });

    // Heartbeat hvert 30. sek — drep klienter som ikke pinger på 90s
    this.heartbeatInterval = setInterval(() => {
      const cutoff = Date.now() - 90_000;
      for (const c of this.clients) {
        if (c.lastPing < cutoff) {
          this.closeClient(c, 1001, "heartbeat_timeout");
        } else {
          if (this.sendClientPayload(c, JSON.stringify({ type: "ping" }))) {
            void this.revalidateClient(pool, activeSessions, c);
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
   * Authorize a subscribe request for a single channel against the
   * connecting user. Only `org:<uuid>` with current readable membership is
   * accepted. User/unknown channels fail closed.
   */
  private async canSubscribe(
    pool: Pool,
    userId: string,
    channel: string,
  ): Promise<boolean> {
    return canSubscribeLeadgridRealtimeChannel(pool, userId, channel);
  }

  private closeClient(client: Client, code: number, reason: string): void {
    if (Number(client.ws.readyState) === WebSocket.CLOSED) {
      this.releaseClient(client);
      return;
    }
    if (this.closingClients.has(client)) return;

    try {
      client.ws.close(code, reason);
    } catch {
      this.terminateAndReleaseClient(client);
      return;
    }

    // A mock transport or an already-torn-down socket may emit close
    // synchronously from close(). In that case releaseClient already won.
    if (client.released || !this.clients.has(client)) return;

    // Some test transports (and a transport already fully torn down) report
    // CLOSED synchronously. Otherwise keep counting the descriptor throughout
    // CLOSING and force teardown if ws never emits its close event. Re-read as
    // a number because close() may mutate state synchronously behind TS's
    // earlier control-flow narrowing.
    if (Number(client.ws.readyState) === WebSocket.CLOSED) {
      this.releaseClient(client);
      return;
    }
    const timeout = setTimeout(() => {
      this.closingClients.delete(client);
      this.terminateAndReleaseClient(client);
    }, LEADGRID_REALTIME_CLOSE_GRACE_MS);
    timeout.unref?.();
    this.closingClients.set(client, timeout);
  }

  private releaseClient(client: Client): void {
    if (client.released) return;
    client.released = true;
    const closeTimeout = this.closingClients.get(client);
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      this.closingClients.delete(client);
    }
    this.clients.delete(client);
    client.releaseConnection?.();
  }

  private terminateAndReleaseClient(client: Client): void {
    try {
      client.ws.terminate();
    } catch {
      // The transport may already be gone. The bounded fallback still has to
      // release bookkeeping so a missing close event cannot leak permanently.
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * `ws.send` queues bytes when the peer is slow. Check the prospective queue
   * synchronously so repeated tenant events and heartbeats cannot grow memory
   * without bound. Closing also releases the connection/user reservation.
   */
  private sendClientPayload(client: Client, payload: string): boolean {
    if (client.ws.readyState !== WebSocket.OPEN) return false;
    const reportedBufferedAmount = client.ws.bufferedAmount;
    const bufferedAmount =
      typeof reportedBufferedAmount === "number" &&
      Number.isFinite(reportedBufferedAmount) &&
      reportedBufferedAmount >= 0
        ? reportedBufferedAmount
        : reportedBufferedAmount === undefined
          ? 0
          : LEADGRID_REALTIME_MAX_BUFFERED_AMOUNT_BYTES;
    // Reserve a small frame/compression margin in addition to UTF-8 payload.
    const prospectiveBytes = Buffer.byteLength(payload) + 64;
    if (
      prospectiveBytes > LEADGRID_REALTIME_MAX_BUFFERED_AMOUNT_BYTES ||
      bufferedAmount >
        LEADGRID_REALTIME_MAX_BUFFERED_AMOUNT_BYTES - prospectiveBytes
    ) {
      this.closeClient(client, 1008, "outbound_backpressure");
      return false;
    }

    try {
      client.ws.send(payload);
      return true;
    } catch {
      this.closeClient(client, 1011, "outbound_delivery_failed");
      return false;
    }
  }

  /**
   * A small per-socket queue serializes subscription changes. Duplicate bursts
   * therefore reuse the already-authorized Set entry instead of multiplying
   * database checks. Sustained bursts are rejected before the queue can grow.
   */
  private enqueueClientMessage(pool: Pool, client: Client, raw: RawData): void {
    if (client.ws.readyState !== WebSocket.OPEN) return;
    if (client.pendingMessages >= LEADGRID_REALTIME_MAX_PENDING_MESSAGES) {
      this.closeClient(client, 1008, "message_backpressure");
      return;
    }

    client.pendingMessages += 1;
    client.messageQueue = client.messageQueue
      .then(async () => {
        if (client.ws.readyState !== WebSocket.OPEN) return;
        await this.handleClientMessage(pool, client, raw);
      })
      .catch(() => {
        this.closeClient(client, 1011, "message_processing_failed");
      })
      .finally(() => {
        client.pendingMessages = Math.max(0, client.pendingMessages - 1);
      });
  }

  private async handleClientMessage(
    pool: Pool,
    client: Client,
    raw: RawData,
  ): Promise<void> {
    let msg: unknown;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) return;
    const record = msg as { type?: unknown; channels?: unknown };

    if (record.type === "pong") {
      client.lastPing = Date.now();
      return;
    }
    if (record.type !== "subscribe" && record.type !== "unsubscribe") {
      return;
    }
    if (!Array.isArray(record.channels)) return;

    // Count the submitted array before deduplication. A large duplicate list is
    // still a resource-amplification attempt and must not reach authorization.
    if (record.channels.length > LEADGRID_REALTIME_MAX_CHANNELS) {
      this.sendClientPayload(
        client,
        JSON.stringify({
          type: "error",
          code: "channel_limit_exceeded",
          maxChannels: LEADGRID_REALTIME_MAX_CHANNELS,
        }),
      );
      return;
    }

    const requested = Array.from(new Set(record.channels));
    if (record.type === "unsubscribe") {
      for (const channel of requested) {
        if (isCanonicalLeadgridRealtimeOrgChannel(channel)) {
          client.channels.delete(channel);
        }
      }
      return;
    }

    const denied: string[] = [];
    for (const channel of requested) {
      if (!isCanonicalLeadgridRealtimeOrgChannel(channel)) {
        if (
          typeof channel === "string" &&
          channel.length <= LEADGRID_REALTIME_MAX_CHANNEL_LENGTH
        ) {
          denied.push(channel);
        }
        continue;
      }
      if (client.channels.has(channel)) continue;
      if (client.channels.size >= LEADGRID_REALTIME_MAX_CHANNELS) {
        denied.push(channel);
        continue;
      }

      // Every Leadgrid channel is tenant-bound. Only a fresh, readable
      // org-membership authorizes it; matching user-id is insufficient.
      let allowed = false;
      try {
        allowed = await withAuthorizationTimeout(
          this.canSubscribe(pool, client.userId, channel),
        );
      } catch {
        this.closeClient(client, 1011, "authorization_unavailable");
        return;
      }
      if (allowed) {
        client.channels.add(channel);
      } else {
        denied.push(channel);
      }
    }

    if (client.ws.readyState === WebSocket.OPEN) {
      this.sendClientPayload(
        client,
        JSON.stringify({
          type: "subscribed",
          channels: Array.from(client.channels),
          ...(denied.length ? { denied } : {}),
        }),
      );
    }
  }

  private async revalidateClient(
    pool: Pool,
    activeSessions: Map<string, LeadgridRealtimeSessionData>,
    client: Client,
  ): Promise<void> {
    if (client.validating || client.ws.readyState !== WebSocket.OPEN) return;
    client.validating = true;
    try {
      // Persisted storage is authoritative in production. This catches logout,
      // expiry and scale-out even when the local in-memory cache is stale.
      // All external checks finish inside one bounded window. The operation
      // only computes a result; client state mutates after the timeout wrapper
      // resolves, so a late DB result cannot re-authorize a closed socket.
      const validation = await withAuthorizationTimeout(
        (async () => {
          const persisted = this.loadPersistedSession
            ? await this.loadPersistedSession(pool, client.token)
            : await resolveDefaultRealtimeSession(
                pool,
                client.token,
                activeSessions,
              );
          const developmentSession =
            this.loadPersistedSession && process.env.NODE_ENV !== "production"
              ? (activeSessions.get(client.token) ?? null)
              : null;
          const session = persisted ?? developmentSession;
          if (!session || session.userId !== client.userId) {
            return { session: null, channelAccess: [] as boolean[] };
          }

          const channels = Array.from(client.channels);
          const channelAccess = await Promise.all(
            channels.map((channel) =>
              this.canSubscribe(pool, client.userId, channel),
            ),
          );
          return { session, channels, channelAccess };
        })(),
      );
      const session = validation.session;
      if (!session || session.userId !== client.userId) {
        activeSessions.delete(client.token);
        this.closeClient(client, 1008, "session_revoked");
        return;
      }

      const revoked: string[] = [];
      const channels = validation.channels ?? [];
      for (const [index, channel] of channels.entries()) {
        if (!validation.channelAccess[index]) {
          client.channels.delete(channel);
          revoked.push(channel);
        }
      }
      client.lastValidatedAt = Date.now();
      if (revoked.length > 0 && client.ws.readyState === WebSocket.OPEN) {
        this.sendClientPayload(
          client,
          JSON.stringify({ type: "subscription_revoked", channels: revoked }),
        );
      }
    } catch {
      // Auth/status kan ikke bevises: fail closed for denne socketen.
      this.closeClient(client, 1011, "authorization_unavailable");
    } finally {
      client.validating = false;
    }
  }

  /**
   * Broadcast et event til alle klienter abonnert på channel.
   */
  emit(event: { type: string; channel: string; data: unknown }): void {
    // Defense in depth for stale sockets created before the channel policy was
    // tightened: no Leadgrid tenant event is ever delivered via user-id alone.
    if (!isCanonicalLeadgridRealtimeOrgChannel(event.channel)) return;
    const payload = JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    });
    for (const c of this.clients) {
      if (
        !c.channels.has(event.channel) ||
        c.ws.readyState !== WebSocket.OPEN
      ) {
        continue;
      }

      const authorizationIsFresh =
        !c.validating &&
        Date.now() - c.lastValidatedAt <=
          LEADGRID_REALTIME_AUTHORIZATION_FRESHNESS_MS;
      if (!authorizationIsFresh) {
        const context = this.authorizationContext;
        if (context && !c.validating) {
          void this.revalidateClient(context.pool, context.activeSessions, c);
        }
        // Never leak a tenant event while auth is stale/in flight. This event
        // is deliberately dropped; a later event may flow after revalidation.
        continue;
      }

      this.sendClientPayload(c, payload);
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
    data: { ...payload, lead_id: leadId, organization_id: orgId },
  });
}

export function broadcastRecommendation(
  orgId: string,
  _userId: string | null,
  payload: Record<string, unknown>,
): void {
  leadgridRealtime.emit({
    type: "recommendation.created",
    channel: `org:${orgId}`,
    data: { ...payload, organization_id: orgId },
  });
}

export function broadcastNbaUpdated(
  orgId: string,
  leadId: string,
  payload: Record<string, unknown>,
): void {
  leadgridRealtime.emit({
    type: "nba.updated",
    channel: `org:${orgId}`,
    data: { ...payload, lead_id: leadId, organization_id: orgId },
  });
}

export function broadcastFollowupDue(
  userId: string,
  payload: Record<string, unknown>,
): void {
  const orgId =
    typeof payload.organization_id === "string"
      ? payload.organization_id.trim()
      : "";
  // Legacy callers without canonical org context fail closed rather than
  // falling back to a user-id channel that can outlive tenant membership.
  if (!orgId) return;
  leadgridRealtime.emit({
    type: "followup.due",
    channel: `org:${orgId}`,
    data: { ...payload, organization_id: orgId, assigned_user_id: userId },
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
  _userId: string | null,
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
  if (!orgId) return;
  const data: Record<string, unknown> = {
    ...payload,
    organization_id: orgId,
  };
  leadgridRealtime.emit({
    type: "lead.created",
    channel: `org:${orgId}`,
    data,
  });
}
