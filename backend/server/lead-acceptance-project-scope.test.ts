import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadProject: vi.fn(),
  triggerResearch: vi.fn(),
}));

vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadProject,
}));
vi.mock("./lead-auto-research-service.js", () => ({
  triggerAutoResearchAsync: mocks.triggerResearch,
}));

import { registerLeadAcceptanceRoutes } from "./lead-acceptance-routes.js";

const callerId = "admin-user";
const organizationId = "11111111-1111-4111-8111-111111111111";
const agencyLeadId = "22222222-2222-4222-8222-222222222222";
const crmLeadId = "33333333-3333-4333-8333-333333333333";
const projectId = "dentum-oslo";

const accessibleProject = {
  id: projectId,
  organizationId,
  name: "Dentum Oslo",
  description: null,
  industry: null,
  status: "active",
  createdBy: callerId,
  memberRole: "owner",
};

const sourceLead = {
  id: agencyLeadId,
  agency_name: "Dentum AS",
  contact_name: "Ada Admin",
  contact_title: "Daglig leder",
  email: "ada@dentum.no",
  phone: "+4712345678",
  org_number: "NO 123 456 789 MVA",
  website: "dentum.no",
  use_case: "Flere klinikker",
  message: "Kontakt meg",
  status: "new",
  brreg_data: {},
  website_scrape_data: {},
  claude_summary: "God match",
  claude_temperature: "hot",
  claude_talking_points: ["Pilot"],
  claude_next_action: "Ring",
  leadgrid_organization_id: null,
  leadgrid_project_id: null,
  leadgrid_customer_id: null,
};

function setup(clientQuery = vi.fn(async (sql: string) => {
  if (sql.includes("FROM agency_leads l")) {
    return { rows: [sourceLead], rowCount: 1 };
  }
  if (sql.includes("INSERT INTO crm_customers")) {
    return { rows: [{ id: crmLeadId }], rowCount: 1 };
  }
  if (sql.startsWith("UPDATE agency_leads")) {
    return { rows: [{ id: agencyLeadId }], rowCount: 1 };
  }
  return { rows: [], rowCount: sql === "BEGIN" || sql === "COMMIT" ? null : 1 };
})) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(`GET ${path}`, handlers.at(-1)!);
    },
    post(path: string, ...handlers: RequestHandler[]) {
      routes.set(`POST ${path}`, handlers.at(-1)!);
    },
  } as unknown as Express;
  const client = {
    query: clientQuery,
    release: vi.fn(),
  } as unknown as PoolClient;
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("SELECT role FROM users")) {
      return { rows: [{ role: "markedssjef" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  const pool = {
    query,
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool;
  registerLeadAcceptanceRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId: callerId, email: "admin@leadgrid.no" }]]),
  });
  return { routes, pool, query, client, clientQuery };
}

function request(body: Record<string, unknown> = {}): Request {
  return {
    headers: { authorization: "Bearer token" },
    params: { id: agencyLeadId },
    query: {},
    body,
  } as unknown as Request;
}

function response() {
  let status = 200;
  let body: unknown;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;
  return {
    res,
    get status() { return status; },
    get body() { return body; },
  };
}

async function promote(
  routes: Map<string, RequestHandler>,
  body: Record<string, unknown>,
) {
  const out = response();
  await routes.get("POST /api/superadmin/leads/:id/accept-as-project")!(
    request(body),
    out.res,
    vi.fn(),
  );
  return out;
}

