/**
 * job-queue.ts — DB-basert jobb-kø for tunge operasjoner.
 *
 * Motivasjon (18.07): probe-kjøringer, migrasjoner og fire-and-forget-
 * berikelser kjørte som løse promises i prosessen — Render-redeploy
 * midt i drepte dem stille. Køen gjør tunge jobber gjenopptagbare:
 *
 *   - enqueueJob(): rad i background_jobs (ev. dedupe_key mot duplikater)
 *   - Worker claimer med FOR UPDATE SKIP LOCKED (flerinstans-trygt),
 *     holder heartbeat, og skriver completed/re-kø/dead — aldri stille.
 *   - Stale-reclaim: kjørende jobber uten heartbeat (drept av restart)
 *     re-køes automatisk av neste instans som våkner.
 *   - Retry m/ eksponentiell backoff til max_attempts → 'dead' m/
 *     last_error synlig i admin-innsynet.
 *
 * Handlers registreres ved boot (job-handlers.ts). En handler skal være
 * idempotent — den KAN bli kjørt igjen etter en restart midt i.
 */

import type { Pool } from "pg";

export interface BackgroundJob {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  created_at: string | Date;
  lease_token: string;
}

export interface JobExecutionContext {
  /** Aborted as soon as this worker can no longer prove ownership of the job. */
  signal: AbortSignal;
}

export type JobHandler = (
  pool: Pool,
  payload: Record<string, unknown>,
  job: BackgroundJob,
  context: JobExecutionContext,
) => Promise<Record<string, unknown> | void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(jobType: string, handler: JobHandler): void {
  if (handlers.has(jobType)) {
    throw new Error(`Job-handler for '${jobType}' er allerede registrert.`);
  }
  handlers.set(jobType, handler);
}

/** Kun for tester. */
export function clearJobHandlers(): void {
  handlers.clear();
}

// ─────────────────────────────────────────────────────────────────────
// Rene hjelpere (enhetstestet)
// ─────────────────────────────────────────────────────────────────────

/** Eksponentiell backoff m/ tak: 30s, 2m, 8m, 30m, 30m … */
export function computeBackoffMs(attempts: number): number {
  const base = 30_000 * Math.pow(4, Math.max(0, attempts - 1));
  return Math.min(base, 30 * 60_000);
}

/** Neste tilstand etter feil: re-kø til forsøkene er brukt opp, så dead. */
export function transitionForFailure(
  attempts: number,
  maxAttempts: number,
): { status: "queued" | "dead"; delayMs: number } {
  if (attempts >= maxAttempts) return { status: "dead", delayMs: 0 };
  return { status: "queued", delayMs: computeBackoffMs(attempts) };
}

/**
 * A worker from the previous release can see a newly-enqueued job type while
 * pods overlap during a rolling deploy. Treating that as an ordinary handler
 * failure can exhaust all attempts before a new worker becomes ready.
 *
 * Missing handlers are therefore deferred without consuming an execution
 * attempt for a bounded window. Truly unknown job types still become `dead`
 * after the window, so operational mistakes remain visible and finite.
 */
export const MISSING_HANDLER_DEFER_MS = 60_000;
export const MISSING_HANDLER_MAX_AGE_MS = 30 * 60_000;

export function transitionForMissingHandler(
  createdAt: string | Date,
  now = new Date(),
): { status: "queued" | "dead"; delayMs: number } {
  const createdAtMs =
    createdAt instanceof Date ? createdAt.valueOf() : Date.parse(createdAt);
  const ageMs = now.valueOf() - createdAtMs;
  if (!Number.isFinite(ageMs) || ageMs >= MISSING_HANDLER_MAX_AGE_MS) {
    return { status: "dead", delayMs: 0 };
  }
  return { status: "queued", delayMs: MISSING_HANDLER_DEFER_MS };
}

// ─────────────────────────────────────────────────────────────────────
// Kø-API
// ─────────────────────────────────────────────────────────────────────

