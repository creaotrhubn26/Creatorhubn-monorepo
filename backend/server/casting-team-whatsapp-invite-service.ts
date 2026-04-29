// Team-invite-distribusjon for produksjonsteam-WhatsApp-grupper.
//
// Når en crew-medlem legges til i et casting-prosjekt, sender vi
// automatisk en WhatsApp-melding til personen via bedriftens egen Cloud
// API-config. Meldingen inneholder gruppe-invitasjons-lenken (som team-
// leder har lagt inn i prosjektets WhatsApp-config).
//
// Idempotens: én rad per (project_id, crew_id) i casting_team_whatsapp_invites.
// Cron retry-er pending/failed-rader (max 3 forsøk).

import type { Pool } from "pg";
import {
  getWhatsAppOrgConfig,
  type WhatsAppOrgConfig,
} from "./role-room-whatsapp-config-service.js";
import {
  readEnvFallbackConfig,
  sendWhatsAppTeamInvite,
} from "./casting-whatsapp-sender.js";

const TEAM_INVITE_TEMPLATE_NAME =
  process.env.META_WHATSAPP_TEMPLATE_TEAM_INVITE_NAME ||
  "production_team_invite_no";

export interface ProjectGroupConfig {
  projectId: string;
  groupInviteLink: string;
  groupName: string | null;
  adminUserId: string | null;
  adminEmail: string | null;
  orgKey: string | null;
  autoInviteEnabled: boolean;
}

