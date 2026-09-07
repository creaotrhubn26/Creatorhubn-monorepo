import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  Express,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadProject: vi.fn(),
  loadLead: vi.fn(),
  runScout: vi.fn(),
  evaluateRules: vi.fn(),
}));

vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: () =>
    (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock("./leadgrid-project-access.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-project-access.js")>();
  return { ...actual, loadAccessibleLeadgridProject: mocks.loadProject };
});
vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: mocks.loadLead,
}));
vi.mock("./lead-scout-service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lead-scout-service.js")>();
  return { ...actual, runScoutForLead: mocks.runScout };
});
vi.mock("./lead-rules-engine.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lead-rules-engine.js")>();
  return { ...actual, evaluateRulesForLead: mocks.evaluateRules };
});

import { registerLeadRulesRoutes } from "./lead-rules-routes.js";
import { registerLeadScoutRoutes } from "./lead-scout-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";
const leadId = "22222222-2222-4222-8222-222222222222";
const otherLeadId = "33333333-3333-4333-8333-333333333333";
const ruleId = "44444444-4444-4444-8444-444444444444";
const userId = "leadgrid-user";
const key = "55555555-5555-4555-8555-555555555555";
const project = {
  id: projectId,
  organizationId,
  name: "Dentum Oslo",
  description: null,
  industry: "Tannhelse",
  status: "active",
  createdBy: userId,
  memberRole: "owner",
};

type RegisteredRoute = {
  method: string;
  path: string;
  handler: RequestHandler;
};

function harness(query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })) {
  const routes: RegisteredRoute[] = [];
  const add = (method: string) =>
    (path: string, ...handlers: RequestHandler[]) =>
      routes.push({ method, path, handler: handlers.at(-1)! });
  const app = {
    get: add("GET"),
    post: add("POST"),
    patch: add("PATCH"),
    delete: add("DELETE"),
  } as unknown as Express;
  const pool = { query } as unknown as Pool;
  const activeSessions = new Map([["token", { userId }]]);
  registerLeadScoutRoutes({ app, pool, activeSessions });
  registerLeadRulesRoutes({ app, pool, activeSessions });
  return {
    query,
    route(method: string, path: string): RequestHandler {
      const found = routes.find((route) => route.method === method && route.path === path);
      if (!found) throw new Error(`Missing route ${method} ${path}`);
      return found.handler;
    },
  };
}

function request(input: {
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
} = {}): Request {
  return {
    headers: {
      authorization: "Bearer token",
      ...(input.idempotencyKey
        ? { "idempotency-key": input.idempotencyKey }
        : {}),
    },
    params: input.params ?? {},
    query: input.query ?? {},
    body: input.body ?? {},
  } as unknown as Request;
}

function response() {
  let status = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; return this; },
    setHeader(name: string, value: string) { headers.set(name, value); return this; },
  } as unknown as Response;
  return {
    res,
    get status() { return status; },
    get body() { return body; },
    headers,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadProject.mockResolvedValue(project);
  mocks.loadLead.mockResolvedValue({ id: leadId, organizationId, projectId });
  mocks.runScout.mockResolvedValue({
    scout_run_id: "run-1",
    organization_id: organizationId,
    project_id: projectId,
    needs_count: 1,
    signals_count: 1,
    scores_count: 1,
    composite_score: 80,
    observations: {},
    idempotent_replay: false,
  });
  mocks.evaluateRules.mockResolvedValue({
    customer_id: leadId,
    organization_id: organizationId,
    project_id: projectId,
    evaluation_id: "eval-1",
    rules_checked: 1,
    rules_matched: 1,
    rules_throttled: 0,
    rules_failed: 0,
    actions_executed: 1,
    idempotent_replay: false,
  });
});

describe("Lead Scout project scope", () => {
  it("fails closed before querying when the active project is missing", async () => {
    const app = harness();
    const out = response();
    await app.route("GET", "/api/admin-room/lead-map/leads/:id/needs-overview")(
      request({ params: { id: leadId } }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "project_id_required" });
    expect(app.query).not.toHaveBeenCalled();
  });

  it("hides a lead from another project and never starts Scout", async () => {
    mocks.loadLead.mockResolvedValue({
      id: leadId,
      organizationId,
      projectId: "another-project",
    });
    const app = harness();
    const out = response();
    await app.route("POST", "/api/admin-room/lead-map/leads/:id/scout")(
      request({
        params: { id: leadId },
        body: { project_id: projectId },
        idempotencyKey: key,
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "lead_not_found" });
    expect(mocks.runScout).not.toHaveBeenCalled();
  });

  it("passes the authoritative tuple and stable key to Scout", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: leadId,
        name: "Dentum klinikk",
        website_url: "https://dentum.no",
        lead_category: "Tannhelse",
      }],
      rowCount: 1,
    });
    const app = harness(query);
    const out = response();
    await app.route("POST", "/api/admin-room/lead-map/leads/:id/scout")(
      request({
        params: { id: leadId },
        body: { project_id: projectId },
        idempotencyKey: key,
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(201);
    expect(mocks.runScout).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId: leadId,
        organizationId,
        projectId,
        idempotencyKey: key,
      }),
    );
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("organization_id = $2::uuid");
    expect(sql).toContain("project_id = $3");
    expect(values).toEqual([leadId, organizationId, projectId]);
  });

  it("validates the full bulk set before any Scout side effect", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: leadId,
        name: "One",
        website_url: "https://one.example",
        lead_category: null,
      }],
      rowCount: 1,
    });
    const app = harness(query);
    const out = response();
    await app.route("POST", "/api/admin-room/lead-map/leads/scout-bulk")(
      request({
        body: { project_id: projectId, lead_ids: [leadId, otherLeadId] },
        idempotencyKey: key,
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
    expect(mocks.runScout).not.toHaveBeenCalled();
  });

  it("rejects malformed or duplicate bulk IDs before querying or rate limiting", async () => {
    const app = harness();
    const out = response();
    await app.route("POST", "/api/admin-room/lead-map/leads/scout-bulk")(
      request({
        body: { project_id: projectId, lead_ids: [leadId, leadId] },
        idempotencyKey: key,
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({
      error: "lead_ids_must_contain_1_to_10_unique_ids",
    });
    expect(app.query).not.toHaveBeenCalled();
    expect(mocks.runScout).not.toHaveBeenCalled();
  });

  it("validates every persisted website before claiming the bulk batch", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        id: leadId,
        name: "One",
        website_url: "file:///etc/passwd",
        lead_category: null,
      }],
      rowCount: 1,
    });
    const app = harness(query);
    const out = response();
    await app.route("POST", "/api/admin-room/lead-map/leads/scout-bulk")(
      request({
        body: { project_id: projectId, lead_ids: [leadId] },
        idempotencyKey: key,
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "lead_has_invalid_website_url" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(mocks.runScout).not.toHaveBeenCalled();
  });
});

