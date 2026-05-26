/**
 * role-room-approval-cron.ts
 *
 * Daily auto-approval tick (MedInnova-avtalen §5.2): material the client hasn't
 * responded to within the business-day deadline is considered approved.
 *
 * Cron tick: POST /api/internal/approval/auto-approve-tick
 *   (x-cron-secret = APPROVAL_CRON_SECRET). Run once per day.
 * Optional in-process loop: APPROVAL_SWEEP_INTERVAL_MINUTES.
 */

import type express from "express";
import type { Pool } from "pg";
import { runMaterialAutoApproveSweep } from "./role-room-material-approval.js";

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
      res.json({ ok: true, summary });
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
      },
      intervalMinutes * 60 * 1000,
    );
  }
}
