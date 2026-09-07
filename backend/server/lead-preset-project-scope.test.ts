import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool, PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const accessMocks = vi.hoisted(() => ({
  loadProject: vi.fn(),
}));
const organizationMocks = vi.hoisted(() => ({
  resolve: vi.fn(),
}));
const serviceMocks = vi.hoisted(() => ({
  createLead: vi.fn(),
}));
const rbacMocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));

vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: rbacMocks.requirePermission,
}));

vi.mock("./leadgrid-project-access.js", () => ({
  getLeadgridSession: (
    req: Request,
    sessions: Map<string, { userId: string }>,
  ) => {
    const auth = req.headers.authorization;
    return auth?.startsWith("Bearer ")
      ? (sessions.get(auth.slice(7)) ?? null)
      : null;
  },
  loadAccessibleLeadgridProject: accessMocks.loadProject,
}));

vi.mock("./leadgrid-org-resolver.js", () => ({
  resolveOrgIdForUser: organizationMocks.resolve,
}));

vi.mock("./lead-map-service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lead-map-service.js")>();
  return {
    ...actual,
    createLeadFromPin: serviceMocks.createLead,
  };
});

import { registerLeadPresetRoutes } from "./lead-preset-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const foreignOrganizationId = "99999999-9999-4999-8999-999999999999";
const presetId = "22222222-2222-4222-8222-222222222222";
const customFieldId = "33333333-3333-4333-8333-333333333333";
const leadId = "44444444-4444-4444-8444-444444444444";
const industryId = "55555555-5555-4555-8555-555555555555";
const idempotencyKey = "66666666-6666-4666-8666-666666666666";
const projectId = "dentum-oslo";
const userId = "user-a";

const preset = {
  id: presetId,
  organization_id: organizationId,
  name: "Tannklinikk",
  description: null,
  industry: "Tannhelse",
  category: "Local",
  default_needs: ["needs_seo_local"],
  default_signals: ["premium_location"],
  default_scoring_weights: { industry: 1.2 },
  default_custom_fields: { chain: false, source_quality: "verified" },
  default_tags: ["dentum", "clinic"],
  default_lead_source: "dentum_preset",
  is_active: true,
  is_system: false,
};

type RegisteredRoute = {
  method: string;
  path: string;
  handlers: RequestHandler[];
};

function setup(pool: Pool) {
  const routes: RegisteredRoute[] = [];
  const register =
    (method: string) =>
    (path: string, ...handlers: RequestHandler[]) =>
      routes.push({ method, path, handlers });
  const app = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    delete: register("DELETE"),
  } as unknown as Express;

  registerLeadPresetRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId }]]),
  });

  return {
    route(method: string, path: string): RequestHandler {
      const match = routes.find(
        (candidate) => candidate.method === method && candidate.path === path,
      );
      const handler = match?.handlers.at(-1);
      if (!handler) throw new Error(`missing route ${method} ${path}`);
      return handler;
    },
  };
}

function request(
  input: {
    query?: Record<string, unknown>;
    params?: Record<string, string>;
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  } = {},
): Request {
  return {
    headers: { authorization: "Bearer token" },
    query: input.query ?? {},
    params: input.params ?? {},
    body: input.body ?? {},
    get: vi.fn((name: string) =>
      name.toLowerCase() === "idempotency-key"
        ? input.idempotencyKey
        : undefined,
    ),
  } as unknown as Request;
}

function response() {
  let status = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return this;
    },
  } as unknown as Response;
  return {
    res,
    get status() {
      return status;
    },
    get body() {
      return body;
    },
    headers,
  };
}

async function invoke(
  handler: RequestHandler,
  req: Request,
  out: ReturnType<typeof response>,
) {
  await handler(req, out.res, vi.fn());
}

beforeEach(() => {
  vi.clearAllMocks();
  rbacMocks.requirePermission.mockImplementation(
    () => (_req: Request, _res: Response, next: NextFunction) => next(),
  );
  organizationMocks.resolve.mockResolvedValue(organizationId);
  accessMocks.loadProject.mockResolvedValue({
    id: projectId,
    organizationId,
    name: "Dentum Oslo",
  });
  serviceMocks.createLead.mockResolvedValue({
    id: leadId,
    created: true,
    idempotentReplay: false,
  });
});

