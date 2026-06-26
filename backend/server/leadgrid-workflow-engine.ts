/**
 * leadgrid-workflow-engine.ts
 *
 * Smart Workflow Builder (#203) — eksekverings-engine.
 *
 * Event-bus-mønster:
 *   - publishEvent() — caller fra route-handlere når noe skjer
 *   - matchWorkflows() — finn aktive workflows som matcher event-typen
 *   - evaluateConditions() — sjekk lead mot conditions
 *   - executeWorkflow() — kjør actions sekvensielt + logg
 *
 * Robusthet:
 *   - All eksekvering wrappes i try/catch; én feilende action stopper
 *     ikke resten med mindre status='error' i forventet rekkefølge.
 *   - leadgrid_workflow_executions persisterer hele kjøringen for audit.
 *   - publishEvent() er fire-and-forget — caller bør void'e det.
 *   - Concurrency: hver workflow kjører i egen async-task; vi awaiter
 *     ikke chains. Race-conditions er OK fordi DB-state per action er
 *     idempotent (INSERT INTO history er append-only; UPDATE er last-wins).
 *   - Max actions per workflow = 30 (validator).
 */

import type { Pool } from "pg";
import { createHmac, randomUUID } from "node:crypto";
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowTrigger,
  ActionResult,
  InternalNotificationRecipient,
} from "./leadgrid-workflow-types.js";
import { UPDATE_LEAD_FIELDS_WHITELIST } from "./leadgrid-workflow-types.js";
import { applyStageChange } from "./leadgrid-deals-service.js";
import { isLeadgridStage } from "./leadgrid-deal-defaults.js";
import { emitWebhook } from "./webhook-emitter.js";

// ─── Webhook-rate-limit (60 POST/min per destination) ────────────────
// In-memory sliding-window per destination_id. OK å reset ved process-restart
// — rate-limit er beskyttelse mot runaway-loops, ikke en hard kvote.
const WEBHOOK_RATE_WINDOW_MS = 60_000;
const WEBHOOK_RATE_LIMIT = 60;
const webhookTimestamps = new Map<string, number[]>();

function checkWebhookRate(destinationId: string): boolean {
  const now = Date.now();
  const list = webhookTimestamps.get(destinationId) ?? [];
  // Drop expired
  const fresh = list.filter((t) => now - t < WEBHOOK_RATE_WINDOW_MS);
  if (fresh.length >= WEBHOOK_RATE_LIMIT) {
    webhookTimestamps.set(destinationId, fresh);
    return false;
  }
  fresh.push(now);
  webhookTimestamps.set(destinationId, fresh);
  return true;
}

/** Internt for tester — clearer rate-limit-state */
export function _resetWebhookRateLimit(): void {
  webhookTimestamps.clear();
}

export interface WorkflowEvent {
  pool: Pool;
  organizationId: string;
  type: WorkflowTrigger["type"];
  leadId: string | null;
  actorUserId: string | null;
  data: Record<string, unknown>;
}

interface WorkflowRow {
  id: string;
  organization_id: string;
  name: string;
  trigger_type: string;
  trigger_config: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  is_active: boolean;
}

