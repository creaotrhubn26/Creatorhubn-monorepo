import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compliance: vi.fn(),
  send: vi.fn(),
  configured: vi.fn(() => true),
  webhook: vi.fn(),
}));

vi.mock("./leadgrid-outreach-compliance.js", () => ({
  getLeadgridEmailCompliance: mocks.compliance,
}));
vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: mocks.send,
  isTransactionalEmailConfigured: mocks.configured,
}));
vi.mock("./webhook-emitter.js", () => ({ emitWebhook: mocks.webhook }));

import { executeWorkflow, _resetWebhookRateLimit } from "./leadgrid-workflow-engine.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";

describe("workflow outbound email compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetWebhookRateLimit();
  });

  it("fails closed before provider lookup, template lookup, cap or send", async () => {
    mocks.compliance.mockResolvedValue({
      allowed: false,
      reason: "blocked_unknown_address",
      addressClassification: "unknown",
      isSuppressed: false,
    });
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO leadgrid_workflow_executions")) {
        return { rows: [{ id: "22222222-2222-4222-8222-222222222222" }] };
      }
      return { rows: [] };
    });
    const result = await executeWorkflow(
      { query } as unknown as Pool,
      {
        id: "33333333-3333-4333-8333-333333333333",
        organization_id: organizationId,
        project_id: projectId,
        name: "Dentum compliance",
        trigger_type: "manual",
        trigger_config: { type: "manual" },
        conditions: [],
        actions: [{ type: "send_email", template_id: "followup_7d" }],
        is_active: true,
      },
      {
        pool: { query } as unknown as Pool,
        organizationId,
        projectId,
        type: "manual",
        leadId: "44444444-4444-4444-8444-444444444444",
        actorUserId: "daniel",
        data: {},
      },
      {
        lead: {
          id: "44444444-4444-4444-8444-444444444444",
          organization_id: organizationId,
          project_id: projectId,
          business_name: "Majorstuen Tannlegesenter",
          lead_score: 90,
          lead_temperature: "hot",
          pipeline_stage: "new",
          industry_id: null,
          city: "Oslo",
          deal_amount: null,
          deal_probability: null,
          owner_user_id: null,
          email: "post@majorstuentannlegesenter.no",
          phone: null,
          lead_source: "discovery_v2",
        },
      },
    );

    expect(mocks.compliance).toHaveBeenCalledWith(expect.anything(), {
      organizationId,
      email: "post@majorstuentannlegesenter.no",
    });
    expect(mocks.configured).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) =>
      String(sql).includes("leadgrid_outreach_templates"))).toBe(false);
    expect(result.actionResults[0]).toMatchObject({
      status: "skipped",
      message: "email_compliance_blocked:blocked_unknown_address",
    });
  });

  it("adds source, retention, rights and simple opt-out to every allowed send", async () => {
    mocks.compliance.mockResolvedValue({
      allowed: true,
      reason: "permitted_documented_consent",
      addressClassification: "named_person",
      isSuppressed: false,
      gdprProcessing: {
        documented: true,
        purpose: "Kvalifisere en relevant bedriftskontakt",
        source: "Klinikkens nettside",
        retentionUntil: "2026-12-09T10:00:00.000Z",
      },
    });
    mocks.send.mockResolvedValue({ sent: true, provider: "test", messageId: "mail-1" });
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO leadgrid_workflow_executions")) {
        return { rows: [{ id: "22222222-2222-4222-8222-222222222222" }] };
      }
      if (sql.includes("SELECT name FROM organizations")) {
        return { rows: [{ name: "Dentum" }] };
      }
      return { rows: [] };
    });
    const result = await executeWorkflow(
      { query } as unknown as Pool,
      {
        id: "33333333-3333-4333-8333-333333333333",
        organization_id: organizationId,
        project_id: projectId,
        name: "Dentum compliance",
        trigger_type: "manual",
        trigger_config: { type: "manual" },
        conditions: [],
        actions: [{ type: "send_email", template_id: "followup_7d" }],
        is_active: true,
      },
      {
        pool: { query } as unknown as Pool,
        organizationId,
        projectId,
        type: "manual",
        leadId: "44444444-4444-4444-8444-444444444444",
        actorUserId: "daniel",
        data: {},
      },
      {
        lead: {
          id: "44444444-4444-4444-8444-444444444444",
          organization_id: organizationId,
          project_id: projectId,
          business_name: "Majorstuen Tannlegesenter",
          lead_score: 90,
          lead_temperature: "hot",
          pipeline_stage: "new",
          industry_id: null,
          city: "Oslo",
          deal_amount: null,
          deal_probability: null,
          owner_user_id: null,
          email: "kari@majorstuentannlegesenter.no",
          phone: null,
          lead_source: "discovery_v2",
        },
      },
    );
    expect(result.actionResults[0].status).toBe("ok");
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const message = mocks.send.mock.calls[0][0];
    expect(message.text).toContain("markedsføringshenvendelse fra Dentum");
    expect(message.text).toContain("kilde: Klinikkens nettside");
    expect(message.text).toContain("2026-12-09");
    expect(message.text).toContain("Svar «nei takk»");
    expect(message.text).toContain("innsyn eller sletting");
  });
});
