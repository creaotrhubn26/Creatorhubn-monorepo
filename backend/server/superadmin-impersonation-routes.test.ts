import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureAuthSessionTableStrict,
  persistAuthSessionInTransaction,
} from "./auth-session-store.js";
import { setupSuperadminImpersonationRoutes } from "./superadmin-impersonation-routes.js";

vi.mock("./auth-session-store.js", () => ({
  ensureAuthSessionTableStrict: vi.fn(async () => undefined),
  persistAuthSessionInTransaction: vi.fn(async () => undefined),
}));

const ensureStore = vi.mocked(ensureAuthSessionTableStrict);
const persistStrict = vi.mocked(persistAuthSessionInTransaction);

const adminSession = {
  userId: "admin-7",
  email: "admin@example.test",
  name: "Admin Seven",
  role: "super_admin",
  loginAt: "2026-08-30T10:00:00.000Z",
  authSessionVersion: "7",
  permissions: ["admin.all"],
  isAdmin: true,
};

const targetRow = {
  id: "user-3",
  email: "target@example.test",
  name: "Target Three",
  role: "member",
  profession: "sales",
  auth_session_version: "3",
  is_active: true,
};

function setup() {
  const token = "admin-token";
  const activeSessions = new Map<string, any>([[token, { ...adminSession }]]);
  let canonicalSession: any = { ...adminSession };
  const events: string[] = [];
  let currentAdminRow = {
    id: "admin-7",
    email: "admin@example.test",
    name: "Admin Seven",
    role: "super_admin",
    auth_session_version: "7",
    is_active: true,
  };
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM users") && sql.includes("auth_session_version")) {
      return { rows: [targetRow], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const client = {
    query: vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM users") && sql.includes("FOR SHARE")) {
        return { rows: [currentAdminRow], rowCount: 1 };
      }
      if (sql.includes("DELETE FROM creatorhub_auth_sessions")) {
        canonicalSession = null;
      }
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  const pool = {
    query,
    connect: vi.fn(async () => client),
  } as unknown as Pool;
  persistStrict.mockImplementation(async (_client, persistedToken, session) => {
    expect(persistedToken).toBe(token);
    events.push(`persist:${String((session as any).userId)}`);
    canonicalSession = { ...(session as any) };
  });
  const resolveAuthoritativeSession = vi.fn(async () => {
    if (!canonicalSession) {
      return { status: "unauthenticated" as const };
    }
    activeSessions.set(token, { ...canonicalSession });
    return {
      status: "authenticated" as const,
      session: { ...canonicalSession },
    };
  });
  const app = express();
  app.use(express.json());
  setupSuperadminImpersonationRoutes({
    app,
    pool,
    activeSessions,
    readSessionToken: () => token,
    resolveAuthoritativeSession,
  });
  return {
    activeSessions,
    app,
    events,
    getCanonicalSession: () => canonicalSession,
    resolveAuthoritativeSession,
    setCurrentAdminAuthority: (value: {
      authSessionVersion: string;
      isActive: boolean;
    }) => {
      currentAdminRow = {
        ...currentAdminRow,
        auth_session_version: value.authSessionVersion,
        is_active: value.isActive,
      };
    },
  };
}

describe("canonical super-admin impersonation", () => {
  beforeEach(() => {
    ensureStore.mockReset();
    ensureStore.mockResolvedValue(undefined);
    persistStrict.mockReset();
  });

  it("persists target v3 before cache and restores admin v7 only on explicit end", async () => {
    const startedAt = Date.now();
    const harness = setup();

    await request(harness.app)
      .post("/api/superadmin/impersonate-user")
      .send({ targetUserId: "user-3" })
      .expect(200);

    const impersonated = harness.getCanonicalSession();
    expect(impersonated).toEqual(expect.objectContaining({
      userId: "user-3",
      role: "member",
      authSessionVersion: "3",
      impersonatedByAdmin: true,
      impersonatorId: "admin-7",
      impersonatorAuthSessionVersion: "7",
      impersonatorRole: "super_admin",
    }));
    expect(impersonated.permissions).toBeUndefined();
    expect(impersonated.impersonatorSnapshot).toEqual(
      expect.objectContaining({
        userId: "admin-7",
        role: "super_admin",
        authSessionVersion: "7",
        permissions: ["admin.all"],
      }),
    );
    const startExpiry = persistStrict.mock.calls[0]?.[3]?.expiresAt;
    expect(startExpiry?.getTime()).toBeGreaterThanOrEqual(
      startedAt + 30 * 60 * 1000,
    );
    expect(startExpiry?.getTime()).toBeLessThanOrEqual(
      Date.now() + 30 * 60 * 1000,
    );
    expect(harness.events).toEqual(["persist:user-3"]);

    // Simulate a stale process-local admin cache. The route must re-resolve the
    // canonical target snapshot, not trust this old value.
    harness.activeSessions.set("admin-token", { ...adminSession });
    await request(harness.app)
      .post("/api/superadmin/end-impersonation-user")
      .expect(200, { ok: true, wasActive: true });

    expect(harness.resolveAuthoritativeSession).toHaveBeenCalledTimes(2);
    expect(harness.getCanonicalSession()).toEqual(expect.objectContaining({
      userId: "admin-7",
      role: "super_admin",
      authSessionVersion: "7",
      permissions: ["admin.all"],
    }));
    expect(harness.getCanonicalSession().impersonatedByAdmin).toBeUndefined();
    expect(persistStrict.mock.calls[1]?.[3]).toBeUndefined();
    expect(harness.events).toEqual(["persist:user-3", "persist:admin-7"]);
  });

  it("never exposes a target token when canonical persistence fails", async () => {
    const harness = setup();
    persistStrict.mockRejectedValueOnce(new Error("database unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await request(harness.app)
      .post("/api/superadmin/impersonate-user")
      .send({ targetUserId: "user-3" })
      .expect(503, { error: "session_store_unavailable" });

    expect(harness.getCanonicalSession()).toEqual(adminSession);
    expect(harness.activeSessions.get("admin-token")).toEqual(adminSession);
  });

  it.each([
    { authSessionVersion: "8", isActive: true, label: "version bump" },
    { authSessionVersion: "7", isActive: false, label: "deactivation" },
  ])("revokes instead of restoring stale admin authority after $label", async (authority) => {
    const harness = setup();
    await request(harness.app)
      .post("/api/superadmin/impersonate-user")
      .send({ targetUserId: "user-3" })
      .expect(200);
    harness.setCurrentAdminAuthority(authority);

    await request(harness.app)
      .post("/api/superadmin/end-impersonation-user")
      .expect(401, { error: "impersonator_authority_changed" });

    expect(harness.activeSessions.has("admin-token")).toBe(false);
    expect(harness.getCanonicalSession()).toBeNull();
    expect(persistStrict).toHaveBeenCalledTimes(1);
  });
});
