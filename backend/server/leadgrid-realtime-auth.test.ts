import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { IncomingMessage, Server as HTTPServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, type WebSocketServer } from "ws";

import {
  canAccessLeadgridRealtimeOrg,
  canSubscribeLeadgridRealtimeChannel,
  createLeadgridRealtimeWebSocketServer,
  isCanonicalLeadgridRealtimeOrgChannel,
  LeadgridRealtimeConnectionLimiter,
  LeadgridRealtimeHandshakeAdmission,
  LeadgridRealtimeServer,
  LEADGRID_REALTIME_AUTH_GLOBAL_BUCKET_CAPACITY,
  LEADGRID_REALTIME_AUTH_PEER_BUCKET_CAPACITY,
  LEADGRID_REALTIME_MAX_BUFFERED_AMOUNT_BYTES,
  LEADGRID_REALTIME_MAX_AUTH_WORK,
  LEADGRID_REALTIME_MAX_AUTH_WORK_PER_REMOTE_PEER,
  LEADGRID_REALTIME_MAX_CHANNELS,
  LEADGRID_REALTIME_MAX_CONNECTIONS,
  LEADGRID_REALTIME_MAX_CONNECTIONS_PER_REMOTE_PEER,
  LEADGRID_REALTIME_MAX_CONNECTIONS_PER_TOKEN,
  LEADGRID_REALTIME_MAX_CONNECTIONS_PER_USER,
  LEADGRID_REALTIME_MAX_PAYLOAD_BYTES,
  readLeadgridRealtimeBearer,
  resolveLeadgridRealtimeHandshakeSession,
} from "./leadgrid-realtime.js";

type UpgradeHandler = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => Promise<void>;

function captureUpgradeHandler(
  server: LeadgridRealtimeServer,
  pool = {} as Pool,
  activeSessions = new Map<string, { userId: string }>(),
): UpgradeHandler {
  let upgradeHandler: UpgradeHandler | undefined;
  const httpServer = {
    on: vi.fn((event: string, handler: UpgradeHandler) => {
      if (event === "upgrade") upgradeHandler = handler;
      return httpServer;
    }),
  };
  server.attach(httpServer as unknown as HTTPServer, pool, activeSessions);
  expect(upgradeHandler).toBeDefined();
  return upgradeHandler!;
}

function fakeUpgradeRequest(token: string): IncomingMessage {
  return {
    url: "/ws/leadgrid",
    headers: { authorization: `Bearer ${token}` },
  } as IncomingMessage;
}

function fakeUpgradeSocket(remoteAddress: string | undefined = "203.0.113.10") {
  const socketState = Object.assign(new EventEmitter(), {
    remoteAddress,
    destroyed: false,
    write: vi.fn(() => true),
    destroy: vi.fn(),
  });
  socketState.destroy.mockImplementation(() => {
    socketState.destroyed = true;
    socketState.emit("close");
    return socketState;
  });
  return {
    socket: socketState as unknown as Duplex,
    write: socketState.write,
    destroy: socketState.destroy,
  };
}

function fakeWebSocket() {
  const wsState = Object.assign(new EventEmitter(), {
    readyState: WebSocket.OPEN,
    bufferedAmount: 0,
    send: vi.fn(),
    close: vi.fn(),
  });
  wsState.close.mockImplementation(() => {
    wsState.readyState = WebSocket.CLOSED;
    wsState.emit("close");
  });
  return {
    ws: wsState as unknown as WebSocket,
    send: wsState.send,
    emitter: wsState,
  };
}

const persistedSession = {
  userId: "user-1",
  email: "user@example.test",
  name: "Realtime User",
  role: "user",
  loginAt: "2026-08-29T00:00:00.000Z",
};

