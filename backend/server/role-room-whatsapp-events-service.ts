// Strukturert prosessering av Meta WhatsApp webhook-events.
//
// Tar full Meta webhook-payload, flater den til én rad per "atomisk"
// event (én status-oppdatering, én incoming-melding, ett template-
// status-skifte, etc.), og lagrer strukturert i role_room_whatsapp_events.
//
// I tillegg dispatcher domain-spesifikke handlers:
//   - messages.statuses → casting_whatsapp_usage.conversation_id
//
// Returnerer summary for logging.

import type { Pool } from "pg";

export interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: Record<string, unknown>;
    }>;
  }>;
}

export interface ProcessedEventRow {
  eventField: string;
  eventSubtype: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  messageId: string | null;
  templateName: string | null;
  payload: Record<string, unknown>;
}

export interface ProcessSummary {
  totalRows: number;
  byField: Record<string, number>;
  errors: string[];
}

export function flattenWebhookEvents(
  payload: MetaWebhookPayload,
): ProcessedEventRow[] {
  const rows: ProcessedEventRow[] = [];
  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    const wabaId = typeof entry.id === "string" ? entry.id : null;
    const changes = entry.changes ?? [];
    for (const change of changes) {
      const field = (change.field || "").trim();
      if (!field) continue;
      const value = (change.value ?? {}) as Record<string, unknown>;

      if (field === "messages") {
        // Split inn separate rader for hver status + hver inbound-melding
        const phoneNumberId = extractPhoneNumberId(value);
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        for (const status of statuses as Array<Record<string, unknown>>) {
          rows.push({
            eventField: field,
            eventSubtype: typeof status.status === "string" ? status.status : null,
            wabaId,
            phoneNumberId,
            messageId: typeof status.id === "string" ? status.id : null,
            templateName: null,
            payload: status,
          });
        }
        const messages = Array.isArray(value.messages) ? value.messages : [];
        for (const message of messages as Array<Record<string, unknown>>) {
          rows.push({
            eventField: field,
            eventSubtype: "inbound",
            wabaId,
            phoneNumberId,
            messageId: typeof message.id === "string" ? message.id : null,
            templateName: null,
            payload: message,
          });
        }
        const errors = Array.isArray(value.errors) ? value.errors : [];
        for (const error of errors as Array<Record<string, unknown>>) {
          rows.push({
            eventField: field,
            eventSubtype: "error",
            wabaId,
            phoneNumberId,
            messageId: null,
            templateName: null,
            payload: error,
          });
        }
        if (!statuses.length && !messages.length && !errors.length) {
          // Fallback: log hele value-objektet uansett
          rows.push({
            eventField: field,
            eventSubtype: null,
            wabaId,
            phoneNumberId,
            messageId: null,
            templateName: null,
            payload: value,
          });
        }
      } else if (
        field === "message_template_status_update" ||
        field === "message_template_quality_update" ||
        field === "template_category_update"
      ) {
        rows.push({
          eventField: field,
          eventSubtype: extractTemplateEventSubtype(field, value),
          wabaId,
          phoneNumberId: null,
          messageId: null,
          templateName:
            typeof value.message_template_name === "string"
              ? value.message_template_name
              : null,
          payload: value,
        });
      } else if (
        field === "phone_number_quality_update" ||
        field === "phone_number_name_update"
      ) {
        rows.push({
          eventField: field,
          eventSubtype: typeof value.event === "string" ? value.event : null,
          wabaId,
          phoneNumberId:
            typeof value.id === "string" ? value.id : extractPhoneNumberId(value),
          messageId: null,
          templateName: null,
          payload: value,
        });
      } else {
        // Generic: account_alerts, account_review_update, account_update,
        // business_capability_update, business_status_update,
        // partner_solution_provider_update, security, etc.
        rows.push({
          eventField: field,
          eventSubtype: extractGenericSubtype(value),
          wabaId,
          phoneNumberId: null,
          messageId: null,
          templateName: null,
          payload: value,
        });
      }
    }
  }
  return rows;
}