describe("Leadgrid preset configuration organization scope", () => {
  it("ignores a request-supplied organization and lists only the active workspace", async () => {
    const query = vi.fn(async () => ({ rows: [preset], rowCount: 1 }));
    const harness = setup({ query } as unknown as Pool);
    const out = response();

    await invoke(
      harness.route("GET", "/api/admin-room/lead-map/presets"),
      request({ query: { organization_id: foreignOrganizationId } }),
      out,
    );

    expect(out.status).toBe(200);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("WHERE organization_id = $1::uuid");
    expect(params).toEqual([organizationId]);
    expect(params).not.toContain(foreignOrganizationId);

    const createOut = response();
    await invoke(
      harness.route("POST", "/api/admin-room/lead-map/presets"),
      request({
        body: {
          organization_id: foreignOrganizationId,
          name: "Oslo-klinikker",
        },
      }),
      createOut,
    );
    expect(createOut.status).toBe(201);
    const createParams = query.mock.calls[1]?.[1] as unknown[];
    expect(createParams[0]).toBe(organizationId);
    expect(createParams).not.toContain(foreignOrganizationId);
  });

  it("uses server-derived organization in the permission resolvers", async () => {
    const pool = { query: vi.fn() } as unknown as Pool;
    setup(pool);
    const configCall = rbacMocks.requirePermission.mock.calls.find(
      ([permission]) => permission === "marketing.presets.edit",
    );
    const projectCall = rbacMocks.requirePermission.mock.calls.find(
      ([permission]) => permission === "leads.create",
    );
    const configResolver = configCall?.[1].resolveOrgId;
    const projectResolver = projectCall?.[1].resolveOrgId;

    await expect(
      configResolver(
        request({ body: { organization_id: foreignOrganizationId } }),
        pool,
        userId,
      ),
    ).resolves.toBe(organizationId);
    await expect(
      projectResolver(
        request({
          body: {
            project_id: projectId,
            organization_id: foreignOrganizationId,
          },
        }),
        pool,
        userId,
      ),
    ).resolves.toBe(organizationId);
  });

  it("hides foreign preset and custom-field ids while constraining mutations by org", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const harness = setup({ query } as unknown as Pool);

    const presetOut = response();
    await invoke(
      harness.route("PATCH", "/api/admin-room/lead-map/presets/:id"),
      request({
        params: { id: presetId },
        body: { name: "Changed", organization_id: foreignOrganizationId },
      }),
      presetOut,
    );
    expect(presetOut.status).toBe(404);
    expect(presetOut.body).toEqual({ error: "preset_not_found" });
    const presetMutation = query.mock.calls[0] as [string, unknown[]];
    expect(presetMutation[0]).toContain("organization_id = $3::uuid");
    expect(presetMutation[1]).toEqual(["Changed", presetId, organizationId]);

    const presetDeleteOut = response();
    await invoke(
      harness.route("DELETE", "/api/admin-room/lead-map/presets/:id"),
      request({ params: { id: presetId } }),
      presetDeleteOut,
    );
    expect(presetDeleteOut.status).toBe(404);
    const presetDelete = query.mock.calls[1] as [string, unknown[]];
    expect(presetDelete[0]).toContain("organization_id = $2::uuid");
    expect(presetDelete[1]).toEqual([presetId, organizationId]);

    const fieldPatchOut = response();
    await invoke(
      harness.route("PATCH", "/api/admin-room/lead-map/custom-fields/:id"),
      request({
        params: { id: customFieldId },
        body: { label: "Endret etikett" },
      }),
      fieldPatchOut,
    );
    expect(fieldPatchOut.status).toBe(404);
    const fieldPatch = query.mock.calls[2] as [string, unknown[]];
    expect(fieldPatch[0]).toContain("organization_id = $3::uuid");
    expect(fieldPatch[1]).toEqual([
      "Endret etikett",
      customFieldId,
      organizationId,
    ]);

    const fieldOut = response();
    await invoke(
      harness.route("DELETE", "/api/admin-room/lead-map/custom-fields/:id"),
      request({
        params: { id: customFieldId },
        body: { organization_id: foreignOrganizationId },
      }),
      fieldOut,
    );
    expect(fieldOut.status).toBe(404);
    expect(fieldOut.body).toEqual({ error: "custom_field_not_found" });
    const fieldMutation = query.mock.calls[3] as [string, unknown[]];
    expect(fieldMutation[0]).toContain("organization_id = $2::uuid");
    expect(fieldMutation[1]).toEqual([customFieldId, organizationId]);
  });

  it("rejects custom-field links to presets outside the active organization", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT id::text")) return { rows: [], rowCount: 0 };
      throw new Error(`unexpected query: ${sql}`);
    });
    const harness = setup({ query } as unknown as Pool);
    const out = response();

    await invoke(
      harness.route("POST", "/api/admin-room/lead-map/custom-fields"),
      request({
        body: {
          organization_id: foreignOrganizationId,
          field_key: "clinic_type",
          label: "Klinikktype",
          field_type: "dropdown",
          preset_ids: [presetId],
        },
      }),
      out,
    );

    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "preset_not_found" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([organizationId, [presetId]]);
  });
});

