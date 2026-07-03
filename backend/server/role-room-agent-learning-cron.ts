/**
 * role-room-agent-learning-cron.ts
 *
 * Nightly aggregation tick for The Role Room Agent learning loop (Lag 1).
 * Reads producer field-feedback, runs the pure aggregation, and UPSERTs
 * PROPOSED overrides into role_room_agent_learned_overrides. A human approves
 * them (admin review endpoints) before runtime consumes them — nothing here
 * touches production classification directly.
 *
 * Cron tick: POST /api/internal/agent-learning/aggregate-tick
 *   (x-cron-secret = AGENT_LEARNING_CRON_SECRET). Run once per day (off-peak).
 * Optional in-process loop: AGENT_LEARNING_AGGREGATE_INTERVAL_MINUTES.
 */

import type express from "express";
import type { Pool } from "pg";
import { runLearningAggregation } from "./role-room-agent-learning.js";

export interface RoleRoomAgentLearningCronDeps {
  app: express.Application;
  pool: Pool;
}

export function setupRoleRoomAgentLearningCron(deps: RoleRoomAgentLearningCronDeps): void {
  const { app, pool } = deps;

  app.post("/api/internal/agent-learning/aggregate-tick", async (req, res) => {
    // Dedicated secret (GitHub Actions cron header ↔ Render env), per the
    // established x-cron-secret pattern.
    const provided = req.headers["x-cron-secret"];
    const secret = process.env.AGENT_LEARNING_CRON_SECRET;
    if (!secret || provided !== secret) {
      return res.status(401).json({ error: "unauthorized" });
    }
    try {
      const summary = await runLearningAggregation(pool);
      res.json({ ok: true, summary });
    } catch (error) {
      res.status(500).json({ error: "agent_learning_aggregate_tick_failed", detail: String(error) });
    }
  });

  const intervalMinutes = Number(process.env.AGENT_LEARNING_AGGREGATE_INTERVAL_MINUTES || 0);
  if (intervalMinutes > 0) {
    setInterval(
      () => {
        void runLearningAggregation(pool).catch((e) =>
          console.error("[agent-learning-aggregate] interval run failed", e),
        );
      },
      intervalMinutes * 60 * 1000,
    );
  }
}
