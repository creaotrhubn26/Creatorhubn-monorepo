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
      `UPDATE lead_recommendations
          SET status = 'expired'
        WHERE status IN ('pending','accepted')
          AND expires_at IS NOT NULL
          AND expires_at < NOW()`,
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
  // FIX (2026-06-22): crm_customers har INGEN organization_id-kolonne.
  // Org-relasjon hentes via owner_user_id → organization_members (PR
  // #837/#848-mønster). Vi henter "primary org" for hver lead-eier som
  // første org de tilhører.
  try {
    const overdueRows = await pool.query<{
      id: string;
      organization_id: string | null;
      assigned_user_id: string | null;
      name: string;
      next_follow_up_at: string;
    }>(
      `SELECT c.id::text,
              (SELECT om.organization_id::text FROM organization_members om
                WHERE om.user_id = c.owner_user_id ORDER BY om.joined_at ASC LIMIT 1)
              AS organization_id,
              c.assigned_user_id::text,
              c.name,
              c.next_follow_up_at::text
         FROM crm_customers c
        WHERE c.archived_at IS NULL
          AND c.next_follow_up_at IS NOT NULL
          AND c.next_follow_up_at < NOW() - INTERVAL '24 hours'
          AND c.owner_user_id IS NOT NULL`,
    );
    overdue = overdueRows.rowCount ?? 0;
    for (const row of overdueRows.rows) {
      if (!row.organization_id) continue;
      void emitWebhook(pool, "followup.overdue", {
        lead_id: row.id,
        assigned_user_id: row.assigned_user_id,
        name: row.name,
        next_follow_up_at: row.next_follow_up_at,
      }, row.organization_id);
    }

    const dueRows = await pool.query<{
      id: string;
      organization_id: string | null;
      assigned_user_id: string | null;
      name: string;
      next_follow_up_at: string;
    }>(
      `SELECT c.id::text,
              (SELECT om.organization_id::text FROM organization_members om
                WHERE om.user_id = c.owner_user_id ORDER BY om.joined_at ASC LIMIT 1)
              AS organization_id,
              c.assigned_user_id::text,
              c.name,
              c.next_follow_up_at::text
         FROM crm_customers c
        WHERE c.archived_at IS NULL
          AND c.next_follow_up_at IS NOT NULL
          AND c.next_follow_up_at >= NOW()
          AND c.next_follow_up_at < NOW() + INTERVAL '24 hours'
          AND c.owner_user_id IS NOT NULL`,
    );
    due = dueRows.rowCount ?? 0;
    for (const row of dueRows.rows) {
      if (!row.organization_id) continue;
      void emitWebhook(pool, "followup.due", {
        lead_id: row.id,
        assigned_user_id: row.assigned_user_id,
        name: row.name,
        next_follow_up_at: row.next_follow_up_at,
      }, row.organization_id);
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
        // FIX (2026-06-22): crm_customers har ikke organization_id.
        // Vi krever bare at lead har en eier (owner_user_id). Org-relasjon
        // hentes nedstrøms i computeIntelligenceForLead via fetchLead.
        const rows = await pool.query<{ id: string }>(
          `SELECT id::text
             FROM crm_customers
            WHERE archived_at IS NULL
              AND owner_user_id IS NOT NULL
              AND lead_status != 'do_not_contact'
            ORDER BY scored_at ASC NULLS FIRST
            LIMIT $1`,
          [MAX_PER_RUN],
        );

        let ok = 0;
        let failed = 0;
        const chunkSize = adaptiveChunkSize(rows.rows.length);
        for (let i = 0; i < rows.rows.length; i += chunkSize) {
          const chunk = rows.rows.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (r) => {
              try {
                await computeIntelligenceForLead(pool, r.id, {
                  trigger: "cron",
                  persist: true,
                });
                ok += 1;
              } catch (err) {
                failed += 1;
                console.warn("[intelligence-cron] lead failed", r.id, err);
              }
            }),
          );
        }

        const followUp = await emitFollowUpEvents(pool);
        const expired = await expireOldRecommendations(pool);

        res.json({
          ok: true,
          processed: ok,
          failed,
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
