import type { Pool } from "pg";
import { readFileSync } from "node:fs";
import express from "express";
import supertest from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  createLeadgridAuthoritativeWriteMiddleware,
  leadgridWriteNeedsAuthoritativeSession,
  normalizeAuthSessionVersion,
  resolveAuthoritativeAuthSession,
  type AuthoritativeAuthSession,
} from "./auth-session-authority.js";

const WORKFLOW_SERVICE_TOKEN = "s".repeat(32);
const CRON_TOKEN = "c".repeat(32);
const INDEPENDENT_CREDENTIALS = {
  workflowEventServiceToken: WORKFLOW_SERVICE_TOKEN,
  cronTokensByPath: {
    "/api/admin-room/lead-map/cron/followup-notifications": [CRON_TOKEN],
    "/api/leadgrid/cron/retention-cleanup": [CRON_TOKEN],
    "/api/leadgrid/drips/converted": [CRON_TOKEN],
  },
};

function snapshot(version: string, role = "admin"): AuthoritativeAuthSession {
  return {
    userId: "user-1",
    email: "owner@example.test",
    name: "Owner",
    role,
    loginAt: "2026-08-29T10:00:00.000Z",
    authSessionVersion: version,
  };
}

function request(method: string, path: string, headers: Record<string, string> = {}) {
  return { method, path, url: path, originalUrl: path, headers } as any;
}

