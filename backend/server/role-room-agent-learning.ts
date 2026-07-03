/**
 * The Role Room Agent — kontinuerlig-lærings-loop, DB-lag (Lag 0 + 1 + 2a).
 *
 * Ren tallknusing ligger i role-room-agent-learning-aggregate.ts (testet);
 * dette modulen er I/O-limet mot Postgres (tabellene i mig 0363).
 *
 * Alt er best-effort: hvis tabellene ikke finnes ennå (migrasjon ikke kjørt)
 * eller DB hikker, logger vi og returnerer en trygg default, slik at
 * bootstrap-flyten aldri knekker (samme mønster som persistResearchVersion).
 *
 * GDPR (kaller-ansvar, håndhevet i rute-laget):
 *   - captureFieldFeedback SKAL kalles etter requireActiveConsent(project,…).
 *   - ai_value/final_value SKAL være pseudonymisert (buildBackendPseudonymMap)
 *     før de sendes hit for fritekstfelt. NACE/businessModel/geo/confidence er
 *     ikke-personlige og lagres som de er.
 */

import type { Pool } from "pg";
import {
  aggregateNaceBusinessModel,
  computeConfidenceCalibration,
  type AggregateOptions,
  type FieldFeedbackRow,
  type OverrideProposal,
} from "./role-room-agent-learning-aggregate.js";
import type { NaceBusinessModelOverride } from "./role-room-agent-learned-overrides.js";

const log = (event: string, extra: Record<string, unknown> = {}): void => {
  try {
    console.warn(`[role-room-agent:learning] ${event}`, JSON.stringify(extra));
  } catch {
    /* logging never blocks */
  }
};

// ---------------------------------------------------------------------------
// Lag 0 — capture the producer draft→final correction per field.
// ---------------------------------------------------------------------------

export interface CaptureFieldFeedbackParams {
  researchId: string;
  projectId: string;
  fieldPath: string;
  action: FieldFeedbackRow["action"];
  /** Pseudonymized already for free-text fields. */
  aiValue: string | null;
  finalValue: string | null;
  naceCode: string | null;
  businessModel: string | null;
  geoScope: string | null;
  sourceChain: string[] | null;
  confidence: number | null;
  createdBy: string | null;
}

/** UPSERT one field-feedback row. Re-saving the same field for the same
 *  research updates the row (a producer may edit twice before finalizing). */
