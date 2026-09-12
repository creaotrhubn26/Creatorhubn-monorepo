import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  saveCounterCampaignToWorkflow,
  type CounterCampaign,
} from "../competitor-counter-campaign.js";
import { getCampaignAggregate } from "./lead-map-campaign-service.js";
import { processWorkflowAnalytics } from "./learning-loop-service.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";
const workflowId = "22222222-2222-4222-8222-222222222222";

const campaign: CounterCampaign = {
  competitorName: "Konkurrent AS",
  threatLevel: "near",
  targetSegment: "Tannklinikker i Oslo",
  keyMessages: ["Tydelig pasientverdi"],
  contentDrafts: [
    {
      type: "email",
      title: "Pilot",
      body: "Invitasjon",
      rationale: "Relevant",
    },
  ],
  channelMix: [{ channel: "email", weight: 1, rationale: "Direkte" }],
  generatedAt: "2026-09-05T10:00:00.000Z",
};

describe("legacy Market Intelligence data-flow hardening", () => {
  it("persists counter-campaign workflows with explicit organization and project scope", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM market_scan_competitors")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("information_schema.tables")) {
        return { rows: [{ exists: true }] };
      }
      if (sql.includes("INSERT INTO marketing_workflows")) {
        return { rows: [{ id: workflowId }] };
      }
      throw new Error("unexpected_query");
    });

    await expect(
      saveCounterCampaignToWorkflow({ query } as unknown as Pool, {
        workspaceOwnerUserId: "user-a",
        competitorId: "33333333-3333-4333-8333-333333333333",
        organizationId,
        projectId,
        campaign,
      }),
    ).resolves.toEqual({ workflowId });

    const insert = query.mock.calls.find(([sql]) =>
      sql.includes("INSERT INTO marketing_workflows"),
    );
    expect(insert?.[0]).toContain("organization_id");
    expect(insert?.[0]).toContain("$2::uuid");
    expect(insert?.[1]?.slice(0, 3)).toEqual([
      "user-a",
      organizationId,
      projectId,
    ]);
  });

  it("compares legacy campaign member text IDs to CRM UUIDs without a PostgreSQL type error", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM lead_map_campaigns")) {
        return {
          rows: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              workspace_owner_user_id: "user-a",
              organization_id: organizationId,
              project_id: projectId,
              agent_config_id: null,
              name: "Pilot",
              description: null,
              filter_category: null,
              filter_region: null,
              filter_city: null,
              filter_lead_status: [],
              target_total_leads: 100,
              target_won_leads: 5,
              status: "active",
              market_scan_id: null,
              brand_kit_id: null,
              related_workflow_id: null,
              re_engagement_days: 90,
              auto_re_engagement_enabled: true,
              started_at: null,
              completed_at: null,
              created_at: "2026-09-05T10:00:00.000Z",
              updated_at: "2026-09-05T10:00:00.000Z",
            },
          ],
        };
      }
      if (sql.includes("GROUP BY c.lead_status")) return { rows: [] };
      if (sql.includes("COUNT(*)::int as count")) {
        return { rows: [{ count: 0 }] };
      }
      throw new Error("unexpected_query");
    });

    await getCampaignAggregate(
      { query } as unknown as Pool,
      "44444444-4444-4444-8444-444444444444",
      {
        workspaceOwnerUserId: "user-a",
        organizationId,
        projectId,
      },
    );

    const aggregate = query.mock.calls.find(([sql]) =>
      sql.includes("GROUP BY c.lead_status"),
    );
    expect(aggregate?.[0]).toContain("lmcm.customer_id = c.id::text");
    expect(aggregate?.[0]).not.toContain("lmcm.customer_id = c.id\n");
  });

  it("reads the latest engagement snapshot and scopes every learning-loop mutation", async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM marketing_workflows") &&
        sql.includes("campaign_draft_id")
      ) {
        expect(params).toEqual([workflowId, organizationId, projectId]);
        return {
          rows: [
            {
              id: workflowId,
              opportunity_id: null,
              market_scan_id: null,
              brand_kit_id: null,
              campaign_draft_id: 91,
              content_pack_draft_ids: [],
            },
          ],
        };
      }
      if (sql.includes("FROM marketing_post_drafts draft")) {
        expect(sql).toContain("FROM post_engagement_snapshots engagement");
        expect(sql).toContain("draft.organization_id = $2::uuid");
        expect(sql).toContain("draft.leadgrid_project_id = $3");
        expect(params).toEqual([[91], organizationId, projectId]);
        return {
          rows: [
            {
              draftId: 91,
              status: "published",
              published_at: "2026-09-05T10:00:00.000Z",
              latest_engagement: {
                impressions: 50,
                engagements: 5,
                clicks: 2,
              },
            },
          ],
        };
      }
      if (sql.includes("INSERT INTO marketing_workflow_analytics")) {
        return { rows: [] };
      }
      if (sql.includes("UPDATE marketing_workflows")) {
        expect(sql).toContain("organization_id = $4::uuid");
        expect(sql).toContain("project_id = $5");
        expect(params?.slice(-2)).toEqual([organizationId, projectId]);
        return { rows: [] };
      }
      throw new Error("unexpected_query");
    });

    const result = await processWorkflowAnalytics(
      { query } as unknown as Pool,
      workflowId,
      { organizationId, projectId },
    );

    expect(result).toMatchObject({
      workflowId,
      totalDraftsPublished: 1,
      totalImpressions: 50,
      totalEngagements: 5,
      totalClicks: 2,
      performanceTier: "unrated",
    });
  });
});