describe("auth session authority", () => {
  it("routes cold persisted impersonation through parent authority before caching", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const persistedLoad = source.indexOf(
      "const persistedSession = await loadPersistedAuthSession",
    );
    const derivedBranch = source.indexOf(
      "if (persistedSession.impersonatedByAdmin)",
      persistedLoad,
    );
    const authorityCall = source.indexOf(
      "resolveAuthoritativeSessionFromRequest(req)",
      derivedBranch,
    );
    const cacheInsert = source.indexOf(
      "activeSessions.set(sessionToken, persistedSession)",
      persistedLoad,
    );
    expect(persistedLoad).toBeGreaterThan(-1);
    expect(derivedBranch).toBeGreaterThan(persistedLoad);
    expect(authorityCall).toBeGreaterThan(derivedBranch);
    expect(cacheInsert).toBeGreaterThan(authorityCall);
  });

  it("compares BIGINT versions without losing precision", () => {
    expect(normalizeAuthSessionVersion("90071992547409930001"))
      .toBe("90071992547409930001");
    expect(normalizeAuthSessionVersion("0007")).toBe("7");
    expect(normalizeAuthSessionVersion(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(normalizeAuthSessionVersion("-1")).toBeNull();
  });

  it("uses current role and accepts an active matching session", async () => {
    const activeSessions = new Map<string, AuthoritativeAuthSession>([
      ["token", snapshot("3", "admin")],
    ]);
    const pool = {
      query: vi.fn(async () => ({
        rows: [{
          session_data: snapshot("3", "admin"),
          user_id: "user-1",
          user_email: "owner@example.test",
          user_role: "member",
          user_is_active: true,
          auth_session_version: "3",
        }],
      })),
    } as unknown as Pool;

    const result = await resolveAuthoritativeAuthSession({
      pool,
      token: "token",
      activeSessions,
    });

    expect(result).toMatchObject({
      status: "authenticated",
      session: { role: "member", isAdmin: false, authSessionVersion: "3" },
    });
    expect(activeSessions.get("token")?.role).toBe("member");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /DELETE FROM creatorhub_auth_sessions[\s\S]*impersonatedByAdmin[\s\S]*FROM creatorhub_auth_sessions[\s\S]*expires_at IS NOT NULL[\s\S]*expires_at > NOW\(\)/,
      ),
      ["token"],
    );
  });

  it("renews a valid authoritative session through the throttled 29-day window", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          session_data: snapshot("2"),
          user_id: "user-1",
          user_email: "owner@example.test",
          user_role: "admin",
          user_is_active: true,
          auth_session_version: "2",
        }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const pool = { query } as unknown as Pool;

    await expect(resolveAuthoritativeAuthSession({
      pool,
      token: "native-token",
      activeSessions: new Map(),
    })).resolves.toMatchObject({ status: "authenticated" });

    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1]?.[0])).toMatch(
      /UPDATE creatorhub_auth_sessions[\s\S]*INTERVAL '30 days'[\s\S]*INTERVAL '29 days'/,
    );
    expect(query.mock.calls[1]?.[1]).toEqual(["native-token"]);
  });

  it("treats only a missing legacy snapshot version as zero", async () => {
    const legacy = snapshot("0");
    delete (legacy as Partial<AuthoritativeAuthSession>).authSessionVersion;
    const pool = {
      query: vi.fn(async () => ({
        rows: [{
          session_data: legacy,
          user_id: "user-1",
          user_email: "owner@example.test",
          user_role: "admin",
          user_is_active: true,
          auth_session_version: "0",
        }],
      })),
    } as unknown as Pool;

    await expect(resolveAuthoritativeAuthSession({
      pool,
      token: "legacy-token",
      activeSessions: new Map(),
    })).resolves.toMatchObject({
      status: "authenticated",
      session: { authSessionVersion: "0" },
    });

    (pool.query as any).mockResolvedValueOnce({
      rows: [{
        session_data: { ...legacy, authSessionVersion: null },
        user_id: "user-1",
        user_email: "owner@example.test",
        user_role: "admin",
        user_is_active: true,
        auth_session_version: "0",
      }],
    });
    await expect(resolveAuthoritativeAuthSession({
      pool,
      token: "malformed-token",
      activeSessions: new Map(),
    })).resolves.toEqual({ status: "unauthenticated" });
  });

  it("rejects and evicts an inactive or version-mismatched session", async () => {
    const activeSessions = new Map<string, AuthoritativeAuthSession>([
      ["token", snapshot("4")],
    ]);
    const onEvict = vi.fn();
    const pool = {
      query: vi.fn(async () => ({
        rows: [{
          session_data: snapshot("4"),
          user_id: "user-1",
          user_email: "owner@example.test",
          user_role: "admin",
          user_is_active: true,
          auth_session_version: "5",
        }],
      })),
    } as unknown as Pool;

    await expect(resolveAuthoritativeAuthSession({
      pool,
      token: "token",
      activeSessions,
      onEvict,
    })).resolves.toEqual({ status: "unauthenticated" });
    expect(activeSessions.has("token")).toBe(false);
    expect(onEvict).toHaveBeenCalledWith("token");
  });

  it("closes the login-after-revocation race with the version comparison", async () => {
    let currentVersion = "0";
    let releaseLogin!: () => void;
    const loginMayPersist = new Promise<void>((resolve) => {
      releaseLogin = resolve;
    });
    const activeSessions = new Map<string, AuthoritativeAuthSession>();

    const login = (async () => {
      const capturedVersion = currentVersion;
      await loginMayPersist;
      activeSessions.set("racing-token", snapshot(capturedVersion));
      return snapshot(capturedVersion);
    })();

    currentVersion = "1";
    releaseLogin();
    const staleSnapshot = await login;
    const pool = {
      query: vi.fn(async () => ({
        rows: [{
          session_data: staleSnapshot,
          user_id: "user-1",
          user_email: "owner@example.test",
          user_role: "admin",
          user_is_active: true,
          auth_session_version: currentVersion,
        }],
      })),
    } as unknown as Pool;

    await expect(resolveAuthoritativeAuthSession({
      pool,
      token: "racing-token",
      activeSessions,
    })).resolves.toEqual({ status: "unauthenticated" });
    expect(activeSessions.has("racing-token")).toBe(false);
  });

  it("fails closed as unavailable when the authority query fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pool = {
      query: vi.fn(async () => { throw new Error("db unavailable"); }),
    } as unknown as Pool;
    await expect(resolveAuthoritativeAuthSession({
      pool,
      token: "token",
      activeSessions: new Map(),
    })).resolves.toEqual({ status: "unavailable" });
    expect(warning).toHaveBeenCalled();
  });

  it("keeps a derived request in target context when both authorities match", async () => {
    const impersonation = {
      ...snapshot("3", "member"),
      impersonatedByAdmin: true,
      impersonatorId: "admin-7",
      impersonatorAuthSessionVersion: "7",
      impersonatorRole: "super_admin",
      impersonationExpiresAt: Date.now() + 20 * 60_000,
    };
    const activeSessions = new Map<string, AuthoritativeAuthSession | any>([
      ["derived-token", { ...snapshot("7", "super_admin"), userId: "admin-7" }],
    ]);
    const query = vi.fn(async () => ({
      rows: [{
        session_data: impersonation,
        user_id: "user-1",
        user_email: "owner@example.test",
        user_role: "member",
        user_is_active: true,
        auth_session_version: "3",
        impersonator_user_id: "admin-7",
        impersonator_role: "super_admin",
        impersonator_is_active: true,
        impersonator_auth_session_version: "7",
      }],
    }));
    const pool = { query } as unknown as Pool;

    await expect(resolveAuthoritativeAuthSession({
      pool,
      token: "derived-token",
      activeSessions,
    })).resolves.toMatchObject({
      status: "authenticated",
      session: {
        userId: "user-1",
        role: "member",
        impersonatorId: "admin-7",
      },
    });

    expect(activeSessions.get("derived-token")).toMatchObject({
      userId: "user-1",
      role: "member",
      impersonatorId: "admin-7",
    });
    // Absolute impersonation TTL: no sliding-renewal query follows.
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("rejects and removes an expired impersonation before a Canvas route runs", async () => {
    const now = Date.parse("2026-08-30T12:31:00.000Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    const impersonation = {
      ...snapshot("3", "member"),
      impersonatedByAdmin: true,
      impersonatorId: "admin-7",
      impersonatorAuthSessionVersion: "7",
      impersonatorRole: "super_admin",
      impersonationExpiresAt: now - 60_000,
    };
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          session_data: impersonation,
          user_id: "user-1",
          user_email: "owner@example.test",
          user_role: "member",
          user_is_active: true,
          auth_session_version: "3",
          impersonator_user_id: "admin-7",
          impersonator_role: "super_admin",
          impersonator_is_active: true,
          impersonator_auth_session_version: "7",
        }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const pool = { query } as unknown as Pool;
    const activeSessions = new Map<string, AuthoritativeAuthSession | any>([
      ["expired-impersonation", impersonation],
    ]);
    let routeReached = false;
    const app = express();
    app.use("/api/leadgrid", createLeadgridAuthoritativeWriteMiddleware({
      resolveSession: () => resolveAuthoritativeAuthSession({
        pool,
        token: "expired-impersonation",
        activeSessions,
      }),
    }));
    app.get("/api/leadgrid/canvas", (_req, res) => {
      routeReached = true;
      res.json({ ok: true });
    });

    try {
      await supertest(app)
        .get("/api/leadgrid/canvas")
        .expect(401, { error: "authentication_required" });
    } finally {
      nowSpy.mockRestore();
    }

    expect(routeReached).toBe(false);
    expect(activeSessions.has("expired-impersonation")).toBe(false);
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1]?.[0])).toContain(
      "DELETE FROM creatorhub_auth_sessions",
    );
    expect(query.mock.calls[1]?.[1]).toEqual(["expired-impersonation"]);
  });

  it.each([
    { version: "8", isActive: true, label: "generation changes" },
    { version: "7", isActive: false, label: "account is deactivated" },
  ])("revokes a derived Canvas session when the parent admin $label", async (parent) => {
    const impersonation = {
      ...snapshot("3", "member"),
      impersonatedByAdmin: true,
      impersonatorId: "admin-7",
      impersonatorAuthSessionVersion: "7",
      impersonatorRole: "super_admin",
      impersonationExpiresAt: Date.now() + 20 * 60_000,
    };
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          session_data: impersonation,
          user_id: "user-1",
          user_email: "owner@example.test",
          user_role: "member",
          user_is_active: true,
          auth_session_version: "3",
          impersonator_user_id: "admin-7",
          impersonator_role: "super_admin",
          impersonator_is_active: parent.isActive,
          impersonator_auth_session_version: parent.version,
        }],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const pool = { query } as unknown as Pool;
    // Cold instance: canonical derived token exists, process cache is empty.
    const activeSessions = new Map<string, AuthoritativeAuthSession | any>();
    let routeReached = false;
    const app = express();
    app.use("/api/leadgrid", createLeadgridAuthoritativeWriteMiddleware({
      resolveSession: () => resolveAuthoritativeAuthSession({
        pool,
        token: "derived-token",
        activeSessions,
      }),
    }));
    app.get("/api/leadgrid/canvas", (_req, res) => {
      routeReached = true;
      res.json({ ok: true });
    });

    await supertest(app)
      .get("/api/leadgrid/canvas")
      .expect(401, { error: "authentication_required" });

    expect(routeReached).toBe(false);
    expect(activeSessions.has("derived-token")).toBe(false);
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1]?.[0])).toContain(
      "DELETE FROM creatorhub_auth_sessions",
    );
    expect(query.mock.calls[1]?.[1]).toEqual(["derived-token"]);
  });
});

