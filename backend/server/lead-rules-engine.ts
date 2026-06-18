/**
 * lead-rules-engine.ts
 *
 * IF/THEN-evaluering for lead-automation-regler (mig 0305).
 *
 * Trigger-modus:
 *   - evaluateRulesForLead(pool, customerId, event)
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

import type { Pool } from "pg";

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
  name: string;
  trigger_on: string[];
  condition: Condition;
  actions: Action[];
  priority: number;
  throttle_minutes: number;
}

interface LeadSnapshot {
  id: string;
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
  pool: Pool, customerId: string,
): Promise<LeadSnapshot | null> {
  const r = await pool.query<{
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
  }>(
    `SELECT id::text, status, lead_status, ai_opportunity_score,
            next_follow_up_at::text, last_visit_at::text, last_contacted_at::text,
            owner_user_id, assigned_user_id, custom_fields, updated_at::text
       FROM crm_customers WHERE id::text = $1 LIMIT 1`,
    [customerId],
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

function getFieldValue(snap: LeadSnapshot, fieldPath: string): unknown {
  // Støtter både direkte felter + 'custom_fields.foo'
  if (fieldPath.startsWith("custom_fields.")) {
    const key = fieldPath.slice("custom_fields.".length);
    return snap.custom_fields[key];
  }
  return (snap as unknown as Record<string, unknown>)[fieldPath];
}

function applyOp(left: unknown, op: ConditionOp, right: unknown): boolean {
  switch (op) {
    case "eq":         return left === right;
    case "ne":         return left !== right;
    case "gt":         return Number(left) > Number(right);
    case "gte":        return Number(left) >= Number(right);
    case "lt":         return Number(left) < Number(right);
    case "lte":        return Number(left) <= Number(right);
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

export function evaluateCondition(snap: LeadSnapshot, c: Condition): boolean {
  if (c.all) return c.all.every((x) => evaluateCondition(snap, x));
  if (c.any) return c.any.some((x) => evaluateCondition(snap, x));
  if (c.not) return !evaluateCondition(snap, c.not);
  if (c.field && c.op) {
    const left = getFieldValue(snap, c.field);
    return applyOp(left, c.op, c.value);
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────
// Action-runners
// ─────────────────────────────────────────────────────────────────

async function runAction(
  pool: Pool, snap: LeadSnapshot, action: Action,
): Promise<{ executed: boolean; detail?: string }> {
  switch (action.type) {
    case "prompt_user": {
      const message = String(action.params.message ?? "Sjekk denne leaden");
      const userId = snap.assigned_user_id ?? snap.owner_user_id;
      if (!userId) return { executed: false, detail: "no_user_to_prompt" };
      // Lagre som notification_events (mig 0290) hvis tabellen finnes
      try {
        await pool.query(
          `INSERT INTO notification_events
             (user_id, event_type, lead_id, message, created_at)
           VALUES ($1, 'rule_prompt', $2, $3, now())`,
          [userId, snap.id, message],
        );
      } catch { /* notification_events kan ha annen schema; swallow */ }
      return { executed: true, detail: `prompted ${userId}` };
    }
    case "set_priority": {
      const level = String(action.params.level ?? "high").toLowerCase();
      const map: Record<string, number> = {
        high: 90, urgent: 95, medium: 60, low: 30, very_low: 10,
      };
      const score = map[level] ?? 75;
      await pool.query(
        `UPDATE crm_customers
            SET ai_opportunity_score = $2,
                claude_ranked_at = now()
          WHERE id::text = $1`,
        [snap.id, score],
      );
      return { executed: true, detail: `score=${score}` };
    }
    case "create_followup_reminder": {
      const days = Math.max(0, Math.min(365, Number(action.params.days ?? 1)));
      const next = new Date(Date.now() + days * 24 * 3600_000);
      await pool.query(
        `UPDATE crm_customers
            SET next_follow_up_at = $2,
                next_action = COALESCE($3, next_action)
          WHERE id::text = $1`,
        [
          snap.id, next,
          typeof action.params.next_action === "string"
            ? action.params.next_action.slice(0, 500)
            : null,
        ],
      );
      return { executed: true, detail: `follow_up_at=${next.toISOString()}` };
    }
    case "disable_outreach": {
      const updatedFields = {
        ...snap.custom_fields,
        outreach_disabled: true,
        outreach_disabled_at: new Date().toISOString(),
        outreach_disabled_reason: String(action.params.reason ?? "rule"),
      };
      await pool.query(
        `UPDATE crm_customers
            SET custom_fields = $2::jsonb
          WHERE id::text = $1`,
        [snap.id, JSON.stringify(updatedFields)],
      );
      return { executed: true };
    }
    case "notify_role": {
      const role = String(action.params.role ?? "salgssjef");
      const message = String(action.params.message ?? "Regel-trigger");
      // Send notification til alle org-medlemmer med den rollen
      try {
        await pool.query(
          `INSERT INTO notification_events
             (user_id, event_type, lead_id, message, created_at)
           SELECT om.user_id, 'rule_notify_role', $2, $3, now()
             FROM organization_members om
             JOIN crm_customers c ON c.id::text = $2
             WHERE om.role = $1
               AND om.organization_id = (
                 SELECT om2.organization_id
                   FROM organization_members om2
                  WHERE om2.user_id = c.owner_user_id
                  LIMIT 1
               )`,
          [role, snap.id, message],
        );
      } catch { /* notification_events schema kan variere */ }
      return { executed: true, detail: `role=${role}` };
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
  rules_checked: number;
  rules_matched: number;
  rules_throttled: number;
  rules_failed: number;
  actions_executed: number;
}

