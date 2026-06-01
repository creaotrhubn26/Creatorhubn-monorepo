/**
 * dance_formation_timeline_item — time-anchored notes + movements for
 * koreografi-timeline. Workflow-audit G18.
 *
 * Tabell-schema: migrasjon 214. Tjenesten følger samme pattern som
 * dance-formation-service.ts (eier-scope + projectId, snake_case-DB-felter
 * mappet til camelCase-API-felter).
 */
import type { Pool } from 'pg';

export type TimelineItemKind = 'note' | 'movement';

export interface TimelineItemInput {
  kind: TimelineItemKind;
  label: string;
  startSec: number;
  endSec: number;
  projectId?: string | null;
  formationId?: string | null;
  targetDancerIds?: string[];
  displayOrder?: number;
}

export interface TimelineItemPatch extends Partial<TimelineItemInput> {}

export interface TimelineItemRecord {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  kind: TimelineItemKind;
  label: string;
  startSec: number;
  endSec: number;
  formationId: string | null;
  targetDancerIds: string[];
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Mapping ────────────────────────────────────────────────────────────

function isoTs(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function asNumberOr(value: unknown, fallback: number): number {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asKind(value: unknown): TimelineItemKind {
  return value === 'movement' ? 'movement' : 'note';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function mapRow(row: Record<string, unknown>): TimelineItemRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    kind: asKind(row.kind),
    label: String(row.label),
    startSec: asNumberOr(row.start_sec, 0),
    endSec: asNumberOr(row.end_sec, 0),
    formationId: row.formation_id == null ? null : String(row.formation_id),
    targetDancerIds: asStringArray(row.target_dancer_ids),
    displayOrder: asNumberOr(row.display_order, 0),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function generateId(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return `tli_${globalThis.crypto.randomUUID()}`;
  }
  return `tli_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── CRUD ───────────────────────────────────────────────────────────────

export interface ListTimelineItemsOptions {
  projectId?: string | null;
  kind?: TimelineItemKind;
  limit?: number;
}

export async function listTimelineItems(
  pool: Pool,
  ownerUserId: string,
  options: ListTimelineItemsOptions = {},
): Promise<TimelineItemRecord[]> {
  const safeLimit = Math.max(1, Math.min(500, options.limit ?? 200));
  const filterProject = typeof options.projectId === 'string' && options.projectId.length > 0;
  const filterKind = options.kind === 'note' || options.kind === 'movement';

  const where: string[] = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];

  if (filterProject) {
    params.push(options.projectId);
    where.push(`(project_id = $${params.length} OR project_id IS NULL)`);
  }
  if (filterKind) {
    params.push(options.kind);
    where.push(`kind = $${params.length}`);
  }

  params.push(safeLimit);

  const { rows } = await pool.query(
    `SELECT *
     FROM dance_formation_timeline_item
     WHERE ${where.join(' AND ')}
     ORDER BY start_sec ASC, display_order ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => mapRow(r));
}

export async function getTimelineItem(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<TimelineItemRecord | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_formation_timeline_item
     WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function createTimelineItem(
  pool: Pool,
  ownerUserId: string,
  input: TimelineItemInput,
): Promise<TimelineItemRecord> {
  const id = generateId();
  const { rows } = await pool.query(
    `INSERT INTO dance_formation_timeline_item (
       id, owner_user_id, project_id, kind, label,
       start_sec, end_sec, formation_id,
       target_dancer_ids, display_order
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      id, ownerUserId,
      input.projectId ?? null,
      input.kind,
      input.label,
      input.startSec,
      input.endSec,
      input.formationId ?? null,
      JSON.stringify(input.targetDancerIds ?? []),
      input.displayOrder ?? 0,
    ],
  );
  return mapRow(rows[0]);
}

export async function patchTimelineItem(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: TimelineItemPatch,
): Promise<TimelineItemRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];

  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.kind !== undefined) push('kind', patch.kind);
  if (patch.label !== undefined) push('label', patch.label);
  if (patch.startSec !== undefined) push('start_sec', patch.startSec);
  if (patch.endSec !== undefined) push('end_sec', patch.endSec);
  if (patch.formationId !== undefined) push('formation_id', patch.formationId);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (patch.targetDancerIds !== undefined) push('target_dancer_ids', JSON.stringify(patch.targetDancerIds));
  if (patch.displayOrder !== undefined) push('display_order', patch.displayOrder);

  if (sets.length === 0) return getTimelineItem(pool, ownerUserId, id);

  sets.push('updated_at = now()');

  const { rows } = await pool.query(
    `UPDATE dance_formation_timeline_item
     SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function deleteTimelineItem(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_formation_timeline_item
     WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}
