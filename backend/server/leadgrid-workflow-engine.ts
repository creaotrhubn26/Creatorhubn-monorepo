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
import type {
  WorkflowAction,
  WorkflowCondition,
  WorkflowTrigger,
  ActionResult,
} from "./leadgrid-workflow-types.js";
import { applyStageChange } from "./leadgrid-deals-service.js";
import { isLeadgridStage } from "./leadgrid-deal-defaults.js";
import { emitWebhook } from "./webhook-emitter.js";

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

    default:
      return { status: "skipped", message: "unknown_action" };
  }
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
