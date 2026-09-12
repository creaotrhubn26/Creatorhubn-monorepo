import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceParticipantCompensationSnapshot } from "../../frontend/shared/workspace-participant-documents.ts";
import {
  hashWorkspaceParticipantCompensationPublicTerms,
  hashWorkspaceParticipantLegalSnapshot,
} from "./workspace-participant-documents-service.js";
import {
  ensureWorkspaceProjectScopeBinding,
  evaluateWorkspaceParticipantFeaturePolicy,
  resolveWorkspaceParticipantAccess,
  setupWorkspaceProjectParticipantsRoutes,
  WORKSPACE_PARTICIPANTS_FEATURE_ID,
} from "./workspace-project-participants-routes.js";

const OWNER_ID = "owner-1";
const CALLER_ID = "caller-1";
const PROJECT_ID = "project-1";
const PARTICIPANT_ID = "11111111-1111-4111-8111-111111111111";

function participantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PARTICIPANT_ID,
    organization_id: "org-a",
    project_id: PROJECT_ID,
    external_reference: null,
    display_name: "Statist",
    email: "secret@example.test",
    phone: "+47 900 00 000",
    participant_type: "extra",
    role_label: "Bakgrunn",
    engagement_type: "contractor",
    workflow_status: "confirmed",
    is_minor: false,
    guardian_status: "not_required",
    work_permit_status: "not_required",
    requires_contract: false,
    requires_media_consent: false,
    requires_compensation: false,
    notes: "Privat produksjonsnotat",
    metadata: { private: true },
    contract_status: "",
    contract_terms_snapshot: null,
    contract_signed_evidence: false,
    signed_contract_terms_snapshot: null,
    signed_contract_content_hash: null,
    contract_content_hash: null,
    media_consent_status: "",
    compensation_active: false,
    active_compensation_id: null,
    active_compensation_version: null,
    active_compensation_type: null,
    active_compensation_hourly_rate: null,
    active_compensation_estimated_hours: null,
    active_compensation_fixed_amount: null,
    active_compensation_currency: null,
    active_compensation_terms_snapshot: null,
    created_at: "2026-08-30T08:00:00.000Z",
    updated_at: "2026-08-30T08:00:00.000Z",
    archived_at: null,
    version: 1,
    ...overrides,
  };
}

const sqlText = (value: unknown) => String(value).replace(/\s+/g, " ").trim();

type TestCompensationType = "hourly" | "fixed" | "unpaid";

function compensationSnapshot(
  type: TestCompensationType,
  overrides: Partial<
    Pick<
      WorkspaceParticipantCompensationSnapshot,
      "id" | "version" | "publicTermsHash"
    >
  > = {},
): WorkspaceParticipantCompensationSnapshot {
  const hourlyRate = type === "hourly" ? 625 : null;
  const estimatedHours = type === "hourly" ? 8 : null;
  const fixedAmount = type === "fixed" ? 5_000 : null;
  const publicTerms: Omit<
    WorkspaceParticipantCompensationSnapshot,
    "publicTermsHash"
  > = {
    id: overrides.id ?? "22222222-2222-4222-8222-222222222222",
    version: overrides.version ?? 2,
    type,
    hourlyRate,
    estimatedHours,
    fixedAmount,
    estimatedAmount:
      type === "hourly"
        ? hourlyRate! * estimatedHours!
        : type === "fixed"
          ? fixedAmount
          : null,
    currency: "NOK",
    note: type === "unpaid" ? null : "Transport inkludert",
  };
  return {
    ...publicTerms,
    publicTermsHash:
      overrides.publicTermsHash ??
      hashWorkspaceParticipantCompensationPublicTerms(publicTerms),
  };
}

function readinessBindingFields(
  active: WorkspaceParticipantCompensationSnapshot,
  embedded: WorkspaceParticipantCompensationSnapshot | null = active,
) {
  const contractTermsSnapshot = {
    schemaVersion: 1,
    document: {
      id: "33333333-3333-4333-8333-333333333333",
      type: "contract",
      version: 3,
    },
    project: { id: PROJECT_ID, organizationId: "org-a" },
    participant: { id: PARTICIPANT_ID },
    compensation: embedded,
    terms: { workDescription: "Bakgrunnsmedvirkende" },
  };
  return {
    requires_compensation: true,
    contract_status: "signed",
    contract_signed_evidence: true,
    contract_terms_snapshot: contractTermsSnapshot,
    contract_content_hash: hashWorkspaceParticipantLegalSnapshot(
      contractTermsSnapshot,
    ),
    signed_contract_terms_snapshot: contractTermsSnapshot,
    signed_contract_content_hash: hashWorkspaceParticipantLegalSnapshot(
      contractTermsSnapshot,
    ),
    compensation_active: true,
    active_compensation_id: active.id,
    active_compensation_version: active.version,
    active_compensation_type: active.type,
    active_compensation_hourly_rate: active.hourlyRate,
    active_compensation_estimated_hours: active.estimatedHours,
    active_compensation_fixed_amount: active.fixedAmount,
    active_compensation_currency: active.currency,
    active_compensation_terms_snapshot: {
      source: "workspace-participant-compensation",
      workspaceProjectId: PROJECT_ID,
      workspaceParticipantId: PARTICIPANT_ID,
      workspaceCompensationId: active.id,
      compensationVersion: active.version,
      compensationType: active.type,
      hourlyRate: active.hourlyRate,
      estimatedHours: active.estimatedHours,
      fixedAmount: active.fixedAmount,
      estimatedAmount: active.estimatedAmount,
      currency: active.currency,
      note: active.note,
    },
  };
}

