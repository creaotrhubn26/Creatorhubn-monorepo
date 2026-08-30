import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import { WebSocket, type WebSocketServer } from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canvasBearerToken,
  createCanvasRealtimeServer,
  resolveCanvasRealtimeAccess,
} from "./leadgrid-canvas-realtime.js";
import type {
  AuthoritativeAuthSession,
  AuthoritativeAuthSessionResolution,
} from "./auth-session-authority.js";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const clients = new Set<WebSocket>();
const cleanups: Array<() => Promise<void>> = [];

function authenticated(userId: string): AuthoritativeAuthSessionResolution {
  const session: AuthoritativeAuthSession = {
    userId,
    email: `${userId}@example.test`,
    name: userId,
    role: "user",
    loginAt: "2026-08-29T10:00:00.000Z",
    authSessionVersion: "0",
  };
  return { status: "authenticated", session };
}

async function harness(options: Parameters<typeof createCanvasRealtimeServer>[3]) {
  const server = createServer();
  const wss = createCanvasRealtimeServer(
    server,
    {} as Pool,
    new Map(),
    {
      consumeHandshakeRate: async () => ({ allowed: true }),
      ...options,
    },
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const close = async () => {
    for (const client of wss.clients) client.terminate();
    await closeWss(wss);
    await closeServer(server);
  };
  cleanups.push(close);
  return { port };
}

function closeWss(wss: WebSocketServer): Promise<void> {
  return new Promise((resolve) => wss.close(() => resolve()));
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function connect(
  port: number,
  token?: string,
  queryToken?: string,
  organizationId: string | null = "org-1",
  headerOrganizationId: string | null = organizationId,
): WebSocket {
  const suffix = queryToken ? `&token=${encodeURIComponent(queryToken)}` : "";
  const organizationQuery = organizationId
    ? `&organizationId=${encodeURIComponent(organizationId)}`
    : "";
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (headerOrganizationId) {
    headers["X-Organization-ID"] = headerOrganizationId;
  }
  const ws = new WebSocket(
    `ws://127.0.0.1:${port}/ws/leadgrid-canvas?notatId=${NOTE_ID}${organizationQuery}${suffix}`,
    Object.keys(headers).length > 0 ? { headers } : undefined,
  );
  clients.add(ws);
  ws.once("close", () => clients.delete(ws));
  return ws;
}

function waitForOpen(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
}

function waitForMessage(
  ws: WebSocket,
  predicate: (message: Record<string, unknown>) => boolean,
  timeoutMs = 1_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("websocket_message_timeout"));
    }, timeoutMs);
    const onMessage = (raw: WebSocket.RawData) => {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!predicate(message)) return;
      clearTimeout(timeout);
      ws.off("message", onMessage);
      resolve(message);
    };
    ws.on("message", onMessage);
  });
}

function waitForClose(ws: WebSocket, timeoutMs = 1_000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("websocket_close_timeout")), timeoutMs);
    ws.once("close", (code, reason) => {
      clearTimeout(timeout);
      resolve({ code, reason: reason.toString() });
    });
  });
}

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const client of clients) client.terminate();
  clients.clear();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

