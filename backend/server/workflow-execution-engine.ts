/**
 * workflow-execution-engine — Slice 9X.79
 *
 * SmartFlyt-execution. Tidligere returnerte execute-endepointet bare
 * { status: "started" } uten å faktisk gjøre noe. Denne engine kjører
 * hver step sekvensielt med ekte handlers + persisterer progresjon.
 *
 * Arkitektur:
 *   - ActionRegistry: action_id → handler-function
 *   - executeWorkflow: sekvensiell utførelse, idempotent re-run hvis crash
 *   - Manual-steps: marker som 'awaiting_manual', brukeren bekrefter selv
 *
 * Brukes via:
 *   POST /api/orchestration/workflows/:userId/:workflowId/execute
 *     → returnerer { runId } umiddelbart
 *     → fortsetter i bakgrunnen (fire-and-forget)
 *   GET /api/orchestration/workflows/runs/:runId
 *     → frontend polling for live status
 */

import type { Pool } from "pg";

export type ExecutionMode = 'auto' | 'manual' | 'ai';

export interface ActionHandlerContext {
  userId: string;
  runId: string;
  stepIndex: number;
  stepData: Record<string, any>;
  workflowContext: Record<string, any>;
  pool: Pool;
}

export interface ActionHandlerResult {
  /** true hvis steget faktisk er kjørt automatisk */
  completed: boolean;
  /** Sett til true hvis steget krever manuell bekreftelse — brukeren får checkbox */
  requiresManualConfirmation?: boolean;
  /** Data å lagre i result_data (vises i UI) */
  data?: Record<string, any>;
  /** Feilmelding hvis feilet */
  error?: string;
}

export type ActionHandler = (ctx: ActionHandlerContext) => Promise<ActionHandlerResult>;

interface ActionDefinition {
  id: string;
  name: string;
  mode: ExecutionMode;
  handler: ActionHandler;
}

/**
 * Sentralt registry for alle workflow-actions. Engine slår opp action_id
 * i denne mappet for å finne handler. Hvis ikke registrert → marker som
 * 'manual' (brukeren får checkbox).
 */
const ACTION_REGISTRY = new Map<string, ActionDefinition>();

export function registerAction(def: ActionDefinition) {
  ACTION_REGISTRY.set(def.id, def);
}

export function getRegisteredActions(): string[] {
  return Array.from(ACTION_REGISTRY.keys());
}

// ─── Default-handlers ─────────────────────────────────────────────
// Disse er bygget inn så engine fungerer fra dag 1. Mer spesialiserte
// handlers kan registreres fra andre route-filer.

const manualOnlyHandler: ActionHandler = async () => ({
  completed: false,
  requiresManualConfirmation: true,
  data: { note: 'Steg krever manuell bekreftelse fra brukeren' },
});

const aiPlaceholderHandler = (featureName: string): ActionHandler => async (ctx) => {
  // Marker som "kjør AI-funksjon via dens egen route" — engine kan ikke
  // direkte kalle Anthropic her uten prompt, så vi peker brukeren videre.
  return {
    completed: false,
    requiresManualConfirmation: true,
    data: {
      note: `Kjør AI-funksjon: ${featureName}`,
      hint: `Bruk relevant AI-knapp i UI for å fullføre denne — engine loggfører resultatet`,
    },
  };
};

