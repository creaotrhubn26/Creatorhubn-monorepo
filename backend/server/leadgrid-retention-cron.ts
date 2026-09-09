/**
 * leadgrid-retention-cron.ts
 *
 * Daglig data-retention-cleanup for Leadgrid:
 *   - lead_scores_history > 90 dager → DELETE
 *   - lead_recommendations (dismissed) > 30 dager → DELETE
 *   - lead_recommendations (expired) > 30 dager → DELETE
 *   - webhook_delivery_queue (exhausted) > 30 dager → DELETE
 *   - lead_territory_events > 180 dager → DELETE
 *   - utløpte Google Places-attesteringer → bounded DELETE
 *   - ubehandlede talentprospects etter 90 dager → bounded do-not-contact
 *
 * Trigger: GitHub Actions (workflow: leadgrid-retention-cleanup.yml)
 *          @ 03:00 UTC daglig (1 time før intelligence-rescore for
 *          å holde history-tabellen slank).
 *
 * Auth: samme `LEADGRID_INTELLIGENCE_CRON_TOKEN` som rescore-cronen,
 *       med timing-safe compare.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { captureLeadgridError } from "./sentry-init.js";

interface Deps {
  app: Express;
  pool: Pool;
}

const SCORES_HISTORY_DAYS = 90;
const RECOMMENDATIONS_DISMISSED_DAYS = 30;
const RECOMMENDATIONS_EXPIRED_DAYS = 30;
const WEBHOOK_QUEUE_EXHAUSTED_DAYS = 30;
const TERRITORY_EVENTS_DAYS = 180;
export const DISCOVERY_PLACE_CONFIRMATION_BATCH_SIZE = 500;
export const DISCOVERY_PLACE_CONFIRMATION_MAX_BATCHES = 20;
export const TALENT_PROSPECT_PRIVACY_BATCH_SIZE = 500;
export const TALENT_PROSPECT_PRIVACY_MAX_BATCHES = 20;

interface PlaceConfirmationCleanupOptions {
  batchSize?: number;
  maxBatches?: number;
  now?: Date;
}

export interface PlaceConfirmationCleanupResult {
  deleted: number;
  batches: number;
  limitReached: boolean;
}

export interface TalentProspectPrivacyResult {
  suppressed: number;
  batches: number;
  limitReached: boolean;
}

export async function suppressDueTalentProspects(
  pool: Pick<Pool, "query">,
  options: PlaceConfirmationCleanupOptions = {},
): Promise<TalentProspectPrivacyResult> {
  const batchSize = boundedPositiveInteger(
    options.batchSize,
    TALENT_PROSPECT_PRIVACY_BATCH_SIZE,
    5_000,
  );
  const maxBatches = boundedPositiveInteger(
    options.maxBatches,
    TALENT_PROSPECT_PRIVACY_MAX_BATCHES,
    100,
  );
  const cutoff = options.now ?? new Date();
  let suppressed = 0;
  let batches = 0;
  while (batches < maxBatches) {
    const result = await pool.query(
      `WITH due AS MATERIALIZED (
         SELECT contact.id,
                contact.organization_id,
                contact.project_id,
                contact.customer_id
           FROM leadgrid_customer_contacts contact
           JOIN crm_customers customer
             ON customer.id = contact.customer_id
            AND customer.organization_id = contact.organization_id
            AND customer.project_id = contact.project_id
          WHERE contact.subject_kind = 'talent'
            AND contact.privacy_status IN ('notice_required', 'notice_sent')
            AND contact.consent_status <> 'received'
            AND contact.privacy_review_due_at <= $2::timestamptz
            AND customer.archived_at IS NULL
            AND customer.lead_status <> 'do_not_contact'
          ORDER BY contact.privacy_review_due_at, contact.id
          LIMIT $1
          FOR UPDATE OF contact SKIP LOCKED
       )
       UPDATE crm_customers customer
          SET lead_status = 'do_not_contact',
              import_raw_data = (
                CASE WHEN jsonb_typeof(customer.import_raw_data) = 'object'
                  THEN customer.import_raw_data ELSE '{}'::jsonb END
              ) || jsonb_build_object(
                'talent_privacy_retention',
                jsonb_build_object(
                  'status', 'expired',
                  'suppressed_at', NOW(),
                  'reason', 'privacy_review_deadline_elapsed'
                )
              ),
              updated_at = NOW()
         FROM due
        WHERE customer.id = due.customer_id
          AND customer.organization_id = due.organization_id
          AND customer.project_id = due.project_id`,
      [batchSize, cutoff.toISOString()],
    );
    const count = result.rowCount ?? 0;
    suppressed += count;
    batches += 1;
    if (count < batchSize) {
      return { suppressed, batches, limitReached: false };
    }
  }
  const remaining = await pool.query(
    `SELECT EXISTS (
       SELECT 1
         FROM leadgrid_customer_contacts contact
         JOIN crm_customers customer
           ON customer.id = contact.customer_id
          AND customer.organization_id = contact.organization_id
          AND customer.project_id = contact.project_id
        WHERE contact.subject_kind = 'talent'
          AND contact.privacy_status IN ('notice_required', 'notice_sent')
          AND contact.consent_status <> 'received'
          AND contact.privacy_review_due_at <= $1::timestamptz
          AND customer.archived_at IS NULL
          AND customer.lead_status <> 'do_not_contact'
        LIMIT 1
     ) AS has_remaining`,
    [cutoff.toISOString()],
  );
  return {
    suppressed,
    batches,
    limitReached: remaining.rows[0]?.has_remaining === true,
  };
}

function boundedPositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value)));
}

/**
 * Deletes expired, short-lived Place-ID attestations in deterministic batches.
 *
 * The cron connection is intentionally organization-agnostic because retention
 * must cover every tenant. Tenant isolation is preserved by selecting and
 * deleting on the table's complete composite primary key. SKIP LOCKED makes
 * overlapping cron/manual invocations cooperate instead of processing the same
 * rows, while the batch and sweep caps prevent an unbounded delete transaction.
 */
