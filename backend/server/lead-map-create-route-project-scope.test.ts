import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  createLeadFromPin: vi.fn(),
  findLeadDuplicateCandidates: vi.fn(),
}));
const sessionMocks = vi.hoisted(() => ({ resolve: vi.fn() }));
const projectMocks = vi.hoisted(() => ({ load: vi.fn() }));
const organizationMocks = vi.hoisted(() => ({
  requested: vi.fn(),
  resolveAuthorized: vi.fn(),
  resolveLead: vi.fn(),
  sendError: vi.fn(),
}));

vi.mock("./lead-map-service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lead-map-service.js")>();
  return {
    ...actual,
    createLeadFromPin: serviceMocks.createLeadFromPin,
    findLeadDuplicateCandidates: serviceMocks.findLeadDuplicateCandidates,
  };
});
vi.mock("./lead-map-session-helper.js", () => ({
  resolveLeadMapSession: sessionMocks.resolve,
}));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: projectMocks.load,
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

const projectId = "dentum-project";
const organizationId = "11111111-1111-4111-8111-111111111111";
const idempotencyKey = "22222222-2222-4222-8222-222222222222";

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

  function handler(path: string): RequestHandler {
    const route = routes.find(
      (candidate) => candidate.method === "POST" && candidate.path === path,
    );
    const selected = route?.handlers.at(-1);
    if (!selected) throw new Error(`Missing route ${path}`);
    return selected;
  }

  return {
    pool,
    create: handler("/api/admin-room/lead-map/leads"),
    fromPin: handler("/api/admin-room/lead-map/leads/from-pin"),
    duplicate: handler("/api/admin-room/lead-map/leads/duplicate-check"),
  };
}

function request(body: Record<string, unknown>): Request {
  return {
    body,
    params: {},
    query: {},
    get: vi.fn((name: string) =>
      name.toLowerCase() === "idempotency-key" ? idempotencyKey : undefined),
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
  response.setHeader = vi.fn(() => response);
  return { response, status: () => status, body: () => body };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Dentum-klinikk AS",
    project_id: projectId,
    latitude: 59.91,
    longitude: 10.75,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.resolve.mockResolvedValue({ userId: "seller-a" });
  organizationMocks.requested.mockReturnValue(organizationId);
  organizationMocks.sendError.mockReturnValue(false);
  projectMocks.load.mockResolvedValue({
    id: projectId,
    organizationId,
    name: "Dentum – klinikkpilot Oslo og omegn",
    description: null,
    industry: "86.230",
    status: "active",
    createdBy: "seller-a",
    memberRole: "admin",
  });
  serviceMocks.createLeadFromPin.mockResolvedValue({
    id: "lead-a",
    created: false,
    idempotentReplay: false,
  });
  serviceMocks.findLeadDuplicateCandidates.mockResolvedValue([]);
});

describe("canonical lead creation project and Places provenance", () => {
  it.each([
    "/api/admin-room/lead-map/leads",
    "/api/admin-room/lead-map/leads/from-pin",
    "/api/admin-room/lead-map/leads/duplicate-check",
  ])("requires an explicit customer project for %s", async (path) => {
    const harness = setupHarness();
    const result = responseHarness();
    const selected = path.endsWith("duplicate-check")
      ? harness.duplicate
      : path.endsWith("from-pin")
        ? harness.fromPin
        : harness.create;

    await selected(request(validBody({ project_id: undefined })), result.response, vi.fn());

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({ error: "project_id_required" });
    expect(projectMocks.load).not.toHaveBeenCalled();
  });

  it.each([
    "/api/admin-room/lead-map/leads",
    "/api/admin-room/lead-map/leads/from-pin",
    "/api/admin-room/lead-map/leads/duplicate-check",
  ])("rejects un-attested Place IDs for %s", async (path) => {
    const harness = setupHarness();
    const result = responseHarness();
    const selected = path.endsWith("duplicate-check")
      ? harness.duplicate
      : path.endsWith("from-pin")
        ? harness.fromPin
        : harness.create;

    await selected(
      request(validBody({ google_place_id: "forged-place" })),
      result.response,
      vi.fn(),
    );

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({
      error: "google_place_id_requires_discovery_attestation",
    });
    expect(projectMocks.load).not.toHaveBeenCalled();
  });

  it("uses the accessible project's authoritative organization and id", async () => {
    const { create, pool } = setupHarness();
    const result = responseHarness();

    await create(request(validBody()), result.response, vi.fn());

    expect(projectMocks.load).toHaveBeenCalledWith(pool, projectId, "seller-a");
    expect(serviceMocks.createLeadFromPin).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({
        organizationId,
        projectId,
        googlePlaceId: null,
      }),
    );
    expect(result.status()).toBe(200);
  });

  it("applies the same authoritative project boundary to the legacy from-pin alias", async () => {
    const { fromPin, pool } = setupHarness();
    const result = responseHarness();

    await fromPin(request(validBody()), result.response, vi.fn());

    expect(projectMocks.load).toHaveBeenCalledWith(pool, projectId, "seller-a");
    expect(serviceMocks.createLeadFromPin).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({ organizationId, projectId }),
    );
    expect(result.status()).toBe(200);
  });

  it("fails closed when the selected organization does not own the project", async () => {
    const { create } = setupHarness();
    const result = responseHarness();
    organizationMocks.requested.mockReturnValue(
      "33333333-3333-4333-8333-333333333333",
    );

    await create(request(validBody()), result.response, vi.fn());

    expect(result.status()).toBe(404);
    expect(result.body()).toEqual({ error: "project_not_found" });
    expect(serviceMocks.createLeadFromPin).not.toHaveBeenCalled();
  });

  it("scopes duplicate candidates to the same project", async () => {
    const { duplicate, pool } = setupHarness();
    const result = responseHarness();

    await duplicate(request(validBody()), result.response, vi.fn());

    expect(serviceMocks.findLeadDuplicateCandidates).toHaveBeenCalledWith(
      pool,
      expect.objectContaining({ organizationId, projectId }),
    );
    expect(result.body()).toEqual({ candidates: [] });
  });
});
