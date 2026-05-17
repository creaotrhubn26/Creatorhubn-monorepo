/**
 * Dance formation service — DB-laget for navngitte scene-formasjoner i
 * dans-vertikalen. Eier `dance_formation` (migration 0063).
 *
 * Scoping: per (owner_user_id, project_id). project_id NULL =
 * bibliotek-formasjon synlig på tvers av prosjekter for eieren (samme
 * mønster som dance_choreography 0060 og dancer_profile_extras 0061).
 */

import type { Pool } from 'pg';

export interface DancerPosition {
  dancerId: string;
  x: number;     // 0..1
  y: number;     // 0..1
  facing?: number;
  isLead?: boolean;
}

export interface DancerTransitionPath {
  dancerId: string;
  controlPoints: Array<{ x: number; y: number }>;
}

export interface FormationInput {
  label: string;
  notes?: string | null;
  stageWidthM?: number;
  stageDepthM?: number;
  positions: DancerPosition[];
  transitionFromId?: string | null;
  displayOrder?: number;
  projectId?: string | null;
  startSec?: number | null;
  endSec?: number | null;
  transitionNote?: string | null;
  tags?: string[];
  transitionPaths?: DancerTransitionPath[];
}

export interface FormationPatch extends Partial<FormationInput> {}

export interface FormationRecord {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  label: string;
  notes: string | null;
  stageWidthM: number;
  stageDepthM: number;
  positions: DancerPosition[];
  transitionFromId: string | null;
  displayOrder: number;
  startSec: number | null;
  endSec: number | null;
  transitionNote: string | null;
  tags: string[];
  transitionPaths: DancerTransitionPath[];
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

function asPositions(value: unknown): DancerPosition[] {
  if (!Array.isArray(value)) return [];
  const out: DancerPosition[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.dancerId !== 'string' || r.dancerId.length === 0) continue;
    const x = Number(r.x);
    const y = Number(r.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const pos: DancerPosition = {
      dancerId: r.dancerId,
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
    if (typeof r.facing === 'number' && Number.isFinite(r.facing)) {
      pos.facing = r.facing;
    }
    if (r.isLead === true) pos.isLead = true;
    out.push(pos);
  }
  return out;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

function asTransitionPaths(value: unknown): DancerTransitionPath[] {
  if (!Array.isArray(value)) return [];
  const out: DancerTransitionPath[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.dancerId !== 'string') continue;
    if (!Array.isArray(r.controlPoints)) continue;
    const cps: Array<{ x: number; y: number }> = [];
    for (const c of r.controlPoints) {
      if (!c || typeof c !== 'object') continue;
      const cr = c as Record<string, unknown>;
      const x = Number(cr.x); const y = Number(cr.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      cps.push({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
    }
    if (cps.length === 0) continue;
    out.push({ dancerId: r.dancerId, controlPoints: cps });
  }
  return out;
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapRow(row: Record<string, unknown>): FormationRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    label: String(row.label),
    notes: row.notes == null ? null : String(row.notes),
    stageWidthM: asNumberOr(row.stage_width_m, 12.0),
    stageDepthM: asNumberOr(row.stage_depth_m, 8.0),
    positions: asPositions(row.dancer_positions),
    transitionFromId: row.transition_from_id == null ? null : String(row.transition_from_id),
    displayOrder: asNumberOr(row.display_order, 0),
    startSec: asNumberOrNull(row.start_sec),
    endSec: asNumberOrNull(row.end_sec),
    transitionNote: row.transition_note == null ? null : String(row.transition_note),
    tags: asStringArray(row.tags),
    transitionPaths: asTransitionPaths(row.transition_paths),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

// ─── ID generation ──────────────────────────────────────────────────────

function generateId(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return `fmt_${globalThis.crypto.randomUUID()}`;
  }
  return `fmt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── CRUD ───────────────────────────────────────────────────────────────

export interface ListFormationsOptions {
  projectId?: string | null;
  limit?: number;
}

export async function listFormations(
  pool: Pool,
  ownerUserId: string,
  options: ListFormationsOptions = {},
): Promise<FormationRecord[]> {
  const safeLimit = Math.max(1, Math.min(500, options.limit ?? 200));
  const filterProject = typeof options.projectId === 'string' && options.projectId.length > 0;

  if (filterProject) {
    const { rows } = await pool.query(
      `SELECT *
       FROM dance_formation
       WHERE owner_user_id = $1
         AND (project_id = $2 OR project_id IS NULL)
       ORDER BY display_order ASC, updated_at DESC
       LIMIT $3`,
      [ownerUserId, options.projectId, safeLimit],
    );
    return rows.map((r) => mapRow(r));
  }

  const { rows } = await pool.query(
    `SELECT *
     FROM dance_formation
     WHERE owner_user_id = $1
     ORDER BY display_order ASC, updated_at DESC
     LIMIT $2`,
    [ownerUserId, safeLimit],
  );
  return rows.map((r) => mapRow(r));
}

export async function getFormation(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<FormationRecord | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_formation WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function createFormation(
  pool: Pool,
  ownerUserId: string,
  input: FormationInput,
): Promise<FormationRecord> {
  const id = generateId();
  const { rows } = await pool.query(
    `INSERT INTO dance_formation (
       id, owner_user_id, project_id, label, notes,
       stage_width_m, stage_depth_m, dancer_positions,
       transition_from_id, display_order,
       start_sec, end_sec, transition_note, tags, transition_paths
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      id,
      ownerUserId,
      input.projectId ?? null,
      input.label,
      input.notes ?? null,
      input.stageWidthM ?? 12.0,
      input.stageDepthM ?? 8.0,
      JSON.stringify(input.positions ?? []),
      input.transitionFromId ?? null,
      input.displayOrder ?? 0,
      input.startSec ?? null,
      input.endSec ?? null,
      input.transitionNote ?? null,
      JSON.stringify(input.tags ?? []),
      JSON.stringify(input.transitionPaths ?? []),
    ],
  );
  return mapRow(rows[0]);
}

export async function patchFormation(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: FormationPatch,
): Promise<FormationRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];

  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.label !== undefined) push('label', patch.label);
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.stageWidthM !== undefined) push('stage_width_m', patch.stageWidthM);
  if (patch.stageDepthM !== undefined) push('stage_depth_m', patch.stageDepthM);
  if (patch.positions !== undefined) push('dancer_positions', JSON.stringify(patch.positions));
  if (patch.transitionFromId !== undefined) push('transition_from_id', patch.transitionFromId);
  if (patch.displayOrder !== undefined) push('display_order', patch.displayOrder);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (patch.startSec !== undefined) push('start_sec', patch.startSec);
  if (patch.endSec !== undefined) push('end_sec', patch.endSec);
  if (patch.transitionNote !== undefined) push('transition_note', patch.transitionNote);
  if (patch.tags !== undefined) push('tags', JSON.stringify(patch.tags));
  if (patch.transitionPaths !== undefined) push('transition_paths', JSON.stringify(patch.transitionPaths));

