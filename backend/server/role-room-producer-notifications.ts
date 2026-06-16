/**
 * role-room-producer-notifications.ts
 *
 * Delt, selvstendig hjelpemodul for å varsle produsent-teamet når KLIENTEN
 * gjør en handling i klient-portalen (svarer på en forespørsel, godkjenner /
 * ber om endring på en post, osv.). Tidligere ble slike handlinger lagret
 * stille i DB-en uten å varsle produsenten — som måtte polle/refreshe for å
 * oppdage dem (Creative Sync Workspace-audit, gap #1/#2).
 *
 * Hvorfor en egen modul i stedet for å gjenbruke closuren i
 * role-room-routes.ts: den der er en dyp closure (push + inbox + en rekke
 * andre closure-avhengigheter) i en ~76k-linjers, aktivt-redigert fil. Å
 * ekstrahere den ville vært en stor, risikabel refaktor. Denne modulen gjør
 * KJERNE-upserten mot SAMME tabell (`role_room_project_notifications`) med
 * SAMME dedup-nøkler, så radene er fullt kompatible med produsentens inbox
 * og varsel-API. Push-levering (web-push) er bevisst utelatt her — det
 * håndteres helhetlig i realtime-laget (cluster D).
 */
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { sendTransactionalEmail } from './transactional-email-service.js';

export type ProducerNotificationAudience = 'producer_team' | 'client' | 'all';

export interface UpsertProducerNotificationInput {
  projectId: string;
  audience: ProducerNotificationAudience;
  eventType: string;
  title: string;
  message?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: string | null;
  createdByRole?: string | null;
  /** Bruker-IDer som er @nevnt — lagres på raden så UI kan markere den for dem. */
  mentionUserIds?: string[];
  mentionEmails?: string[];
}

/** Avled inbox-kategori fra event/entity — speiler logikken i role-room-routes.ts. */
function inferInboxType(
  eventType: string,
  linkedEntityType?: string | null,
  metadata?: Record<string, unknown> | null,
): string {
  const explicit = typeof metadata?.inboxType === 'string'
    ? metadata.inboxType
    : typeof metadata?.inbox_type === 'string'
      ? metadata.inbox_type
      : '';
  const normExplicit = explicit.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  if (normExplicit && normExplicit.length <= 80) return normExplicit;

  const e = eventType.trim().toLowerCase();
  const t = String(linkedEntityType ?? '').trim().toLowerCase();
  if (e.includes('brief') || t.includes('intake')) return 'brief';
  if (e.includes('review') || e.includes('approval')) return 'approval';
  if (e.includes('material') || t.includes('material')) return 'material';
  if (e.includes('delivery') || t.includes('delivery')) return 'delivery';
  if (e.includes('request') || t.includes('request')) return 'request';
  if (e.includes('workspace') || e.includes('google')) return 'workspace';
  return 'general';
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 320) : null;
}

function extractClient(metadata?: Record<string, unknown> | null) {
  return {
    clientName: readString(metadata?.clientName ?? metadata?.client_name),
    clientEmail: (readString(metadata?.clientEmail ?? metadata?.client_email) ?? '').toLowerCase() || null,
  };
}

/**
 * Idempotent upsert av en produsent-inbox-varsling. Dedup på
 * (project, audience, event_type, linked_entity) — gjentatte handlinger på
 * samme entitet oppdaterer den eksisterende raden i stedet for å spamme.
 * Best-effort: kaster aldri videre (klient-handlingen skal aldri feile fordi
 * et varsel ikke kunne lagres).
 */
