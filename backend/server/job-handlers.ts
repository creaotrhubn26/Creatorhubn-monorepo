/**
 * job-handlers.ts — registrering av jobbtyper for jobb-køen.
 *
 * Én fil å lete i for «hva kan køen kjøre». Handlers skal være
 * idempotente — de KAN kjøres igjen etter en restart midt i.
 */

import type { Pool } from "pg";
import type { Express, Request, Response } from "express";
import { enqueueJob, registerJobHandler, startJobQueueWorker } from "./job-queue.js";

export function registerCoreJobHandlers(): void {
  // Første konsument: BRREG-berikelse av leads (visittkort-skann m.fl.).
  // Var fire-and-forget-promise i from-card-ruten — døde ved redeploy.
  // Idempotent: enrichLeadWithBrreg gjenbruker enrichment_org_nr og
  // cacher 30 dager, så en re-kjøring er trygg.
  registerJobHandler("lead_brreg_enrich", async (pool, payload) => {
    const leadId = typeof payload.leadId === "string" ? payload.leadId : null;
    const ownerUserId = typeof payload.ownerUserId === "string" ? payload.ownerUserId : null;
    if (!leadId || !ownerUserId) throw new Error("payload mangler leadId/ownerUserId");
    const { enrichLeadWithBrreg } = await import("./lead-brreg-service.js");
    const result = await enrichLeadWithBrreg(pool, {
      leadId,
      workspaceOwnerUserId: ownerUserId,
    });
    return { found: result.found };
  });


  // Geo-probe-kjøringer (citation-tracker): lange LLM-jobber (10–15 min)
  // som før levde som løse promises. Idempotent gjenopptak: finnes en
  // 'running'-kjøring for settet (drept av restart), fullføres DEN i
  // stedet for å starte en ny — executeProbeRun hopper over prompts som
  // alt har svar. Lav prioritet (200) så raske jobber går foran.
  registerJobHandler("geo_probe_run", async (pool, payload) => {
    const setId = typeof payload.setId === "string" ? payload.setId : null;
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    if (!setId || !userId) throw new Error("payload mangler setId/userId");
    const { executeProbeRun, runProbe } = await import(
      "./market-intelligence/geo-probe-runner-service.js"
    );
    const existing = await pool.query<{ id: string }>(
      `SELECT id::text FROM geo_probe_runs
        WHERE prompt_set_id = $1::uuid AND status = 'running'
        ORDER BY started_at DESC LIMIT 1`,
      [setId],
    );
    if (existing.rows[0]) {
      const resumed = await executeProbeRun(pool, existing.rows[0].id);
      return { resumedRunId: existing.rows[0].id, ...asJobResult(resumed) };
    }
    const run = await runProbe(pool, setId, userId);
    return asJobResult(run);
  });
}

/** Gjør et vilkårlig kjøre-resultat trygt som JSONB-result. */
function asJobResult(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return { value: value ?? null };
}

/** Kø en geo-probe-kjøring (dedupet per sett; valgfri forsinkelse for
 *  å bevare cron-ens sekvensielle kostnadsprofil). */
export async function enqueueGeoProbeRun(
  pool: Pool,
  input: { setId: string; userId: string; delayMs?: number },
): Promise<void> {
  await enqueueJob(pool, {
    jobType: "geo_probe_run",
    payload: { setId: input.setId, userId: input.userId },
    dedupeKey: `geo_probe_run|${input.setId}`,
    priority: 200,
    maxAttempts: 2,
    runAfterMs: input.delayMs ?? 0,
    createdBy: input.userId,
  });
}

/** Kø en BRREG-berikelse (dedupet per lead — én aktiv jobb om gangen). */
export async function enqueueLeadBrregEnrich(
  pool: Pool,
  input: { leadId: string; ownerUserId: string },
): Promise<void> {
  await enqueueJob(pool, {
    jobType: "lead_brreg_enrich",
    payload: { leadId: input.leadId, ownerUserId: input.ownerUserId },
    dedupeKey: `lead_brreg_enrich|${input.leadId}`,
    createdBy: input.ownerUserId,
  });
}

/** Boot: registrer handlers + start worker. Kalles én gang fra index.ts. */
export function startBackgroundJobs(pool: Pool): void {
  registerCoreJobHandlers();
  startJobQueueWorker(pool, { concurrency: 2, pollMs: 2_000 });
}

/** Admin-innsyn: siste jobber m/ status og feil — feil skal være synlige. */
export function setupJobQueueRoutes(deps: {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, { userId: string; role?: string; email?: string }>;
  isAdminEmail: (email: string | undefined) => boolean;
}): void {
  const { app, pool, activeSessions, isAdminEmail } = deps;
  app.get("/api/admin-room/jobs", async (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    const session = auth?.startsWith("Bearer ")
      ? activeSessions.get(auth.slice(7).trim()) ?? null
      : null;
    if (!session) return res.status(401).json({ error: "ikke_innlogget" });
    if (session.role !== "admin" && !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "krever_admin" });
    }
    try {
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? Math.round(limitRaw) : 50;
      const r = await pool.query(
        `SELECT id::text, job_type, status, attempts, max_attempts,
                run_after::text, started_at::text, completed_at::text,
                last_error, created_at::text
           FROM background_jobs
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit],
      );
      const counts = await pool.query<{ status: string; n: number }>(
        `SELECT status, COUNT(*)::int AS n FROM background_jobs GROUP BY status`,
      );
      return res.json({
        jobs: r.rows,
        counts: Object.fromEntries(counts.rows.map((c) => [c.status, c.n])),
      });
    } catch (err) {
      return res.status(500).json({ error: "jobs_list_failed" });
    }
  });
}
