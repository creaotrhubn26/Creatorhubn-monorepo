import type { DbClient } from '../db/pool.js';
import { newId } from '../shared/ids.js';

/**
 * Revisjonslogg. Skrives i SAMME transaksjon som endringen den beskriver,
 * slik at logg og endring aldri kan komme ut av synk.
 * Tabellen er append-only (håndhevet av database-triggere).
 */
export interface Actor {
  userId: string;
  role: string;
}

export interface AuditEventInput {
  organizationId: string;
  actor: Actor | null; // null = systemhandling
  action: string; // f.eks. 'journal_entry.posted'
  entityType: string;
  entityId?: string;
  reason?: string;
  previousValue?: unknown;
  newValue?: unknown;
}

export async function recordAuditEvent(client: DbClient, event: AuditEventInput): Promise<string> {
  const id = newId();
  await client.query(
    `INSERT INTO audit_events
       (id, organization_id, actor_user_id, actor_role, action, entity_type, entity_id, reason, previous_value, new_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      event.organizationId,
      event.actor?.userId ?? null,
      event.actor?.role ?? null,
      event.action,
      event.entityType,
      event.entityId ?? null,
      event.reason ?? null,
      event.previousValue === undefined ? null : JSON.stringify(event.previousValue),
      event.newValue === undefined ? null : JSON.stringify(event.newValue),
    ],
  );
  return id;
}
