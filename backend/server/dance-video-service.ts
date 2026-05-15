/**
 * Dance video service — review-stack DB-lag.
 *
 * Eier `dance_video_clip` (0066) + `dance_video_annotation` (0067).
 * Filer ligger i R2 via samme buildCaptureR2Config-stack som
 * choreography music. Annotations støtter threading via parent_id og er
 * sortert per (clip, timestamp).
 *
 * V1 skriver bare body + timestamp + targets + status. drawing/voice-
 * feltene er forhåndsmodellerte men skrives først i V2/V3.
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { buildCaptureR2Config } from './capture-upload-service.js';

export type VideoClipKind = 'rehearsal' | 'reference' | 'performance';
export type AnnotationStatus = 'open' | 'resolved';

export interface VideoClip {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  choreographyId: string | null;
  segmentId: string | null;
  kind: VideoClipKind;
  title: string;
  storageKey: string;
  signedUrl: string | null;
  durationSec: number | null;
  mime: string;
  sourceUserId: string;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAnnotation {
  id: string;
  ownerUserId: string;
  clipId: string;
  parentId: string | null;
  authorUserId: string;
  body: string;
  timestampSec: number;
  endSec: number | null;
  countNumber: number | null;
  segmentId: string | null;
  targetDancerIds: string[];
  isDirectorPin: boolean;
  status: AnnotationStatus;
  drawing: unknown | null;
  voiceNoteSignedUrl: string | null;
  drawingKeyframes: unknown | null;
  /** Movement-kategori for multi-track timeline (migrasjon 150). */
  category: string | null;
  /** AI-confidence-score 0-1 for foreslåtte annotasjoner (migrasjon 150). */
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Mapping helpers ────────────────────────────────────────────────────

