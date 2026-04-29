// Audition-reminder cron sweep.
//
// Speiler runRoleRoomCommercialReminderSweep i form: in-process setInterval,
// idempotent via casting_schedules.reminders_sent JSONB, status persistert i
// modul-scope. SMS via Twilio (brand=role-room), e-post som fallback når
// kandidat mangler telefon eller har slått av SMS.

import type { Pool } from "pg";
import {
  buildAuditionReminderEmail,
  buildAuditionReminderSmsBody,
  isEmailConfigured,
  isSmsBrandConfigured,
  parseReminderPrefs,
  sendEmail,
  sendSms,
  type ReminderBrand,
  type ReminderContext,
  type ReminderPrefs,
  type ReminderThreshold,
} from "./casting-reminder-sender.js";
import { recordSmsUsage } from "./casting-sms-billing.js";

const AUDITION_REMINDER_BRAND: ReminderBrand = "role-room";
const AUDITION_REMINDER_BRAND_LABEL = "The Role Room";
const AUDITION_REMINDER_RUNNER_KEY = "audition-reminder";
const THRESHOLD_WINDOW_MINUTES = 15;

export interface AuditionReminderSweepSummary {
  reason: "startup" | "interval" | "manual";
  startedAt: string;
  finishedAt: string;
  isRunning: boolean;
  scanned: number;
  smsSent: number;
  emailSent: number;
  skipped: number;
  failures: number;
  notes: string[];
}

let auditionReminderSweepPromise: Promise<AuditionReminderSweepSummary> | null =
  null;
let lastSweepSummary: AuditionReminderSweepSummary | null = null;
let auditionReminderSchedulerStarted = false;

interface ScheduleRow {
  id: string;
  project_id: string;
  candidate_id: string | null;
  date: string | null;
  start_time: string | null;
  status: string | null;
  type: string | null;
  notes: string | null;
  location: string | null;
  reminders_sent: Record<string, string> | null;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  candidate_reminder_prefs: unknown;
  project_name: string | null;
}

interface ResolvedThreshold {
  threshold: ReminderThreshold;
  scheduledAt: Date;
}

export function shouldSendAuditionReminder(input: {
  date: string | null;
  startTime: string | null;
  status: string | null;
  type: string | null;
  remindersSent: Record<string, string> | null;
  now?: Date;
  windowMinutes?: number;
}): ResolvedThreshold | null {
  if (input.type !== "audition") return null;
  const status = (input.status || "").toLowerCase();
  if (status === "canceled" || status === "completed") return null;
  if (!input.date || !input.startTime) return null;

  const scheduledAt = parseScheduledAt(input.date, input.startTime);
  if (!scheduledAt) return null;

  const now = input.now ?? new Date();
  const window = (input.windowMinutes ?? THRESHOLD_WINDOW_MINUTES) * 60 * 1000;
  const diffMs = scheduledAt.getTime() - now.getTime();

  const sent = input.remindersSent || {};

  const target1h = 60 * 60 * 1000;
  if (Math.abs(diffMs - target1h) <= window && !sent["1h"]) {
    return { threshold: "1h", scheduledAt };
  }

  const target24h = 24 * 60 * 60 * 1000;
  if (Math.abs(diffMs - target24h) <= window && !sent["24h"]) {
    return { threshold: "24h", scheduledAt };
  }

  return null;
}