describe("Leadgrid create-with-preset project scope", () => {
  it("requires an explicit accessible Leadgrid project", async () => {
    const pool = { query: vi.fn() } as unknown as Pool;
    const harness = setup(pool);

    const missing = response();
    await invoke(
      harness.route(
        "POST",
        "/api/admin-room/lead-map/leads/create-with-preset",
      ),
      request({ body: { name: "Dentum", latitude: 59.9, longitude: 10.7 } }),
      missing,
    );
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ error: "project_id_required" });

    accessMocks.loadProject.mockResolvedValueOnce(null);
    const revoked = response();
    await invoke(
      harness.route(
        "POST",
        "/api/admin-room/lead-map/leads/create-with-preset",
      ),
      request({
        body: {
          name: "Dentum",
          project_id: projectId,
          latitude: 59.9,
          longitude: 10.7,
        },
      }),
      revoked,
    );
    expect(revoked.status).toBe(404);
    expect(revoked.body).toEqual({ error: "project_not_found" });
    expect(serviceMocks.createLead).not.toHaveBeenCalled();
  });

  it("does not reveal or apply a preset from another organization", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const harness = setup({ query } as unknown as Pool);
    const out = response();

    await invoke(
      harness.route(
        "POST",
        "/api/admin-room/lead-map/leads/create-with-preset",
      ),
      request({
        body: {
          organization_id: foreignOrganizationId,
          project_id: projectId,
          preset_id: presetId,
          name: "Dentum",
          latitude: 59.9,
          longitude: 10.7,
        },
      }),
      out,
    );

    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "preset_not_found" });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("organization_id = $2::uuid");
    expect(params).toEqual([presetId, organizationId]);
    expect(serviceMocks.createLead).not.toHaveBeenCalled();
  });

  it("uses the canonical lead factory and persists preset data by exact tuple", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM lead_parameter_presets")) {
        return { rows: [preset], rowCount: 1 };
      }
      throw new Error(`unexpected pool query: ${sql}`);
    });
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: null };
      }
      if (sql.includes("UPDATE crm_customers")) {
        return { rows: [{ id: leadId }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO crm_customer_needs")) {
        return { rows: [{ id: "need-a" }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO crm_customer_signals")) {
        return { rows: [{ id: "signal-a" }], rowCount: 1 };
      }
      throw new Error(`unexpected client query: ${sql}`);
    });
    const client = {
      query: clientQuery,
      release: vi.fn(),
    } as unknown as PoolClient;
    const pool = {
      query,
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const harness = setup(pool);
    const out = response();

    await invoke(
      harness.route(
        "POST",
        "/api/admin-room/lead-map/leads/create-with-preset",
      ),
      request({
        idempotencyKey,
        body: {
          organization_id: foreignOrganizationId,
          project_id: projectId,
          preset_id: presetId,
          name: "Dentum Klinikk AS",
          company: "Dentum Klinikk AS",
          contact_name: "Ada Tannlege",
          contact_role: "Daglig leder",
          organization_number: "123456789",
          website_url: "https://dentum.example/path",
          email: "hei@dentum.example",
          phone: "999 99 999",
          industry_id: industryId,
          employee_count_estimate: 12,
          annual_revenue_nok_estimate: 18_000_000,
          notes: "Pilotkandidat",
          lead_temperature: "hot",
          lead_status: "interested",
          next_action: "Book pilotmøte",
          next_follow_up_at: "2026-09-12T08:00:00.000Z",
          latitude: 59.91,
          longitude: 10.75,
          address: "Testgata 1",
          postal_code: "0150",
          city: "Oslo",
          location_confidence: "exact",
          tags: ["oslo", "dentum"],
          custom_fields_overrides: { priority: "high", chain: true },
        },
      }),
      out,
    );

    expect(out.status).toBe(201);
    expect(serviceMocks.createLead).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({
        ownerUserId: userId,
        organizationId,
        projectId,
        name: "Dentum Klinikk AS",
        contactName: "Ada Tannlege",
        contactRole: "Daglig leder",
        organizationNumber: "123456789",
        websiteDomainNormalized: "dentum.example",
        industryId,
        employeeCountEstimate: 12,
        annualRevenueNokEstimate: 18_000_000,
        leadTemperature: "hot",
        leadStatus: "interested",
        pipelineStage: "qualified",
        address: "Testgata 1",
        postalCode: "0150",
        city: "Oslo",
        leadSource: "dentum_preset",
        idempotencyKey,
        requestHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );

    const scopedUpdate = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE crm_customers"),
    ) as [string, unknown[]] | undefined;
    expect(scopedUpdate?.[0]).toContain("organization_id = $2::uuid");
    expect(scopedUpdate?.[0]).toContain("project_id = $3");
    expect(scopedUpdate?.[0]).toContain("lead_parameter_preset_id = COALESCE");
    expect(scopedUpdate?.[0]).toMatch(
      /\$5::jsonb \|\| COALESCE\(\s+crm_customers\.custom_fields/,
    );
    expect(scopedUpdate?.[0]).toContain("WITH ORDINALITY");
    expect(scopedUpdate?.[1]?.slice(0, 3)).toEqual([
      leadId,
      organizationId,
      projectId,
    ]);
    expect(scopedUpdate?.[1]?.[3]).toEqual(["dentum", "clinic", "oslo"]);
    expect(JSON.parse(String(scopedUpdate?.[1]?.[4]))).toEqual({
      chain: true,
      source_quality: "verified",
      priority: "high",
    });
    expect(scopedUpdate?.[1]?.[5]).toBe(presetId);
    expect(out.body).toMatchObject({
      lead_id: leadId,
      organization_id: organizationId,
      project_id: projectId,
      preset_used: presetId,
      needs_seeded: 1,
      signals_seeded: 1,
    });
  });
});

describe("Leadgrid preset scope migration", () => {
  it("enforces organization-bound preset references and cleans legacy array links", () => {
    const migration = readFileSync(
      fileURLToPath(
        new URL(
          "../migrations/0542_leadgrid_preset_project_scope.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    expect(migration).toContain("UNIQUE (organization_id, id)");
    expect(migration).toContain(
      "FOREIGN KEY (organization_id, lead_parameter_preset_id)",
    );
    expect(migration).toContain(
      "REFERENCES lead_parameter_presets(organization_id, id)",
    );
    expect(migration).toContain("enforce_lead_custom_field_preset_scope");
    expect(migration).toContain(
      "preset.organization_id = definition.organization_id",
    );
    expect(migration).toContain("idx_crm_customers_org_parameter_preset");
  });
});