function isoTs(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function isoTsOrNull(value: unknown): string | null {
  if (value == null) return null;
  return isoTs(value);
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function isClipKind(value: unknown): value is VideoClipKind {
  return value === 'rehearsal' || value === 'reference' || value === 'performance';
}

function mapClipRow(row: Record<string, unknown>): VideoClip {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    choreographyId: row.choreography_id == null ? null : String(row.choreography_id),
    segmentId: row.segment_id == null ? null : String(row.segment_id),
    kind: isClipKind(row.kind) ? row.kind : 'rehearsal',
    title: String(row.title),
    storageKey: String(row.storage_key),
    signedUrl: row.signed_url == null ? null : String(row.signed_url),
    durationSec: asNumberOrNull(row.duration_sec),
    mime: String(row.mime),
    sourceUserId: String(row.source_user_id),
    capturedAt: isoTsOrNull(row.captured_at),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapAnnotationRow(row: Record<string, unknown>): VideoAnnotation {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    clipId: String(row.clip_id),
    parentId: row.parent_id == null ? null : String(row.parent_id),
    authorUserId: String(row.author_user_id),
    body: String(row.body),
    timestampSec: Number(row.timestamp_sec) || 0,
    endSec: asNumberOrNull(row.end_sec),
    countNumber: asNumberOrNull(row.count_number),
    segmentId: row.segment_id == null ? null : String(row.segment_id),
    targetDancerIds: asStringArray(row.target_dancer_ids),
    isDirectorPin: row.is_director_pin === true,
    status: row.status === 'resolved' ? 'resolved' : 'open',
    drawing: row.drawing ?? null,
    voiceNoteSignedUrl: row.voice_note_signed_url == null ? null : String(row.voice_note_signed_url),
    drawingKeyframes: row.drawing_keyframes ?? null,
    category: row.category == null ? null : String(row.category),
    confidence: asNumberOrNull(row.confidence),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

// ─── R2 storage ─────────────────────────────────────────────────────────

const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

let storageClient: S3Client | null = null;

function getStorage(): { client: S3Client; bucket: string } | null {
  const cfg = buildCaptureR2Config();
  if (!cfg.enabled || !cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.secretAccessKey) {
    return null;
  }
  if (!storageClient) {
    storageClient = new S3Client({
      region: 'auto',
      endpoint: cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  return { client: storageClient, bucket: cfg.bucket };
}

const VIDEO_EXT_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/ogg': 'ogv',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
};

export interface UploadVideoResult {
  ok: boolean;
  storageKey?: string;
  signedUrl?: string;
  error?: 'storage_not_configured' | 'unsupported_mime' | 'upload_failed';
  detail?: string;
}

export async function uploadVideoToR2(input: {
  ownerUserId: string;
  pathSegment: string; // 'clips' | 'voice-notes'
  body: Buffer;
  mime: string;
}): Promise<UploadVideoResult> {
  const storage = getStorage();
  if (!storage) return { ok: false, error: 'storage_not_configured' };
  const ext = VIDEO_EXT_BY_MIME[input.mime.toLowerCase()];
  if (!ext) return { ok: false, error: 'unsupported_mime', detail: `Got ${input.mime}` };

  const key = `dance-video/${input.pathSegment}/${input.ownerUserId}/${randomUUID()}.${ext}`;
  try {
    await storage.client.send(new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: input.body,
      ContentType: input.mime,
    }));
    const signedUrl = await getSignedUrl(
      storage.client,
      new GetObjectCommand({ Bucket: storage.bucket, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
    return { ok: true, storageKey: key, signedUrl };
  } catch (err) {
    return { ok: false, error: 'upload_failed', detail: String(err) };
  }
}

export async function refreshSignedUrl(storageKey: string): Promise<string | null> {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return await getSignedUrl(
      storage.client,
      new GetObjectCommand({ Bucket: storage.bucket, Key: storageKey }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  } catch {
    return null;
  }
}

// ─── Clip CRUD ──────────────────────────────────────────────────────────

function generateClipId(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return `vid_${globalThis.crypto.randomUUID()}`;
  }
  return `vid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateAnnotationId(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return `vann_${globalThis.crypto.randomUUID()}`;
  }
  return `vann_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface CreateClipInput {
  ownerUserId: string;
  sourceUserId: string;
  projectId?: string | null;
  choreographyId?: string | null;
  segmentId?: string | null;
  kind?: VideoClipKind;
  title: string;
  storageKey: string;
  signedUrl: string;
  durationSec?: number | null;
  mime: string;
  capturedAt?: string | null;
}

export async function createClip(
  pool: Pool,
  input: CreateClipInput,
): Promise<VideoClip> {
  const id = generateClipId();
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
  const { rows } = await pool.query(
    `INSERT INTO dance_video_clip (
       id, owner_user_id, project_id, choreography_id, segment_id, kind,
       title, storage_key, signed_url, signed_url_expires_at,
       duration_sec, mime, source_user_id, captured_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      id,
      input.ownerUserId,
      input.projectId ?? null,
      input.choreographyId ?? null,
      input.segmentId ?? null,
      input.kind ?? 'rehearsal',
      input.title,
      input.storageKey,
      input.signedUrl,
      expiresAt,
      input.durationSec ?? null,
      input.mime,
      input.sourceUserId,
      input.capturedAt ?? null,
    ],
  );
  return mapClipRow(rows[0]);
}

export interface ListClipsOptions {
  choreographyId?: string | null;
  projectId?: string | null;
  kind?: VideoClipKind | null;
  limit?: number;
}

export async function listClips(
  pool: Pool,
  ownerUserId: string,
  options: ListClipsOptions = {},
): Promise<VideoClip[]> {
  const safeLimit = Math.max(1, Math.min(200, options.limit ?? 50));
  const conditions: string[] = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];
  if (options.choreographyId) {
    params.push(options.choreographyId);
    conditions.push(`choreography_id = $${params.length}`);
  }
  if (options.projectId) {
    params.push(options.projectId);
    conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`);
  }
  if (options.kind) {
    params.push(options.kind);
    conditions.push(`kind = $${params.length}`);
  }
  params.push(safeLimit);
  const { rows } = await pool.query(
    `SELECT * FROM dance_video_clip
     WHERE ${conditions.join(' AND ')}
     ORDER BY captured_at DESC NULLS LAST, created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  // Re-sign URLs that are within 24h of expiry so the client always has a fresh URL.
  const now = Date.now();
  const refreshThreshold = 24 * 60 * 60 * 1000;
  const result: VideoClip[] = [];
  for (const row of rows) {
    const expires = row.signed_url_expires_at as Date | string | null;
    const expiresMs = expires ? new Date(expires).getTime() : 0;
    if (!row.signed_url || expiresMs - now < refreshThreshold) {
      const fresh = await refreshSignedUrl(String(row.storage_key));
      if (fresh) {
        const newExpires = new Date(now + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
        await pool.query(
          `UPDATE dance_video_clip
           SET signed_url = $1, signed_url_expires_at = $2, updated_at = now()
           WHERE id = $3`,
          [fresh, newExpires, String(row.id)],
        );
        row.signed_url = fresh;
      }
    }
    result.push(mapClipRow(row));
  }
  return result;
}

export async function getClip(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<VideoClip | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_video_clip WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const expires = row.signed_url_expires_at as Date | string | null;
  const expiresMs = expires ? new Date(expires).getTime() : 0;
  if (!row.signed_url || expiresMs - Date.now() < 24 * 60 * 60 * 1000) {
    const fresh = await refreshSignedUrl(String(row.storage_key));
    if (fresh) {
      const newExpires = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
      await pool.query(
        `UPDATE dance_video_clip
         SET signed_url = $1, signed_url_expires_at = $2, updated_at = now()
         WHERE id = $3`,
        [fresh, newExpires, id],
      );
      row.signed_url = fresh;
    }
  }
  return mapClipRow(row);
}

export interface PatchClipInput {
  title?: string;
  kind?: VideoClipKind;
  segmentId?: string | null;
  capturedAt?: string | null;
  durationSec?: number | null;
}

export async function patchClip(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: PatchClipInput,
): Promise<VideoClip | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.title !== undefined) push('title', patch.title);
  if (patch.kind !== undefined) push('kind', patch.kind);
  if (patch.segmentId !== undefined) push('segment_id', patch.segmentId);
  if (patch.capturedAt !== undefined) push('captured_at', patch.capturedAt);
  if (patch.durationSec !== undefined) push('duration_sec', patch.durationSec);
  if (sets.length === 0) return getClip(pool, ownerUserId, id);
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_video_clip SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  if (rows.length === 0) return null;
  return mapClipRow(rows[0]);
}

export async function deleteClip(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_video_clip WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

// ─── Annotation CRUD ────────────────────────────────────────────────────

export interface CreateAnnotationInput {
  ownerUserId: string;
  authorUserId: string;
  clipId: string;
  parentId?: string | null;
  body: string;
  timestampSec: number;
  endSec?: number | null;
  countNumber?: number | null;
  segmentId?: string | null;
  targetDancerIds?: string[];
  isDirectorPin?: boolean;
  drawing?: unknown;
  drawingKeyframes?: unknown;
  voiceNoteStorageKey?: string | null;
  voiceNoteSignedUrl?: string | null;
  category?: string | null;
  confidence?: number | null;
}

const ALLOWED_CATEGORIES = new Set(['steps', 'arms', 'body', 'jumps', 'turns']);

function normalizeCategory(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).toLowerCase();
  return ALLOWED_CATEGORIES.has(s) ? s : null;
}

function normalizeConfidence(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

export async function createAnnotation(
  pool: Pool,
  input: CreateAnnotationInput,
): Promise<VideoAnnotation> {
  const id = generateAnnotationId();
  const voiceExpires = input.voiceNoteSignedUrl
    ? new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString()
    : null;
  const { rows } = await pool.query(
    `INSERT INTO dance_video_annotation (
       id, owner_user_id, clip_id, parent_id, author_user_id, body,
       timestamp_sec, end_sec, count_number, segment_id,
       target_dancer_ids, is_director_pin,
       drawing, voice_note_storage_key, voice_note_signed_url,
       voice_note_signed_url_expires_at, drawing_keyframes,
       category, confidence
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [
      id,
      input.ownerUserId,
      input.clipId,
      input.parentId ?? null,
      input.authorUserId,
      input.body,
      input.timestampSec,
      input.endSec ?? null,
      input.countNumber ?? null,
      input.segmentId ?? null,
      JSON.stringify(input.targetDancerIds ?? []),
      input.isDirectorPin === true,
      input.drawing == null ? null : JSON.stringify(input.drawing),
      input.voiceNoteStorageKey ?? null,
      input.voiceNoteSignedUrl ?? null,
      voiceExpires,
      input.drawingKeyframes == null ? null : JSON.stringify(input.drawingKeyframes),
      normalizeCategory(input.category),
      normalizeConfidence(input.confidence),
    ],
  );
  return mapAnnotationRow(rows[0]);
}

export async function listAnnotations(
  pool: Pool,
  ownerUserId: string,
  clipId: string,
): Promise<VideoAnnotation[]> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_video_annotation
     WHERE owner_user_id = $1 AND clip_id = $2
     ORDER BY is_director_pin DESC, timestamp_sec ASC, created_at ASC`,
    [ownerUserId, clipId],
  );
  // Re-sign voice URLs near expiry.
  const now = Date.now();
  const refreshThreshold = 24 * 60 * 60 * 1000;
  for (const row of rows) {
    if (row.voice_note_storage_key) {
      const expires = row.voice_note_signed_url_expires_at as Date | string | null;
      const expiresMs = expires ? new Date(expires).getTime() : 0;
      if (!row.voice_note_signed_url || expiresMs - now < refreshThreshold) {
        const fresh = await refreshSignedUrl(String(row.voice_note_storage_key));
        if (fresh) {
          const newExpires = new Date(now + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
          await pool.query(
            `UPDATE dance_video_annotation
             SET voice_note_signed_url = $1, voice_note_signed_url_expires_at = $2, updated_at = now()
             WHERE id = $3`,
            [fresh, newExpires, String(row.id)],
          );
          row.voice_note_signed_url = fresh;
        }
      }
    }
  }
  return rows.map((r) => mapAnnotationRow(r));
}

export interface PatchAnnotationInput {
  body?: string;
  status?: AnnotationStatus;
  isDirectorPin?: boolean;
  targetDancerIds?: string[];
  drawing?: unknown;
  drawingKeyframes?: unknown;
  category?: string | null;
}

export async function patchAnnotation(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: PatchAnnotationInput,
): Promise<VideoAnnotation | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.body !== undefined) push('body', patch.body);
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.isDirectorPin !== undefined) push('is_director_pin', patch.isDirectorPin);
  if (patch.targetDancerIds !== undefined) {
    push('target_dancer_ids', JSON.stringify(patch.targetDancerIds));
  }
  if (patch.drawing !== undefined) {
    push('drawing', patch.drawing == null ? null : JSON.stringify(patch.drawing));
  }
  if (patch.drawingKeyframes !== undefined) {
    push('drawing_keyframes', patch.drawingKeyframes == null ? null : JSON.stringify(patch.drawingKeyframes));
  }
  if (patch.category !== undefined) {
    push('category', normalizeCategory(patch.category));
  }
  if (sets.length === 0) {
    const { rows } = await pool.query(
      `SELECT * FROM dance_video_annotation WHERE owner_user_id = $1 AND id = $2`,
      [ownerUserId, id],
    );
    return rows.length ? mapAnnotationRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_video_annotation SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  if (rows.length === 0) return null;
  return mapAnnotationRow(rows[0]);
}

export async function deleteAnnotation(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_video_annotation WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}
