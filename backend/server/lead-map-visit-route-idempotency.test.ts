import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  logVisit: vi.fn(),
}));
const sessionMocks = vi.hoisted(() => ({
  resolve: vi.fn(),
}));
const leadAccessMocks = vi.hoisted(() => ({
  load: vi.fn(),
}));
const organizationMocks = vi.hoisted(() => ({
  requested: vi.fn(),
  resolveAuthorized: vi.fn(),
  resolveLead: vi.fn(),
  sendError: vi.fn(),
}));

vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: leadAccessMocks.load,
}));
vi.mock("./lead-map-service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lead-map-service.js")>();
  return {
    ...actual,
    logVisit: serviceMocks.logVisit,
  };
});
vi.mock("./lead-map-session-helper.js", () => ({
  resolveLeadMapSession: sessionMocks.resolve,
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

import { hashLeadVisitRequest } from "./lead-map-visit-contract.js";
import { setupLeadMapRoutes } from "./lead-map-routes.js";
import { VisitIdempotencyConflictError } from "./lead-map-service.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "44444444-4444-4444-8444-444444444444";
const idempotencyKey = "33333333-3333-4333-8333-333333333333";
const visitPath = "/api/admin-room/lead-map/leads/:id/visits";

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
  ) => {
    routes.push({ method, path, handlers });
  };
  const app = {
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
  } as unknown as Express;
  const pool = {} as Pool;
  setupLeadMapRoutes({
    app,
    pool,
    activeSessions: new Map(),
  });
  const route = routes.find(
    (candidate) => candidate.method === "POST" && candidate.path === visitPath,
  );
  if (!route) throw new Error("visit route was not registered");
  const handler = route.handlers.at(-1);
  if (!handler) throw new Error("visit handler was not registered");
  return { handler, pool };
}

function requestFor(
  body: Record<string, unknown>,
  header: string | undefined,
): Request {
  return {
    body,
    params: { id: leadId },
    query: {},
    get: vi.fn((name: string) =>
      name.toLowerCase() === "idempotency-key" ? header : undefined),
  } as unknown as Request;
}

function responseHarness() {
  let statusCode = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const response = {} as Response;
  response.status = vi.fn((code: number) => {
    statusCode = code;
    return response;
  });
  response.json = vi.fn((value: unknown) => {
    body = value;
    return response;
  });
  response.setHeader = vi.fn((name: string, value: string | number | readonly string[]) => {
    headers.set(name.toLowerCase(), String(value));
    return response;
  });
  return {
    response,
    statusCode: () => statusCode,
    body: () => body,
    header: (name: string) => headers.get(name.toLowerCase()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.resolve.mockResolvedValue({ userId: "seller-1" });
  leadAccessMocks.load.mockResolvedValue({ id: leadId, organizationId, projectId });
  organizationMocks.requested.mockReturnValue(null);
  organizationMocks.resolveAuthorized.mockResolvedValue(organizationId);
  organizationMocks.resolveLead.mockResolvedValue(organizationId);
  organizationMocks.sendError.mockReturnValue(false);
});

describe("POST lead visit idempotency contract", () => {
  it("rejects decorated/non-UUID idempotency keys before persistence", async () => {
    const { handler } = setupHarness();
    const result = responseHarness();

    await handler(
      requestFor(
        { visitType: "phone" },
        `leadgrid:${organizationId}:${idempotencyKey}`,
      ),
      result.response,
      vi.fn(),
    );

    expect(result.statusCode()).toBe(400);
    expect(result.body()).toEqual({ error: "ugyldig_idempotency_key" });
    expect(serviceMocks.logVisit).not.toHaveBeenCalled();
  });

  it("passes a raw UUID and canonical payload hash to the service", async () => {
    const { handler, pool } = setupHarness();
    const result = responseHarness();
    const body = {
      visitType: "phone",
      contactPerson: "Ada",
      conversationSummary: "Avtalte demo",
      durationMinutes: 12,
    };
    serviceMocks.logVisit.mockResolvedValue({
      ok: true,
      visitId: "visit-new",
      previousStatus: "unvisited",
      idempotentReplay: false,
    });

    await handler(requestFor(body, idempotencyKey), result.response, vi.fn());

    expect(serviceMocks.logVisit).toHaveBeenCalledWith(pool, expect.objectContaining({
      ownerUserId: "seller-1",
      organizationId,
      projectId,
      leadId,
      idempotencyKey,
      requestHash: hashLeadVisitRequest(leadId, body),
    }));
    expect(result.statusCode()).toBe(200);
    expect(result.body()).toEqual({
      ok: true,
      visitId: "visit-new",
      previousStatus: "unvisited",
      replayed: false,
    });
    expect(result.header("Idempotent-Replayed")).toBeUndefined();
  });

  it("marks an identical retry as replayed", async () => {
    const { handler } = setupHarness();
    const result = responseHarness();
    serviceMocks.logVisit.mockResolvedValue({
      ok: true,
      visitId: "visit-existing",
      previousStatus: "unvisited",
      idempotentReplay: true,
    });

    await handler(
      requestFor({ visitType: "email", newStatus: "interested" }, idempotencyKey),
      result.response,
      vi.fn(),
    );

    expect(result.statusCode()).toBe(200);
    expect(result.header("Idempotent-Replayed")).toBe("true");
    expect(result.body()).toMatchObject({
      visitId: "visit-existing",
      replayed: true,
    });
  });

  it("maps same-key/different-payload conflicts to HTTP 409", async () => {
    const { handler } = setupHarness();
    const result = responseHarness();
    serviceMocks.logVisit.mockRejectedValue(
      new VisitIdempotencyConflictError("visit-existing"),
    );

    await handler(
      requestFor({ visitType: "phone" }, idempotencyKey),
      result.response,
      vi.fn(),
    );

    expect(result.statusCode()).toBe(409);
    expect(result.body()).toEqual({
      error: "idempotency_key_conflict",
      existing_visit_id: "visit-existing",
    });
  });

  it.each(["sms", "whatsapp"] as const)(
    "persists the exact %s contact channel",
    async (channel) => {
      const { handler, pool } = setupHarness();
      const result = responseHarness();
      serviceMocks.logVisit.mockResolvedValue({
        ok: true,
        visitId: "visit-channel",
        previousStatus: "unvisited",
        idempotentReplay: false,
      });

      await handler(
        requestFor(
          {
            visitType: channel,
            activityKind: channel,
            conversationSummary: "Brukeren bekreftet at kontakten ble sendt.",
          },
          idempotencyKey,
        ),
        result.response,
        vi.fn(),
      );

      expect(serviceMocks.logVisit).toHaveBeenCalledWith(
        pool,
        expect.objectContaining({
          visitType: channel,
          activityKind: channel,
        }),
      );
      expect(result.statusCode()).toBe(200);
    },
  );

  it("keeps the header optional for legacy clients", async () => {
    const { handler, pool } = setupHarness();
    const result = responseHarness();
    serviceMocks.logVisit.mockResolvedValue({
      ok: true,
      visitId: "visit-legacy",
      previousStatus: "unvisited",
      idempotentReplay: false,
    });

    await handler(
      requestFor({ visitType: "research" }, undefined),
      result.response,
      vi.fn(),
    );

    expect(serviceMocks.logVisit).toHaveBeenCalledWith(pool, expect.objectContaining({
      idempotencyKey: null,
      requestHash: null,
    }));
    expect(result.statusCode()).toBe(200);
  });

});
