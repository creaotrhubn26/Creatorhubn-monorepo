// Orchestration worker — plukker køede runs fra orchestration_runs og
// kjører action-sekvensen for hver. Markerer completedActions /
// failedActions ærlig: ekte action-implementasjoner kjører og
// rapporterer suksess; ikke-implementerte actions markeres
// `not_implemented`.
//
// Workeren er in-process (setInterval) — for produksjons-scale bør den
// flyttes til en dedikert kø-tjener (BullMQ + Redis), men dette er
// nok ærlig for et MVP-photographer-flow.

import type { Pool } from "pg";

const POLL_INTERVAL_MS = 5000;
const MAX_RUNS_PER_TICK = 5;

// Definisjoner som speiler FotografOrchestrator.tsx — men på backend.
// Hver action har en handler. Hvis handler returnerer { ok: true } legges
// den til completedActions; ellers failedActions med reason.
//
// For nå er bare BREG-validering implementert som ekte. Andre actions
// markeres `not_implemented`. Bedre ærlig enn å lyve om dem.

interface ActionContext {
  pool: Pool;
  userId: string;
  triggerData: Record<string, any>;
}

interface ActionResult {
  ok: boolean;
  reason?: string;
  data?: Record<string, any>;
}

type ActionHandler = (ctx: ActionContext) => Promise<ActionResult>;

const notImplemented = (name: string): ActionHandler => async () => ({
  ok: false,
  reason: `not_implemented: ${name}`,
});

// Brønnøysundregistrene — gratis public API. Bruker den direkte
// (https://data.brreg.no/enhetsregisteret/api/enheter/<orgnr>).
const validateBRREG: ActionHandler = async (ctx) => {
  const orgNumber =
    ctx.triggerData?.organizationNumber ??
    ctx.triggerData?.orgNumber ??
    ctx.triggerData?.organisasjonsnummer;
  if (!orgNumber || typeof orgNumber !== "string") {
    return { ok: false, reason: "missing_organization_number" };
  }
  const cleaned = orgNumber.replace(/\D/g, "");
  if (cleaned.length !== 9) {
    return { ok: false, reason: "invalid_organization_number_format" };
  }
  try {
    const res = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${cleaned}`,
    );
    if (res.status === 404) {
      return { ok: false, reason: "not_registered_in_brreg" };
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: `brreg_api_error: ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      navn?: string;
      organisasjonsnummer?: string;
      slettedato?: string;
      konkurs?: boolean;
    };
    if (data.slettedato) {
      return { ok: false, reason: "company_deleted" };
    }
    if (data.konkurs) {
      return { ok: false, reason: "company_bankrupt" };
    }
    return {
      ok: true,
      data: {
        name: data.navn,
        organizationNumber: data.organisasjonsnummer,
      },
    };
  } catch (err: any) {
    return {
      ok: false,
      reason: `brreg_fetch_failed: ${String(err?.message || err).slice(0, 100)}`,
    };
  }
};

// Action-registry. Hver entry er en mapping av en
// FOTOGRAF_ORCHESTRATIONS-action ({component, action}) til en handler.
const ACTION_HANDLERS: Record<string, ActionHandler> = {
  "BRREGIntegration.validateBusiness": validateBRREG,
  // Ikke-implementerte actions — workeren rapporterer ærlig
  "GoogleDriveProjectSync.createProjectFolder": notImplemented(
    "GoogleDriveProjectSync.createProjectFolder",
  ),
  "ContractGenerator.generateContract": notImplemented(
    "ContractGenerator.generateContract",
  ),
  "ShowcaseLanding.createClientShowcase": notImplemented(
    "ShowcaseLanding.createClientShowcase",
  ),
  "UniversalChatWidget.sendWelcomeMessage": notImplemented(
    "UniversalChatWidget.sendWelcomeMessage",
  ),
  "UniversalFileUpload.processUpload": notImplemented(
    "UniversalFileUpload.processUpload",
  ),
  "PhotoEnhancementSuite.analyzePhoto": notImplemented(
    "PhotoEnhancementSuite.analyzePhoto",
  ),
  "PhotoEnhancementSuite.autoEnhance": notImplemented(
    "PhotoEnhancementSuite.autoEnhance",
  ),
  "UniversalRAWProcessor.processRAW": notImplemented(
    "UniversalRAWProcessor.processRAW",
  ),
  "GoogleDriveProjectSync.syncToClient": notImplemented(
    "GoogleDriveProjectSync.syncToClient",
  ),
  "UniversalChatWidget.notifyClient": notImplemented(
    "UniversalChatWidget.notifyClient",
  ),
  "EvendiTimelineAdmin.createTimeline": notImplemented(
    "EvendiTimelineAdmin.createTimeline",
  ),
  "ContractGenerator.generateWeddingContract": notImplemented(
    "ContractGenerator.generateWeddingContract",
  ),
  "GoogleDriveProjectSync.createWeddingFolder": notImplemented(
    "GoogleDriveProjectSync.createWeddingFolder",
  ),
  "WeddingTimelineClient.shareWithCouple": notImplemented(
    "WeddingTimelineClient.shareWithCouple",
  ),
  "UniversalChatWidget.setupWeddingChat": notImplemented(
    "UniversalChatWidget.setupWeddingChat",
  ),
};