// Liste over actions vi har bygget faktiske handlers for
function registerDefaultActions() {
  // Project-CRUD: bruker eksisterende /api/photographer/projects-endepoint
  registerAction({
    id: 'create-project',
    name: 'Opprett prosjekt',
    mode: 'auto',
    handler: async (ctx) => {
      const title = ctx.workflowContext.projectTitle || `Nytt prosjekt ${new Date().toISOString().slice(0, 10)}`;
      try {
        const result = await ctx.pool.query(
          `INSERT INTO photographer_projects (photographer_id, title, status, created_at)
           VALUES ($1, $2, 'draft', NOW()) RETURNING id, title`,
          [ctx.userId, title],
        );
        return { completed: true, data: { projectId: result.rows[0].id, title: result.rows[0].title } };
      } catch (err: any) {
        return { completed: false, error: err.message };
      }
    },
  });

  // Client-CRUD
  registerAction({
    id: 'create-client',
    name: 'Opprett klient',
    mode: 'auto',
    handler: async (ctx) => {
      const name = ctx.workflowContext.clientName || 'Ny klient';
      const email = ctx.workflowContext.clientEmail || null;
      try {
        const result = await ctx.pool.query(
          `INSERT INTO photographer_clients (photographer_id, name, email, created_at)
           VALUES ($1, $2, $3, NOW()) RETURNING id, name`,
          [ctx.userId, name, email],
        );
        return { completed: true, data: { clientId: result.rows[0].id, name: result.rows[0].name } };
      } catch (err: any) {
        return { completed: false, error: err.message };
      }
    },
  });

  registerAction({ id: 'new-client', name: 'Ny klient', mode: 'auto', handler: ACTION_REGISTRY.get('create-client')!.handler });

  // Send e-post: peker til Gmail-flyt (krever Stine bekrefter mottager)
  registerAction({
    id: 'send-client-email',
    name: 'Send e-post til klient',
    mode: 'manual',
    handler: async (ctx) => ({
      completed: false,
      requiresManualConfirmation: true,
      data: {
        note: 'Åpne e-post-modulen for å sende. Vi husker at dette steget skal gjøres.',
        actionUrl: '/email-center',
      },
    }),
  });

  // Drive-upload: peker til Drive-flyt
  registerAction({
    id: 'upload-to-drive',
    name: 'Last opp til Drive',
    mode: 'manual',
    handler: async (ctx) => ({
      completed: false,
      requiresManualConfirmation: true,
      data: {
        note: 'Åpne fil-håndtering for å laste opp. Engine sporer fullføring.',
        actionUrl: '/file-upload',
      },
    }),
  });

  registerAction({ id: 'select-project-folder', name: 'Velg prosjektmappe', mode: 'manual', handler: manualOnlyHandler });
  registerAction({ id: 'backup-raw-files', name: 'Backup RAW-filer', mode: 'manual', handler: ACTION_REGISTRY.get('upload-to-drive')!.handler });
  registerAction({ id: 'backup-project', name: 'Backup prosjekt', mode: 'manual', handler: ACTION_REGISTRY.get('upload-to-drive')!.handler });
  registerAction({ id: 'import-footage', name: 'Importer opptak', mode: 'manual', handler: ACTION_REGISTRY.get('upload-to-drive')!.handler });

  // AI-actions — peker til AI-modul (engine kan ikke direkte kalle Anthropic
  // siden vi mangler bruker-input/prompt-konfigurasjon i engine-context)
  for (const ai of [
    { id: 'creatorhub-enhance', name: 'CreatorHub Photo Enhancer', feature: 'photo/enhance' },
    { id: 'auto-culling', name: 'Automatisk culling', feature: 'photo/auto-cull' },
    { id: 'auto-sync-audio', name: 'Auto-sync lyd', feature: 'video/sync-audio' },
    { id: 'auto-highlights', name: 'Auto høydepunkter', feature: 'video/highlights' },
    { id: 'color-grading', name: 'Color grading', feature: 'video/color-grade' },
    { id: 'create-trailer', name: 'Lag trailer', feature: 'video/trailer' },
  ]) {
    registerAction({ id: ai.id, name: ai.name, mode: 'ai', handler: aiPlaceholderHandler(ai.feature) });
  }

  // Equipment & scheduling — utstyrs-prep og kalender (manual i dag)
  registerAction({ id: 'equipment-prep', name: 'Utstyr forberedelse', mode: 'manual', handler: manualOnlyHandler });
  registerAction({ id: 'schedule-session', name: 'Planlegg fotografering', mode: 'manual', handler: manualOnlyHandler });

  // Render & upload
  registerAction({ id: 'render-video', name: 'Render video', mode: 'manual', handler: manualOnlyHandler });
  registerAction({ id: 'youtube-upload', name: 'YouTube-upload', mode: 'manual', handler: manualOnlyHandler });

  // Send forhåndsvisning — peker til galleri/showcase
  registerAction({
    id: 'send-preview-samples',
    name: 'Send forhåndsvisning',
    mode: 'manual',
    handler: async () => ({
      completed: false,
      requiresManualConfirmation: true,
      data: { note: 'Send via klientgalleri (signed download)', actionUrl: '/client-gallery' },
    }),
  });

  // Showcase
  registerAction({
    id: 'create-showcase',
    name: 'Opprett showcase',
    mode: 'manual',
    handler: async () => ({
      completed: false,
      requiresManualConfirmation: true,
      data: { actionUrl: '/showcase-admin' },
    }),
  });

  // Kontrakt
  registerAction({
    id: 'generate-contract',
    name: 'Generer kontrakt',
    mode: 'manual',
    handler: async () => ({
      completed: false,
      requiresManualConfirmation: true,
      data: { actionUrl: '/contracts/new' },
    }),
  });
}

