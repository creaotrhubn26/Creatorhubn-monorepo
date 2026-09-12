import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";

const webhook = vi.hoisted(() => ({ emit: vi.fn(async () => undefined) }));
const realtime = vi.hoisted(() => ({
  scored: vi.fn(),
  recommendation: vi.fn(),
  nba: vi.fn(),
}));
const workflow = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));

vi.mock("./webhook-emitter.js", () => ({ emitWebhook: webhook.emit }));
vi.mock("./leadgrid-realtime.js", () => ({
  broadcastLeadScored: realtime.scored,
  broadcastRecommendation: realtime.recommendation,
  broadcastNbaUpdated: realtime.nba,
}));
vi.mock("./leadgrid-workflow-engine.js", () => ({ publishEvent: workflow.publish }));

import { computeIntelligenceForLead } from "./leadgrid-intelligence-engine.js";

const leadId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const projectId = "dentum-oslo";
const recommendationId = "33333333-3333-4333-8333-333333333333";

function contextRow() {
  return {
    lead_data: {
      id: leadId,
      organization_id: organizationId,
      project_id: projectId,
      owner_user_id: "owner-1",
      assigned_user_id: "seller-1",
      lead_status: "unvisited",
      pipeline_stage: "new",
      lead_category: "dental_clinic",
      email: null,
      phone: null,
      website_url: null,
      latitude: null,
      longitude: null,
      estimated_value: 20_000,
      enrichment_data: null,
      enriched_at: null,
      last_visit_at: null,
      last_contacted_at: null,
      next_follow_up_at: null,
      ai_opportunity_score: null,
    },
    activities_json: [],
    needs_json: [],
    signals_json: [],
    weights_json: [],
  };
}

function makePool() {
  const query = vi.fn(async (sql: string, params?: readonly unknown[]) => {
    if (sql.includes("WITH lead AS")) {
      return { rows: [contextRow()], rowCount: 1 };
    }
    if (sql.includes("UPDATE crm_customers")) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO lead_scores_history")) {
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SELECT id::text") && sql.includes("FROM lead_recommendations")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("INSERT INTO lead_recommendations")) {
      return { rows: [{ id: recommendationId }], rowCount: 1 };
    }
    throw new Error(`unexpected SQL: ${sql} / ${JSON.stringify(params)}`);
  });
  return { pool: { query } as unknown as Pool, query };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Leadgrid intelligence runtime project scope", () => {
  it("fails closed if the selected project changed before computation", async () => {
    const { pool, query } = makePool();

    const result = await computeIntelligenceForLead(pool, leadId, {
      trigger: "manual",
      expectedScope: {
        organizationId,
        projectId: "another-project",
      },
    });

    expect(result).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(webhook.emit).not.toHaveBeenCalled();
    expect(realtime.scored).not.toHaveBeenCalled();
  });

  it("reads facts, writes history/recommendations and emits only in the exact tuple", async () => {
    const { pool, query } = makePool();

    const result = await computeIntelligenceForLead(pool, leadId, {
      trigger: "cron",
      persist: true,
      expectedScope: { organizationId, projectId },
    });

    expect(result).toMatchObject({
      leadId,
      organizationId,
      projectId,
      recommendationId,
    });

    const contextSql = String(query.mock.calls[0]?.[0]);
    expect(contextSql).toContain("p.organization_id = c.organization_id");
    expect(contextSql).toContain("c.project_id IS NOT NULL");
    expect(contextSql).toContain("fact.organization_id::text = lead.organization_id");
    expect(contextSql).toContain("fact.project_id = lead.project_id");
    expect(contextSql).not.toContain("organization_members");

    const updateCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE crm_customers"),
    );
    expect(String(updateCall?.[0])).toContain("organization_id = $12::uuid");
    expect(String(updateCall?.[0])).toContain("project_id = $13");
    expect(updateCall?.[1]?.slice(-2)).toEqual([organizationId, projectId]);

    const historyCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO lead_scores_history"),
    );
    expect(String(historyCall?.[0])).toContain("organization_id, project_id");
    expect(historyCall?.[1]?.slice(0, 3)).toEqual([
      leadId,
      organizationId,
      projectId,
    ]);

    const dedupeCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM lead_recommendations"),
    );
    expect(String(dedupeCall?.[0])).toContain("project_id = $2");
    expect(dedupeCall?.[1]?.slice(0, 3)).toEqual([
      organizationId,
      projectId,
      leadId,
    ]);

    const recommendationCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO lead_recommendations"),
    );
    expect(String(recommendationCall?.[0])).toContain("organization_id, project_id");
    expect(recommendationCall?.[1]?.slice(0, 3)).toEqual([
      leadId,
      organizationId,
      projectId,
    ]);

    expect(webhook.emit).toHaveBeenCalledWith(
      pool,
      "lead.scored",
      expect.objectContaining({
        organization_id: organizationId,
        project_id: projectId,
      }),
      organizationId,
      projectId,
    );
    expect(webhook.emit).toHaveBeenCalledWith(
      pool,
      "recommendation.created",
      expect.objectContaining({ project_id: projectId }),
      organizationId,
      projectId,
    );
  });
});
