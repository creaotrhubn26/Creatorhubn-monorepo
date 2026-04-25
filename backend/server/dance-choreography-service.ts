/**
 * Dance choreography service — DB-laget for Choreography Builder.
 *
 * Eier `dance_choreography` + `dance_choreography_segment` (migration 0059).
 * Scoping: per `owner_user_id`. Når prosjekt-modellen får dans-støtte
 * legges `project_id` til som nullable kolonne uten å bryte denne API-en.
 */

import type { Pool } from 'pg';

export type SegmentKind =
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'break'
  | 'outro'
  | 'freestyle'
  | 'lift'
  | 'formation_change';

export type EnergyLevel = 'low' | 'controlled' | 'medium' | 'high' | 'sharp' | 'explosive';
export type ApprovalStatus = 'draft' | 'review' | 'approved' | 'locked';

export interface ChoreographySegment {
  id: string;
  choreographyId: string;
  sequence: number;
  kind: SegmentKind;
  label: string | null;
  startSec: number;
  endSec: number;
  musicCue: string | null;
  formation: string | null;
  camera: string | null;
  lighting: string | null;
  costume: string | null;
  movementNotes: string | null;
  energy: EnergyLevel;
  dancers: string[];
  videoRefUrl: string | null;
  approval: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Choreography {
  id: string;
  ownerUserId: string;
  title: string;
  choreographer: string | null;
  musicTitle: string | null;
  musicUrl: string | null;
  musicStorageKey: string | null;
  bpm: number | null;
  musicalKey: string | null;
  totalDurationSec: number;
  createdAt: string;
  updatedAt: string;
  segments: ChoreographySegment[];
}

export interface ChoreographyHeader {
  id: string;
  ownerUserId: string;
  title: string;
  choreographer: string | null;
  totalDurationSec: number;
  segmentCount: number;
  updatedAt: string;
}

// ─── Row → DTO mapping ──────────────────────────────────────────────────

function isoFrom(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapHeader(row: Record<string, unknown>, segmentCount: number): ChoreographyHeader {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    title: String(row.title),
    choreographer: row.choreographer == null ? null : String(row.choreographer),
    totalDurationSec: Number(row.total_duration_sec) || 0,
    segmentCount,
    updatedAt: isoFrom(row.updated_at),
  };
}

function mapChoreographyRow(row: Record<string, unknown>): Omit<Choreography, 'segments'> {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    title: String(row.title),
    choreographer: row.choreographer == null ? null : String(row.choreographer),
    musicTitle: row.music_title == null ? null : String(row.music_title),
    musicUrl: row.music_url == null ? null : String(row.music_url),
    musicStorageKey: row.music_storage_key == null ? null : String(row.music_storage_key),
    bpm: asNumberOrNull(row.bpm),
    musicalKey: row.musical_key == null ? null : String(row.musical_key),
    totalDurationSec: Number(row.total_duration_sec) || 0,
    createdAt: isoFrom(row.created_at),
    updatedAt: isoFrom(row.updated_at),
  };
}

