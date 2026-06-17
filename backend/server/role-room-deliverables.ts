/**
 * role-room-deliverables.ts
 *
 * Datamodell + CRUD for strukturerte leveranser per Role Room-prosjekt
 * (data-gap #2). Status-flyt: draft → internal_review → client_review →
 * delivered. delivered_at settes automatisk når status går til 'delivered'
 * og nullstilles hvis den flyttes tilbake.
 */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export type DeliverableStatus =
  | 'draft'
  | 'internal_review'
  | 'client_review'
  | 'delivered';

export type DeliverablePhase = 'preproduction' | 'production' | 'postproduction';

export const DELIVERABLE_STATUSES: readonly DeliverableStatus[] = [
  'draft', 'internal_review', 'client_review', 'delivered',
];
const DELIVERABLE_PHASES: readonly DeliverablePhase[] = [
  'preproduction', 'production', 'postproduction',
];

export interface RoleRoomDeliverable {
  id: string;
  projectId: string;
  title: string;
  format: string | null;
  phase: DeliverablePhase | null;
  status: DeliverableStatus;
  dueAt: string | null;
  version: number;
  assigneeUserId: string | null;
  assigneeLabel: string | null;
  waitingOn: string | null;
  notes: string | null;
  sortOrder: number;
  deliveredAt: string | null;
  /** NULL = draft/intern (privat), satt = publisert til klient. Speiler klient-vendt status. */
  publishedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Klient-vendte statuser = synlig for klient = «publisert». */
export function isClientFacingDeliverableStatus(status: DeliverableStatus): boolean {
  return status === 'client_review' || status === 'delivered';
}

const MAX_TITLE = 200;
const MAX_TEXT = 1000;

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function toIso(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function normalizeStatus(value: unknown, fallback: DeliverableStatus = 'draft'): DeliverableStatus {
  return typeof value === 'string' && (DELIVERABLE_STATUSES as readonly string[]).includes(value)
    ? (value as DeliverableStatus)
    : fallback;
}

function normalizePhase(value: unknown): DeliverablePhase | null {
  return typeof value === 'string' && (DELIVERABLE_PHASES as readonly string[]).includes(value)
    ? (value as DeliverablePhase)
    : null;
}

function mapRow(row: Record<string, unknown>): RoleRoomDeliverable {
  const toIsoOut = (v: unknown): string | null =>
    v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title ?? ''),
    format: (row.format as string | null) ?? null,
    phase: normalizePhase(row.phase),
    status: normalizeStatus(row.status),
    dueAt: toIsoOut(row.due_at),
    version: Number(row.version ?? 1),
    assigneeUserId: (row.assignee_user_id as string | null) ?? null,
    assigneeLabel: (row.assignee_label as string | null) ?? null,
    waitingOn: (row.waiting_on as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    deliveredAt: toIsoOut(row.delivered_at),
    publishedAt: toIsoOut(row.published_at),
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
    createdAt: toIsoOut(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIsoOut(row.updated_at) ?? new Date(0).toISOString(),
  };
}

export async function listDeliverables(pool: Pool, projectId: string): Promise<RoleRoomDeliverable[]> {
  const result = await pool.query(
    `SELECT * FROM role_room_deliverables
      WHERE project_id = $1
      ORDER BY sort_order ASC, COALESCE(due_at, 'infinity'::timestamptz) ASC, created_at ASC`,
    [projectId],
  );
  return result.rows.map((r) => mapRow(r as Record<string, unknown>));
}

export interface CreateDeliverableInput {
  projectId: string;
  title: string;
  format?: string | null;
  phase?: string | null;
  status?: string | null;
  dueAt?: string | null;
  assigneeUserId?: string | null;
  assigneeLabel?: string | null;
  waitingOn?: string | null;
  notes?: string | null;
  sortOrder?: number | null;
  createdByUserId?: string | null;
}

export async function createDeliverable(
  pool: Pool,
  input: CreateDeliverableInput,
): Promise<RoleRoomDeliverable | null> {
  const title = clip(input.title, MAX_TITLE);
  if (!input.projectId || !title) return null;
  const status = normalizeStatus(input.status);
  const deliveredAt = status === 'delivered' ? new Date().toISOString() : null;
  // Publisert ved opprettelse kun hvis status alt er klient-vendt.
  const publishedAt = isClientFacingDeliverableStatus(status) ? new Date().toISOString() : null;
  const result = await pool.query(
    `INSERT INTO role_room_deliverables
       (id, project_id, title, format, phase, status, due_at, version,
        assignee_user_id, assignee_label, waiting_on, notes, sort_order,
        delivered_at, published_at, created_by_user_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,$11,$12,$13,$14,$15, now(), now())
     RETURNING *`,
    [
      randomUUID(), input.projectId, title,
      clip(input.format, MAX_TITLE), normalizePhase(input.phase), status,
      toIso(input.dueAt),
      clip(input.assigneeUserId, MAX_TITLE), clip(input.assigneeLabel, MAX_TITLE),
      clip(input.waitingOn, MAX_TITLE), clip(input.notes, MAX_TEXT),
      Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
      deliveredAt, publishedAt, clip(input.createdByUserId, MAX_TITLE),
    ],
  );
  return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
}

export interface UpdateDeliverablePatch {
  title?: string;
  format?: string | null;
  phase?: string | null;
  status?: string;
  dueAt?: string | null;
  assigneeUserId?: string | null;
  assigneeLabel?: string | null;
  waitingOn?: string | null;
  notes?: string | null;
  sortOrder?: number;
  /** Hvis true: bump versjon (ny iterasjon av leveransen). */
  bumpVersion?: boolean;
}

export async function updateDeliverable(
  pool: Pool,
  id: string,
  projectId: string,
  patch: UpdateDeliverablePatch,
): Promise<RoleRoomDeliverable | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (col: string, val: unknown) => { values.push(val); sets.push(`${col} = $${values.length}`); };

  if (patch.title !== undefined) {
    const t = clip(patch.title, MAX_TITLE);
    if (t) push('title', t);
  }
  if (patch.format !== undefined) push('format', clip(patch.format, MAX_TITLE));
  if (patch.phase !== undefined) push('phase', normalizePhase(patch.phase));
  if (patch.dueAt !== undefined) push('due_at', toIso(patch.dueAt));
  if (patch.assigneeUserId !== undefined) push('assignee_user_id', clip(patch.assigneeUserId, MAX_TITLE));
  if (patch.assigneeLabel !== undefined) push('assignee_label', clip(patch.assigneeLabel, MAX_TITLE));
  if (patch.waitingOn !== undefined) push('waiting_on', clip(patch.waitingOn, MAX_TITLE));
  if (patch.notes !== undefined) push('notes', clip(patch.notes, MAX_TEXT));
  if (patch.sortOrder !== undefined && Number.isFinite(patch.sortOrder)) push('sort_order', Number(patch.sortOrder));

  if (patch.status !== undefined) {
    const status = normalizeStatus(patch.status);
    push('status', status);
    // delivered_at speiler status-overgangen til/fra 'delivered'.
    push('delivered_at', status === 'delivered' ? new Date().toISOString() : null);
    // published_at speiler klient-synlighet: settes når status blir klient-vendt
    // (client_review/delivered), nullstilles når den trekkes tilbake til draft/intern.
    push('published_at', isClientFacingDeliverableStatus(status) ? new Date().toISOString() : null);
  }
  if (patch.bumpVersion) {
    sets.push('version = version + 1');
  }

  if (sets.length === 0) {
    // Ingen endringer — returner eksisterende rad uendret.
    const existing = await pool.query(
      `SELECT * FROM role_room_deliverables WHERE id = $1 AND project_id = $2`,
      [id, projectId],
    );
    return existing.rows[0] ? mapRow(existing.rows[0] as Record<string, unknown>) : null;
  }

  sets.push('updated_at = now()');
  values.push(id);
  values.push(projectId);
  const result = await pool.query(
    `UPDATE role_room_deliverables SET ${sets.join(', ')}
      WHERE id = $${values.length - 1} AND project_id = $${values.length}
      RETURNING *`,
    values,
  );
  return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
}

export async function deleteDeliverable(pool: Pool, id: string, projectId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM role_room_deliverables WHERE id = $1 AND project_id = $2`,
    [id, projectId],
  );
  return (result.rowCount ?? 0) > 0;
}
