/** Durable, project-scoped scheduler for cron_hourly/cron_daily lead rules. */
import type { Pool } from "pg";
import {
  evaluateRulesForLead,
  RuleEvaluationLeadNotFoundError,
  type TriggerEvent,
} from "./lead-rules-engine.js";

const POLL_INTERVAL_MS = 60_000;
const BOOT_DELAY_MS = 45_000;
const CLAIM_BATCH_SIZE = 50;
const MAX_CONCURRENCY = 5;

type ScheduledTrigger = Extract<TriggerEvent, "cron_hourly" | "cron_daily">;

interface ScheduledJob {
  id: string;
  organization_id: string;
  project_id: string;
  customer_id: string;
  trigger_event: ScheduledTrigger;
  schedule_bucket: string;
  attempts: number;
  lease_token: string;
}

let pollerHandle: NodeJS.Timeout | null = null;
let bootTimerHandle: NodeJS.Timeout | null = null;
let pollerRunning = false;
let lastHourlyMaterialized: string | null = null;
let lastDailyMaterialized: string | null = null;

export function scheduleBucket(now: Date, event: ScheduledTrigger): string {
  const bucket = new Date(now);
  bucket.setUTCMinutes(0, 0, 0);
  if (event === "cron_daily") bucket.setUTCHours(0);
  return bucket.toISOString();
}

async function enqueueBucket(
  pool: Pool,
  event: ScheduledTrigger,
  bucket: string,
): Promise<number> {
  const inserted = await pool.query(
    `INSERT INTO lead_automation_scheduled_jobs
       (organization_id, project_id, customer_id, trigger_event, schedule_bucket)
     SELECT DISTINCT rule.organization_id, rule.project_id, lead.id, $1, $2::timestamptz
       FROM lead_automation_rules rule
       JOIN leadgrid_projects project
         ON project.organization_id = rule.organization_id
        AND project.id = rule.project_id
       JOIN crm_customers lead
         ON lead.organization_id = rule.organization_id
        AND lead.project_id = rule.project_id
      WHERE rule.is_active = true
        AND rule.project_id IS NOT NULL
        AND $1 = ANY(rule.trigger_on)
        AND lead.archived_at IS NULL
        AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
     ON CONFLICT
       (organization_id, project_id, customer_id, trigger_event, schedule_bucket)
     DO NOTHING`,
    [event, bucket],
  );
  return inserted.rowCount ?? 0;
}

async function claimJobs(pool: Pool): Promise<ScheduledJob[]> {
  const claimed = await pool.query<ScheduledJob>(
    `WITH candidates AS (
       SELECT id
         FROM lead_automation_scheduled_jobs
        WHERE attempts < 5
          AND (
            (status IN ('pending', 'failed') AND available_at <= NOW())
            OR (status = 'running'
                AND started_at < NOW() - INTERVAL '30 minutes')
          )
        ORDER BY schedule_bucket ASC, created_at ASC, id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE lead_automation_scheduled_jobs job
        SET status = 'running', attempts = job.attempts + 1,
            started_at = NOW(), last_error = NULL, lease_token = gen_random_uuid()
       FROM candidates
      WHERE job.id = candidates.id
      RETURNING job.id::text, job.organization_id::text, job.project_id,
                job.customer_id::text, job.trigger_event,
                job.schedule_bucket::text, job.attempts, job.lease_token::text`,
    [CLAIM_BATCH_SIZE],
  );
  return claimed.rows;
}

