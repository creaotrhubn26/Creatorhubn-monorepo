import type { Pool } from "pg";

/**
 * Project-scoped audit log. Writes a single row every time something
 * noteworthy happens on a project (client hearts an asset, signs a
 * quote, signs a contract, comments). Two readers:
 *
 *   1. iPad ``ChangeLogView`` — shows a timeline on the Context
 *      panel so the photographer lands on-site already aware of
 *      what the client liked / disliked.
 *   2. Web dashboard — future "activity feed" per project.
 *
 * Design notes:
 *   * ``kind`` is the same discriminator as ``UserEvent.kind`` on
 *     the realtime channel, so the UI can reuse a single
 *     translator for both streams.
 *   * ``payload`` is JSONB — free-form per kind. Keeps the schema
 *     stable as we add new event kinds.
 *   * ``actor_kind`` (``client`` vs ``photographer``) separates
 *     client activity from internal edits so the photographer
 *     doesn't see their own keystrokes echoed.
 *   * Inserts are best-effort: a broken log write must NEVER bring
 *     down the primary action (e.g. heart save). Callers wrap in
 *     try/catch and only log the error.
 */

/**
 * Hendelsestypene et prosjekt kan logge. Samme streng brukes som
 * ``event_type`` i ``project_notifications`` og som ``kind`` her, slik at
 * innboksen, aktivitetsfeeden og iPad-ens ChangeLogView deler ordforråd.
 * Utvidet fra de fire klient-hendelsene da workspace-varslene kom til.
 */
export type ProjectChangeKind =
  | "asset.hearted"
  | "asset.commented"
  | "quote.signed"
  | "contract.signed"
  | "task.assigned"
  | "task.completed"
  | "task.created"
  | "chat.mention"
  | "deliverable.created"
  | "deliverable.file-added"
  | "deliverable.due-soon"
  | "deliverable.completed";

export type ProjectChangeActorKind = "client" | "photographer";

export interface ProjectChangeLogEntry {
  id: string;
  projectId: string;
  kind: ProjectChangeKind;
  actorKind: ProjectChangeActorKind;
  actorLabel: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export async function ensureProjectChangeLogSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_change_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id VARCHAR(255) NOT NULL,
      kind VARCHAR(50) NOT NULL,
      actor_kind VARCHAR(20) NOT NULL,
      actor_label VARCHAR(255),
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS project_change_log_project_created_idx
      ON project_change_log (project_id, created_at DESC);
  `);
}

/// Insert a row. Swallows nothing — callers decide whether a
/// missing project_id should be fatal (for a project-bound event
/// it's a bug) vs silently skipped (for a capture session that
/// isn't attached to a project yet).
export async function recordProjectChange(
  pool: Pool,
  params: {
    projectId: string;
    kind: ProjectChangeKind;
    actorKind: ProjectChangeActorKind;
    actorLabel: string | null;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await ensureProjectChangeLogSchema(pool);
  await pool.query(
    `INSERT INTO project_change_log
       (project_id, kind, actor_kind, actor_label, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      params.projectId,
      params.kind,
      params.actorKind,
      params.actorLabel,
      JSON.stringify(params.payload ?? {}),
    ],
  );
}

/// List the most recent entries for a project. Keyset pagination via
/// ``before`` (an ISO timestamp) so the iPad can scroll back through
/// months of history without `LIMIT $N OFFSET $M` blowing out on
/// long-running projects.
export async function listProjectChangeLog(
  pool: Pool,
  params: {
    projectId: string;
    limit?: number;
    before?: string | null;
  },
): Promise<ProjectChangeLogEntry[]> {
  await ensureProjectChangeLogSchema(pool);
  const limit = Math.min(Math.max(Number(params.limit ?? 50), 1), 200);
  const rows = params.before
    ? await pool.query(
        `SELECT id, project_id, kind, actor_kind, actor_label, payload, created_at
         FROM project_change_log
         WHERE project_id = $1 AND created_at < $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [params.projectId, new Date(params.before), limit],
      )
    : await pool.query(
        `SELECT id, project_id, kind, actor_kind, actor_label, payload, created_at
         FROM project_change_log
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [params.projectId, limit],
      );
  return rows.rows.map(mapRow);
}

function mapRow(row: any): ProjectChangeLogEntry {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    kind: row.kind,
    actorKind: row.actor_kind,
    actorLabel: row.actor_label ?? null,
    payload:
      row.payload && typeof row.payload === "object" ? row.payload : {},
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

/**
 * Human-readable one-line summary. Pure so the same text renders
 * server-side (email digests, notifications) + client-side (iPad
 * timeline, web activity feed). Exposed separately so tests can
 * pin the exact phrasing.
 */
export function humanizeChangeLogEntry(entry: {
  kind: ProjectChangeKind;
  actorKind: ProjectChangeActorKind;
  actorLabel: string | null;
  payload: Record<string, unknown>;
}): string {
  const actor = entry.actorLabel?.trim() || fallbackActor(entry.actorKind);
  switch (entry.kind) {
    case "asset.hearted": {
      const hearted = Boolean(entry.payload?.hearted ?? true);
      return hearted
        ? `${actor} hjertet et bilde`
        : `${actor} fjernet hjerte fra et bilde`;
    }
    case "asset.commented": {
      const preview = typeof entry.payload?.preview === "string"
        ? entry.payload.preview.trim()
        : "";
      return preview.length > 0
        ? `${actor} kommenterte: "${truncate(preview, 80)}"`
        : `${actor} la igjen en kommentar`;
    }
    case "quote.signed":
      return `${actor} signerte tilbudet`;
    case "contract.signed":
      return `${actor} signerte kontrakten`;
    case "task.created":
      return `${actor} la til «${text(entry.payload?.title)}»`;
    case "task.assigned":
      return `${actor} tildelte «${text(entry.payload?.title)}» til ${text(entry.payload?.assigneeName, "et teammedlem")}`;
    case "task.completed":
      return `${actor} fullførte «${text(entry.payload?.title)}»`;
    case "chat.mention":
      return `${actor} nevnte deg i chatten`;
    case "deliverable.created":
      return `${actor} opprettet leveransen «${text(entry.payload?.title)}»`;
    case "deliverable.file-added":
      return `${actor} la en fil på «${text(entry.payload?.title)}»`;
    case "deliverable.due-soon":
      return `«${text(entry.payload?.title)}» har frist ${text(entry.payload?.dueLabel, "snart")}`;
    case "deliverable.completed":
      return `${actor} leverte «${text(entry.payload?.title)}»`;
    default:
      return `${actor} utførte en handling`;
  }
}

function fallbackActor(kind: ProjectChangeActorKind): string {
  return kind === "client" ? "Klienten" : "Fotografen";
}

function text(value: unknown, fallback = "noe"): string {
  return typeof value === "string" && value.trim() ? truncate(value.trim(), 80) : fallback;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}