function createAccessDb(options: {
  callerId?: string;
  callerOrg?: string;
  callerRole?: string;
  ownerId?: string;
  ownerOrgs?: string[];
  boundOrg?: string | null;
  policyPresent?: boolean;
  permissionLevel?: string;
  allowedRoles?: string[];
  permissions?: Record<string, unknown> | null;
  callerMembershipActive?: boolean;
}) {
  const callerId = options.callerId ?? CALLER_ID;
  const ownerId = options.ownerId ?? OWNER_ID;
  const callerOrg = options.callerOrg ?? "org-a";
  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = sqlText(sqlValue);
    if (
      sql.includes("FROM public.projects p") &&
      sql.includes("workspace_project_enterprise_scopes")
    ) {
      return {
        rowCount: 1,
        rows: [
          {
            project_id: PROJECT_ID,
            project_owner_user_id: ownerId,
            project_owner_email: "owner@example.test",
            bound_organization_id: options.boundOrg ?? null,
            bound_owner_user_id: options.boundOrg ? ownerId : null,
          },
        ],
      };
    }
    if (sql.startsWith("SELECT LOWER(email::text) AS email FROM users")) {
      return { rowCount: 1, rows: [{ email: `${callerId}@example.test` }] };
    }
    if (sql.includes("FROM enterprise_team_members")) {
      if (String(params[0]) === callerId) {
        if (options.callerMembershipActive === false) {
          return { rowCount: 0, rows: [] };
        }
        return {
          rowCount: 1,
          rows: [
            {
              organization_id: callerOrg,
              role: options.callerRole ?? "member",
            },
          ],
        };
      }
      const ownerOrgs = options.ownerOrgs ?? ["org-a"];
      return {
        rowCount: ownerOrgs.length,
        rows: ownerOrgs.map((organization_id) => ({ organization_id })),
      };
    }
    if (
      sql.includes("FROM (SELECT 1) seed") &&
      sql.includes("enterprise_feature_permissions")
    ) {
      return {
        rowCount: 1,
        rows: [
          {
            policy_present: options.policyPresent ?? true,
            permission_level: options.permissionLevel ?? "all",
            allowed_roles: options.allowedRoles ?? [
              "admin",
              "member",
              "viewer",
            ],
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
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  return { query };
}

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

function createRouteHarness(options: {
  resolveStatus?: "authenticated" | "unauthenticated" | "unavailable";
  session?: {
    userId: string;
    impersonatedByAdmin?: boolean;
    impersonatorId?: string;
    impersonationExpiresAt?: number;
  };
  query: (sql: unknown, params?: unknown[]) => Promise<any>;
}) {
  const routes = new Map<string, (req: any, res: any) => Promise<unknown>>();
  const app: any = {};
  for (const method of ["get", "post", "patch"]) {
    app[method] = (
      path: string,
      ...handlers: Array<(req: any, res: any) => Promise<unknown>>
    ) => {
      routes.set(
        `${method.toUpperCase()} ${path}`,
        handlers[handlers.length - 1],
      );
      return app;
    };
  }
  const sqlCalls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: unknown, params: unknown[] = []) => {
      sqlCalls.push({ sql: sqlText(sql), params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sqlText(sql))) {
        return { rowCount: 0, rows: [] };
      }
      return options.query(sql, params);
    }),
    release: vi.fn(),
  };
  const pool = {
    query: client.query,
    connect: vi.fn(async () => client),
  };
  const resolveStatus = options.resolveStatus ?? "authenticated";
  setupWorkspaceProjectParticipantsRoutes({
    app,
    pool: pool as never,
    resolveAuthoritativeSessionFromRequest: vi.fn(async () =>
      resolveStatus === "authenticated"
        ? {
            status: "authenticated" as const,
            session: options.session ?? { userId: CALLER_ID },
          }
        : { status: resolveStatus },
    ),
  });
  return { routes, pool, client, sqlCalls };
}

describe("Workspace participant Enterprise feature policy", () => {
  it("evaluates all, admin_only, custom, and disabled explicitly", () => {
    expect(
      evaluateWorkspaceParticipantFeaturePolicy({
        role: "viewer",
        policyPresent: true,
        permissionLevel: "all",
      }),
    ).toEqual({ allowed: true, reason: "all" });
    expect(
      evaluateWorkspaceParticipantFeaturePolicy({
        role: "member",
        policyPresent: true,
        permissionLevel: "admin_only",
      }),
    ).toEqual({ allowed: false, reason: "admin_only" });
    expect(
      evaluateWorkspaceParticipantFeaturePolicy({
        role: "admin",
        policyPresent: true,
        permissionLevel: "admin_only",
      }),
    ).toEqual({ allowed: true, reason: "admin_only" });
    expect(
      evaluateWorkspaceParticipantFeaturePolicy({
        role: "member",
        policyPresent: true,
        permissionLevel: "custom",
        allowedRoles: ["member"],
      }),
    ).toEqual({ allowed: true, reason: "custom" });
    expect(
      evaluateWorkspaceParticipantFeaturePolicy({
        role: "admin",
        policyPresent: true,
        permissionLevel: "all",
        disabledFeatures: [WORKSPACE_PARTICIPANTS_FEATURE_ID],
      }),
    ).toEqual({ allowed: false, reason: "disabled" });
  });

  it("fails closed for absent or unknown policies", () => {
    expect(
      evaluateWorkspaceParticipantFeaturePolicy({
        role: "admin",
        policyPresent: false,
      }),
    ).toEqual({ allowed: false, reason: "policy_missing" });
    expect(
      evaluateWorkspaceParticipantFeaturePolicy({
        role: "admin",
        policyPresent: true,
        permissionLevel: "surprise",
      }),
    ).toEqual({ allowed: false, reason: "invalid_policy" });
  });

  it("gives organization settings deterministic precedence", () => {
    expect(
      evaluateWorkspaceParticipantFeaturePolicy({
        role: "member",
        policyPresent: true,
        permissionLevel: "all",
        adminOnlyFeatures: [WORKSPACE_PARTICIPANTS_FEATURE_ID],
      }),
    ).toEqual({ allowed: false, reason: "admin_only" });
    expect(
      evaluateWorkspaceParticipantFeaturePolicy({
        role: "viewer",
        policyPresent: true,
        permissionLevel: "disabled",
        customPermissions: {
          [WORKSPACE_PARTICIPANTS_FEATURE_ID]: {
            permissionLevel: "custom",
            allowedRoles: ["viewer"],
          },
        },
      }),
    ).toEqual({ allowed: true, reason: "custom" });
  });
});

describe("Workspace participant project/tenant authorization", () => {
  it("rejects a caller whose Enterprise organization differs from the durable project scope", async () => {
    const db = createAccessDb({ callerOrg: "org-a", boundOrg: "org-b" });
    await expect(
      resolveWorkspaceParticipantAccess(db as never, CALLER_ID, PROJECT_ID),
    ).rejects.toMatchObject({ statusCode: 403, code: "project_access_denied" });
  });

  it("requires one unambiguous owner/caller organization before first binding", async () => {
    const db = createAccessDb({
      ownerOrgs: ["org-a", "org-b"],
      callerOrg: "org-a",
      permissions: { canRead: true },
    });
    await expect(
      resolveWorkspaceParticipantAccess(db as never, CALLER_ID, PROJECT_ID),
    ).resolves.toMatchObject({ organizationId: "org-a", scopeBound: false });

    const ambiguousQuery = vi.fn(
      async (sqlValue: unknown, params: unknown[] = []) => {
        const sql = sqlText(sqlValue);
        if (sql.includes("FROM public.projects p"))
          return {
            rowCount: 1,
            rows: [
              {
                project_id: PROJECT_ID,
                project_owner_user_id: OWNER_ID,
                project_owner_email: "owner@example.test",
                bound_organization_id: null,
              },
            ],
          };
        if (sql.startsWith("SELECT LOWER(email::text)"))
          return { rowCount: 1, rows: [{ email: "caller@example.test" }] };
        if (
          sql.includes("FROM enterprise_team_members") &&
          String(params[0]) === CALLER_ID
        ) {
          return {
            rowCount: 2,
            rows: [
              { organization_id: "org-a", role: "admin" },
              { organization_id: "org-b", role: "admin" },
            ],
          };
        }
        if (sql.includes("FROM enterprise_team_members")) {
          return {
            rowCount: 2,
            rows: [{ organization_id: "org-a" }, { organization_id: "org-b" }],
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    );
    await expect(
      resolveWorkspaceParticipantAccess(
        { query: ambiguousQuery } as never,
        CALLER_ID,
        PROJECT_ID,
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ambiguous_enterprise_scope",
    });
  });

  it("requires an explicit project permission for ordinary Enterprise members", async () => {
    const viewerDb = createAccessDb({
      boundOrg: "org-a",
      permissions: { canRead: true },
    });
    await expect(
      resolveWorkspaceParticipantAccess(
        viewerDb as never,
        CALLER_ID,
        PROJECT_ID,
      ),
    ).resolves.toMatchObject({
      canView: true,
      canManage: false,
      role: "participant_viewer",
    });

    const managerDb = createAccessDb({
      boundOrg: "org-a",
      permissions: { canRead: true, canManageParticipants: true },
    });
    await expect(
      resolveWorkspaceParticipantAccess(
        managerDb as never,
        CALLER_ID,
        PROJECT_ID,
      ),
    ).resolves.toMatchObject({
      canView: true,
      canManage: true,
      role: "participant_manager",
    });
  });

  it("does not let an org admin establish somebody else's first project binding", async () => {
    const db = createAccessDb({
      boundOrg: null,
      callerRole: "admin",
      ownerOrgs: ["org-a"],
    });
    const access = await resolveWorkspaceParticipantAccess(
      db as never,
      CALLER_ID,
      PROJECT_ID,
    );
    expect(access).toMatchObject({
      canView: true,
      canManage: false,
      scopeBound: false,
      role: "enterprise_admin",
    });
    await expect(
      ensureWorkspaceProjectScopeBinding(db as never, access, CALLER_ID),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "project_scope_owner_required",
    });
  });

  it.each(["absent", "pending"])(
    "denies %s Enterprise membership fail-closed",
    async () => {
      const db = createAccessDb({
        boundOrg: "org-a",
        callerMembershipActive: false,
      });
      await expect(
        resolveWorkspaceParticipantAccess(db as never, CALLER_ID, PROJECT_ID),
      ).rejects.toMatchObject({ statusCode: 403, code: "enterprise_required" });
      const membershipQuery = db.query.mock.calls
        .map(([sql]) => sqlText(sql))
        .find((sql) => sql.includes("FROM enterprise_team_members"));
      expect(membershipQuery).toContain("status = 'active'");
      expect(membershipQuery).toContain("org_kind = 'enterprise'");
    },
  );
});

describe("Workspace participant HTTP trust boundary", () => {
  it("distinguishes unavailable authority from an unauthenticated request and never queries PII", async () => {
    for (const [status, expectedCode, expectedStatus] of [
      ["unavailable", "authentication_unavailable", 503],
      ["unauthenticated", "auth_required", 401],
    ] as const) {
      const harness = createRouteHarness({
        resolveStatus: status,
        query: async () => {
          throw new Error("database must not be reached");
        },
      });
      const response = createResponse();
      await harness.routes.get(
        "GET /api/projects/:projectId/participants/access",
      )!({ params: { projectId: PROJECT_ID }, query: {} }, response);
      expect(response.statusCode).toBe(expectedStatus);
      expect(response.body.error).toBe(expectedCode);
      expect(response.headers.get("Cache-Control")).toBe("no-store, private");
      expect(harness.pool.connect).not.toHaveBeenCalled();
      expect(harness.client.query).not.toHaveBeenCalled();
    }
  });

  it("blocks a cross-organization PATCH before participant lookup or mutation", async () => {
    const accessDb = createAccessDb({ callerOrg: "org-a", boundOrg: "org-b" });
    const harness = createRouteHarness({ query: accessDb.query });
    const response = createResponse();
    await harness.routes.get(
      "PATCH /api/projects/:projectId/participants/:participantId",
    )!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: { version: 1, displayName: "Forsøk" },
      },
      response,
    );
    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe("project_access_denied");
    expect(
      harness.sqlCalls.some(
        ({ sql }) =>
          sql.includes("FROM workspace_project_participants") ||
          sql.startsWith("UPDATE workspace_project_participants"),
      ),
    ).toBe(false);
    expect(harness.sqlCalls.map(({ sql }) => sql)).toContain("ROLLBACK");
  });

  it("scopes participant lookup by tenant, project, and participant id", async () => {
    const accessDb = createAccessDb({
      callerId: CALLER_ID,
      ownerId: CALLER_ID,
      boundOrg: "org-a",
      callerRole: "admin",
    });
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (["BEGIN", "ROLLBACK", "COMMIT"].includes(sql))
        return { rowCount: 0, rows: [] };
      if (sql.startsWith("INSERT INTO workspace_project_enterprise_scopes"))
        return { rowCount: 0, rows: [] };
      if (
        sql.startsWith("SELECT organization_id::text AS organization_id") &&
        sql.includes("workspace_project_enterprise_scopes")
      ) {
        return {
          rowCount: 1,
          rows: [
            { organization_id: "org-a", project_owner_user_id: CALLER_ID },
          ],
        };
      }
      if (sql.startsWith("SELECT * FROM workspace_project_participants"))
        return { rowCount: 0, rows: [] };
      return accessDb.query(sqlValue, params);
    });
    const harness = createRouteHarness({ query });
    const response = createResponse();
    await harness.routes.get(
      "PATCH /api/projects/:projectId/participants/:participantId",
    )!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: { version: 1, displayName: "Finnes ikke" },
      },
      response,
    );
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe("participant_not_found");
    const lookup = harness.sqlCalls.find(({ sql }) =>
      sql.startsWith("SELECT * FROM workspace_project_participants"),
    );
    expect(lookup?.sql).toContain(
      "organization_id = $1 AND project_id = $2 AND id = $3",
    );
    expect(lookup?.params).toEqual(["org-a", PROJECT_ID, PARTICIPANT_ID]);
    expect(
      harness.sqlCalls.some(({ sql }) =>
        sql.startsWith("UPDATE workspace_project_participants"),
      ),
    ).toBe(false);
  });

  it("redacts participant PII for viewers and excludes email from viewer search", async () => {
    const accessDb = createAccessDb({
      boundOrg: "org-a",
      permissions: { canRead: true },
    });
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (sql.startsWith("SELECT participant.*")) {
        return { rowCount: 1, rows: [participantRow()] };
      }
      return accessDb.query(sqlValue, params);
    });
    const harness = createRouteHarness({ query });
    const response = createResponse();
    await harness.routes.get("GET /api/projects/:projectId/participants")!(
      {
        params: { projectId: PROJECT_ID },
        query: { search: "secret@example.test" },
      },
      response,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.participants[0]).toMatchObject({
      email: null,
      phone: null,
      notes: null,
      metadata: {},
    });
    const listSql =
      harness.sqlCalls.find(({ sql }) => sql.startsWith("SELECT participant.*"))
        ?.sql ?? "";
    expect(listSql).toContain("participant.display_name ILIKE");
    expect(listSql).toContain("participant.role_label ILIKE");
    expect(listSql).not.toContain("participant.email ILIKE");
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
  });

  it("strictly rejects client-controlled tenant, project, and legal approval fields", async () => {
    const harness = createRouteHarness({
      query: async () => {
        throw new Error("database must not be reached");
      },
    });
    const response = createResponse();
    await harness.routes.get("POST /api/projects/:projectId/participants")!(
      {
        params: { projectId: PROJECT_ID },
        body: {
          displayName: "Forsøk",
          organizationId: "org-attacker",
          projectId: "project-attacker",
          workflowStatus: "completed",
          guardianStatus: "approved",
          workPermitStatus: "approved",
        },
      },
      response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("validation_error");
    expect(harness.pool.connect).not.toHaveBeenCalled();
    expect(harness.client.query).not.toHaveBeenCalled();
  });

  it("rejects a cancelled transition mixed with edits before invoking closure", async () => {
    const accessDb = createAccessDb({
      callerId: CALLER_ID,
      ownerId: CALLER_ID,
      boundOrg: "org-a",
      callerRole: "admin",
    });
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (sql.startsWith("INSERT INTO workspace_project_enterprise_scopes"))
        return { rowCount: 0, rows: [] };
      if (
        sql.startsWith("SELECT organization_id::text AS organization_id") &&
        sql.includes("workspace_project_enterprise_scopes")
      ) {
        return {
          rowCount: 1,
          rows: [
            { organization_id: "org-a", project_owner_user_id: CALLER_ID },
          ],
        };
      }
      return accessDb.query(sqlValue, params);
    });
    const harness = createRouteHarness({ query });
    const response = createResponse();
    await harness.routes.get(
      "PATCH /api/projects/:projectId/participants/:participantId",
    )!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: {
          version: 1,
          workflowStatus: "cancelled",
          displayName: "Skal ikke lagres",
        },
      },
      response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe(
      "terminal_transition_requires_dedicated_request",
    );
    expect(
      harness.sqlCalls.some(({ sql }) =>
        sql.startsWith(
          "SELECT id::text, workflow_status, version, archived_at",
        ),
      ),
    ).toBe(false);
    expect(
      harness.sqlCalls.some(({ sql }) =>
        sql.startsWith("UPDATE workspace_project_participants"),
      ),
    ).toBe(false);
    expect(harness.sqlCalls.map(({ sql }) => sql)).toContain("ROLLBACK");
  });

  it.each([
    {
      route: "PATCH /api/projects/:projectId/participants/:participantId",
      body: { version: 1, workflowStatus: "cancelled" },
    },
    {
      route:
        "POST /api/projects/:projectId/participants/:participantId/archive",
      body: { version: 1 },
    },
  ])(
    "does not let a participant manager perform terminal closure through $route",
    async ({ route, body }) => {
      const accessDb = createAccessDb({
        boundOrg: "org-a",
        permissions: { canRead: true, canManageParticipants: true },
      });
      const harness = createRouteHarness({ query: accessDb.query });
      const response = createResponse();
      await harness.routes.get(route)!(
        {
          params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
          body,
        },
        response,
      );

      expect(response.statusCode).toBe(403);
      expect(response.body.error).toBe("participant_closure_denied");
      expect(
        harness.sqlCalls.some(({ sql }) =>
          sql.startsWith("UPDATE workspace_project_participants"),
        ),
      ).toBe(false);
    },
  );

  it("uses the impersonated owner only for access and the real admin for update attribution", async () => {
    const effectiveUserId = "owner-1";
    const accessDb = createAccessDb({
      callerId: effectiveUserId,
      ownerId: effectiveUserId,
      boundOrg: "org-a",
      callerRole: "admin",
    });
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (sql.startsWith("INSERT INTO workspace_project_enterprise_scopes")) {
        return { rowCount: 0, rows: [] };
      }
      if (
        sql.startsWith("SELECT organization_id::text AS organization_id") &&
        sql.includes("workspace_project_enterprise_scopes")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              organization_id: "org-a",
              project_owner_user_id: effectiveUserId,
            },
          ],
        };
      }
      if (sql.startsWith("SELECT * FROM workspace_project_participants")) {
        return { rowCount: 1, rows: [participantRow()] };
      }
      if (sql.startsWith("UPDATE workspace_project_participants")) {
        return { rowCount: 1, rows: [{ id: PARTICIPANT_ID }] };
      }
      if (sql.startsWith("INSERT INTO workspace_participant_events")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("SELECT participant.*")) {
        return {
          rowCount: 1,
          rows: [participantRow({ display_name: "Oppdatert", version: 2 })],
        };
      }
      return accessDb.query(sqlValue, params);
    });
    const harness = createRouteHarness({
      query,
      session: {
        userId: effectiveUserId,
        impersonatedByAdmin: true,
        impersonatorId: "admin-real",
        impersonationExpiresAt: Date.now() + 60_000,
      },
    });
    const response = createResponse();
    await harness.routes.get(
      "PATCH /api/projects/:projectId/participants/:participantId",
    )!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: { version: 1, displayName: "Oppdatert" },
      },
      response,
    );

    expect(response.statusCode).toBe(200);
    const accessQuery = harness.sqlCalls.find(({ sql }) =>
      sql.startsWith("SELECT LOWER(email::text) AS email FROM users"),
    );
    expect(accessQuery?.params[0]).toBe(effectiveUserId);
    const update = harness.sqlCalls.find(({ sql }) =>
      sql.startsWith("UPDATE workspace_project_participants"),
    );
    expect(update?.params.at(-1)).toBe("admin-real");
    const event = harness.sqlCalls.find(({ sql }) =>
      sql.startsWith("INSERT INTO workspace_participant_events"),
    );
    expect(event?.params[3]).toBe("admin-real");
    expect(JSON.parse(String(event?.params[4]))).toMatchObject({
      impersonated: true,
      effectiveUserId,
    });
  });

  it("denies a real requirement change by a participant manager", async () => {
    const accessDb = createAccessDb({
      boundOrg: "org-a",
      permissions: { canRead: true, canManageParticipants: true },
    });
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (sql.startsWith("INSERT INTO workspace_project_enterprise_scopes"))
        return { rowCount: 0, rows: [] };
      if (
        sql.startsWith("SELECT organization_id::text AS organization_id") &&
        sql.includes("workspace_project_enterprise_scopes")
      ) {
        return {
          rowCount: 1,
          rows: [{ organization_id: "org-a", project_owner_user_id: OWNER_ID }],
        };
      }
      if (sql.startsWith("SELECT * FROM workspace_project_participants")) {
        return {
          rowCount: 1,
          rows: [
            participantRow({
              workflow_status: "draft",
              requires_contract: true,
            }),
          ],
        };
      }
      return accessDb.query(sqlValue, params);
    });
    const harness = createRouteHarness({ query });
    const response = createResponse();
    await harness.routes.get(
      "PATCH /api/projects/:projectId/participants/:participantId",
    )!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: { version: 1, requiresContract: false },
      },
      response,
    );
    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe("requirements_manage_denied");
    expect(
      harness.sqlCalls.some(({ sql }) =>
        sql.startsWith("UPDATE workspace_project_participants"),
      ),
    ).toBe(false);
  });

  it("persists an actual requirement change by the project owner", async () => {
    const accessDb = createAccessDb({
      callerId: CALLER_ID,
      ownerId: CALLER_ID,
      boundOrg: "org-a",
      callerRole: "admin",
    });
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (sql.startsWith("INSERT INTO workspace_project_enterprise_scopes"))
        return { rowCount: 0, rows: [] };
      if (
        sql.startsWith("SELECT organization_id::text AS organization_id") &&
        sql.includes("workspace_project_enterprise_scopes")
      ) {
        return {
          rowCount: 1,
          rows: [
            { organization_id: "org-a", project_owner_user_id: CALLER_ID },
          ],
        };
      }
      if (sql.startsWith("SELECT * FROM workspace_project_participants")) {
        return {
          rowCount: 1,
          rows: [
            participantRow({
              workflow_status: "draft",
              requires_contract: true,
            }),
          ],
        };
      }
      if (
        sql.startsWith("SELECT EXISTS (") &&
        sql.includes("workspace_participant_documents")
      ) {
        return {
          rowCount: 1,
          rows: [{ has_documents: false, has_compensation: false }],
        };
      }
      if (sql.startsWith("UPDATE workspace_project_participants"))
        return { rowCount: 1, rows: [{ id: PARTICIPANT_ID }] };
      if (sql.startsWith("INSERT INTO workspace_participant_events"))
        return { rowCount: 1, rows: [] };
      if (sql.startsWith("SELECT participant.*")) {
        return {
          rowCount: 1,
          rows: [
            participantRow({
              workflow_status: "draft",
              requires_contract: false,
              version: 2,
            }),
          ],
        };
      }
      return accessDb.query(sqlValue, params);
    });
    const harness = createRouteHarness({ query });
    const response = createResponse();
    await harness.routes.get(
      "PATCH /api/projects/:projectId/participants/:participantId",
    )!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: { version: 1, requiresContract: false },
      },
      response,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.participant).toMatchObject({
      requiresContract: false,
      version: 2,
    });
    const update = harness.sqlCalls.find(({ sql }) =>
      sql.startsWith("UPDATE workspace_project_participants"),
    );
    expect(update?.sql).toContain("requires_contract = $5");
    expect(update?.params[4]).toBe(false);
  });

  it("preserves approved guardian and work-permit states when isMinor is unchanged", async () => {
    const accessDb = createAccessDb({
      boundOrg: "org-a",
      permissions: { canRead: true, canManageParticipants: true },
    });
    const approvedMinor = participantRow({
      is_minor: true,
      guardian_status: "approved",
      work_permit_status: "approved",
    });
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (sql.startsWith("INSERT INTO workspace_project_enterprise_scopes"))
        return { rowCount: 0, rows: [] };
      if (
        sql.startsWith("SELECT organization_id::text AS organization_id") &&
        sql.includes("workspace_project_enterprise_scopes")
      ) {
        return {
          rowCount: 1,
          rows: [{ organization_id: "org-a", project_owner_user_id: OWNER_ID }],
        };
      }
      if (sql.startsWith("SELECT * FROM workspace_project_participants")) {
        return { rowCount: 1, rows: [approvedMinor] };
      }
      if (sql.startsWith("UPDATE workspace_project_participants")) {
        return { rowCount: 1, rows: [{ id: PARTICIPANT_ID }] };
      }
      if (sql.startsWith("INSERT INTO workspace_participant_events")) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("SELECT participant.*")) {
        return {
          rowCount: 1,
          rows: [
            participantRow({
              is_minor: true,
              guardian_status: "approved",
              work_permit_status: "approved",
              version: 2,
            }),
          ],
        };
      }
      return accessDb.query(sqlValue, params);
    });
    const harness = createRouteHarness({ query });
    const response = createResponse();
    await harness.routes.get(
      "PATCH /api/projects/:projectId/participants/:participantId",
    )!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: { version: 1, isMinor: true },
      },
      response,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.participant).toMatchObject({
      isMinor: true,
      guardianStatus: "approved",
      workPermitStatus: "approved",
    });
    const update = harness.sqlCalls.find(({ sql }) =>
      sql.startsWith("UPDATE workspace_project_participants"),
    );
    expect(update?.sql).not.toContain("guardian_status");
    expect(update?.sql).not.toContain("work_permit_status");
  });

  it("requires and enforces the expected version when archiving", async () => {
    const validationHarness = createRouteHarness({
      query: async () => {
        throw new Error("database must not be reached");
      },
    });
    const validationResponse = createResponse();
    await validationHarness.routes.get(
      "POST /api/projects/:projectId/participants/:participantId/archive",
    )!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: {},
      },
      validationResponse,
    );
    expect(validationResponse.statusCode).toBe(400);
    expect(validationResponse.body.error).toBe("validation_error");
    expect(validationHarness.pool.connect).not.toHaveBeenCalled();

    const accessDb = createAccessDb({
      callerId: CALLER_ID,
      ownerId: CALLER_ID,
      boundOrg: "org-a",
      callerRole: "admin",
    });
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (sql.startsWith("INSERT INTO workspace_project_enterprise_scopes"))
        return { rowCount: 0, rows: [] };
      if (
        sql.startsWith("SELECT organization_id::text AS organization_id") &&
        sql.includes("workspace_project_enterprise_scopes")
      ) {
        return {
          rowCount: 1,
          rows: [
            { organization_id: "org-a", project_owner_user_id: CALLER_ID },
          ],
        };
      }
      if (
        sql.startsWith("SELECT id::text, workflow_status, version, archived_at")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              id: PARTICIPANT_ID,
              workflow_status: "confirmed",
              version: 2,
              archived_at: null,
            },
          ],
        };
      }
      return accessDb.query(sqlValue, params);
    });
    const harness = createRouteHarness({ query });
    const response = createResponse();
    await harness.routes.get(
      "POST /api/projects/:projectId/participants/:participantId/archive",
    )!(
      {
        params: { projectId: PROJECT_ID, participantId: PARTICIPANT_ID },
        body: { version: 1 },
      },
      response,
    );
    expect(response.statusCode).toBe(409);
    expect(response.body).toMatchObject({
      error: "version_conflict",
      details: { currentVersion: 2 },
    });
    const participantLock = harness.sqlCalls.find(({ sql }) =>
      sql.startsWith("SELECT id::text, workflow_status, version, archived_at"),
    );
    expect(participantLock?.sql).toContain("FOR UPDATE");
    expect(participantLock?.params).toEqual([
      "org-a",
      PROJECT_ID,
      PARTICIPANT_ID,
    ]);
    expect(
      harness.sqlCalls.some(({ sql }) =>
        sql.startsWith("UPDATE workspace_project_participants"),
      ),
    ).toBe(false);
  });

  it("derives readiness from the latest non-draft legal document version", async () => {
    const accessDb = createAccessDb({
      callerId: CALLER_ID,
      ownerId: CALLER_ID,
      boundOrg: "org-a",
      callerRole: "admin",
    });
    const histories = [
      {
        name: "old signed + newer withdrawn",
        documents: [
          { version: 1, status: "signed" },
          { version: 2, status: "withdrawn" },
        ],
        ready: false,
      },
      {
        name: "old signed + newer issued",
        documents: [
          { version: 1, status: "signed" },
          { version: 2, status: "issued" },
        ],
        ready: false,
      },
      {
        name: "signed + newer draft",
        documents: [
          { version: 1, status: "signed" },
          { version: 2, status: "draft" },
        ],
        ready: true,
      },
    ];
    const latestNonDraft = (
      documents: Array<{ version: number; status: string }>,
    ) =>
      documents
        .filter((document) => document.status !== "draft")
        .sort((left, right) => right.version - left.version)[0]?.status ?? "";
    const rows = histories.map((history, index) =>
      participantRow({
        id: `11111111-1111-4111-8111-11111111111${index}`,
        display_name: history.name,
        requires_contract: true,
        contract_status: latestNonDraft(history.documents),
      }),
    );
    const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = sqlText(sqlValue);
      if (sql.startsWith("SELECT participant.*"))
        return { rowCount: rows.length, rows };
      return accessDb.query(sqlValue, params);
    });
    const harness = createRouteHarness({ query });
    const response = createResponse();
    await harness.routes.get("GET /api/projects/:projectId/participants")!(
      { params: { projectId: PROJECT_ID }, query: {} },
      response,
    );
    expect(response.statusCode).toBe(200);
    for (const history of histories) {
      const participant = response.body.participants.find(
        (item: any) => item.displayName === history.name,
      );
      expect(participant.readiness.ready).toBe(history.ready);
      expect(participant.readiness.blockers.includes("contract_required")).toBe(
        !history.ready,
      );
    }
    const listSql =
      harness.sqlCalls.find(({ sql }) => sql.startsWith("SELECT participant.*"))
        ?.sql ?? "";
    expect(listSql.match(/document\.status <> 'draft'/g)).toHaveLength(2);
    expect(listSql.match(/ORDER BY document\.version DESC/g)).toHaveLength(2);
    expect(listSql).toContain(
      "latest_contract.terms_snapshot AS contract_terms_snapshot",
    );
    expect(listSql).toContain(
      "latest_contract.content_hash::text AS contract_content_hash",
    );
    expect(listSql).toContain(
      "active_compensation.version AS active_compensation_version",
    );
    expect(listSql).toContain(
      "(latest_signed_contract.id IS NOT NULL) AS contract_signed_evidence",
    );
    expect(listSql).toContain("document.signed_at IS NOT NULL");
    expect(listSql).toContain("compensation.status = 'active'");
  });

  it.each(["hourly", "unpaid"] as const)(
    "makes a %s participant ready only when the signed contract has the exact active binding",
    async (compensationType) => {
      const accessDb = createAccessDb({
        callerId: CALLER_ID,
        ownerId: CALLER_ID,
        boundOrg: "org-a",
        callerRole: "admin",
      });
      const active = compensationSnapshot(compensationType);
      const row = participantRow({
        requires_contract: false,
        ...readinessBindingFields(active),
      });
      const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
        const sql = sqlText(sqlValue);
        if (sql.startsWith("SELECT participant.*"))
          return { rowCount: 1, rows: [row] };
        return accessDb.query(sqlValue, params);
      });
      const harness = createRouteHarness({ query });
      const response = createResponse();
      await harness.routes.get("GET /api/projects/:projectId/participants")!(
        { params: { projectId: PROJECT_ID }, query: {} },
        response,
      );
      expect(response.statusCode).toBe(200);
      expect(response.body.participants[0].readiness).toEqual({
        ready: true,
        blockers: [],
      });
    },
  );

  it("distinguishes a missing signed contract from a stale compensation binding", async () => {
    const accessDb = createAccessDb({
      callerId: CALLER_ID,
      ownerId: CALLER_ID,
      boundOrg: "org-a",
      callerRole: "admin",
    });
    const active = compensationSnapshot("hourly");
    const exactBinding = readinessBindingFields(active);
    const oldCompensation = compensationSnapshot("hourly", {
      id: "44444444-4444-4444-8444-444444444444",
      version: 1,
    });
    const wrongPublicHash = compensationSnapshot("hourly", {
      publicTermsHash: "a".repeat(64),
    });
    const cases = [
      {
        name: "missing signed contract",
        row: participantRow({
          requires_contract: false,
          ...exactBinding,
          contract_status: "issued",
          contract_signed_evidence: false,
          contract_terms_snapshot: null,
          contract_content_hash: null,
          signed_contract_terms_snapshot: null,
          signed_contract_content_hash: null,
        }),
        expectedBlocker: "contract_required",
      },
      {
        name: "missing compensation snapshot",
        row: participantRow({
          requires_contract: false,
          ...readinessBindingFields(active, null),
        }),
        expectedBlocker: "contract_compensation_stale",
      },
      {
        name: "old compensation version",
        row: participantRow({
          requires_contract: false,
          ...readinessBindingFields(active, oldCompensation),
          contract_status: "superseded",
        }),
        expectedBlocker: "contract_compensation_stale",
      },
      {
        name: "invalid public terms hash",
        row: participantRow({
          requires_contract: false,
          ...readinessBindingFields(active, wrongPublicHash),
        }),
        expectedBlocker: "contract_compensation_stale",
      },
      {
        name: "missing active compensation",
        row: participantRow({
          requires_contract: false,
          ...exactBinding,
          compensation_active: false,
        }),
        expectedBlocker: "compensation_required",
      },
    ];

    for (const testCase of cases) {
      const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
        const sql = sqlText(sqlValue);
        if (sql.startsWith("SELECT participant.*"))
          return { rowCount: 1, rows: [testCase.row] };
        return accessDb.query(sqlValue, params);
      });
      const harness = createRouteHarness({ query });
      const response = createResponse();
      await harness.routes.get("GET /api/projects/:projectId/participants")!(
        { params: { projectId: PROJECT_ID }, query: {} },
        response,
      );
      const readiness = response.body.participants[0].readiness;
      expect(readiness.ready, testCase.name).toBe(false);
      expect(readiness.blockers, testCase.name).toContain(
        testCase.expectedBlocker,
      );
      expect(
        readiness.blockers.includes("contract_required"),
        testCase.name,
      ).toBe(testCase.expectedBlocker === "contract_required");
      expect(
        readiness.blockers.includes("contract_compensation_stale"),
        testCase.name,
      ).toBe(testCase.expectedBlocker === "contract_compensation_stale");
    }
  });
});

