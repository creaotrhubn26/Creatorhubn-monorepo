/**
 * storyboard-service.ts — CRUD for casting_storyboards.
 * Lagrer PencilCanvas-strokes + raster PNG. Idempotent upsert via
 * UNIQUE (project_id, frame_id) når frame_id er satt.
 */

import type { Pool } from 'pg';

export interface Storyboard {
  id: string;
  projectId: string;
  sceneId: string | null;
  frameId: string | null;
  title: string | null;
  strokes: unknown[];
  imageData: string | null;
  width: number | null;
  height: number | null;
  workflowLevel: string | null;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function isoTs(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}

function asJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return fallback;
}

function mapRow(row: Record<string, unknown>): Storyboard {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    sceneId: row.scene_id ? String(row.scene_id) : null,
    frameId: row.frame_id ? String(row.frame_id) : null,
    title: row.title ? String(row.title) : null,
    strokes: asJson<unknown[]>(row.strokes, []),
    imageData: row.image_data ? String(row.image_data) : null,
    width: row.width != null ? Number(row.width) : null,
    height: row.height != null ? Number(row.height) : null,
    workflowLevel: row.workflow_level ? String(row.workflow_level) : null,
    metadata: asJson<Record<string, unknown>>(row.metadata, {}),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export async function listStoryboards(
  pool: Pool,
  projectId: string,
  sceneId?: string | null,
): Promise<Storyboard[]> {
  const conds: string[] = ['project_id = $1'];
  const params: unknown[] = [projectId];
  if (sceneId) {
    params.push(sceneId);
    conds.push(`scene_id = $${params.length}`);
  }
  const r = await pool.query(
    `SELECT * FROM casting_storyboards WHERE ${conds.join(' AND ')} ORDER BY created_at DESC`,
    params,
  );
  return r.rows.map(mapRow);
}

export async function getStoryboard(pool: Pool, id: string): Promise<Storyboard | null> {
  const r = await pool.query(`SELECT * FROM casting_storyboards WHERE id = $1`, [id]);
  return r.rowCount ? mapRow(r.rows[0]) : null;
}

export async function getStoryboardByFrameId(
  pool: Pool,
  projectId: string,
  frameId: string,
): Promise<Storyboard | null> {
  const r = await pool.query(
    `SELECT * FROM casting_storyboards
      WHERE project_id = $1 AND frame_id = $2
      ORDER BY updated_at DESC LIMIT 1`,
    [projectId, frameId],
  );
  return r.rowCount ? mapRow(r.rows[0]) : null;
}

export interface StoryboardInput {
  projectId: string;
  sceneId?: string | null;
  frameId?: string | null;
  title?: string | null;
  strokes?: unknown[];
  imageData?: string | null;
  width?: number | null;
  height?: number | null;
  workflowLevel?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
}

/**
 * Upsert: hvis frameId er satt og storyboard for det frame allerede finnes,
 * oppdater. Ellers opprett ny rad.
 */
export async function upsertStoryboard(
  pool: Pool,
  input: StoryboardInput,
): Promise<Storyboard> {
  if (input.frameId) {
    const existing = await getStoryboardByFrameId(pool, input.projectId, input.frameId);
    if (existing) {
      const updated = await updateStoryboard(pool, existing.id, input);
      if (updated) return updated;
    }
  }
  return createStoryboard(pool, input);
}

export async function createStoryboard(
  pool: Pool,
  input: StoryboardInput,
): Promise<Storyboard> {
  const r = await pool.query(
    `INSERT INTO casting_storyboards
       (project_id, scene_id, frame_id, title, strokes, image_data,
        width, height, workflow_level, metadata, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11)
     RETURNING *`,
    [
      input.projectId,
      input.sceneId ?? null,
      input.frameId ?? null,
      input.title ?? null,
      JSON.stringify(input.strokes ?? []),
      input.imageData ?? null,
      input.width ?? null,
      input.height ?? null,
      input.workflowLevel ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.createdBy ?? null,
    ],
  );
  return mapRow(r.rows[0]);
}

export async function updateStoryboard(
  pool: Pool,
  id: string,
  patch: Partial<StoryboardInput>,
): Promise<Storyboard | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (patch.sceneId !== undefined)      { fields.push(`scene_id = $${i++}`);       params.push(patch.sceneId); }
  if (patch.frameId !== undefined)      { fields.push(`frame_id = $${i++}`);       params.push(patch.frameId); }
  if (patch.title !== undefined)        { fields.push(`title = $${i++}`);          params.push(patch.title); }
  if (patch.strokes !== undefined)      { fields.push(`strokes = $${i++}::jsonb`); params.push(JSON.stringify(patch.strokes)); }
  if (patch.imageData !== undefined)    { fields.push(`image_data = $${i++}`);     params.push(patch.imageData); }
  if (patch.width !== undefined)        { fields.push(`width = $${i++}`);          params.push(patch.width); }
  if (patch.height !== undefined)       { fields.push(`height = $${i++}`);         params.push(patch.height); }
  if (patch.workflowLevel !== undefined){ fields.push(`workflow_level = $${i++}`); params.push(patch.workflowLevel); }
  if (patch.metadata !== undefined)     { fields.push(`metadata = $${i++}::jsonb`);params.push(JSON.stringify(patch.metadata)); }
  fields.push(`updated_at = now()`);
  if (fields.length === 1) {
    return getStoryboard(pool, id);
  }
  params.push(id);
  const r = await pool.query(
    `UPDATE casting_storyboards SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  );
  return r.rowCount ? mapRow(r.rows[0]) : null;
}

export async function deleteStoryboard(pool: Pool, id: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM casting_storyboards WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}