export async function upsertProducerProjectNotification(
  pool: Pool,
  input: UpsertProducerNotificationInput,
): Promise<void> {
  try {
    const {
      projectId, audience, eventType, title, message,
      linkedEntityType, linkedEntityId, metadata,
      createdByUserId, createdByRole, mentionUserIds, mentionEmails,
    } = input;
    const meta = metadata ?? {};
    const inboxType = inferInboxType(eventType, linkedEntityType, meta);
    const { clientName, clientEmail } = extractClient(meta);
    const serializedMeta = JSON.stringify(meta);
    const mentionUserIdsJson = JSON.stringify(Array.isArray(mentionUserIds) ? mentionUserIds : []);
    const mentionEmailsJson = JSON.stringify(
      (Array.isArray(mentionEmails) ? mentionEmails : []).map((e) => e.toLowerCase()),
    );
    const cleanTitle = title.trim();
    const cleanMessage = typeof message === 'string' && message.trim().length > 0 ? message.trim() : null;

    const existing = await pool.query(
      `SELECT id
         FROM role_room_project_notifications
        WHERE project_id = $1
          AND audience = $2
          AND event_type = $3
          AND COALESCE(linked_entity_type, '') = COALESCE($4, '')
          AND COALESCE(linked_entity_id, '') = COALESCE($5, '')
        ORDER BY updated_at DESC
        LIMIT 1`,
      [projectId, audience, eventType.trim(), linkedEntityType ?? null, linkedEntityId ?? null],
    );

    if ((existing.rowCount ?? 0) > 0) {
      const id = String(existing.rows[0]?.id ?? '');
      await pool.query(
        `UPDATE role_room_project_notifications
            SET title = $1, message = $2, metadata = $3::jsonb,
                created_by_user_id = $4, created_by_role = $5, inbox_type = $6,
                client_name = $7, client_email = $8,
                mention_user_ids = $9::jsonb, mention_emails = $10::jsonb,
                resolved_at = NULL, resolved_by_user_id = NULL,
                archived_at = NULL, archived_by_user_id = NULL,
                updated_at = NOW()
          WHERE id = $11`,
        [cleanTitle, cleanMessage, serializedMeta, createdByUserId ?? null,
          createdByRole ?? null, inboxType, clientName, clientEmail,
          mentionUserIdsJson, mentionEmailsJson, id],
      );
      // Nullstill lest-status så det dukker opp som ulest igjen.
      await pool.query(
        `DELETE FROM role_room_project_notification_reads WHERE notification_id = $1`,
        [id],
      );
      return;
    }

    await pool.query(
      `INSERT INTO role_room_project_notifications (
         id, project_id, audience, event_type, title, message,
         linked_entity_type, linked_entity_id, inbox_type, client_name, client_email,
         mention_user_ids, mention_emails, metadata, created_by_user_id, created_by_role,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12::jsonb, $13::jsonb, $14::jsonb, $15, $16, NOW(), NOW()
       )`,
      [randomUUID(), projectId, audience, eventType.trim(), cleanTitle, cleanMessage,
        linkedEntityType ?? null, linkedEntityId ?? null, inboxType, clientName, clientEmail,
        mentionUserIdsJson, mentionEmailsJson, serializedMeta, createdByUserId ?? null, createdByRole ?? null],
    );
  } catch (error) {
    console.warn('[producer-notifications] upsert skipped:', error);
  }
}

/**
 * Slå opp produsent-teamets e-postadresser for et prosjekt: prosjekt-eier
 * (casting_projects.created_by) + aktive team-medlemmer (casting_user_roles).
 * Speiler resolveren i marketing-preview-email-service.
 */
export async function resolveProducerTeamEmails(pool: Pool, projectId: string): Promise<string[]> {
  try {
    const { rows } = await pool.query<{ email: string }>(
      `SELECT DISTINCT u.email
         FROM users u
        WHERE u.id IN (
          SELECT created_by FROM casting_projects WHERE id = $1
          UNION
          SELECT user_id FROM casting_user_roles
           WHERE project_id = $1 AND deactivated_at IS NULL
        )
        AND u.email IS NOT NULL`,
      [projectId],
    );
    return rows.map((r) => r.email).filter((e): e is string => Boolean(e));
  } catch (error) {
    console.warn('[producer-notifications] recipient lookup failed:', error);
    return [];
  }
}

/** Slå opp e-postadresser for en liste bruker-IDer (for @mention-varsler). */
export async function resolveUserEmails(pool: Pool, userIds: string[]): Promise<string[]> {
  const ids = Array.from(new Set(userIds.filter((id) => typeof id === 'string' && id.length > 0)));
  if (ids.length === 0) return [];
  try {
    const { rows } = await pool.query<{ email: string }>(
      `SELECT DISTINCT email FROM users WHERE id = ANY($1::text[]) AND email IS NOT NULL`,
      [ids],
    );
    return rows.map((r) => r.email).filter((e): e is string => Boolean(e));
  } catch (error) {
    console.warn('[producer-notifications] user email lookup failed:', error);
    return [];
  }
}

/**
 * Best-effort e-post til hele produsent-teamet. Brukes sammen med
 * upsertProducerProjectNotification for klient-handlinger som ikke allerede
 * har en dedikert e-post-mal.
 */
export async function notifyProducerTeamByEmail(
  pool: Pool,
  args: { projectId: string; subject: string; html: string; text: string; kind: string },
): Promise<number> {
  const recipients = await resolveProducerTeamEmails(pool, args.projectId);
  return sendToRecipients(pool, recipients, args);
}

/** Best-effort e-post til en eksplisitt liste bruker-IDer (f.eks. @nevnte). */
export async function notifyUsersByEmail(
  pool: Pool,
  args: { projectId: string; userIds: string[]; subject: string; html: string; text: string; kind: string },
): Promise<number> {
  const recipients = await resolveUserEmails(pool, args.userIds);
  return sendToRecipients(pool, recipients, args);
}

async function sendToRecipients(
  pool: Pool,
  recipients: string[],
  args: { projectId: string; subject: string; html: string; text: string; kind: string },
): Promise<number> {
  let sent = 0;
  for (const to of recipients) {
    try {
      const result = await sendTransactionalEmail({
        to,
        subject: args.subject,
        html: args.html,
        text: args.text,
        kind: args.kind,
        projectId: args.projectId,
        pool,
        fromLabel: 'The Role Room',
      });
      if (result.sent) sent += 1;
    } catch (error) {
      console.warn('[producer-notifications] email send failed:', error);
    }
  }
  return sent;
}