describe("Lead automation rule project scope", () => {
  it("lists only the selected project tuple and ignores a supplied organization", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const app = harness(query);
    const out = response();
    await app.route("GET", "/api/admin-room/lead-map/rules")(
      request({ query: { projectId, organization_id: "foreign-org" } }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(200);
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("organization_id=$1::uuid AND project_id=$2");
    expect(values).toEqual([organizationId, projectId]);
    expect(values).not.toContain("foreign-org");
  });

  it("requires an idempotency key before creating a rule", async () => {
    const app = harness();
    const out = response();
    await app.route("POST", "/api/admin-room/lead-map/rules")(
      request({
        body: {
          project_id: projectId,
          name: "Rule",
          condition: { field: "lead_status", op: "eq", value: "new" },
          actions: [{ type: "set_priority", params: { level: "high" } }],
        },
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "idempotency_key_required" });
  });

  it("rejects unknown triggers before persistence", async () => {
    const app = harness();
    const out = response();
    await app.route("POST", "/api/admin-room/lead-map/rules")(
      request({
        body: {
          project_id: projectId,
          name: "Unsafe rule",
          trigger_on: ["lead_update", "foreign_event"],
          condition: { field: "lead_status", op: "eq", value: "new" },
          actions: [{ type: "set_priority", params: { level: "high" } }],
        },
        idempotencyKey: key,
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "invalid_trigger_on" });
    expect(app.query).not.toHaveBeenCalled();
  });

  it("rejects unknown actions before persistence", async () => {
    const app = harness();
    const out = response();
    await app.route("POST", "/api/admin-room/lead-map/rules")(
      request({
        body: {
          project_id: projectId,
          name: "Unsafe action",
          trigger_on: ["lead_update"],
          condition: { field: "lead_status", op: "eq", value: "new" },
          actions: [{ type: "shell_command", params: {} }],
        },
        idempotencyKey: key,
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: "invalid_actions" });
    expect(app.query).not.toHaveBeenCalled();
  });

  it("hides malformed rule IDs as 404 without sending them to PostgreSQL", async () => {
    const app = harness();
    const out = response();
    await app.route("DELETE", "/api/admin-room/lead-map/rules/:id")(
      request({ params: { id: "not-a-uuid" }, body: { project_id: projectId } }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "rule_not_found" });
    expect(app.query).not.toHaveBeenCalled();
  });

  it("evaluates only an authorized lead with the authoritative tuple", async () => {
    const app = harness();
    const out = response();
    await app.route("POST", "/api/admin-room/lead-map/leads/:id/evaluate-rules")(
      request({
        params: { id: leadId },
        body: { project_id: projectId, event: "lead_update" },
        idempotencyKey: key,
      }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(201);
    expect(mocks.evaluateRules).toHaveBeenCalledWith(
      expect.anything(),
      {
        customerId: leadId,
        organizationId,
        projectId,
        event: "lead_update",
        idempotencyKey: key,
      },
    );
  });

  it("does not reveal a foreign rule through run history", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const app = harness(query);
    const out = response();
    await app.route("GET", "/api/admin-room/lead-map/rules/:id/runs")(
      request({ params: { id: ruleId }, query: { projectId } }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "rule_not_found" });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("migration 0544 contract", () => {
  const migration = readFileSync(
    fileURLToPath(new URL(
      "../migrations/0544_leadgrid_scout_rules_project_scope.sql",
      import.meta.url,
    )),
    "utf8",
  );

  it("enforces customer fact tuples and exactly-once project evaluations", () => {
    expect(migration).toContain("enforce_leadgrid_customer_fact_scope");
    expect(migration).toContain("leadgrid_scout_batches");
    expect(migration).toContain("lead_automation_evaluations");
    expect(migration).toContain("lead_automation_scheduled_jobs");
    expect(migration).toContain("lease_token UUID");
    expect(migration).toContain(
      "UNIQUE (organization_id, project_id, customer_id, trigger_event, schedule_bucket)",
    );
    expect(migration).toContain("FOREIGN KEY (organization_id, project_id, customer_id)");
    expect(migration).toContain("UNIQUE (organization_id, project_id, idempotency_key_hash)");
    expect(migration).toContain("lead_automation_rules_active_project_check");
  });
});
