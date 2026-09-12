import { createHash } from "crypto";
import type { Pool } from "pg";
import { z } from "zod";

export const LEADGRID_OUTCOME_EVENT_TYPES = [
  "pilot_invited",
  "meeting_completed",
  "profile_published",
  "inquiry_received",
  "booking_confirmed",
  "attendance_confirmed",
] as const;

const safeReference = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const safeLabel = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const leadgridOutcomeMetadataSchema = z
  .object({
    channel: safeLabel.optional(),
    campaign_ref: safeReference.optional(),
    territory_code: safeLabel.optional(),
    quantity: z.number().int().positive().max(100_000).optional(),
    value_minor: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.value_minor !== undefined && value.currency === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currency"],
        message: "currency_required_with_value_minor",
      });
    }
    if (value.currency !== undefined && value.value_minor === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value_minor"],
        message: "value_minor_required_with_currency",
      });
    }
  });

export const leadgridOutcomeEventInputSchema = z
  .object({
    event_type: z.enum(LEADGRID_OUTCOME_EVENT_TYPES),
    external_event_id: safeReference,
    occurred_at: z.string().datetime({ offset: true }),
    metadata: leadgridOutcomeMetadataSchema.default({}),
  })
  .strict()
  .superRefine((value, ctx) => {
    const occurredAt = new Date(value.occurred_at).getTime();
    if (occurredAt > Date.now() + 5 * 60 * 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["occurred_at"],
        message: "cannot_be_more_than_five_minutes_in_the_future",
      });
    }
  });

export type LeadgridOutcomeEventInput = z.infer<
  typeof leadgridOutcomeEventInputSchema
>;

export interface LeadgridOutcomeEventDto {
  id: string;
  organization_id: string;
  project_id: string;
  lead_id: string;
  event_type: (typeof LEADGRID_OUTCOME_EVENT_TYPES)[number];
  external_event_id: string;
  occurred_at: string;
  metadata: z.infer<typeof leadgridOutcomeMetadataSchema>;
  discovery_candidate_id: string | null;
  discovery_run_id: string | null;
  discovery_profile_id: string | null;
  discovery_attributed_at: string | null;
  schema_version: 1;
  created_at: string;
}

export type OutcomeEventWriteErrorCode =
  | "project_or_lead_not_found"
  | "idempotency_conflict";

