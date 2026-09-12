import type { Pool } from "pg";
import { LEADGRID_OUTCOME_EVENT_TYPES } from "./leadgrid-outcome-events.js";

export interface LeadgridOutcomePerformance {
  eventType: (typeof LEADGRID_OUTCOME_EVENT_TYPES)[number];
  events: number;
  uniqueLeads: number;
  quantity: number;
  valuesByCurrency: Array<{
    currency: string;
    valueMinor: number;
  }>;
  lastOccurredAt: string | null;
}

function finiteNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** Project is optional, but organization scope is always mandatory. */
export async function computeOutcomeEventPerformance(
  pool: Pick<Pool, "query">,
  organizationId: string,
  sinceDays = 90,
  projectId: string | null = null,
): Promise<LeadgridOutcomePerformance[]> {
  const result = await pool.query<{
    event_type: LeadgridOutcomePerformance["eventType"];
    events: string;
    unique_leads: string;
    quantity: string;
    values_by_currency: Array<{ currency: string; valueMinor: number }> | null;
    last_occurred_at: string | null;
  }>(
    `WITH scoped_events AS (
       SELECT event_type, lead_id, occurred_at, metadata
         FROM leadgrid_project_outcome_events
        WHERE organization_id = $1::uuid
          AND occurred_at > NOW() - ($2::int * INTERVAL '1 day')
          AND ($3::text IS NULL OR project_id = $3::text)
     ),
     event_totals AS (
       SELECT event_type,
              COUNT(*)::text AS events,
              COUNT(DISTINCT lead_id)::text AS unique_leads,
              COALESCE(SUM(
                CASE
                  WHEN jsonb_typeof(metadata->'quantity') = 'number'
                    THEN (metadata->>'quantity')::bigint
                  ELSE 1
                END
              ), 0)::text AS quantity,
              MAX(occurred_at)::text AS last_occurred_at
         FROM scoped_events
        GROUP BY event_type
     ),
     currency_totals AS (
       SELECT event_type,
              metadata->>'currency' AS currency,
              SUM((metadata->>'value_minor')::bigint) AS value_minor
         FROM scoped_events
        WHERE jsonb_typeof(metadata->'value_minor') = 'number'
          AND jsonb_typeof(metadata->'currency') = 'string'
        GROUP BY event_type, metadata->>'currency'
     ),
     currency_values AS (
       SELECT event_type,
              jsonb_agg(
                jsonb_build_object(
                  'currency', currency,
                  'valueMinor', value_minor
                )
                ORDER BY currency
              ) AS values_by_currency
         FROM currency_totals
        GROUP BY event_type
     )
     SELECT totals.event_type,
            totals.events,
            totals.unique_leads,
            totals.quantity,
            totals.last_occurred_at,
            COALESCE(currency_values.values_by_currency, '[]'::jsonb) AS values_by_currency
       FROM event_totals totals
       LEFT JOIN currency_values USING (event_type)`,
    [organizationId, sinceDays, projectId],
  );

  const byType = new Map(result.rows.map((row) => [row.event_type, row]));
  return LEADGRID_OUTCOME_EVENT_TYPES.map((eventType) => {
    const row = byType.get(eventType);
    return {
      eventType,
      events: finiteNumber(row?.events),
      uniqueLeads: finiteNumber(row?.unique_leads),
      quantity: finiteNumber(row?.quantity),
      valuesByCurrency: (row?.values_by_currency ?? [])
        .filter((value) => /^[A-Z]{3}$/.test(value.currency))
        .map((value) => ({
          currency: value.currency,
          valueMinor: finiteNumber(value.valueMinor),
        })),
      lastOccurredAt: row?.last_occurred_at ?? null,
    };
  });
}


export const LEADGRID_OUTCOME_COHORT_DEFINITION = {
  attributionModel: "first_discovery_import_v1",
  denominator: "unique_leads_first_imported_during_window",
} as const;

export interface LeadgridOutcomeProfileStage {
  eventType: (typeof LEADGRID_OUTCOME_EVENT_TYPES)[number];
  uniqueLeads: number;
  conversionRate: number;
}

export interface LeadgridOutcomeProfileCohort {
  profileId: string;
  profileName: string;
  cohortLeads: number;
  windowStartedAt: string;
  windowEndedAt: string;
  firstImportedAt: string;
  stages: LeadgridOutcomeProfileStage[];
}

/**
 * Project-scoped conversion by Discovery profile. The denominator is the
 * distinct leads whose first authoritative Discovery import happened inside
 * the requested window. A later profile observation never steals attribution.
 */