describe("Canvas realtime authorization", () => {
  it("parses only a complete Authorization bearer", () => {
    expect(canvasBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(canvasBearerToken("bearer token")).toBe("token");
    expect(canvasBearerToken("Bearer token extra")).toBeNull();
    expect(canvasBearerToken("token")).toBeNull();
  });

  it("requires one explicit, consistent organization context", async () => {
    const resolveAccess = vi.fn(async () => ({
      organizationId: "org-1",
      canWrite: true,
    }));
    const { port } = await harness({
      resolveSession: async (token) => authenticated(token),
      resolveAccess,
      heartbeatIntervalMs: 5_000,
      accessRevalidationIntervalMs: 5_000,
    });

    const missing = connect(port, "token", undefined, null, null);
    await expect(waitForClose(missing)).resolves.toMatchObject({
      code: 1008,
      reason: "organization_required",
    });
    const mismatch = connect(port, "token", undefined, "org-1", "org-2");
    await expect(waitForClose(mismatch)).resolves.toMatchObject({
      code: 1008,
      reason: "organization_mismatch",
    });
    expect(resolveAccess).not.toHaveBeenCalled();
  });

  it("passes the exact selected organization to access and revalidation", async () => {
    const resolveAccess = vi.fn(async (
      _userId: string,
      _noteId: string,
      organizationId: string,
    ) => organizationId === "org-selected"
      ? { organizationId, canWrite: true }
      : null);
    const { port } = await harness({
      resolveSession: async (token) => authenticated(token),
      resolveAccess,
      heartbeatIntervalMs: 5_000,
      accessRevalidationIntervalMs: 15,
    });
    const selected = connect(
      port,
      "token",
      undefined,
      "org-selected",
      "org-selected",
    );
    const access = waitForMessage(selected, (message) => message.type === "access");
    await waitForOpen(selected);
    await expect(access).resolves.toMatchObject({ canWrite: true });
    await vi.waitFor(() => {
      expect(resolveAccess).toHaveBeenCalledWith(
        "token",
        NOTE_ID,
        "org-selected",
      );
      expect(resolveAccess.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it("evaluates entitlement in the selected org, not another membership", async () => {
    const pool = {
      query: vi.fn(async (sqlValue: unknown, values?: unknown[]) => {
        const sql = String(sqlValue);
        if (sql.includes("COALESCE(is_active")) {
          return {
            rows: [{ role: "super_admin", is_active: true }],
            rowCount: 1,
          };
        }
        if (sql.includes("FROM leadgrid_org_entitlements")) {
          return values?.[0] === "org-b"
            ? { rows: [{ state: "locked" }], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        if (sql.includes("FROM leadgrid_canvas_notater")) {
          return { rows: [{ user_id: "user-1", delt: false }], rowCount: 1 };
        }
        if (sql.includes("SELECT role FROM users")) {
          return { rows: [{ role: "super_admin" }], rowCount: 1 };
        }
        if (
          sql.includes("FROM organization_members")
          || sql.includes("FROM enterprise_team_members")
        ) return { rows: [], rowCount: 0 };
        throw new Error(`unexpected SQL: ${sql}`);
      }),
    } as unknown as Pool;

    await expect(resolveCanvasRealtimeAccess(
      pool, "user-1", NOTE_ID, "org-a",
    )).resolves.toMatchObject({ organizationId: "org-a", canWrite: true });
    await expect(resolveCanvasRealtimeAccess(
      pool, "user-1", NOTE_ID, "org-b",
    )).resolves.toBeNull();
  });

  it("lets a viewer receive owner strokes but rejects viewer writes", async () => {
    const { port } = await harness({
      resolveSession: async (token) => authenticated(token),
      resolveAccess: async (userId) => ({
        organizationId: "org-1",
        canWrite: userId === "owner",
      }),
      heartbeatIntervalMs: 5_000,
      accessRevalidationIntervalMs: 5_000,
    });
    const owner = connect(port, "owner");
    const viewer = connect(port, "viewer");
    const ownerAccess = waitForMessage(owner, (m) => m.type === "access");
    const viewerAccess = waitForMessage(viewer, (m) => m.type === "access");
    await Promise.all([waitForOpen(owner), waitForOpen(viewer)]);
    await expect(ownerAccess).resolves.toMatchObject({ canWrite: true });
    await expect(viewerAccess).resolves.toMatchObject({ canWrite: false });

    const readOnly = waitForMessage(viewer, (m) => m.error === "read_only");
    viewer.send(JSON.stringify({ type: "strokes", strokes: "viewer-data" }));
    await expect(readOnly).resolves.toMatchObject({ type: "error" });

    const relayed = waitForMessage(viewer, (m) => m.type === "strokes");
    owner.send(JSON.stringify({ type: "strokes", strokes: "owner-data" }));
    await expect(relayed).resolves.toMatchObject({
      type: "strokes",
      strokes: "owner-data",
      fra: "owner",
    });
  });

  it("rejects query credentials by default and marks the explicit legacy mode", async () => {
    const { port } = await harness({
      resolveSession: async (token) => authenticated(token),
      resolveAccess: async () => ({ organizationId: "org-1", canWrite: true }),
      heartbeatIntervalMs: 5_000,
      accessRevalidationIntervalMs: 5_000,
    });
    const rejected = connect(port, undefined, "legacy");
    await expect(waitForClose(rejected)).resolves.toMatchObject({
      code: 1008,
      reason: "auth_required",
    });

    vi.stubEnv("CANVAS_ALLOW_QUERY_TOKEN", "true");
    const legacy = connect(port, undefined, "legacy");
    const access = waitForMessage(legacy, (m) => m.type === "access");
    await waitForOpen(legacy);
    await expect(access).resolves.toMatchObject({
      canWrite: true,
      legacyAuth: true,
    });
  });

  it("closes sockets when the session or note access is revoked", async () => {
    let sessionValid = true;
    let accessValid = true;
    const { port } = await harness({
      resolveSession: async (token) => sessionValid
        ? authenticated(token)
        : { status: "unauthenticated" },
      resolveAccess: async () => accessValid
        ? { organizationId: "org-1", canWrite: true }
        : null,
      heartbeatIntervalMs: 5_000,
      accessRevalidationIntervalMs: 15,
    });

    const sessionSocket = connect(port, "session-user");
    const initialAccess = waitForMessage(sessionSocket, (m) => m.type === "access");
    await waitForOpen(sessionSocket);
    await initialAccess;
    const sessionClosed = waitForClose(sessionSocket);
    sessionValid = false;
    await expect(sessionClosed).resolves.toMatchObject({
      code: 1008,
      reason: "session_revoked",
    });

    sessionValid = true;
    const accessSocket = connect(port, "access-user");
    const secondAccess = waitForMessage(accessSocket, (m) => m.type === "access");
    await waitForOpen(accessSocket);
    await secondAccess;
    const accessClosed = waitForClose(accessSocket);
    accessValid = false;
    await expect(accessClosed).resolves.toMatchObject({
      code: 1008,
      reason: "access_revoked",
    });
  });

  it("downgrades an open owner socket to read-only on revalidation", async () => {
    let canWrite = true;
    const { port } = await harness({
      resolveSession: async (token) => authenticated(token),
      resolveAccess: async () => ({ organizationId: "org-1", canWrite }),
      heartbeatIntervalMs: 5_000,
      accessRevalidationIntervalMs: 15,
    });
    const owner = connect(port, "owner");
    const initial = waitForMessage(owner, (message) =>
      message.type === "access" && message.canWrite === true);
    await waitForOpen(owner);
    await initial;

    const downgraded = waitForMessage(owner, (message) =>
      message.type === "access" && message.canWrite === false);
    canWrite = false;
    await expect(downgraded).resolves.toMatchObject({ canWrite: false });

    const rejected = waitForMessage(owner, (message) =>
      message.type === "error" && message.error === "read_only");
    owner.send(JSON.stringify({ type: "strokes", strokes: "blocked" }));
    await expect(rejected).resolves.toMatchObject({ error: "read_only" });
  });

  it("bounds connections per user and closes message floods", async () => {
    const { port } = await harness({
      resolveSession: async (token) => authenticated(token),
      resolveAccess: async () => ({ organizationId: "org-1", canWrite: true }),
      maxConnectionsPerUser: 1,
      maxMessagesPerWindow: 1,
      messageRateWindowMs: 5_000,
      heartbeatIntervalMs: 5_000,
      accessRevalidationIntervalMs: 5_000,
    });
    const first = connect(port, "same-user");
    const firstAccess = waitForMessage(first, (message) => message.type === "access");
    await waitForOpen(first);
    await firstAccess;

    const excess = connect(port, "same-user");
    await expect(waitForClose(excess)).resolves.toMatchObject({
      code: 1013,
      reason: "connection_capacity",
    });

    const flooded = waitForClose(first);
    first.send(JSON.stringify({ type: "strokes", strokes: "one" }));
    first.send(JSON.stringify({ type: "strokes", strokes: "two" }));
    await expect(flooded).resolves.toMatchObject({
      code: 1008,
      reason: "message_rate_limited",
    });
  });

  it("bounds handshake attempts before additional session lookups", async () => {
    const resolveSession = vi.fn(async (token: string) => authenticated(token));
    const { port } = await harness({
      resolveSession,
      resolveAccess: async () => ({ organizationId: "org-1", canWrite: true }),
      maxHandshakeAttemptsPerMinute: 1,
      heartbeatIntervalMs: 5_000,
      accessRevalidationIntervalMs: 5_000,
    });
    const first = connect(port);
    await expect(waitForClose(first)).resolves.toMatchObject({
      reason: "auth_required",
    });
    const second = connect(port, "token");
    await expect(waitForClose(second)).resolves.toMatchObject({
      code: 1013,
      reason: "handshake_rate_limited",
    });
    expect(resolveSession).not.toHaveBeenCalled();
  });

  it("fails closed before session lookup when the shared handshake limiter is unavailable", async () => {
    const resolveSession = vi.fn(async (token: string) => authenticated(token));
    const { port } = await harness({
      resolveSession,
      resolveAccess: async () => ({ organizationId: "org-1", canWrite: true }),
      consumeHandshakeRate: async () => {
        throw new Error("rate database unavailable");
      },
      heartbeatIntervalMs: 5_000,
      accessRevalidationIntervalMs: 5_000,
    });
    const socket = connect(port, "token");
    await expect(waitForClose(socket)).resolves.toMatchObject({
      code: 1011,
      reason: "rate_limit_unavailable",
    });
    expect(resolveSession).not.toHaveBeenCalled();
  });
});
