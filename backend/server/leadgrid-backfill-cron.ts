/**
 * leadgrid-backfill-cron.ts
 *
 * Backfill av crm_customers.organization_id (mig 320). Resolverer
 * organization_id fra owner_user_id → organization_members (først
 * joined) i batcher. Idempotent — kjører kun på rader hvor
 * organization_id IS NULL.
 *
 * Triggret av GitHub Actions @ 03:15 UTC daily som safety-net for
 * nye leads opprettet uten denormalisert org_id, samt manuelt etter
 * mig 320 første gang.
 *
 * Auth: x-cron-trigger-token + LEADGRID_INTELLIGENCE_CRON_TOKEN
 * (samme token som intelligence-cron — felles cron-infrastruktur).
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

interface Deps {
  app: Express;
  pool: Pool;
}

const BACKFILL_BATCH_SIZE = 500;

export function registerLeadgridBackfillCron(deps: Deps): void {
  const { app, pool } = deps;

  /**
   * Backfill crm_customers.organization_id basert på owner_user_id.
   * Idempotent: kjører kun på rader hvor organization_id IS NULL.
   * Trygt å kalle gjentatte ganger.
   */
  app.post(
    "/api/leadgrid/cron/backfill-organization-id",
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
      const { timingSafeEqual } = await import("crypto");
      if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }

      const start = Date.now();
      let totalUpdated = 0;
      let batchesProcessed = 0;
      try {
        // Loop til vi ikke finner flere rader
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const r = await pool.query<{ updated: number }>(
            `WITH to_update AS (
               SELECT c.id
                 FROM crm_customers c
                WHERE c.organization_id IS NULL
                  AND c.owner_user_id IS NOT NULL
                LIMIT $1
             ),
             updated AS (
               UPDATE crm_customers c
                  SET organization_id = (
                    SELECT om.organization_id
                      FROM organization_members om
                     WHERE om.user_id = c.owner_user_id
                     ORDER BY om.joined_at ASC LIMIT 1
                  )
                FROM to_update WHERE c.id = to_update.id
                  AND EXISTS (
                    SELECT 1 FROM organization_members
                     WHERE user_id = c.owner_user_id LIMIT 1
                  )
                RETURNING c.id
             )
             SELECT COUNT(*)::int AS updated FROM updated`,
            [BACKFILL_BATCH_SIZE],
          );
          const updated = r.rows[0]?.updated ?? 0;
          totalUpdated += updated;
          batchesProcessed++;
          if (updated === 0 || batchesProcessed > 100) break; // safety cap
        }

        // Stats: hvor mange uten organization_id og uten owner_user_id?
        const stats = await pool.query<{
          missing_org: string;
          missing_owner: string;
          total: string;
        }>(
          `SELECT
             COUNT(*) FILTER (WHERE organization_id IS NULL)::text AS missing_org,
             COUNT(*) FILTER (WHERE owner_user_id IS NULL)::text AS missing_owner,
             COUNT(*)::text AS total
             FROM crm_customers WHERE archived_at IS NULL`,
        );
        const durationMs = Date.now() - start;
        res.json({
          ok: true,
          total_updated: totalUpdated,
          batches: batchesProcessed,
          remaining: {
            missing_organization_id: Number(stats.rows[0].missing_org),
            missing_owner_user_id: Number(stats.rows[0].missing_owner),
            total_leads: Number(stats.rows[0].total),
          },
          duration_ms: durationMs,
        });
      } catch (err) {
        res.status(500).json({
          error: "backfill_failed",
          detail: String(err),
          partial_updated: totalUpdated,
          duration_ms: Date.now() - start,
        });
      }
    },
  );
}
