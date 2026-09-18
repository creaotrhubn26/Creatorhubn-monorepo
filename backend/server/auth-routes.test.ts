import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupAuthRoutes } from "./auth-routes.js";

const passwordResetMocks = vi.hoisted(() => ({
  consumeResetToken: vi.fn(),
}));

vi.mock("./password-reset-service.js", () => ({
  consumeResetToken: passwordResetMocks.consumeResetToken,
  requestPasswordReset: vi.fn(async () => ({ ok: true })),
  verifyResetToken: vi.fn(async () => ({ valid: false, reason: "not_found" })),
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
    persistAuthSession: vi.fn(async () => undefined),
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

describe("auth route durable revocation", () => {
  beforeEach(() => {
    passwordResetMocks.consumeResetToken.mockReset();
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
});
