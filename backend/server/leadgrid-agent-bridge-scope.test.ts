import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({
  loadLead: vi.fn(),
  permissions: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: access.loadLead,
}));
vi.mock("./lead-map-permission-routes.js", () => ({
  resolveEffectivePermissions: access.permissions,
}));
vi.mock("./leadgrid-agent-bridge-service.js", () => ({
  generateFullIntelligenceReport: access.generate,
}));

import { registerLeadgridAgentBridgeRoutes } from "./leadgrid-agent-bridge-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

function harness(query = vi.fn()) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, handler: RequestHandler) {
      routes.set(`GET ${path}`, handler);
    },
    post(path: string, handler: RequestHandler) {
      routes.set(`POST ${path}`, handler);
    },
  } as unknown as Express;
  registerLeadgridAgentBridgeRoutes({
    app,
    pool: { query } as unknown as Pool,
    activeSessions: new Map([["token", { userId: "user-a" }]]),
  });
  return { routes, query };
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
  return { res, get status() { return status; }, get body() { return body; } };
}

async function invoke(
  handler: RequestHandler | undefined,
  res: Response,
  method: "GET" | "POST",
  body: Record<string, unknown> = {},
) {
  if (!handler) throw new Error("route_not_registered");
  await handler({
    method,
    headers: { authorization: "Bearer token" },
    params: { id: leadId },
    query: { organization_id: "attacker-controlled" },
    body: { organization_id: "attacker-controlled", ...body },
  } as unknown as Request, res, vi.fn());
}

describe("Leadgrid full-intelligence project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.permissions.mockResolvedValue({
      role: "member",
      permissions: new Set(["leadgrid.research.run"]),
    });
    access.generate.mockResolvedValue({ leadId });
  });

  it("returns an indistinguishable 404 before permission or data access for a hidden lead", async () => {
    access.loadLead.mockResolvedValue(null);
    const { routes, query } = harness();
    const out = response();

    await invoke(
      routes.get("GET /api/leadgrid/leads/:id/full-intelligence"),
      out.res,
      "GET",
    );

    expect(out.status).toBe(404);
    expect(out.body).toEqual({ error: "lead_not_found" });
    expect(access.loadLead).toHaveBeenCalledWith(expect.anything(), {
      leadId,
      userId: "user-a",
    });
    expect(access.permissions).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("binds cached reads to the persisted organization and project tuple", async () => {
    access.loadLead.mockResolvedValue({ id: leadId, organizationId, projectId });
    const query = vi.fn().mockResolvedValue({
      rows: [{ data: { summary: "ok" }, ts: "2026-09-06T10:00:00Z" }],
    });
    const { routes } = harness(query);
    const out = response();

    await invoke(
      routes.get("GET /api/leadgrid/leads/:id/full-intelligence"),
      out.res,
      "GET",
    );

    expect(out.status).toBe(200);
    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("organization_id = $2::uuid");
    expect(String(sql)).toContain("project_id = $3");
    expect(params).toEqual([leadId, organizationId, projectId]);
  });

  it("passes only the persisted tuple into generation even when request scope is spoofed", async () => {
    access.loadLead.mockResolvedValue({ id: leadId, organizationId, projectId });
    const { routes } = harness();
    const out = response();

    await invoke(
      routes.get("POST /api/leadgrid/leads/:id/full-intelligence"),
      out.res,
      "POST",
      { modules: ["website"] },
    );

    expect(access.generate).toHaveBeenCalledWith(
      expect.anything(),
      leadId,
      {
        modules: ["website"],
        callerUserId: "user-a",
        scope: { organizationId, projectId },
      },
    );
  });

  it("does not generate when the caller lacks the research permission", async () => {
    access.loadLead.mockResolvedValue({ id: leadId, organizationId, projectId });
    access.permissions.mockResolvedValue({ role: "viewer", permissions: new Set() });
    const { routes } = harness();
    const out = response();

    await invoke(
      routes.get("POST /api/leadgrid/leads/:id/full-intelligence/refresh"),
      out.res,
      "POST",
    );

    expect(out.status).toBe(403);
    expect(access.generate).not.toHaveBeenCalled();
  });
});
