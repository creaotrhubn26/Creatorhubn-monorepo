import { describe, expect, it, vi } from "vitest";
import { setupWorkspaceParticipantClearanceRoutes } from "./workspace-participant-clearance-routes.js";

const PROJECT_ID = "project-1";
const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111";
const PATH =
  "/api/projects/:projectId/participants/:participantId/work-permit-clearance";
const approvedBody = {
  version: 3,
  status: "approved",
  evidenceReference: "creatorhub-document:33333333-3333-4333-8333-333333333333",
};

const normalized = (value: unknown) =>
  String(value).replace(/\s+/g, " ").trim();

function response() {
  const res: any = { statusCode: 200, body: undefined };
  res.setHeader = vi.fn();
  res.status = vi.fn((statusCode: number) => {
    res.statusCode = statusCode;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

function harness(
  options: {
    auth?: "authenticated" | "unauthenticated" | "unavailable" | "throws";
    manager?: boolean;
    serviceError?: Error & { statusCode?: number; code?: string };
    session?: {
      userId: string;
      impersonatedByAdmin?: boolean;
      impersonatorId?: string;
      impersonationExpiresAt?: number;
    };
  } = {},
) {
  const routes = new Map<string, (req: any, res: any) => Promise<unknown>>();
  const app: any = {
    get: (path: string, handler: (req: any, res: any) => Promise<unknown>) => {
      routes.set(`GET ${path}`, handler);
      return app;
    },
    post: (path: string, handler: (req: any, res: any) => Promise<unknown>) => {
      routes.set(`POST ${path}`, handler);
      return app;
    },
  };
  const calls: string[] = [];
  const query = vi.fn(async (sqlValue: unknown) => {
    const sql = normalized(sqlValue);
    calls.push(sql);
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes("FROM public.projects p")) {
      return {
        rowCount: 1,
        rows: [
          {
            project_id: PROJECT_ID,
            project_owner_user_id: "owner-1",
            project_owner_email: "owner@example.test",
            bound_organization_id: "org-a",
            bound_owner_user_id: "owner-1",
          },
        ],
      };
    }
    if (sql.startsWith("SELECT LOWER(email::text) AS email FROM users")) {
      return { rowCount: 1, rows: [{ email: "caller@example.test" }] };
    }
    if (sql.includes("FROM enterprise_team_members")) {
      return {
        rowCount: 1,
        rows: [
          {
            organization_id: "org-a",
            role: options.manager ? "member" : "admin",
          },
        ],
      };
    }
    if (sql.includes("enterprise_feature_permissions")) {
      return {
        rowCount: 1,
        rows: [
          {
            policy_present: true,
            permission_level: "all",
            allowed_roles: ["admin", "member", "viewer"],
            admin_only_features: [],
            disabled_features: [],
            custom_permissions: {},
          },
        ],
      };
    }
    if (sql.includes("FROM project_team_members")) {
      return {
        rowCount: 1,
        rows: [
          {
            permissions: options.manager ? { canManageParticipants: true } : {},
          },
        ],
      };
    }
    if (sql.startsWith("INSERT INTO workspace_project_enterprise_scopes")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes("FROM workspace_project_enterprise_scopes")) {
      return {
        rowCount: 1,
        rows: [{ organization_id: "org-a", project_owner_user_id: "owner-1" }],
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const client = { query, release: vi.fn() };
  const getClearance = vi.fn(async () => ({
    clearance: {
      participantId: PARTICIPANT_ID,
      status: "approved",
      participantVersion: 4,
      isMinor: true,
      updatedAt: "2026-08-30T09:00:00.000Z",
      latestChange: null,
    },
    history: [],
  }));
  const setClearance = vi.fn(async () => {
    if (options.serviceError) throw options.serviceError;
    const change = {
      id: "22222222-2222-4222-8222-222222222222",
      previousStatus: "required",
      status: "approved" as const,
      evidenceReference: approvedBody.evidenceReference,
      note: null,
      actorUserId: "caller-1",
      participantVersion: 4,
      occurredAt: "2026-08-30T09:00:00.000Z",
    };
    return {
      clearance: {
        participantId: PARTICIPANT_ID,
        status: "approved",
        participantVersion: 4,
        isMinor: true,
        updatedAt: "2026-08-30T09:00:00.000Z",
        latestChange: change,
      },
      change,
    };
  });
  setupWorkspaceParticipantClearanceRoutes({
    app,
    pool: { query, connect: vi.fn(async () => client) } as never,
    resolveAuthoritativeSessionFromRequest: vi.fn(async () => {
      if (options.auth === "throws") throw new Error("session store down");
      if (options.auth === "unavailable") {
        return { status: "unavailable" as const };
      }
      if (options.auth === "unauthenticated") {
        return { status: "unauthenticated" as const };
      }
      return {
        status: "authenticated" as const,
        session: options.session ?? { userId: "caller-1" },
      };
    }),
    getClearance: getClearance as never,
    setClearance: setClearance as never,
  });
  return { routes, calls, getClearance, setClearance };
}

async function request(
  target: ReturnType<typeof harness>,
  method: "GET" | "POST",
  body: unknown = approvedBody,
) {
  const res = response();
  await target.routes.get(`${method} ${PATH}`)!(
    {
      params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
      body,
    },
    res,
  );
  return res;
}

describe("workspace participant work permit clearance routes", () => {
  it.each([
    { auth: "unauthenticated" as const, status: 401, error: "auth_required" },
    {
      auth: "unavailable" as const,
      status: 503,
      error: "authentication_unavailable",
    },
    {
      auth: "throws" as const,
      status: 503,
      error: "authentication_unavailable",
    },
  ])("returns $status when auth is $auth", async (scenario) => {
    const target = harness({ auth: scenario.auth });
    const res = await request(target, "POST");
    expect(res.statusCode).toBe(scenario.status);
    expect(res.body.error).toBe(scenario.error);
    expect(target.calls).toEqual([]);
  });

  it.each(["GET", "POST"] as const)(
    "denies a participant manager detailed clearance access on %s",
    async (method) => {
      const target = harness({ manager: true });
      const res = await request(target, method);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe("work_permit_clearance_denied");
      expect(target.getClearance).not.toHaveBeenCalled();
      expect(target.setClearance).not.toHaveBeenCalled();
      if (method === "POST") expect(target.calls).toContain("ROLLBACK");
    },
  );

  it.each([
    { ...approvedBody, evidenceReference: "javascript:alert(1)" },
    { version: 3, status: "approved" },
    { version: 3, status: "pending", organizationId: "org-b" },
    { version: 3, status: "required" },
    {
      version: 3,
      status: "approved",
      evidenceReference: "https://user:secret@example.test/evidence",
    },
  ])("strictly rejects an unsafe or unknown payload", async (body) => {
    const target = harness();
    const res = await request(target, "POST", body);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("validation_error");
    expect(target.calls).toEqual([]);
    expect(target.setClearance).not.toHaveBeenCalled();
  });

  it("returns the detailed history to an Enterprise admin without caching", async () => {
    const target = harness();
    const res = await request(target, "GET");
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      clearance: { participantId: PARTICIPANT_ID, status: "approved" },
      history: [],
      access: { canConfigureRequirements: true },
    });
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-store, private",
    );
  });

  it("rolls back a service conflict", async () => {
    const error = Object.assign(new Error("conflict"), {
      statusCode: 409,
      code: "version_conflict",
    });
    const target = harness({ serviceError: error });
    const res = await request(target, "POST");
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("version_conflict");
    expect(target.calls).toContain("ROLLBACK");
    expect(target.calls).not.toContain("COMMIT");
  });

  it("commits an owner/admin command with only server-derived scope", async () => {
    const target = harness();
    const res = await request(target, "POST");
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      clearance: {
        participantId: PARTICIPANT_ID,
        status: "approved",
        participantVersion: 4,
      },
      change: { actorUserId: "caller-1", status: "approved" },
      access: { canConfigureRequirements: true },
    });
    expect(target.setClearance).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "caller-1",
        participantId: PARTICIPANT_ID,
        request: approvedBody,
      }),
    );
    expect(target.calls).toContain("COMMIT");
  });

  it("attributes an impersonated clearance command to the real administrator", async () => {
    const target = harness({
      session: {
        userId: "caller-1",
        impersonatedByAdmin: true,
        impersonatorId: "admin-real",
        impersonationExpiresAt: Date.now() + 60_000,
      },
    });
    const res = await request(target, "POST");

    expect(res.statusCode).toBe(200);
    expect(target.setClearance).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-real",
        auditPayload: {
          impersonated: true,
          effectiveUserId: "caller-1",
        },
      }),
    );
  });
});
