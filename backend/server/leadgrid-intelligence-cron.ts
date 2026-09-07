/**
 * leadgrid-intelligence-cron.ts
 *
 * Cron-endepunkt for daglig re-scoring av alle non-archived leads.
 *
 * Trigger: GitHub Actions (workflow: leadgrid-intelligence-rescore.yml)
 *          eller hvilken som helst kilde med
 *          `x-cron-trigger-token: LEADGRID_INTELLIGENCE_CRON_TOKEN`.
 *
 * Bunting: 50-er-chunks, max 10 000 leads per kjøring (safeguard).
 *
 * Tillegg-effekter:
 *   - Emitterer followup.due / followup.overdue events der relevant.
 *   - Markerer pending recommendations som 'expired' når expires_at < NOW().
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { computeIntelligenceForLead } from "./leadgrid-intelligence-engine.js";
import { emitWebhook } from "./webhook-emitter.js";

interface Deps {
  app: Express;
  pool: Pool;
}

const MAX_PER_RUN = 10_000;

/**
 * Adaptiv chunk-størrelse for cron-iterasjon. Større batches ved høyere
 * total fordi pool-kapasiteten (default max=30) tåler mer samtidig
 * I/O, og hver intelligence-call er ÉN DB-roundtrip etter PR #870
 * (CTE-batchfetch).
 */
function adaptiveChunkSize(totalLeads: number): number {
  if (totalLeads < 100) return 25;
  if (totalLeads < 1000) return 50;
  if (totalLeads < 5000) return 75;
  return 100;
}

async function expireOldRecommendations(pool: Pool): Promise<number> {
  try {
    const r = await pool.query(
      `UPDATE lead_recommendations recommendation
          SET status = 'expired'
         FROM crm_customers customer
         JOIN leadgrid_projects project
           ON project.id = customer.project_id
          AND project.organization_id = customer.organization_id
        WHERE recommendation.lead_id = customer.id
          AND recommendation.organization_id = customer.organization_id
          AND recommendation.project_id = customer.project_id
          AND recommendation.status IN ('pending','accepted')
          AND recommendation.expires_at IS NOT NULL
          AND recommendation.expires_at < NOW()`,
    );
    return r.rowCount ?? 0;
  } catch (err) {
    console.warn("[intelligence-cron] expireOldRecommendations failed:", err);
    return 0;
  }
}

async function emitFollowUpEvents(pool: Pool): Promise<{ due: number; overdue: number }> {
  let due = 0;
  let overdue = 0;
  try {
    const overdueRows = await pool.query<{
      id: string;
      organization_id: string;
      project_id: string;
      assigned_user_id: string | null;
      name: string;
      next_follow_up_at: string;
    }>(
      `SELECT c.id::text,
              c.organization_id::text AS organization_id,
              c.project_id::text AS project_id,
              c.assigned_user_id::text,
              c.name,
              c.next_follow_up_at::text
         FROM crm_customers c
         JOIN leadgrid_projects project
           ON project.id = c.project_id
          AND project.organization_id = c.organization_id
        WHERE c.archived_at IS NULL
          AND c.organization_id IS NOT NULL
          AND c.project_id IS NOT NULL
          AND c.next_follow_up_at IS NOT NULL
          AND c.next_follow_up_at < NOW() - INTERVAL '24 hours'
          AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))`,
    );
    overdue = overdueRows.rowCount ?? 0;
    for (const row of overdueRows.rows) {
      void emitWebhook(pool, "followup.overdue", {
        lead_id: row.id,
        organization_id: row.organization_id,
        project_id: row.project_id,
        assigned_user_id: row.assigned_user_id,
        name: row.name,
        next_follow_up_at: row.next_follow_up_at,
      }, row.organization_id, row.project_id);
    }

    const dueRows = await pool.query<{
      id: string;
      organization_id: string;
      project_id: string;
      assigned_user_id: string | null;
      name: string;
      next_follow_up_at: string;
    }>(
      `SELECT c.id::text,
              c.organization_id::text AS organization_id,
              c.project_id::text AS project_id,
              c.assigned_user_id::text,
              c.name,
              c.next_follow_up_at::text
         FROM crm_customers c
         JOIN leadgrid_projects project
           ON project.id = c.project_id
          AND project.organization_id = c.organization_id
        WHERE c.archived_at IS NULL
          AND c.organization_id IS NOT NULL
          AND c.project_id IS NOT NULL
          AND c.next_follow_up_at IS NOT NULL
          AND c.next_follow_up_at >= NOW()
          AND c.next_follow_up_at < NOW() + INTERVAL '24 hours'
          AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))`,
    );
    due = dueRows.rowCount ?? 0;
    for (const row of dueRows.rows) {
      void emitWebhook(pool, "followup.due", {
        lead_id: row.id,
        organization_id: row.organization_id,
        project_id: row.project_id,
        assigned_user_id: row.assigned_user_id,
        name: row.name,
        next_follow_up_at: row.next_follow_up_at,
      }, row.organization_id, row.project_id);
    }
  } catch (err) {
    console.warn("[intelligence-cron] emitFollowUpEvents failed:", err);
  }
  return { due, overdue };
}

