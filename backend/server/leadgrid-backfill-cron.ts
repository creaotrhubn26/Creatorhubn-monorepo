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
import { lookupCompanyForNewLead } from "./lead-brreg-service.js";

interface Deps {
  app: Express;
  pool: Pool;
}

const BACKFILL_BATCH_SIZE = 500;
// Brreg-oppslag er ett HTTP-kall per org (ikke bulk-SQL som org-id-
// backfillen over) — mindre batch + hardere cap enn org-id-varianten.
const NACE_BACKFILL_BATCH_SIZE = 25;
const NACE_BACKFILL_MAX_BATCHES = 20;

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

  /**
   * Backfill organizations.nace_code/nace_description (2026-08-19) for
   * ORGER OPPRETTET FØR NACE-arbeidet — self-onboard/demo-request fyller
   * dette lazy fremover, men eksisterende kunder med org_number satt
   * hadde ingen NACE lagret i det hele tatt. Idempotent: kjører kun på
   * rader hvor org_number finnes og nace_code mangler. Ett Brreg-kall per
   * org — trygt å kalle gjentatte ganger (cron plukker opp resten neste
   * kjøring hvis MAX_BATCHES nås).
   */
  app.post(
    "/api/leadgrid/cron/backfill-organization-nace",
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
      let totalAttempted = 0;
      let batchesProcessed = 0;
      try {
        for (let b = 0; b < NACE_BACKFILL_MAX_BATCHES; b++) {
          const r = await pool.query<{ id: string; org_number: string }>(
            `SELECT id::text, org_number FROM organizations
              WHERE org_number IS NOT NULL AND org_number != ''
                AND nace_code IS NULL
              LIMIT $1`,
            [NACE_BACKFILL_BATCH_SIZE],
          );
          if (r.rows.length === 0) break;
          batchesProcessed++;
          for (const org of r.rows) {
            totalAttempted++;
            try {
              const looked = await lookupCompanyForNewLead(org.org_number);
              if (looked.found && looked.company) {
                await pool.query(
                  `UPDATE organizations SET nace_code = $1, nace_description = $2 WHERE id = $3`,
                  [looked.company.naceCode, looked.company.naceDescription, org.id],
                );
                if (looked.company.naceCode) totalUpdated++;
              } else {
                // Ikke funnet i Brreg (feil org.nr, avviklet enhet o.l.) —
                // sett nace_code til tom streng så raden ikke plukkes opp
                // igjen hver kjøring; description forblir null (skiller
                // «prøvd, ikke funnet» fra «aldri prøvd»).
                await pool.query(
                  `UPDATE organizations SET nace_code = '' WHERE id = $1`,
                  [org.id],
                );
              }
            } catch (lookupErr) {
              console.warn(
                "[backfill-nace] oppslag feilet for org",
                org.id,
                (lookupErr as Error).message,
              );
            }
          }
        }
        res.json({
          ok: true,
          total_updated: totalUpdated,
          total_attempted: totalAttempted,
          batches: batchesProcessed,
          duration_ms: Date.now() - start,
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
