import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  computeOutcomeEventPerformance,
  computeOutcomeProfileCohorts,
} from "./leadgrid-outcome-analytics.js";

describe("Leadgrid outcome analytics", () => {
  it("always scopes by organization and optionally by the selected project", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        event_type: "profile_published",
        events: "3",
        unique_leads: "2",
        quantity: "3",
        values_by_currency: [
          { currency: "EUR", valueMinor: 50_000 },
          { currency: "NOK", valueMinor: 125_000 },
        ],
        last_occurred_at: "2026-09-05T10:00:00.000Z",
      }],
    });

    const result = await computeOutcomeEventPerformance(
      { query } as unknown as Pick<Pool, "query">,
      "11111111-1111-4111-8111-111111111111",
      30,
      "dentum-oslo",
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("organization_id = $1::uuid");
    expect(sql).toContain("($3::text IS NULL OR project_id = $3::text)");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      30,
      "dentum-oslo",
    ]);
    expect(result.find((row) => row.eventType === "profile_published"))
      .toMatchObject({
        events: 3,
        uniqueLeads: 2,
        valuesByCurrency: [
          { currency: "EUR", valueMinor: 50_000 },
          { currency: "NOK", valueMinor: 125_000 },
        ],
      });
    expect(result.find((row) => row.eventType === "attendance_confirmed"))
      .toMatchObject({ events: 0, uniqueLeads: 0, valuesByCurrency: [] });
  });

  it("computes unique-lead conversion against each profile's first-import cohort", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          profile_id: "77777777-7777-4777-8777-777777777777",
          profile_name: "Oslo kjerne",
          cohort_leads: "10",
          window_started_at: "2026-08-07T12:00:00.000Z",
          window_ended_at: "2026-09-06T12:00:00.000Z",
          first_imported_at: "2026-08-10T08:00:00.000Z",
          event_type: "pilot_invited",
          unique_leads: "6",
        },
        {
          profile_id: "77777777-7777-4777-8777-777777777777",
          profile_name: "Oslo kjerne",
          cohort_leads: "10",
          window_started_at: "2026-08-07T12:00:00.000Z",
          window_ended_at: "2026-09-06T12:00:00.000Z",
          first_imported_at: "2026-08-10T08:00:00.000Z",
          event_type: "meeting_completed",
          unique_leads: "3",
        },
      ],
    });

    const result = await computeOutcomeProfileCohorts(
      { query } as unknown as Pick<Pool, "query">,
      "11111111-1111-4111-8111-111111111111",
      "dentum-oslo",
      30,
    );

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("feedback.organization_id = $1::uuid");
    expect(sql).toContain("feedback.project_id = $2");
    expect(sql).toContain("candidate.imported_lead_id = feedback.lead_id");
    expect(sql).toContain("occurrence.disposition = 'imported'");
    expect(sql).toContain("PARTITION BY feedback.lead_id");
    expect(sql).toContain("feedback.occurred_at ASC");
    expect(sql).toContain("WHERE attribution_rank = 1");
    expect(sql).toContain("COUNT(DISTINCT lead_id)::text AS cohort_leads");
    expect(sql).toContain("outcome.discovery_candidate_id = cohort.candidate_id");
    expect(sql).toContain("outcome.discovery_run_id = cohort.run_id");
    expect(sql).toContain("outcome.discovery_profile_id = cohort.profile_id");
    expect(sql).not.toContain("campaign_ref");
    expect(sql).not.toContain("territory_code");
    expect(params.slice(0, 3)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "dentum-oslo",
      30,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      profileName: "Oslo kjerne",
      cohortLeads: 10,
    });
    expect(result[0].stages.find((stage) => stage.eventType === "pilot_invited"))
      .toMatchObject({ uniqueLeads: 6, conversionRate: 0.6 });
    expect(result[0].stages.find((stage) => stage.eventType === "meeting_completed"))
      .toMatchObject({ uniqueLeads: 3, conversionRate: 0.3 });
    expect(result[0].stages.find((stage) => stage.eventType === "attendance_confirmed"))
      .toMatchObject({ uniqueLeads: 0, conversionRate: 0 });
  });
});