let registryInitialized = false;
function ensureRegistry() {
  if (!registryInitialized) {
    registerDefaultActions();
    registryInitialized = true;
  }
}

// ─── Schema-ensure ────────────────────────────────────────────────
let schemaEnsured = false;
async function ensureSchema(pool: Pool) {
  if (schemaEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id TEXT NOT NULL,
        workflow_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        profession TEXT,
        status TEXT NOT NULL,
        context JSONB DEFAULT '{}'::jsonb,
        steps_total INTEGER NOT NULL,
        steps_completed INTEGER NOT NULL DEFAULT 0,
        steps_failed INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS workflow_run_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
        step_index INTEGER NOT NULL,
        action_id TEXT NOT NULL,
        action_name TEXT NOT NULL,
        status TEXT NOT NULL,
        execution_mode TEXT,
        result_data JSONB,
        error_message TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        duration_ms INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_user
        ON workflow_runs (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_run
        ON workflow_run_steps (run_id, step_index);
    `);
    schemaEnsured = true;
  } catch (err: any) {
    console.warn('[workflow-engine] ensure-schema feilet:', err.message);
  }
}

// ─── Engine ───────────────────────────────────────────────────────
interface WorkflowStepInput {
  action_id: string;
  action_name?: string;
}

interface ExecuteOptions {
  pool: Pool;
  userId: string;
  workflowId: string;
  workflowName: string;
  profession?: string;
  steps: WorkflowStepInput[];
  context?: Record<string, any>;
}

/**
 * Starter en workflow-utførelse. Returnerer runId umiddelbart.
 * Engine kjører i bakgrunnen (fire-and-forget).
 */
export async function startWorkflowRun(opts: ExecuteOptions): Promise<{ runId: string; stepsTotal: number }> {
  ensureRegistry();
  await ensureSchema(opts.pool);

  // Opprett run-record
  const runRes = await opts.pool.query(
    `INSERT INTO workflow_runs (workflow_id, workflow_name, user_id, profession, status, context, steps_total)
     VALUES ($1, $2, $3, $4, 'queued', $5, $6)
     RETURNING id`,
    [opts.workflowId, opts.workflowName, opts.userId, opts.profession || null,
     JSON.stringify(opts.context || {}), opts.steps.length],
  );
  const runId: string = runRes.rows[0].id;

  // Opprett step-records pending
  for (let i = 0; i < opts.steps.length; i++) {
    const step = opts.steps[i];
    const def = ACTION_REGISTRY.get(step.action_id);
    await opts.pool.query(
      `INSERT INTO workflow_run_steps (run_id, step_index, action_id, action_name, status, execution_mode)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [runId, i, step.action_id, step.action_name || def?.name || step.action_id, def?.mode || 'manual'],
    );
  }

  // Start utførelse i bakgrunnen
  executeWorkflowRun(runId, opts).catch((err) =>
    console.error(`[workflow-engine] run ${runId} feilet:`, err.message),
  );

  return { runId, stepsTotal: opts.steps.length };
}

