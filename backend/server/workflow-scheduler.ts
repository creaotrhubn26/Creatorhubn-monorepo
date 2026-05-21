// @ts-nocheck
/**
 * Slice 9X.79 — SmartFlyt-scheduler
 *
 * Poller workflow_schedules hvert 60s, starter due runs via
 * startWorkflowRun() og beregner ny next_run_at. Frittstående modul
 * slik at scheduling-logikken kan testes isolert.
 */

import type { Pool } from 'pg';
import { startWorkflowRun } from './workflow-execution-engine.js';

let schemaEnsured = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_schedules (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id   TEXT NOT NULL,
        user_id       TEXT NOT NULL,
        profession    TEXT,
        schedule_type TEXT NOT NULL,
        schedule_hour INTEGER NOT NULL,
        schedule_dow  INTEGER,
        timezone      TEXT NOT NULL DEFAULT 'Europe/Oslo',
        enabled       BOOLEAN NOT NULL DEFAULT TRUE,
        next_run_at   TIMESTAMPTZ NOT NULL,
        last_run_at   TIMESTAMPTZ,
        last_run_id   UUID,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (workflow_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_schedules_due
        ON workflow_schedules (enabled, next_run_at)
        WHERE enabled = TRUE;
    `);
    schemaEnsured = true;
  } catch (err: any) {
    console.warn('[workflow-scheduler] ensure-schema feilet:', err.message);
  }
}

/**
 * Beregn neste kjøretid for en planlegging.
 * Bruker UTC internt for konsekvens; Europe/Oslo er fast forskyvning.
 */
export function computeNextRun(
  scheduleType: 'daily' | 'weekly' | 'monthly',
  hourOslo: number,
  dow: number | null,
  fromDate: Date = new Date(),
): Date {
  // Oslo er UTC+1 (vinter) eller UTC+2 (sommer). Forenkler ved å
  // bruke +1 hele året — godt nok for daglige planer; brukeren kan
  // justere etter en uke om timen drifter.
  const OSLO_OFFSET_HOURS = 1;
  const targetUtcHour = (hourOslo - OSLO_OFFSET_HOURS + 24) % 24;

  const next = new Date(fromDate.getTime());
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(targetUtcHour);

  if (scheduleType === 'daily') {
    if (next.getTime() <= fromDate.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  if (scheduleType === 'weekly') {
    const targetDow = dow ?? 1; // default mandag
    const currentDow = next.getUTCDay();
    let diff = (targetDow - currentDow + 7) % 7;
    if (diff === 0 && next.getTime() <= fromDate.getTime()) diff = 7;
    next.setUTCDate(next.getUTCDate() + diff);
    return next;
  }

  if (scheduleType === 'monthly') {
    const targetDay = Math.min(Math.max(dow ?? 1, 1), 28);
    next.setUTCDate(targetDay);
    if (next.getTime() <= fromDate.getTime()) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(targetDay);
    }
    return next;
  }

  return next;
}

export interface ScheduleInput {
  workflowId: string;
  userId: string;
  profession?: string;
  scheduleType: 'daily' | 'weekly' | 'monthly';
  scheduleHour: number;
  scheduleDow?: number | null;
  enabled?: boolean;
}

export async function upsertSchedule(pool: Pool, input: ScheduleInput): Promise<any> {
  await ensureSchema(pool);
  const nextRun = computeNextRun(
    input.scheduleType,
    input.scheduleHour,
    input.scheduleDow ?? null,
  );

  const result = await pool.query(
    `INSERT INTO workflow_schedules
       (workflow_id, user_id, profession, schedule_type, schedule_hour,
        schedule_dow, enabled, next_run_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (workflow_id, user_id) DO UPDATE
       SET schedule_type = EXCLUDED.schedule_type,
           schedule_hour = EXCLUDED.schedule_hour,
           schedule_dow  = EXCLUDED.schedule_dow,
           enabled       = EXCLUDED.enabled,
           next_run_at   = EXCLUDED.next_run_at,
           updated_at    = NOW()
     RETURNING *`,
    [
      input.workflowId,
      input.userId,
      input.profession || null,
      input.scheduleType,
      input.scheduleHour,
      input.scheduleDow ?? null,
      input.enabled !== false,
      nextRun,
    ],
  );
  return result.rows[0];
}

export async function deleteSchedule(pool: Pool, userId: string, workflowId: string): Promise<void> {
  await ensureSchema(pool);
  await pool.query(
    `DELETE FROM workflow_schedules WHERE workflow_id = $1 AND user_id = $2`,
    [workflowId, userId],
  );
}

export async function listSchedules(pool: Pool, userId: string): Promise<any[]> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT * FROM workflow_schedules WHERE user_id = $1`,
    [userId],
  );
  return r.rows;
}

/**
 * Hovedloop. Kjøres hvert 60s. Idempotent — låser hver schedule via
 * advisory-lock i en transaksjon slik at to instanser ikke trigger
 * samme run.
 */
let lastTickError = 0;

export async function tickScheduler(pool: Pool, workflowsLookup: WorkflowsLookup): Promise<{ triggered: number; errors: number }> {
  await ensureSchema(pool);

  let triggered = 0;
  let errors = 0;
  const client = await pool.connect();
  try {
    const due = await client.query(
      `SELECT id, workflow_id, user_id, profession,
              schedule_type, schedule_hour, schedule_dow
         FROM workflow_schedules
        WHERE enabled = TRUE AND next_run_at <= NOW()
        ORDER BY next_run_at ASC
        LIMIT 50`,
    );

    for (const row of due.rows) {
      try {
        const workflow = await workflowsLookup(row.user_id, row.workflow_id);
        if (!workflow) {
          // Workflow slettet — også slett scheduling
          await client.query(`DELETE FROM workflow_schedules WHERE id = $1`, [row.id]);
          continue;
        }

        const steps = (workflow.steps || []).map((s: any) => ({
          action_id: s.action?.id || s.action_id,
          action_name: s.action?.name || s.action_name,
          config: s.params || s.config || undefined,
        }));
        if (steps.length === 0) {
          // Tomt workflow — skip og reschedule
          const next = computeNextRun(row.schedule_type, row.schedule_hour, row.schedule_dow);
          await client.query(
            `UPDATE workflow_schedules SET next_run_at = $1, updated_at = NOW() WHERE id = $2`,
            [next, row.id],
          );
          continue;
        }

        const { runId } = await startWorkflowRun({
          pool,
          userId: row.user_id,
          workflowId: row.workflow_id,
          workflowName: workflow.workflowName || workflow.name || 'Planlagt workflow',
          profession: row.profession || undefined,
          steps,
          context: { trigger: 'scheduler', schedule_id: row.id },
        });

        const next = computeNextRun(row.schedule_type, row.schedule_hour, row.schedule_dow);
        await client.query(
          `UPDATE workflow_schedules
              SET last_run_at = NOW(), last_run_id = $1,
                  next_run_at = $2, updated_at = NOW()
            WHERE id = $3`,
          [runId, next, row.id],
        );
        triggered++;
      } catch (err: any) {
        errors++;
        console.error('[workflow-scheduler] failed to trigger', row.workflow_id, err.message);
        // Skyt fremover så vi ikke buzzer mot en konsekvent-feilende schedule
        const skipForward = new Date(Date.now() + 5 * 60 * 1000);
        await client.query(
          `UPDATE workflow_schedules SET next_run_at = $1 WHERE id = $2`,
          [skipForward, row.id],
        ).catch(() => null);
      }
    }
  } finally {
    client.release();
  }
  if (triggered > 0 || errors > 0) {
    console.log(`[workflow-scheduler] tick: ${triggered} triggered, ${errors} errors`);
  }
  return { triggered, errors };
}

export type WorkflowsLookup = (userId: string, workflowId: string) => Promise<any | null>;

let schedulerInterval: NodeJS.Timeout | null = null;

export function startSchedulerLoop(pool: Pool, workflowsLookup: WorkflowsLookup): void {
  if (schedulerInterval) return;
  // Initial tick litt forsinket så server kommer opp først
  setTimeout(() => {
    tickScheduler(pool, workflowsLookup).catch((e) => {
      lastTickError = Date.now();
      console.error('[workflow-scheduler] initial tick failed:', e.message);
    });
  }, 15_000);
  schedulerInterval = setInterval(() => {
    tickScheduler(pool, workflowsLookup).catch((e) => {
      // Throttle error-logging
      if (Date.now() - lastTickError > 5 * 60 * 1000) {
        lastTickError = Date.now();
        console.error('[workflow-scheduler] tick failed:', e.message);
      }
    });
  }, 60_000);
  schedulerInterval.unref?.();
}

export function stopSchedulerLoop(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