async function finishJob(
  pool: Pool,
  job: ScheduledJob,
  status: "completed" | "failed",
  error?: unknown,
): Promise<void> {
  const message = error == null ? null : String(error).slice(0, 1000);
  const updated = await pool.query(
    `UPDATE lead_automation_scheduled_jobs
        SET status = $7::varchar,
            completed_at = CASE WHEN $7::varchar = 'completed' THEN NOW() ELSE NULL END,
            available_at = CASE
              WHEN $7::varchar = 'failed' AND attempts < 5
              THEN NOW() + make_interval(secs => LEAST(900, (15 * power(2, attempts))::int))
              ELSE available_at
            END,
            last_error = $8, lease_token = NULL
      WHERE id = $1::uuid
        AND organization_id = $2::uuid
        AND project_id = $3
        AND customer_id = $4::uuid
        AND trigger_event = $5
        AND lease_token = $6::uuid
        AND status = 'running'`,
    [job.id, job.organization_id, job.project_id, job.customer_id,
      job.trigger_event, job.lease_token, status, message],
  );
  if (updated.rowCount !== 1) throw new Error("scheduled_job_lease_lost");
}

async function processJob(pool: Pool, job: ScheduledJob): Promise<void> {
  try {
    await evaluateRulesForLead(pool, {
      organizationId: job.organization_id,
      projectId: job.project_id,
      customerId: job.customer_id,
      event: job.trigger_event,
      idempotencyKey: `scheduled-rule-${job.id}`,
    });
  } catch (error) {
    // A lead can be archived after materialisation.  That is a terminal, safe
    // no-op rather than a retryable system failure.
    if (error instanceof RuleEvaluationLeadNotFoundError) {
      await finishJob(pool, job, "completed", "lead_not_found");
      return;
    }
    await finishJob(pool, job, "failed", error);
    return;
  }
  await finishJob(pool, job, "completed");
}

async function processInChunks(pool: Pool, jobs: ScheduledJob[]): Promise<void> {
  for (let start = 0; start < jobs.length; start += MAX_CONCURRENCY) {
    await Promise.all(jobs.slice(start, start + MAX_CONCURRENCY)
      .map((job) => processJob(pool, job)));
  }
}

export async function runLeadRulesCronTick(
  pool: Pool,
  now = new Date(),
): Promise<{ enqueued: number; processed: number }> {
  if (pollerRunning) return { enqueued: 0, processed: 0 };
  pollerRunning = true;
  try {
    const hourly = scheduleBucket(now, "cron_hourly");
    const daily = scheduleBucket(now, "cron_daily");
    let enqueued = 0;
    // Materialising touches every live lead in projects with scheduled rules.
    // Do that once per bucket per process; the database unique key still makes
    // first boot/restarts and multiple instances converge safely.
    if (lastHourlyMaterialized !== hourly) {
      enqueued += await enqueueBucket(pool, "cron_hourly", hourly);
      lastHourlyMaterialized = hourly;
    }
    if (lastDailyMaterialized !== daily) {
      enqueued += await enqueueBucket(pool, "cron_daily", daily);
      lastDailyMaterialized = daily;
    }
    const jobs = await claimJobs(pool);
    await processInChunks(pool, jobs);
    return { enqueued, processed: jobs.length };
  } finally {
    pollerRunning = false;
  }
}

export function registerLeadRulesCron(pool: Pool): void {
  if (pollerHandle) return;
  pollerHandle = setInterval(() => {
    void runLeadRulesCronTick(pool).catch((error) => {
      console.error("[lead-rules-cron] tick failed", error);
    });
  }, POLL_INTERVAL_MS);
  pollerHandle.unref?.();
  bootTimerHandle = setTimeout(() => {
    void runLeadRulesCronTick(pool).catch((error) => {
      console.error("[lead-rules-cron] boot tick failed", error);
    });
  }, BOOT_DELAY_MS);
  bootTimerHandle.unref?.();
  console.log("[lead-rules-cron] durable project scheduler registered");
}

export function _stopLeadRulesCron(): void {
  if (pollerHandle) clearInterval(pollerHandle);
  if (bootTimerHandle) clearTimeout(bootTimerHandle);
  pollerHandle = null;
  bootTimerHandle = null;
  pollerRunning = false;
  lastHourlyMaterialized = null;
  lastDailyMaterialized = null;
}

export const __test = { enqueueBucket, claimJobs, finishJob, processJob };
