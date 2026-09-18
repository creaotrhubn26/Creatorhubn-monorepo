import type { Pool } from "pg";
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
        /FROM creatorhub_auth_sessions[\s\S]*expires_at IS NOT NULL[\s\S]*expires_at > NOW\(\)/,
      ),
      ["token"],
    );
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
    expect(leadgridWriteNeedsAuthoritativeSession(request("GET", "/api/leadgrid/canvas-rolle-policy"))).toBe(false);
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
    app.patch("/api/leadgrid/leads/:id", (_req, res) => {
      res.json({ ok: true });
    });
    app.get("/api/leadgrid/canvas", (_req, res) => {
      res.json({ notater: [] });
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

  it("continues only with an authenticated authoritative session", async () => {
    const response = await supertest(appFor(async () => ({
      status: "authenticated",
      session: snapshot("0"),
    }))).patch("/api/leadgrid/leads/1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