describe("Leadgrid authoritative session policy", () => {
  it("guards ordinary writes while preserving unrelated legacy reads", () => {
    expect(leadgridWriteNeedsAuthoritativeSession(request("PATCH", "/api/leadgrid/leads/1"))).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request("GET", "/api/leadgrid/leads"))).toBe(false);
  });

  it("guards every Canvas read without matching adjacent route names", () => {
    expect(leadgridWriteNeedsAuthoritativeSession(request("GET", "/api/leadgrid/canvas"))).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request("HEAD", "/api/leadgrid/canvas/dokumenter/pdf_1"))).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request("GET", "/api/leadgrid/canvas/note/versjoner"))).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request("GET", "/API/Leadgrid/Canvas/dokumenter/pdf_1"))).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request("GET", "/api//leadgrid/canvas/note-1"))).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request("GET", "/api/leadgrid/canvas-rolle-policy"))).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request("GET", "/api/leadgrid/oppgaver"))).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request("HEAD", "/api/leadgrid/oppgaver/task-1"))).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request("GET", "/api/leadgrid/moter/maal"))).toBe(true);
  });

  it("guards native Lead Map and pairing reads and writes", () => {
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("GET", "/api/admin-room/lead-map/leads"),
    )).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("PATCH", "/api/admin-room/lead-map/leads/lead-1/status"),
    )).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("POST", "/api/admin-room/ipad-tokens/generate"),
    )).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("GET", "/api/admin-room/ipad-tokens/recent"),
    )).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("GET", "/api/admin-room/lead-map/pitch-deck/p/share-token"),
    )).toBe(false);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("GET", "/api/admin-room/lead-map/pitch-deck/p/share-token.pix"),
    )).toBe(false);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("POST", "/api/admin-room/lead-map/cron/followup-notifications", {
        "x-cron-trigger-token": CRON_TOKEN,
      }),
      INDEPENDENT_CREDENTIALS,
    )).toBe(false);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("POST", "/api/admin-room/lead-map/cron/followup-notifications", {
        "x-cron-trigger-token": "wrong",
      }),
      INDEPENDENT_CREDENTIALS,
    )).toBe(true);
  });

  it.each([
    "/api/leadgrid/auth/google/callback",
    "/api/leadgrid/auth/google/exchange",
    "/api/leadgrid/self-onboard",
    "/api/leadgrid/self-onboard/consume-magic",
    "/api/leadgrid/developer-application",
    "/api/leadgrid/signup-interest",
    "/api/leadgrid/demo-request",
    "/api/leadgrid/app-waitlist",
    "/api/leadgrid/testimonials",
  ])("preserves the exact public POST %s", (path) => {
    expect(leadgridWriteNeedsAuthoritativeSession(request("POST", path)))
      .toBe(false);
  });

  it("preserves complete HMAC and exact service credentials only", () => {
    const path = "/api/leadgrid/events/contracts/signed";
    const hmacHeaders = {
      "x-leadgrid-timestamp": "1788000000",
      "x-leadgrid-delivery-id": "delivery-123",
      "x-leadgrid-signature": `sha256=${"a".repeat(64)}`,
    };
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("POST", path, hmacHeaders),
      INDEPENDENT_CREDENTIALS,
    )).toBe(false);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("POST", path, {
        ...hmacHeaders,
        authorization: "Bearer stale-user-session",
      }),
      INDEPENDENT_CREDENTIALS,
    )).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("POST", path, {
        "x-leadgrid-timestamp": "1788000000",
        "x-leadgrid-delivery-id": "delivery-123",
        authorization: `Bearer ${WORKFLOW_SERVICE_TOKEN}`,
      }),
      INDEPENDENT_CREDENTIALS,
    )).toBe(false);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("POST", path, {
        "x-leadgrid-timestamp": "1788000000",
        "x-leadgrid-delivery-id": "delivery-123",
        authorization: "Bearer wrong-service-token",
      }),
      INDEPENDENT_CREDENTIALS,
    )).toBe(true);
  });

  it("preserves token-owned intent/portal writes but not session-owned invitations", () => {
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("POST", "/api/leadgrid/intent/opaque-token/sign"),
    )).toBe(false);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("PUT", "/api/leadgrid/portal/opaque-token/notification-prefs"),
    )).toBe(false);
    expect(leadgridWriteNeedsAuthoritativeSession(
      request("POST", "/api/leadgrid/partner-invitation/opaque-token/accept"),
    )).toBe(true);
  });

  it("requires an exact path and exact configured cron credential", () => {
    expect(leadgridWriteNeedsAuthoritativeSession(request(
      "POST",
      "/api/leadgrid/cron/retention-cleanup",
      { "x-cron-trigger-token": CRON_TOKEN },
    ), INDEPENDENT_CREDENTIALS)).toBe(false);
    expect(leadgridWriteNeedsAuthoritativeSession(request(
      "POST",
      "/api/leadgrid/cron/future-route",
      { "x-cron-trigger-token": CRON_TOKEN },
    ), INDEPENDENT_CREDENTIALS)).toBe(true);
    expect(leadgridWriteNeedsAuthoritativeSession(request(
      "POST",
      "/api/leadgrid/drips/converted",
      { "x-cron-trigger-token": "fake" },
    ), INDEPENDENT_CREDENTIALS)).toBe(true);
  });

  it("does not let a fake cron header exempt an ordinary stale-session write", () => {
    expect(leadgridWriteNeedsAuthoritativeSession(request("POST", "/api/leadgrid/leads", {
      "x-cron-trigger-token": "fake",
    }), INDEPENDENT_CREDENTIALS)).toBe(true);
  });
});

