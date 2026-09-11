import type { Express, Request, RequestHandler, Response } from "express";
import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadLead: vi.fn() }));
vi.mock("./leadgrid-lead-access.js", () => ({
  loadAccessibleLeadgridLead: mocks.loadLead,
}));

import { registerLeadgridOutreachComplianceRoutes } from "./leadgrid-outreach-compliance-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const otherOrganizationId = "99999999-9999-4999-8999-999999999999";
const leadId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";

function setup(query: ReturnType<typeof vi.fn>) {
  const routes = new Map<string, RequestHandler>();
  const app = {
    get(path: string, ...handlers: RequestHandler[]) {
      routes.set(`GET ${path}`, handlers.at(-1)!);
    },
    put(path: string, ...handlers: RequestHandler[]) {
      routes.set(`PUT ${path}`, handlers.at(-1)!);
    },
    post(path: string, ...handlers: RequestHandler[]) {
      routes.set(`POST ${path}`, handlers.at(-1)!);
    },
  } as unknown as Express;
  registerLeadgridOutreachComplianceRoutes({
    app,
    pool: { query } as unknown as Pool,
    activeSessions: new Map([["token", { userId: "daniel" }]]),
  });
  return routes;
}

function request(input: { query?: Record<string, string>; body?: Record<string, unknown> } = {}) {
  return {
    headers: { authorization: "Bearer token" },
    params: { id: leadId },
    query: input.query ?? { projectId, organization_id: organizationId },
    body: input.body ?? {},
  } as unknown as Request;
}

function response() {
  let status = 200;
  let body: unknown;
  const headers = new Map<string, string>();
  const res = {
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; return this; },
    setHeader(name: string, value: string) { headers.set(name, value); return this; },
  } as unknown as Response;
  return { res, get status() { return status; }, get body() { return body; }, headers };
}

describe("Leadgrid outreach compliance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadLead.mockResolvedValue({ id: leadId, organizationId, projectId });
  });

  it("fails closed when the requested organization does not match the lead tuple", async () => {
    const query = vi.fn();
    const routes = setup(query);
    const out = response();
    await routes.get("GET /api/admin-room/lead-map/leads/:id/outreach-compliance")!(
      request({ query: { projectId, organization_id: otherOrganizationId } }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it("does not infer permission from an info@-style address", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers")) {
        return { rows: [{ email: "info@dentum.no" }] };
      }
      return { rows: [{}] };
    });
    const routes = setup(query);
    const out = response();
    await routes.get("GET /api/admin-room/lead-map/leads/:id/outreach-compliance")!(
      request(), out.res, vi.fn(),
    );
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ compliance: {
      address_classification: "unknown",
      address_type_hint: "verified_shared",
      allowed: false,
      reason: "blocked_unknown_address",
    } });
    expect(out.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns the decision without exposing stored compliance evidence", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers")) {
        return { rows: [{ email: "person@dentum.no" }] };
      }
      return { rows: [{
        address_classification: "named_person",
        consent_action: "grant",
        consent_contact_name: "Named Dentist",
        consent_purpose: "Product information",
        consent_text: "Full signed wording",
        consent_version: "2026-09",
        consent_source: "Signed form",
        consent_evidence: "Secret evidence reference",
        consent_occurred_at: "2026-09-01T10:00:00.000Z",
        gdpr_data_subject_name: "Named Dentist",
        gdpr_legal_basis: "consent",
        gdpr_purpose: "Product information",
        gdpr_source: "Clinic website",
        gdpr_collected_at: "2026-09-01T10:00:00.000Z",
        gdpr_retention_until: "2099-09-01T10:00:00.000Z",
        gdpr_legitimate_interest_goal: "Full internal goal",
        gdpr_necessity_assessment: "Full internal necessity assessment",
        gdpr_balancing_assessment: "Full internal balancing assessment",
        gdpr_safeguards: "Full internal safeguards",
        gdpr_indirect_collection: true,
        gdpr_privacy_notice_status: "sent",
        gdpr_privacy_notice_sent_at: "2026-09-01T11:00:00.000Z",
        gdpr_privacy_notice_method: "email",
        gdpr_privacy_notice_reference: "Private document reference",
      }] };
    });
    const routes = setup(query);
    const out = response();
    await routes.get("GET /api/admin-room/lead-map/leads/:id/outreach-compliance")!(
      request(), out.res, vi.fn(),
    );

    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ compliance: {
      allowed: true,
      reason: "permitted_documented_consent",
      consent: { action: "grant" },
      gdpr_processing: { documented: true, privacy_notice_status: "sent" },
    } });
    const serialized = JSON.stringify(out.body);
    expect(serialized).not.toContain("Full signed wording");
    expect(serialized).not.toContain("Secret evidence reference");
    expect(serialized).not.toContain("Full internal balancing assessment");
    expect(serialized).not.toContain("Private document reference");
    expect(serialized).not.toContain("Named Dentist");
  });

  it("persists verified-shared evidence under organization plus normalized email", async () => {
    let wasVerified = false;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM crm_customers")) {
        return { rows: [{ email: " Post@Dentum.no " }] };
      }
      if (sql.includes("INSERT INTO leadgrid_email_compliance_profiles")) {
        wasVerified = true;
        return { rows: [] };
      }
      return { rows: [{
        address_classification: wasVerified ? "verified_shared" : "unknown",
      }] };
    });
    const routes = setup(query);
    const out = response();
    await routes.get("PUT /api/admin-room/lead-map/leads/:id/outreach-compliance/address-classification")!(
      request({ body: {
        classification: "verified_shared",
        source: "clinic_website",
        evidence: "Footer labels this address as clinic reception",
      } }),
      out.res,
      vi.fn(),
    );
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ compliance: {
      allowed: true,
      reason: "permitted_verified_shared",
    } });
    const insert = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO leadgrid_email_compliance_profiles"));
    expect(insert?.[1]).toEqual([
      organizationId,
      "post@dentum.no",
      "verified_shared",
      "clinic_website",
      "Footer labels this address as clinic reception",
      "daniel",
    ]);
  });
});
