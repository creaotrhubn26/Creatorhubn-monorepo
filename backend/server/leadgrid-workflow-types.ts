/**
 * leadgrid-workflow-types.ts
 *
 * Type-system + runtime-validatorer for Smart Workflow Builder (#203).
 *
 * Workflows er definert deklarativt:
 *   - trigger: hva som starter eksekvering
 *   - conditions: ekstra-filtre som må stemme
 *   - actions: ordnet liste handlinger
 *
 * Hver type har { type: "..." } som diskriminator + valgfrie ekstra-felt.
 * Validator returnerer { ok: true, value } | { ok: false, error }.
 */

// ─── Trigger-typer ────────────────────────────────────────────────────
export type WorkflowTriggerType =
  | "lead.created"
  | "lead.status_changed"
  | "lead.temperature_changed"
  | "pipeline.stage_changed"
  | "deal.probability_changed"
  | "deal.amount_changed"
  | "deal.expected_close_changed"
  | "recommendation.published"
  | "manual";

export interface TriggerLeadCreated {
  type: "lead.created";
}
export interface TriggerLeadStatusChanged {
  type: "lead.status_changed";
  from?: string;
  to: string;
}
export interface TriggerLeadTemperatureChanged {
  type: "lead.temperature_changed";
  to: "hot" | "warm" | "cold" | "ready";
}
export interface TriggerPipelineStageChanged {
  type: "pipeline.stage_changed";
  from?: string;
  to: string;
}
export interface TriggerDealProbabilityChanged {
  type: "deal.probability_changed";
  min?: number;
  max?: number;
}
export interface TriggerDealAmountChanged {
  type: "deal.amount_changed";
  min?: number;
}
export interface TriggerDealExpectedCloseChanged {
  type: "deal.expected_close_changed";
}
export interface TriggerRecommendationPublished {
  type: "recommendation.published";
  priority?: "high" | "medium" | "low";
}
export interface TriggerManual {
  type: "manual";
}

export type WorkflowTrigger =
  | TriggerLeadCreated
  | TriggerLeadStatusChanged
  | TriggerLeadTemperatureChanged
  | TriggerPipelineStageChanged
  | TriggerDealProbabilityChanged
  | TriggerDealAmountChanged
  | TriggerDealExpectedCloseChanged
  | TriggerRecommendationPublished
  | TriggerManual;

// ─── Conditions ───────────────────────────────────────────────────────
export type WorkflowConditionOp = ">" | "<" | "=" | ">=" | "<=" | "!=";

export interface ConditionLeadScore {
  type: "lead.score";
  op: WorkflowConditionOp;
  value: number;
}
export interface ConditionLeadIndustryId {
  type: "lead.industry_id";
  value: string;
}
export interface ConditionLeadCity {
  type: "lead.city";
  value: string;
}
export interface ConditionDealAmount {
  type: "deal.amount";
  op: WorkflowConditionOp;
  value: number;
}
export interface ConditionLeadTemperature {
  type: "lead.temperature";
  value: "hot" | "warm" | "cold" | "ready";
}

export type WorkflowCondition =
  | ConditionLeadScore
  | ConditionLeadIndustryId
  | ConditionLeadCity
  | ConditionDealAmount
  | ConditionLeadTemperature;

// ─── Actions ──────────────────────────────────────────────────────────
export type WorkflowActionType =
  | "send_email"
  | "send_sms"
  | "send_whatsapp"
  | "create_task"
  | "change_pipeline_stage"
  | "set_lead_status"
  | "assign_to_user"
  | "add_tag"
  | "notify_channel"
  | "wait"
  | "ai_pitch_generate";

export interface ActionSendEmail {
  type: "send_email";
  template_id: string;
  subject?: string;
}
export interface ActionSendSms {
  type: "send_sms";
  template_id: string;
}
export interface ActionSendWhatsapp {
  type: "send_whatsapp";
  template_id: string;
}
export interface ActionCreateTask {
  type: "create_task";
  title: string;
  assignee_role?: "owner" | "manager";
  due_in_days?: number;
}
export interface ActionChangePipelineStage {
  type: "change_pipeline_stage";
  stage: string;
}
export interface ActionSetLeadStatus {
  type: "set_lead_status";
  status: string;
}
export interface ActionAssignToUser {
  type: "assign_to_user";
  user_id: string;
}
export interface ActionAddTag {
  type: "add_tag";
  tag: string;
}
export interface ActionNotifyChannel {
  type: "notify_channel";
  channel: "slack" | "teams" | "email_admin";
  message_template: string;
}
export interface ActionWait {
  type: "wait";
  duration_minutes: number;
}
export interface ActionAiPitchGenerate {
  type: "ai_pitch_generate";
  save_to_notes: boolean;
}

