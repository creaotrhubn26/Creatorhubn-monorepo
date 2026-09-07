/** Bridges canonical Leadgrid workflow events into the smaller rule engine. */
import { createHash } from "node:crypto";
import type { WorkflowEvent } from "./leadgrid-workflow-engine.js";
import {
  evaluateRulesForLead,
  type EvaluateResult,
  type TriggerEvent,
} from "./lead-rules-engine.js";

function canonicalJson(value: unknown): string {
  if (value === undefined) return JSON.stringify("__undefined__");
  if (typeof value === "number" && !Number.isFinite(value)) {
    return JSON.stringify(String(value));
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  ).join(",")}}`;
}

function mappedTrigger(type: WorkflowEvent["type"]): TriggerEvent | null {
  switch (type) {
    case "lead.created":
      return "lead_create";
    case "lead.status_changed":
      return "status_change";
    default:
      return null;
  }
}

/**
 * The same canonical event object always produces the same key.  This matters
 * because publishEvent is intentionally retryable and rule actions mutate CRM
 * state.  The opaque key contains no tenant or lead identifiers.
 */
export function ruleEventIdempotencyKey(
  event: WorkflowEvent,
  trigger: TriggerEvent,
): string {
  const fingerprint = canonicalJson({
    organizationId: event.organizationId,
    projectId: event.projectId,
    leadId: event.leadId,
    workflowEvent: event.type,
    ruleTrigger: trigger,
    data: event.data,
  });
  return `workflow-rule-${createHash("sha256").update(fingerprint).digest("hex")}`;
}

export async function dispatchRulesForWorkflowEvent(
  event: WorkflowEvent,
): Promise<EvaluateResult | null> {
  const trigger = mappedTrigger(event.type);
  if (!trigger || !event.leadId) return null;
  return evaluateRulesForLead(event.pool, {
    organizationId: event.organizationId,
    projectId: event.projectId,
    customerId: event.leadId,
    event: trigger,
    idempotencyKey: ruleEventIdempotencyKey(event, trigger),
  });
}

export const __test = { canonicalJson, mappedTrigger };