function extractPhoneNumberId(value: Record<string, unknown>): string | null {
  const metadata = (value.metadata ?? {}) as Record<string, unknown>;
  if (typeof metadata.phone_number_id === "string") return metadata.phone_number_id;
  if (typeof value.phone_number_id === "string") return value.phone_number_id as string;
  return null;
}

function extractTemplateEventSubtype(
  field: string,
  value: Record<string, unknown>,
): string | null {
  if (field === "message_template_status_update") {
    if (typeof value.event === "string") return value.event;
  }
  if (field === "message_template_quality_update") {
    if (typeof value.new_quality_score === "string") return value.new_quality_score;
  }
  if (field === "template_category_update") {
    if (typeof value.new_category === "string") return value.new_category;
  }
  return null;
}

function extractGenericSubtype(value: Record<string, unknown>): string | null {
  if (typeof value.event === "string") return value.event;
  if (typeof value.alert_severity === "string") return value.alert_severity;
  if (typeof value.decision === "string") return value.decision;
  if (typeof value.entity_type === "string") return value.entity_type;
  return null;
}

export async function persistWebhookEvents(
  pool: Pool,
  payload: MetaWebhookPayload,
): Promise<ProcessSummary> {
  const rows = flattenWebhookEvents(payload);
  const summary: ProcessSummary = { totalRows: 0, byField: {}, errors: [] };

  for (const row of rows) {
    try {
      await pool.query(
        `INSERT INTO role_room_whatsapp_events
           (event_field, event_subtype, waba_id, phone_number_id,
            message_id, template_name, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          row.eventField,
          row.eventSubtype,
          row.wabaId,
          row.phoneNumberId,
          row.messageId,
          row.templateName,
          JSON.stringify(row.payload),
        ],
      );
      summary.totalRows += 1;
      summary.byField[row.eventField] = (summary.byField[row.eventField] || 0) + 1;
    } catch (error) {
      summary.errors.push(
        `${row.eventField}/${row.eventSubtype ?? ""}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Domain-spesifikke handlers — kjør best-effort etter persist
  await dispatchDomainHandlers(pool, rows);

  return summary;
}

async function dispatchDomainHandlers(
  pool: Pool,
  rows: ProcessedEventRow[],
): Promise<void> {
  for (const row of rows) {
    if (
      row.eventField === "messages" &&
      row.messageId &&
      row.eventSubtype &&
      ["sent", "delivered", "read", "failed"].includes(row.eventSubtype)
    ) {
      try {
        const conversationId = extractConversationId(row.payload);
        await pool.query(
          `UPDATE casting_whatsapp_usage
             SET conversation_id = COALESCE(conversation_id, $2)
           WHERE whatsapp_message_id = $1`,
          [row.messageId, conversationId],
        );

        // Mark threshold-rad i casting_team_whatsapp_invites også
        await pool.query(
          `UPDATE casting_team_whatsapp_invites
             SET delivery_status = $2
           WHERE whatsapp_message_id = $1`,
          [row.messageId, row.eventSubtype === "failed" ? "failed" : "delivered"],
        );
      } catch (error) {
        console.warn("[wa-events] domain handler failed for messages.status", {
          messageId: row.messageId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (
      row.eventField === "message_template_status_update" &&
      row.templateName &&
      row.eventSubtype
    ) {
      try {
        await pool.query(
          `UPDATE role_room_org_whatsapp_config
             SET last_validation_error = CASE
               WHEN $2 IN ('REJECTED','DISABLED','PAUSED') THEN $3
               ELSE last_validation_error
             END,
                 updated_at = NOW()
           WHERE template_24h_name = $1 OR template_1h_name = $1`,
          [
            row.templateName,
            row.eventSubtype,
            `template ${row.templateName}: ${row.eventSubtype}`,
          ],
        );
      } catch (error) {
        console.warn("[wa-events] domain handler failed for template-status", {
          templateName: row.templateName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

function extractConversationId(payload: Record<string, unknown>): string | null {
  const conversation = payload.conversation as Record<string, unknown> | undefined;
  if (conversation && typeof conversation.id === "string") return conversation.id;
  return null;
}
