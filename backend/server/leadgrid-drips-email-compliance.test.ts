import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compliance: vi.fn(),
  send: vi.fn(),
}));

vi.mock("./leadgrid-outreach-compliance.js", () => ({
  getLeadgridEmailCompliance: mocks.compliance,
}));
vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: mocks.send,
}));

import { registerLeadgridDripsRoutes } from "./leadgrid-drips-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const dripId = "22222222-2222-4222-8222-222222222222";

function setup(query: ReturnType<typeof vi.fn>) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    post(path: string, ...handlers: RequestHandler[]) {
      routes.set(`POST ${path}`, handlers.at(-1)!);
    },
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(`GET ${path}`, handlers.at(-1)!);
    },
  } as unknown as Express;
  registerLeadgridDripsRoutes({
    app,
    pool: { query } as unknown as Pool,
    activeSessions: new Map([["admin-token", { userId: "daniel", role: "admin" }]]),
  });
  return routes;
}

function response() {
  let status = 200;
  let payload: unknown;
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { payload = value; return this; },
    send(value: unknown) { payload = value; return this; },
  } as unknown as Response;
  return { res, get status() { return status; }, get payload() { return payload; } };
}

function dueDrip() {
  return {
    id: dripId,
    user_id: "daniel",
    organization_id: organizationId,
    trigger_event: "first_auto_onboard",
    triggered_at: "2026-09-01T10:00:00.000Z",
    day1_sent_at: null,
    day3_sent_at: "2026-09-04T10:00:00.000Z",
    day7_sent_at: "2026-09-08T10:00:00.000Z",
    day14_sent_at: "2026-09-15T10:00:00.000Z",
    user_email: "daniel@creatorhubn.com",
    user_name: "Daniel",
    org_name: "CreatorHub",
  };
}

describe("Leadgrid onboarding drip compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T10:00:00.000Z"));
  });

  it("fails closed before sending a promotional drip", async () => {
    mocks.compliance.mockResolvedValue({
      allowed: false,
      reason: "blocked_unknown_address",
    });
    const query = vi.fn(async (sql: string) =>
      sql.includes("FROM onboarding_drips")
        ? { rows: [dueDrip()] }
        : { rows: [] });
    const routes = setup(query);
    const out = response();
    await routes.get("POST /api/leadgrid/drips/run")!(
      { headers: { authorization: "Bearer admin-token" } } as unknown as Request,
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(out.payload).toMatchObject({
      processed: 1,
      sent: 0,
      skipped: 1,
      compliance_blocked: 1,
    });
    expect(mocks.compliance).toHaveBeenCalledWith(expect.anything(), {
      organizationId,
      email: "daniel@creatorhubn.com",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("uses a recipient-free UUID unsubscribe URL when permission exists", async () => {
    mocks.compliance.mockResolvedValue({ allowed: true });
    mocks.send.mockResolvedValue({ sent: true });
    const query = vi.fn(async (sql: string) =>
      sql.includes("FROM onboarding_drips")
        ? { rows: [dueDrip()] }
        : { rows: [] });
    const routes = setup(query);
    const out = response();
    await routes.get("POST /api/leadgrid/drips/run")!(
      { headers: { authorization: "Bearer admin-token" } } as unknown as Request,
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(out.payload).toMatchObject({ sent: 1, compliance_blocked: 0 });
    const message = mocks.send.mock.calls[0][0];
    expect(message.html).toContain(`/api/leadgrid/drips/unsubscribe/${dripId}`);
    expect(message.text).toContain(`/api/leadgrid/drips/unsubscribe/${dripId}`);
    expect(message.html).not.toContain("theroleroom.com");
    expect(message.html).not.toContain("daniel%40creatorhubn.com");
  });

  it("includes the opaque unsubscribe URL in HTML and text for every drip", async () => {
    mocks.compliance.mockResolvedValue({ allowed: true });
    mocks.send.mockResolvedValue({ sent: true });
    const drip = {
      ...dueDrip(),
      triggered_at: "2026-08-20T10:00:00.000Z",
      day1_sent_at: null,
      day3_sent_at: null,
      day7_sent_at: null,
      day14_sent_at: null,
    };
    const query = vi.fn(async (sql: string) =>
      sql.includes("FROM onboarding_drips")
        ? { rows: [drip] }
        : { rows: [] });
    const routes = setup(query);
    const out = response();
    await routes.get("POST /api/leadgrid/drips/run")!(
      { headers: { authorization: "Bearer admin-token" } } as unknown as Request,
      out.res,
      vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(out.payload).toMatchObject({ sent: 4, compliance_blocked: 0 });
    expect(mocks.send).toHaveBeenCalledTimes(4);
    for (const [message] of mocks.send.mock.calls) {
      expect(message.html).toContain(`/api/leadgrid/drips/unsubscribe/${dripId}`);
      expect(message.text).toContain(`/api/leadgrid/drips/unsubscribe/${dripId}`);
    }
  });

  it("unsubscribes only by the opaque drip id and retires the email route", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const routes = setup(query);
    const out = response();
    await routes.get("GET /api/leadgrid/drips/unsubscribe/:id")!(
      { params: { id: dripId } } as unknown as Request,
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(200);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1::uuid"),
      [dripId],
    );
    expect(String(out.payload)).not.toContain("daniel@creatorhubn.com");

    const retired = response();
    await routes.get("GET /api/leadgrid/drips/unsubscribe")!(
      {} as Request,
      retired.res,
      vi.fn(),
    );
    expect(retired.status).toBe(410);
  });
});