  if (sets.length === 0) return getFormation(pool, ownerUserId, id);

  sets.push('updated_at = now()');

  const { rows } = await pool.query(
    `UPDATE dance_formation
     SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function deleteFormation(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  // Null out any transition_from_id pointers TO this formation so we don't
  // leave dangling references (no FK constraint, just data hygiene).
  await pool.query(
    `UPDATE dance_formation
     SET transition_from_id = NULL, updated_at = now()
     WHERE owner_user_id = $1 AND transition_from_id = $2`,
    [ownerUserId, id],
  );
  const { rowCount } = await pool.query(
    `DELETE FROM dance_formation WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Replace the entire formation list for a project atomically. Inserts new
 * rows for entries with new ids, updates existing matches, deletes any that
 * are no longer in the list.
 *
 * Used by FormationViewConnected when the user makes batch changes (drag,
 * reorder, add, delete) — single backend round-trip per autosave debounce.
 */
export async function replaceFormations(
  pool: Pool,
  ownerUserId: string,
  projectId: string | null,
  // Tidligere subset-inline-type manglet startSec/endSec/transitionNote/
  // tags/transitionPaths som body refererte (genererte 10 TS-errors).
  // Bruker nå hele FormationInput pluss valgfri id.
  formations: Array<FormationInput & { id?: string }>,
): Promise<FormationRecord[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Existing IDs for this scope.
    const existing = projectId
      ? await client.query(
          `SELECT id FROM dance_formation
           WHERE owner_user_id = $1 AND (project_id = $2 OR project_id IS NULL)`,
          [ownerUserId, projectId],
        )
      : await client.query(
          `SELECT id FROM dance_formation WHERE owner_user_id = $1`,
          [ownerUserId],
        );
    const existingIds = new Set<string>(
      existing.rows.map((r: Record<string, unknown>) => String(r.id)),
    );

    const incomingIds = new Set<string>();
    const written: FormationRecord[] = [];

    for (let i = 0; i < formations.length; i += 1) {
      const f = formations[i];
      const id = f.id && f.id.length > 0 ? f.id : generateId();
      incomingIds.add(id);
      const order = f.displayOrder ?? i;

      if (existingIds.has(id)) {
        const { rows } = await client.query(
          `UPDATE dance_formation SET
             label = $3, notes = $4,
             stage_width_m = $5, stage_depth_m = $6,
             dancer_positions = $7,
             transition_from_id = $8,
             display_order = $9,
             project_id = $10,
             start_sec = $11,
             end_sec = $12,
             transition_note = $13,
             tags = $14,
             transition_paths = $15,
             updated_at = now()
           WHERE owner_user_id = $1 AND id = $2
           RETURNING *`,
          [
            ownerUserId, id,
            f.label,
            f.notes ?? null,
            f.stageWidthM ?? 12.0,
            f.stageDepthM ?? 8.0,
            JSON.stringify(f.positions ?? []),
            f.transitionFromId ?? null,
            order,
            projectId,
            f.startSec ?? null,
            f.endSec ?? null,
            f.transitionNote ?? null,
            JSON.stringify(f.tags ?? []),
            JSON.stringify(f.transitionPaths ?? []),
          ],
        );
        written.push(mapRow(rows[0]));
      } else {
        const { rows } = await client.query(
          `INSERT INTO dance_formation (
             id, owner_user_id, project_id, label, notes,
             stage_width_m, stage_depth_m, dancer_positions,
             transition_from_id, display_order,
             start_sec, end_sec, transition_note, tags, transition_paths
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           RETURNING *`,
          [
            id, ownerUserId, projectId,
            f.label,
            f.notes ?? null,
            f.stageWidthM ?? 12.0,
            f.stageDepthM ?? 8.0,
            JSON.stringify(f.positions ?? []),
            f.transitionFromId ?? null,
            order,
            f.startSec ?? null,
            f.endSec ?? null,
            f.transitionNote ?? null,
            JSON.stringify(f.tags ?? []),
            JSON.stringify(f.transitionPaths ?? []),
          ],
        );
        written.push(mapRow(rows[0]));
      }
    }

    // Delete formations that the client removed.
    const toDelete: string[] = [];
    for (const id of existingIds) {
      if (!incomingIds.has(id)) toDelete.push(id);
    }
    if (toDelete.length > 0) {
      await client.query(
        `UPDATE dance_formation
         SET transition_from_id = NULL, updated_at = now()
         WHERE owner_user_id = $1 AND transition_from_id = ANY($2::text[])`,
        [ownerUserId, toDelete],
      );
      await client.query(
        `DELETE FROM dance_formation
         WHERE owner_user_id = $1 AND id = ANY($2::text[])`,
        [ownerUserId, toDelete],
      );
    }

    await client.query('COMMIT');
    return written;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