export class OutcomeEventWriteError extends Error {
  constructor(
    readonly code: OutcomeEventWriteErrorCode,
    readonly status: 404 | 409,
  ) {
    super(code);
    this.name = "OutcomeEventWriteError";
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function outcomeEventRequestHash(input: {
  organizationId: string;
  projectId: string;
  leadId: string;
  event: LeadgridOutcomeEventInput;
}): string {
  return createHash("sha256")
    .update(
      stableJson({
        organization_id: input.organizationId,
        project_id: input.projectId,
        lead_id: input.leadId,
        event_type: input.event.event_type,
        external_event_id: input.event.external_event_id,
        occurred_at: new Date(input.event.occurred_at).toISOString(),
        metadata: input.event.metadata,
      }),
    )
    .digest("hex");
}

interface OutcomeEventRow extends LeadgridOutcomeEventDto {
  request_hash: string;
}

const OUTCOME_EVENT_RETURNING = `
  id::text,
  organization_id::text,
  project_id,
  lead_id::text,
  event_type,
  external_event_id,
  occurred_at::text,
  metadata,
  discovery_candidate_id::text,
  discovery_run_id::text,
  discovery_profile_id::text,
  discovery_attributed_at::text,
  schema_version,
  created_at::text,
  request_hash`;

function toDto(row: OutcomeEventRow): LeadgridOutcomeEventDto {
  return {
    id: row.id,
    organization_id: row.organization_id,
    project_id: row.project_id,
    lead_id: row.lead_id,
    event_type: row.event_type,
    external_event_id: row.external_event_id,
    occurred_at: row.occurred_at,
    metadata: row.metadata,
    discovery_candidate_id: row.discovery_candidate_id,
    discovery_run_id: row.discovery_run_id,
    discovery_profile_id: row.discovery_profile_id,
    discovery_attributed_at: row.discovery_attributed_at,
    schema_version: 1,
    created_at: row.created_at,
  };
}

/**
 * Records one immutable project outcome. Scope and server-derived first-touch
 * attribution are selected by the INSERT itself, so they share one PostgreSQL
 * statement snapshot. A valid API key alone can never attach an event to a
 * project or lead in another tenant.
 */
export async function recordLeadgridOutcomeEvent(
  pool: Pick<Pool, "query">,
  input: {
    organizationId: string;
    projectId: string;
    leadId: string;
    apiKeyId: string;
    idempotencyKey: string;
    event: LeadgridOutcomeEventInput;
  },
): Promise<{ event: LeadgridOutcomeEventDto; replayed: boolean }> {
  const normalizedOccurredAt = new Date(input.event.occurred_at).toISOString();
  const requestHash = outcomeEventRequestHash(input);
  const inserted = await pool.query<OutcomeEventRow>(
    `INSERT INTO leadgrid_project_outcome_events
       (organization_id, project_id, lead_id, api_key_id,
        event_type, external_event_id, idempotency_key, request_hash,
        occurred_at, metadata, discovery_candidate_id, discovery_run_id,
        discovery_profile_id, discovery_attributed_at)
     SELECT p.organization_id, p.id, c.id, $4::uuid,
            $5, $6, $7, $8, $9::timestamptz, $10::jsonb,
            attribution.candidate_id, attribution.run_id,
            attribution.profile_id, attribution.attributed_at
       FROM leadgrid_projects p
       JOIN crm_customers c
         ON c.project_id = p.id
        AND c.organization_id = p.organization_id
       LEFT JOIN LATERAL (
         SELECT feedback.candidate_id,
                feedback.run_id,
                run.profile_id,
                feedback.occurred_at AS attributed_at
           FROM leadgrid_discovery_feedback feedback
           JOIN leadgrid_discovery_candidates candidate
             ON candidate.organization_id = feedback.organization_id
            AND candidate.project_id = feedback.project_id
            AND candidate.id = feedback.candidate_id
            AND candidate.imported_lead_id = c.id
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
          WHERE feedback.organization_id = p.organization_id
            AND feedback.project_id = p.id
            AND feedback.lead_id = c.id
            AND feedback.event_type = 'decision'
            AND feedback.value = 'approve'
            AND feedback.run_id IS NOT NULL
            AND feedback.occurred_at <= $9::timestamptz
          ORDER BY feedback.occurred_at ASC,
                   feedback.created_at ASC,
                   feedback.id ASC
          LIMIT 1
       ) attribution ON TRUE
      WHERE p.organization_id = $1::uuid
        AND p.id = $2
        AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
        AND (p.project_type IS NULL OR p.project_type NOT IN (
          'feature_film','documentary','film','short_film','tv_series',
          'commercial','music_video','casting'))
        AND c.id = $3::uuid
        AND c.archived_at IS NULL
      LIMIT 1
     ON CONFLICT DO NOTHING
     RETURNING ${OUTCOME_EVENT_RETURNING}`,
    [
      input.organizationId,
      input.projectId,
      input.leadId,
      input.apiKeyId,
      input.event.event_type,
      input.event.external_event_id,
      input.idempotencyKey,
      requestHash,
      normalizedOccurredAt,
      JSON.stringify(input.event.metadata),
    ],
  );
  if (inserted.rows[0]) {
    return { event: toDto(inserted.rows[0]), replayed: false };
  }

  // A second statement gets a fresh READ COMMITTED snapshot after a
  // concurrent INSERT ... ON CONFLICT has finished waiting.
  const existing = await pool.query<OutcomeEventRow>(
    `SELECT ${OUTCOME_EVENT_RETURNING}
       FROM leadgrid_project_outcome_events
      WHERE organization_id = $1::uuid
        AND project_id = $2
        AND (
          idempotency_key = $3
          OR external_event_id = $4
        )
      ORDER BY created_at ASC
      LIMIT 2`,
    [
      input.organizationId,
      input.projectId,
      input.idempotencyKey,
      input.event.external_event_id,
    ],
  );

  if (
    existing.rows.length === 1 &&
    existing.rows[0].request_hash === requestHash
  ) {
    return { event: toDto(existing.rows[0]), replayed: true };
  }
  if (existing.rows.length > 0) {
    throw new OutcomeEventWriteError("idempotency_conflict", 409);
  }

  // INSERT ... SELECT returns no row both for an invalid scope and for an
  // idempotency conflict. The fresh conflict snapshot above handles the latter;
  // this failure-only lookup preserves a non-enumerating 404 for the former.
  const scope = await pool.query(
    `SELECT 1
       FROM leadgrid_projects p
       JOIN crm_customers c
         ON c.project_id = p.id
        AND c.organization_id = p.organization_id
      WHERE p.organization_id = $1::uuid
        AND p.id = $2
        AND (p.status IS NULL OR p.status NOT IN ('archived', 'deleted'))
        AND (p.project_type IS NULL OR p.project_type NOT IN (
          'feature_film','documentary','film','short_film','tv_series',
          'commercial','music_video','casting'))
        AND c.id = $3::uuid
        AND c.archived_at IS NULL
      LIMIT 1`,
    [input.organizationId, input.projectId, input.leadId],
  );
  if (!scope.rows[0]) {
    throw new OutcomeEventWriteError("project_or_lead_not_found", 404);
  }
  throw new OutcomeEventWriteError("idempotency_conflict", 409);
}
