import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadLead: vi.fn(),
  loadProject: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: mocks.loadLead,
}));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadProject,
}));
vi.mock("./lead-assignment-notification-service.js", () => ({
  notifyAssignment: mocks.notify,
}));

import { registerLeadAssignmentRoutes } from "./lead-assignment-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";
const callerId = "caller-a";
const repId = "rep-a";
const hiddenRepId = "rep-hidden";

const project = {
  id: projectId,
  organizationId,
  name: "Dentum Oslo",
  description: null,
  industry: null,
  status: "active",
  createdBy: callerId,
  memberRole: "owner",
};
const lead = { id: leadId, organizationId, projectId };

function setup(input?: {
  query?: ReturnType<typeof vi.fn>;
  clientQuery?: ReturnType<typeof vi.fn>;
}) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(`GET ${path}`, handlers.at(-1)!);
    },
    post(path: string, ...handlers: RequestHandler[]) {
      routes.set(`POST ${path}`, handlers.at(-1)!);
    },
    put(path: string, ...handlers: RequestHandler[]) {
      routes.set(`PUT ${path}`, handlers.at(-1)!);
    },
  } as unknown as Express;
  const query = input?.query ?? vi.fn().mockResolvedValue({ rows: [] });
  const clientQuery = input?.clientQuery ?? vi.fn().mockResolvedValue({
    rows: [],
    rowCount: 1,
  });
  const client = {
    query: clientQuery,
    release: vi.fn(),
  } as unknown as PoolClient;
  const pool = {
    query,
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool;
  registerLeadAssignmentRoutes({
    app,
    pool,
    activeSessions: new Map([["token", { userId: callerId }]]),
  });
  return { routes, pool, query, client, clientQuery };
}

function request(input: {
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  organizationHeader?: string;
} = {}): Request {
  return {
    headers: {
      authorization: "Bearer token",
      ...(input.organizationHeader
        ? { "x-leadgrid-organization-id": input.organizationHeader }
        : {}),
    },
    params: input.params ?? {},
    query: input.query ?? {},
    body: input.body ?? {},
    get(name: string) {
      return name.toLowerCase() === "x-leadgrid-organization-id"
        ? input.organizationHeader
        : undefined;
    },
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

function roleQuery(
  roles: Record<string, string | null>,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes("SELECT role FROM users")) {
      return { rows: [{ role: null }] };
    }
    if (sql.includes("FROM organization_members")) {
      const role = roles[String(params[0])] ?? null;
      return { rows: role ? [{ role }] : [] };
    }
    return { rows: [] };
  });
}

