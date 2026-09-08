import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import { registerSuperAdminEmergencyLoginRoutes } from "./super-admin-emergency-login-routes.js";

describe("super-admin emergency login", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SUPER_ADMIN_EMERGENCY_TOKEN;
  });

  it("persists a complete session in the canonical store before returning the token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-08T11:00:00.000Z"));
    process.env.SUPER_ADMIN_EMERGENCY_TOKEN =
      "production-emergency-token-for-test";

    let storedSession: Record<string, unknown> | null = null;
    const query = vi.fn(async (sql: unknown, values?: unknown[]) => {
      const statement = String(sql);
      if (statement.includes("FROM users")) {
        return {
          rows: [{
            id: "daniel-user-id",
            email: "daniel@creatorhubn.com",
            first_name: "Daniel",
            last_name: "Qazi",
          }],
          rowCount: 1,
        };
      }
      if (statement.includes("INSERT INTO creatorhub_auth_sessions")) {
        storedSession = JSON.parse(String(values?.[1] || "null"));
        return { rows: [], rowCount: 1 };
      }
      if (statement.includes("SELECT session_data")) {
        return {
          rows: storedSession ? [{ session_data: storedSession }] : [],
          rowCount: storedSession ? 1 : 0,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const pool = { query } as unknown as Pool;
    const activeSessions = new Map();
    const app = express();
    app.use(express.json());
    registerSuperAdminEmergencyLoginRoutes({
      app,
      pool,
      activeSessions,
    });

    const response = await request(app)
      .post("/api/super-admin/emergency-login")
      .set("x-forwarded-for", "203.0.113.8")
      .send({
        email: "daniel@creatorhubn.com",
        token: process.env.SUPER_ADMIN_EMERGENCY_TOKEN,
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: "daniel-user-id",
      email: "daniel@creatorhubn.com",
      name: "Daniel Qazi",
      role: "admin",
      isAdmin: true,
    });
    expect(storedSession).toMatchObject({
      userId: "daniel-user-id",
      email: "daniel@creatorhubn.com",
      name: "Daniel Qazi",
      role: "admin",
      loginAt: "2026-09-08T11:00:00.000Z",
      isAdmin: true,
    });
    expect(activeSessions.get(response.body.token)).toEqual(storedSession);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO creatorhub_auth_sessions"),
      ),
    ).toBe(true);

    const loadedOnAnotherInstance = await loadPersistedAuthSession(
      pool,
      response.body.token,
    );
    expect(loadedOnAnotherInstance).toEqual(storedSession);
  });

  it("fails closed without returning a pod-local token when persistence cannot be verified", async () => {
    process.env.SUPER_ADMIN_EMERGENCY_TOKEN =
      "production-emergency-token-for-test";
    const query = vi.fn(async (sql: unknown) => {
      if (String(sql).includes("FROM users")) {
        return {
          rows: [{
            id: "daniel-user-id",
            email: "daniel@creatorhubn.com",
            first_name: "Daniel",
            last_name: "Qazi",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const activeSessions = new Map();
    const app = express();
    app.use(express.json());
    registerSuperAdminEmergencyLoginRoutes({
      app,
      pool: { query } as unknown as Pool,
      activeSessions,
    });

    const response = await request(app)
      .post("/api/super-admin/emergency-login")
      .set("x-forwarded-for", "203.0.113.9")
      .send({
        email: "daniel@creatorhubn.com",
        token: process.env.SUPER_ADMIN_EMERGENCY_TOKEN,
      });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "session_persistence_failed" });
    expect(response.body.token).toBeUndefined();
    expect(activeSessions.size).toBe(0);
  });
});
