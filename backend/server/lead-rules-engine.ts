/**
 * lead-rules-engine.ts
 *
 * IF/THEN-evaluering for lead-automation-regler (mig 0305).
 *
 * Trigger-modus:
 *   - evaluateRulesForLead(pool, { organizationId, projectId, customerId,
 *       event, idempotencyKey })
 *     Kalles fra lead-create / lead-update / cron.
 *
 * Condition-grammatikk (rekursiv JSON):
 *   { "field": "status", "op": "eq", "value": "interested" }
 *   { "field": "next_follow_up_at", "op": "is_null" }
 *   { "field": "ai_opportunity_score", "op": "gt", "value": 80 }
 *   { "field": "days_since_status_change", "op": "gte", "value": 5 }
 *   { "all": [ {...}, {...} ] }      → AND
 *   { "any": [ {...}, {...} ] }      → OR
 *   { "not": {...} }                 → NEGATION
 *
 * Action-typer (kjøres sekvensielt; feil i én avbryter ikke neste):
 *   prompt_user           — opprett notification mot eier (selger)
 *   set_priority          — ai_opportunity_score override (high=90, etc.)
 *   create_followup_reminder
 *                         — sett next_follow_up_at = now + N dager
 *   disable_outreach      — sett custom_fields.outreach_disabled = true
 *   notify_role           — opprett notification mot rolle i org
 *
 * Throttling: per-(rule, customer) sjekkes vs lead_automation_runs siste
 * run innen throttle_minutes; ved match returneres 'throttled'.
 */

import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";

// ─────────────────────────────────────────────────────────────────
// Typer
// ─────────────────────────────────────────────────────────────────

export type TriggerEvent =
  | "lead_create"
  | "lead_update"
  | "status_change"
  | "score_change"
  | "follow_up_set"
  | "follow_up_cleared"
  | "cron_hourly"
  | "cron_daily";

const TRIGGER_EVENTS = new Set<TriggerEvent>([
  "lead_create", "lead_update", "status_change", "score_change",
  "follow_up_set", "follow_up_cleared", "cron_hourly", "cron_daily",
]);

interface Condition {
  field?: string;
  op?: ConditionOp;
  value?: unknown;
  all?: Condition[];
  any?: Condition[];
  not?: Condition;
}

type ConditionOp =
  | "eq" | "ne" | "gt" | "gte" | "lt" | "lte"
  | "in" | "not_in" | "is_null" | "is_not_null"
  | "contains" | "starts_with" | "ends_with";

interface Action {
  type: ActionType;
  params: Record<string, unknown>;
}

type ActionType =
  | "prompt_user"
  | "set_priority"
  | "create_followup_reminder"
  | "disable_outreach"
  | "notify_role";

interface RuleRow {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  trigger_on: string[];
  condition: Condition;
  actions: Action[];
  priority: number;
  throttle_minutes: number;
}

