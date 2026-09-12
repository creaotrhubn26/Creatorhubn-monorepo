import type { Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupSuperadminImpersonationRoutes } from "./superadmin-impersonation-routes.js";

type HandlerMap = Map<string, RequestHandler>;

function routeHarness() {
  const getHandlers: HandlerMap = new Map();
  const postHandlers: HandlerMap = new Map();
  const app = {
    get(path: string, handler: RequestHandler) {
      getHandlers.set(path, handler);
    },
    post(path: string, handler: RequestHandler) {
      postHandlers.set(path, handler);
    },
  };
  return { app, getHandlers, postHandlers };
}

function responseHarness() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response as unknown as Response & typeof response;
}

async function invoke(
  handler: RequestHandler | undefined,
  req: Partial<Request>,
  res: Response,
): Promise<void> {
  if (!handler) throw new Error("route handler missing");
  await Promise.resolve(handler(req as Request, res, vi.fn()));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("superadmin impersonation session lifecycle", () => {
  it("persists full same-token impersonation markers with a 30 minute deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T10:00:00.000Z"));
    const { app, postHandlers } = routeHarness();
    const activeSessions = new Map<string, any>([["admin-token", {
      userId: "admin-user",
      email: "admin@example.test",
      name: "Admin User",
      role: "super_admin",
      profession: "photographer",
      loginAt: "2026-08-30T09:00:00.000Z",
    }]]);
    const query = vi.fn(async (sql: unknown) => {
      if (String(sql).includes("FROM users WHERE id=$1")) {
        return {
          rows: [{
            id: "target-user",
            email: "target@example.test",
            name: "Target User",
            role: "user",
            profession: "model",
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const persistSession = vi.fn();

    setupSuperadminImpersonationRoutes({
      app: app as any,
      pool: { query } as unknown as Pool,
      activeSessions,
      readSessionToken: () => "admin-token",
      persistSession,
      revokeSession: vi.fn(),
    });
    const response = responseHarness();
    await invoke(
      postHandlers.get("/api/superadmin/impersonate-user"),
      { body: { targetUserId: "target-user" } },
      response,
    );

    expect(response.statusCode).toBe(200);
    const persisted = persistSession.mock.calls[0]?.[1];
    expect(persisted).toMatchObject({
      userId: "target-user",
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonatorEmail: "admin@example.test",
      impersonationExpiresAt: Date.parse("2026-08-30T10:30:00.000Z"),
      impersonatorSnapshot: {
        userId: "admin-user",
        email: "admin@example.test",
        name: "Admin User",
        role: "super_admin",
      },
    });
  });

  it("revokes rather than downgrading a standalone token through the explicit end endpoint", async () => {
    const { app, postHandlers } = routeHarness();
    const token = "standalone-token";
    const activeSessions = new Map<string, any>([[token, {
      userId: "target-user",
      email: "target@example.test",
      name: "Target User",
      role: "user",
      loginAt: "2026-08-30T10:00:00.000Z",
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonationExpiresAt: Date.now() + 60_000,
    }]]);
    const persistSession = vi.fn();
    const revokeSession = vi.fn();

    setupSuperadminImpersonationRoutes({
      app: app as any,
      pool: { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool,
      activeSessions,
      readSessionToken: () => token,
      persistSession,
      revokeSession,
    });
    const response = responseHarness();
    await invoke(
      postHandlers.get("/api/superadmin/end-impersonation-user"),
      {},
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(activeSessions.has(token)).toBe(false);
    expect(revokeSession).toHaveBeenCalledWith(token);
    expect(persistSession).not.toHaveBeenCalled();
  });

  it("revokes an expired standalone token from the status path without persisting the target", async () => {
    const { app, getHandlers } = routeHarness();
    const token = "expired-standalone-token";
    const activeSessions = new Map<string, any>([[token, {
      userId: "target-user",
      email: "target@example.test",
      name: "Target User",
      role: "user",
      loginAt: "2026-08-30T10:00:00.000Z",
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonationExpiresAt: Date.now() - 1,
    }]]);
    const persistSession = vi.fn();
    const revokeSession = vi.fn();

    setupSuperadminImpersonationRoutes({
      app: app as any,
      pool: { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool,
      activeSessions,
      readSessionToken: () => token,
      persistSession,
      revokeSession,
    });
    const response = responseHarness();
    await invoke(
      getHandlers.get("/api/superadmin/impersonation-status"),
      {},
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(activeSessions.has(token)).toBe(false);
    expect(revokeSession).toHaveBeenCalledWith(token);
    expect(persistSession).not.toHaveBeenCalled();
  });
});
