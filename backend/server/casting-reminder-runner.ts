// Audition-reminder cron sweep.
//
// Speiler runRoleRoomCommercialReminderSweep i form: in-process setInterval,
// men idempotens eies av en distribuert DB-claim per schedule + terskel +
// kanal. `casting_schedules.reminders_sent` beholdes som kompatibilitetsmarkør.
// SMS via Twilio (brand=role-room), e-post som fallback når kandidat mangler
// telefon eller har slått av SMS.

import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  buildAuditionReminderEmail,
  buildAuditionReminderSmsBody,
  isEmailConfigured,
  isSmsBrandConfigured,
  normalizePhoneE164,
  parseReminderPrefs,
  sendEmail,
  sendSms,
  type ReminderBrand,
  type ReminderContext,
  type ReminderPrefs,
  type ReminderThreshold,
} from "./casting-reminder-sender.js";
import { recordSmsUsage } from "./casting-sms-billing.js";
import {
  readEnvFallbackConfig as readWhatsAppEnvFallback,
  sendWhatsAppAuditionReminder,
  type WhatsAppSenderConfig,
} from "./casting-whatsapp-sender.js";
import { getWhatsAppOrgConfig } from "./role-room-whatsapp-config-service.js";
import { recordWhatsAppUsage } from "./casting-whatsapp-billing.js";

const AUDITION_REMINDER_BRAND: ReminderBrand = "role-room";
const AUDITION_REMINDER_BRAND_LABEL = "The Role Room";
const AUDITION_REMINDER_RUNNER_KEY = "audition-reminder";
const THRESHOLD_WINDOW_MINUTES = 15;
const DELIVERY_CLAIM_LEASE_SECONDS = 10 * 60;
const DELIVERY_SMTP_TIMEOUT_MS = 2 * 60_000;

type ReminderChannel = "whatsapp" | "sms" | "email";
type DeliveryFailureCertainty = "definite_pre_delivery" | "uncertain";

interface ChannelSendResult {
  success: boolean;
  messageRef?: string;
  templateName?: string;
  conversationId?: string | null;
  error?: string;
  failureCertainty?: DeliveryFailureCertainty;
}

interface ClaimedDelivery {
  claimId: string;
  messageId: string | null;
}

type ChannelDeliveryOutcome =
  | { status: "not_claimed" }
  | { status: "delivered"; result: ChannelSendResult }
  | {
      status: "failed";
      result: ChannelSendResult;
      certainty: DeliveryFailureCertainty;
    };