function parseScheduledAt(date: string, startTime: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(startTime);
  if (!dateMatch || !timeMatch) return null;
  const iso = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:00+02:00`;
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function isRunnerEnabled(): boolean {
  const value = (process.env.AUDITION_REMINDER_RUNNER_ENABLED || "true")
    .trim()
    .toLowerCase();
  return value !== "false" && value !== "0" && value !== "off";
}

function readIntervalMs(): number {
  const minutes = Number(process.env.AUDITION_REMINDER_INTERVAL_MINUTES || 15);
  if (!Number.isFinite(minutes) || minutes <= 0) return 15 * 60 * 1000;
  return Math.max(1, Math.floor(minutes)) * 60 * 1000;
}

function buildSummary(reason: AuditionReminderSweepSummary["reason"]): AuditionReminderSweepSummary {
  const ts = new Date().toISOString();
  return {
    reason,
    startedAt: ts,
    finishedAt: ts,
    isRunning: true,
    scanned: 0,
    smsSent: 0,
    emailSent: 0,
    skipped: 0,
    failures: 0,
    notes: [],
  };
}

export function readAuditionReminderStatus(): AuditionReminderSweepSummary | null {
  return lastSweepSummary;
}

interface RunnerDeps {
  pool: Pool;
  now?: Date;
  portalUrl?: string | null;
  fetchImpl?: typeof fetch;
}

export async function runAuditionReminderSweep(
  reason: AuditionReminderSweepSummary["reason"],
  deps: RunnerDeps,
): Promise<AuditionReminderSweepSummary> {
  if (auditionReminderSweepPromise) {
    const summary = lastSweepSummary || {
      ...buildSummary(reason),
      notes: ["En reminder-kjøring pågår allerede."],
    };
    return summary;
  }

  const task = (async () => {
    const summary = buildSummary(reason);
    lastSweepSummary = summary;

    try {
      const rows = await fetchUpcomingAuditions(deps.pool);
      summary.scanned = rows.length;

      for (const row of rows) {
        try {
          await processScheduleRow({ row, summary, deps });
        } catch (error) {
          summary.failures += 1;
          summary.notes.push(
            `schedule=${row.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      summary.failures += 1;
      summary.notes.push(
        `sweep_error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      summary.isRunning = false;
      summary.finishedAt = new Date().toISOString();
      lastSweepSummary = summary;
    }

    return summary;
  })();

  auditionReminderSweepPromise = task;
  try {
    return await task;
  } finally {
    auditionReminderSweepPromise = null;
  }
}

async function fetchUpcomingAuditions(pool: Pool): Promise<ScheduleRow[]> {
  const result = await pool.query<ScheduleRow>(
    `SELECT
       cs.id,
       cs.project_id,
       cs.candidate_id,
       cs.date::text          AS date,
       cs.start_time          AS start_time,
       cs.status              AS status,
       cs.type                AS type,
       cs.notes               AS notes,
       cs.location            AS location,
       cs.reminders_sent      AS reminders_sent,
       cc.name                AS candidate_name,
       cc.email               AS candidate_email,
       cc.phone               AS candidate_phone,
       cc.reminder_prefs      AS candidate_reminder_prefs,
       cp.name                AS project_name
     FROM casting_schedules cs
     LEFT JOIN casting_candidates cc ON cc.id = cs.candidate_id
     LEFT JOIN casting_projects   cp ON cp.id = cs.project_id
     WHERE cs.type = 'audition'
       AND cs.status NOT IN ('canceled', 'completed')
       AND cs.date IS NOT NULL
       AND cs.date >= CURRENT_DATE - INTERVAL '1 day'
       AND cs.date <= CURRENT_DATE + INTERVAL '2 days'`,
  );
  return result.rows;
}

async function processScheduleRow(input: {
  row: ScheduleRow;
  summary: AuditionReminderSweepSummary;
  deps: RunnerDeps;
}): Promise<void> {
  const { row, summary, deps } = input;
  const decision = shouldSendAuditionReminder({
    date: row.date,
    startTime: row.start_time,
    status: row.status,
    type: row.type,
    remindersSent: row.reminders_sent || {},
    now: deps.now,
  });

  if (!decision) {
    summary.skipped += 1;
    return;
  }

  if (!row.candidate_id) {
    summary.skipped += 1;
    return;
  }

  const prefs: ReminderPrefs = parseReminderPrefs(row.candidate_reminder_prefs);

  const ctx: ReminderContext = {
    candidateName: row.candidate_name?.trim() || "",
    projectName: row.project_name?.trim() || "Audition",
    date: row.date || "",
    startTime: row.start_time || "",
    location: row.location,
    threshold: decision.threshold,
    portalUrl: deps.portalUrl ?? null,
    brandLabel: AUDITION_REMINDER_BRAND_LABEL,
  };

  const smsAllowed =
    decision.threshold === "24h" ? prefs.sms24h : prefs.sms1h;
  const emailAllowed =
    decision.threshold === "24h" ? prefs.email24h : prefs.email1h;

  let delivered = false;

  if (
    smsAllowed &&
    row.candidate_phone &&
    isSmsBrandConfigured(AUDITION_REMINDER_BRAND)
  ) {
    const body = buildAuditionReminderSmsBody(ctx);
    const result = await sendSms({
      brand: AUDITION_REMINDER_BRAND,
      to: row.candidate_phone,
      body,
      fetchImpl: deps.fetchImpl,
    });

    await logDelivery(deps.pool, {
      scheduleId: row.id,
      candidateId: row.candidate_id,
      threshold: decision.threshold,
      method: "sms",
      success: result.success,
      messageRef: result.messageSid,
      errorMessage: result.error,
    });

    if (result.success) {
      summary.smsSent += 1;
      delivered = true;
      await recordSmsUsage({
        pool: deps.pool,
        projectId: row.project_id,
        scheduleId: row.id,
        candidateId: row.candidate_id,
        threshold: decision.threshold,
        brand: AUDITION_REMINDER_BRAND,
        twilioMessageSid: result.messageSid ?? null,
      });
    } else {
      summary.failures += 1;
      summary.notes.push(
        `sms_failed schedule=${row.id} reason=${result.error ?? "unknown"}`,
      );
    }
  }

  if (
    !delivered &&
    emailAllowed &&
    row.candidate_email &&
    isEmailConfigured()
  ) {
    const built = buildAuditionReminderEmail(ctx);
    const result = await sendEmail({
      to: row.candidate_email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      fromName: AUDITION_REMINDER_BRAND_LABEL,
    });

    await logDelivery(deps.pool, {
      scheduleId: row.id,
      candidateId: row.candidate_id,
      threshold: decision.threshold,
      method: "email",
      success: result.success,
      messageRef: result.messageId,
      errorMessage: result.error,
    });

    if (result.success) {
      summary.emailSent += 1;
      delivered = true;
    } else {
      summary.failures += 1;
      summary.notes.push(
        `email_failed schedule=${row.id} reason=${result.error ?? "unknown"}`,
      );
    }
  }

  if (delivered) {
    await markReminderSent(deps.pool, row.id, decision.threshold);
  } else if (
    !smsAllowed && !emailAllowed
  ) {
    summary.skipped += 1;
  } else if (
    (!row.candidate_phone || !smsAllowed) &&
    (!row.candidate_email || !emailAllowed)
  ) {
    summary.skipped += 1;
  }
}

async function markReminderSent(
  pool: Pool,
  scheduleId: string,
  threshold: ReminderThreshold,
): Promise<void> {
  await pool.query(
    `UPDATE casting_schedules
       SET reminders_sent = COALESCE(reminders_sent, '{}'::jsonb)
                          || jsonb_build_object($2::text, to_jsonb(NOW()::text)),
           updated_at = NOW()
     WHERE id = $1`,
    [scheduleId, threshold],
  );
}

async function logDelivery(
  pool: Pool,
  input: {
    scheduleId: string;
    candidateId: string;
    threshold: ReminderThreshold;
    method: "sms" | "email";
    success: boolean;
    messageRef?: string;
    errorMessage?: string;
  },
): Promise<void> {
  const notificationId = `${AUDITION_REMINDER_RUNNER_KEY}:${input.scheduleId}:${input.threshold}`;
  const status = input.success ? "delivered" : "failed";
  const metadata = {
    runner: AUDITION_REMINDER_RUNNER_KEY,
    candidateId: input.candidateId,
    scheduleId: input.scheduleId,
    threshold: input.threshold,
    messageRef: input.messageRef ?? null,
    brand: AUDITION_REMINDER_BRAND,
  };

  try {
    await pool.query(
      `INSERT INTO notification_delivery_log
         (notification_id, delivery_method, status, attempted_at, delivered_at,
          error_message, metadata)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6::jsonb)`,
      [
        notificationId,
        input.method,
        status,
        input.success ? new Date().toISOString() : null,
        input.errorMessage ?? null,
        JSON.stringify(metadata),
      ],
    );
  } catch (error) {
    console.warn(
      `[audition-reminder] failed to write delivery log for ${input.scheduleId}:`,
      error,
    );
  }
}

export function maybeStartAuditionReminderSweep(deps: { pool: Pool }): void {
  if (auditionReminderSchedulerStarted) return;
  if (!isRunnerEnabled()) return;

  auditionReminderSchedulerStarted = true;

  setTimeout(() => {
    void runAuditionReminderSweep("startup", deps).catch((error) => {
      console.error("[audition-reminder] startup sweep failed", error);
    });
  }, 30_000).unref();

  setInterval(() => {
    void runAuditionReminderSweep("interval", deps).catch((error) => {
      console.error("[audition-reminder] interval sweep failed", error);
    });
  }, readIntervalMs()).unref();
}
