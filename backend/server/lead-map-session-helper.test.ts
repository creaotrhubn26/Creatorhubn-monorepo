import express, { type Request } from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authSessionStore = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock("./auth-session-store.js", () => ({
  loadPersistedAuthSession: authSessionStore.load,
}));

import {
  createLeadMapSessionHydrator,
  resolveLeadMapSession,
} from "./lead-map-session-helper.js";

const VALID_NATIVE_TOKEN = "a".repeat(64);

function bearerRequest(token: string): Request {
  return {
    headers: { authorization: `Bearer ${token}` },
  } as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  authSessionStore.load.mockResolvedValue(null);
});

describe("resolveLeadMapSession", () => {
  it("resolves a native bearer from ipad_tokens on a process-local cache miss", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          user_id: "user-1",
          email: "leadgrid@example.test",
          role: "super_admin",
          name: "Leadgrid User",
          login_at: "2026-08-30T12:00:00.000Z",
          revoked_at: null,
          is_active: true,
        },
      ],
    });
    const pool = { query } as unknown as Pool;
    const activeSessions = new Map();

    const session = await resolveLeadMapSession(
      bearerRequest(VALID_NATIVE_TOKEN),
      pool,
      activeSessions,
    );

    expect(session).toEqual({
      userId: "user-1",
      email: "leadgrid@example.test",
      role: "super_admin",
      name: "Leadgrid User",
      loginAt: "2026-08-30T12:00:00.000Z",
    });
    expect(activeSessions.get(VALID_NATIVE_TOKEN)).toEqual(session);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("t.revoked_at::text"),
      [VALID_NATIVE_TOKEN],
    );
    expect(query.mock.calls[0]?.[0]).toContain(
      "(to_jsonb(u)->>'is_active')::boolean",
    );
    expect(query.mock.calls[0]?.[0]).not.toContain("u.is_active");
  });

  it("does not query ipad_tokens for an unrelated bearer format", async () => {
    const query = vi.fn();
    const pool = { query } as unknown as Pool;

    const session = await resolveLeadMapSession(
      bearerRequest("lg_live_not-a-native-session"),
      pool,
      new Map(),
    );

    expect(session).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects oversized bearer values before any database lookup", async () => {
    const query = vi.fn();
    const pool = { query } as unknown as Pool;

    const session = await resolveLeadMapSession(
      bearerRequest("a".repeat(513)),
      pool,
      new Map(),
    );

    expect(session).toBeNull();
    expect(authSessionStore.load).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects a missing or revoked native token instead of caching it", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    const activeSessions = new Map();

    await expect(
      resolveLeadMapSession(
        bearerRequest(VALID_NATIVE_TOKEN),
        pool,
        activeSessions,
      ),
    ).resolves.toBeNull();

    expect(activeSessions.has(VALID_NATIVE_TOKEN)).toBe(false);
  });

  it.each([
    ["revoked token", "2026-08-30T12:00:00.000Z", true],
    ["inactive user", null, false],
  ])(
    "evicts a cached native session for a %s",
    async (_case, revokedAt, isActive) => {
      const query = vi.fn().mockResolvedValue({
        rows: [
          {
            user_id: "user-1",
            email: "leadgrid@example.test",
            role: "member",
            name: "Leadgrid User",
            login_at: "2026-08-30T12:00:00.000Z",
            revoked_at: revokedAt,
            is_active: isActive,
          },
        ],
      });
      const pool = { query } as unknown as Pool;
      const activeSessions = new Map([
        [
          VALID_NATIVE_TOKEN,
          {
            userId: "user-1",
            email: "leadgrid@example.test",
            role: "member",
          },
        ],
      ]);

      const session = await resolveLeadMapSession(
        bearerRequest(VALID_NATIVE_TOKEN),
        pool,
        activeSessions,
      );

      expect(session).toBeNull();
      expect(activeSessions.has(VALID_NATIVE_TOKEN)).toBe(false);
      expect(authSessionStore.load).not.toHaveBeenCalled();
    },
  );

  it("keeps existing CreatorHub session read-through behavior", async () => {
    authSessionStore.load.mockResolvedValue({
      userId: "web-user",
      email: "web@example.test",
      name: "Web User",
      role: "member",
      loginAt: "2026-08-30T12:00:00.000Z",
    });
    const query = vi.fn();
    const pool = { query } as unknown as Pool;
    const token = "web-session-token";

    const session = await resolveLeadMapSession(
      bearerRequest(token),
      pool,
      new Map(),
    );

    expect(session).toEqual({
      userId: "web-user",
      email: "web@example.test",
      name: "Web User",
      role: "member",
      loginAt: "2026-08-30T12:00:00.000Z",
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("createLeadMapSessionHydrator", () => {
  it("hydrates a persisted web session before a Role Room agent guard runs", async () => {
    authSessionStore.load.mockResolvedValue({
      userId: "role-room-owner",
      email: "owner@example.test",
      name: "Role Room Owner",
      role: "admin",
      loginAt: "2026-09-04T20:00:00.000Z",
    });
    const pool = { query: vi.fn() } as unknown as Pool;
    const activeSessions = new Map<string, { userId: string }>();
    const app = express();

    app.use(
      "/api/role-room/agent",
      createLeadMapSessionHydrator(pool, activeSessions),
    );
    app.get("/api/role-room/agent/access", (req, res) => {
      const token = req.headers.authorization?.slice("Bearer ".length) ?? "";
      const session = activeSessions.get(token);
      if (!session) return res.status(401).json({ error: "auth_required" });
      return res.json({ allowed: true, userId: session.userId });
    });

    await request(app)
      .get("/api/role-room/agent/access")
      .set("Authorization", "Bearer role-room-web-session")
      .expect(200, { allowed: true, userId: "role-room-owner" });

    expect(authSessionStore.load).toHaveBeenCalledWith(
      pool,
      "role-room-web-session",
    );
  });

  it("hydrates before a legacy synchronous route guard runs", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          user_id: "user-on-pod-a",
          email: "leadgrid@example.test",
          role: "member",
          name: "Pod A User",
          login_at: "2026-08-30T12:00:00.000Z",
          revoked_at: null,
          is_active: true,
        },
      ],
    });
    const pool = { query } as unknown as Pool;
    const activeSessions = new Map<
      string,
      {
        userId: string;
        email?: string;
        role?: string;
      }
    >();
    const app = express();

    app.use(
      "/api/admin-room/lead-map",
      createLeadMapSessionHydrator(pool, activeSessions),
    );
    app.get("/api/admin-room/lead-map/projects", (req, res) => {
      const token = req.headers.authorization?.slice("Bearer ".length) ?? "";
      const session = activeSessions.get(token);
      if (!session) return res.status(401).json({ error: "Innlogging kreves" });
      return res.json({ userId: session.userId });
    });

    await request(app)
      .get("/api/admin-room/lead-map/projects")
      .set("Authorization", `Bearer ${VALID_NATIVE_TOKEN}`)
      .expect(200, { userId: "user-on-pod-a" });
  });

  it("leaves public Leadgrid requests without a bearer untouched", async () => {
    const query = vi.fn();
    const pool = { query } as unknown as Pool;
    const app = express();

    app.use("/api/leadgrid", createLeadMapSessionHydrator(pool, new Map()));
    app.get("/api/leadgrid/auth/google/start", (_req, res) => {
      res.json({ public: true });
    });

    await request(app)
      .get("/api/leadgrid/auth/google/start")
      .expect(200, { public: true });

    expect(authSessionStore.load).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("passes storage errors to Express instead of returning a false 401", async () => {
    const pool = {
      query: vi.fn().mockRejectedValue(new Error("database unavailable")),
    } as unknown as Pool;
    const app = express();

    app.use(
      "/api/admin-room/lead-map",
      createLeadMapSessionHydrator(pool, new Map()),
    );
    app.get("/api/admin-room/lead-map/projects", (_req, res) => {
      res.status(401).json({ error: "Innlogging kreves" });
    });
    app.use(
      (
        _error: unknown,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => {
        res.status(503).json({ error: "session_store_unavailable" });
      },
    );

    await request(app)
      .get("/api/admin-room/lead-map/projects")
      .set("Authorization", `Bearer ${VALID_NATIVE_TOKEN}`)
      .expect(503, { error: "session_store_unavailable" });
  });
});
