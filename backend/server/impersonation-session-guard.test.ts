import type { NextFunction, Request, RequestHandler, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setupAdminUsersRoutes } from "./admin-users-routes.js";
import { createImpersonationSessionGuard } from "./impersonation-session-guard.js";
import {
  parseWorkspaceParticipantAuthoritativeSession,
  workspaceParticipantAuditActorUserId,
} from "./workspace-participant-authoritative-session.js";

type TestSession = {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
  impersonatedByAdmin?: boolean;
  impersonatorId?: string;
  impersonatorEmail?: string;
  impersonatorSnapshot?: Record<string, unknown>;
  impersonationExpiresAt?: number;
};

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

function requestFor(token: string): Request {
  return {
    method: "PATCH",
    path: "/api/workspace/projects/project-1/participants/participant-1",
    headers: { authorization: `Bearer ${token}` },
  } as Request;
}

describe("impersonation session guard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("revokes an expired standalone token and rejects the first and retried participant mutation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T10:00:00.000Z"));
    const adminPosts = new Map<string, RequestHandler>();
    const register = (_path: string, _handler: RequestHandler): void => {};
    const adminApp = {
      get: register,
      patch: register,
      put: register,
      delete: register,
      post(path: string, handler: RequestHandler) {
        adminPosts.set(path, handler);
      },
    };
    const activeSessions = new Map<string, TestSession>();
    const persistedSessions = new Map<string, TestSession>();
    setupAdminUsersRoutes({
      app: adminApp as any,
      pool: { query: vi.fn(async () => ({ rows: [] })) } as any,
      requireAdminSession: () => ({
        userId: "admin-user",
        email: "admin@example.test",
      }),
      activeSessions,
      getAdminRoleCatalog: () => [],
      ADMIN_SESSION_ROLES: new Set(["admin", "super_admin"]),
      listAdminUsersSnapshot: vi.fn(async () => []),
      normalizeAdminRoleId: (role) => String(role || "user"),
      resolveAdminProfessionForPersistence: vi.fn(),
      upsertAdminInviteRequest: vi.fn(),
      upsertAdminAccountUser: vi.fn(),
      ensureInviteRequestAccessProvisioning: vi.fn(),
      resolveAdminUserView: vi.fn(async () => ({
        accountUserId: "target-user",
        email: "target@example.test",
        role: "user",
      })),
      toAdminString: (value) => typeof value === "string" && value.trim()
        ? value.trim()
        : null,
      toAdminBoolean: vi.fn(),
      findAdminInviteRequest: vi.fn(),
      findAdminAccountUser: vi.fn(async () => ({
        id: "target-user",
        email: "target@example.test",
        first_name: "Target",
        last_name: "User",
        role: "user",
      })),
      ensureCommunityAccessForApprovedInvite: vi.fn(),
      normalizeInvitePlanId: vi.fn(),
      buildAdminRoleEntry: () => ({ name: "Bruker", permissions: [] }),
      persistAuthSession: async (_pool, persistedToken, session) => {
        persistedSessions.set(persistedToken, { ...session });
      },
    });
    const startResponse = responseHarness();
    const startHandler = adminPosts.get("/api/admin/impersonate/start");
    if (!startHandler) throw new Error("start route missing");
    await Promise.resolve(startHandler(
      { body: { targetUserId: "target-user" } } as Request,
      startResponse,
      vi.fn(),
    ));
    const token = (startResponse.body as { token: string }).token;
    const expiresAt = activeSessions.get(token)?.impersonationExpiresAt;
    expect(expiresAt).toBe(Date.parse("2026-08-30T10:30:00.000Z"));
    const mutations: Array<{ actorUserId: string; targetUserId: string }> = [];

    const guard = createImpersonationSessionGuard({
      activeSessions,
      readSessionToken: () => token,
      persistSession: vi.fn(),
      revokeSession: async (revokedToken) => {
        persistedSessions.delete(revokedToken);
      },
      now: () => (expiresAt || 0) + 1,
    });

    const participantMutation = (res: Response): void => {
      const authoritative = parseWorkspaceParticipantAuthoritativeSession(
        persistedSessions.get(token),
        (expiresAt || 0) + 1,
      );
      if (!authoritative) {
        res.status(401).json({ error: "auth_required" });
        return;
      }
      mutations.push({
        actorUserId: workspaceParticipantAuditActorUserId(authoritative),
        targetUserId: authoritative.userId,
      });
      res.status(204).json({});
    };

    const firstResponse = responseHarness();
    const firstNext = vi.fn(() => participantMutation(firstResponse));
    await guard(
      requestFor(token),
      firstResponse,
      firstNext as unknown as NextFunction,
    );

    expect(firstResponse.statusCode).toBe(401);
    expect(firstNext).not.toHaveBeenCalled();
    expect(activeSessions.has(token)).toBe(false);
    expect(persistedSessions.has(token)).toBe(false);

    const retryResponse = responseHarness();
    const retryNext = vi.fn(() => participantMutation(retryResponse));
    await guard(
      requestFor(token),
      retryResponse,
      retryNext as unknown as NextFunction,
    );

    expect(retryNext).toHaveBeenCalledOnce();
    expect(retryResponse.statusCode).toBe(401);
    expect(mutations).toEqual([]);
  });

  it("revokes a pre-expiry session whose snapshot belongs to another admin", async () => {
    const token = "mismatched-snapshot-token";
    const activeSessions = new Map<string, TestSession>([[token, {
      userId: "target-user",
      email: "target@example.test",
      name: "Target User",
      role: "user",
      loginAt: "2026-08-30T10:00:00.000Z",
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonatorEmail: "admin@example.test",
      impersonatorSnapshot: {
        userId: "different-admin",
        email: "admin@example.test",
        name: "Admin",
        role: "super_admin",
      },
      impersonationExpiresAt: 5_000,
    }]]);
    const revokeSession = vi.fn();
    const next = vi.fn();
    const response = responseHarness();
    const guard = createImpersonationSessionGuard({
      activeSessions,
      readSessionToken: () => token,
      persistSession: vi.fn(),
      revokeSession,
      now: () => 1_000,
    });

    await guard(requestFor(token), response, next);

    expect(response.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(activeSessions.has(token)).toBe(false);
    expect(revokeSession).toHaveBeenCalledWith(token);
  });

  it("restores only a matching super-admin snapshot before continuing", async () => {
    const token = "restorable-token";
    const session: TestSession = {
      userId: "target-user",
      email: "target@example.test",
      name: "Target User",
      role: "user",
      loginAt: "2026-08-30T10:00:00.000Z",
      impersonatedByAdmin: true,
      impersonatorId: "admin-user",
      impersonatorEmail: "admin@example.test",
      impersonatorSnapshot: {
        userId: "admin-user",
        email: "admin@example.test",
        name: "Admin",
        role: "super_admin",
      },
      impersonationExpiresAt: 2_000,
    };
    const activeSessions = new Map([[token, session]]);
    const persistSession = vi.fn();
    const next = vi.fn();
    const guard = createImpersonationSessionGuard({
      activeSessions,
      readSessionToken: () => token,
      persistSession,
      revokeSession: vi.fn(),
      now: () => 2_001,
    });

    await guard(requestFor(token), responseHarness(), next);

    expect(next).toHaveBeenCalledOnce();
    expect(activeSessions.get(token)).toMatchObject({
      userId: "admin-user",
      email: "admin@example.test",
      role: "super_admin",
      impersonatedByAdmin: false,
    });
    expect(persistSession).toHaveBeenCalledWith(token, activeSessions.get(token));
  });
});