describe("Leadgrid realtime auth", () => {
  it("accepts a non-empty Authorization bearer", () => {
    expect(readLeadgridRealtimeBearer("Bearer session-token")).toBe(
      "session-token",
    );
  });

  it("does not accept missing, malformed or query-derived credentials", () => {
    expect(readLeadgridRealtimeBearer(undefined)).toBeNull();
    expect(readLeadgridRealtimeBearer("session-token")).toBeNull();
    expect(readLeadgridRealtimeBearer("Bearer   ")).toBeNull();

    const url = new URL("wss://example.test/ws/leadgrid?token=leaked-token");
    expect(url.searchParams.get("token")).toBe("leaked-token");
    // URL/query is deliberately not an input to the auth reader.
    expect(readLeadgridRealtimeBearer(undefined)).toBeNull();
  });

  it("configures a small transport payload ceiling", () => {
    const wss = createLeadgridRealtimeWebSocketServer();
    expect(LEADGRID_REALTIME_MAX_PAYLOAD_BYTES).toBe(16 * 1024);
    expect(wss.options.maxPayload).toBe(LEADGRID_REALTIME_MAX_PAYLOAD_BYTES);
  });

  it("uses conservative deterministic connection ceilings", () => {
    expect(LEADGRID_REALTIME_MAX_CONNECTIONS).toBe(256);
    expect(LEADGRID_REALTIME_MAX_CONNECTIONS_PER_TOKEN).toBe(4);
    expect(LEADGRID_REALTIME_MAX_CONNECTIONS_PER_USER).toBe(8);
    expect(LEADGRID_REALTIME_MAX_CONNECTIONS_PER_REMOTE_PEER).toBe(64);
    expect(LEADGRID_REALTIME_MAX_BUFFERED_AMOUNT_BYTES).toBe(256 * 1024);
    expect(LEADGRID_REALTIME_MAX_AUTH_WORK).toBe(64);
    expect(LEADGRID_REALTIME_MAX_AUTH_WORK_PER_REMOTE_PEER).toBe(8);
    expect(LEADGRID_REALTIME_AUTH_GLOBAL_BUCKET_CAPACITY).toBe(600);
    expect(LEADGRID_REALTIME_AUTH_PEER_BUCKET_CAPACITY).toBe(30);
  });

  it("enforces global, bearer and TCP-peer limits with idempotent release", () => {
    const limiter = new LeadgridRealtimeConnectionLimiter({
      global: 2,
      perToken: 1,
      perUser: 2,
      perRemotePeer: 1,
    });

    const first = limiter.reserve("secret-token-a", "203.0.113.1");
    expect(first.allowed).toBe(true);
    if (first.allowed) {
      expect(first.reservation.associateUser("user-a")).toEqual({
        allowed: true,
      });
      expect(first.reservation.associateUser("user-a")).toEqual({
        allowed: true,
      });
    }
    expect(limiter.reserve("secret-token-a", "203.0.113.2")).toEqual({
      allowed: false,
      scope: "token",
    });
    expect(limiter.reserve("secret-token-b", "203.0.113.1")).toEqual({
      allowed: false,
      scope: "remote_peer",
    });

    const second = limiter.reserve("secret-token-b", "203.0.113.2");
    expect(second.allowed).toBe(true);
    if (second.allowed) {
      expect(second.reservation.associateUser("user-b")).toEqual({
        allowed: true,
      });
    }
    expect(limiter.reserve("secret-token-c", "203.0.113.3")).toEqual({
      allowed: false,
      scope: "global",
    });
    expect(limiter.snapshot()).toEqual({
      active: 2,
      activeTokens: 2,
      activeUsers: 2,
      activeRemotePeers: 2,
    });

    if (first.allowed) {
      first.reservation.release();
      first.reservation.release();
    }
    expect(limiter.snapshot().active).toBe(1);
    const third = limiter.reserve("secret-token-c", "203.0.113.3");
    expect(third.allowed).toBe(true);
    if (third.allowed) {
      expect(third.reservation.associateUser("user-c")).toEqual({
        allowed: true,
      });
    }
    if (second.allowed) second.reservation.release();
    if (third.allowed) third.reservation.release();
    expect(limiter.snapshot().active).toBe(0);
  });

  it("reserves and deduplicates async auth so abort/reconnect cannot multiply DB checks", async () => {
    let resolveSession!: (value: typeof persistedSession | null) => void;
    const pendingSession = new Promise<typeof persistedSession | null>(
      (resolve) => {
        resolveSession = resolve;
      },
    );
    const loadPersistedSession = vi.fn(() => pendingSession);
    const limiter = new LeadgridRealtimeConnectionLimiter({
      global: 10,
      perToken: 2,
      perUser: 10,
      perRemotePeer: 10,
    });
    const server = new LeadgridRealtimeServer({
      connectionLimiter: limiter,
      environment: "production",
      loadPersistedSession,
    });
    const upgrade = captureUpgradeHandler(server);
    const firstSocket = fakeUpgradeSocket("203.0.113.20");
    const secondSocket = fakeUpgradeSocket("203.0.113.21");
    const deniedSocket = fakeUpgradeSocket("203.0.113.22");
    const replacementSocket = fakeUpgradeSocket("203.0.113.23");

    const first = upgrade(
      fakeUpgradeRequest("burst-secret"),
      firstSocket.socket,
      Buffer.alloc(0),
    );
    const second = upgrade(
      fakeUpgradeRequest("burst-secret"),
      secondSocket.socket,
      Buffer.alloc(0),
    );
    await upgrade(
      fakeUpgradeRequest("burst-secret"),
      deniedSocket.socket,
      Buffer.alloc(0),
    );

    expect(loadPersistedSession).toHaveBeenCalledOnce();
    expect(deniedSocket.write).toHaveBeenCalledOnce();
    const denial = String(deniedSocket.write.mock.calls[0]?.[0]);
    expect(denial).toContain("429 Too Many Requests");
    expect(denial).not.toContain("burst-secret");
    expect(denial).not.toContain("203.0.113.22");
    expect(limiter.snapshot().active).toBe(2);

    // The raw socket releases its connection slot immediately, while a new
    // attempt reuses the still-running persistent lookup instead of starting
    // another database request.
    firstSocket.destroy();
    const replacement = upgrade(
      fakeUpgradeRequest("burst-secret"),
      replacementSocket.socket,
      Buffer.alloc(0),
    );
    expect(loadPersistedSession).toHaveBeenCalledOnce();
    expect(limiter.snapshot().active).toBe(2);

    resolveSession(null);
    await Promise.all([first, second, replacement]);
    expect(limiter.snapshot()).toEqual({
      active: 0,
      activeTokens: 0,
      activeUsers: 0,
      activeRemotePeers: 0,
    });
  });

  it("rate-limits rotating bearer tokens per actual TCP peer before DB", async () => {
    let now = 0;
    const handshakeAdmission = new LeadgridRealtimeHandshakeAdmission({
      globalInFlight: 10,
      perRemotePeerInFlight: 10,
      globalBucketCapacity: 10,
      globalRefillPerSecond: 1,
      peerBucketCapacity: 2,
      peerRefillPerSecond: 1,
      maxTrackedPeers: 10,
      now: () => now,
    });
    const loadPersistedSession = vi.fn(async () => null);
    const server = new LeadgridRealtimeServer({
      connectionLimiter: new LeadgridRealtimeConnectionLimiter({
        global: 10,
        perToken: 10,
        perUser: 10,
        perRemotePeer: 10,
      }),
      handshakeAdmission,
      environment: "production",
      loadPersistedSession,
    });
    const upgrade = captureUpgradeHandler(server);
    const sockets = [
      fakeUpgradeSocket("203.0.113.80"),
      fakeUpgradeSocket("203.0.113.80"),
      fakeUpgradeSocket("203.0.113.80"),
    ];

    for (const [index, entry] of sockets.entries()) {
      await upgrade(
        fakeUpgradeRequest(`rotating-token-${index}`),
        entry.socket,
        Buffer.alloc(0),
      );
    }

    expect(loadPersistedSession).toHaveBeenCalledTimes(2);
    const responses = sockets.map((entry) =>
      String(entry.write.mock.calls[0]?.[0] ?? ""),
    );
    expect(responses.filter((value) => value.includes("401")).length).toBe(2);
    expect(responses.filter((value) => value.includes("429")).length).toBe(1);
    expect(responses.join(" ")).not.toContain("rotating-token");

    now = 1_000;
    const refilledSocket = fakeUpgradeSocket("203.0.113.80");
    await upgrade(
      fakeUpgradeRequest("rotating-token-refilled"),
      refilledSocket.socket,
      Buffer.alloc(0),
    );
    expect(loadPersistedSession).toHaveBeenCalledTimes(3);
    expect(String(refilledSocket.write.mock.calls[0]?.[0])).toContain("401");
  });

  it("keeps hanging auth work admitted after HTTP timeout until the raw loader settles", async () => {
    let resolveRawLoader!: (value: typeof persistedSession | null) => void;
    const rawLoader = new Promise<typeof persistedSession | null>((resolve) => {
      resolveRawLoader = resolve;
    });
    let loaderCall = 0;
    const loadPersistedSession = vi.fn(async () => {
      loaderCall += 1;
      if (loaderCall === 1) return await rawLoader;
      return null;
    });
    const handshakeAdmission = new LeadgridRealtimeHandshakeAdmission({
      globalInFlight: 1,
      perRemotePeerInFlight: 1,
      globalBucketCapacity: 10,
      globalRefillPerSecond: 10,
      peerBucketCapacity: 10,
      peerRefillPerSecond: 10,
      maxTrackedPeers: 10,
    });
    const server = new LeadgridRealtimeServer({
      connectionLimiter: new LeadgridRealtimeConnectionLimiter({
        global: 10,
        perToken: 10,
        perUser: 10,
        perRemotePeer: 10,
      }),
      handshakeAdmission,
      authorizationTimeoutMs: 10,
      environment: "production",
      loadPersistedSession,
    });
    const upgrade = captureUpgradeHandler(server);
    const timedOutSocket = fakeUpgradeSocket("203.0.113.90");

    await upgrade(
      fakeUpgradeRequest("hanging-token"),
      timedOutSocket.socket,
      Buffer.alloc(0),
    );
    expect(String(timedOutSocket.write.mock.calls[0]?.[0])).toContain("503");
    expect(loadPersistedSession).toHaveBeenCalledOnce();
    expect(handshakeAdmission.snapshot().inFlight).toBe(1);

    const repeatedTokenSocket = fakeUpgradeSocket("203.0.113.90");
    await upgrade(
      fakeUpgradeRequest("hanging-token"),
      repeatedTokenSocket.socket,
      Buffer.alloc(0),
    );
    expect(String(repeatedTokenSocket.write.mock.calls[0]?.[0])).toContain(
      "503",
    );
    expect(loadPersistedSession).toHaveBeenCalledOnce();

    const rotatedTokenSocket = fakeUpgradeSocket("203.0.113.90");
    await upgrade(
      fakeUpgradeRequest("another-token"),
      rotatedTokenSocket.socket,
      Buffer.alloc(0),
    );
    expect(String(rotatedTokenSocket.write.mock.calls[0]?.[0])).toContain(
      "429",
    );
    expect(loadPersistedSession).toHaveBeenCalledOnce();
    expect(handshakeAdmission.snapshot().inFlight).toBe(1);

    resolveRawLoader(null);
    await vi.waitFor(() =>
      expect(handshakeAdmission.snapshot().inFlight).toBe(0),
    );

    const afterSettleSocket = fakeUpgradeSocket("203.0.113.90");
    await upgrade(
      fakeUpgradeRequest("hanging-token"),
      afterSettleSocket.socket,
      Buffer.alloc(0),
    );
    expect(loadPersistedSession).toHaveBeenCalledTimes(2);
    expect(String(afterSettleSocket.write.mock.calls[0]?.[0])).toContain("401");
  });

  it("globally bounds unknown peers and prunes bounded peer bucket state", () => {
    let now = 0;
    const globalBound = new LeadgridRealtimeHandshakeAdmission({
      globalInFlight: 1,
      perRemotePeerInFlight: 10,
      globalBucketCapacity: 10,
      globalRefillPerSecond: 10,
      peerBucketCapacity: 10,
      peerRefillPerSecond: 10,
      maxTrackedPeers: 10,
      now: () => now,
    });
    const unknown = globalBound.acquire(undefined);
    expect(unknown.allowed).toBe(true);
    expect(globalBound.acquire(undefined)).toEqual({
      allowed: false,
      scope: "global_in_flight",
    });
    if (unknown.allowed) unknown.lease.release();

    const boundedState = new LeadgridRealtimeHandshakeAdmission({
      globalInFlight: 10,
      perRemotePeerInFlight: 10,
      globalBucketCapacity: 10,
      globalRefillPerSecond: 10,
      peerBucketCapacity: 1,
      peerRefillPerSecond: 1,
      maxTrackedPeers: 1,
      now: () => now,
    });
    const firstPeer = boundedState.acquire("203.0.113.101");
    expect(firstPeer.allowed).toBe(true);
    if (firstPeer.allowed) firstPeer.lease.release();
    expect(boundedState.acquire("203.0.113.102")).toEqual({
      allowed: false,
      scope: "peer_state_capacity",
    });

    now = 60_001;
    const afterPrune = boundedState.acquire("203.0.113.102");
    expect(afterPrune.allowed).toBe(true);
    expect(boundedState.snapshot().trackedRemotePeers).toBe(1);
    if (afterPrune.allowed) afterPrune.lease.release();
  });

  it("releases a successful reservation when the WebSocket closes", async () => {
    const limiter = new LeadgridRealtimeConnectionLimiter({
      global: 1,
      perToken: 1,
      perUser: 1,
      perRemotePeer: 1,
    });
    const fakeWs = fakeWebSocket();
    const handleUpgrade = vi.fn(
      (
        _request: IncomingMessage,
        _socket: Duplex,
        _head: Buffer,
        callback: (ws: WebSocket) => void,
      ) => callback(fakeWs.ws),
    );
    const server = new LeadgridRealtimeServer({
      connectionLimiter: limiter,
      environment: "production",
      loadPersistedSession: vi.fn(async () => persistedSession),
      webSocketServerFactory: () =>
        ({ handleUpgrade }) as unknown as WebSocketServer,
    });
    const upgrade = captureUpgradeHandler(server);
    const rawSocket = fakeUpgradeSocket();

    await upgrade(
      fakeUpgradeRequest("valid-secret"),
      rawSocket.socket,
      Buffer.alloc(0),
    );
    expect(handleUpgrade).toHaveBeenCalledOnce();
    expect(limiter.snapshot().active).toBe(1);
    expect(limiter.snapshot().activeUsers).toBe(1);
    expect(fakeWs.send).toHaveBeenCalledOnce();

    fakeWs.emitter.emit("close");
    expect(limiter.snapshot()).toEqual({
      active: 0,
      activeTokens: 0,
      activeUsers: 0,
      activeRemotePeers: 0,
    });
  });

  it("releases the reservation when handleUpgrade throws", async () => {
    const limiter = new LeadgridRealtimeConnectionLimiter({
      global: 1,
      perToken: 1,
      perUser: 1,
      perRemotePeer: 1,
    });
    const handleUpgrade = vi.fn(() => {
      throw new Error("malformed_upgrade");
    });
    const server = new LeadgridRealtimeServer({
      connectionLimiter: limiter,
      environment: "production",
      loadPersistedSession: vi.fn(async () => persistedSession),
      webSocketServerFactory: () =>
        ({ handleUpgrade }) as unknown as WebSocketServer,
    });
    const upgrade = captureUpgradeHandler(server);
    const rawSocket = fakeUpgradeSocket("203.0.113.40");

    await upgrade(
      fakeUpgradeRequest("upgrade-secret"),
      rawSocket.socket,
      Buffer.alloc(0),
    );

    expect(rawSocket.destroy).toHaveBeenCalledOnce();
    expect(String(rawSocket.write.mock.calls[0]?.[0])).toContain(
      "400 Bad Request",
    );
    expect(String(rawSocket.write.mock.calls[0]?.[0])).not.toContain(
      "upgrade-secret",
    );
    expect(limiter.snapshot()).toEqual({
      active: 0,
      activeTokens: 0,
      activeUsers: 0,
      activeRemotePeers: 0,
    });
  });

  it("enforces one race-safe user limit across different authoritative bearers", async () => {
    const limiter = new LeadgridRealtimeConnectionLimiter({
      global: 4,
      perToken: 2,
      perUser: 1,
      perRemotePeer: 4,
    });
    const fakeWs = fakeWebSocket();
    const handleUpgrade = vi.fn(
      (
        _request: IncomingMessage,
        _socket: Duplex,
        _head: Buffer,
        callback: (ws: WebSocket) => void,
      ) => callback(fakeWs.ws),
    );
    const loadPersistedSession = vi.fn(async () => ({
      ...persistedSession,
      userId: "shared-user",
    }));
    const server = new LeadgridRealtimeServer({
      connectionLimiter: limiter,
      environment: "production",
      loadPersistedSession,
      webSocketServerFactory: () =>
        ({ handleUpgrade }) as unknown as WebSocketServer,
    });
    const upgrade = captureUpgradeHandler(server);
    const firstSocket = fakeUpgradeSocket("203.0.113.51");
    const secondSocket = fakeUpgradeSocket("203.0.113.52");

    await Promise.all([
      upgrade(
        fakeUpgradeRequest("user-token-a"),
        firstSocket.socket,
        Buffer.alloc(0),
      ),
      upgrade(
        fakeUpgradeRequest("user-token-b"),
        secondSocket.socket,
        Buffer.alloc(0),
      ),
    ]);

    expect(loadPersistedSession).toHaveBeenCalledTimes(2);
    expect(handleUpgrade).toHaveBeenCalledOnce();
    const responses = [firstSocket, secondSocket].map((entry) =>
      String(entry.write.mock.calls[0]?.[0] ?? ""),
    );
    expect(responses.filter((value) => value.includes("429")).length).toBe(1);
    expect(responses.join(" ")).not.toContain("shared-user");
    expect(limiter.snapshot()).toEqual({
      active: 1,
      activeTokens: 1,
      activeUsers: 1,
      activeRemotePeers: 1,
    });

    fakeWs.emitter.emit("close");
    expect(limiter.snapshot()).toEqual({
      active: 0,
      activeTokens: 0,
      activeUsers: 0,
      activeRemotePeers: 0,
    });
  });

  it("requires the bounded canonical org UUID channel shape before DB access", async () => {
    const query = vi.fn();
    const pool = { query } as unknown as Pool;
    const valid = "org:11111111-1111-4111-8111-111111111111";

    expect(isCanonicalLeadgridRealtimeOrgChannel(valid)).toBe(true);
    for (const channel of [
      "org:org-1",
      "org:11111111-1111-4111-8111-111111111111:extra",
      "ORG/11111111-1111-4111-8111-111111111111",
      `org:${"a".repeat(65)}`,
      "user:11111111-1111-4111-8111-111111111111",
    ]) {
      await expect(
        canSubscribeLeadgridRealtimeChannel(pool, "user-1", channel),
      ).resolves.toBe(false);
    }
    expect(query).not.toHaveBeenCalled();
    expect(LEADGRID_REALTIME_MAX_CHANNELS).toBe(16);
  });

  it("does not trust a cached production session after persistent revocation", async () => {
    const activeSessions = new Map([
      ["revoked-token", { userId: "cached-user" }],
    ]);
    const loadPersistedSession = vi.fn(async () => null);

    await expect(
      resolveLeadgridRealtimeHandshakeSession(
        {} as Pool,
        "revoked-token",
        activeSessions,
        {
          environment: "production",
          loadPersistedSession,
        },
      ),
    ).resolves.toBeNull();
    expect(loadPersistedSession).toHaveBeenCalledOnce();
    expect(activeSessions.has("revoked-token")).toBe(false);
  });

  it("uses shared user/version authority by default and evicts a mismatch", async () => {
    const session = { ...persistedSession, authSessionVersion: "4" };
    const activeSessions = new Map([
      ["versioned-token", session],
    ]);
    const pool = {
      query: vi.fn(async () => ({
        rows: [{
          session_data: session,
          user_id: session.userId,
          user_email: session.email,
          user_role: session.role,
          user_is_active: true,
          auth_session_version: "5",
        }],
      })),
    } as unknown as Pool;

    await expect(resolveLeadgridRealtimeHandshakeSession(
      pool,
      "versioned-token",
      activeSessions,
      { environment: "production" },
    )).resolves.toBeNull();
    expect(activeSessions.has("versioned-token")).toBe(false);
  });

  it("refreshes a cached production identity from persistent storage", async () => {
    const activeSessions = new Map([
      ["valid-token", { userId: "stale-local-user" }],
    ]);
    const persisted = {
      userId: "persisted-user",
      email: "persisted@example.test",
      name: "Persisted User",
      role: "user",
      loginAt: new Date().toISOString(),
    };
    const loadPersistedSession = vi.fn(async () => persisted);

    await expect(
      resolveLeadgridRealtimeHandshakeSession(
        {} as Pool,
        "valid-token",
        activeSessions,
        {
          environment: "production",
          loadPersistedSession,
        },
      ),
    ).resolves.toEqual(persisted);
    expect(activeSessions.get("valid-token")?.userId).toBe("persisted-user");
  });

  it("fails closed within a bounded time when persistent auth hangs", async () => {
    const never = new Promise<never>(() => {});
    const loadPersistedSession = vi.fn(() => never);

    await expect(
      resolveLeadgridRealtimeHandshakeSession(
        {} as Pool,
        "hanging-token",
        new Map([["hanging-token", { userId: "cached-user" }]]),
        {
          environment: "production",
          timeoutMs: 10,
          loadPersistedSession,
        },
      ),
    ).rejects.toThrow("leadgrid_realtime_authorization_timeout");
  });

  it("rejects legacy user channels even when the id matches the session", async () => {
    const query = vi.fn();
    await expect(
      canSubscribeLeadgridRealtimeChannel(
        { query } as unknown as Pool,
        "user-1",
        "user:user-1",
      ),
    ).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it("keeps org channels behind fresh status and membership checks", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM organizations")) {
        return { rows: [{ status: "active" }], rowCount: 1 };
      }
      if (sql.includes("SELECT role FROM organization_members")) {
        return { rows: [{ role: "member" }], rowCount: 1 };
      }
      if (sql.includes("FROM role_permissions")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("FROM user_permission_overrides")) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await expect(
      canSubscribeLeadgridRealtimeChannel(
        { query } as unknown as Pool,
        "user-1",
        "org:11111111-1111-4111-8111-111111111111",
      ),
    ).resolves.toBe(true);
    expect(query).toHaveBeenCalled();
  });

  it.each([
    ["active", true],
    ["paused", true],
    ["read_only", true],
    ["suspended", false],
    ["closed", false],
  ])(
    "enforces readable org status %s before membership",
    async (status, allowed) => {
      const query = vi.fn(async (sqlValue: unknown) => {
        const sql = String(sqlValue);
        if (sql.includes("FROM organizations")) {
          return { rows: [{ status }], rowCount: 1 };
        }
        if (sql.includes("SELECT role FROM organization_members")) {
          return { rows: [{ role: "member" }], rowCount: 1 };
        }
        if (sql.includes("FROM role_permissions")) {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("FROM user_permission_overrides")) {
          return { rows: [], rowCount: 0 };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      });
      await expect(
        canAccessLeadgridRealtimeOrg(
          { query } as unknown as Pool,
          "user-1",
          "11111111-1111-4111-8111-111111111111",
        ),
      ).resolves.toBe(allowed);
      if (!allowed) {
        expect(query).toHaveBeenCalledTimes(1);
      }
    },
  );

  it("denies an active org after membership removal", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM organizations")) {
        return { rows: [{ status: "active" }], rowCount: 1 };
      }
      if (sql.includes("SELECT role FROM organization_members")) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    await expect(
      canAccessLeadgridRealtimeOrg(
        { query } as unknown as Pool,
        "removed-user",
        "11111111-1111-4111-8111-111111111111",
      ),
    ).resolves.toBe(false);
  });
});
