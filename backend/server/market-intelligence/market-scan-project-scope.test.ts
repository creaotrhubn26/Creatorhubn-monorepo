import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
  competitors: vi.fn(),
  funnels: vi.fn(),
  techniques: vi.fn(),
  techStack: vi.fn(),
  opportunities: vi.fn(),
}));
const projectMocks = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("./market-scan-service.js", () => ({
  createMarketScan: serviceMocks.create,
  listMarketScans: serviceMocks.list,
  getMarketScan: serviceMocks.get,
  runMarketScan: serviceMocks.run,
  getScanCompetitors: serviceMocks.competitors,
  getScanFunnelStages: serviceMocks.funnels,
  getScanTechniques: serviceMocks.techniques,
  getScanTechStack: serviceMocks.techStack,
  getScanOpportunities: serviceMocks.opportunities,
}));
vi.mock("../leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectMocks.load,
}));

import { registerMarketScanRoutes } from "./market-scan-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";

type RegisteredRoute = {
  method: string;
  path: string;
  handler: RequestHandler;
};

function setupHarness() {
  const routes: RegisteredRoute[] = [];
  const register = (method: string) => (path: string, ...handlers: RequestHandler[]) => {
    const handler = handlers.at(-1);
    if (!handler) throw new Error(`Missing handler for ${method} ${path}`);
    routes.push({ method, path, handler });
  };
  const app = {
    get: register("GET"),
    post: register("POST"),
  } as unknown as Express;
  const pool = {} as Pool;
  registerMarketScanRoutes({
    app,
    pool,
    activeSessions: new Map([
      ["valid-token", { userId: "admin-a", role: "admin", email: "admin@example.no" }],
    ]),
    isAdminEmail: () => false,
  });
  const route = (method: string, path: string) => {
    const found = routes.find((candidate) => (
      candidate.method === method && candidate.path === path
    ));
    if (!found) throw new Error(`Missing route ${method} ${path}`);
    return found.handler;
  };
  return { pool, route };
}

function request(input: {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
} = {}): Request {
  return {
    headers: { authorization: "Bearer valid-token" },
    body: input.body ?? {},
    query: input.query ?? {},
    params: input.params ?? {},
  } as unknown as Request;
}

function responseHarness() {
  let status = 200;
  let body: unknown;
  const response = {} as Response;
  response.status = vi.fn((value: number) => {
    status = value;
    return response;
  });
  response.json = vi.fn((value: unknown) => {
    body = value;
    return response;
  });
  return { response, status: () => status, body: () => body };
}

beforeEach(() => {
  vi.clearAllMocks();
  projectMocks.load.mockResolvedValue({
    id: projectId,
    organizationId,
    name: "Dentum – klinikkpilot Oslo og omegn",
  });
  serviceMocks.create.mockResolvedValue({ id: "scan-a" });
  serviceMocks.list.mockResolvedValue([]);
  serviceMocks.competitors.mockResolvedValue([]);
});

describe("Market Intelligence customer-project scope", () => {
  it("creates a project scan with the project's authoritative organization", async () => {
    const { pool, route } = setupHarness();
    const result = responseHarness();

    await route("POST", "/api/market-scans")(
      request({ body: { name: "Oslo", marketQuery: "tannklinikk", projectId } }),
      result.response,
      vi.fn(),
    );

    expect(projectMocks.load).toHaveBeenCalledWith(pool, projectId, "admin-a");
    expect(serviceMocks.create).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({
        workspaceOwnerUserId: "admin-a",
        organizationId,
        projectId,
      }),
    );
    expect(result.status()).toBe(201);
  });

  it("lists only the selected project and clamps abusive limits", async () => {
    const { pool, route } = setupHarness();
    const result = responseHarness();

    await route("GET", "/api/market-scans")(
      request({ query: { projectId, limit: "99999" } }),
      result.response,
      vi.fn(),
    );

    expect(serviceMocks.list).toHaveBeenCalledWith(pool, {
      workspaceOwnerUserId: "admin-a",
      organizationId,
      projectId,
      limit: 100,
    });
  });

  it("fails closed when a scan's stored organization conflicts with its project", async () => {
    const { route } = setupHarness();
    const result = responseHarness();
    serviceMocks.get.mockResolvedValue({
      id: "scan-a",
      projectId,
      organizationId: "22222222-2222-4222-8222-222222222222",
      workspaceOwnerUserId: "admin-a",
    });

    await route("GET", "/api/market-scans/:id/competitors")(
      request({ params: { id: "scan-a" } }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(404);
    expect(serviceMocks.competitors).not.toHaveBeenCalled();
  });

  it("keeps unscoped legacy scans private to their original owner", async () => {
    const { route } = setupHarness();
    const result = responseHarness();
    serviceMocks.get.mockResolvedValue({
      id: "legacy-scan",
      projectId: null,
      organizationId: null,
      workspaceOwnerUserId: "another-user",
    });

    await route("GET", "/api/market-scans/:id")(
      request({ params: { id: "legacy-scan" } }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(404);
    expect(result.body()).toEqual({ error: "not_found" });
  });
});
