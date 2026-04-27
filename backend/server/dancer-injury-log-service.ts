/**
 * Dancer injury log service — DB-laget for skadelogg-oppføringer per
 * danser per (eier, prosjekt). Eier `dancer_injury_log` (migration 0062).
 *
 * NAV-søknadsgrunnlag (Slice 2) leser samme tabell sammen med
 * gigg-historikk fra prosjekter.
 */

import type { Pool } from 'pg';

export type InjuryEntryStatus = 'active' | 'healing' | 'resolved';
export type InjurySide = 'left' | 'right' | 'both';
export type InjuryTrigger = 'rehearsal' | 'performance' | 'audition' | 'training' | 'other';

export const INJURY_BODY_PARTS = [
  'ankle', 'knee', 'hip', 'lower_back', 'shoulder',
  'wrist', 'foot', 'neck', 'other',
] as const;
export type InjuryBodyPart = typeof INJURY_BODY_PARTS[number];

export interface InjuryLogEntryInput {
  entryDate: string; // ISO date (YYYY-MM-DD)
  bodyPart: InjuryBodyPart;
  side?: InjurySide | null;
  severity: number; // 1..5
  note?: string | null;
  status?: InjuryEntryStatus;
  expectedReturnDate?: string | null;
  resolvedDate?: string | null;
  triggeredBy?: InjuryTrigger | null;
  projectId?: string | null;
}

export interface InjuryLogEntryPatch extends Partial<InjuryLogEntryInput> {}

export interface InjuryLogEntry {
  id: string;
  ownerUserId: string;
  dancerId: string;
  entryDate: string;
  bodyPart: InjuryBodyPart;
  side: InjurySide | null;
  severity: number;
  note: string | null;
  status: InjuryEntryStatus;
  expectedReturnDate: string | null;
  resolvedDate: string | null;
  triggeredBy: InjuryTrigger | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Mapping helpers ────────────────────────────────────────────────────

function isoDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'string') return value.slice(0, 10);
  return '';
}

function isoDateOrNull(value: unknown): string | null {
  if (value == null) return null;
  const result = isoDate(value);
  return result.length > 0 ? result : null;
}

function isoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function isBodyPart(value: unknown): value is InjuryBodyPart {
  return typeof value === 'string'
    && (INJURY_BODY_PARTS as readonly string[]).includes(value);
}

function isStatus(value: unknown): value is InjuryEntryStatus {
  return value === 'active' || value === 'healing' || value === 'resolved';
}

function isSide(value: unknown): value is InjurySide {
  return value === 'left' || value === 'right' || value === 'both';
}

function isTrigger(value: unknown): value is InjuryTrigger {
  return value === 'rehearsal' || value === 'performance' || value === 'audition'
    || value === 'training' || value === 'other';
}

function mapRow(row: Record<string, unknown>): InjuryLogEntry {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    dancerId: String(row.dancer_id),
    entryDate: isoDate(row.entry_date),
    bodyPart: isBodyPart(row.body_part) ? row.body_part : 'other',
    side: isSide(row.side) ? row.side : null,
    severity: Number(row.severity),
    note: row.note == null ? null : String(row.note),
    status: isStatus(row.status) ? row.status : 'active',
    expectedReturnDate: isoDateOrNull(row.expected_return_date),
    resolvedDate: isoDateOrNull(row.resolved_date),
    triggeredBy: isTrigger(row.triggered_by) ? row.triggered_by : null,
    projectId: row.project_id == null ? null : String(row.project_id),
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),
  };
}

// ─── ID-generator (server-side stable) ──────────────────────────────────

function generateId(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return `inj_${globalThis.crypto.randomUUID()}`;
  }
  return `inj_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── CRUD ───────────────────────────────────────────────────────────────

export interface ListInjuriesOptions {
  projectId?: string | null;
  dancerId?: string | null;
  status?: InjuryEntryStatus | null;
  limit?: number;
}

export async function listInjuries(
  pool: Pool,
  ownerUserId: string,
  options: ListInjuriesOptions = {},
): Promise<InjuryLogEntry[]> {
  const safeLimit = Math.max(1, Math.min(500, options.limit ?? 200));
  const conditions: string[] = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];

  if (typeof options.projectId === 'string' && options.projectId.length > 0) {
    params.push(options.projectId);
    conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`);
  }
  if (typeof options.dancerId === 'string' && options.dancerId.length > 0) {
    params.push(options.dancerId);
    conditions.push(`dancer_id = $${params.length}`);
  }
  if (options.status) {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  }

  params.push(safeLimit);

  const { rows } = await pool.query(
    `SELECT *
     FROM dancer_injury_log
     WHERE ${conditions.join(' AND ')}
     ORDER BY entry_date DESC, created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => mapRow(r));
}

export async function getInjury(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<InjuryLogEntry | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dancer_injury_log WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function createInjury(
  pool: Pool,
  ownerUserId: string,
  dancerId: string,
  input: InjuryLogEntryInput,
): Promise<InjuryLogEntry> {
  const id = generateId();
  const { rows } = await pool.query(
    `INSERT INTO dancer_injury_log (
       id, owner_user_id, dancer_id,
       entry_date, body_part, side, severity, note, status,
       expected_return_date, resolved_date, triggered_by, project_id
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      id,
      ownerUserId,
      dancerId,
      input.entryDate,
      input.bodyPart,
      input.side ?? null,
      input.severity,
      input.note ?? null,
      input.status ?? 'active',
      input.expectedReturnDate ?? null,
      input.resolvedDate ?? null,
      input.triggeredBy ?? null,
      input.projectId ?? null,
    ],
  );
  return mapRow(rows[0]);
}

export async function patchInjury(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: InjuryLogEntryPatch,
): Promise<InjuryLogEntry | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];

  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.entryDate !== undefined) push('entry_date', patch.entryDate);
  if (patch.bodyPart !== undefined) push('body_part', patch.bodyPart);
  if (patch.side !== undefined) push('side', patch.side);
  if (patch.severity !== undefined) push('severity', patch.severity);
  if (patch.note !== undefined) push('note', patch.note);
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.expectedReturnDate !== undefined) push('expected_return_date', patch.expectedReturnDate);
  if (patch.resolvedDate !== undefined) push('resolved_date', patch.resolvedDate);
  if (patch.triggeredBy !== undefined) push('triggered_by', patch.triggeredBy);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);

  // Auto-set resolved_date when status flips to resolved and no date supplied.
  if (patch.status === 'resolved' && patch.resolvedDate === undefined) {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');
    params.push(`${y}-${m}-${d}`);
    sets.push(`resolved_date = COALESCE(resolved_date, $${params.length})`);
  }

  if (sets.length === 0) {
    // Nothing to patch — just return current row.
    return getInjury(pool, ownerUserId, id);
  }

  sets.push(`updated_at = now()`);

  const { rows } = await pool.query(
    `UPDATE dancer_injury_log
     SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function deleteInjury(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dancer_injury_log WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}