interface LeadRow {
  id: string;
  business_name: string | null;
  lead_score: number | null;
  lead_temperature: string | null;
  pipeline_stage: string | null;
  industry_id: string | null;
  city: string | null;
  deal_amount: string | null;
  deal_probability: number | null;
  owner_user_id: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * matchWorkflows: finn alle aktive workflows i orgen som matcher event-type
 * og trigger-config.
 */
async function matchWorkflows(
  pool: Pool,
  organizationId: string,
  event: WorkflowEvent,
): Promise<WorkflowRow[]> {
  const r = await pool.query<WorkflowRow>(
    `SELECT id::text, organization_id::text, name, trigger_type,
            trigger_config, conditions, actions, is_active
       FROM leadgrid_workflows
      WHERE organization_id = $1::uuid
        AND is_active = TRUE
        AND trigger_type = $2`,
    [organizationId, event.type],
  );
  return r.rows.filter((w) => triggerMatches(w.trigger_config, event));
}

export function triggerMatches(
  trigger: WorkflowTrigger,
  event: WorkflowEvent,
): boolean {
  if (trigger.type !== event.type) return false;
  switch (trigger.type) {
    case "lead.status_changed": {
      if (trigger.from && event.data.from !== trigger.from) return false;
      if (trigger.to && event.data.to !== trigger.to) return false;
      return true;
    }
    case "lead.temperature_changed": {
      if (trigger.to && event.data.to !== trigger.to) return false;
      return true;
    }
    case "pipeline.stage_changed": {
      if (trigger.from && event.data.from !== trigger.from) return false;
      if (trigger.to && event.data.to !== trigger.to) return false;
      return true;
    }
    case "deal.probability_changed": {
      const newProb = Number(event.data.new_probability ?? NaN);
      if (
        typeof trigger.min === "number" &&
        (!Number.isFinite(newProb) || newProb < trigger.min)
      )
        return false;
      if (
        typeof trigger.max === "number" &&
        (!Number.isFinite(newProb) || newProb > trigger.max)
      )
        return false;
      return true;
    }
    case "deal.amount_changed": {
      const newAmount = Number(event.data.new_amount ?? NaN);
      if (
        typeof trigger.min === "number" &&
        (!Number.isFinite(newAmount) || newAmount < trigger.min)
      )
        return false;
      return true;
    }
    case "recommendation.published": {
      if (
        trigger.priority &&
        event.data.priority !== trigger.priority
      )
        return false;
      return true;
    }
    // ─── Nye triggers (mig 0350) ─────────────────────────────────
    case "email.opened": {
      if (trigger.email_id && event.data.email_id !== trigger.email_id)
        return false;
      return true;
    }
    case "email.link_clicked": {
      if (trigger.link_url_pattern) {
        const url = String(event.data.link_url ?? "");
        if (
          !url.toLowerCase().includes(trigger.link_url_pattern.toLowerCase())
        )
          return false;
      }
      return true;
    }
    case "meeting.booked": {
      if (
        trigger.meeting_type &&
        event.data.meeting_type !== trigger.meeting_type
      )
        return false;
      return true;
    }
    case "meeting.no_show": {
      return true;
    }
    case "proposal.opened": {
      if (
        trigger.proposal_id &&
        event.data.proposal_id !== trigger.proposal_id
      )
        return false;
      return true;
    }
    case "contract.signed": {
      if (trigger.provider && event.data.provider !== trigger.provider)
        return false;
      return true;
    }
    default:
      return true;
  }
}

async function fetchLead(pool: Pool, leadId: string): Promise<LeadRow | null> {
  const r = await pool.query<LeadRow>(
    `SELECT id::text, business_name, lead_score, lead_temperature,
            pipeline_stage, industry_id::text, city,
            deal_amount::text AS deal_amount, deal_probability,
            owner_user_id, email, phone
       FROM crm_customers
      WHERE id = $1::uuid
      LIMIT 1`,
    [leadId],
  );
  return r.rows[0] ?? null;
}

export function evaluateConditions(
  conditions: WorkflowCondition[],
  lead: LeadRow,
): { ok: boolean; failedAt?: number; reason?: string } {
  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i];
    let pass = false;
    switch (c.type) {
      case "lead.score": {
        if (lead.lead_score === null)
          return { ok: false, failedAt: i, reason: "lead_score_null" };
        pass = compareNum(lead.lead_score, c.op, c.value);
        break;
      }
      case "lead.industry_id": {
        pass = lead.industry_id === c.value;
        break;
      }
      case "lead.city": {
        pass = (lead.city ?? "").toLowerCase() === c.value.toLowerCase();
        break;
      }
      case "deal.amount": {
        const amount = lead.deal_amount === null ? null : Number(lead.deal_amount);
        if (amount === null)
          return { ok: false, failedAt: i, reason: "deal_amount_null" };
        pass = compareNum(amount, c.op, c.value);
        break;
      }
      case "lead.temperature": {
        pass = lead.lead_temperature === c.value;
        break;
      }
    }
    if (!pass) return { ok: false, failedAt: i, reason: "condition_failed" };
  }
  return { ok: true };
}

function compareNum(actual: number, op: string, expected: number): boolean {
  switch (op) {
    case ">":
      return actual > expected;
    case "<":
      return actual < expected;
    case "=":
      return actual === expected;
    case ">=":
      return actual >= expected;
    case "<=":
      return actual <= expected;
    case "!=":
      return actual !== expected;
    default:
      return false;
  }
}