export async function cleanupExpiredDiscoveryPlaceConfirmations(
  pool: Pick<Pool, "query">,
  options: PlaceConfirmationCleanupOptions = {},
): Promise<PlaceConfirmationCleanupResult> {
  const batchSize = boundedPositiveInteger(
    options.batchSize,
    DISCOVERY_PLACE_CONFIRMATION_BATCH_SIZE,
    5_000,
  );
  const maxBatches = boundedPositiveInteger(
    options.maxBatches,
    DISCOVERY_PLACE_CONFIRMATION_MAX_BATCHES,
    100,
  );
  const cutoff = options.now ?? new Date();
  let deleted = 0;
  let batches = 0;

  while (batches < maxBatches) {
    const result = await pool.query(
      `WITH expired AS MATERIALIZED (
         SELECT organization_id,
                project_id,
                run_id,
                candidate_id,
                place_id,
                requested_by
           FROM leadgrid_discovery_place_confirmations
          WHERE expires_at <= $2::timestamptz
          ORDER BY expires_at ASC,
                   organization_id ASC,
                   project_id ASC,
                   run_id ASC,
                   candidate_id ASC,
                   place_id ASC,
                   requested_by ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM leadgrid_discovery_place_confirmations AS target
       USING expired
       WHERE target.organization_id = expired.organization_id
         AND target.project_id = expired.project_id
         AND target.run_id = expired.run_id
         AND target.candidate_id = expired.candidate_id
         AND target.place_id = expired.place_id
         AND target.requested_by = expired.requested_by`,
      [batchSize, cutoff.toISOString()],
    );
    const batchDeleted = result.rowCount ?? 0;
    deleted += batchDeleted;
    batches += 1;

    if (batchDeleted < batchSize) {
      return { deleted, batches, limitReached: false };
    }
  }

  const remaining = await pool.query(
    `SELECT EXISTS (
       SELECT 1
         FROM leadgrid_discovery_place_confirmations
        WHERE expires_at <= $1::timestamptz
        LIMIT 1
     ) AS has_remaining`,
    [cutoff.toISOString()],
  );

  return {
    deleted,
    batches,
    limitReached: remaining.rows[0]?.has_remaining === true,
  };
}

