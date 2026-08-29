import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthSessionStoreUnavailableError,
  deletePersistedAuthSessionsByUserIdStrict,
  ensureAuthSessionTableStrict,
  persistAuthSessionInTransaction,
} from "./auth-session-store.js";
import { setupAdminUsersRoutes } from "./admin-users-routes.js";

vi.mock("./auth-session-store.js", () => {
  class MockAuthSessionStoreUnavailableError extends Error {
    constructor(operation: string, _cause: unknown) {
      super(`auth_session_store_unavailable:${operation}`);
      this.name = "AuthSessionStoreUnavailableError";
    }
  }
  return {
    AuthSessionStoreUnavailableError: MockAuthSessionStoreUnavailableError,
    deletePersistedAuthSessionsByUserIdStrict: vi.fn(),
    ensureAuthSessionTableStrict: vi.fn(async () => undefined),
    persistAuthSessionInTransaction: vi.fn(async () => undefined),
  };
});

const revoke = vi.mocked(deletePersistedAuthSessionsByUserIdStrict);
const ensureSessionStore = vi.mocked(ensureAuthSessionTableStrict);
const persistSessionStrict = vi.mocked(persistAuthSessionInTransaction);

function createApp(options: {
  client?: any;
  findAdminAccountUser?: ReturnType<typeof vi.fn>;
  resolveAuthoritativeSession?: ReturnType<typeof vi.fn>;
} = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.adminSession = {
      userId: "super-admin",
      email: "admin@example.test",
      role: "super_admin",
    } as any;
    next();
  });
  const activeSessions = new Map<string, any>([
    ["target-token", { userId: "user-42", role: "admin" }],
    ["derived-token", {
      userId: "other-user",
      role: "member",
      impersonatorId: "user-42",
    }],
  ]);
  const upsertAdminAccountUser = vi.fn(async () => ({}));
  const upsertAdminInviteRequest = vi.fn(async () => ({}));
  const defaultClient = {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    release: vi.fn(),
  };
  const client = options.client ?? defaultClient;
  const pool = {
    query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    connect: vi.fn(async () => client),
  } as unknown as Pool;
  setupAdminUsersRoutes({
    app,
    pool,
    requireAdminSession: vi.fn(() => ({ role: "super_admin" })),
    activeSessions,
    getAdminRoleCatalog: vi.fn(() => []),
    ADMIN_SESSION_ROLES: new Set(["admin", "super_admin"]),
    listAdminUsersSnapshot: vi.fn(async () => []),
    normalizeAdminRoleId: (role) => String(role || "member").toLowerCase(),
    resolveAdminProfessionForPersistence: vi.fn(() => null),
    upsertAdminInviteRequest,
    upsertAdminAccountUser,
    ensureInviteRequestAccessProvisioning: vi.fn(),
    resolveAdminUserView: vi.fn(async () => ({
      accountUserId: "user-42",
      email: "target@example.test",
      role: "admin",
      profession: null,
    })),
    toAdminString: (value) =>
      value === null || value === undefined ? null : String(value),
    toAdminBoolean: (value) => (typeof value === "boolean" ? value : null),
    findAdminInviteRequest: vi.fn(),
    findAdminAccountUser: options.findAdminAccountUser ?? vi.fn(),
    ensureCommunityAccessForApprovedInvite: vi.fn(),
    normalizeInvitePlanId: vi.fn(),
    buildAdminRoleEntry: vi.fn(() => ({ name: "Member", permissions: [] })),
    resolveAuthoritativeSession:
      options.resolveAuthoritativeSession ??
      vi.fn(async () => ({
        status: "authenticated" as const,
        session: {
          userId: "super-admin",
          email: "admin@example.test",
          name: "Admin",
          role: "super_admin",
          loginAt: "2026-08-30T10:00:00.000Z",
          authSessionVersion: "0",
        },
      })),
  });
  return {
    activeSessions,
    app,
    pool,
    upsertAdminAccountUser,
    upsertAdminInviteRequest,
    client,
  };
}

