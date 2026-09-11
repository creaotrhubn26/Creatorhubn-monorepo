import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadLead: vi.fn(),
  compliance: vi.fn(),
  send: vi.fn(),
}));
vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: mocks.loadLead,
}));
vi.mock("./leadgrid-outreach-compliance.js", () => ({
  getLeadgridEmailCompliance: mocks.compliance,
}));
vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: mocks.send,
}));
vi.mock("./leadgrid-workflow-engine.js", () => ({ publishEvent: vi.fn() }));
vi.mock("./leadgrid-deals-service.js", () => ({ applyStageChange: vi.fn() }));

import { registerLeadgridProposalsRoutes } from "./leadgrid-proposals-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";

describe("proposal email compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadLead.mockResolvedValue({
      id: leadId,
      organizationId,
      projectId: "dentum-oslo",
    });
  });

  it("blocks an unknown recipient before proposal persistence or email send", async () => {
    const routes = new Map<string, RequestHandler>();
    const app = {
      post(path: string, ...handlers: RequestHandler[]) {
        routes.set(`POST ${path}`, handlers.at(-1)!);
      },
      get: vi.fn(),
      patch: vi.fn(),
    } as unknown as Express;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers")) {
        return { rows: [{
          id: leadId,
          name: "Majorstuen Tannlegesenter",
          email: "post@klinikk.no",
          lead_source: "discovery_v2",
        }] };
      }
      return { rows: [] };
    });
    mocks.compliance.mockResolvedValue({
      allowed: false,
      reason: "blocked_unknown_address",
      addressClassification: "unknown",
      isSuppressed: false,
    });
    registerLeadgridProposalsRoutes({
      app,
      pool: { query } as unknown as Pool,
      requireUserSession: () => ({
        userId: "daniel",
        name: "Daniel",
        email: "daniel@creatorhubn.com",
        role: "admin",
      }),
    });
    let status = 200;
    let payload: unknown;
    const res = {
      status(code: number) { status = code; return this; },
      json(value: unknown) { payload = value; return this; },
    } as unknown as Response;
    await routes.get("POST /api/leadgrid/leads/:id/proposals")!(
      {
        params: { id: leadId },
        body: {
          title: "Dentum pilot",
          lines: [{ description: "Profiloppsett", amount_nok: 1000 }],
        },
      } as unknown as Request,
      res,
      vi.fn(),
    );
    expect(status).toBe(422);
    expect(payload).toMatchObject({
      error: "email_outreach_compliance_blocked",
      reason: "blocked_unknown_address",
    });
    expect(query.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO leadgrid_proposals"))).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