export function registerLeadgridRetentionCron(deps: Deps): void {
  const { app, pool } = deps;

  app.post(
    "/api/leadgrid/cron/retention-cleanup",
    async (req: Request, res: Response): Promise<void> => {
      const expected = process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
      const provided = req.headers["x-cron-trigger-token"];
      if (!expected) {
        res.status(503).json({ error: "cron_token_not_configured" });
        return;
      }
      if (typeof provided !== "string" || provided.length !== expected.length) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }
      // Timing-safe compare — beskytter mot timing-attack på prefix
      const { timingSafeEqual } = await import("crypto");
      if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }

      const start = Date.now();
      const stats: Record<string, number | boolean> = {};
      let placeConfirmationCleanupFailed = false;
      let placeConfirmationCleanupBacklog = false;
      let talentPrivacyCleanupFailed = false;
      let talentPrivacyCleanupBacklog = false;
      try {
        // 1. lead_scores_history
        try {
          const r1 = await pool.query(
            `DELETE FROM lead_scores_history WHERE computed_at < NOW() - ($1 || ' days')::interval`,
            [String(SCORES_HISTORY_DAYS)],
          );
          stats.scores_history_deleted = r1.rowCount ?? 0;
        } catch (err) {
          console.warn("[retention-cron] scores_history feilet:", err);
          stats.scores_history_deleted = -1;
        }

        // 2. lead_recommendations (dismissed)
        try {
          const r2 = await pool.query(
            `DELETE FROM lead_recommendations
              WHERE status = 'dismissed' AND created_at < NOW() - ($1 || ' days')::interval`,
            [String(RECOMMENDATIONS_DISMISSED_DAYS)],
          );
          stats.dismissed_recommendations_deleted = r2.rowCount ?? 0;
        } catch (err) {
          console.warn(
            "[retention-cron] dismissed_recommendations feilet:",
            err,
          );
          stats.dismissed_recommendations_deleted = -1;
        }

        // 3. lead_recommendations (expired)
        try {
          const r3 = await pool.query(
            `DELETE FROM lead_recommendations
              WHERE status = 'expired' AND created_at < NOW() - ($1 || ' days')::interval`,
            [String(RECOMMENDATIONS_EXPIRED_DAYS)],
          );
          stats.expired_recommendations_deleted = r3.rowCount ?? 0;
        } catch (err) {
          console.warn("[retention-cron] expired_recommendations feilet:", err);
          stats.expired_recommendations_deleted = -1;
        }

        // 4. webhook_delivery_queue (exhausted) — tabell kanskje ikke finnes
        try {
          const r4 = await pool.query(
            `DELETE FROM webhook_delivery_queue
              WHERE status = 'exhausted' AND created_at < NOW() - ($1 || ' days')::interval`,
            [String(WEBHOOK_QUEUE_EXHAUSTED_DAYS)],
          );
          stats.webhook_queue_deleted = r4.rowCount ?? 0;
        } catch {
          stats.webhook_queue_deleted = -1;
        }

        // 5. lead_territory_events (audit-log)
        try {
          const r5 = await pool.query(
            `DELETE FROM lead_territory_events WHERE created_at < NOW() - ($1 || ' days')::interval`,
            [String(TERRITORY_EVENTS_DAYS)],
          );
          stats.territory_events_deleted = r5.rowCount ?? 0;
        } catch {
          stats.territory_events_deleted = -1;
        }
        // 6. Short-lived Google Places attestations. This is deliberately part
        // of the one existing daily retention chain, not a second scheduler.
        try {
          const cleanup = await cleanupExpiredDiscoveryPlaceConfirmations(pool);
          stats.place_confirmations_deleted = cleanup.deleted;
          stats.place_confirmation_batches = cleanup.batches;
          placeConfirmationCleanupBacklog = cleanup.limitReached;
          stats.place_confirmation_limit_reached = cleanup.limitReached;
          if (cleanup.limitReached) {
            console.warn(
              "[retention-cron] Place-attesteringer traff bounded sweep-grensen; resten tas i senere kjøringer",
            );
          }
        } catch (err) {
          console.warn("[retention-cron] place_confirmations feilet:", err);
          captureLeadgridError("retention-cron-place-confirmations", err, {
            stats,
          });
          stats.place_confirmations_deleted = -1;
          placeConfirmationCleanupFailed = true;
        }

        // 7. A public-data person prospect is not a consented Role Room talent.
        // Suppress outreach after the review window unless a user has already
        // handled the notice/opt-out state.
        try {
          const cleanup = await suppressDueTalentProspects(pool);
          stats.talent_prospects_suppressed = cleanup.suppressed;
          stats.talent_privacy_batches = cleanup.batches;
          stats.talent_privacy_limit_reached = cleanup.limitReached;
          talentPrivacyCleanupBacklog = cleanup.limitReached;
        } catch (err) {
          console.warn("[retention-cron] talent-personvern feilet:", err);
          captureLeadgridError("retention-cron-talent-privacy", err, { stats });
          stats.talent_prospects_suppressed = -1;
          talentPrivacyCleanupFailed = true;
        }

        const durationMs = Date.now() - start;
        if (placeConfirmationCleanupFailed || talentPrivacyCleanupFailed) {
          res.status(500).json({
            error: talentPrivacyCleanupFailed
              ? "talent_privacy_retention_failed"
              : "place_confirmation_retention_failed",
            stats,
            duration_ms: durationMs,
          });
          return;
        }
        if (placeConfirmationCleanupBacklog || talentPrivacyCleanupBacklog) {
          res.status(503).json({
            ok: false,
            error: talentPrivacyCleanupBacklog
              ? "talent_privacy_retention_backlog"
              : "place_confirmation_retention_backlog",
            stats,
            duration_ms: durationMs,
          });
          return;
        }
        console.log(`[retention-cron] OK ${durationMs}ms:`, stats);
        res.json({ ok: true, stats, duration_ms: durationMs });
      } catch (err) {
        captureLeadgridError("retention-cron", err, { stats });
        const durationMs = Date.now() - start;
        res.status(500).json({
          error: "retention_failed",
          detail: String(err).slice(0, 300),
          stats,
          duration_ms: durationMs,
        });
      }
    },
  );
}
