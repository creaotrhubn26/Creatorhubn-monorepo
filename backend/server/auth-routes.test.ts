import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupAuthRoutes } from "./auth-routes.js";

const passwordResetMocks = vi.hoisted(() => ({
  consumeResetToken: vi.fn(),
}));
const totpMocks = vi.hoisted(() => ({
  getTotpStatus: vi.fn(async () => ({ enabled: false })),
}));

vi.mock("./password-reset-service.js", () => ({
  consumeResetToken: passwordResetMocks.consumeResetToken,
  requestPasswordReset: vi.fn(async () => ({ ok: true })),
  verifyResetToken: vi.fn(async () => ({ valid: false, reason: "not_found" })),
}));

vi.mock("./totp-2fa-service.js", () => ({
  getTotpStatus: totpMocks.getTotpStatus,
  verifyLoginToken: vi.fn(),
}));

function createApp(
  deletePersistedAuthSessionStrict = vi.fn(async () => undefined),
) {
  const app = express();
  app.use(express.json());
  const activeSessions = new Map<string, any>([
    ["live-token", { userId: "user-42", role: "member" }],
  ]);
  setupAuthRoutes({
    app,
    pool: {} as Pool,
    buildAdminRoleEntry: vi.fn(() => ({ name: "Member", permissions: [] })),
    buildSessionUserFromActiveSession: vi.fn(),
    deletePersistedAuthSessionStrict,
    getRoleRoomCommercialLoginGate: vi.fn(),
    getTableColumns: vi.fn(async () => new Set()),
    isRoleRoomCommercialLoginIntent: vi.fn(() => false),
    normalizeAdminProfession: vi.fn(() => null),
    normalizeAdminRoleId: vi.fn((role) => String(role || "member")),
    ADMIN_SESSION_ROLES: new Set(["admin", "super_admin"]),
    pendingTwoFactorLogins: new Map(),
    activeSessions,
    ensureAuthSessionTable: vi.fn(async () => true),
    persistAuthSessionInTransaction: vi.fn(async () => undefined),
    purgeExpiredPendingTwoFactor: vi.fn(),
    readActiveSessionToken: (req) => {
      const header = String(req.headers.authorization || "");
      return header.startsWith("Bearer ")
        ? header.slice("Bearer ".length).trim()
        : String(req.headers["x-session-token"] || "").trim() || null;
    },
    resolveActiveSessionFromRequest: vi.fn(async () => null),
    adminRoleCatalogById: new Map(),
  });
  return { activeSessions, app };
}

function createLoginApp() {
  const app = express();
  app.use(express.json());
  const activeSessions = new Map<string, any>();
  const pendingTwoFactorLogins = new Map<string, any>();
  const persistAuthSessionInTransaction = vi.fn(async () => undefined);
  const user = {
    id: "user-without-name",
    email: "fallback@example.test",
    username: null,
    first_name: null,
    last_name: null,
    password: "correct-password",
    role: "user",
    profession: null,
    company_name: null,
    is_active: true,
    auth_session_version: "4",
  };
  const pool = {
    query: vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue);
      if (sql.includes("FROM users WHERE email = $1")) {
        return { rows: [user], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  } as unknown as Pool;
  setupAuthRoutes({
    app,
    pool,
    buildAdminRoleEntry: vi.fn(() => ({ name: "Member", permissions: [] })),
    buildSessionUserFromActiveSession: vi.fn(),
    deletePersistedAuthSessionStrict: vi.fn(async () => undefined),
    getRoleRoomCommercialLoginGate: vi.fn(),
    getTableColumns: vi.fn(async () =>
      new Set([
        "username",
        "first_name",
        "last_name",
        "password",
        "role",
        "profession",
        "company_name",
        "is_active",
        "auth_session_version",
      ]),
    ),
    isRoleRoomCommercialLoginIntent: vi.fn(() => false),
    normalizeAdminProfession: vi.fn(() => null),
    normalizeAdminRoleId: vi.fn((role) => String(role || "user")),
    ADMIN_SESSION_ROLES: new Set(["admin", "super_admin"]),
    pendingTwoFactorLogins,
    activeSessions,
    ensureAuthSessionTable: vi.fn(async () => true),
    persistAuthSessionInTransaction,
    purgeExpiredPendingTwoFactor: vi.fn(),
    readActiveSessionToken: vi.fn(() => null),
    resolveActiveSessionFromRequest: vi.fn(async () => null),
    adminRoleCatalogById: new Map(),
  });
  return {
    activeSessions,
    app,
    pendingTwoFactorLogins,
    persistAuthSessionInTransaction,
  };
}

describe("auth route durable revocation", () => {
  beforeEach(() => {
    passwordResetMocks.consumeResetToken.mockReset();
    totpMocks.getTotpStatus.mockReset();
    totpMocks.getTotpStatus.mockResolvedValue({ enabled: false });
  });

  it("returns 503 and keeps the live session when durable logout fails", async () => {
    const revoke = vi.fn(async () => {
      throw new Error("session store unavailable");
    });
    const { activeSessions, app } = createApp(revoke);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await request(app)
      .post("/api/auth/logout")
      .set("Authorization", "Bearer live-token")
      .expect(503, { error: "session_store_unavailable" });

    expect(revoke).toHaveBeenCalledWith(expect.anything(), "live-token");
    expect(activeSessions.has("live-token")).toBe(true);
  });

  it("evicts the live session only after durable logout succeeds", async () => {
    const revoke = vi.fn(async () => undefined);
    const { activeSessions, app } = createApp(revoke);

    await request(app)
      .post("/api/auth/logout")
      .set("x-session-token", "live-token")
      .expect(200, { success: true });

    expect(revoke).toHaveBeenCalledWith(expect.anything(), "live-token");
    expect(activeSessions.has("live-token")).toBe(false);
  });

  it("maps a password-reset revocation failure to 503", async () => {
    passwordResetMocks.consumeResetToken.mockResolvedValue({
      ok: false,
      error: "db_error",
      message: "temporarily unavailable",
    });
    const { app } = createApp();

    await request(app)
      .post("/api/auth/reset-password/reset-token")
      .send({ password: "new-password" })
      .expect(503, {
        error: "db_error",
        message: "temporarily unavailable",
      });
  });

  it("uses email as the durable session name for a nameless legacy account", async () => {
    const { activeSessions, app, persistAuthSessionInTransaction } =
      createLoginApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "fallback@example.test",
        password: "correct-password",
      })
      .expect(200);

    expect(response.body.user.name).toBe("fallback@example.test");
    expect(persistAuthSessionInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      response.body.token,
      expect.objectContaining({
        name: "fallback@example.test",
        displayName: "fallback@example.test",
      }),
    );
    expect(activeSessions.get(response.body.token)?.name).toBe(
      "fallback@example.test",
    );
  });

  it("keeps the email fallback in the pending 2FA session snapshot", async () => {
    totpMocks.getTotpStatus.mockResolvedValue({ enabled: true });
    const {
      app,
      pendingTwoFactorLogins,
      persistAuthSessionInTransaction,
    } = createLoginApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "fallback@example.test",
        password: "correct-password",
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ needs_2fa: true, tempToken: expect.any(String) }),
    );
    const pending = pendingTwoFactorLogins.get(response.body.tempToken);
    expect(pending?.sessionData).toEqual(
      expect.objectContaining({
        name: "fallback@example.test",
        displayName: "fallback@example.test",
        authSessionVersion: "4",
      }),
    );
    expect(persistAuthSessionInTransaction).not.toHaveBeenCalled();
  });
});
