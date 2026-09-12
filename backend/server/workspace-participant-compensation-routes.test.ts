import { describe, expect, it, vi } from "vitest";
import { setupWorkspaceParticipantCompensationRoutes } from "./workspace-participant-compensation-routes.js";

const PROJECT_ID = "project-1";
const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111";
const BASE =
  "/api/projects/:projectId/participants/:participantId/compensation";

const sqlText = (value: unknown) => String(value).replace(/\s+/g, " ").trim();

function createResponse() {
  const response: any = {
    statusCode: 200,
    body: undefined,
    headers: new Map<string, string>(),
  };
  response.setHeader = vi.fn((name: string, value: string) => {
    response.headers.set(name, value);
    return response;
  });
  response.status = vi.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = vi.fn((body: unknown) => {
    response.body = body;
    return response;
  });
  return response;
}

function createHarness(
  options: {
    auth?: "authenticated" | "unauthenticated" | "unavailable";
    callerId?: string;
    callerOrg?: string;
    callerRole?: string;
    ownerId?: string;
    boundOrg?: string | null;
    permissions?: Record<string, unknown> | null;
    participantExists?: boolean;
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
  const callerId = options.callerId ?? "caller-1";
  const ownerId = options.ownerId ?? "owner-1";
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = sqlText(sqlValue);
    calls.push({ sql, params });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes("FROM public.projects p")) {
      return {
        rowCount: 1,
        rows: [
          {
            project_id: PROJECT_ID,
            project_owner_user_id: ownerId,
            project_owner_email: "owner@example.test",
            bound_organization_id:
              options.boundOrg === undefined ? "org-a" : options.boundOrg,
            bound_owner_user_id: options.boundOrg === null ? null : ownerId,
          },
        ],
      };
    }
    if (sql.startsWith("SELECT LOWER(email::text) AS email FROM users")) {
      return {
        rowCount: 1,
        rows: [{ email: `${callerId}@example.test` }],
      };
    }
    if (sql.includes("FROM enterprise_team_members")) {
      return {
        rowCount: 1,
        rows: [
          {
            organization_id: options.callerOrg ?? "org-a",
            role: options.callerRole ?? "member",
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
      return options.permissions
        ? { rowCount: 1, rows: [{ permissions: options.permissions }] }
        : { rowCount: 0, rows: [] };
    }
    if (sql.startsWith("INSERT INTO workspace_project_enterprise_scopes")) {
      return { rowCount: 0, rows: [] };
    }
    if (sql.includes("FROM workspace_project_enterprise_scopes")) {
      return {
        rowCount: 1,
        rows: [{ organization_id: "org-a", project_owner_user_id: ownerId }],
      };
    }
    if (sql.startsWith("SELECT id FROM workspace_project_participants")) {
      return options.participantExists === false
        ? { rowCount: 0, rows: [] }
        : { rowCount: 1, rows: [{ id: PARTICIPANT_ID }] };
    }
    if (sql.includes("FROM workspace_participant_compensation_links link")) {
      return { rowCount: 0, rows: [] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const client = { query, release: vi.fn() };
  const pool = {
    query,
    connect: vi.fn(async () => client),
  };
  const auth = options.auth ?? "authenticated";
  const createCompensationVersion = vi.fn(async () => ({
    compensation: { id: "compensation-1" },
    replayed: false,
  }));
  setupWorkspaceParticipantCompensationRoutes({
    app,
    pool: pool as never,
    resolveAuthoritativeSessionFromRequest: vi.fn(async () =>
      auth === "authenticated"
        ? {
            status: "authenticated" as const,
            session: options.session ?? { userId: callerId },
          }
        : { status: auth },
    ),
    createCompensationVersion: createCompensationVersion as never,
  });
  return { routes, calls, query, pool, createCompensationVersion };
}

describe("workspace participant compensation routes", () => {
  it("registers explicit current/history reads and one version-creation POST", () => {
    const harness = createHarness();
    expect([...harness.routes.keys()].sort()).toEqual([
      `GET ${BASE}/current`,
      `GET ${BASE}/history`,
      `POST ${BASE}`,
    ]);
  });

  it("returns 503 when the authoritative session source is unavailable", async () => {
    const harness = createHarness({ auth: "unavailable" });
    const response = createResponse();
    await harness.routes.get(`GET ${BASE}/current`)!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
      },
      response,
    );
    expect(response.statusCode).toBe(503);
    expect(response.body.error).toBe("authentication_unavailable");
    expect(harness.query).not.toHaveBeenCalled();
  });

  it("rejects client-controlled tenant and project fields before database access", async () => {
    const harness = createHarness();
    const response = createResponse();
    await harness.routes.get(`POST ${BASE}`)!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: {
          compensationType: "unpaid",
          expectedCurrentVersion: null,
          idempotencyKey: "88888888-8888-4888-8888-888888888888",
          organizationId: "org-b",
          projectId: "other-project",
        },
      },
      response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("validation_error");
    expect(harness.query).not.toHaveBeenCalled();
  });

  it("rejects HTML in the participant-visible agreement note before database access", async () => {
    const harness = createHarness();
    const response = createResponse();
    await harness.routes.get(`POST ${BASE}`)!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: {
          compensationType: "unpaid",
          expectedCurrentVersion: null,
          idempotencyKey: "88888888-8888-4888-8888-888888888888",
          note: "<strong>privat</strong>",
        },
      },
      response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("validation_error");
    expect(harness.query).not.toHaveBeenCalled();
  });

  it("denies a roster viewer access to compensation amounts", async () => {
    const harness = createHarness({ permissions: { canRead: true } });
    const response = createResponse();
    await harness.routes.get(`GET ${BASE}/history`)!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
      },
      response,
    );
    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe("participant_compensation_manage_denied");
    expect(
      harness.calls.some((call) =>
        call.sql.includes("workspace_participant_compensation_links link"),
      ),
    ).toBe(false);
  });

  it("fails BOLA closed when the caller is outside the bound Enterprise tenant", async () => {
    const harness = createHarness({ callerOrg: "org-b" });
    const response = createResponse();
    await harness.routes.get(`POST ${BASE}`)!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: {
          compensationType: "unpaid",
          expectedCurrentVersion: null,
          idempotencyKey: "88888888-8888-4888-8888-888888888888",
        },
      },
      response,
    );
    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe("project_access_denied");
    expect(harness.calls.some((call) => call.sql === "ROLLBACK")).toBe(true);
    expect(
      harness.calls.some((call) =>
        call.sql.includes("INSERT INTO split_sheets"),
      ),
    ).toBe(false);
  });

  it("returns current compensation only after server-derived scoped access", async () => {
    const harness = createHarness({ callerId: "owner-1", ownerId: "owner-1" });
    const response = createResponse();
    await harness.routes.get(`GET ${BASE}/current`)!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
      },
      response,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.compensation).toBeNull();
    expect(response.body.access).toMatchObject({
      projectId: PROJECT_ID,
      organizationId: "org-a",
      projectOwnerUserId: "owner-1",
      canManage: true,
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    const historyQuery = harness.calls.find((call) =>
      call.sql.includes("workspace_participant_compensation_links link"),
    );
    expect(historyQuery?.params).toEqual([
      "org-a",
      PROJECT_ID,
      "owner-1",
      PARTICIPANT_ID,
    ]);
  });

  it("uses the effective user for access and the impersonator for compensation audit writes", async () => {
    const harness = createHarness({
      callerId: "owner-1",
      ownerId: "owner-1",
      session: {
        userId: "owner-1",
        impersonatedByAdmin: true,
        impersonatorId: "admin-real",
        impersonationExpiresAt: Date.now() + 60_000,
      },
    });
    const response = createResponse();
    await harness.routes.get(`POST ${BASE}`)!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: {
          compensationType: "unpaid",
          expectedCurrentVersion: null,
          idempotencyKey: "88888888-8888-4888-8888-888888888888",
        },
      },
      response,
    );

    expect(response.statusCode).toBe(201);
    expect(harness.createCompensationVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-real",
        auditPayload: {
          impersonated: true,
          effectiveUserId: "owner-1",
        },
      }),
    );
    const accessQuery = harness.calls.find((call) =>
      call.sql.startsWith("SELECT LOWER(email::text) AS email FROM users"),
    );
    expect(accessQuery?.params[0]).toBe("owner-1");
  });
});
