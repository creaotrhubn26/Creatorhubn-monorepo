/**
 * project-notifications.ts — hendelsesinnboksen for CreatorHub-workspace.
 *
 * ÉN skrivevei: `notify()`. Alt som vil varsle noen kaller den, og ingenting
 * annet skriver til `project_notifications`. Det er hele poenget — uten et
 * felles kallsted ender vi med fem varianter som hver har sin egen idé om hvem
 * som skal ha beskjed og hvem som skal slippe.
 *
 * `notify()` gjør tre ting, i denne rekkefølgen:
 *   1. Løser mottakerne mot prosjektets faktiske team (`projectTeamRecipients`),
 *      trekker fra den som utløste hendelsen, og avbryter hvis lista er tom.
 *      En som ikke har tilgang kan derfor aldri bli mottaker, uansett hva
 *      kallstedet ber om.
 *   2. Skriver varselraden + én mottakerrad per mottaker i én transaksjon.
 *   3. Kringkaster `project.notification` via `broadcastUserEvent`. Steget er
 *      best-effort: raden er allerede committet, og en død socket eller en
 *      Redis-hikke skal ikke gjøre varselet usynlig i innboksen.
 *
 * Aktivitetsfeeden leser de samme radene — ingen egen hendelseslogg. I tillegg
 * speiles hendelsen til `project_change_log`, som iPad-ens ChangeLogView alt
 * leser, siden `kind`-vokabularet nå er felles.
 */

import type { Pool } from "pg";
import { broadcastUserEvent } from "./realtime-user-events";
import { projectTeamRecipients } from "./project-recipients";
import { recordProjectChange, type ProjectChangeKind } from "./project-change-log";

export type ProjectNotificationAudience = "team" | "client" | "external";

/** Hendelsestypene som faktisk gir et varsel — bevisst få. */
export type ProjectNotificationEventType = Extract<
  ProjectChangeKind,
  "task.assigned" | "chat.mention" | "deliverable.file-added" | "deliverable.due-soon"
>;

export interface ProjectNotification {
  id: string;
  projectId: string;
  audience: ProjectNotificationAudience;
  eventType: string;
  title: string;
  message: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdByLabel: string | null;
  assignedToUserId: string | null;
  assignedToLabel: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  /** Kun satt når raden leses for en bestemt bruker. */
  readAt?: string | null;
}

export interface NotifyParams {
  projectId: string;
  eventType: ProjectNotificationEventType;
  title: string;
  message?: string | null;
  audience?: ProjectNotificationAudience;
  /** Utløseren. Blir aldri mottaker av sitt eget varsel. */
  actorUserId?: string | null;
  actorLabel?: string | null;
  /** Eksplisitte mottakere. Utelatt/`null` = hele prosjektteamet. */
  recipientUserIds?: string[] | null;
  assignedToUserId?: string | null;
  assignedToLabel?: string | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
  dueAt?: string | Date | null;
  metadata?: Record<string, unknown>;
  /**
   * Logisk hendelsesnøkkel. Er den satt og allerede brukt, gjør `notify()`
   * ingenting og returnerer `null` — samme rad kan ikke oppstå to ganger.
   */
  dedupeKey?: string | null;
}

export interface NotifyResult {
  id: string;
  recipientUserIds: string[];
}

let schemaReady: Promise<void> | null = null;

/**
 * Sikkerhetsnett for miljøer der migrasjonen ikke har kjørt enda (dev, test).
 * Speiler `0603_project_notifications.sql`; migrasjonen er fasiten.
 */