export async function captureFieldFeedback(
  pool: Pool,
  params: CaptureFieldFeedbackParams,
): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO role_room_agent_field_feedback (
         research_id, project_id, field_path, action, ai_value, final_value,
         nace_code, business_model, geo_scope, source_chain, confidence, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (research_id, field_path) DO UPDATE SET
         action = EXCLUDED.action,
         ai_value = EXCLUDED.ai_value,
         final_value = EXCLUDED.final_value,
         nace_code = EXCLUDED.nace_code,
         business_model = EXCLUDED.business_model,
         geo_scope = EXCLUDED.geo_scope,
         source_chain = EXCLUDED.source_chain,
         confidence = EXCLUDED.confidence,
         created_by = EXCLUDED.created_by,
         created_at = now()`,
      [
        params.researchId,
        params.projectId,
        params.fieldPath,
        params.action,
        params.aiValue,
        params.finalValue,
        params.naceCode,
        params.businessModel,
        params.geoScope,
        params.sourceChain,
        params.confidence,
        params.createdBy,
      ],
    );
    return true;
  } catch (err) {
    log("capture_failed", { error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Lag 2a — load APPROVED overrides for runtime consumption.
// ---------------------------------------------------------------------------

/** Load approved NACE→businessModel overrides. Returns [] on any error so the
 *  bootstrap grounding pass simply falls back to the static NACE table. */
export async function loadApprovedNaceBusinessModelOverrides(
  pool: Pool,
): Promise<NaceBusinessModelOverride[]> {
  try {
    const result = await pool.query<{ override_key: string; proposed_value: string }>(
      `SELECT override_key, proposed_value
         FROM role_room_agent_learned_overrides
        WHERE override_type = 'nace_business_model' AND status = 'approved'`,
    );
    return result.rows
      .filter((r) => typeof r.override_key === "string" && typeof r.proposed_value === "string")
      .map((r) => ({ nacePrefix: r.override_key, businessModel: r.proposed_value }));
  } catch (err) {
    log("load_overrides_failed", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Lag 1 — nightly aggregation job. Reads feedback, runs the pure aggregation,
// UPSERTs PROPOSED overrides (human approves before runtime uses them).
// ---------------------------------------------------------------------------

export interface AggregationRunResult {
  feedbackRows: number;
  proposalsUpserted: number;
}

/** Run the aggregation over recent feedback and persist proposals. Only rows
 *  still in status='proposed' are updated on conflict — a human 'approved'/
 *  'rejected' decision is never silently overwritten by fresh evidence. */
export async function runLearningAggregation(
  pool: Pool,
  options: AggregateOptions & { sinceDays?: number } = {},
): Promise<AggregationRunResult> {
  let rows: FieldFeedbackRow[] = [];
  try {
    const sinceDays = options.sinceDays ?? 180;
    const result = await pool.query<{
      field_path: string;
      action: FieldFeedbackRow["action"];
      ai_value: string | null;
      final_value: string | null;
      nace_code: string | null;
      business_model: string | null;
      geo_scope: string | null;
      source_chain: string[] | null;
      confidence: number | null;
    }>(
      `SELECT field_path, action, ai_value, final_value, nace_code,
              business_model, geo_scope, source_chain, confidence
         FROM role_room_agent_field_feedback
        WHERE created_at > now() - ($1 || ' days')::interval`,
      [String(sinceDays)],
    );
    rows = result.rows.map((r) => ({
      fieldPath: r.field_path,
      action: r.action,
      aiValue: r.ai_value,
      finalValue: r.final_value,
      naceCode: r.nace_code,
      businessModel: r.business_model,
      geoScope: r.geo_scope,
      sourceChain: r.source_chain,
      confidence: r.confidence,
    }));
  } catch (err) {
    log("aggregation_read_failed", { error: err instanceof Error ? err.message : String(err) });
    return { feedbackRows: 0, proposalsUpserted: 0 };
  }

  const proposals: OverrideProposal[] = [
    ...aggregateNaceBusinessModel(rows, options),
    ...computeConfidenceCalibration(rows, options),
  ];

  let upserted = 0;
  for (const proposal of proposals) {
    try {
      await pool.query(
        `INSERT INTO role_room_agent_learned_overrides (
           override_type, override_key, proposed_value, sample_count,
           agreement_pct, rationale, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'proposed')
         ON CONFLICT (override_type, override_key) DO UPDATE SET
           proposed_value = EXCLUDED.proposed_value,
           sample_count = EXCLUDED.sample_count,
           agreement_pct = EXCLUDED.agreement_pct,
           rationale = EXCLUDED.rationale,
           updated_at = now()
         WHERE role_room_agent_learned_overrides.status = 'proposed'`,
        [
          proposal.overrideType,
          proposal.overrideKey,
          proposal.proposedValue,
          proposal.sampleCount,
          proposal.agreementPct,
          proposal.rationale,
        ],
      );
      upserted += 1;
    } catch (err) {
      log("aggregation_upsert_failed", {
        key: proposal.overrideKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log("aggregation_done", { feedbackRows: rows.length, proposalsUpserted: upserted });
  return { feedbackRows: rows.length, proposalsUpserted: upserted };
}

// ---------------------------------------------------------------------------
// Admin review surface (human-in-the-loop).
// ---------------------------------------------------------------------------

export interface OverrideProposalRow {
  id: string;
  overrideType: string;
  overrideKey: string;
  proposedValue: string;
  sampleCount: number;
  agreementPct: number;
  status: string;
  rationale: string | null;
  createdAt: string;
}

export async function listOverrideProposals(
  pool: Pool,
  status: "proposed" | "approved" | "rejected" | "all" = "proposed",
): Promise<OverrideProposalRow[]> {
  try {
    const clause = status === "all" ? "" : "WHERE status = $1";
    const params = status === "all" ? [] : [status];
    const result = await pool.query(
      `SELECT id, override_type, override_key, proposed_value, sample_count,
              agreement_pct, status, rationale, created_at
         FROM role_room_agent_learned_overrides
         ${clause}
        ORDER BY sample_count DESC, created_at DESC`,
      params,
    );
    return result.rows.map((r) => ({
      id: String(r.id),
      overrideType: r.override_type,
      overrideKey: r.override_key,
      proposedValue: r.proposed_value,
      sampleCount: Number(r.sample_count),
      agreementPct: Number(r.agreement_pct),
      status: r.status,
      rationale: r.rationale ?? null,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  } catch (err) {
    log("list_proposals_failed", { error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}

/** Approve or reject a proposal. Only 'approved' rows are consumed at runtime. */
export async function reviewOverrideProposal(
  pool: Pool,
  id: string,
  decision: "approved" | "rejected",
  reviewer: string | null,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE role_room_agent_learned_overrides
          SET status = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
        WHERE id = $1`,
      [id, decision, reviewer],
    );
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    log("review_failed", { id, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
