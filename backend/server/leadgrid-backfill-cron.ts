/**
 * leadgrid-backfill-cron.ts
 *
 * Reparasjon av crm_customers.organization_id for prosjektbundne Leadgrid-
 * leads. leadgrid_projects er eneste autoritative kilde. Vi avleder aldri
 * kundeprosjekt fra brukerens «første» organisasjonsmedlemskap, fordi samme
 * bruker kan arbeide for flere kunder.
 *
 * Triggret av GitHub Actions @ 03:15 UTC daily som safety-net for
 * legacy-rader der project_id allerede peker på et Leadgrid-prosjekt.
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
   * Reparer crm_customers.organization_id fra det eksplisitte kundeprosjektet.
   * Prosjektløse Universal CRM-rader blir bevisst ikke absorbert i Leadgrid.
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
        // Bounded, lock-safe loop over kun rader med autoritativt prosjekt.
        while (true) {
          const r = await pool.query<{ updated: number }>(
            `WITH to_update AS (
               SELECT c.id, p.organization_id
                 FROM crm_customers c
                 JOIN leadgrid_projects p ON p.id = c.project_id
                WHERE p.organization_id IS NOT NULL
                  AND c.organization_id IS DISTINCT FROM p.organization_id
                ORDER BY c.id
                LIMIT $1
                FOR UPDATE OF c SKIP LOCKED
             ),
             updated AS (
               UPDATE crm_customers c
                  SET organization_id = to_update.organization_id,
                      updated_at = NOW()
                 FROM to_update
                WHERE c.id = to_update.id
                  AND c.project_id IS NOT NULL
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

        // Skill mellom reparerbart Leadgrid-scope og bevisst urørte legacy-
        // /Universal CRM-rader. Det gjør cron-resultatet handlingsrettet.
        const stats = await pool.query<{
          missing_org: string;
          repairable_project_scope: string;
          unscoped_non_leadgrid: string;
          total: string;
        }>(
          `SELECT
             COUNT(*) FILTER (WHERE c.organization_id IS NULL)::text AS missing_org,
             COUNT(*) FILTER (
               WHERE p.id IS NOT NULL
                 AND c.organization_id IS DISTINCT FROM p.organization_id
             )::text AS repairable_project_scope,
             COUNT(*) FILTER (
               WHERE c.project_id IS NULL OR p.id IS NULL
             )::text AS unscoped_non_leadgrid,
             COUNT(*)::text AS total
             FROM crm_customers c
             LEFT JOIN leadgrid_projects p ON p.id = c.project_id
            WHERE c.archived_at IS NULL`,
        );
        const durationMs = Date.now() - start;
        res.json({
          ok: true,
          total_updated: totalUpdated,
          batches: batchesProcessed,
          remaining: {
            missing_organization_id: Number(stats.rows[0].missing_org),
            repairable_project_scope: Number(stats.rows[0].repairable_project_scope),
            unscoped_non_leadgrid_rows: Number(stats.rows[0].unscoped_non_leadgrid),
            total_leads: Number(stats.rows[0].total),
          },
          strategy: "authoritative_project_only",
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