function mapSegmentRow(row: Record<string, unknown>): ChoreographySegment {
  return {
    id: String(row.id),
    choreographyId: String(row.choreography_id),
    sequence: Number(row.sequence) || 0,
    kind: String(row.kind) as SegmentKind,
    label: row.label == null ? null : String(row.label),
    startSec: Number(row.start_sec) || 0,
    endSec: Number(row.end_sec) || 0,
    musicCue: row.music_cue == null ? null : String(row.music_cue),
    formation: row.formation == null ? null : String(row.formation),
    camera: row.camera == null ? null : String(row.camera),
    lighting: row.lighting == null ? null : String(row.lighting),
    costume: row.costume == null ? null : String(row.costume),
    movementNotes: row.movement_notes == null ? null : String(row.movement_notes),
    energy: String(row.energy || 'medium') as EnergyLevel,
    dancers: Array.isArray(row.dancers) ? (row.dancers as string[]) : [],
    videoRefUrl: row.video_ref_url == null ? null : String(row.video_ref_url),
    approval: String(row.approval || 'draft') as ApprovalStatus,
    createdAt: isoFrom(row.created_at),
    updatedAt: isoFrom(row.updated_at),
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────────

export interface CreateChoreographyInput {
  ownerUserId: string;
  title: string;
  choreographer?: string | null;
  musicTitle?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  totalDurationSec?: number;
}

export async function createChoreography(
  pool: Pool,
  input: CreateChoreographyInput,
): Promise<Choreography> {
  const { rows } = await pool.query(
    `INSERT INTO dance_choreography (
      owner_user_id, title, choreographer, music_title, bpm, musical_key, total_duration_sec
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      input.ownerUserId,
      input.title,
      input.choreographer ?? null,
      input.musicTitle ?? null,
      input.bpm ?? null,
      input.musicalKey ?? null,
      input.totalDurationSec ?? 0,
    ],
  );
  const header = mapChoreographyRow(rows[0]);
  return { ...header, segments: [] };
}

export async function listChoreographies(
  pool: Pool,
  ownerUserId: string,
  limit = 50,
): Promise<ChoreographyHeader[]> {
  const safeLimit = Math.max(1, Math.min(200, limit));
  const { rows } = await pool.query(
    `SELECT c.*, COALESCE(s.cnt, 0)::int AS segment_count
     FROM dance_choreography c
     LEFT JOIN (
       SELECT choreography_id, COUNT(*) AS cnt
       FROM dance_choreography_segment
       GROUP BY choreography_id
     ) s ON s.choreography_id = c.id
     WHERE c.owner_user_id = $1
     ORDER BY c.updated_at DESC
     LIMIT $2`,
    [ownerUserId, safeLimit],
  );
  return rows.map((r) => mapHeader(r, Number(r.segment_count) || 0));
}

export async function getChoreography(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<Choreography | null> {
  const { rows: headerRows } = await pool.query(
    `SELECT * FROM dance_choreography WHERE id = $1 AND owner_user_id = $2`,
    [id, ownerUserId],
  );
  if (headerRows.length === 0) return null;
  const { rows: segRows } = await pool.query(
    `SELECT * FROM dance_choreography_segment
     WHERE choreography_id = $1
     ORDER BY sequence ASC, start_sec ASC`,
    [id],
  );
  return {
    ...mapChoreographyRow(headerRows[0]),
    segments: segRows.map(mapSegmentRow),
  };
}

export interface UpdateChoreographyHeaderPatch {
  title?: string;
  choreographer?: string | null;
  musicTitle?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  totalDurationSec?: number;
  musicUrl?: string | null;
  musicStorageKey?: string | null;
}

export async function updateChoreographyHeader(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: UpdateChoreographyHeaderPatch,
): Promise<Choreography | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.title !== undefined) push('title', patch.title);
  if (patch.choreographer !== undefined) push('choreographer', patch.choreographer);
  if (patch.musicTitle !== undefined) push('music_title', patch.musicTitle);
  if (patch.bpm !== undefined) push('bpm', patch.bpm);
  if (patch.musicalKey !== undefined) push('musical_key', patch.musicalKey);
  if (patch.totalDurationSec !== undefined) push('total_duration_sec', patch.totalDurationSec);
  if (patch.musicUrl !== undefined) push('music_url', patch.musicUrl);
  if (patch.musicStorageKey !== undefined) push('music_storage_key', patch.musicStorageKey);
  if (sets.length === 0) return getChoreography(pool, ownerUserId, id);
  sets.push(`updated_at = now()`);
  params.push(ownerUserId);
  params.push(id);
  await pool.query(
    `UPDATE dance_choreography
     SET ${sets.join(', ')}
     WHERE owner_user_id = $${params.length - 1} AND id = $${params.length}`,
    params,
  );
  return getChoreography(pool, ownerUserId, id);
}

/**
 * Replace all segments for a choreography in a single transaction.
 * Brukes når frontend sender opp en hel oppdatert segment-liste etter
 * autosave. Enklere enn individuelle CRUD pr segment, og garanterer
 * konsistent state.
 */
export interface SegmentInput {
  kind: SegmentKind;
  label?: string | null;
  startSec: number;
  endSec: number;
  musicCue?: string | null;
  formation?: string | null;
  camera?: string | null;
  lighting?: string | null;
  costume?: string | null;
  movementNotes?: string | null;
  energy: EnergyLevel;
  dancers: string[];
  videoRefUrl?: string | null;
  approval: ApprovalStatus;
}

export async function replaceSegments(
  pool: Pool,
  ownerUserId: string,
  choreographyId: string,
  segments: SegmentInput[],
): Promise<Choreography | null> {
  // Verify ownership before deleting anything
  const exists = await pool.query(
    `SELECT 1 FROM dance_choreography WHERE id = $1 AND owner_user_id = $2`,
    [choreographyId, ownerUserId],
  );
  if (exists.rowCount === 0) return null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM dance_choreography_segment WHERE choreography_id = $1`,
      [choreographyId],
    );
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      await client.query(
        `INSERT INTO dance_choreography_segment (
          choreography_id, sequence, kind, label, start_sec, end_sec,
          music_cue, formation, camera, lighting, costume, movement_notes,
          energy, dancers, video_ref_url, approval
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          choreographyId,
          i,
          s.kind,
          s.label ?? null,
          s.startSec,
          s.endSec,
          s.musicCue ?? null,
          s.formation ?? null,
          s.camera ?? null,
          s.lighting ?? null,
          s.costume ?? null,
          s.movementNotes ?? null,
          s.energy,
          s.dancers,
          s.videoRefUrl ?? null,
          s.approval,
        ],
      );
    }
    await client.query(
      `UPDATE dance_choreography SET updated_at = now() WHERE id = $1`,
      [choreographyId],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getChoreography(pool, ownerUserId, choreographyId);
}

export async function deleteChoreography(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_choreography WHERE id = $1 AND owner_user_id = $2`,
    [id, ownerUserId],
  );
  return (rowCount ?? 0) > 0;
}