export interface AuditionReminderSweepSummary {
  reason: "startup" | "interval" | "manual";
  startedAt: string;
  finishedAt: string;
  isRunning: boolean;
  scanned: number;
  whatsappSent: number;
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

function buildSummary(
  reason: AuditionReminderSweepSummary["reason"],
): AuditionReminderSweepSummary {
  const ts = new Date().toISOString();
  return {
    reason,
    startedAt: ts,
    finishedAt: ts,
    isRunning: true,
    scanned: 0,
    whatsappSent: 0,
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

function stableAuditionReminderMessageId(
  scheduleId: string,
  threshold: ReminderThreshold,
): string {
  const digest = createHash("sha256")
    .update(`${scheduleId}\u0000${threshold}\u0000email`, "utf8")
    .digest("hex");
  return `<audition-reminder-${digest}@creatorhubn.com>`;
}

async function claimChannelDelivery(input: {
  pool: Pool;
  scheduleId: string;
  threshold: ReminderThreshold;
  channel: ReminderChannel;
}): Promise<ClaimedDelivery | null> {
  const claimId = globalThis.crypto.randomUUID();
  const stableMessageId =
    input.channel === "email"
      ? stableAuditionReminderMessageId(input.scheduleId, input.threshold)
      : null;
  const claimed = await input.pool.query<{
    claim_id: string;
    message_id: string | null;
  }>(
    `WITH schedule_state AS (
       SELECT
         CASE
           WHEN jsonb_typeof(COALESCE(schedule.reminders_sent, '{}'::jsonb)) = 'object'
             THEN NULLIF(schedule.reminders_sent ->> $2, '') IS NOT NULL
           ELSE FALSE
         END AS has_legacy_marker,
         EXISTS (
           SELECT 1
             FROM casting_reminder_delivery_claims AS existing
            WHERE existing.schedule_id = $1
              AND existing.threshold = $2
         ) AS has_delivery_state
         FROM casting_schedules AS schedule
        WHERE schedule.id = $1
     )
     INSERT INTO casting_reminder_delivery_claims AS delivery
       (schedule_id, threshold, channel, claim_id, claim_expires_at,
        message_id, attempt_count, created_at, updated_at)
     SELECT
       $1, $2, $3, $4::uuid,
       now() + ($6::int * interval '1 second'), $5, 1, now(), now()
       FROM schedule_state
      WHERE NOT has_legacy_marker OR has_delivery_state
     ON CONFLICT (schedule_id, threshold, channel) DO UPDATE
       SET claim_id = EXCLUDED.claim_id,
           claim_expires_at = EXCLUDED.claim_expires_at,
           message_id = COALESCE(delivery.message_id, EXCLUDED.message_id),
           delivery_uncertain_at = NULL,
           last_error = NULL,
           attempt_count = delivery.attempt_count + 1,
           updated_at = now()
     WHERE delivery.delivered_at IS NULL
       AND delivery.delivery_started_at IS NULL
       AND (
         delivery.claim_id IS NULL
         OR delivery.claim_expires_at IS NULL
         OR delivery.claim_expires_at <= now()
       )
     RETURNING claim_id, message_id`,
    [
      input.scheduleId,
      input.threshold,
      input.channel,
      claimId,
      stableMessageId,
      DELIVERY_CLAIM_LEASE_SECONDS,
    ],
  );
  const row = claimed.rows[0];
  if (!row) return null;
  return { claimId: row.claim_id, messageId: row.message_id };
}

async function startChannelDelivery(input: {
  pool: Pool;
  scheduleId: string;
  threshold: ReminderThreshold;
  channel: ReminderChannel;
  claimId: string;
}): Promise<boolean> {
  // At-most-once-grensen committes før provider-kallet. Når denne verdien er
  // satt, gjør verken en utløpt lease eller en ny prosess raden claimbar igjen.
  const started = await input.pool.query(
    `UPDATE casting_reminder_delivery_claims
        SET delivery_started_at = now(),
            delivery_uncertain_at = NULL,
            last_error = NULL,
            updated_at = now()
      WHERE schedule_id = $1
        AND threshold = $2
        AND channel = $3
        AND claim_id = $4::uuid
        AND claim_expires_at > now()
        AND delivery_started_at IS NULL
        AND delivered_at IS NULL`,
    [input.scheduleId, input.threshold, input.channel, input.claimId],
  );
  return (started.rowCount ?? 0) === 1;
}

async function completeChannelDelivery(input: {
  pool: Pool;
  scheduleId: string;
  threshold: ReminderThreshold;
  channel: ReminderChannel;
  claimId: string;
  providerMessageId?: string;
}): Promise<boolean> {
  const completed = await input.pool.query(
    `UPDATE casting_reminder_delivery_claims
        SET delivered_at = now(),
            provider_message_id = COALESCE($5, provider_message_id),
            claim_id = NULL,
            claim_expires_at = NULL,
            delivery_uncertain_at = NULL,
            last_error = NULL,
            updated_at = now()
      WHERE schedule_id = $1
        AND threshold = $2
        AND channel = $3
        AND claim_id = $4::uuid
        AND delivery_started_at IS NOT NULL
        AND delivered_at IS NULL`,
    [
      input.scheduleId,
      input.threshold,
      input.channel,
      input.claimId,
      input.providerMessageId ?? null,
    ],
  );
  return (completed.rowCount ?? 0) === 1;
}

async function quarantineChannelDelivery(input: {
  pool: Pool;
  scheduleId: string;
  threshold: ReminderThreshold;
  channel: ReminderChannel;
  claimId: string;
  error: string;
}): Promise<void> {
  await input.pool.query(
    `UPDATE casting_reminder_delivery_claims
        SET delivery_uncertain_at = COALESCE(delivery_uncertain_at, now()),
            claim_id = NULL,
            claim_expires_at = NULL,
            last_error = $5,
            updated_at = now()
      WHERE schedule_id = $1
        AND threshold = $2
        AND channel = $3
        AND claim_id = $4::uuid
        AND delivery_started_at IS NOT NULL
        AND delivered_at IS NULL`,
    [
      input.scheduleId,
      input.threshold,
      input.channel,
      input.claimId,
      input.error.slice(0, 500),
    ],
  );
}

async function releaseDefinitePreDeliveryFailure(input: {
  pool: Pool;
  scheduleId: string;
  threshold: ReminderThreshold;
  channel: ReminderChannel;
  claimId: string;
  error: string;
}): Promise<void> {
  await input.pool.query(
    `UPDATE casting_reminder_delivery_claims
        SET claim_id = NULL,
            claim_expires_at = NULL,
            delivery_started_at = NULL,
            delivery_uncertain_at = NULL,
            last_error = $5,
            updated_at = now()
      WHERE schedule_id = $1
        AND threshold = $2
        AND channel = $3
        AND claim_id = $4::uuid
        AND delivery_started_at IS NOT NULL
        AND delivery_uncertain_at IS NULL
        AND delivered_at IS NULL`,
    [
      input.scheduleId,
      input.threshold,
      input.channel,
      input.claimId,
      input.error.slice(0, 500),
    ],
  );
}

async function attemptClaimedChannelDelivery(input: {
  pool: Pool;
  scheduleId: string;
  candidateId: string;
  threshold: ReminderThreshold;
  channel: ReminderChannel;
  send: (messageId: string | null) => Promise<ChannelSendResult>;
}): Promise<ChannelDeliveryOutcome> {
  const claim = await claimChannelDelivery(input);
  if (!claim) return { status: "not_claimed" };

  const started = await startChannelDelivery({
    ...input,
    claimId: claim.claimId,
  });
  if (!started) return { status: "not_claimed" };

  let result: ChannelSendResult;
  try {
    result = await input.send(claim.messageId);
  } catch (error) {
    // Etter at send-funksjonen er kalt kan vi ikke bevise at provider ikke
    // mottok payloaden. Derfor karantene, aldri automatisk retry.
    result = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      failureCertainty: "uncertain",
    };
  }

  await logDelivery(input.pool, {
    scheduleId: input.scheduleId,
    candidateId: input.candidateId,
    threshold: input.threshold,
    method: input.channel,
    success: result.success,
    messageRef: result.messageRef,
    errorMessage: result.error,
  });

  if (result.success) {
    try {
      const completed = await completeChannelDelivery({
        ...input,
        claimId: claim.claimId,
        providerMessageId: result.messageRef,
      });
      if (!completed) {
        throw new Error("delivery_receipt_not_persisted");
      }
    } catch (error) {
      // delivery_started_at er allerede committet. Selv om quarantine-write
      // også feiler, kan ingen ny worker auto-claime den mulige leveransen.
      await quarantineChannelDelivery({
        ...input,
        claimId: claim.claimId,
        error: `delivery_receipt_persist_failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }).catch(() => undefined);
      throw error;
    }
    return { status: "delivered", result };
  }

  const certainty: DeliveryFailureCertainty =
    result.failureCertainty === "definite_pre_delivery"
      ? "definite_pre_delivery"
      : "uncertain";
  if (certainty === "definite_pre_delivery") {
    await releaseDefinitePreDeliveryFailure({
      ...input,
      claimId: claim.claimId,
      error: result.error ?? "definite_pre_delivery_failure",
    });
  } else {
    await quarantineChannelDelivery({
      ...input,
      claimId: claim.claimId,
      error: `provider_outcome_uncertain: ${result.error ?? "unknown"}`,
    });
  }

  return { status: "failed", result, certainty };
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
    // Migrasjon 0463 backfiller gamle markører. Etter det er den atomiske
    // per-kanal-tabellen autoritativ, slik at én levert kanal ikke hindrer en
    // sikker pre-delivery retry på en annen kanal.
    remindersSent: {},
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

  const whatsappAllowed =
    decision.threshold === "24h" ? prefs.whatsapp24h : prefs.whatsapp1h;
  const smsAllowed = decision.threshold === "24h" ? prefs.sms24h : prefs.sms1h;
  const emailAllowed =
    decision.threshold === "24h" ? prefs.email24h : prefs.email1h;

  let anyDelivered = false;

  // ── Kanal 1: WhatsApp (per-org config, fallback til env) ──────────────
  if (whatsappAllowed && row.candidate_phone) {
    const config = await resolveWhatsAppConfigForProject(
      deps.pool,
      row.project_id,
    );
    if (config) {
      if (!normalizePhoneE164(row.candidate_phone)) {
        await logDelivery(deps.pool, {
          scheduleId: row.id,
          candidateId: row.candidate_id,
          threshold: decision.threshold,
          method: "whatsapp",
          success: false,
          errorMessage: "invalid_phone",
        });
        summary.failures += 1;
        summary.notes.push(
          `whatsapp_failed schedule=${row.id} reason=invalid_phone`,
        );
      } else {
        const outcome = await attemptClaimedChannelDelivery({
          pool: deps.pool,
          scheduleId: row.id,
          candidateId: row.candidate_id,
          threshold: decision.threshold,
          channel: "whatsapp",
          send: async () => {
            const result = await sendWhatsAppAuditionReminder({
              config,
              to: row.candidate_phone!,
              context: {
                candidateName: ctx.candidateName,
                projectName: ctx.projectName,
                date: ctx.date,
                startTime: ctx.startTime,
                location: ctx.location,
                threshold: decision.threshold,
              },
              fetchImpl: deps.fetchImpl,
            });
            return {
              success: result.success,
              messageRef: result.messageId,
              templateName: result.templateName,
              conversationId: result.conversationId,
              error: result.error,
            };
          },
        });

        if (outcome.status === "delivered") {
          summary.whatsappSent += 1;
          anyDelivered = true;
          await recordWhatsAppUsage({
            pool: deps.pool,
            projectId: row.project_id,
            scheduleId: row.id,
            candidateId: row.candidate_id,
            threshold: decision.threshold,
            brand: AUDITION_REMINDER_BRAND,
            templateName: outcome.result.templateName ?? null,
            whatsappMessageId: outcome.result.messageRef ?? null,
            conversationId: outcome.result.conversationId ?? null,
          });
        } else if (outcome.status === "failed") {
          summary.failures += 1;
          summary.notes.push(
            `whatsapp_failed schedule=${row.id} reason=${
              outcome.result.error ?? "unknown"
            } certainty=${outcome.certainty}`,
          );
        }
      }
    }
  }

  // ── Kanal 2: SMS (Twilio) ─────────────────────────────────────────────
  if (
    smsAllowed &&
    row.candidate_phone &&
    isSmsBrandConfigured(AUDITION_REMINDER_BRAND)
  ) {
    if (!normalizePhoneE164(row.candidate_phone)) {
      await logDelivery(deps.pool, {
        scheduleId: row.id,
        candidateId: row.candidate_id,
        threshold: decision.threshold,
        method: "sms",
        success: false,
        errorMessage: "invalid_phone",
      });
      summary.failures += 1;
      summary.notes.push(`sms_failed schedule=${row.id} reason=invalid_phone`);
    } else {
      const body = buildAuditionReminderSmsBody(ctx);
      const outcome = await attemptClaimedChannelDelivery({
        pool: deps.pool,
        scheduleId: row.id,
        candidateId: row.candidate_id,
        threshold: decision.threshold,
        channel: "sms",
        send: async () => {
          const result = await sendSms({
            brand: AUDITION_REMINDER_BRAND,
            to: row.candidate_phone!,
            body,
            fetchImpl: deps.fetchImpl,
          });
          return {
            success: result.success,
            messageRef: result.messageSid,
            error: result.error,
          };
        },
      });

      if (outcome.status === "delivered") {
        summary.smsSent += 1;
        anyDelivered = true;
        await recordSmsUsage({
          pool: deps.pool,
          projectId: row.project_id,
          scheduleId: row.id,
          candidateId: row.candidate_id,
          threshold: decision.threshold,
          brand: AUDITION_REMINDER_BRAND,
          twilioMessageSid: outcome.result.messageRef ?? null,
        });
      } else if (outcome.status === "failed") {
        summary.failures += 1;
        summary.notes.push(
          `sms_failed schedule=${row.id} reason=${
            outcome.result.error ?? "unknown"
          } certainty=${outcome.certainty}`,
        );
      }
    }
  }

  // ── Kanal 3: E-post (Gmail) ────────────────────────────────────────────
  if (emailAllowed && row.candidate_email && isEmailConfigured()) {
    const built = buildAuditionReminderEmail(ctx);
    const outcome = await attemptClaimedChannelDelivery({
      pool: deps.pool,
      scheduleId: row.id,
      candidateId: row.candidate_id,
      threshold: decision.threshold,
      channel: "email",
      send: async (messageId) => {
        const result = await sendEmail({
          to: row.candidate_email!,
          subject: built.subject,
          html: built.html,
          text: built.text,
          fromName: AUDITION_REMINDER_BRAND_LABEL,
          smtpTimeoutMs: DELIVERY_SMTP_TIMEOUT_MS,
          ...(messageId ? { messageId } : {}),
        });
        return {
          success: result.success,
          messageRef: result.messageId,
          error: result.error,
          failureCertainty: result.failureCertainty,
        };
      },
    });

    if (outcome.status === "delivered") {
      summary.emailSent += 1;
      anyDelivered = true;
    } else if (outcome.status === "failed") {
      summary.failures += 1;
      summary.notes.push(
        `email_failed schedule=${row.id} reason=${
          outcome.result.error ?? "unknown"
        } certainty=${outcome.certainty}`,
      );
    }
  }

  if (anyDelivered) {
    await markReminderSent(deps.pool, row.id, decision.threshold);
  } else {
    summary.skipped += 1;
  }
}

async function resolveWhatsAppConfigForProject(
  pool: Pool,
  projectId: string,
): Promise<WhatsAppSenderConfig | null> {
  try {
    const ownerResult = await pool.query<{ email: string | null }>(
      `SELECT LOWER(COALESCE(u.email, '')) AS email
         FROM casting_projects cp
         LEFT JOIN users u ON u.id::text = cp.created_by
        WHERE cp.id = $1
        LIMIT 1`,
      [projectId],
    );
    const orgKey = ownerResult.rows[0]?.email?.trim() || "";
    if (orgKey) {
      const orgConfig = await getWhatsAppOrgConfig(pool, orgKey);
      if (orgConfig) {
        return {
          accessToken: orgConfig.accessToken,
          phoneNumberId: orgConfig.phoneNumberId,
          displayName: orgConfig.displayName,
          templateLanguage: orgConfig.templateLanguage,
          template24hName: orgConfig.template24hName,
          template1hName: orgConfig.template1hName,
        };
      }
    }
  } catch (error) {
    console.warn("[audition-reminder] whatsapp config resolve failed", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return readWhatsAppEnvFallback();
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
    method: "sms" | "email" | "whatsapp";
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