async function executeWorkflowRun(runId: string, opts: ExecuteOptions): Promise<void> {
  await opts.pool.query(
    `UPDATE workflow_runs SET status = 'running' WHERE id = $1`,
    [runId],
  );

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < opts.steps.length; i++) {
    const step = opts.steps[i];
    const def = ACTION_REGISTRY.get(step.action_id);

    if (!def) {
      // Action ikke registrert — marker som awaiting_manual
      await opts.pool.query(
        `UPDATE workflow_run_steps SET status = 'awaiting_manual', completed_at = NOW()
         WHERE run_id = $1 AND step_index = $2`,
        [runId, i],
      );
      continue;
    }

    const startedAt = Date.now();
    await opts.pool.query(
      `UPDATE workflow_run_steps SET status = 'running', started_at = NOW()
       WHERE run_id = $1 AND step_index = $2`,
      [runId, i],
    );

    try {
      const result = await def.handler({
        userId: opts.userId,
        runId,
        stepIndex: i,
        stepData: {},
        workflowContext: opts.context || {},
        pool: opts.pool,
      });

      const status = result.completed
        ? 'completed'
        : result.requiresManualConfirmation
          ? 'awaiting_manual'
          : 'failed';

      await opts.pool.query(
        `UPDATE workflow_run_steps
         SET status = $1, result_data = $2, error_message = $3,
             completed_at = NOW(), duration_ms = $4
         WHERE run_id = $5 AND step_index = $6`,
        [status, JSON.stringify(result.data || {}), result.error || null,
         Date.now() - startedAt, runId, i],
      );

      if (status === 'completed') completed++;
      if (status === 'failed') failed++;
    } catch (err: any) {
      failed++;
      await opts.pool.query(
        `UPDATE workflow_run_steps
         SET status = 'failed', error_message = $1, completed_at = NOW(),
             duration_ms = $2
         WHERE run_id = $3 AND step_index = $4`,
        [err.message?.slice(0, 500), Date.now() - startedAt, runId, i],
      );
    }
  }

  // Finaliser run-status
  const totalAwaiting = await opts.pool.query(
    `SELECT COUNT(*) AS n FROM workflow_run_steps
     WHERE run_id = $1 AND status = 'awaiting_manual'`,
    [runId],
  );
  const awaiting = parseInt(totalAwaiting.rows[0].n, 10);

  let finalStatus: string;
  if (failed > 0 && completed === 0 && awaiting === 0) finalStatus = 'failed';
  else if (awaiting > 0) finalStatus = 'partial';
  else if (failed > 0) finalStatus = 'partial';
  else finalStatus = 'completed';

  await opts.pool.query(
    `UPDATE workflow_runs
     SET status = $1, steps_completed = $2, steps_failed = $3, completed_at = NOW()
     WHERE id = $4`,
    [finalStatus, completed, failed, runId],
  );
}

/**
 * Marker et awaiting_manual-step som ferdig (brukeren bekrefter selv).
 */
export async function confirmManualStep(pool: Pool, runId: string, stepIndex: number, note?: string): Promise<void> {
  await ensureSchema(pool);
  await pool.query(
    `UPDATE workflow_run_steps
     SET status = 'completed', completed_at = NOW(),
         result_data = COALESCE(result_data, '{}'::jsonb) || jsonb_build_object('manualNote', $1::text, 'confirmedAt', NOW()::text)
     WHERE run_id = $2 AND step_index = $3`,
    [note || null, runId, stepIndex],
  );

  // Oppdater run-status hvis alle awaiting_manual er ferdige
  const remaining = await pool.query(
    `SELECT COUNT(*) AS n FROM workflow_run_steps
     WHERE run_id = $1 AND status IN ('awaiting_manual', 'running', 'pending')`,
    [runId],
  );
  if (parseInt(remaining.rows[0].n, 10) === 0) {
    await pool.query(
      `UPDATE workflow_runs
       SET status = 'completed', completed_at = NOW(),
           steps_completed = (SELECT COUNT(*) FROM workflow_run_steps WHERE run_id = $1 AND status = 'completed')
       WHERE id = $1`,
      [runId],
    );
  }
}

/**
 * Slice 9X.79 — Re-kjør ett enkelt feilet steg uten å resette hele runet.
 * Stine kan trykke "Prøv igjen" på et failed step (f.eks. netverkfeil mot
 * Drive) og bare det steget kjøres på nytt. Run-status oppdateres etterpå.
 */