describe("Workspace participant migration boundary", () => {
  it("contains standalone tenant/document/payment integrity and no cross-product table references", () => {
    const migrationPath = fileURLToPath(
      new URL(
        "../migrations/0467_workspace_project_participants.sql",
        import.meta.url,
      ),
    );
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("workspace_project_enterprise_scopes");
    expect(sql).toContain(
      "REFERENCES public.projects (id, user_id)\n    ON DELETE RESTRICT",
    );
    expect(sql).toContain(
      "FOREIGN KEY (organization_id, project_id, participant_id, document_id)",
    );
    expect(sql).toContain(
      "FOREIGN KEY (organization_id, project_id, participant_id, document_type, supersedes_document_id)",
    );
    expect(sql).toContain(
      "FOREIGN KEY (split_sheet_id, project_id, project_owner_user_id)",
    );
    expect(sql).toContain("workspace_participant_compensation_exact_terms");
    expect(sql).toContain("workspace_participant_compensation_currency");
    expect(sql).toContain(
      "ux_workspace_project_participants_external_reference",
    );
    expect(sql).toContain("workspace_participant_archive_required");
    expect(sql).toContain("workspace_enterprise_scope_immutable");
    expect(sql).toContain("workspace_participant_documents_draft_timestamps");
    expect(sql).toContain(
      "workspace_participant_documents_signed_at_consistency",
    );
    expect(sql).toContain(
      "workspace_participant_documents_withdrawn_at_consistency",
    );
    expect(sql).toContain(
      "OLD.document_type IN ('media_consent', 'guardian_consent')",
    );
    expect(sql).toContain("OLD.status IN ('signed', 'declined')");
    expect(sql).toContain("OR OLD.token_issued_at IS NOT NULL");
    expect(sql).toContain("OR OLD.token_revoked_at IS NOT NULL");
    expect(sql).toContain("token_expires_at > token_issued_at");
    expect(sql).toContain("signing_token_hash IS NULL");
    expect(sql).toContain(
      "workspace_participant_document_signers_active_token_hash",
    );
    expect(sql).toContain("WITH inserted_feature_policies AS");
    expect(sql).toContain("ARRAY['workspace-project-participants']::TEXT[]");
    expect(sql).toContain(
      "'all',\n         ARRAY['admin', 'member', 'viewer']::TEXT[]",
    );
    expect(sql).toContain("workspace-project-participants");
    expect(sql).not.toMatch(/casting_|talent_|role_room/i);
  });
});