export async function computeOutcomeProfileCohorts(
  pool: Pick<Pool, "query">,
  organizationId: string,
  projectId: string,
  sinceDays = 90,
): Promise<LeadgridOutcomeProfileCohort[]> {
  const result = await pool.query<{
    profile_id: string;
    profile_name: string;
    cohort_leads: string;
    window_started_at: string;
    window_ended_at: string;
    first_imported_at: string;
    event_type: LeadgridOutcomeProfileStage["eventType"];
    unique_leads: string;
  }>(
    `WITH attribution_candidates AS (
       SELECT feedback.lead_id,
              feedback.candidate_id,
              feedback.run_id,
              run.profile_id,
              profile.name AS profile_name,
              feedback.occurred_at AS attributed_at,
              ROW_NUMBER() OVER (
                PARTITION BY feedback.lead_id
                ORDER BY feedback.occurred_at ASC,
                         feedback.created_at ASC,
                         feedback.id ASC
              ) AS attribution_rank
         FROM leadgrid_discovery_feedback feedback
         JOIN leadgrid_discovery_candidates candidate
           ON candidate.organization_id = feedback.organization_id
          AND candidate.project_id = feedback.project_id
          AND candidate.id = feedback.candidate_id
          AND candidate.imported_lead_id = feedback.lead_id
         JOIN leadgrid_discovery_runs run
           ON run.organization_id = feedback.organization_id
          AND run.project_id = feedback.project_id
          AND run.id = feedback.run_id
         JOIN leadgrid_discovery_run_candidates occurrence
           ON occurrence.organization_id = feedback.organization_id
          AND occurrence.project_id = feedback.project_id
          AND occurrence.run_id = feedback.run_id
          AND occurrence.candidate_id = feedback.candidate_id
          AND occurrence.disposition = 'imported'
         LEFT JOIN leadgrid_discovery_profiles profile
           ON profile.organization_id = run.organization_id
          AND profile.project_id = run.project_id
          AND profile.id = run.profile_id
        WHERE feedback.organization_id = $1::uuid
          AND feedback.project_id = $2
          AND feedback.lead_id IS NOT NULL
          AND feedback.run_id IS NOT NULL
          AND feedback.event_type = 'decision'
          AND feedback.value = 'approve'
     ),
     first_touch AS (
       SELECT lead_id, candidate_id, run_id, profile_id, profile_name, attributed_at
         FROM attribution_candidates
        WHERE attribution_rank = 1
     ),
     reporting_window AS (
       SELECT NOW() - ($3::int * INTERVAL '1 day') AS window_started_at,
              NOW() AS window_ended_at
     ),
     cohort AS (
       SELECT first_touch.*
         FROM first_touch
         CROSS JOIN reporting_window
        WHERE first_touch.profile_id IS NOT NULL
          AND first_touch.attributed_at > reporting_window.window_started_at
          AND first_touch.attributed_at <= reporting_window.window_ended_at
     ),
     profile_totals AS (
       SELECT profile_id,
              MAX(profile_name) AS profile_name,
              COUNT(DISTINCT lead_id)::text AS cohort_leads,
              MIN(attributed_at)::text AS first_imported_at
         FROM cohort
        GROUP BY profile_id
     ),
     event_types AS (
       SELECT UNNEST($4::text[]) AS event_type
     ),
     stage_totals AS (
       SELECT cohort.profile_id,
              outcome.event_type,
              COUNT(DISTINCT outcome.lead_id)::text AS unique_leads
         FROM cohort
         JOIN leadgrid_project_outcome_events outcome
           ON outcome.organization_id = $1::uuid
          AND outcome.project_id = $2
          AND outcome.lead_id = cohort.lead_id
          AND outcome.discovery_candidate_id = cohort.candidate_id
          AND outcome.discovery_run_id = cohort.run_id
          AND outcome.discovery_profile_id = cohort.profile_id
          AND outcome.discovery_attributed_at = cohort.attributed_at
          AND outcome.occurred_at >= cohort.attributed_at
          AND outcome.occurred_at <= NOW()
        GROUP BY cohort.profile_id, outcome.event_type
     )
     SELECT totals.profile_id::text AS profile_id,
            totals.profile_name,
            totals.cohort_leads,
            reporting_window.window_started_at::text AS window_started_at,
            reporting_window.window_ended_at::text AS window_ended_at,
            totals.first_imported_at,
            event_types.event_type,
            COALESCE(stage_totals.unique_leads, '0') AS unique_leads
       FROM profile_totals totals
       CROSS JOIN event_types
       CROSS JOIN reporting_window
       LEFT JOIN stage_totals
         ON stage_totals.profile_id = totals.profile_id
        AND stage_totals.event_type = event_types.event_type
      ORDER BY totals.profile_name ASC,
               totals.profile_id ASC,
               ARRAY_POSITION($4::text[], event_types.event_type) ASC`,
    [organizationId, projectId, sinceDays, [...LEADGRID_OUTCOME_EVENT_TYPES]],
  );

  const cohorts = new Map<string, {
    profileName: string;
    cohortLeads: number;
    windowStartedAt: string;
    windowEndedAt: string;
    firstImportedAt: string;
    stages: Map<LeadgridOutcomeProfileStage["eventType"], number>;
  }>();
  for (const row of result.rows) {
    let cohort = cohorts.get(row.profile_id);
    if (!cohort) {
      cohort = {
        profileName: row.profile_name,
        cohortLeads: finiteNumber(row.cohort_leads),
        windowStartedAt: row.window_started_at,
        windowEndedAt: row.window_ended_at,
        firstImportedAt: row.first_imported_at,
        stages: new Map(),
      };
      cohorts.set(row.profile_id, cohort);
    }
    cohort.stages.set(row.event_type, finiteNumber(row.unique_leads));
  }

  return Array.from(cohorts, ([profileId, cohort]) => ({
    profileId,
    profileName: cohort.profileName,
    cohortLeads: cohort.cohortLeads,
    windowStartedAt: cohort.windowStartedAt,
    windowEndedAt: cohort.windowEndedAt,
    firstImportedAt: cohort.firstImportedAt,
    stages: LEADGRID_OUTCOME_EVENT_TYPES.map((eventType) => {
      const uniqueLeads = cohort.stages.get(eventType) ?? 0;
      return {
        eventType,
        uniqueLeads,
        conversionRate: cohort.cohortLeads > 0
          ? Math.min(1, Math.max(0, uniqueLeads / cohort.cohortLeads))
          : 0,
      };
    }),
  }));
}