/**
 * executeWorkflow: kjør én workflow mot én lead. Returnerer
 * execution-id + actionResults. Caller bør ikke await — vi vil ikke
 * blokkere request-løpet.
 *
 * @param dryRun  — hvis true, INSERT et leadgrid_workflow_executions med
 *                  status='dry_run' og hopper over alle side-effekter på
 *                  Outside-systemer (email/sms/whatsapp/notify). DB-WRITES
 *                  som change_pipeline_stage/add_tag/assign skippes også.
 */
export async function executeWorkflow(
  pool: Pool,
  workflow: WorkflowRow,
  event: WorkflowEvent,
  opts?: { dryRun?: boolean; lead?: LeadRow | null },
): Promise<{ executionId: string; status: string; actionResults: ActionResult[] }> {
  const startedAt = Date.now();
  const lead =
    opts?.lead ??
    (event.leadId ? await fetchLead(pool, event.leadId) : null);

  // Insert pending execution-rad
  const insRes = await pool.query<{ id: string }>(
    `INSERT INTO leadgrid_workflow_executions
       (workflow_id, organization_id, lead_id, trigger_event, context, status)
     VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5::jsonb, $6)
     RETURNING id::text`,
    [
      workflow.id,
      event.organizationId,
      event.leadId,
      JSON.stringify({
        type: event.type,
        data: event.data,
        actorUserId: event.actorUserId,
      }),
      JSON.stringify({
        actorUserId: event.actorUserId,
        leadKnown: Boolean(lead),
      }),
      opts?.dryRun ? "dry_run" : "running",
    ],
  );
  const executionId = insRes.rows[0]?.id ?? "";

  // Evaluate conditions
  if (lead && workflow.conditions.length > 0) {
    const condRes = evaluateConditions(workflow.conditions, lead);
    if (!condRes.ok) {
      await markExecutionFinished(
        pool,
        executionId,
        "skipped",
        [],
        Date.now() - startedAt,
        `conditions_failed:${condRes.reason}@${condRes.failedAt}`,
      );
      return { executionId, status: "skipped", actionResults: [] };
    }
  }

  // Execute actions sekvensielt
  const actionResults: ActionResult[] = [];
  let overallStatus: "completed" | "failed" = "completed";
  for (let i = 0; i < workflow.actions.length; i++) {
    const a = workflow.actions[i];
    const aStart = Date.now();
    try {
      const result = await runAction(
        pool,
        a,
        event,
        lead,
        Boolean(opts?.dryRun),
        workflow.id,
        executionId,
      );
      actionResults.push({
        ...result,
        index: i,
        type: a.type,
        durationMs: Date.now() - aStart,
      });
      if (result.status === "error") {
        overallStatus = "failed";
        // Vi STOPPER ikke ved error — neste actions kjøres så de er
        // resilient mot en enkelt failing channel.
      }
    } catch (err) {
      actionResults.push({
        index: i,
        type: a.type,
        status: "error",
        message: String((err as Error)?.message ?? err).slice(0, 300),
        durationMs: Date.now() - aStart,
      });
      overallStatus = "failed";
    }
  }

  await markExecutionFinished(
    pool,
    executionId,
    opts?.dryRun ? "dry_run" : overallStatus,
    actionResults,
    Date.now() - startedAt,
    overallStatus === "failed"
      ? actionResults.find((r) => r.status === "error")?.message
      : undefined,
  );

  // Update workflow.execution_count + last_executed_at hvis ikke dry-run
  if (!opts?.dryRun) {
    await pool
      .query(
        `UPDATE leadgrid_workflows
            SET execution_count = execution_count + 1,
                last_executed_at = NOW(),
                last_error_at = CASE WHEN $2 = 'failed' THEN NOW() ELSE last_error_at END,
                last_error_message = CASE WHEN $2 = 'failed' THEN $3 ELSE last_error_message END,
                updated_at = NOW()
          WHERE id = $1::uuid`,
        [
          workflow.id,
          overallStatus,
          overallStatus === "failed"
            ? actionResults.find((r) => r.status === "error")?.message ?? null
            : null,
        ],
      )
      .catch((err: unknown) => {
        console.warn("[workflow-engine] update workflow stats fail:", err);
      });

    // Emit workflow.executed webhook
    void emitWebhook(
      pool,
      "workflow.executed",
      {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        lead_id: event.leadId,
        status: overallStatus,
        actions_count: actionResults.length,
        duration_ms: Date.now() - startedAt,
      },
      event.organizationId,
    );
  }

  return { executionId, status: overallStatus, actionResults };
}

