import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const leadAccess = vi.hoisted(() => ({ load: vi.fn() }));
const projectAccess = vi.hoisted(() => ({ load: vi.fn() }));
const collaboration = vi.hoisted(() => ({
  listLeadNotes: vi.fn(),
  createLeadNote: vi.fn(),
  setLeadFavorite: vi.fn(),
}));
const logoFetcher = vi.hoisted(() => ({ fetchBestLogo: vi.fn() }));

vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: leadAccess.load,
}));
vi.mock("./leadgrid-project-access.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./leadgrid-project-access.js")>();
  return { ...actual, loadAccessibleLeadgridProject: projectAccess.load };
});
vi.mock("./lead-map-collaboration-service.js", () => collaboration);
vi.mock("./lead-logo-fetcher.js", () => logoFetcher);
vi.mock("./lead-map-rbac-helper.js", () => ({
  requireLeadMapPermission: vi.fn(
    () => (_req: Request, _res: Response, next: () => void) => next(),
  ),
}));

import { registerLeadMapCollaborationRoutes } from "./lead-map-collaboration-routes.js";
import { registerLeadMapLogoRoutes } from "./lead-map-logo-routes.js";

const userId = "marketer-a";
const token = "session-token";
const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";
const scope = { id: leadId, organizationId, projectId };

type RegisteredRoute = {
  method: string;
  path: string;
  handlers: RequestHandler[];
};

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

function harness() {
  const routes: RegisteredRoute[] = [];
  const register = (method: string) => (
    path: string,
    ...handlers: RequestHandler[]
  ) => routes.push({ method, path, handlers });
  const app = {
    get: register("GET"),
    post: register("POST"),
    put: register("PUT"),
    patch: register("PATCH"),
    delete: register("DELETE"),
  } as unknown as Express;
  const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
  const pool = { query } as unknown as Pool;
  const activeSessions = new Map([[token, { userId }]]);
  registerLeadMapCollaborationRoutes({ app, pool, activeSessions });
  registerLeadMapLogoRoutes({ app, pool, activeSessions });

  async function request(
    method: string,
    path: string,
    options: {
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    } = {},
  ) {
    const route = routes.find(
      (candidate) => candidate.method === method && candidate.path === path,
    );
    const handler = route?.handlers.at(-1);
    if (!handler) throw new Error(`Missing route ${method} ${path}`);
    const req = {
      headers: { authorization: `Bearer ${token}` },
      params: { id: leadId },
      query: options.query ?? {},
      body: options.body ?? {},
    } as unknown as Request;
    const response = responseHarness();
    await handler(req, response.response, vi.fn());
    return response;
  }

  return { pool, query, request };
}

beforeEach(() => {
  vi.clearAllMocks();
  leadAccess.load.mockResolvedValue(scope);
  projectAccess.load.mockResolvedValue({
    id: projectId,
    organizationId,
    name: "Dentum",
    description: null,
    industry: "86.230",
    status: "active",
    createdBy: userId,
    memberRole: "owner",
  });
  collaboration.listLeadNotes.mockResolvedValue([]);
  collaboration.createLeadNote.mockResolvedValue({ id: "note-a" });
  collaboration.setLeadFavorite.mockResolvedValue(true);
  logoFetcher.fetchBestLogo.mockResolvedValue({
    url: "https://dentum.no/logo.svg",
    source: "og:image",
  });
});

describe("Leadgrid collaboration and logo project scope", () => {
  it("fails closed before loading a lead when project scope is missing", async () => {
    const test = harness();
    const result = await test.request(
      "GET",
      "/api/admin-room/lead-map/leads/:id/notes",
    );

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({ error: "project_id_required" });
    expect(leadAccess.load).not.toHaveBeenCalled();
    expect(collaboration.listLeadNotes).not.toHaveBeenCalled();
  });

  it("rejects a stale selected project without touching collaborative data", async () => {
    const test = harness();
    const result = await test.request(
      "PUT",
      "/api/admin-room/lead-map/leads/:id/favorite",
      { body: { projectId: "dentum-vest", favorite: true } },
    );

    expect(result.status()).toBe(404);
    expect(result.body()).toEqual({ error: "project_not_found" });
    expect(collaboration.setLeadFavorite).not.toHaveBeenCalled();
  });

  it("passes the authoritative tuple into note creation", async () => {
    const test = harness();
    const result = await test.request(
      "POST",
      "/api/admin-room/lead-map/leads/:id/notes",
      { body: { projectId, body: "Ring klinikken", pinned: true } },
    );

    expect(result.status()).toBe(201);
    expect(collaboration.createLeadNote).toHaveBeenCalledWith(test.pool, {
      leadId,
      organizationId,
      projectId,
      authorUserId: userId,
      body: "Ring klinikken",
      pinned: true,
    });
  });

  it("binds logo lookup and update to the exact lead tuple", async () => {
    const test = harness();
    test.query
      .mockResolvedValueOnce({ rows: [{ website_url: "https://dentum.no" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const result = await test.request(
      "POST",
      "/api/admin-room/lead-map/leads/:id/fetch-logo",
      { body: { projectId } },
    );

    expect(result.status()).toBe(200);
    expect(logoFetcher.fetchBestLogo).toHaveBeenCalledWith("https://dentum.no");
    const [sql, params] = test.query.mock.calls[1];
    expect(String(sql)).toContain("organization_id = $2::uuid");
    expect(String(sql)).toContain("project_id = $3");
    expect(params).toEqual([
      leadId,
      organizationId,
      projectId,
      "https://dentum.no/logo.svg",
      "https://dentum.no",
    ]);
  });

  it("requires project scope before starting a bulk remote fetch", async () => {
    const test = harness();
    const result = await test.request(
      "POST",
      "/api/admin-room/lead-map/leads/fetch-logos-bulk",
    );

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({ error: "project_id_required" });
    expect(projectAccess.load).not.toHaveBeenCalled();
    expect(logoFetcher.fetchBestLogo).not.toHaveBeenCalled();
  });

  it("rejects private manual logo URLs before persistence", async () => {
    const test = harness();
    const result = await test.request(
      "PATCH",
      "/api/admin-room/lead-map/leads/:id/logo",
      { body: { projectId, logo_url: "http://127.0.0.1/admin" } },
    );

    expect(result.status()).toBe(400);
    expect(result.body()).toEqual({ error: "ugyldig_logo_url" });
    expect(test.query).not.toHaveBeenCalled();
  });
});