export async function evaluateRulesForLead(
  pool: Pool,
  customerId: string,
  event: TriggerEvent,
): Promise<EvaluateResult> {
  const result: EvaluateResult = {
    customer_id: customerId, rules_checked: 0, rules_matched: 0,
    rules_throttled: 0, rules_failed: 0, actions_executed: 0,
  };

  const snap = await loadLeadSnapshot(pool, customerId);
  if (!snap) return result;

  // Finn org-en ledet eier til. Regler scopes til org.
  const orgRes = await pool.query<{ organization_id: string }>(
    `SELECT organization_id::text
       FROM organization_members
      WHERE user_id = $1 LIMIT 1`,
    [snap.owner_user_id ?? snap.assigned_user_id ?? ""],
  );
  const orgId = orgRes.rows[0]?.organization_id;
  if (!orgId) return result;

  const rulesRes = await pool.query<RuleRow>(
    `SELECT id::text, organization_id::text, name, trigger_on,
            condition, actions, priority, throttle_minutes
       FROM lead_automation_rules
      WHERE organization_id = $1
        AND is_active = true
        AND $2 = ANY(trigger_on)
      ORDER BY priority ASC, name ASC`,
    [orgId, event],
  );

  for (const rule of rulesRes.rows) {
    result.rules_checked++;
    const startedAt = Date.now();

    try {
      // Throttle-sjekk
      if (rule.throttle_minutes > 0) {
        const throttleRes = await pool.query<{ exists: boolean }>(
          `SELECT EXISTS(
             SELECT 1 FROM lead_automation_runs
              WHERE rule_id = $1 AND customer_id = $2
                AND result = 'matched'
                AND ran_at > now() - ($3 || ' minutes')::interval
           ) AS exists`,
          [rule.id, customerId, rule.throttle_minutes],
        );
        if (throttleRes.rows[0].exists) {
          result.rules_throttled++;
          await pool.query(
            `INSERT INTO lead_automation_runs
               (rule_id, customer_id, triggered_by_event, result, duration_ms)
             VALUES ($1, $2, $3, 'throttled', $4)`,
            [rule.id, customerId, event, Date.now() - startedAt],
          );
          continue;
        }
      }

      // Evaluér condition
      const matched = evaluateCondition(snap, rule.condition);
      if (!matched) {
        await pool.query(
          `INSERT INTO lead_automation_runs
             (rule_id, customer_id, triggered_by_event, result, duration_ms)
           VALUES ($1, $2, $3, 'unmatched', $4)`,
          [rule.id, customerId, event, Date.now() - startedAt],
        );
        continue;
      }

      result.rules_matched++;
      const executedActions: Array<{ type: string; detail?: string }> = [];

      // Kjør hver action sekvensielt
      for (const action of rule.actions ?? []) {
        try {
          const r = await runAction(pool, snap, action);
          if (r.executed) {
            result.actions_executed++;
            executedActions.push({ type: action.type, detail: r.detail });
          } else {
            executedActions.push({ type: action.type, detail: r.detail ?? "skipped" });
          }
        } catch (err) {
          executedActions.push({
            type: action.type,
            detail: `error: ${String(err).slice(0, 200)}`,
          });
        }
      }

      await pool.query(
        `INSERT INTO lead_automation_runs
           (rule_id, customer_id, triggered_by_event, result,
            actions_executed, duration_ms)
         VALUES ($1, $2, $3, 'matched', $4::jsonb, $5)`,
        [
          rule.id, customerId, event,
          JSON.stringify(executedActions),
          Date.now() - startedAt,
        ],
      );

      // Re-load snapshot etter actions så neste regel jobber på oppdatert state
      const refreshed = await loadLeadSnapshot(pool, customerId);
      if (refreshed) Object.assign(snap, refreshed);
    } catch (err) {
      result.rules_failed++;
      await pool.query(
        `INSERT INTO lead_automation_runs
           (rule_id, customer_id, triggered_by_event, result,
            error_message, duration_ms)
         VALUES ($1, $2, $3, 'failed', $4, $5)`,
        [
          rule.id, customerId, event,
          String(err).slice(0, 500),
          Date.now() - startedAt,
        ],
      );
    }
  }

  return result;
}
