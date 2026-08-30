import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerSuperAdminEmergencyLoginRoutes } from "./super-admin-emergency-login-routes.js";

const EMERGENCY_TOKEN = "e".repeat(32);
let ipSequence = 1;

function setup(options?: {
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    is_active: boolean;
    auth_session_version: string;
  } | null;
  persistCanonicalSession?: ReturnType<typeof vi.fn>;
}) {
  const user = options?.user === undefined ? {
    id: "user-1",
    email: "configured@example.test",
    name: "Configured Admin",
    role: "super_admin",
    is_active: true,
    auth_session_version: "7",
  } : options.user;
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = String(sqlValue);
    if (sql.includes("FROM users")) return { rows: user ? [user] : [] };
    if (sql.includes("INSERT INTO admin_activity_log")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });
  const pool = { query } as unknown as Pool;
  const activeSessions = new Map<string, any>();
  const persistCanonicalSession = options?.persistCanonicalSession ??
    vi.fn(async () => undefined);
  const resolveClientIp = vi.fn(() => `203.0.113.${ipSequence++}`);
  const app = express();
  app.use(express.json());
  registerSuperAdminEmergencyLoginRoutes({
    app,
    pool,
    activeSessions,
    persistCanonicalSession: persistCanonicalSession as any,
    resolveClientIp,
  });
  return {
    app,
    query,
    activeSessions,
    persistCanonicalSession,
    resolveClientIp,
  };
}

describe("super-admin emergency login", () => {
  beforeEach(() => {
    vi.stubEnv("SUPER_ADMIN_EMERGENCY_TOKEN", EMERGENCY_TOKEN);
    vi.stubEnv("SUPER_ADMIN_EMERGENCY_EMAIL", "configured@example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("persists a full current DB snapshot before caching and returning", async () => {
    const context = setup();
    const response = await request(context.app)
      .post("/api/super-admin/emergency-login")
      .set("x-forwarded-for", "198.51.100.200")
      .send({
        email: "CONFIGURED@example.test",
        token: EMERGENCY_TOKEN,
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: "user-1",
      email: "configured@example.test",
      name: "Configured Admin",
      role: "super_admin",
    });
    expect(context.resolveClientIp).toHaveBeenCalledOnce();
    expect(context.persistCanonicalSession).toHaveBeenCalledOnce();
    const [persistedPool, persistedToken, persistedSession] =
      context.persistCanonicalSession.mock.calls[0];
    expect(persistedPool).toBeDefined();
    expect(persistedToken).toBe(response.body.token);
    expect(persistedSession).toMatchObject({
      userId: "user-1",
      role: "super_admin",
      authSessionVersion: "7",
      isAdmin: true,
    });
    expect(context.activeSessions.get(response.body.token))
      .toEqual(persistedSession);
    expect(context.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE LOWER(email) = $1"),
      ["configured@example.test"],
    );
    const userSql = String(context.query.mock.calls.find(
      ([sql]) => String(sql).includes("FROM users"),
    )?.[0]);
    expect(userSql).toContain("CONCAT_WS(' ', first_name, last_name)");
    expect(userSql).not.toContain("name::text");
  });

  it("rejects an inactive database user without minting", async () => {
    const context = setup({
      user: {
        id: "user-1",
        email: "configured@example.test",
        name: "Admin",
        role: "super_admin",
        is_active: false,
        auth_session_version: "4",
      },
    });
    const response = await request(context.app)
      .post("/api/super-admin/emergency-login")
      .send({ email: "configured@example.test", token: EMERGENCY_TOKEN });
    expect(response.status).toBe(403);
    expect(context.persistCanonicalSession).not.toHaveBeenCalled();
    expect(context.activeSessions.size).toBe(0);
  });

  it("rejects a non-superadmin database user without minting", async () => {
    const context = setup({
      user: {
        id: "user-1",
        email: "configured@example.test",
        name: "Admin",
        role: "admin",
        is_active: true,
        auth_session_version: "4",
      },
    });
    const response = await request(context.app)
      .post("/api/super-admin/emergency-login")
      .send({ email: "configured@example.test", token: EMERGENCY_TOKEN });
    expect(response.status).toBe(403);
    expect(context.persistCanonicalSession).not.toHaveBeenCalled();
    expect(context.activeSessions.size).toBe(0);
  });

  it("fails closed and leaves cache empty when canonical persistence fails", async () => {
    const warning = vi.spyOn(console, "error").mockImplementation(() => {});
    const context = setup({
      persistCanonicalSession: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });
    const response = await request(context.app)
      .post("/api/super-admin/emergency-login")
      .send({ email: "configured@example.test", token: EMERGENCY_TOKEN });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "session_store_unavailable" });
    expect(context.activeSessions.size).toBe(0);
    expect(warning).toHaveBeenCalled();
  });
});