describe("Leadgrid assignment project ACL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadLead.mockResolvedValue(lead);
    mocks.loadProject.mockImplementation(
      async (_pool: Pool, requestedProjectId: string, userId: string) =>
        requestedProjectId === projectId &&
        [callerId, repId].includes(userId)
          ? project
          : null,
    );
    mocks.notify.mockResolvedValue(undefined);
  });

  it("requires an accessible lead or project before listing users", async () => {
    const { routes, query } = setup();
    const missing = response();
    await routes.get("GET /api/leadgrid/assignable-users")!(
      request({ query: { role: "rep" } }),
      missing.res,
      vi.fn(),
    );
    expect(missing.status).toBe(400);

    mocks.loadLead.mockResolvedValueOnce(null);
    const hidden = response();
    await routes.get("GET /api/leadgrid/assignable-users")!(
      request({ query: { role: "rep", leadId } }),
      hidden.res,
      vi.fn(),
    );
    expect(hidden.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it("filters candidates by the same project and project-scopes workload", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          user_id: repId,
          role: "salgskonsulent",
          first_name: "Synlig",
          last_name: "Selger",
          active_leads: "2",
          team_leader_leads: "0",
        },
        {
          user_id: hiddenRepId,
          role: "salgskonsulent",
          first_name: "Skjult",
          last_name: "Selger",
          active_leads: "9",
          team_leader_leads: "0",
        },
      ],
    });
    const { routes } = setup({ query });
    const out = response();

    await routes.get("GET /api/leadgrid/assignable-users")!(
      request({ query: { role: "rep", leadId } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({
      users: [{ user_id: repId, active_leads: 2 }],
    });
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("c.organization_id = $1::uuid");
    expect(String(sql)).toContain("c.project_id = $3");
    expect(params).toEqual([
      organizationId,
      ["salgskonsulent", "promotor"],
      projectId,
    ]);
  });

  it("accepts an accessible project selector for project-level recipient pickers", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const { routes } = setup({ query });
    const out = response();

    await routes.get("GET /api/leadgrid/assignable-users")!(
      request({ query: { role: "all", projectId } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(mocks.loadLead).not.toHaveBeenCalled();
    expect(mocks.loadProject).toHaveBeenCalledWith(
      expect.anything(),
      projectId,
      callerId,
    );
  });

  it("rejects conflicting lead and project selectors", async () => {
    const { routes, query } = setup();
    const out = response();

    await routes.get("GET /api/leadgrid/assignable-users")!(
      request({
        query: {
          role: "rep",
          leadId,
          projectId: "another-project",
        },
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it("returns an indistinguishable 404 for a revoked lead assignment", async () => {
    mocks.loadLead.mockResolvedValueOnce(null);
    const { routes, pool, query } = setup();
    const out = response();

    await routes.get("POST /api/leadgrid/customers/:id/assign-rep")!(
      request({ params: { id: leadId }, body: { rep_user_id: repId } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("rejects a representative who cannot access the same project", async () => {
    const query = roleQuery({ [callerId]: "salgssjef" });
    const { routes, pool } = setup({ query });
    const out = response();

    await routes.get("POST /api/leadgrid/customers/:id/assign-rep")!(
      request({
        params: { id: leadId },
        body: { rep_user_id: hiddenRepId },
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("locks and mutates an assignment by the persisted tuple, then notifies after commit", async () => {
    const events: string[] = [];
    const query = roleQuery({
      [callerId]: "salgssjef",
      [repId]: "salgskonsulent",
    });
    const clientQuery = vi.fn(async (sql: string) => {
      if (sql === "BEGIN") return { rows: [], rowCount: null };
      if (sql.includes("FOR UPDATE")) {
        return {
          rows: [{
            assigned_user_id: "previous-rep",
            name: "Dentumklinikk",
            lead_category: "hot",
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith("UPDATE crm_customers")) {
        events.push("update");
        return { rows: [{ id: leadId }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO lead_assignment_log")) {
        events.push("audit");
        return { rows: [], rowCount: 1 };
      }
      if (sql === "COMMIT") {
        events.push("commit");
        return { rows: [], rowCount: null };
      }
      return { rows: [], rowCount: null };
    });
    mocks.notify.mockImplementation(async () => {
      events.push("notify");
    });
    const { routes } = setup({ query, clientQuery });
    const out = response();

    await routes.get("POST /api/leadgrid/customers/:id/assign-rep")!(
      request({
        params: { id: leadId },
        body: { rep_user_id: repId, note: "Ring mandag" },
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    const locked = clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("FOR UPDATE"),
    );
    const updated = clientQuery.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE crm_customers"),
    );
    expect(locked?.[1]).toEqual([leadId, organizationId, projectId]);
    expect(String(updated?.[0])).toContain("organization_id = $2::uuid");
    expect(String(updated?.[0])).toContain("project_id = $3");
    expect(updated?.[1]).toEqual([
      leadId,
      organizationId,
      projectId,
      repId,
      callerId,
      "Ring mandag",
    ]);
    expect(events).toEqual(["update", "audit", "commit", "notify"]);
  });

  it("unassigns both levels atomically and records null audit targets", async () => {
    const query = roleQuery({ [callerId]: "salgssjef" });
    const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FOR UPDATE")) {
        return {
          rows: [{
            assigned_user_id: repId,
            assigned_team_leader_id: "leader-a",
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith("UPDATE crm_customers")) {
        return { rows: [{ id: leadId }], rowCount: 1 };
      }
      return { rows: [], rowCount: sql.includes("INSERT") ? 1 : null };
    });
    const { routes } = setup({ query, clientQuery });
    const out = response();

    await routes.get("POST /api/leadgrid/customers/:id/unassign")!(
      request({ params: { id: leadId }, body: { unassign_type: "all" } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    const update = clientQuery.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE crm_customers"),
    );
    expect(update?.[1]).toEqual([
      leadId,
      organizationId,
      projectId,
      "all",
      callerId,
    ]);
    const logs = clientQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO lead_assignment_log"),
    );
    expect(logs).toHaveLength(2);
    expect(logs.every(([, params]) => params[3] === null)).toBe(true);
    expect(clientQuery.mock.calls.map(([sql]) => sql)).toContain("COMMIT");
  });

  it("rolls back the unassignment when its audit row cannot be persisted", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const query = roleQuery({ [callerId]: "salgssjef" });
    const statements: string[] = [];
    const clientQuery = vi.fn(async (sql: string) => {
      statements.push(sql);
      if (sql.includes("FOR UPDATE")) {
        return {
          rows: [{
            assigned_user_id: repId,
            assigned_team_leader_id: null,
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith("UPDATE crm_customers")) {
        return { rows: [{ id: leadId }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO lead_assignment_log")) {
        throw new Error("audit unavailable");
      }
      return { rows: [], rowCount: null };
    });
    const { routes } = setup({ query, clientQuery });
    const out = response();

    await routes.get("POST /api/leadgrid/customers/:id/unassign")!(
      request({ params: { id: leadId }, body: { unassign_type: "rep" } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(500);
    expect(statements).toContain("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
  });

  it("filters my assignments to projects that remain visible after revoke", async () => {
    const hiddenProjectId = "dentum-hidden";
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ project_id: projectId }, { project_id: hiddenProjectId }],
      })
      .mockResolvedValueOnce({ rows: [{ id: leadId, project_id: projectId }] });
    const { routes } = setup({ query });
    const out = response();

    await routes.get("GET /api/leadgrid/my-assignments")!(
      request({ query: { organization_id: organizationId } }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1]).toEqual([
      callerId,
      organizationId,
      [projectId],
    ]);
    expect(String(query.mock.calls[1][0])).toContain(
      "c.project_id = ANY($3::text[])",
    );
  });

  it.each([
    ["assignment-history", "history"],
    ["assignment-status", "status"],
  ])("binds %s reads to lead, organization and project", async (suffix) => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const { routes } = setup({ query });
    const out = response();

    await routes.get(`GET /api/leadgrid/customers/:id/${suffix}`)!(
      request({
        params: { id: leadId },
        organizationHeader: "99999999-9999-4999-8999-999999999999",
      }),
      out.res,
      vi.fn(),
    );

    const [sql, params] = query.mock.calls.at(-1)!;
    expect(String(sql)).toContain("c.organization_id = $2::uuid");
    expect(String(sql)).toContain("c.project_id = $3");
    expect(params).toEqual([leadId, organizationId, projectId]);
  });

  it("derives mark-seen scope from the persisted lead and ignores request org", async () => {
    const spoofedOrg = "99999999-9999-4999-8999-999999999999";
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT role FROM users")) return { rows: [{ role: null }] };
      if (sql.includes("FROM organization_members")) {
        return { rows: [{ role: "salgskonsulent" }] };
      }
      if (sql.includes("SELECT assigned_team_leader_id")) {
        return {
          rows: [{
            assigned_team_leader_id: null,
            assigned_user_id: callerId,
          }],
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const { routes } = setup({ query });
    const out = response();

    await routes.get("POST /api/leadgrid/customers/:id/mark-seen")!(
      request({
        params: { id: leadId },
        organizationHeader: spoofedOrg,
      }),
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    const customerQueries = query.mock.calls.filter(([sql]) =>
      String(sql).includes("crm_customers"),
    );
    expect(customerQueries).toHaveLength(3);
    expect(customerQueries[0][1]).toEqual([leadId, organizationId, projectId]);
    expect(customerQueries[1][1]).toEqual([
      leadId,
      organizationId,
      projectId,
      callerId,
    ]);
    expect(customerQueries[2][1].slice(0, 3)).toEqual([
      leadId,
      organizationId,
      projectId,
    ]);
    expect(JSON.stringify(customerQueries)).not.toContain(spoofedOrg);
  });
});
