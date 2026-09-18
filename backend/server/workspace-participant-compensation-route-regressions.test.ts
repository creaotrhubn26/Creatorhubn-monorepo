import { describe, expect, it, vi } from "vitest";
import type { WorkspaceParticipantCompensation } from "../../frontend/shared/workspace-participant-compensation.ts";
import { setupWorkspaceParticipantCompensationRoutes } from "./workspace-participant-compensation-routes.js";

const PROJECT_ID = "project-1";
const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111";
const ROUTE =
  "/api/projects/:projectId/participants/:participantId/compensation";
const REQUEST = {
  compensationType: "unpaid",
  expectedCurrentVersion: null,
  idempotencyKey: "88888888-8888-4888-8888-888888888888",
};

const compensation: WorkspaceParticipantCompensation = {
  id: "22222222-2222-4222-8222-222222222222",
  participantId: PARTICIPANT_ID,
  projectId: PROJECT_ID,
  version: 1,
  compensationType: "unpaid",
  status: "active",
  hourlyRate: null,
  estimatedHours: null,
  dayRate: null,
  fixedAmount: null,
  sharePercentage: null,
  estimatedAmount: null,
  currency: "NOK",
  note: null,
  splitSheetId: null,
  splitSheetStatus: null,
  supersedesCompensationId: null,
  createdAt: "2026-08-30T08:00:00.000Z",
  updatedAt: "2026-08-30T08:00:00.000Z",
  supersededAt: null,
  archivedAt: null,
};

const normalizedSql = (value: unknown) =>
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
    auth?: "authenticated" | "unauthenticated";
    viewer?: boolean;
    manager?: boolean;
    replayed?: boolean;
    serviceError?: Error & { statusCode?: number; code?: string };
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
    const sql = normalizedSql(sqlValue);
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
            role: options.viewer || options.manager ? "member" : "admin",
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
            permissions: options.viewer
              ? { canRead: true }
              : options.manager
                ? { canManageParticipants: true }
                : {},
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
  const createCompensationVersion = vi.fn(async () => {
    if (options.serviceError) throw options.serviceError;
    return { compensation, replayed: options.replayed ?? false };
  });
  setupWorkspaceParticipantCompensationRoutes({
    app,
    pool: {
      query,
      connect: vi.fn(async () => client),
    } as never,
    resolveAuthoritativeSessionFromRequest: vi.fn(async () =>
      options.auth === "unauthenticated"
        ? { status: "unauthenticated" as const }
        : {
            status: "authenticated" as const,
            session: { userId: "caller-1" },
          },
    ),
    createCompensationVersion: createCompensationVersion as never,
  });
  return { routes, calls, createCompensationVersion };
}

async function post(
  target: ReturnType<typeof harness>,
  res: ReturnType<typeof response>,
) {
  await target.routes.get(`POST ${ROUTE}`)!(
    {
      params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
      body: REQUEST,
    },
    res,
  );
}

describe("workspace participant compensation route regressions", () => {
  it("returns 401 before database access for an unauthenticated request", async () => {
    const target = harness({ auth: "unauthenticated" });
    const res = response();
    await post(target, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("auth_required");
    expect(target.calls).toEqual([]);
  });

  it("denies participant viewers on POST and rolls the transaction back", async () => {
    const target = harness({ viewer: true });
    const res = response();
    await post(target, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("participant_compensation_configure_denied");
    expect(target.createCompensationVersion).not.toHaveBeenCalled();
    expect(target.calls).toContain("ROLLBACK");
  });

  it("denies an ordinary participant manager from creating economic terms", async () => {
    const target = harness({ manager: true });
    const res = response();
    await post(target, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("participant_compensation_configure_denied");
    expect(target.createCompensationVersion).not.toHaveBeenCalled();
    expect(target.calls).toContain("ROLLBACK");
  });

  it("rolls back a service conflict without committing", async () => {
    const error = Object.assign(new Error("conflict"), {
      statusCode: 409,
      code: "version_conflict",
    });
    const target = harness({ serviceError: error });
    const res = response();
    await post(target, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("version_conflict");
    expect(target.calls).toContain("ROLLBACK");
    expect(target.calls).not.toContain("COMMIT");
  });

  it.each([
    { replayed: false, statusCode: 201 },
    { replayed: true, statusCode: 200 },
  ])("returns $statusCode when replayed=$replayed", async (scenario) => {
    const target = harness({ replayed: scenario.replayed });
    const res = response();
    await post(target, res);
    expect(res.statusCode).toBe(scenario.statusCode);
    expect(res.body).toMatchObject({
      compensation: { id: compensation.id, status: "active" },
      replayed: scenario.replayed,
    });
    expect(target.calls).toContain("COMMIT");
  });
});
