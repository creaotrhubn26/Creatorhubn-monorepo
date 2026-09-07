import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const outcome = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("./leadgrid-api-key-auth.js", () => ({
  requireApiKey: () => vi.fn(),
  apiKeyAllowsProject: (
    context: {
      projectId: string | null;
      accessScope: "project" | "organization";
    },
    projectId: string,
  ) =>
    context.accessScope === "organization"
      ? context.projectId === null
      : context.projectId === projectId,
}));
vi.mock("./leadgrid-outcome-events.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./leadgrid-outcome-events.js")>();
  return { ...original, recordLeadgridOutcomeEvent: outcome.record };
});

import { registerLeadgridPublicOutcomeRoutes } from "./leadgrid-public-outcome-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const apiKeyId = "22222222-2222-4222-8222-222222222222";
const leadId = "33333333-3333-4333-8333-333333333333";
const path = "/api/v1/projects/:projectId/leads/:leadId/outcome-events";

function harness() {
  const routes = new Map<string, RequestHandler[]>();
  const app = {
    post: (route: string, ...handlers: RequestHandler[]) =>
      routes.set(`POST ${route}`, handlers),
  } as unknown as Express;
  registerLeadgridPublicOutcomeRoutes({
    app,
    pool: { query: vi.fn() } as unknown as Pool,
  });

  return async (
    options: {
      body?: unknown;
      idempotencyKey?: string;
      projectId?: string;
      leadId?: string;
    } = {},
  ) => {
    const handler = routes.get(`POST ${path}`)?.at(-1);
    if (!handler) throw new Error("route missing");
    const req = {
      params: {
        projectId: options.projectId ?? "dentum-oslo",
        leadId: options.leadId ?? leadId,
      },
      body: options.body ?? {
        event_type: "pilot_invited",
        external_event_id: "dentum.pilot.42",
        occurred_at: "2026-09-05T08:30:00.000Z",
        metadata: { channel: "email" },
      },
      apiKey: {
        organizationId,
        apiKeyId,
        projectId: "dentum-oslo",
        accessScope: "project",
        scopes: ["outcomes.write"],
        rateLimitRpm: 60,
      },
      get(name: string) {
        return name === "Idempotency-Key" ? options.idempotencyKey : undefined;
      },
    } as unknown as Request;
    let status = 200;
    let body: unknown;
    const res = {
      status(value: number) {
        status = value;
        return this;
      },
      json(value: unknown) {
        body = value;
        return this;
      },
    } as unknown as Response;
    await handler(req, res, vi.fn());
    return { status, body };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  outcome.record.mockResolvedValue({
    replayed: false,
    event: { id: "44444444-4444-4444-8444-444444444444" },
  });
});

describe("Leadgrid public outcome route", () => {
  it("passes API-key organization and stable retry identifiers to persistence", async () => {
    const response = await harness()({ idempotencyKey: "retry-42" });

    expect(response.status).toBe(201);
    expect(outcome.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId,
        projectId: "dentum-oslo",
        leadId,
        apiKeyId,
        idempotencyKey: "retry-42",
      }),
    );
  });

  it("rejects patient/free-text metadata before persistence", async () => {
    const response = await harness()({
      body: {
        event_type: "inquiry_received",
        external_event_id: "dentum.inquiry.42",
        occurred_at: "2026-09-05T08:30:00.000Z",
        metadata: { patient_name: "Ola Nordmann" },
      },
    });

    expect(response.status).toBe(400);
    expect(outcome.record).not.toHaveBeenCalled();
  });

  it("returns 200 and replayed=true for an identical retry", async () => {
    outcome.record.mockResolvedValue({
      replayed: true,
      event: { id: "44444444-4444-4444-8444-444444444444" },
    });
    const response = await harness()();
    expect(response).toMatchObject({
      status: 200,
      body: { meta: { version: "v1", replayed: true } },
    });
  });

  it("rejects an outcome for a different customer project before persistence", async () => {
    const response = await harness()({ projectId: "another-customer" });

    expect(response).toMatchObject({
      status: 404,
      body: { error: "project_not_found" },
    });
    expect(outcome.record).not.toHaveBeenCalled();
  });
});