export interface LeadRuleSnapshot {
  id: string;
  organization_id: string;
  project_id: string;
  status: string | null;
  lead_status: string | null;
  ai_opportunity_score: number | null;
  next_follow_up_at: string | null;
  last_visit_at: string | null;
  owner_user_id: string | null;
  assigned_user_id: string | null;
  custom_fields: Record<string, unknown>;
  // Computed:
  days_since_status_change: number | null;
  days_since_last_visit: number | null;
  days_since_last_contact: number | null;
  has_follow_up: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Snapshot-bygger
// ─────────────────────────────────────────────────────────────────

async function loadLeadSnapshot(
  db: Pick<Pool, "query"> | PoolClient,
  scope: { customerId: string; organizationId: string; projectId: string },
  lock = false,
): Promise<LeadRuleSnapshot | null> {
  const r = await db.query<{
    id: string;
    status: string | null;
    lead_status: string | null;
    ai_opportunity_score: number | null;
    next_follow_up_at: string | null;
    last_visit_at: string | null;
    last_contacted_at: string | null;
    owner_user_id: string | null;
    assigned_user_id: string | null;
    custom_fields: Record<string, unknown> | null;
    updated_at: string;
    organization_id: string;
    project_id: string;
  }>(
    `SELECT lead.id::text, lead.organization_id::text, lead.project_id,
            lead.status, lead.lead_status, lead.ai_opportunity_score,
            lead.next_follow_up_at::text, lead.last_visit_at::text,
            lead.last_contacted_at::text, lead.owner_user_id,
            lead.assigned_user_id, lead.custom_fields, lead.updated_at::text
       FROM crm_customers lead
       JOIN leadgrid_projects project
         ON project.organization_id = lead.organization_id
        AND project.id = lead.project_id
      WHERE lead.id::text = $1
        AND lead.organization_id = $2::uuid
        AND lead.project_id = $3
        AND lead.archived_at IS NULL
        AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
      LIMIT 1
      ${lock ? "FOR UPDATE" : ""}`,
    [scope.customerId, scope.organizationId, scope.projectId],
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  const now = Date.now();
  const daysSince = (ts: string | null): number | null => {
    if (!ts) return null;
    const t = new Date(ts).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.floor((now - t) / (24 * 3600_000));
  };
  return {
    id: row.id,
    organization_id: row.organization_id,
    project_id: row.project_id,
    status: row.status,
    lead_status: row.lead_status,
    ai_opportunity_score: row.ai_opportunity_score,
    next_follow_up_at: row.next_follow_up_at,
    last_visit_at: row.last_visit_at,
    owner_user_id: row.owner_user_id,
    assigned_user_id: row.assigned_user_id,
    custom_fields: row.custom_fields ?? {},
    days_since_status_change: daysSince(row.updated_at),
    days_since_last_visit: daysSince(row.last_visit_at),
    days_since_last_contact: daysSince(row.last_contacted_at),
    has_follow_up: row.next_follow_up_at != null,
  };
}

// ─────────────────────────────────────────────────────────────────
// Condition-evaluator (rekursiv)
// ─────────────────────────────────────────────────────────────────

function getFieldValue(snap: LeadRuleSnapshot, fieldPath: string): unknown {
  // Støtter både direkte felter + 'custom_fields.foo'
  if (fieldPath.startsWith("custom_fields.")) {
    const key = fieldPath.slice("custom_fields.".length);
    return snap.custom_fields[key];
  }
  return (snap as unknown as Record<string, unknown>)[fieldPath];
}

function applyOp(left: unknown, op: ConditionOp, right: unknown): boolean {
  const numeric = (compare: (a: number, b: number) => boolean): boolean => {
    const a = Number(left);
    const b = Number(right);
    return Number.isFinite(a) && Number.isFinite(b) && compare(a, b);
  };
  switch (op) {
    case "eq":         return left === right;
    case "ne":         return left !== right;
    case "gt":         return numeric((a, b) => a > b);
    case "gte":        return numeric((a, b) => a >= b);
    case "lt":         return numeric((a, b) => a < b);
    case "lte":        return numeric((a, b) => a <= b);
    case "in":         return Array.isArray(right) && right.includes(left);
    case "not_in":     return Array.isArray(right) && !right.includes(left);
    case "is_null":    return left == null;
    case "is_not_null":return left != null;
    case "contains":
      return typeof left === "string" && typeof right === "string"
        && left.toLowerCase().includes(right.toLowerCase());
    case "starts_with":
      return typeof left === "string" && typeof right === "string"
        && left.toLowerCase().startsWith(right.toLowerCase());
    case "ends_with":
      return typeof left === "string" && typeof right === "string"
        && left.toLowerCase().endsWith(right.toLowerCase());
    default: return false;
  }
}

export function evaluateCondition(snap: LeadRuleSnapshot, c: Condition): boolean {
  const state = { nodes: 0 };
  const visit = (candidate: unknown, depth: number): boolean => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)
      || depth > 8 || ++state.nodes > 100) return false;
    const node = candidate as Condition;
    const branches = [Array.isArray(node.all), Array.isArray(node.any),
      node.not !== undefined, node.field !== undefined || node.op !== undefined]
      .filter(Boolean).length;
    if (branches !== 1) return false;
    if (Array.isArray(node.all) && node.all.length > 0 && node.all.length <= 20) {
      return node.all.every((child) => visit(child, depth + 1));
    }
    if (Array.isArray(node.any) && node.any.length > 0 && node.any.length <= 20) {
      return node.any.some((child) => visit(child, depth + 1));
    }
    if (node.not) return !visit(node.not, depth + 1);
    if (node.field && node.op) {
      const left = getFieldValue(snap, node.field);
      return applyOp(left, node.op, node.value);
    }
    return false;
  };
  return visit(c, 0);
}

