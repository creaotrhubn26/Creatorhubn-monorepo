/**
 * storyboard-service.ts — CRUD for casting_storyboards.
 * Lagrer PencilCanvas-strokes + raster PNG. Idempotent upsert via
 * UNIQUE (project_id, frame_id) når frame_id er satt.
 */

import type { Pool, PoolClient } from 'pg';
import { storyboardPencilOverlayProjection } from './storyboard-paintover-contract.js';
import {
  CAMERA_MOTION_ENVELOPE_FIELDS,
} from './storyboard-camera-motion.js';

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

function sourceRevision(metadata: Record<string, unknown>): number {
  const value = metadata.sourceRevision;
  const parsed = typeof value === "number" ? value
    : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

const SERVER_OWNED_NORMALIZED_METADATA_FIELDS = [
  'aiVideo',
  'aiPaintoverState',
  ...CAMERA_MOTION_ENVELOPE_FIELDS,
  'shotDuration',
  'durationRevision',
] as const;

export function mergeStoryboardSourceMetadata(
  current: Record<string, unknown>,
  incoming: Record<string, unknown> | undefined,
  sourceChanged: boolean,
): Record<string, unknown> {
  const patch = incoming ?? {};
  const next = { ...current, ...patch };
  // Generic storyboard upsert is not an adoption, motion or timing authority.
  // Preserve authoritative values on update and strip attempted injection on
  // create/legacy rows where the server has never written the sidecar.
  for (const key of SERVER_OWNED_NORMALIZED_METADATA_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(current, key)) {
      next[key] = current[key];
    } else {
      delete next[key];
    }
  }
  next.sourceRevision = sourceRevision(current) + (sourceChanged ? 1 : 0);
  if (sourceChanged) {
    next.aiOutputStale = true;
    next.aiOutputStaleReason = "source-document-changed";
  } else if (patch.aiOutputStale === true) {
    next.aiOutputStale = true;
    next.aiOutputStaleReason =
      typeof patch.aiOutputStaleReason === "string"
        && patch.aiOutputStaleReason.trim()
        ? patch.aiOutputStaleReason.trim()
        : "source-document-changed";
  } else {
    // Generic storyboard PATCH/upsert cannot clear approval authority.
    if (Object.prototype.hasOwnProperty.call(current, "aiOutputStale")) {
      next.aiOutputStale = current.aiOutputStale;
    } else {
      delete next.aiOutputStale;
    }
    if (Object.prototype.hasOwnProperty.call(current, "aiOutputStaleReason")) {
      next.aiOutputStaleReason = current.aiOutputStaleReason;
    } else {
      delete next.aiOutputStaleReason;
    }
  }
  return next;
}

/**
 * The normalized storyboard stores the shared native stroke document, but its
 * source revision belongs only to the immutable Pencil lineage. Color and
 * Atmosphere are editable downstream paintovers and are revisioned beside the
 * compat frame; including them here would incorrectly stale an approved Pencil
 * source when the artist merely paints over it.
 */
export function storyboardSourceDocumentChanged(
  current: Storyboard,
  patch: Partial<StoryboardInput>,
): boolean {
  return (patch.strokes !== undefined
      && JSON.stringify(storyboardPencilOverlayProjection({
        strokes: patch.strokes,
      })) !== JSON.stringify(storyboardPencilOverlayProjection({
        strokes: current.strokes,
      })))
    || (patch.imageData !== undefined && patch.imageData !== current.imageData)
    || (patch.width !== undefined && patch.width !== current.width)
    || (patch.height !== undefined && patch.height !== current.height);
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
  const metadata = mergeStoryboardSourceMetadata(
    {},
    input.metadata,
    false,
  );
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
      JSON.stringify(metadata),
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
  // Routes also pass a PoolClient while already inside a transaction. Only a
  // real Pool owns the transaction here; either way, merge from the locked
  // row so a generic metadata update cannot overwrite freshly adopted AI
  // sidecars with a stale read.
  const ownsTransaction = typeof (pool as unknown as { connect?: unknown }).connect
    === 'function';
  const client: PoolClient = ownsTransaction
    ? await pool.connect()
    : pool as unknown as PoolClient;
  try {
    if (ownsTransaction) await client.query('BEGIN');
    const selected = await client.query(
      `SELECT * FROM casting_storyboards WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!selected.rowCount) {
      if (ownsTransaction) await client.query('COMMIT');
      return null;
    }
    const current = mapRow(selected.rows[0]);
    const metadata = mergeStoryboardSourceMetadata(
      current.metadata,
      patch.metadata,
      storyboardSourceDocumentChanged(current, patch),
    );
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
    fields.push(`metadata = $${i++}::jsonb`);
    params.push(JSON.stringify(metadata));
    fields.push(`updated_at = now()`);
    params.push(id);
    const updated = await client.query(
      `UPDATE casting_storyboards SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (ownsTransaction) await client.query('COMMIT');
    return updated.rowCount ? mapRow(updated.rows[0]) : null;
  } catch (error) {
    if (ownsTransaction) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    if (ownsTransaction) client.release();
  }
}

export async function deleteStoryboard(pool: Pool, id: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM casting_storyboards WHERE id = $1`, [id]);
  return (r.rowCount ?? 0) > 0;
}
