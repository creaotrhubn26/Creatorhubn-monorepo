/** CRUD and exactly-once evaluation for project-scoped Leadgrid rules. */
import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { requireLeadMapPermission } from "./lead-map-rbac-helper.js";
import {
  getLeadgridSession,
  loadAccessibleLeadgridProject,
  type LeadgridAccessibleProject,
} from "./leadgrid-project-access.js";
import { loadAccessibleLeadgridLead } from "./leadgrid-lead-access.js";
import {
  evaluateCondition,
  evaluateRulesForLead,
  RuleEvaluationConflictError,
  RuleEvaluationInProgressError,
  RuleEvaluationLeadNotFoundError,
  type LeadRuleSnapshot,
  type TriggerEvent,
} from "./lead-rules-engine.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}
interface ScopedRequest {
  userId: string;
  project: LeadgridAccessibleProject;
}

const TRIGGER_EVENTS = new Set<TriggerEvent>([
  "lead_create", "lead_update", "status_change", "score_change",
  "follow_up_set", "follow_up_cleared", "cron_hourly", "cron_daily",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONDITION_OPERATORS = new Set([
  "eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in",
  "is_null", "is_not_null", "contains", "starts_with", "ends_with",
]);
const CONDITION_FIELDS = new Set([
  "status", "lead_status", "ai_opportunity_score", "next_follow_up_at",
  "last_visit_at", "days_since_status_change", "days_since_last_visit",
  "days_since_last_contact", "has_follow_up",
]);
const ACTION_TYPES = new Set([
  "prompt_user", "set_priority", "create_followup_reminder",
  "disable_outreach", "notify_role",
]);
const RULE_SELECT = `
  id::text, organization_id::text, project_id, name, description, trigger_on,
  condition, actions, priority, is_active, is_system, throttle_minutes,
  created_at::text, updated_at::text
`;

const DEFAULT_RULES = [
  {
    name: "Interessert lead uten follow-up",
    description: "Når lead-status er 'interested' og det ikke er satt en oppfølgings-dato, be selger sette en.",
    trigger_on: ["lead_update", "status_change", "cron_hourly"],
    condition: { all: [
      { field: "lead_status", op: "eq", value: "interested" },
      { field: "next_follow_up_at", op: "is_null" },
    ] },
    actions: [{ type: "prompt_user", params: {
      message: "Lead er interessert — sett en oppfølgings-dato.",
    } }],
    priority: 10,
    throttle_minutes: 360,
  },
  {
    name: "Høy score + ikke besøkt = høy prioritet",
    description: "AI-score > 80 og lead ikke har vært besøkt → marker som høy prioritet.",
    trigger_on: ["lead_update", "score_change"],
    condition: { all: [
      { field: "ai_opportunity_score", op: "gt", value: 80 },
      { field: "lead_status", op: "eq", value: "unvisited" },
    ] },
    actions: [
      { type: "set_priority", params: { level: "high" } },
      { type: "prompt_user", params: { message: "Høyt potensial — prioritér å oppsøke." } },
    ],
    priority: 20,
    throttle_minutes: 1440,
  },
  {
    name: "Forslag sendt, 5 dager stille",
    description: "Tilbud sendt for 5 dager siden uten respons → lag oppfølgings-påminnelse.",
    trigger_on: ["cron_daily"],
    condition: { all: [
      { field: "lead_status", op: "eq", value: "proposal_sent" },
      { field: "days_since_status_change", op: "gte", value: 5 },
    ] },
    actions: [{ type: "create_followup_reminder", params: {
      days: 1,
      next_action: "Ringe og høre om de fikk lest tilbudet",
    } }],
    priority: 30,
    throttle_minutes: 4320,
  },
  {
    name: "Ikke kontakt — slå av outreach",
    description: "Lead-status = 'do_not_contact' → deaktiver alle ads/SMS/e-post-handlinger.",
    trigger_on: ["lead_update", "status_change"],
    condition: { field: "lead_status", op: "eq", value: "do_not_contact" },
    actions: [{ type: "disable_outreach", params: {
      reason: "lead_status=do_not_contact",
    } }],
    priority: 5,
    throttle_minutes: 0,
  },
] as const;

function requestedProjectId(req: Request): string {
  const supplied = [req.body?.project_id, req.body?.projectId,
    req.query.project_id, req.query.projectId]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = [...new Set(supplied)];
  return unique.length === 1 && unique[0].length <= 255 ? unique[0] : "";
}

function requestIdempotencyKey(req: Request): string {
  const raw = req.headers["idempotency-key"];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonFits(value: unknown, maxBytes = 32_768): boolean {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8") <= maxBytes;
  } catch {
    return false;
  }
}

function isValidCondition(
  value: unknown,
  depth = 0,
  state: { nodes: number } = { nodes: 0 },
): boolean {
  if (!isRecord(value) || depth > 8 || ++state.nodes > 100) return false;
  const hasAll = Object.hasOwn(value, "all");
  const hasAny = Object.hasOwn(value, "any");
  const hasNot = Object.hasOwn(value, "not");
  const hasLeaf = Object.hasOwn(value, "field") || Object.hasOwn(value, "op");
  if ([hasAll, hasAny, hasNot, hasLeaf].filter(Boolean).length !== 1) return false;

  if (hasAll || hasAny) {
    const key = hasAll ? "all" : "any";
    const children = value[key];
    return Object.keys(value).length === 1
      && Array.isArray(children)
      && children.length > 0
      && children.length <= 20
      && children.every((child) => isValidCondition(child, depth + 1, state));
  }
  if (hasNot) {
    return Object.keys(value).length === 1
      && isValidCondition(value.not, depth + 1, state);
  }

  const field = value.field;
  const op = value.op;
  const allowedKeys = new Set(["field", "op", "value"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return false;
  const fieldAllowed = typeof field === "string"
    && (CONDITION_FIELDS.has(field)
      || /^custom_fields\.[A-Za-z0-9_-]{1,80}$/.test(field));
  return fieldAllowed && typeof op === "string" && CONDITION_OPERATORS.has(op);
}

function isValidActions(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20
    || !jsonFits(value)) return false;
  return value.every((entry) => {
    if (!isRecord(entry) || typeof entry.type !== "string"
      || !ACTION_TYPES.has(entry.type)) return false;
    if (Object.keys(entry).some((key) => key !== "type" && key !== "params")) {
      return false;
    }
    return entry.params === undefined || isRecord(entry.params);
  });
}

async function resolveAuthorizedProjectOrg(
  req: Request,
  pool: Pool,
  userId: string,
): Promise<string | null> {
  const projectId = requestedProjectId(req);
  if (!projectId) return null;
  try {
    const project = await loadAccessibleLeadgridProject(pool, projectId, userId);
    return project?.organizationId ?? null;
  } catch {
    return null;
  }
}

async function resolveProject(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<ScopedRequest | null> {
  const session = getLeadgridSession(req, activeSessions);
  if (!session?.userId) {
    res.status(401).json({ error: "Innlogging kreves" });
    return null;
  }
  const projectId = requestedProjectId(req);
  if (!projectId) {
    res.status(400).json({ error: "project_id_required" });
    return null;
  }
  const project = await loadAccessibleLeadgridProject(pool, projectId, session.userId);
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return null;
  }
  return { userId: session.userId, project };
}

async function resolveLead(
  req: Request,
  res: Response,
  pool: Pool,
  activeSessions: Map<string, SessionData>,
): Promise<(ScopedRequest & { leadId: string }) | null> {
  const scope = await resolveProject(req, res, pool, activeSessions);
  if (!scope) return null;
  const lead = await loadAccessibleLeadgridLead(pool, {
    leadId: req.params.id ?? "",
    userId: scope.userId,
  });
  if (!lead || lead.organizationId !== scope.project.organizationId
    || lead.projectId !== scope.project.id) {
    res.status(404).json({ error: "lead_not_found" });
    return null;
  }
  return { ...scope, leadId: lead.id };
}

async function scopedRuleExists(
  pool: Pool,
  project: LeadgridAccessibleProject,
  ruleId: string,
): Promise<boolean> {
  if (!isUuid(ruleId)) return false;
  const result = await pool.query(
    `SELECT 1 FROM lead_automation_rules
        WHERE id=$1::uuid AND organization_id=$2::uuid AND project_id=$3
        LIMIT 1`,
    [ruleId, project.organizationId, project.id],
  );
  return result.rowCount === 1;
}

function normalizedTriggers(value: unknown): TriggerEvent[] | null {
  if (!Array.isArray(value)) return ["lead_update"];
  if (value.length === 0 || value.length > TRIGGER_EVENTS.size
    || value.some((item) => typeof item !== "string"
      || !TRIGGER_EVENTS.has(item as TriggerEvent))) return null;
  const result = [...new Set(value as TriggerEvent[])];
  return result.length > 0 ? result : null;
}

export function registerLeadRulesRoutes({ app, pool, activeSessions }: Deps): void {
  const ROOT = "/api/admin-room/lead-map";
  const permission = (key: string) => requireLeadMapPermission(key, {
    pool,
    activeSessions,
    resolveOrgId: resolveAuthorizedProjectOrg,
  });

  app.get(
    `${ROOT}/rules`,
    permission("marketing.rules.view"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveProject(req, res, pool, activeSessions);
        if (!scope) return;
        const result = await pool.query(
          `SELECT ${RULE_SELECT}
               FROM lead_automation_rules
              WHERE organization_id=$1::uuid AND project_id=$2
              ORDER BY priority ASC, name ASC`,
          [scope.project.organizationId, scope.project.id],
        );
        return res.json({
          organization_id: scope.project.organizationId,
          project_id: scope.project.id,
          rules: result.rows,
        });
      } catch {
        return res.status(500).json({ error: "rules_list_failed", detail: "internal_error" });
      }
    },
  );

  app.post(
    `${ROOT}/rules`,
    permission("marketing.rules.edit"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveProject(req, res, pool, activeSessions);
        if (!scope) return;
        const key = requestIdempotencyKey(req);
        if (key.length < 8 || key.length > 200) {
          return res.status(400).json({ error: "idempotency_key_required" });
        }
        const name = typeof req.body?.name === "string"
          ? req.body.name.trim().slice(0, 160) : "";
        const triggers = normalizedTriggers(req.body?.trigger_on);
        const condition = req.body?.condition;
        const actions = req.body?.actions;
        if (!name) return res.status(400).json({ error: "name_required" });
        if (!jsonFits(condition) || !isValidCondition(condition)) {
          return res.status(400).json({ error: "invalid_condition" });
        }
        if (!isValidActions(actions)) {
          return res.status(400).json({ error: "invalid_actions" });
        }
        if (!triggers) return res.status(400).json({ error: "invalid_trigger_on" });
        const normalized = {
          name,
          description: typeof req.body?.description === "string"
            ? req.body.description.slice(0, 4000) : null,
          trigger_on: triggers,
          condition,
          actions,
          priority: Number.isFinite(req.body?.priority)
            ? Math.max(0, Math.min(32767, Math.round(req.body.priority))) : 100,
          throttle_minutes: Number.isFinite(req.body?.throttle_minutes)
            ? Math.max(0, Math.min(525600, Math.round(req.body.throttle_minutes))) : 60,
        };
        const keyHash = sha256(key);
        const requestHash = sha256(JSON.stringify({
          projectId: scope.project.id,
          ...normalized,
        }));
        const result = await pool.query(
          `INSERT INTO lead_automation_rules
             (organization_id,project_id,name,description,trigger_on,condition,
              actions,priority,throttle_minutes,created_by,
              creation_key_hash,creation_request_hash)
           VALUES ($1::uuid,$2,$3,$4,$5::text[],$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12)
           ON CONFLICT (organization_id,project_id,creation_key_hash)
             WHERE creation_key_hash IS NOT NULL
           DO UPDATE SET creation_key_hash=EXCLUDED.creation_key_hash
           RETURNING ${RULE_SELECT}, creation_request_hash,
                     (xmax=0) AS newly_created`,
          [scope.project.organizationId, scope.project.id, normalized.name,
            normalized.description, normalized.trigger_on,
            JSON.stringify(normalized.condition), JSON.stringify(normalized.actions),
            normalized.priority, normalized.throttle_minutes, scope.userId,
            keyHash, requestHash],
        );
        const row = result.rows[0];
        if (!row || row.creation_request_hash !== requestHash) {
          return res.status(409).json({ error: "idempotency_key_conflict" });
        }
        const { creation_request_hash: _hidden, newly_created: created, ...rule } = row;
        res.setHeader("Idempotent-Replay", created ? "false" : "true");
        return res.status(created ? 201 : 200).json({ rule });
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          return res.status(409).json({ error: "rule_name_already_exists" });
        }
        return res.status(500).json({ error: "rule_create_failed", detail: "internal_error" });
      }
    },
  );

  app.patch(
    `${ROOT}/rules/:id`,
    permission("marketing.rules.edit"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveProject(req, res, pool, activeSessions);
        if (!scope) return;
        if (!isUuid(req.params.id)) {
          return res.status(404).json({ error: "rule_not_found" });
        }
        const set: string[] = [];
        const values: unknown[] = [];
        const add = (column: string, value: unknown, cast = "") => {
          values.push(value);
          set.push(`${column}=$${values.length}${cast}`);
        };
        if (typeof req.body?.name === "string") {
          const name = req.body.name.trim().slice(0, 160);
          if (!name) return res.status(400).json({ error: "name_required" });
          add("name", name);
        }
        if (req.body?.description === null || typeof req.body?.description === "string") {
          add("description", req.body.description?.slice(0, 4000) ?? null);
        }
        if (req.body?.trigger_on !== undefined) {
          const triggers = normalizedTriggers(req.body.trigger_on);
          if (!triggers) return res.status(400).json({ error: "invalid_trigger_on" });
          add("trigger_on", triggers, "::text[]");
        }
        if (req.body?.condition !== undefined) {
          if (!jsonFits(req.body.condition) || !isValidCondition(req.body.condition)) {
            return res.status(400).json({ error: "invalid_condition" });
          }
          add("condition", JSON.stringify(req.body.condition), "::jsonb");
        }
        if (req.body?.actions !== undefined) {
          if (!isValidActions(req.body.actions)) {
            return res.status(400).json({ error: "invalid_actions" });
          }
          add("actions", JSON.stringify(req.body.actions), "::jsonb");
        }
        if (typeof req.body?.priority === "number" && Number.isFinite(req.body.priority)) {
          add("priority", Math.max(0, Math.min(32767, Math.round(req.body.priority))));
        }
        if (typeof req.body?.is_active === "boolean") add("is_active", req.body.is_active);
        if (typeof req.body?.throttle_minutes === "number"
          && Number.isFinite(req.body.throttle_minutes)) {
          add("throttle_minutes",
            Math.max(0, Math.min(525600, Math.round(req.body.throttle_minutes))));
        }
        if (set.length === 0) return res.status(400).json({ error: "no_changes" });
        set.push("updated_at=now()");
        values.push(req.params.id, scope.project.organizationId, scope.project.id);
        const idAt = values.length - 2;
        const orgAt = values.length - 1;
        const projectAt = values.length;
        const result = await pool.query(
          `UPDATE lead_automation_rules SET ${set.join(", ")}
              WHERE id=$${idAt}::uuid AND organization_id=$${orgAt}::uuid
                AND project_id=$${projectAt} AND is_system=false
              RETURNING ${RULE_SELECT}`,
          values,
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "rule_not_found" });
        }
        return res.json({ rule: result.rows[0] });
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          return res.status(409).json({ error: "rule_name_already_exists" });
        }
        return res.status(500).json({ error: "rule_update_failed", detail: "internal_error" });
      }
    },
  );

  app.delete(
    `${ROOT}/rules/:id`,
    permission("marketing.rules.edit"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveProject(req, res, pool, activeSessions);
        if (!scope) return;
        if (!isUuid(req.params.id)) {
          return res.status(404).json({ error: "rule_not_found" });
        }
        const result = await pool.query(
          `DELETE FROM lead_automation_rules
              WHERE id=$1::uuid AND organization_id=$2::uuid AND project_id=$3
                AND is_system=false
              RETURNING id::text`,
          [req.params.id, scope.project.organizationId, scope.project.id],
        );
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "rule_not_found" });
        }
        return res.json({ ok: true });
      } catch {
        return res.status(500).json({ error: "rule_delete_failed", detail: "internal_error" });
      }
    },
  );

  app.get(
    `${ROOT}/rules/:id/runs`,
    permission("marketing.rules.view"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveProject(req, res, pool, activeSessions);
        if (!scope) return;
        if (!await scopedRuleExists(pool, scope.project, req.params.id)) {
          return res.status(404).json({ error: "rule_not_found" });
        }
        const result = await pool.query(
          `SELECT id::text,evaluation_id::text,customer_id,triggered_by_event,
                    result,actions_executed,error_message,duration_ms,ran_at::text
               FROM lead_automation_runs
              WHERE rule_id=$1::uuid AND organization_id=$2::uuid AND project_id=$3
              ORDER BY ran_at DESC LIMIT 100`,
          [req.params.id, scope.project.organizationId, scope.project.id],
        );
        return res.json({
          organization_id: scope.project.organizationId,
          project_id: scope.project.id,
          runs: result.rows,
        });
      } catch {
        return res.status(500).json({ error: "runs_failed", detail: "internal_error" });
      }
    },
  );

  app.post(
    `${ROOT}/rules/:id/test`,
    permission("marketing.rules.view"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveProject(req, res, pool, activeSessions);
        if (!scope) return;
        if (!isUuid(req.params.id)) {
          return res.status(404).json({ error: "rule_not_found" });
        }
        const customerId = typeof req.body?.customer_id === "string"
          ? req.body.customer_id.trim() : "";
        if (!customerId) return res.status(400).json({ error: "customer_id_required" });
        const lead = await loadAccessibleLeadgridLead(pool, {
          leadId: customerId,
          userId: scope.userId,
        });
        if (!lead || lead.organizationId !== scope.project.organizationId
          || lead.projectId !== scope.project.id) {
          return res.status(404).json({ error: "lead_not_found" });
        }
        const ruleResult = await pool.query<{ condition: Parameters<typeof evaluateCondition>[1] }>(
          `SELECT condition FROM lead_automation_rules
              WHERE id=$1::uuid AND organization_id=$2::uuid AND project_id=$3
              LIMIT 1`,
          [req.params.id, scope.project.organizationId, scope.project.id],
        );
        if (!ruleResult.rows[0]) return res.status(404).json({ error: "rule_not_found" });
        const snapshotResult = await pool.query<{ row: LeadRuleSnapshot }>(
          `SELECT to_jsonb(snapshot) AS row FROM (
               SELECT id::text,organization_id::text,project_id,status,lead_status,
                      ai_opportunity_score,next_follow_up_at,last_visit_at,
                      owner_user_id,assigned_user_id,COALESCE(custom_fields,'{}'::jsonb) AS custom_fields,
                      EXTRACT(EPOCH FROM (now()-updated_at))/86400.0 AS days_since_status_change,
                      EXTRACT(EPOCH FROM (now()-last_visit_at))/86400.0 AS days_since_last_visit,
                      EXTRACT(EPOCH FROM (now()-last_contacted_at))/86400.0 AS days_since_last_contact,
                      (next_follow_up_at IS NOT NULL) AS has_follow_up
                 FROM crm_customers
                WHERE id=$1::uuid AND organization_id=$2::uuid AND project_id=$3
                  AND archived_at IS NULL
             ) snapshot`,
          [lead.id, scope.project.organizationId, scope.project.id],
        );
        const snapshot = snapshotResult.rows[0]?.row;
        if (!snapshot) return res.status(404).json({ error: "lead_not_found" });
        return res.json({
          project_id: scope.project.id,
          matched: evaluateCondition(snapshot, ruleResult.rows[0].condition),
          lead_snapshot: snapshot,
        });
      } catch {
        return res.status(500).json({ error: "test_failed", detail: "internal_error" });
      }
    },
  );

  app.post(
    `${ROOT}/leads/:id/evaluate-rules`,
    // Evaluation executes mutating actions; read-only rule access is not enough.
    permission("marketing.rules.edit"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveLead(req, res, pool, activeSessions);
        if (!scope) return;
        const key = requestIdempotencyKey(req);
        if (key.length < 8 || key.length > 200) {
          return res.status(400).json({ error: "idempotency_key_required" });
        }
        const event = typeof req.body?.event === "string"
          && TRIGGER_EVENTS.has(req.body.event as TriggerEvent)
          ? req.body.event as TriggerEvent : null;
        if (!event) return res.status(400).json({ error: "invalid_trigger_event" });
        const result = await evaluateRulesForLead(pool, {
          customerId: scope.leadId,
          organizationId: scope.project.organizationId,
          projectId: scope.project.id,
          event,
          idempotencyKey: key,
        });
        res.setHeader("Idempotent-Replay", result.idempotent_replay ? "true" : "false");
        return res.status(result.idempotent_replay ? 200 : 201).json(result);
      } catch (error) {
        if (error instanceof RuleEvaluationConflictError) {
          return res.status(409).json({ error: "idempotency_key_conflict" });
        }
        if (error instanceof RuleEvaluationInProgressError) {
          res.setHeader("Retry-After", "5");
          return res.status(409).json({ error: "rule_evaluation_in_progress" });
        }
        if (error instanceof RuleEvaluationLeadNotFoundError) {
          return res.status(404).json({ error: "lead_not_found" });
        }
        return res.status(500).json({ error: "evaluate_failed", detail: "internal_error" });
      }
    },
  );

  app.post(
    `${ROOT}/rules/seed-defaults`,
    permission("marketing.rules.edit"),
    async (req: Request, res: Response) => {
      try {
        const scope = await resolveProject(req, res, pool, activeSessions);
        if (!scope) return;
        const created: string[] = [];
        for (const rule of DEFAULT_RULES) {
          const inserted = await pool.query<{ id: string }>(
            `INSERT INTO lead_automation_rules
               (organization_id,project_id,name,description,trigger_on,condition,
                actions,priority,throttle_minutes,is_system,created_by)
             VALUES ($1::uuid,$2,$3,$4,$5::text[],$6::jsonb,$7::jsonb,$8,$9,false,$10)
             ON CONFLICT (organization_id,project_id,name) DO NOTHING
             RETURNING id::text`,
            [scope.project.organizationId, scope.project.id, rule.name, rule.description,
              [...rule.trigger_on], JSON.stringify(rule.condition),
              JSON.stringify(rule.actions), rule.priority, rule.throttle_minutes, scope.userId],
          );
          if (inserted.rows[0]) created.push(inserted.rows[0].id);
        }
        return res.json({
          organization_id: scope.project.organizationId,
          project_id: scope.project.id,
          created_count: created.length,
          ids: created,
        });
      } catch {
        return res.status(500).json({ error: "seed_failed", detail: "internal_error" });
      }
    },
  );
}
