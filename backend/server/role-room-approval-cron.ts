/**
 * role-room-approval-cron.ts
 *
 * Daily auto-approval tick (MedInnova-avtalen §5.2): material the client hasn't
 * responded to within the business-day deadline is considered approved.
 *
 * The same daily tick also prunes both idempotency stores (the social claim
 * table + the shared idempotency-key table) so neither grows unbounded.
 *
 * Cron tick: POST /api/internal/approval/auto-approve-tick
 *   (x-cron-secret = APPROVAL_CRON_SECRET). Run once per day.
 * Optional in-process loop: APPROVAL_SWEEP_INTERVAL_MINUTES.
 */

import type express from "express";
import type { Pool } from "pg";
import { runMaterialAutoApproveSweep } from "./role-room-material-approval.js";
import { pruneSocialIdempotency } from "./role-room-social-idempotency.js";
import { cleanupExpiredIdempotencyRows } from "./_shared-idempotency.js";

/**
 * Daily housekeeping that rides along with the approval tick: prune both
 * idempotency stores so neither table grows unbounded. Best-effort — never
 * throws, so a prune hiccup can't fail the approval sweep.
 */
async function pruneIdempotencyStores(
  pool: Pool,
): Promise<{ social: number; shared: number }> {
  const [social, shared] = await Promise.all([
    pruneSocialIdempotency(pool).catch(() => 0),
    cleanupExpiredIdempotencyRows(pool).catch(() => 0),
  ]);
  return { social, shared };
}

export interface RoleRoomApprovalCronDeps {
  app: express.Application;
  pool: Pool;
}

export function setupRoleRoomApprovalCron(deps: RoleRoomApprovalCronDeps): void {
  const { app, pool } = deps;

  app.post("/api/internal/approval/auto-approve-tick", async (req, res) => {
    const provided = req.headers["x-cron-secret"];
    const secret = process.env.APPROVAL_CRON_SECRET;
    if (!secret || provided !== secret) {
      return res.status(401).json({ error: "unauthorized" });
    }
    try {
      const summary = await runMaterialAutoApproveSweep(pool);
      const idempotencyPruned = await pruneIdempotencyStores(pool);
      res.json({ ok: true, summary, idempotencyPruned });
    } catch (error) {
      res.status(500).json({ error: "approval_auto_approve_tick_failed", detail: String(error) });
    }
  });

  const intervalMinutes = Number(process.env.APPROVAL_SWEEP_INTERVAL_MINUTES || 0);
  if (intervalMinutes > 0) {
    setInterval(
      () => {
        void runMaterialAutoApproveSweep(pool).catch((e) =>
          console.error("[approval-sweep] interval run failed", e),
        );
        void pruneIdempotencyStores(pool).catch((e) =>
          console.error("[approval-sweep] idempotency prune failed", e),
        );
      },
      intervalMinutes * 60 * 1000,
    );
  }
}