export type WorkflowAction =
  | ActionSendEmail
  | ActionSendSms
  | ActionSendWhatsapp
  | ActionCreateTask
  | ActionChangePipelineStage
  | ActionSetLeadStatus
  | ActionAssignToUser
  | ActionAddTag
  | ActionNotifyChannel
  | ActionWait
  | ActionAiPitchGenerate;

// ─── Validators ───────────────────────────────────────────────────────
type ValidResult<T> = { ok: true; value: T } | { ok: false; error: string };

const VALID_TRIGGER_TYPES: WorkflowTriggerType[] = [
  "lead.created",
  "lead.status_changed",
  "lead.temperature_changed",
  "pipeline.stage_changed",
  "deal.probability_changed",
  "deal.amount_changed",
  "deal.expected_close_changed",
  "recommendation.published",
  "manual",
];

const VALID_ACTION_TYPES: WorkflowActionType[] = [
  "send_email",
  "send_sms",
  "send_whatsapp",
  "create_task",
  "change_pipeline_stage",
  "set_lead_status",
  "assign_to_user",
  "add_tag",
  "notify_channel",
  "wait",
  "ai_pitch_generate",
];

const VALID_OPS: WorkflowConditionOp[] = [">", "<", "=", ">=", "<=", "!="];

export function validateTrigger(
  raw: unknown,
): ValidResult<WorkflowTrigger> {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "trigger_must_be_object" };
  }
  const t = raw as { type?: unknown } & Record<string, unknown>;
  if (
    typeof t.type !== "string" ||
    !(VALID_TRIGGER_TYPES as string[]).includes(t.type)
  ) {
    return { ok: false, error: "trigger_type_invalid" };
  }
  // Trigger-spesifikk validering
  switch (t.type) {
    case "lead.status_changed":
    case "pipeline.stage_changed":
      if (typeof t.to !== "string" || t.to.length === 0)
        return { ok: false, error: "trigger_missing_to" };
      break;
    case "lead.temperature_changed":
      if (
        typeof t.to !== "string" ||
        !["hot", "warm", "cold", "ready"].includes(t.to)
      )
        return { ok: false, error: "trigger_temperature_invalid" };
      break;
  }
  return { ok: true, value: raw as WorkflowTrigger };
}

export function validateCondition(
  raw: unknown,
): ValidResult<WorkflowCondition> {
  if (!raw || typeof raw !== "object")
    return { ok: false, error: "condition_must_be_object" };
  const c = raw as { type?: unknown } & Record<string, unknown>;
  if (typeof c.type !== "string")
    return { ok: false, error: "condition_type_required" };
  switch (c.type) {
    case "lead.score":
    case "deal.amount":
      if (
        typeof c.op !== "string" ||
        !(VALID_OPS as string[]).includes(c.op)
      )
        return { ok: false, error: "condition_op_invalid" };
      if (typeof c.value !== "number")
        return { ok: false, error: "condition_value_must_be_number" };
      break;
    case "lead.industry_id":
    case "lead.city":
      if (typeof c.value !== "string" || c.value.length === 0)
        return { ok: false, error: "condition_value_required" };
      break;
    case "lead.temperature":
      if (
        typeof c.value !== "string" ||
        !["hot", "warm", "cold", "ready"].includes(c.value)
      )
        return { ok: false, error: "condition_temperature_invalid" };
      break;
    default:
      return { ok: false, error: "condition_type_unknown" };
  }
  return { ok: true, value: raw as WorkflowCondition };
}