export function registerLeadgridIntelligenceCron(deps: Deps): void {
  const { app, pool } = deps;

  app.post(
    "/api/leadgrid/intelligence/cron/daily-rescore",
    async (req: Request, res: Response): Promise<void> => {
      const expected = process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
      const provided = req.headers["x-cron-trigger-token"];
      if (!expected) {
        res.status(503).json({ error: "cron_token_not_configured" });
        return;
      }
      // Timing-safe compare — beskytter mot timing-attack på token-prefiks.
      // Provided kan være string | string[] | undefined fra Express.
      if (typeof provided !== "string" || provided.length !== expected.length) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }
      const { timingSafeEqual } = await import("crypto");
      if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }

      const startedAt = Date.now();
      try {
        // The persisted customer/project tuple is authoritative. Legacy leads
        // without both keys are intentionally skipped rather than inferred.
        const rows = await pool.query<{
          id: string;
          organization_id: string;
          project_id: string;
        }>(
          `SELECT customer.id::text,
                  customer.organization_id::text,
                  customer.project_id::text
             FROM crm_customers customer
             JOIN leadgrid_projects project
               ON project.id = customer.project_id
              AND project.organization_id = customer.organization_id
            WHERE customer.archived_at IS NULL
              AND customer.organization_id IS NOT NULL
              AND customer.project_id IS NOT NULL
              AND customer.lead_status != 'do_not_contact'
              AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
            ORDER BY customer.scored_at ASC NULLS FIRST
            LIMIT $1`,
          [MAX_PER_RUN],
        );

        let ok = 0;
        let failed = 0;
        let skippedNoProjectScope = 0;
        const chunkSize = adaptiveChunkSize(rows.rows.length);
        for (let i = 0; i < rows.rows.length; i += chunkSize) {
          const chunk = rows.rows.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (r) => {
              try {
                const result = await computeIntelligenceForLead(pool, r.id, {
                  trigger: "cron",
                  persist: true,
                  expectedScope: {
                    organizationId: r.organization_id,
                    projectId: r.project_id,
                  },
                });
                if (result) ok += 1;
                else skippedNoProjectScope += 1;
              } catch (err) {
                failed += 1;
                console.warn(
                  "[intelligence-cron] lead failed",
                  r.id,
                  r.organization_id,
                  r.project_id,
                  err,
                );
              }
            }),
          );
        }

        const followUp = await emitFollowUpEvents(pool);
        const expired = await expireOldRecommendations(pool);

        const allProcessed = failed === 0 && skippedNoProjectScope === 0;
        res.status(allProcessed ? 200 : 500).json({
          ok: allProcessed,
          processed: ok,
          failed,
          skipped_no_organization: skippedNoProjectScope,
          skipped_no_project_scope: skippedNoProjectScope,
          total_candidates: rows.rowCount,
          chunk_size: chunkSize,
          followup_due: followUp.due,
          followup_overdue: followUp.overdue,
          expired_recommendations: expired,
          duration_ms: Date.now() - startedAt,
        });
      } catch (err) {
        console.error("[intelligence-cron] fatal", err);
        res.status(500).json({
          error: "cron_failed",
          detail: String(err).slice(0, 300),
          duration_ms: Date.now() - startedAt,
        });
      }
    },
  );
}
