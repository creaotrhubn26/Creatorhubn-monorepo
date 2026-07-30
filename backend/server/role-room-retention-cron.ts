/**
 * role-room-retention-cron.ts
 *
 * Cron-endepunkt for GDPR-autosletting av casting-data (Del A punkt 35).
 *
 *   POST /api/role-room/cron/retention-sweep
 *     Header: x-cron-trigger-token
 *     Body (valgfritt): { categories?: string[], batchSize?: number, enforce?: boolean }
 *
 * Auth følger samme mønster som leadgrid-retention-cron.ts: delt cron-token
 * med timing-safe compare.
 *
 * **Tørrkjøring er standard.** Feiingen endrer bare data når
 * `RR_RETENTION_ENFORCE=true` er satt i miljøet. `enforce` i body kan slå
 * det PÅ for en enkeltkjøring, men bare når miljøvariabelen tillater det —
 * et lekket cron-token skal ikke kunne utløse sletting på egen hånd.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import {
  RETENTION_CATEGORIES,
  runRetentionSweep,
  type RetentionCategory,
} from "./role-room-retention-service.js";

interface Deps {
  app: Express;
  pool: Pool;
}

async function cronTokenValid(provided: unknown): Promise<boolean> {
  const expected =
    process.env.RR_RETENTION_CRON_TOKEN || process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
  if (!expected) return false;
  if (typeof provided !== "string" || provided.length !== expected.length) return false;
  const { timingSafeEqual } = await import("crypto");
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function parseCategories(raw: unknown): RetentionCategory[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = raw.filter((c): c is RetentionCategory =>
    (RETENTION_CATEGORIES as readonly string[]).includes(c as string),
  );
  return valid.length > 0 ? valid : undefined;
}

export function registerRoleRoomRetentionCron(deps: Deps): void {
  const { app, pool } = deps;

  app.post(
    "/api/role-room/cron/retention-sweep",
    async (req: Request, res: Response): Promise<void> => {
      const expected =
        process.env.RR_RETENTION_CRON_TOKEN || process.env.LEADGRID_INTELLIGENCE_CRON_TOKEN;
      if (!expected) {
        res.status(503).json({ error: "cron_token_not_configured" });
        return;
      }
      if (!(await cronTokenValid(req.headers["x-cron-trigger-token"]))) {
        res.status(401).json({ error: "invalid_cron_token" });
        return;
      }

      // Sletting krever at miljøet tillater det. Body kan bare snevre inn.
      const envAllowsEnforce = process.env.RR_RETENTION_ENFORCE === "true";
      const requestedEnforce = req.body?.enforce !== false;
      const enforce = envAllowsEnforce && requestedEnforce;

      const batchSizeRaw = Number(req.body?.batchSize);
      const batchSize =
        Number.isFinite(batchSizeRaw) && batchSizeRaw > 0
          ? Math.min(Math.floor(batchSizeRaw), 5000)
          : undefined;

      try {
        const result = await runRetentionSweep(pool, {
          enforce,
          categories: parseCategories(req.body?.categories),
          batchSize,
        });

        console.log(
          `[rr-retention] run ${result.runId} ${result.dryRun ? "(tørrkjøring)" : "(sletting)"} ` +
            `${result.durationMs}ms, ${result.totalRowsAffected} rader`,
        );

        res.json({
          ok: true,
          ...result,
          note: result.dryRun
            ? "Tørrkjøring — ingen data ble endret. Sett RR_RETENTION_ENFORCE=true for å slette."
            : undefined,
        });
      } catch (err) {
        console.error("[rr-retention] feiing feilet:", err);
        res.status(500).json({
          error: "retention_sweep_failed",
          detail: String(err).slice(0, 300),
        });
      }
    },
  );
}
