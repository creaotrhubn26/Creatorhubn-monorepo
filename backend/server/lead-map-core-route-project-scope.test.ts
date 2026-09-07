import type {
  Express,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  listLeadsInBounds: vi.fn(),
  listRecentActivities: vi.fn(),
  getLeadMapMetrics: vi.fn(),
  getLeadById: vi.fn(),
  generateLeadPitch: vi.fn(),
}));
const sessionMocks = vi.hoisted(() => ({ resolve: vi.fn() }));
const projectMocks = vi.hoisted(() => ({ load: vi.fn() }));
const leadMocks = vi.hoisted(() => ({ load: vi.fn() }));
const organizationMocks = vi.hoisted(() => ({
  requested: vi.fn(),
  resolveAuthorized: vi.fn(),
  resolveLead: vi.fn(),
  sendError: vi.fn(),
}));

vi.mock("./lead-map-service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lead-map-service.js")>();
  return { ...actual, ...serviceMocks };
});
vi.mock("./lead-map-session-helper.js", () => ({
  resolveLeadMapSession: sessionMocks.resolve,
}));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectMocks.load,
}));
vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: leadMocks.load,
}));
vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: vi.fn(() => (
    _req: Request,
    _res: Response,
    next: () => void,
  ) => next()),
}));
vi.mock("./lead-map-org-scope.js", () => ({
  requestedLeadMapOrganizationId: organizationMocks.requested,
  resolveAuthorizedLeadMapOrganization: organizationMocks.resolveAuthorized,
  resolveLeadOrganizationScope: organizationMocks.resolveLead,
  sendLeadMapOrganizationScopeError: organizationMocks.sendError,
}));

import { setupLeadMapRoutes } from "./lead-map-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";
const leadId = "22222222-2222-4222-8222-222222222222";

type RegisteredRoute = {
  method: string;
  path: string;
  handlers: RequestHandler[];
};

function setupHarness() {
  const routes: RegisteredRoute[] = [];
  const register = (method: string) => (
    path: string,
    ...handlers: RequestHandler[]
  ) => routes.push({ method, path, handlers });
  const app = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
  } as unknown as Express;
  const pool = {} as Pool;
  setupLeadMapRoutes({ app, pool, activeSessions: new Map() });

  const handler = (method: string, path: string): RequestHandler => {
    const route = routes.find(
      (candidate) => candidate.method === method && candidate.path === path,
    );
    const selected = route?.handlers.at(-1);
    if (!selected) throw new Error(`Missing route ${method} ${path}`);
    return selected;
  };

  return {
    pool,
    list: handler("GET", "/api/admin-room/lead-map/leads"),
    activities: handler("GET", "/api/admin-room/lead-map/activities"),
    metrics: handler("GET", "/api/admin-room/lead-map/metrics"),
    detail: handler("GET", "/api/admin-room/lead-map/leads/:id"),
    pitch: handler("POST", "/api/admin-room/lead-map/leads/:id/generate-pitch"),
  };
}

function request(options: {
  projectId?: string;
  leadId?: string;
  body?: Record<string, unknown>;
} = {}): Request {
  return {
    body: options.body ?? {},
    params: options.leadId ? { id: options.leadId } : {},
    query: options.projectId ? { projectId: options.projectId } : {},
    headers: {},
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
  sessionMocks.resolve.mockResolvedValue({ userId: "marketer-a" });
  organizationMocks.requested.mockReturnValue(null);
  organizationMocks.sendError.mockReturnValue(false);
  projectMocks.load.mockResolvedValue({
    id: projectId,
    organizationId,
    name: "Dentum",
    description: null,
    industry: "86.230",
    status: "active",
    createdBy: "owner-a",
    memberRole: "marketer",
  });
  leadMocks.load.mockResolvedValue({
    id: leadId,
    organizationId,
    projectId,
  });
  serviceMocks.listLeadsInBounds.mockResolvedValue([]);
  serviceMocks.listRecentActivities.mockResolvedValue([]);
  serviceMocks.getLeadMapMetrics.mockResolvedValue({ totalLeads: 0 });
  serviceMocks.getLeadById.mockResolvedValue({ id: leadId });
  serviceMocks.generateLeadPitch.mockResolvedValue({ summary: "ok" });
});

describe("Lead Map core project isolation", () => {
  it.each([
    ["leads", "list"],
    ["activities", "activities"],
    ["metrics", "metrics"],
  ] as const)("requires an explicit project for %s", async (_name, key) => {
    const harness = setupHarness();
    const result = responseHarness();

    await harness[key](request(), result.response, vi.fn());

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({ error: "project_id_required" });
    expect(projectMocks.load).not.toHaveBeenCalled();
  });

  it("derives list, activity and metric scope from the accessible project", async () => {
    const harness = setupHarness();
    for (const handler of [harness.list, harness.activities, harness.metrics]) {
      await handler(request({ projectId }), responseHarness().response, vi.fn());
    }

    expect(projectMocks.load).toHaveBeenCalledTimes(3);
    expect(serviceMocks.listLeadsInBounds).toHaveBeenCalledWith(
      harness.pool,
      expect.objectContaining({ organizationId, projectId }),
    );
    expect(serviceMocks.listRecentActivities).toHaveBeenCalledWith(
      harness.pool,
      expect.objectContaining({ organizationId, projectId }),
      30,
    );
    expect(serviceMocks.getLeadMapMetrics).toHaveBeenCalledWith(
      harness.pool,
      expect.objectContaining({ organizationId, projectId }),
    );
  });

  it("hides a lead after project access is revoked", async () => {
    const harness = setupHarness();
    const result = responseHarness();
    leadMocks.load.mockResolvedValue(null);

    await harness.detail(
      request({ leadId }),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(404);
    expect(serviceMocks.getLeadById).not.toHaveBeenCalled();
  });

  it("passes the persisted lead tuple to pitch generation", async () => {
    const harness = setupHarness();
    const result = responseHarness();

    await harness.pitch(
      request({ leadId, body: { serviceFocus: "Dentum pilot" } }),
      result.response,
      vi.fn(),
    );

    expect(serviceMocks.generateLeadPitch).toHaveBeenCalledWith(
      harness.pool,
      expect.objectContaining({
        organizationId,
        projectId,
        leadId,
        serviceFocus: "Dentum pilot",
      }),
    );
    expect(result.status()).toBe(200);
  });
});