export async function getProjectGroupConfig(
  pool: Pool,
  projectId: string,
): Promise<ProjectGroupConfig | null> {
  const result = await pool.query<{
    project_id: string;
    group_invite_link: string;
    group_name: string | null;
    admin_user_id: string | null;
    admin_email: string | null;
    org_key: string | null;
    auto_invite_enabled: boolean;
  }>(
    `SELECT * FROM casting_project_whatsapp_group WHERE project_id = $1 LIMIT 1`,
    [projectId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    projectId: row.project_id,
    groupInviteLink: row.group_invite_link,
    groupName: row.group_name,
    adminUserId: row.admin_user_id,
    adminEmail: row.admin_email,
    orgKey: row.org_key,
    autoInviteEnabled: row.auto_invite_enabled,
  };
}

export async function upsertProjectGroupConfig(
  pool: Pool,
  input: {
    projectId: string;
    groupInviteLink: string;
    groupName?: string | null;
    adminUserId?: string | null;
    adminEmail?: string | null;
    orgKey?: string | null;
    autoInviteEnabled?: boolean;
  },
): Promise<ProjectGroupConfig> {
  const linkOk = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(
    input.groupInviteLink.trim(),
  );
  if (!linkOk) {
    throw new Error("invalid_invite_link");
  }
  await pool.query(
    `INSERT INTO casting_project_whatsapp_group (
       project_id, group_invite_link, group_name, admin_user_id, admin_email,
       org_key, auto_invite_enabled, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (project_id) DO UPDATE SET
       group_invite_link   = EXCLUDED.group_invite_link,
       group_name          = EXCLUDED.group_name,
       admin_user_id       = EXCLUDED.admin_user_id,
       admin_email         = EXCLUDED.admin_email,
       org_key             = EXCLUDED.org_key,
       auto_invite_enabled = EXCLUDED.auto_invite_enabled,
       updated_at          = NOW()`,
    [
      input.projectId,
      input.groupInviteLink.trim(),
      input.groupName ?? null,
      input.adminUserId ?? null,
      input.adminEmail ?? null,
      input.orgKey ?? null,
      input.autoInviteEnabled ?? true,
    ],
  );
  const fresh = await getProjectGroupConfig(pool, input.projectId);
  if (!fresh) throw new Error("upsert_failed");
  return fresh;
}

export interface DispatchTeamInviteInput {
  pool: Pool;
  projectId: string;
  crewId: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  fetchImpl?: typeof fetch;
}

export interface DispatchTeamInviteResult {
  status: "delivered" | "skipped" | "failed";
  reason?: string;
  whatsappMessageId?: string;
}

export async function dispatchTeamWhatsAppInvite(
  input: DispatchTeamInviteInput,
): Promise<DispatchTeamInviteResult> {
  const groupConfig = await getProjectGroupConfig(input.pool, input.projectId);
  if (!groupConfig) {
    return { status: "skipped", reason: "no_group_config" };
  }
  if (!groupConfig.autoInviteEnabled) {
    return { status: "skipped", reason: "auto_invite_disabled" };
  }
  if (!input.recipientPhone) {
    return { status: "skipped", reason: "no_phone" };
  }

  const projectResult = await input.pool.query<{ name: string }>(
    `SELECT name FROM casting_projects WHERE id = $1 LIMIT 1`,
    [input.projectId],
  );
  const projectName = projectResult.rows[0]?.name ?? input.projectId;

  let senderConfig: WhatsAppOrgConfig | { fallback: true } | null = null;
  if (groupConfig.orgKey) {
    senderConfig = await getWhatsAppOrgConfig(input.pool, groupConfig.orgKey);
  }
  let runtimeConfig: {
    accessToken: string;
    phoneNumberId: string;
    displayName: string;
    templateLanguage: string;
  } | null = null;

  if (senderConfig && "accessToken" in senderConfig) {
    runtimeConfig = {
      accessToken: senderConfig.accessToken,
      phoneNumberId: senderConfig.phoneNumberId,
      displayName: senderConfig.displayName,
      templateLanguage: senderConfig.templateLanguage,
    };
  } else {
    const fallback = readEnvFallbackConfig();
    if (fallback) {
      runtimeConfig = {
        accessToken: fallback.accessToken,
        phoneNumberId: fallback.phoneNumberId,
        displayName: fallback.displayName,
        templateLanguage: fallback.templateLanguage,
      };
    }
  }

  if (!runtimeConfig) {
    await recordInviteAttempt(input.pool, {
      projectId: input.projectId,
      crewId: input.crewId,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      status: "failed",
      error: "no_whatsapp_config",
    });
    return { status: "failed", reason: "no_whatsapp_config" };
  }

  const result = await sendWhatsAppTeamInvite({
    config: {
      accessToken: runtimeConfig.accessToken,
      phoneNumberId: runtimeConfig.phoneNumberId,
      displayName: runtimeConfig.displayName,
      templateLanguage: runtimeConfig.templateLanguage,
      template24hName: "audition_reminder_24h_no",
      template1hName: "audition_reminder_1h_no",
    },
    to: input.recipientPhone,
    recipientName: input.recipientName,
    projectName,
    inviteLink: groupConfig.groupInviteLink,
    templateName: TEAM_INVITE_TEMPLATE_NAME,
    fetchImpl: input.fetchImpl,
  });

  await recordInviteAttempt(input.pool, {
    projectId: input.projectId,
    crewId: input.crewId,
    recipientPhone: input.recipientPhone,
    recipientEmail: input.recipientEmail,
    status: result.success ? "delivered" : "failed",
    whatsappMessageId: result.messageId ?? null,
    error: result.success ? null : result.error ?? "unknown",
  });

  return result.success
    ? { status: "delivered", whatsappMessageId: result.messageId }
    : { status: "failed", reason: result.error ?? "unknown" };
}

export interface TeamInviteSweepSummary {
  reason: "startup" | "interval" | "manual";
  startedAt: string;
  finishedAt: string;
  isRunning: boolean;
  scanned: number;
  delivered: number;
  skipped: number;
  failed: number;
  notes: string[];
}

let sweepPromise: Promise<TeamInviteSweepSummary> | null = null;
let lastSweepSummary: TeamInviteSweepSummary | null = null;
let schedulerStarted = false;

const TEAM_INVITE_INTERVAL_MS = (() => {
  const minutes = Number(process.env.CASTING_TEAM_INVITE_INTERVAL_MINUTES || 10);
  if (!Number.isFinite(minutes) || minutes <= 0) return 10 * 60 * 1000;
  return Math.max(1, Math.floor(minutes)) * 60 * 1000;
})();

export function readTeamInviteSweepStatus(): TeamInviteSweepSummary | null {
  return lastSweepSummary;
}

export async function runTeamInviteSweep(
  reason: TeamInviteSweepSummary["reason"],
  deps: { pool: Pool; fetchImpl?: typeof fetch },
): Promise<TeamInviteSweepSummary> {
  if (sweepPromise) {
    return (
      lastSweepSummary || {
        reason,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        isRunning: true,
        scanned: 0,
        delivered: 0,
        skipped: 0,
        failed: 0,
        notes: ["En team-invite-sweep pågår allerede."],
      }
    );
  }

  const ts = new Date().toISOString();
  const summary: TeamInviteSweepSummary = {
    reason,
    startedAt: ts,
    finishedAt: ts,
    isRunning: true,
    scanned: 0,
    delivered: 0,
    skipped: 0,
    failed: 0,
    notes: [],
  };
  lastSweepSummary = summary;

  const task = (async () => {
    try {
      const result = await deps.pool.query<{
        crew_id: string;
        project_id: string;
        crew_name: string | null;
        crew_phone: string | null;
        crew_email: string | null;
      }>(
        `SELECT
           cc.id          AS crew_id,
           cc.project_id  AS project_id,
           cc.name        AS crew_name,
           cc.phone       AS crew_phone,
           cc.email       AS crew_email
         FROM casting_crew cc
         INNER JOIN casting_project_whatsapp_group g ON g.project_id = cc.project_id
         LEFT JOIN casting_team_whatsapp_invites i
           ON i.project_id = cc.project_id AND i.crew_id = cc.id
         WHERE g.auto_invite_enabled = TRUE
           AND cc.phone IS NOT NULL
           AND cc.phone <> ''
           AND (
             i.id IS NULL
             OR (i.delivery_status = 'failed' AND i.retry_count < 3)
           )
         LIMIT 100`,
      );
      summary.scanned = result.rows.length;

      for (const row of result.rows) {
        try {
          const dispatchResult = await dispatchTeamWhatsAppInvite({
            pool: deps.pool,
            projectId: row.project_id,
            crewId: row.crew_id,
            recipientName: row.crew_name?.trim() || "Crew-medlem",
            recipientPhone: row.crew_phone,
            recipientEmail: row.crew_email,
            fetchImpl: deps.fetchImpl,
          });
          if (dispatchResult.status === "delivered") summary.delivered += 1;
          else if (dispatchResult.status === "skipped") summary.skipped += 1;
          else {
            summary.failed += 1;
            summary.notes.push(
              `crew=${row.crew_id} reason=${dispatchResult.reason ?? "unknown"}`,
            );
          }
        } catch (error) {
          summary.failed += 1;
          summary.notes.push(
            `crew=${row.crew_id} ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error) {
      summary.failed += 1;
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

  sweepPromise = task;
  try {
    return await task;
  } finally {
    sweepPromise = null;
  }
}

export function maybeStartTeamInviteSweep(deps: { pool: Pool }): void {
  if (schedulerStarted) return;
  const enabled = (process.env.CASTING_TEAM_INVITE_RUNNER_ENABLED || "true")
    .trim()
    .toLowerCase();
  if (enabled === "false" || enabled === "0" || enabled === "off") return;
  schedulerStarted = true;

  setTimeout(() => {
    void runTeamInviteSweep("startup", deps).catch((err) => {
      console.error("[team-invite] startup sweep failed", err);
    });
  }, 45_000).unref();

  setInterval(() => {
    void runTeamInviteSweep("interval", deps).catch((err) => {
      console.error("[team-invite] interval sweep failed", err);
    });
  }, TEAM_INVITE_INTERVAL_MS).unref();
}

async function recordInviteAttempt(
  pool: Pool,
  input: {
    projectId: string;
    crewId: string;
    recipientPhone: string | null;
    recipientEmail: string | null;
    status: "delivered" | "failed" | "pending";
    whatsappMessageId?: string | null;
    error?: string | null;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO casting_team_whatsapp_invites (
         project_id, crew_id, recipient_phone_e164, recipient_email,
         whatsapp_message_id, delivery_status, delivery_error, retry_count
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       ON CONFLICT (project_id, crew_id) DO UPDATE SET
         delivery_status     = EXCLUDED.delivery_status,
         delivery_error      = EXCLUDED.delivery_error,
         whatsapp_message_id = COALESCE(EXCLUDED.whatsapp_message_id, casting_team_whatsapp_invites.whatsapp_message_id),
         retry_count         = casting_team_whatsapp_invites.retry_count
                                + CASE WHEN EXCLUDED.delivery_status = 'failed' THEN 1 ELSE 0 END,
         invited_at          = CASE WHEN EXCLUDED.delivery_status = 'delivered' THEN NOW() ELSE casting_team_whatsapp_invites.invited_at END`,
      [
        input.projectId,
        input.crewId,
        input.recipientPhone,
        input.recipientEmail,
        input.whatsappMessageId ?? null,
        input.status,
        input.error ?? null,
      ],
    );
  } catch (error) {
    console.warn("[team-whatsapp-invite] failed to record attempt:", {
      projectId: input.projectId,
      crewId: input.crewId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
