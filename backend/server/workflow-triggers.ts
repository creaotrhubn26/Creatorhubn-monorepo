// @ts-nocheck
/**
 * Slice 9X.79 — SmartFlyt event-triggers
 *
 * Lar workflows starte automatisk når et event skjer (ny submission,
 * nytt prosjekt, status-endring, etc.). Hooks kalles fra eksisterende
 * endepunkt — fireWorkflowTrigger() er fire-and-forget for å ikke
 * blokkere request-handleren.
 */

import type { Pool } from 'pg';
import { startWorkflowRun } from './workflow-execution-engine.js';

export type EventType =
  | 'submission.received'
  | 'project.created'
  | 'project.status_changed'
  | 'client.created'
  | 'invoice.paid';

export interface FireOptions {
  pool: Pool;
  eventType: EventType;
  userId: string;          // bruker som "eier" eventet (vendor/photographer)
  payload?: Record<string, any>;
  workflowsLookup?: (userId: string, workflowId: string) => Promise<any | null>;
}

let schemaEnsured = false;

async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_triggers (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id     TEXT NOT NULL,
        user_id         TEXT NOT NULL,
        profession      TEXT,
        event_type      TEXT NOT NULL,
        conditions      JSONB NOT NULL DEFAULT '{}'::jsonb,
        enabled         BOOLEAN NOT NULL DEFAULT TRUE,
        last_triggered_at TIMESTAMPTZ,
        last_run_id     UUID,
        trigger_count   INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (workflow_id, user_id, event_type)
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_triggers_event
        ON workflow_triggers (event_type, enabled)
        WHERE enabled = TRUE;
    `);
    schemaEnsured = true;
  } catch (err: any) {
    console.warn('[workflow-triggers] ensure-schema feilet:', err.message);
  }
}

/**
 * Evaluer enkel condition: alle keys må matche payload.
 * F.eks. { project_type: 'wedding' } mot { project_type: 'wedding', ... } = true.
 * Tom condition matcher alt.
 */
function matchesConditions(conditions: Record<string, any>, payload: Record<string, any> = {}): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;
  for (const [key, expected] of Object.entries(conditions)) {
    if (payload[key] !== expected) return false;
  }
  return true;
}

/**
 * Default workflow-lookup som leser fra editingWorkflows. Bruker
 * dynamisk import for å unngå sirkel-avhengighet med drizzle-schema.
 */
async function defaultWorkflowsLookup(pool: Pool, userId: string, workflowId: string): Promise<any | null> {
  try {
    const r = await pool.query(
      `SELECT id, user_id, workflow_name AS name, steps
         FROM editing_workflows WHERE user_id = $1 AND id = $2 LIMIT 1`,
      [userId, workflowId],
    );
    if (r.rows.length === 0) return null;
    const w = r.rows[0];
    if (typeof w.steps === 'string') {
      try { w.steps = JSON.parse(w.steps); } catch { w.steps = []; }
    }
    return w;
  } catch {
    return null;
  }
}

/**
 * Hovedfunksjon — fire-and-forget. Looker opp matching enabled triggers,
 * evaluerer conditions, og starter workflows. Feil i en trigger sender
 * ikke ned andre — hver er isolert.
 */
export async function fireWorkflowTrigger(opts: FireOptions): Promise<{ triggered: number }> {
  await ensureSchema(opts.pool);
  let triggered = 0;
  try {
    const rows = await opts.pool.query(
      `SELECT id, workflow_id, profession, conditions
         FROM workflow_triggers
        WHERE event_type = $1 AND user_id = $2 AND enabled = TRUE`,
      [opts.eventType, opts.userId],
    );

    for (const row of rows.rows) {
      if (!matchesConditions(row.conditions, opts.payload || {})) continue;

      const workflow = opts.workflowsLookup
        ? await opts.workflowsLookup(opts.userId, row.workflow_id)
        : await defaultWorkflowsLookup(opts.pool, opts.userId, row.workflow_id);
      if (!workflow) continue;

      const steps = (workflow.steps || []).map((s: any) => ({
        action_id: s.action?.id || s.action_id,
        action_name: s.action?.name || s.action_name,
      }));
      if (steps.length === 0) continue;

      try {
        const { runId } = await startWorkflowRun({
          pool: opts.pool,
          userId: opts.userId,
          workflowId: row.workflow_id,
          workflowName: workflow.name || workflow.workflowName || 'Trigget workflow',
          profession: row.profession || undefined,
          steps,
          context: {
            trigger: 'event',
            event_type: opts.eventType,
            event_payload: opts.payload || {},
            trigger_id: row.id,
          },
        });

        await opts.pool.query(
          `UPDATE workflow_triggers
              SET last_triggered_at = NOW(), last_run_id = $1,
                  trigger_count = trigger_count + 1
            WHERE id = $2`,
          [runId, row.id],
        );
        triggered++;
      } catch (err: any) {
        console.error('[workflow-triggers] start failed for', row.workflow_id, err.message);
      }
    }
  } catch (err: any) {
    // Sjelden — tabellen finnes ikke enda eller DB nede; svelg så vi ikke
    // tar ned event-emit-stedet (f.eks. /api/submissions)
    if (err?.code !== '42P01') {
      console.error('[workflow-triggers] fire feilet:', err.message);
    }
  }
  return { triggered };
}

export interface TriggerInput {
  workflowId: string;
  userId: string;
  profession?: string;
  eventType: EventType;
  conditions?: Record<string, any>;
  enabled?: boolean;
}

export async function upsertTrigger(pool: Pool, input: TriggerInput): Promise<any> {
  await ensureSchema(pool);
  const r = await pool.query(
    `INSERT INTO workflow_triggers
       (workflow_id, user_id, profession, event_type, conditions, enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (workflow_id, user_id, event_type) DO UPDATE
       SET conditions = EXCLUDED.conditions,
           enabled    = EXCLUDED.enabled,
           profession = EXCLUDED.profession,
           updated_at = NOW()
     RETURNING *`,
    [
      input.workflowId,
      input.userId,
      input.profession || null,
      input.eventType,
      JSON.stringify(input.conditions || {}),
      input.enabled !== false,
    ],
  );
  return r.rows[0];
}

export async function deleteTrigger(pool: Pool, userId: string, workflowId: string, eventType: EventType): Promise<void> {
  await ensureSchema(pool);
  await pool.query(
    `DELETE FROM workflow_triggers
      WHERE workflow_id = $1 AND user_id = $2 AND event_type = $3`,
    [workflowId, userId, eventType],
  );
}

export async function listTriggers(pool: Pool, userId: string): Promise<any[]> {
  await ensureSchema(pool);
  const r = await pool.query(
    `SELECT * FROM workflow_triggers WHERE user_id = $1`,
    [userId],
  );
  return r.rows;
}

export const SUPPORTED_EVENTS: { value: EventType; label: string; description: string }[] = [
  { value: 'submission.received',     label: 'Ny kundeforespørsel',  description: 'Kjøres når en kunde sender inn forespørsel via web-skjema' },
  { value: 'project.created',         label: 'Nytt prosjekt opprettet', description: 'Kjøres når et nytt prosjekt opprettes (manuelt eller fra submission)' },
  { value: 'project.status_changed',  label: 'Prosjekt-status endret', description: 'Kjøres når status på et prosjekt endres' },
  { value: 'client.created',          label: 'Ny klient lagt til',   description: 'Kjøres når en ny klient legges til i systemet' },
  { value: 'invoice.paid',            label: 'Faktura betalt',       description: 'Kjøres når Stripe varsler at en faktura er betalt' },
];