export async function ensureProjectNotificationSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const statements = [
        `CREATE TABLE IF NOT EXISTS project_notifications (
           id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           project_id          VARCHAR(64) NOT NULL,
           audience            VARCHAR(32) NOT NULL DEFAULT 'team',
           event_type          VARCHAR(100) NOT NULL,
           title               VARCHAR(255) NOT NULL,
           message             TEXT,
           linked_entity_type  VARCHAR(100),
           linked_entity_id    VARCHAR(255),
           metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
           created_by_user_id  VARCHAR(64),
           created_by_label    VARCHAR(255),
           assigned_to_user_id VARCHAR(64),
           assigned_to_label   VARCHAR(255),
           due_at              TIMESTAMPTZ,
           resolved_at         TIMESTAMPTZ,
           resolved_by_user_id VARCHAR(64),
           archived_at         TIMESTAMPTZ,
           archived_by_user_id VARCHAR(64),
           dedupe_key          VARCHAR(255),
           created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
         )`,
        `CREATE INDEX IF NOT EXISTS idx_project_notifications_project
           ON project_notifications (project_id, created_at DESC) WHERE archived_at IS NULL`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_project_notifications_dedupe
           ON project_notifications (dedupe_key) WHERE dedupe_key IS NOT NULL`,
        `CREATE TABLE IF NOT EXISTS project_notification_recipients (
           notification_id UUID NOT NULL REFERENCES project_notifications(id) ON DELETE CASCADE,
           user_id         VARCHAR(64) NOT NULL,
           read_at         TIMESTAMPTZ,
           PRIMARY KEY (notification_id, user_id)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_project_notification_recipients_unread
           ON project_notification_recipients (user_id) WHERE read_at IS NULL`,
      ];
      // Hver setning for seg, som i project-workspace-routes: en kollisjon på
      // én indeks skal ikke rive med seg tabellen.
      for (const statement of statements) {
        await pool.query(statement).catch(() => undefined);
      }
    })();
  }
  return schemaReady;
}

/** Kun for tester — tvinger neste kall til å kjøre DDL på nytt. */
export function resetProjectNotificationSchemaCache(): void {
  schemaReady = null;
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Skriv varselet og lever det. Returnerer `null` når ingen skal ha beskjed
 * (tom mottakerliste, eller en dedupe-nøkkel som allerede finnes).
 */
export async function notify(
  pool: Pool,
  params: NotifyParams,
): Promise<NotifyResult | null> {
  const projectId = String(params.projectId ?? "").trim();
  const title = String(params.title ?? "").trim();
  if (!projectId || !title) return null;

  await ensureProjectNotificationSchema(pool);

  // Mottakerne må ligge i prosjektets team. Et kallsted som ber om en
  // vilkårlig bruker får den filtrert bort her, ikke i hvert kallsted.
  const team = await projectTeamRecipients(pool, projectId);
  const actorUserId = params.actorUserId ? String(params.actorUserId) : null;
  const requested = params.recipientUserIds
    ? new Set(params.recipientUserIds.filter(Boolean).map(String))
    : null;
  const recipients = team
    .filter((member) => (requested ? requested.has(member.userId) : true))
    .filter((member) => member.userId !== actorUserId);
  if (recipients.length === 0) return null;

  const client = await pool.connect();
  let notificationId: string;
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO project_notifications
         (project_id, audience, event_type, title, message,
          linked_entity_type, linked_entity_id, metadata,
          created_by_user_id, created_by_label,
          assigned_to_user_id, assigned_to_label, due_at, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        projectId,
        params.audience ?? "team",
        params.eventType,
        title.slice(0, 255),
        params.message ?? null,
        params.linkedEntityType ?? null,
        params.linkedEntityId ?? null,
        JSON.stringify(params.metadata ?? {}),
        actorUserId,
        params.actorLabel ?? null,
        params.assignedToUserId ?? null,
        params.assignedToLabel ?? null,
        toIso(params.dueAt),
        params.dedupeKey ?? null,
      ],
    );
    if (!inserted.rows[0]) {
      // Dedupe-treff — hendelsen er allerede varslet.
      await client.query("ROLLBACK");
      return null;
    }
    notificationId = String(inserted.rows[0].id);
    await client.query(
      `INSERT INTO project_notification_recipients (notification_id, user_id)
       SELECT $1, UNNEST($2::text[])
       ON CONFLICT DO NOTHING`,
      [notificationId, recipients.map((r) => r.userId)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const timestamp = new Date().toISOString();
  // Fra og med her er raden trygg. Alt under er best-effort: sviktende
  // levering skal aldri kunne slette et varsel som står i innboksen.
  for (const recipient of recipients) {
    try {
      broadcastUserEvent(recipient.userId, {
        kind: "project.notification",
        projectId,
        notificationId,
        eventType: params.eventType,
        title,
        timestamp,
      });
    } catch (error) {
      console.error(
        "[project-notifications] broadcast failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  void recordProjectChange(pool, {
    projectId,
    kind: params.eventType,
    actorKind: "photographer",
    actorLabel: params.actorLabel ?? null,
    payload: { title, ...(params.metadata ?? {}) },
  }).catch(() => undefined);

  return { id: notificationId, recipientUserIds: recipients.map((r) => r.userId) };
}

function mapRow(row: any): ProjectNotification {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    audience: row.audience,
    eventType: row.event_type,
    title: row.title,
    message: row.message ?? null,
    linkedEntityType: row.linked_entity_type ?? null,
    linkedEntityId: row.linked_entity_id ?? null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdByUserId: row.created_by_user_id ?? null,
    createdByLabel: row.created_by_label ?? null,
    assignedToUserId: row.assigned_to_user_id ?? null,
    assignedToLabel: row.assigned_to_label ?? null,
    dueAt: toIso(row.due_at),
    resolvedAt: toIso(row.resolved_at),
    archivedAt: toIso(row.archived_at),
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
    ...(row.read_at !== undefined ? { readAt: toIso(row.read_at) } : {}),
  };
}

/** Brukerens innboks på tvers av prosjekter, nyeste først. */
export async function listUserInbox(
  pool: Pool,
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<{ notifications: ProjectNotification[]; unreadCount: number }> {
  if (!userId) return { notifications: [], unreadCount: 0 };
  await ensureProjectNotificationSchema(pool);
  const limit = Math.min(Math.max(Number(options.limit ?? 30), 1), 100);
  const rows = await pool.query(
    `SELECT n.*, r.read_at
       FROM project_notification_recipients r
       JOIN project_notifications n ON n.id = r.notification_id
      WHERE r.user_id = $1
        AND n.archived_at IS NULL
        AND ($2::boolean IS NOT TRUE OR r.read_at IS NULL)
      ORDER BY n.created_at DESC
      LIMIT $3`,
    [userId, options.unreadOnly === true, limit],
  );
  const unread = await pool.query(
    `SELECT COUNT(*)::int AS c
       FROM project_notification_recipients r
       JOIN project_notifications n ON n.id = r.notification_id
      WHERE r.user_id = $1 AND r.read_at IS NULL AND n.archived_at IS NULL`,
    [userId],
  );
  return {
    notifications: rows.rows.map(mapRow),
    unreadCount: Number(unread.rows[0]?.c ?? 0),
  };
}

/** Nylig aktivitet i ett prosjekt — de samme radene, uten mottakerfilter. */
export async function listProjectActivity(
  pool: Pool,
  projectId: string,
  options: { limit?: number; audiences?: ProjectNotificationAudience[] } = {},
): Promise<ProjectNotification[]> {
  if (!projectId) return [];
  await ensureProjectNotificationSchema(pool);
  const limit = Math.min(Math.max(Number(options.limit ?? 30), 1), 100);
  const audiences = options.audiences ?? ["team"];
  const rows = await pool.query(
    `SELECT * FROM project_notifications
      WHERE project_id = $1 AND archived_at IS NULL AND audience = ANY($2::text[])
      ORDER BY created_at DESC
      LIMIT $3`,
    [projectId, audiences, limit],
  );
  return rows.rows.map(mapRow);
}

/**
 * Merk ett varsel som lest. Idempotent: `read_at` settes bare første gang, så
 * en gjenåpnet melding ikke hopper tilbake til ulest med nytt tidsstempel.
 */
export async function markNotificationRead(
  pool: Pool,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  if (!userId || !notificationId) return false;
  await ensureProjectNotificationSchema(pool);
  const result = await pool.query(
    `UPDATE project_notification_recipients
        SET read_at = NOW()
      WHERE notification_id = $1 AND user_id = $2 AND read_at IS NULL`,
    [notificationId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markAllNotificationsRead(
  pool: Pool,
  userId: string,
): Promise<number> {
  if (!userId) return 0;
  await ensureProjectNotificationSchema(pool);
  const result = await pool.query(
    `UPDATE project_notification_recipients
        SET read_at = NOW()
      WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
  return result.rowCount ?? 0;
}

/** Dager fram i tid en frist regnes som «nærmer seg». */
export const DUE_SOON_DAYS = 3;

/**
 * Statusene som betyr «ferdig» for en leveranse. Samme sett som
 * `LeveranserTab.tsx` filtrerer på — en levert leveranse skal ikke mase om
 * frist. Fire verdier fordi flaten har samlet på synonymer over tid.
 */
export const DELIVERABLE_CLOSED_STATUSES = [
  "delivered",
  "done",
  "completed",
  "archived",
] as const;

/**
 * Fristvarsler uten scheduler: sveipes når noen leser innboksen eller åpner
 * prosjektet. `dedupe_key` gjør sveipen idempotent, så uansett hvor mange på
 * teamet som åpner bjella blir det én rad per leveranse per forfallsdato.
 *
 * ponytail: lesetids-sveip framfor cron. Trenger vi varsel på et prosjekt
 * ingen har åpnet på en uke, flytt kallet inn i en cron — funksjonen er
 * uendret, bare kallstedet bytter.
 */
export async function sweepDueSoonDeliverables(
  pool: Pool,
  projectId: string,
): Promise<void> {
  if (!projectId) return;
  try {
    const due = await pool.query(
      `SELECT id, title, due_date
         FROM project_workspace_deliverables
        WHERE project_id = $1
          AND due_date IS NOT NULL
          AND status <> ALL($3::text[])
          AND due_date <= (CURRENT_DATE + ($2 || ' days')::interval)
          AND due_date >= CURRENT_DATE
        LIMIT 20`,
      [projectId, String(DUE_SOON_DAYS), [...DELIVERABLE_CLOSED_STATUSES]],
    );
    for (const row of due.rows) {
      const dueLabel = new Date(row.due_date).toISOString().slice(0, 10);
      await notify(pool, {
        projectId,
        eventType: "deliverable.due-soon",
        title: `Frist nærmer seg: ${row.title}`,
        message: `Leveransen «${row.title}» har frist ${dueLabel}.`,
        linkedEntityType: "deliverable",
        linkedEntityId: String(row.id),
        dueAt: new Date(row.due_date).toISOString(),
        metadata: { title: row.title, dueLabel },
        dedupeKey: `deliverable.due-soon:${row.id}:${dueLabel}`,
      }).catch(() => undefined);
    }
  } catch {
    // Sveipen er en bonus på lesestien. Feiler den, skal innboksen svare.
  }
}