async function markExecutionFinished(
  pool: Pool,
  executionId: string,
  status: string,
  actionResults: ActionResult[],
  durationMs: number,
  errorMessage?: string,
): Promise<void> {
  if (!executionId) return;
  try {
    await pool.query(
      `UPDATE leadgrid_workflow_executions
          SET status = $1,
              actions_executed = $2::jsonb,
              finished_at = NOW(),
              duration_ms = $3,
              error_message = $4
        WHERE id = $5::uuid`,
      [
        status,
        JSON.stringify(actionResults),
        durationMs,
        errorMessage ?? null,
        executionId,
      ],
    );
  } catch (err) {
    console.warn("[workflow-engine] markExecutionFinished fail:", err);
  }
}

/**
 * runAction: utfør én action. Returnerer ActionResult.
 *
 * NB: dryRun skipper alle side-effekter (no email/sms/db-write).
 */
async function runAction(
  pool: Pool,
  action: WorkflowAction,
  event: WorkflowEvent,
  lead: LeadRow | null,
  dryRun: boolean,
  workflowId: string,
  executionId: string,
): Promise<Omit<ActionResult, "index" | "type" | "durationMs">> {
  if (dryRun) {
    return {
      status: "skipped",
      message: `dry_run:${action.type}`,
      data: { action },
    };
  }

  switch (action.type) {
    case "wait": {
      // Vi schedule ikke faktisk delay — vi logger "deferred". I produksjon
      // bør dette settes opp som queue-message med visibility-timeout.
      return {
        status: "deferred",
        message: `wait:${action.duration_minutes}min`,
        data: { wait_minutes: action.duration_minutes },
      };
    }

    case "change_pipeline_stage": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      if (!isLeadgridStage(action.stage)) {
        return { status: "error", message: `invalid_stage:${action.stage}` };
      }
      try {
        const result = await applyStageChange(
          pool,
          lead.id,
          event.actorUserId ?? "workflow_engine",
          action.stage,
          { source: "workflow", notes: "applied by workflow" },
        );
        return {
          status: "ok",
          message: `stage:${result.oldStage}→${result.newStage}`,
          data: {
            old_stage: result.oldStage,
            new_stage: result.newStage,
          },
        };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    case "set_lead_status": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      try {
        await pool.query(
          `UPDATE crm_customers SET lead_status = $1, updated_at = NOW() WHERE id = $2::uuid`,
          [action.status, lead.id],
        );
        return { status: "ok", message: `status:${action.status}` };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    case "assign_to_user": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      try {
        await pool.query(
          `UPDATE crm_customers SET owner_user_id = $1, updated_at = NOW() WHERE id = $2::uuid`,
          [action.user_id, lead.id],
        );
        return { status: "ok", message: `assigned:${action.user_id}` };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    case "add_tag": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      // lead_tags + lead_tag_assignments (mig 313)
      try {
        await pool.query(
          `INSERT INTO lead_tags (organization_id, name)
           VALUES ($1::uuid, $2) ON CONFLICT (organization_id, name) DO NOTHING`,
          [event.organizationId, action.tag],
        );
        await pool.query(
          `INSERT INTO lead_tag_assignments (lead_id, tag_id)
           SELECT $1::uuid, lt.id
             FROM lead_tags lt
            WHERE lt.organization_id = $2::uuid AND lt.name = $3
           ON CONFLICT (lead_id, tag_id) DO NOTHING`,
          [lead.id, event.organizationId, action.tag],
        );
        return { status: "ok", message: `tag:${action.tag}` };
      } catch (err) {
        // Tabellen kan ha annen schema — vi degraderer til "skipped" så
        // workflow-en ikke feiler hardt.
        return {
          status: "skipped",
          message: `tag_skip:${String((err as Error)?.message ?? "").slice(0, 100)}`,
        };
      }
    }

    case "create_task": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      // Lagre som crm_lead_activities-rad type="task"
      try {
        const due = action.due_in_days
          ? new Date(Date.now() + action.due_in_days * 86400000).toISOString()
          : null;
        await pool.query(
          `INSERT INTO crm_lead_activities
             (customer_id, user_id, activity_type, description, metadata, created_at)
           VALUES ($1::uuid, $2, 'task', $3, $4::jsonb, NOW())`,
          [
            lead.id,
            event.actorUserId ?? lead.owner_user_id ?? "workflow_engine",
            action.title,
            JSON.stringify({
              kind: "workflow_task",
              due_at: due,
              assignee_role: action.assignee_role ?? "owner",
            }),
          ],
        );
        return {
          status: "ok",
          message: `task_created`,
          data: { title: action.title, due_at: due },
        };
      } catch (err) {
        return {
          status: "skipped",
          message: `task_skip:${String((err as Error)?.message ?? "").slice(0, 100)}`,
        };
      }
    }

    case "send_email":
    case "send_sms":
    case "send_whatsapp":
    case "notify_channel":
    case "ai_pitch_generate": {
      // Disse er marked som "scheduled" — produksjons-implementasjon ville
      // pushe inn i en dedicated queue (mailer/sms/wa/claude-jobs).
      // For nå logger vi som "deferred" så execution-historikken er nyttig.
      return {
        status: "deferred",
        message: `${action.type}_queued`,
        data: { action },
      };
    }

    // ─── Nye actions (mig 0350) ────────────────────────────────────
    case "schedule_call": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      try {
        const plannedAt = resolveWhen(action.when);
        if (!plannedAt) {
          return { status: "error", message: `invalid_when:${action.when}` };
        }
        const assigneeUserId = resolveAssignee(action.assignee, lead);
        const r = await pool.query<{ id: string }>(
          `INSERT INTO leadgrid_phone_calls
             (organization_id, customer_id, planned_at, assigned_user_id,
              notes, status, source, created_by_user_id)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'planned', 'workflow', $6)
           RETURNING id::text`,
          [
            event.organizationId,
            lead.id,
            plannedAt.toISOString(),
            assigneeUserId,
            action.notes ?? null,
            event.actorUserId ?? "workflow_engine",
          ],
        );
        return {
          status: "ok",
          message: `call_scheduled:${plannedAt.toISOString()}`,
          data: { call_id: r.rows[0]?.id, planned_at: plannedAt.toISOString() },
        };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    case "book_meeting": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      try {
        const startsAt = resolveWhen(action.when);
        if (!startsAt) {
          return { status: "error", message: `invalid_when:${action.when}` };
        }
        const duration = Math.max(15, Math.min(480, action.duration_minutes ?? 30));
        const endsAt = new Date(startsAt.getTime() + duration * 60000);
        // Lett-vekt-meeting: vi prøver IKKE å opprette Google Meet-link her
        // (krever bruker-session for OAuth). Tom meet_link betyr at avsenderen
        // (UI) kan fylle inn manuelt etterpå.
        const id = randomUUID();
        await pool.query(
          `INSERT INTO leadgrid_meetings
             (id, organization_id, customer_id, meeting_type, title, starts_at,
              ends_at, duration_minutes, status, notes, created_by_user_id, source)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, 'scheduled',
                   $9, $10, 'workflow')`,
          [
            id,
            event.organizationId,
            lead.id,
            action.meeting_type ?? "discovery",
            action.title ??
              `${action.meeting_type ?? "Møte"} med ${lead.business_name ?? "lead"}`,
            startsAt.toISOString(),
            endsAt.toISOString(),
            duration,
            action.notes ?? null,
            event.actorUserId ?? "workflow_engine",
          ],
        );
        return {
          status: "ok",
          message: `meeting_booked:${startsAt.toISOString()}`,
          data: { meeting_id: id, starts_at: startsAt.toISOString() },
        };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    case "update_lead_fields": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      const safeFields: Record<string, unknown> = {};
      const rejected: string[] = [];
      for (const [k, v] of Object.entries(action.fields)) {
        if (UPDATE_LEAD_FIELDS_WHITELIST.has(k)) {
          safeFields[k] = v;
        } else {
          rejected.push(k);
        }
      }
      if (Object.keys(safeFields).length === 0) {
        return {
          status: "skipped",
          message: "no_whitelisted_fields",
          data: { rejected_fields: rejected },
        };
      }
      try {
        const cols = Object.keys(safeFields);
        const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
        const vals = cols.map((c) => safeFields[c]);
        await pool.query(
          `UPDATE crm_customers SET ${sets}, updated_at = NOW() WHERE id = $1::uuid`,
          [lead.id, ...vals],
        );
        return {
          status: "ok",
          message: `updated:${cols.length}_fields`,
          data: {
            updated_fields: cols,
            rejected_fields: rejected.length > 0 ? rejected : undefined,
          },
        };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    case "post_to_webhook":
    case "trigger_zapier": {
      try {
        const destRes = await pool.query<{
          url: string;
          hmac_secret: string | null;
          destination_type: string;
        }>(
          `SELECT url, hmac_secret, destination_type
             FROM leadgrid_workflow_webhook_destinations
            WHERE id = $1::uuid AND organization_id = $2::uuid AND is_active = TRUE
            LIMIT 1`,
          [action.destination_id, event.organizationId],
        );
        const dest = destRes.rows[0];
        if (!dest) {
          return { status: "error", message: "destination_not_found" };
        }
        if (!checkWebhookRate(action.destination_id)) {
          return {
            status: "skipped",
            message: "rate_limited",
            data: { destination_id: action.destination_id },
          };
        }
        const payload = buildWebhookPayload(action, event, lead, workflowId);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "Leadgrid-Workflow/0350",
        };
        if (dest.hmac_secret) {
          headers["X-Signature-Sha256"] = createHmac("sha256", dest.hmac_secret)
            .update(JSON.stringify(payload))
            .digest("hex");
        }
        // Timeout 10s
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        let httpStatus = 0;
        try {
          const response = await fetch(dest.url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          httpStatus = response.status;
        } finally {
          clearTimeout(timer);
        }
        // Update destination stats (best-effort)
        pool
          .query(
            `UPDATE leadgrid_workflow_webhook_destinations
                SET last_invoked_at = NOW(),
                    last_status_code = $2,
                    invocation_count = invocation_count + 1,
                    updated_at = NOW()
              WHERE id = $1::uuid`,
            [action.destination_id, httpStatus],
          )
          .catch(() => {
            /* swallow */
          });
        if (httpStatus >= 200 && httpStatus < 300) {
          return {
            status: "ok",
            message: `posted:${httpStatus}`,
            data: { http_status: httpStatus, type: dest.destination_type },
          };
        }
        return {
          status: "error",
          message: `http_${httpStatus}`,
          data: { http_status: httpStatus },
        };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    case "send_internal_notification": {
      try {
        const recipientUserId = await resolveRecipient(
          pool,
          action.recipient,
          lead,
          event.organizationId,
        );
        if (!recipientUserId) {
          return { status: "skipped", message: "no_recipient_resolved" };
        }
        const r = await pool.query<{ id: string }>(
          `INSERT INTO leadgrid_internal_notifications
             (organization_id, recipient_user_id, title, body, related_lead_id,
              workflow_id, execution_id)
           VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $7::uuid)
           RETURNING id::text`,
          [
            event.organizationId,
            recipientUserId,
            renderTemplate(action.title, event, lead),
            action.body ? renderTemplate(action.body, event, lead) : null,
            lead?.id ?? null,
            workflowId,
            executionId || null,
          ],
        );
        return {
          status: "ok",
          message: `notified:${recipientUserId}`,
          data: { notification_id: r.rows[0]?.id, recipient: recipientUserId },
        };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    case "remove_tag": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      try {
        const r = await pool.query(
          `DELETE FROM lead_tag_assignments
             WHERE lead_id = $1::uuid
               AND tag_id IN (
                 SELECT id FROM lead_tags
                   WHERE organization_id = $2::uuid AND name = $3
               )`,
          [lead.id, event.organizationId, action.tag],
        );
        return {
          status: "ok",
          message: `removed_tag:${action.tag}`,
          data: { rows_removed: r.rowCount ?? 0 },
        };
      } catch (err) {
        return {
          status: "skipped",
          message: `tag_remove_skip:${String((err as Error)?.message ?? "").slice(0, 100)}`,
        };
      }
    }

    case "archive_lead": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      try {
        const noteSuffix = action.reason
          ? `[Workflow archived: ${action.reason.slice(0, 100)}]`
          : "[Workflow archived]";
        await pool.query(
          `UPDATE crm_customers
              SET archived_at = NOW(),
                  notes = COALESCE(NULLIF(notes, '') || E'\n', '') || $1,
                  updated_at = NOW()
            WHERE id = $2::uuid AND archived_at IS NULL`,
          [noteSuffix, lead.id],
        );
        void emitWebhook(
          pool,
          "lead.archived",
          { lead_id: lead.id, reason: action.reason ?? null, source: "workflow" },
          event.organizationId,
        );
        return {
          status: "ok",
          message: `archived${action.reason ? `:${action.reason.slice(0, 40)}` : ""}`,
        };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    case "revive_lead": {
      if (!lead) return { status: "skipped", message: "no_lead" };
      try {
        await pool.query(
          `UPDATE crm_customers SET archived_at = NULL, updated_at = NOW() WHERE id = $1::uuid`,
          [lead.id],
        );
        void emitWebhook(
          pool,
          "lead.revived",
          { lead_id: lead.id, source: "workflow" },
          event.organizationId,
        );
        return { status: "ok", message: "revived" };
      } catch (err) {
        return {
          status: "error",
          message: String((err as Error)?.message ?? err).slice(0, 200),
        };
      }
    }

    default:
      return { status: "skipped", message: "unknown_action" };
  }
}

// ─── Helper-funksjoner for nye actions ────────────────────────────────

/**
 * resolveWhen — parse `when` til en Date.
 * Aksepterer ISO 8601 ("2026-07-01T09:00:00Z") eller relativ
 * ("in_5_minutes", "in_2_hours", "in_3_days"). Returnerer null hvis ugyldig.
 */
export function resolveWhen(when: string): Date | null {
  const rel = /^in_(\d+)_(minutes?|hours?|days?)$/i.exec(when);
  if (rel) {
    const n = parseInt(rel[1] ?? "0", 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    const unit = (rel[2] ?? "").toLowerCase();
    let ms = 0;
    if (unit.startsWith("minute")) ms = n * 60 * 1000;
    else if (unit.startsWith("hour")) ms = n * 60 * 60 * 1000;
    else if (unit.startsWith("day")) ms = n * 24 * 60 * 60 * 1000;
    if (ms === 0) return null;
    return new Date(Date.now() + ms);
  }
  const t = Date.parse(when);
  if (!Number.isFinite(t)) return null;
  return new Date(t);
}

function resolveAssignee(
  assignee: { user_id: string } | "owner" | "manager" | undefined,
  lead: LeadRow,
): string | null {
  if (!assignee) return lead.owner_user_id;
  if (typeof assignee === "object") return assignee.user_id;
  if (assignee === "owner") return lead.owner_user_id;
  // 'manager' resolves at-runtime via RBAC; vi forenkler ved å falle tilbake
  // til owner_user_id om vi ikke har bedre signal. (Manager-oppslag krever
  // org_members + role-hierarki — defer.)
  return lead.owner_user_id;
}

/**
 * resolveRecipient — finn user_id basert på recipient-spec.
 *
 * - "owner"     → lead.owner_user_id
 * - "assignee"  → samme som owner (vi har ikke separat assignee-konsept)
 * - "manager"   → første organization_members med role IN ('admin','salgssjef','teamleder')
 * - "admin"     → første organization_members med role = 'admin'
 * - { user_id } → eksplisitt
 */
export async function resolveRecipient(
  pool: Pool,
  recipient: InternalNotificationRecipient,
  lead: LeadRow | null,
  organizationId: string,
): Promise<string | null> {
  if (typeof recipient === "object" && "user_id" in recipient) {
    return recipient.user_id;
  }
  if (recipient === "owner" || recipient === "assignee") {
    return lead?.owner_user_id ?? null;
  }
  if (recipient === "manager" || recipient === "admin") {
    const roles =
      recipient === "admin"
        ? ["admin"]
        : ["admin", "salgssjef", "teamleder"];
    try {
      const r = await pool.query<{ user_id: string }>(
        `SELECT user_id
           FROM organization_members
          WHERE organization_id = $1::uuid
            AND role = ANY($2::text[])
          ORDER BY
            CASE role
              WHEN 'admin' THEN 1
              WHEN 'salgssjef' THEN 2
              WHEN 'teamleder' THEN 3
              ELSE 4
            END,
            joined_at ASC
          LIMIT 1`,
        [organizationId, roles],
      );
      return r.rows[0]?.user_id ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * renderTemplate — enkel mustache-like substitusjon for {{lead.x}}
 * og {{event.x}}. Brukes for in-app notif title/body + webhook-payload.
 *
 * Støttede placeholders:
 *   {{lead.name}}            → business_name
 *   {{lead.city}}            → city
 *   {{lead.score}}           → lead_score
 *   {{lead.temperature}}     → lead_temperature
 *   {{lead.deal_amount}}     → deal_amount
 *   {{lead.email}}           → email
 *   {{lead.phone}}           → phone
 *   {{event.<key>}}          → event.data[<key>]
 */
export function renderTemplate(
  template: string,
  event: WorkflowEvent,
  lead: LeadRow | null,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const parts = path.split(".");
    if (parts[0] === "lead" && lead) {
      const k = parts[1] ?? "";
      const map: Record<string, unknown> = {
        name: lead.business_name,
        business_name: lead.business_name,
        city: lead.city,
        score: lead.lead_score,
        temperature: lead.lead_temperature,
        deal_amount: lead.deal_amount,
        email: lead.email,
        phone: lead.phone,
        stage: lead.pipeline_stage,
        owner_user_id: lead.owner_user_id,
      };
      const v = map[k];
      return v === null || v === undefined ? "" : String(v);
    }
    if (parts[0] === "event") {
      const k = parts.slice(1).join(".");
      const v = (event.data as Record<string, unknown>)[k];
      return v === null || v === undefined ? "" : String(v);
    }
    return "";
  });
}

/**
 * buildWebhookPayload — bygger payload for post_to_webhook / trigger_zapier.
 *
 * Default-shape inneholder lead + event-data + workflow-meta. Hvis
 * payload_template (string) er satt på post_to_webhook, parses den som
 * JSON ETTER mustache-substitusjon og overrider default-shape.
 * Hvis payload (object) er satt på trigger_zapier, merges den med default-shape.
 */
export function buildWebhookPayload(
  action: WorkflowAction,
  event: WorkflowEvent,
  lead: LeadRow | null,
  workflowId: string,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    workflow_id: workflowId,
    organization_id: event.organizationId,
    triggered_at: new Date().toISOString(),
    event: {
      type: event.type,
      data: event.data,
      actor_user_id: event.actorUserId,
    },
    lead: lead
      ? {
          id: lead.id,
          name: lead.business_name,
          city: lead.city,
          score: lead.lead_score,
          temperature: lead.lead_temperature,
          stage: lead.pipeline_stage,
          deal_amount: lead.deal_amount,
          deal_probability: lead.deal_probability,
          email: lead.email,
          phone: lead.phone,
          owner_user_id: lead.owner_user_id,
        }
      : null,
  };

  if (action.type === "post_to_webhook" && action.payload_template) {
    try {
      const rendered = renderTemplate(action.payload_template, event, lead);
      const parsed = JSON.parse(rendered);
      if (parsed && typeof parsed === "object") {
        return { ...base, ...(parsed as Record<string, unknown>) };
      }
    } catch {
      // ugyldig JSON → fall tilbake til base
    }
  }
  if (action.type === "trigger_zapier" && action.payload) {
    return { ...base, ...action.payload };
  }
  return base;
}

/**
 * publishEvent: fire-and-forget event-bus.
 *
 * Caller bør void publishEvent(...) for å ikke blokkere request-løpet.
 * Vi henter matchende workflows, evaluerer + eksekverer hver i parallel.
 */
export async function publishEvent(event: WorkflowEvent): Promise<void> {
  try {
    const workflows = await matchWorkflows(
      event.pool,
      event.organizationId,
      event,
    );
    if (workflows.length === 0) return;

    // Concurrent execution — én feilende workflow stopper ikke de andre
    await Promise.allSettled(
      workflows.map((w) => executeWorkflow(event.pool, w, event)),
    );
  } catch (err) {
    console.warn("[workflow-engine] publishEvent failed:", err);
  }
}
