import { readFileSync } from "node:fs";
import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const projectAccess = vi.hoisted(() => ({ load: vi.fn() }));
const entitlement = vi.hoisted(() => ({ scoped: vi.fn(async () => true) }));

vi.mock("./leadgrid-project-access.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-project-access.js")>();
  return { ...actual, loadAccessibleLeadgridProject: projectAccess.load };
});
vi.mock("./leadgrid-entitlement-guard.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-entitlement-guard.js")>();
  return { ...actual, assertAnyEntitledForOrganization: entitlement.scoped };
});

import { registerLeadgridMotebriefRoutes } from "./leadgrid-motebrief-routes.js";

type Route = { method: string; path: string; handler: RequestHandler };

function harness(query: ReturnType<typeof vi.fn>) {
  const routes: Route[] = [];
  const register = (method: string) => (path: string, handler: RequestHandler) => {
    routes.push({ method, path, handler });
  };
  const app = {
    get: register("GET"),
    post: register("POST"),
    put: register("PUT"),
    patch: register("PATCH"),
  } as unknown as Express;
  registerLeadgridMotebriefRoutes({
    app,
    pool: { query, connect: vi.fn() } as unknown as Pool,
    requireUserSession: vi.fn(async () => ({ userId: "seller-a" })),
  });

  return async function request(
    method: string,
    path: string,
    options: {
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
      params?: Record<string, string>;
    } = {},
  ) {
    const route = routes.find((candidate) => (
      candidate.method === method && candidate.path === path
    ));
    if (!route) throw new Error(`missing route ${method} ${path}`);
    const req = {
      query: options.query ?? {},
      body: options.body ?? {},
      params: options.params ?? {},
      headers: {},
    } as unknown as Request;
    let status = 200;
    let body: unknown;
    const res = {
      status(value: number) { status = value; return this; },
      json(value: unknown) { body = value; return this; },
    } as unknown as Response;
    await route.handler(req, res, vi.fn());
    return { status, body };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  projectAccess.load.mockResolvedValue({
    id: "dentum-oslo",
    organizationId: "11111111-1111-4111-8111-111111111111",
    name: "Dentum – klinikkpilot Oslo",
    description: null,
    industry: "86.230",
    status: "active",
    createdBy: "seller-a",
    memberRole: "owner",
  });
});

describe("Leadgrid meeting-memory project scope", () => {
  it("fails closed before data access when projectId is missing", async () => {
    const query = vi.fn();
    const result = await harness(query)("GET", "/api/leadgrid/oppgaver");

    expect(result).toEqual({ status: 400, body: { error: "project_id_required" } });
    expect(projectAccess.load).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("lists tasks only from the selected project and current user", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const result = await harness(query)("GET", "/api/leadgrid/oppgaver", {
      query: { projectId: "dentum-oslo" },
    });

    expect(result).toEqual({ status: 200, body: { oppgaver: [] } });
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("AND project_id = $2");
    expect(String(sql)).toContain("AND user_id = $3");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "dentum-oslo",
      "seller-a",
      "open",
    ]);
  });

  it("updates a task only inside the authoritative tuple", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const result = await harness(query)("PATCH", "/api/leadgrid/oppgaver/:id", {
      params: { id: "22222222-2222-4222-8222-222222222222" },
      body: { projectId: "dentum-oslo", status: "done" },
    });

    expect(result.status).toBe(200);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("AND organization_id = $4");
    expect(String(sql)).toContain("AND project_id = $5");
    expect(params).toEqual([
      "done",
      "22222222-2222-4222-8222-222222222222",
      "seller-a",
      "11111111-1111-4111-8111-111111111111",
      "dentum-oslo",
    ]);
  });

  it("loads meeting goals with organization, project and customer key", async () => {
    const query = vi.fn(async () => ({
      rows: [{ maal: "Book pilot", behov: ["Flere pasienter"] }],
      rowCount: 1,
    }));
    const result = await harness(query)("GET", "/api/leadgrid/moter/maal", {
      query: { projectId: "dentum-oslo", selskap: "Klinikk A" },
    });

    expect(result.body).toEqual({ maal: "Book pilot", behov: ["Flere pasienter"] });
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("AND project_id = $2");
    expect(String(sql)).toContain("COALESCE($4::text, lower($3))");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "dentum-oslo",
      "Klinikk A",
      null,
    ]);
  });

  it("replays Canvas persistence within the same project before AI work", async () => {
    const saved = { oppsummering: "Lagret", oppgaver: [], lofter: [] };
    const query = vi.fn(async () => ({ rows: [{ resultat: saved }], rowCount: 1 }));
    const result = await harness(query)("POST", "/api/leadgrid/canvas/analyse", {
      body: {
        projectId: "dentum-oslo",
        requestId: "33333333-3333-4333-8333-333333333333",
        ferdigResultat: saved,
      },
    });

    expect(result).toEqual({ status: 200, body: { resultat: saved } });
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("AND project_id = $2");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "dentum-oslo",
      "33333333-3333-4333-8333-333333333333",
    ]);
  });

  it("keeps runtime routes DDL-free and migration-owned", () => {
    const routeSource = readFileSync(
      new URL("./leadgrid-motebrief-routes.ts", import.meta.url),
      "utf8",
    );
    const migration = readFileSync(
      new URL("../migrations/0549_leadgrid_meeting_loop_project_scope.sql", import.meta.url),
      "utf8",
    );
    expect(routeSource).not.toMatch(/CREATE TABLE|ALTER TABLE|CREATE INDEX/i);
    for (const fragment of [
      "uq_mote_logg_project_request",
      "enforce_leadgrid_meeting_project_scope",
      "IF NEW.project_id IS NULL THEN",
      "FOREIGN KEY (project_id) REFERENCES leadgrid_projects(id)",
    ]) expect(migration).toContain(fragment);
    expect(migration).not.toContain("leadgrid_mote_logg_project_required_check");
    expect(migration).not.toContain("leadgrid_oppgaver_project_required_check");
    expect(migration).not.toContain("leadgrid_mote_maal_project_required_check");
    expect(migration).not.toContain("DROP INDEX IF EXISTS uq_mote_logg_request");
    expect(migration).not.toContain("DROP CONSTRAINT IF EXISTS leadgrid_mote_maal_pkey");
  });
});