export function validateAction(raw: unknown): ValidResult<WorkflowAction> {
  if (!raw || typeof raw !== "object")
    return { ok: false, error: "action_must_be_object" };
  const a = raw as { type?: unknown } & Record<string, unknown>;
  if (
    typeof a.type !== "string" ||
    !(VALID_ACTION_TYPES as string[]).includes(a.type)
  )
    return { ok: false, error: "action_type_invalid" };

  switch (a.type) {
    case "send_email":
    case "send_sms":
    case "send_whatsapp":
      if (typeof a.template_id !== "string" || a.template_id.length === 0)
        return { ok: false, error: "action_template_id_required" };
      break;
    case "create_task":
      if (typeof a.title !== "string" || a.title.length === 0)
        return { ok: false, error: "action_task_title_required" };
      break;
    case "change_pipeline_stage":
      if (typeof a.stage !== "string" || a.stage.length === 0)
        return { ok: false, error: "action_stage_required" };
      break;
    case "set_lead_status":
      if (typeof a.status !== "string" || a.status.length === 0)
        return { ok: false, error: "action_status_required" };
      break;
    case "assign_to_user":
      if (typeof a.user_id !== "string" || a.user_id.length === 0)
        return { ok: false, error: "action_user_id_required" };
      break;
    case "add_tag":
      if (typeof a.tag !== "string" || a.tag.length === 0)
        return { ok: false, error: "action_tag_required" };
      break;
    case "notify_channel":
      if (
        typeof a.channel !== "string" ||
        !["slack", "teams", "email_admin"].includes(a.channel)
      )
        return { ok: false, error: "action_channel_invalid" };
      if (
        typeof a.message_template !== "string" ||
        a.message_template.length === 0
      )
        return { ok: false, error: "action_message_template_required" };
      break;
    case "wait":
      if (
        typeof a.duration_minutes !== "number" ||
        a.duration_minutes <= 0 ||
        a.duration_minutes > 60 * 24 * 30 // max 30 dager
      )
        return { ok: false, error: "action_wait_duration_invalid" };
      break;
    case "ai_pitch_generate":
      if (typeof a.save_to_notes !== "boolean")
        return { ok: false, error: "action_save_to_notes_required" };
      break;
  }
  return { ok: true, value: raw as WorkflowAction };
}

export function validateWorkflowPayload(payload: {
  name?: unknown;
  trigger_type?: unknown;
  trigger_config?: unknown;
  conditions?: unknown;
  actions?: unknown;
}): ValidResult<{
  name: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}> {
  if (typeof payload.name !== "string" || payload.name.length === 0) {
    return { ok: false, error: "name_required" };
  }
  // Trigger kan komme som flatt `trigger_type` + `trigger_config` eller
  // som et nested objekt — vi normaliserer.
  let triggerCandidate: unknown;
  if (
    typeof payload.trigger_type === "string" &&
    payload.trigger_config &&
    typeof payload.trigger_config === "object"
  ) {
    triggerCandidate = {
      ...(payload.trigger_config as Record<string, unknown>),
      type: payload.trigger_type,
    };
  } else if (typeof payload.trigger_type === "string") {
    triggerCandidate = { type: payload.trigger_type };
  } else if (payload.trigger_type && typeof payload.trigger_type === "object") {
    triggerCandidate = payload.trigger_type;
  } else {
    return { ok: false, error: "trigger_required" };
  }

  const tr = validateTrigger(triggerCandidate);
  if (!tr.ok) return tr;

  const conditionsRaw = Array.isArray(payload.conditions)
    ? payload.conditions
    : [];
  const conditions: WorkflowCondition[] = [];
  for (const c of conditionsRaw) {
    const v = validateCondition(c);
    if (!v.ok) return { ok: false, error: `condition_${v.error}` };
    conditions.push(v.value);
  }

  const actionsRaw = Array.isArray(payload.actions) ? payload.actions : [];
  if (actionsRaw.length === 0)
    return { ok: false, error: "actions_required" };
  if (actionsRaw.length > 30)
    return { ok: false, error: "actions_too_many" };
  const actions: WorkflowAction[] = [];
  for (const a of actionsRaw) {
    const v = validateAction(a);
    if (!v.ok) return { ok: false, error: `action_${v.error}` };
    actions.push(v.value);
  }

  return {
    ok: true,
    value: {
      name: payload.name,
      trigger: tr.value,
      conditions,
      actions,
    },
  };
}

// ─── Action-result-type for execution-log ─────────────────────────────
export interface ActionResult {
  index: number;
  type: WorkflowActionType;
  status: "ok" | "skipped" | "error" | "deferred";
  message?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}