// Sekvenser per orchestrationId — speiler frontend-definisjonene.
const ORCHESTRATION_SEQUENCES: Record<string, string[]> = {
  nyKlient: [
    "BRREGIntegration.validateBusiness",
    "GoogleDriveProjectSync.createProjectFolder",
    "ContractGenerator.generateContract",
    "ShowcaseLanding.createClientShowcase",
    "UniversalChatWidget.sendWelcomeMessage",
  ],
  aiPhotoEnhancement: [
    "UniversalFileUpload.processUpload",
    "PhotoEnhancementSuite.analyzePhoto",
    "PhotoEnhancementSuite.autoEnhance",
    "UniversalRAWProcessor.processRAW",
    "GoogleDriveProjectSync.syncToClient",
    "UniversalChatWidget.notifyClient",
  ],
  weddingWorkflow: [
    "EvendiTimelineAdmin.createTimeline",
    "ContractGenerator.generateWeddingContract",
    "GoogleDriveProjectSync.createWeddingFolder",
    "WeddingTimelineClient.shareWithCouple",
    "UniversalChatWidget.setupWeddingChat",
  ],
};

interface RunRow {
  id: string;
  orchestration_id: string;
  user_id: string;
  trigger_data: Record<string, any>;
}

const executeRun = async (pool: Pool, run: RunRow): Promise<void> => {
  const actions = ORCHESTRATION_SEQUENCES[run.orchestration_id];
  if (!actions || actions.length === 0) {
    await pool.query(
      `UPDATE orchestration_runs
          SET status = 'failed',
              error_message = $2,
              completed_at = now(),
              updated_at = now()
        WHERE id = $1`,
      [
        run.id,
        `unknown_orchestration: ${run.orchestration_id} har ingen registrert sekvens`,
      ],
    );
    return;
  }

  const ctx: ActionContext = {
    pool,
    userId: run.user_id,
    triggerData: run.trigger_data || {},
  };

  const completed: string[] = [];
  const failed: Array<{ action: string; reason: string }> = [];

  for (const action of actions) {
    const handler = ACTION_HANDLERS[action];
    let result: ActionResult;
    try {
      result = handler
        ? await handler(ctx)
        : { ok: false, reason: `no_handler_registered: ${action}` };
    } catch (err: any) {
      result = {
        ok: false,
        reason: `handler_threw: ${String(err?.message || err).slice(0, 100)}`,
      };
    }

    if (result.ok) {
      completed.push(action);
      await pool.query(
        `UPDATE orchestration_runs
            SET completed_actions = completed_actions || $2::jsonb,
                updated_at = now()
          WHERE id = $1`,
        [run.id, JSON.stringify([action])],
      );
    } else {
      failed.push({ action, reason: result.reason || "unknown_failure" });
      await pool.query(
        `UPDATE orchestration_runs
            SET failed_actions = failed_actions || $2::jsonb,
                updated_at = now()
          WHERE id = $1`,
        [
          run.id,
          JSON.stringify([{ action, reason: result.reason || "unknown_failure" }]),
        ],
      );
    }
  }

  // Endelig status
  let finalStatus: "completed" | "partial" | "failed";
  if (failed.length === 0) finalStatus = "completed";
  else if (completed.length === 0) finalStatus = "failed";
  else finalStatus = "partial";

  await pool.query(
    `UPDATE orchestration_runs
        SET status = $2,
            completed_at = now(),
            updated_at = now(),
            error_message = $3
      WHERE id = $1`,
    [
      run.id,
      finalStatus,
      finalStatus === "failed"
        ? `Alle ${actions.length} actions feilet — sjekk failed_actions for detaljer`
        : null,
    ],
  );
};

let tickInProgress = false;

const tick = async (pool: Pool): Promise<void> => {
  if (tickInProgress) return;
  tickInProgress = true;
  try {
    // Plukk køede runs med FOR UPDATE SKIP LOCKED for å unngå at to
    // workere prosesserer samme rad.
    const r = await pool.query<RunRow>(
      `WITH picked AS (
         SELECT id
           FROM orchestration_runs
          WHERE status = 'queued'
            AND expires_at > now()
          ORDER BY started_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       UPDATE orchestration_runs r
          SET status = 'running',
              updated_at = now()
        FROM picked
        WHERE r.id = picked.id
        RETURNING r.id, r.orchestration_id, r.user_id, r.trigger_data`,
      [MAX_RUNS_PER_TICK],
    );

    for (const row of r.rows) {
      try {
        await executeRun(pool, row);
      } catch (err) {
        console.error(
          `[orchestration-worker] run ${row.id} crashed:`,
          err,
        );
        await pool
          .query(
            `UPDATE orchestration_runs
                SET status = 'failed',
                    error_message = $2,
                    completed_at = now(),
                    updated_at = now()
              WHERE id = $1`,
            [
              row.id,
              `worker_crashed: ${String((err as any)?.message || err).slice(0, 200)}`,
            ],
          )
          .catch(() => undefined);
      }
    }
  } catch (err) {
    console.error("[orchestration-worker] tick failed:", err);
  } finally {
    tickInProgress = false;
  }
};

let intervalHandle: NodeJS.Timeout | null = null;

export function startOrchestrationWorker(pool: Pool): void {
  if (intervalHandle) return;
  // Første tick umiddelbart, så hvert POLL_INTERVAL_MS
  void tick(pool);
  intervalHandle = setInterval(() => {
    void tick(pool);
  }, POLL_INTERVAL_MS);
  console.log(
    `[orchestration-worker] startet — poller hvert ${POLL_INTERVAL_MS / 1000}s`,
  );
}

export function stopOrchestrationWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export const ORCHESTRATION_WORKER_INTERNAL = {
  // Eksportert for unit-tester
  ACTION_HANDLERS,
  ORCHESTRATION_SEQUENCES,
  executeRun,
};