describe("admin user durable session revocation", () => {
  beforeEach(() => {
    revoke.mockReset();
    ensureSessionStore.mockReset();
    ensureSessionStore.mockResolvedValue(undefined);
    persistSessionStrict.mockReset();
    persistSessionStrict.mockResolvedValue(undefined);
  });

  it("rolls a role/version update back when revocation fails", async () => {
    revoke.mockRejectedValue(
      new AuthSessionStoreUnavailableError("delete_by_user", new Error("db")),
    );
    const {
      activeSessions,
      app,
      client,
      upsertAdminAccountUser,
      upsertAdminInviteRequest,
    } = createApp();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await request(app)
      .patch("/api/admin/users/user-42")
      .send({ role: "member" })
      .expect(503, { error: "session_store_unavailable" });

    expect(upsertAdminAccountUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "member" }),
      expect.objectContaining({
        queryClient: client,
        bumpAuthSessionVersion: true,
      }),
    );
    expect(upsertAdminInviteRequest).not.toHaveBeenCalled();
    expect(activeSessions.has("target-token")).toBe(true);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("commits the role/version update and durable delete before cache eviction", async () => {
    revoke.mockResolvedValue(undefined);
    const { activeSessions, app, client, upsertAdminAccountUser } = createApp();

    await request(app)
      .patch("/api/admin/users/user-42")
      .send({ role: "member" })
      .expect(200);

    expect(upsertAdminAccountUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: "member" }),
      expect.objectContaining({
        queryClient: client,
        bumpAuthSessionVersion: true,
      }),
    );
    expect(revoke).toHaveBeenCalledWith(client, "user-42");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(activeSessions.has("target-token")).toBe(false);
    expect(activeSessions.has("derived-token")).toBe(false);
  });

  it("rolls account deletion back when durable revocation fails", async () => {
    revoke.mockRejectedValue(
      new AuthSessionStoreUnavailableError("delete_by_user", new Error("db")),
    );
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (sqlValue: unknown) => {
        const sql = String(sqlValue);
        statements.push(sql.trim());
        if (sql.includes("SELECT id, email, role FROM users")) {
          return {
            rows: [
              {
                id: "user-42",
                email: "target@example.test",
                role: "member",
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes("information_schema.table_constraints")) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const { activeSessions, app } = createApp({ client });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await request(app)
      .delete("/api/admin/users/user-42")
      .expect(503, { error: "session_store_unavailable" });

    expect(statements).toContain("ROLLBACK");
    expect(statements.some((sql) => sql.startsWith("DELETE FROM users"))).toBe(
      false,
    );
    expect(activeSessions.has("target-token")).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("does not cache or return an impersonation token when canonical persistence fails", async () => {
    persistSessionStrict.mockRejectedValue(new Error("database unavailable"));
    const findAdminAccountUser = vi.fn(async () => ({
      id: "user-42",
      email: "target@example.test",
      first_name: "Target",
      last_name: "User",
      role: "member",
      is_active: true,
      auth_session_version: "7",
    }));
    const { activeSessions, app, pool } = createApp({ findAdminAccountUser });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await request(app)
      .post("/api/admin/impersonate/start")
      .send({ targetUserId: "user-42" })
      .expect(503, { error: "session_store_unavailable" });

    expect(ensureSessionStore).toHaveBeenCalledWith(pool);
    expect(persistSessionStrict).toHaveBeenCalledWith(
      pool,
      expect.any(String),
      expect.objectContaining({
        userId: "user-42",
        authSessionVersion: "7",
        impersonatedByAdmin: true,
        impersonatorId: "super-admin",
        impersonatorAuthSessionVersion: "0",
        impersonatorRole: "super_admin",
      }),
      { expiresAt: expect.any(Date) },
    );
    expect(
      [...activeSessions.values()].some(
        (session) => session?.impersonatedByAdmin === true,
      ),
    ).toBe(false);
  });

  it("does not mint from a revoked admin that remains in process-local cache", async () => {
    const resolveAuthoritativeSession = vi.fn(async () => ({
      status: "unauthenticated" as const,
    }));
    const findAdminAccountUser = vi.fn(async () => ({
      id: "user-42",
      email: "target@example.test",
      role: "member",
      is_active: true,
      auth_session_version: "3",
    }));
    const { activeSessions, app } = createApp({
      findAdminAccountUser,
      resolveAuthoritativeSession,
    });

    await request(app)
      .post("/api/admin/impersonate/start")
      .send({ targetUserId: "user-42" })
      .expect(401, { error: "authentication_required" });

    expect(activeSessions.has("target-token")).toBe(true);
    expect(findAdminAccountUser).not.toHaveBeenCalled();
    expect(persistSessionStrict).not.toHaveBeenCalled();
  });

  it("rejects nested impersonation before looking up a new target", async () => {
    const resolveAuthoritativeSession = vi.fn(async () => ({
      status: "authenticated" as const,
      session: {
        userId: "admin-target",
        email: "admin-target@example.test",
        name: "Impersonated Admin",
        role: "admin",
        loginAt: "2026-08-30T10:00:00.000Z",
        authSessionVersion: "4",
        impersonatedByAdmin: true,
      },
    }));
    const findAdminAccountUser = vi.fn();
    const { app } = createApp({
      findAdminAccountUser,
      resolveAuthoritativeSession,
    });

    await request(app)
      .post("/api/admin/impersonate/start")
      .send({ targetUserId: "user-42" })
      .expect(403, { error: "nested_impersonation_forbidden" });

    expect(findAdminAccountUser).not.toHaveBeenCalled();
    expect(persistSessionStrict).not.toHaveBeenCalled();
  });

  it("persists an impersonation token before caching and returning it", async () => {
    const events: string[] = [];
    persistSessionStrict.mockImplementation(async () => {
      events.push("persist");
    });
    const findAdminAccountUser = vi.fn(async () => ({
      id: "user-42",
      email: "target@example.test",
      first_name: "Target",
      last_name: "User",
      role: "member",
      is_active: true,
      auth_session_version: "3",
    }));
    const { activeSessions, app } = createApp({ findAdminAccountUser });

    const startedAt = Date.now();
    const response = await request(app)
      .post("/api/admin/impersonate/start")
      .send({ targetUserId: "user-42" })
      .expect(200);

    events.push("response");
    expect(persistSessionStrict).toHaveBeenCalledOnce();
    const expiryOptions = persistSessionStrict.mock.calls[0]?.[3];
    expect(expiryOptions?.expiresAt).toBeInstanceOf(Date);
    expect(expiryOptions?.expiresAt?.getTime()).toBeGreaterThanOrEqual(
      startedAt + 30 * 60 * 1000,
    );
    expect(expiryOptions?.expiresAt?.getTime()).toBeLessThanOrEqual(
      Date.now() + 30 * 60 * 1000,
    );
    expect(activeSessions.get(response.body.token)).toEqual(
      expect.objectContaining({
        userId: "user-42",
        authSessionVersion: "3",
        impersonatorAuthSessionVersion: "0",
      }),
    );
    expect(events).toEqual(["persist", "response"]);
  });
});