export async function retryStep(pool: Pool, runId: string, stepIndex: number): Promise<{ status: string; error?: string }> {
  await ensureSchema(pool);

  const stepRes = await pool.query(
    `SELECT s.action_id, s.status, r.user_id, r.context
       FROM workflow_run_steps s
       JOIN workflow_runs r ON r.id = s.run_id
      WHERE s.run_id = $1 AND s.step_index = $2`,
    [runId, stepIndex],
  );
  if (stepRes.rows.length === 0) throw new Error('step not found');
  const { action_id, status: currentStatus, user_id, context } = stepRes.rows[0];

  if (currentStatus !== 'failed') {
    throw new Error(`step is not in failed state (current: ${currentStatus})`);
  }

  const def = ACTION_REGISTRY.get(action_id);
  if (!def) throw new Error(`action ${action_id} not registered`);

  const startedAt = Date.now();
  await pool.query(
    `UPDATE workflow_run_steps
       SET status = 'running', started_at = NOW(),
           error_message = NULL, completed_at = NULL, duration_ms = NULL
     WHERE run_id = $1 AND step_index = $2`,
    [runId, stepIndex],
  );

  let finalStepStatus: string;
  let errMsg: string | null = null;
  try {
    const result = await def.handler({
      userId: user_id,
      runId,
      stepIndex,
      stepData: {},
      workflowContext: context || {},
      pool,
    });

    finalStepStatus = result.completed
      ? 'completed'
      : result.requiresManualConfirmation
        ? 'awaiting_manual'
        : 'failed';
    errMsg = result.error || null;

    await pool.query(
      `UPDATE workflow_run_steps
         SET status = $1, result_data = $2, error_message = $3,
             completed_at = NOW(), duration_ms = $4
       WHERE run_id = $5 AND step_index = $6`,
      [finalStepStatus, JSON.stringify(result.data || {}), errMsg,
       Date.now() - startedAt, runId, stepIndex],
    );
  } catch (err: any) {
    finalStepStatus = 'failed';
    errMsg = err.message?.slice(0, 500);
    await pool.query(
      `UPDATE workflow_run_steps
         SET status = 'failed', error_message = $1, completed_at = NOW(),
             duration_ms = $2
       WHERE run_id = $3 AND step_index = $4`,
      [errMsg, Date.now() - startedAt, runId, stepIndex],
    );
  }

  // Rekompiler run-aggregater
  const agg = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
       COUNT(*) FILTER (WHERE status IN ('awaiting_manual','running','pending')) AS open
     FROM workflow_run_steps WHERE run_id = $1`,
    [runId],
  );
  const completedN = parseInt(agg.rows[0].completed, 10);
  const failedN    = parseInt(agg.rows[0].failed, 10);
  const openN      = parseInt(agg.rows[0].open, 10);

  let runStatus: string;
  if (openN > 0) runStatus = openN === 1 && finalStepStatus === 'running' ? 'running' : 'partial';
  else if (failedN > 0 && completedN === 0) runStatus = 'failed';
  else if (failedN > 0) runStatus = 'partial';
  else runStatus = 'completed';

  await pool.query(
    `UPDATE workflow_runs
       SET status = $1, steps_completed = $2, steps_failed = $3,
           completed_at = CASE WHEN $1 IN ('completed','failed','partial') THEN NOW() ELSE completed_at END
     WHERE id = $4`,
    [runStatus, completedN, failedN, runId],
  );

  return { status: finalStepStatus, error: errMsg || undefined };
}

/**
 * Hent run + steps for frontend polling.
 */
export async function getRunStatus(pool: Pool, runId: string): Promise<any> {
  await ensureSchema(pool);
  const runRes = await pool.query(
    `SELECT * FROM workflow_runs WHERE id = $1`,
    [runId],
  );
  if (runRes.rows.length === 0) return null;
  const stepsRes = await pool.query(
    `SELECT * FROM workflow_run_steps WHERE run_id = $1 ORDER BY step_index ASC`,
    [runId],
  );
  return {
    run: runRes.rows[0],
    steps: stepsRes.rows,
  };
}