describe("agency lead to Leadgrid promotion contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadProject.mockResolvedValue(accessibleProject);
  });

  it("requires an explicit accessible project before opening a transaction", async () => {
    const { routes, pool } = setup();
    const missing = await promote(routes, {});
    expect(missing.status).toBe(400);
    expect(missing.body).toMatchObject({ error: "project_id_required" });
    expect(pool.connect).not.toHaveBeenCalled();

    mocks.loadProject.mockResolvedValueOnce(null);
    const hidden = await promote(routes, { projectId });
    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual({ error: "project_not_found" });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("rejects an invalid source id before PostgreSQL casts or writes", async () => {
    const { routes, pool } = setup();
    const out = response();
    await routes.get("POST /api/superadmin/leads/:id/accept-as-project")!(
      { ...request({ projectId }), params: { id: "not-an-agency-uuid" } } as Request,
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(404);
    expect(mocks.loadProject).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("rejects organization spoofing and legacy inline assignment", async () => {
    const { routes, pool } = setup();
    const spoofed = await promote(routes, {
      projectId,
      organizationId: "99999999-9999-4999-8999-999999999999",
    });
    expect(spoofed.status).toBe(404);

    const inline = await promote(routes, {
      projectId,
      assigned_team_leader_id: "team-leader",
    });
    expect(inline.status).toBe(400);
    expect(inline.body).toMatchObject({
      error: "assignment_after_promotion_required",
    });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("persists the CRM lead and source mapping atomically in the selected scope", async () => {
    const { routes, clientQuery } = setup();
    const out = await promote(routes, { projectId });

    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({
      promotion: {
        agencyLeadId,
        crmLeadId,
        organizationId,
        projectId,
        created: true,
      },
      source_lead_id: agencyLeadId,
      customer_id: crmLeadId,
      project_id: projectId,
    });

    const insert = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO crm_customers"),
    );
    expect(String(insert?.[0])).toContain("organization_id, project_id");
    expect(insert?.[1]?.slice(0, 2)).toEqual([organizationId, projectId]);
    expect(insert?.[1]?.at(-2)).toBe(agencyLeadId);

    const mapping = clientQuery.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE agency_leads"),
    );
    expect(String(mapping?.[0])).toContain("leadgrid_organization_id = $2::uuid");
    expect(String(mapping?.[0])).toContain("leadgrid_project_id = $3");
    expect(String(mapping?.[0])).toContain("leadgrid_customer_id = $4::uuid");
    expect(mapping?.[1]).toEqual([
      agencyLeadId,
      organizationId,
      projectId,
      crmLeadId,
    ]);

    const sql = clientQuery.mock.calls.map(([statement]) => String(statement));
    expect(sql).toContain("COMMIT");
    expect(sql.some((statement) => statement.includes("INSERT INTO leadgrid_projects"))).toBe(false);
    expect(sql.some((statement) => statement.includes("client_portal_tokens"))).toBe(false);
    expect(sql.some((statement) => statement.includes("assigned_team_leader_id"))).toBe(false);
  });

  it("returns the persisted CRM identity on a retry without creating a second lead", async () => {
    const mappedLead = {
      ...sourceLead,
      status: "converted",
      leadgrid_organization_id: organizationId,
      leadgrid_project_id: projectId,
      leadgrid_customer_id: crmLeadId,
    };
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM agency_leads l")) {
        return { rows: [mappedLead], rowCount: 1 };
      }
      if (sql.includes("FROM crm_customers")) {
        expect(params).toEqual([crmLeadId, organizationId, projectId]);
        return { rows: [{ id: crmLeadId }], rowCount: 1 };
      }
      return { rows: [], rowCount: null };
    });
    const { routes } = setup(clientQuery);
    const out = await promote(routes, { projectId });

    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({
      promotion: { crmLeadId, projectId, created: false },
      already_promoted: true,
    });
    expect(clientQuery.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO crm_customers"),
    )).toBe(false);
  });

  it("does not move an already promoted source lead into another project", async () => {
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes("FROM agency_leads l")) {
        return {
          rows: [{
            ...sourceLead,
            leadgrid_organization_id: organizationId,
            leadgrid_project_id: "existing-project",
            leadgrid_customer_id: crmLeadId,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: null };
    });
    const { routes } = setup(clientQuery);
    const out = await promote(routes, { projectId });

    expect(out.status).toBe(409);
    expect(out.body).toMatchObject({
      error: "already_promoted_to_another_project",
      project_id: "existing-project",
    });
    expect(clientQuery.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK");
  });

  it("rolls back CRM persistence when the source mapping cannot be audited", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql.includes("FROM agency_leads l")) {
        return { rows: [sourceLead], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO crm_customers")) {
        return { rows: [{ id: crmLeadId }], rowCount: 1 };
      }
      if (sql.startsWith("UPDATE agency_leads")) {
        return { rows: [{ id: agencyLeadId }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO agency_lead_events")) {
        throw new Error("audit unavailable");
      }
      return { rows: [], rowCount: null };
    });
    const { routes } = setup(clientQuery);
    const out = await promote(routes, { projectId });

    expect(out.status).toBe(500);
    const statements = clientQuery.mock.calls.map(([sql]) => sql);
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });
});