describe("Leadgrid authoritative session middleware", () => {
  function appFor(
    resolveSession: Parameters<
      typeof createLeadgridAuthoritativeWriteMiddleware
    >[0]["resolveSession"],
  ) {
    const app = express();
    app.use("/api/leadgrid", createLeadgridAuthoritativeWriteMiddleware({
      resolveSession,
      independentCredentials: INDEPENDENT_CREDENTIALS,
    }));
    app.use("/api/admin-room/lead-map", createLeadgridAuthoritativeWriteMiddleware({
      resolveSession,
      independentCredentials: INDEPENDENT_CREDENTIALS,
    }));
    app.use("/api/admin-room/ipad-tokens", createLeadgridAuthoritativeWriteMiddleware({
      resolveSession,
      independentCredentials: INDEPENDENT_CREDENTIALS,
    }));
    app.patch("/api/leadgrid/leads/:id", (_req, res) => {
      res.json({ ok: true });
    });
    app.get("/api/leadgrid/canvas", (_req, res) => {
      res.json({ notater: [] });
    });
    app.get("/api/leadgrid/oppgaver", (_req, res) => {
      res.json({ oppgaver: [] });
    });
    app.get("/api/admin-room/lead-map/leads", (_req, res) => {
      res.json({ leads: [] });
    });
    app.post("/api/admin-room/ipad-tokens/generate", (_req, res) => {
      res.json({ ok: true });
    });
    return app;
  }

  it("returns 401 and no-store when a write session is not authoritative", async () => {
    const response = await supertest(appFor(async () => ({
      status: "unauthenticated",
    }))).patch("/api/leadgrid/leads/1");
    expect(response.status).toBe(401);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({ error: "authentication_required" });
  });

  it("returns 503 when session authority cannot be proven", async () => {
    const response = await supertest(appFor(async () => ({
      status: "unavailable",
    }))).patch("/api/leadgrid/leads/1");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "session_authority_unavailable" });
  });

  it("blocks a revoked Canvas read before private data reaches the route", async () => {
    const response = await supertest(appFor(async () => ({
      status: "unauthenticated",
    }))).get("/api/leadgrid/canvas");
    expect(response.status).toBe(401);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({ error: "authentication_required" });
  });

  it("blocks a revoked task read before stale process-cache data reaches the route", async () => {
    const response = await supertest(appFor(async () => ({
      status: "unauthenticated",
    }))).get("/api/leadgrid/oppgaver");
    expect(response.status).toBe(401);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toEqual({ error: "authentication_required" });
  });

  it.each([
    ["get", "/api/admin-room/lead-map/leads"],
    ["post", "/api/admin-room/ipad-tokens/generate"],
  ] as const)("blocks a revoked native request: %s %s", async (method, path) => {
    const response = await supertest(appFor(async () => ({
      status: "unauthenticated",
    })))[method](path);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "authentication_required" });
  });

  it("continues only with an authenticated authoritative session", async () => {
    const response = await supertest(appFor(async () => ({
      status: "authenticated",
      session: snapshot("0"),
    }))).patch("/api/leadgrid/leads/1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