// ─────────────────────────────────────────────────────────────────
// Action-runners
// ─────────────────────────────────────────────────────────────────

async function userCanAccessProject(
  db: PoolClient,
  organizationId: string,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const result = await db.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM leadgrid_projects project
         LEFT JOIN leadgrid_project_members member
           ON member.organization_id = project.organization_id
          AND member.project_id = project.id
          AND member.user_id = $3
         LEFT JOIN organization_members org_member
           ON org_member.organization_id = project.organization_id
          AND org_member.user_id = $3
        WHERE project.organization_id = $1::uuid
          AND project.id = $2
          AND (
            project.created_by = $3
            OR member.user_id IS NOT NULL
            OR (
              org_member.user_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM leadgrid_user_permission_overrides denied
                 WHERE denied.organization_id = project.organization_id
                   AND denied.user_id = $3
                   AND denied.permission_key = 'projects.view_all'
                   AND denied.effect = 'revoke'
              )
              AND (
                org_member.role = 'admin'
                OR EXISTS (
                  SELECT 1 FROM role_permissions defaults
                   WHERE defaults.role = org_member.role
                     AND defaults.permission_key = 'projects.view_all'
                )
                OR EXISTS (
                  SELECT 1 FROM leadgrid_user_permission_overrides granted
                   WHERE granted.organization_id = project.organization_id
                     AND granted.user_id = $3
                     AND granted.permission_key = 'projects.view_all'
                     AND granted.effect = 'grant'
                )
              )
            )
          )
     ) AS allowed`,
    [organizationId, projectId, userId],
  );
  return result.rows[0]?.allowed === true;
}

async function runAction(
  db: PoolClient,
  snap: LeadRuleSnapshot,
  action: Action,
): Promise<{ executed: boolean; detail?: string }> {
  const leadParams = [snap.id, snap.organization_id, snap.project_id];
  switch (action.type) {
    case "prompt_user": {
      const message = String(action.params.message ?? "Sjekk denne leaden").slice(0, 2000);
      const userId = snap.assigned_user_id ?? snap.owner_user_id;
      if (!userId) return { executed: false, detail: "no_user_to_prompt" };
      if (!await userCanAccessProject(db, snap.organization_id, snap.project_id, userId)) {
        return { executed: false, detail: "recipient_outside_project" };
      }
      await db.query(
        `INSERT INTO leadgrid_internal_notifications
           (organization_id, project_id, recipient_user_id, title, body,
            related_lead_id, metadata)
         VALUES ($1::uuid, $2, $3, 'Leadgrid-regel', $4, $5::uuid,
                 '{"source":"automation_rule"}'::jsonb)`,
        [snap.organization_id, snap.project_id, userId, message, snap.id],
      );
      return { executed: true, detail: `prompted ${userId}` };
    }
    case "set_priority": {
      const level = String(action.params.level ?? "high").toLowerCase();
      const map: Record<string, number> = {
        high: 90, urgent: 95, medium: 60, low: 30, very_low: 10,
      };
      const score = map[level] ?? 75;
      const updated = await db.query(
        `UPDATE crm_customers
              SET ai_opportunity_score=$4, claude_ranked_at=now()
            WHERE id::text=$1 AND organization_id=$2::uuid AND project_id=$3
              AND archived_at IS NULL`,
        [...leadParams, score],
      );
      if (updated.rowCount !== 1) throw new Error("lead_scope_changed");
      return { executed: true, detail: `score=${score}` };
    }
    case "create_followup_reminder": {
      const requestedDays = Number(action.params.days ?? 1);
      const days = Number.isFinite(requestedDays)
        ? Math.max(0, Math.min(365, requestedDays))
        : 1;
      const next = new Date(Date.now() + days * 24 * 3600_000);
      const updated = await db.query(
        `UPDATE crm_customers
              SET next_follow_up_at=$4, next_action=COALESCE($5,next_action)
            WHERE id::text=$1 AND organization_id=$2::uuid AND project_id=$3
              AND archived_at IS NULL`,
        [...leadParams, next,
          typeof action.params.next_action === "string"
            ? action.params.next_action.slice(0, 500) : null],
      );
      if (updated.rowCount !== 1) throw new Error("lead_scope_changed");
      return { executed: true, detail: `follow_up_at=${next.toISOString()}` };
    }
    case "disable_outreach": {
      const updatedFields = {
        ...snap.custom_fields,
        outreach_disabled: true,
        outreach_disabled_at: new Date().toISOString(),
        outreach_disabled_reason: String(action.params.reason ?? "rule").slice(0, 500),
      };
      const updated = await db.query(
        `UPDATE crm_customers SET custom_fields=$4::jsonb
            WHERE id::text=$1 AND organization_id=$2::uuid AND project_id=$3
              AND archived_at IS NULL`,
        [...leadParams, JSON.stringify(updatedFields)],
      );
      if (updated.rowCount !== 1) throw new Error("lead_scope_changed");
      return { executed: true };
    }
    case "notify_role": {
      const role = String(action.params.role ?? "salgssjef").slice(0, 80);
      const message = String(action.params.message ?? "Regel-trigger").slice(0, 2000);
      const inserted = await db.query(
        `INSERT INTO leadgrid_internal_notifications
           (organization_id, project_id, recipient_user_id, title, body,
            related_lead_id, metadata)
         SELECT DISTINCT $1::uuid, $2, member.user_id, 'Leadgrid-regel',
                $4, $5::uuid, '{"source":"automation_rule"}'::jsonb
           FROM organization_members member
           LEFT JOIN leadgrid_project_members project_member
             ON project_member.organization_id = member.organization_id
            AND project_member.project_id = $2
            AND project_member.user_id = member.user_id
           JOIN leadgrid_projects project
             ON project.organization_id = member.organization_id
            AND project.id = $2
          WHERE member.organization_id = $1::uuid
            AND member.role = $3
            AND (
              project.created_by = member.user_id
              OR project_member.user_id IS NOT NULL
              OR (
                NOT EXISTS (
                  SELECT 1 FROM leadgrid_user_permission_overrides denied
                   WHERE denied.organization_id = member.organization_id
                     AND denied.user_id = member.user_id
                     AND denied.permission_key = 'projects.view_all'
                     AND denied.effect = 'revoke'
                )
                AND (
                  member.role = 'admin'
                  OR EXISTS (
                    SELECT 1 FROM role_permissions defaults
                     WHERE defaults.role = member.role
                       AND defaults.permission_key = 'projects.view_all'
                  )
                  OR EXISTS (
                    SELECT 1 FROM leadgrid_user_permission_overrides granted
                     WHERE granted.organization_id = member.organization_id
                       AND granted.user_id = member.user_id
                       AND granted.permission_key = 'projects.view_all'
                       AND granted.effect = 'grant'
                  )
                )
              )
            )`,
        [snap.organization_id, snap.project_id, role, message, snap.id],
      );
      return { executed: (inserted.rowCount ?? 0) > 0, detail: `role=${role}` };
    }
    default:
      return { executed: false, detail: "unknown_action_type" };
  }
}

// ─────────────────────────────────────────────────────────────────
// Hoved-evaluerings-loop
// ─────────────────────────────────────────────────────────────────

export interface EvaluateResult {
  customer_id: string;
  organization_id: string;
  project_id: string;
  evaluation_id: string;
  rules_checked: number;
  rules_matched: number;
  rules_throttled: number;
  rules_failed: number;
  actions_executed: number;
  idempotent_replay: boolean;
}

export interface EvaluateRulesInput {
  customerId: string;
  organizationId: string;
  projectId: string;
  event: TriggerEvent;
  idempotencyKey: string;
}

export class RuleEvaluationConflictError extends Error {
  constructor() {
    super("Idempotency-Key was already used for another rule evaluation");
    this.name = "RuleEvaluationConflictError";
  }
}

export class RuleEvaluationInProgressError extends Error {
  constructor() {
    super("Rule evaluation is already in progress");
    this.name = "RuleEvaluationInProgressError";
  }
}

export class RuleEvaluationLeadNotFoundError extends Error {
  constructor() {
    super("Lead was not found in the selected customer project");
    this.name = "RuleEvaluationLeadNotFoundError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function evaluateRulesForLead(
  pool: Pool,
  input: EvaluateRulesInput,
): Promise<EvaluateResult> {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(input.organizationId) || !uuidPattern.test(input.customerId)
    || !input.projectId.trim() || input.projectId !== input.projectId.trim()
    || input.projectId.length > 255 || !TRIGGER_EVENTS.has(input.event)) {
    throw new TypeError("An exact organization, project and lead scope is required");
  }
  const key = input.idempotencyKey.trim();
  if (key.length < 8 || key.length > 200) {
    throw new TypeError("A stable Idempotency-Key between 8 and 200 characters is required");
  }
  const keyHash = sha256(key);
  const requestHash = sha256(JSON.stringify({
    organizationId: input.organizationId,
    projectId: input.projectId,
    customerId: input.customerId,
    event: input.event,
  }));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const snap = await loadLeadSnapshot(client, input, true);
    if (!snap) throw new RuleEvaluationLeadNotFoundError();

    const claim = await client.query<{ id: string }>(
      `INSERT INTO lead_automation_evaluations
         (organization_id, project_id, customer_id, triggered_by_event,
          idempotency_key_hash, request_hash, status)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, 'running')
       ON CONFLICT (organization_id, project_id, idempotency_key_hash) DO NOTHING
       RETURNING id::text`,
      [input.organizationId, input.projectId, input.customerId,
        input.event, keyHash, requestHash],
    );
    let evaluationId = claim.rows[0]?.id;
    if (!evaluationId) {
      const priorResult = await client.query<{
        id: string;
        request_hash: string;
        status: string;
        result_payload: EvaluateResult | null;
      }>(
        `SELECT id::text, request_hash, status, result_payload
           FROM lead_automation_evaluations
          WHERE organization_id=$1::uuid AND project_id=$2
            AND idempotency_key_hash=$3
          FOR UPDATE`,
        [input.organizationId, input.projectId, keyHash],
      );
      const prior = priorResult.rows[0];
      if (!prior || prior.request_hash !== requestHash) {
        throw new RuleEvaluationConflictError();
      }
      if (prior.status === "completed" && prior.result_payload) {
        await client.query("COMMIT");
        return { ...prior.result_payload, idempotent_replay: true };
      }
      throw new RuleEvaluationInProgressError();
    }

    const result: EvaluateResult = {
      customer_id: input.customerId,
      organization_id: input.organizationId,
      project_id: input.projectId,
      evaluation_id: evaluationId,
      rules_checked: 0,
      rules_matched: 0,
      rules_throttled: 0,
      rules_failed: 0,
      actions_executed: 0,
      idempotent_replay: false,
    };
    const rulesResult = await client.query<RuleRow>(
      `SELECT id::text, organization_id::text, project_id, name, trigger_on,
              condition, actions, priority, throttle_minutes
         FROM lead_automation_rules
        WHERE organization_id=$1::uuid AND project_id=$2
          AND is_active=true AND $3=ANY(trigger_on)
        ORDER BY priority ASC, name ASC`,
      [input.organizationId, input.projectId, input.event],
    );

    for (const rule of rulesResult.rows) {
      result.rules_checked++;
      const startedAt = Date.now();
      await client.query("SAVEPOINT leadgrid_rule_run");
      try {
        if (rule.throttle_minutes > 0) {
          const throttle = await client.query<{ exists: boolean }>(
            `SELECT EXISTS (
               SELECT 1 FROM lead_automation_runs
                WHERE organization_id=$1::uuid AND project_id=$2
                  AND rule_id=$3::uuid AND customer_id=$4
                  AND result='matched'
                  AND ran_at > now()-($5::text || ' minutes')::interval
             ) AS exists`,
            [input.organizationId, input.projectId, rule.id,
              input.customerId, rule.throttle_minutes],
          );
          if (throttle.rows[0]?.exists) {
            result.rules_throttled++;
            await client.query(
              `INSERT INTO lead_automation_runs
                 (organization_id,project_id,evaluation_id,rule_id,customer_id,
                  triggered_by_event,result,duration_ms)
               VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,'throttled',$7)`,
              [input.organizationId, input.projectId, evaluationId, rule.id,
                input.customerId, input.event, Date.now() - startedAt],
            );
            await client.query("RELEASE SAVEPOINT leadgrid_rule_run");
            continue;
          }
        }

        if (!evaluateCondition(snap, rule.condition)) {
          await client.query(
            `INSERT INTO lead_automation_runs
               (organization_id,project_id,evaluation_id,rule_id,customer_id,
                triggered_by_event,result,duration_ms)
             VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,'unmatched',$7)`,
            [input.organizationId, input.projectId, evaluationId, rule.id,
              input.customerId, input.event, Date.now() - startedAt],
          );
          await client.query("RELEASE SAVEPOINT leadgrid_rule_run");
          continue;
        }

        result.rules_matched++;
        const executedActions: Array<{ type: string; detail?: string }> = [];
        for (const action of rule.actions ?? []) {
          await client.query("SAVEPOINT leadgrid_rule_action");
          try {
            const actionResult = await runAction(client, snap, action);
            await client.query("RELEASE SAVEPOINT leadgrid_rule_action");
            if (actionResult.executed) result.actions_executed++;
            executedActions.push({
              type: action.type,
              detail: actionResult.detail ?? (actionResult.executed ? "ok" : "skipped"),
            });
          } catch (error) {
            await client.query("ROLLBACK TO SAVEPOINT leadgrid_rule_action");
            await client.query("RELEASE SAVEPOINT leadgrid_rule_action");
            executedActions.push({
              type: action.type,
              detail: `error: ${String(error).slice(0, 200)}`,
            });
          }
        }
        await client.query(
          `INSERT INTO lead_automation_runs
             (organization_id,project_id,evaluation_id,rule_id,customer_id,
              triggered_by_event,result,actions_executed,duration_ms)
           VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,'matched',$7::jsonb,$8)`,
          [input.organizationId, input.projectId, evaluationId, rule.id,
            input.customerId, input.event, JSON.stringify(executedActions),
            Date.now() - startedAt],
        );
        const refreshed = await loadLeadSnapshot(client, input);
        if (!refreshed) throw new Error("lead_scope_changed");
        Object.assign(snap, refreshed);
        await client.query("RELEASE SAVEPOINT leadgrid_rule_run");
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT leadgrid_rule_run");
        await client.query("RELEASE SAVEPOINT leadgrid_rule_run");
        result.rules_failed++;
        await client.query(
          `INSERT INTO lead_automation_runs
             (organization_id,project_id,evaluation_id,rule_id,customer_id,
              triggered_by_event,result,error_message,duration_ms)
           VALUES ($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,'failed',$7,$8)`,
          [input.organizationId, input.projectId, evaluationId, rule.id,
            input.customerId, input.event, String(error).slice(0, 500),
            Date.now() - startedAt],
        );
      }
    }

    const completed = await client.query(
      `UPDATE lead_automation_evaluations
            SET status='completed', result_payload=$4::jsonb, completed_at=now()
          WHERE id=$1::uuid AND organization_id=$2::uuid AND project_id=$3
            AND status='running'`,
      [evaluationId, input.organizationId, input.projectId, JSON.stringify(result)],
    );
    if (completed.rowCount !== 1) throw new Error("rule_evaluation_scope_changed");
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* noop */ }
    throw error;
  } finally {
    client.release();
  }
}