export async function enqueueJob(
  pool: Pool,
  input: {
    jobType: string;
    payload?: Record<string, unknown>;
    dedupeKey?: string | null;
    priority?: number;
    maxAttempts?: number;
    runAfterMs?: number;
    createdBy?: string | null;
  },
): Promise<{ enqueued: boolean; jobId: string | null }> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO background_jobs
       (job_type, payload, priority, max_attempts, run_after, dedupe_key, created_by)
     VALUES ($1, $2::jsonb, $3, $4, now() + ($5 || ' milliseconds')::interval, $6, $7)
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('queued','running')
     DO NOTHING
     RETURNING id::text`,
    [
      input.jobType,
      JSON.stringify(input.payload ?? {}),
      input.priority ?? 100,
      input.maxAttempts ?? 3,
      String(input.runAfterMs ?? 0),
      input.dedupeKey ?? null,
      input.createdBy ?? null,
    ],
  );
  return { enqueued: r.rows.length > 0, jobId: r.rows[0]?.id ?? null };
}

/** Re-kø kjørende jobber med død heartbeat (drept av deploy-restart). */
export async function reclaimStaleJobs(
  pool: Pool,
  opts: { staleAfterMs?: number } = {},
): Promise<number> {
  const staleMs = opts.staleAfterMs ?? 2 * 60_000;
  const r = await pool.query(
    `UPDATE background_jobs
        SET status = 'queued', updated_at = now(),
            lease_token = NULL,
            heartbeat_at = NULL,
            last_error = COALESCE(last_error, '') || ' [re-køet etter død heartbeat]'
      WHERE status = 'running'
        AND heartbeat_at < now() - ($1 || ' milliseconds')::interval`,
    [String(staleMs)],
  );
  return r.rowCount ?? 0;
}

/**
 * Claim og kjør ÉN jobb. Returnerer hva som skjedde — 'idle' når køen er
 * tom. Eksportert separat så den kan testes uten worker-loopen.
 */
export async function processNextJob(
  pool: Pool,
  opts: { heartbeatMs?: number } = {},
): Promise<
  "idle" | "completed" | "requeued" | "dead" | "no_handler" | "lease_lost"
> {
  const claimed = await pool.query<BackgroundJob & { payload: Record<string, unknown> }>(
    `UPDATE background_jobs
        SET status = 'running', started_at = now(), heartbeat_at = now(),
            lease_token = gen_random_uuid(),
            attempts = attempts + 1, updated_at = now()
      WHERE id = (
        SELECT id FROM background_jobs
         WHERE status = 'queued' AND run_after <= now()
         ORDER BY priority, created_at
         LIMIT 1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id::text, job_type, payload, attempts, max_attempts,
                created_at, lease_token::text`,
  );
  const job = claimed.rows[0];
  if (!job) return "idle";

  const handler = handlers.get(job.job_type);
  if (!handler) {
    const transition = transitionForMissingHandler(job.created_at);
    const message =
      transition.status === "queued"
        ? `Ingen handler registrert for '${job.job_type}'. Utsatt for rolling deploy.`
        : `Ingen handler registrert for '${job.job_type}' innen defer-vinduet.`;
    const updated = await pool.query(
      `UPDATE background_jobs
          SET status = $2,
              attempts = CASE
                WHEN $2 = 'queued' THEN GREATEST(attempts - 1, 0)
                ELSE attempts
              END,
              run_after = now() + ($3 || ' milliseconds')::interval,
              last_error = $4,
              completed_at = CASE WHEN $2 = 'dead' THEN now() ELSE NULL END,
              heartbeat_at = NULL,
              lease_token = NULL,
              updated_at = now()
        WHERE id = $1::uuid
          AND status = 'running'
          AND lease_token = $5::uuid`,
      [
        job.id,
        transition.status,
        String(transition.delayMs),
        message,
        job.lease_token,
      ],
    );
    return (updated.rowCount ?? 0) > 0 ? "no_handler" : "lease_lost";
  }

  // Heartbeat mens handleren kjører — det er denne som gjør at en drept
  // instans oppdages av reclaimStaleJobs.
  const controller = new AbortController();
  let heartbeatInFlight = false;
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight || controller.signal.aborted) return;
    heartbeatInFlight = true;
    void pool
      .query(
        `UPDATE background_jobs
            SET heartbeat_at = now(), updated_at = now()
          WHERE id = $1::uuid
            AND status = 'running'
            AND lease_token = $2::uuid`,
        [job.id, job.lease_token],
      )
      .then((renewed) => {
        if ((renewed.rowCount ?? 0) !== 1) {
          controller.abort(new Error("job_lease_lost"));
        }
      })
      .catch(() => {
        // A DB error means ownership cannot be proven. Stop side effects until
        // a later claimant resumes the idempotent job.
        controller.abort(new Error("job_lease_unverified"));
      })
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, opts.heartbeatMs ?? 30_000);

  try {
    const result = await handler(pool, job.payload ?? {}, job, {
      signal: controller.signal,
    });
    const completed = await pool.query(
      `UPDATE background_jobs
          SET status = 'completed', completed_at = now(), updated_at = now(),
              result = $2::jsonb, last_error = NULL,
              heartbeat_at = NULL, lease_token = NULL
        WHERE id = $1::uuid
          AND status = 'running'
          AND lease_token = $3::uuid`,
      [job.id, JSON.stringify(result ?? {}), job.lease_token],
    );
    return (completed.rowCount ?? 0) === 1 ? "completed" : "lease_lost";
  } catch (err) {
    const t = transitionForFailure(job.attempts, job.max_attempts);
    const failed = await pool.query(
      `UPDATE background_jobs
          SET status = $2, updated_at = now(),
              run_after = now() + ($3 || ' milliseconds')::interval,
              completed_at = CASE WHEN $2 = 'dead' THEN now() ELSE NULL END,
              last_error = $4,
              heartbeat_at = NULL,
              lease_token = NULL
        WHERE id = $1::uuid
          AND status = 'running'
          AND lease_token = $5::uuid`,
      [
        job.id,
        t.status,
        String(t.delayMs),
        String(err).slice(0, 800),
        job.lease_token,
      ],
    );
    if ((failed.rowCount ?? 0) !== 1) return "lease_lost";
    return t.status === "dead" ? "dead" : "requeued";
  } finally {
    clearInterval(heartbeat);
    if (!controller.signal.aborted) {
      controller.abort(new Error("job_execution_finished"));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Worker-loop
// ─────────────────────────────────────────────────────────────────────

let workerStarted = false;
let stopping = false;

export function startJobQueueWorker(
  pool: Pool,
  opts: { pollMs?: number; concurrency?: number } = {},
): void {
  if (workerStarted) return;
  workerStarted = true;
  const pollMs = opts.pollMs ?? 2_000;
  const concurrency = Math.max(1, opts.concurrency ?? 2);

  // Graceful: ved SIGTERM (Render-redeploy) slutter vi å claime nye jobber.
  // Jobber midt i kjøring mister heartbeat når prosessen dør og re-køes
  // av neste instans — det ER designet, ikke et unntak.
  process.once("SIGTERM", () => {
    stopping = true;
  });

  const loop = async (workerIndex: number): Promise<void> => {
    // Stale-reclaim ved oppstart (kun worker 0) — fanger jobber forrige
    // instans etterlot seg.
    if (workerIndex === 0) {
      const reclaimed = await reclaimStaleJobs(pool).catch(() => 0);
      if (reclaimed > 0) console.log(`[job-queue] re-køet ${reclaimed} jobber etter restart`);
    }
    while (!stopping) {
      let outcome: Awaited<ReturnType<typeof processNextJob>> = "idle";
      try {
        outcome = await processNextJob(pool);
      } catch (err) {
        // Claim-feil (f.eks. tabell mangler før migrasjon) — logg og vent.
        console.warn("[job-queue] claim feilet:", String(err).slice(0, 200));
      }
      if (outcome === "idle") {
        await new Promise((r) => setTimeout(r, pollMs));
      }
    }
  };

  for (let i = 0; i < concurrency; i++) {
    void loop(i).catch((err) => {
      console.error("[job-queue] worker-loop døde:", String(err).slice(0, 300));
    });
  }
  // Periodisk stale-reclaim også under drift (andre instansers døde jobber).
  setInterval(() => {
    if (!stopping) void reclaimStaleJobs(pool).catch(() => 0);
  }, 60_000).unref?.();

  console.log(`[job-queue] worker startet (concurrency=${concurrency}, poll=${pollMs}ms)`);
}
