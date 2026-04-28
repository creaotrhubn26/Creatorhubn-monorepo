/**
 * casting-video-service.ts
 * CRUD for casting_candidate_videos + casting_video_annotations.
 * Bruker R2/S3 presigned URL for direkte upload (ingen mellomlagring i Node).
 */

import type { Pool } from 'pg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface CastingVideo {
  id: string;
  candidateId: string;
  projectId: string;
  title: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  rating: number | null;
  status: 'pending' | 'ready' | 'failed';
  uploadedBy: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAnnotation {
  id: string;
  videoId: string;
  timestampSeconds: number;
  comment: string;
  authorUserId: string | null;
  authorName: string | null;
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

function mapVideo(row: Record<string, unknown>): CastingVideo {
  return {
    id: String(row.id),
    candidateId: String(row.candidate_id),
    projectId: String(row.project_id),
    title: row.title ? String(row.title) : null,
    videoUrl: String(row.video_url),
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    fileSizeBytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : null,
    mimeType: row.mime_type ? String(row.mime_type) : null,
    rating: row.rating != null ? Number(row.rating) : null,
    status: String(row.status) as CastingVideo['status'],
    uploadedBy: row.uploaded_by ? String(row.uploaded_by) : null,
    notes: row.notes ? String(row.notes) : null,
    metadata: asJson<Record<string, unknown>>(row.metadata, {}),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapAnnotation(row: Record<string, unknown>): VideoAnnotation {
  return {
    id: String(row.id),
    videoId: String(row.video_id),
    timestampSeconds: Number(row.timestamp_seconds),
    comment: String(row.comment),
    authorUserId: row.author_user_id ? String(row.author_user_id) : null,
    authorName: row.author_name ? String(row.author_name) : null,
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

// ── R2 config ───────────────────────────────────────────────────────────
// Gjenbruker samme env-vars som capture-upload-service slik at samme
// bucket/credentials brukes for casting-videoer.

interface R2Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string | null;
}

function buildR2Config(): R2Config | null {
  const endpoint = process.env.CAPTURE_R2_ENDPOINT
    ?? process.env.CLOUDFLARE_R2_ENDPOINT
    ?? process.env.R2_ENDPOINT;
  const bucket = process.env.CASTING_R2_BUCKET
    ?? process.env.CAPTURE_R2_BUCKET
    ?? process.env.CLOUDFLARE_R2_BUCKET
    ?? process.env.R2_BUCKET;
  const accessKeyId = process.env.CAPTURE_R2_ACCESS_KEY_ID
    ?? process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
    ?? process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CAPTURE_R2_SECRET_ACCESS_KEY
    ?? process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    ?? process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint,
    bucket,
    region: process.env.R2_REGION ?? 'auto',
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.CASTING_R2_PUBLIC_BASE
      ?? process.env.CLOUDFLARE_R2_PUBLIC_BASE
      ?? null,
  };
}

let cachedClient: { client: S3Client; cfg: R2Config } | null = null;
function getClient(): { client: S3Client; cfg: R2Config } | null {
  if (cachedClient) return cachedClient;
  const cfg = buildR2Config();
  if (!cfg) return null;
  cachedClient = {
    cfg,
    client: new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      forcePathStyle: true,
    }),
  };
  return cachedClient;
}

// ── Upload-URL ──────────────────────────────────────────────────────────

export interface UploadUrlInput {
  candidateId: string;
  projectId: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
}

export interface UploadUrlResult {
  videoId: string;
  uploadUrl: string;             // PUT-URL — frontend uploader direkte med fetch(PUT)
  videoUrl: string;              // Endelig URL videoen blir nåbar på etter confirm
  expiresInSeconds: number;
  configured: boolean;           // false hvis R2 ikke er konfigurert (stub-modus)
}

const SIGNED_URL_TTL = 3600;    // 1 time

export async function createVideoUploadUrl(
  pool: Pool,
  input: UploadUrlInput,
): Promise<UploadUrlResult> {
  const handle = getClient();
  // Lag video-rad i 'pending'-status uavhengig av R2-config
  const safeName = input.filename.replace(/[^A-Za-z0-9.\-_]/g, '_').slice(0, 120);
  const timestamp = Date.now();

  if (!handle) {
    // Stub-modus: ingen R2 i miljøet. Vi lager rad med placeholder-URL
    // slik at frontend får videoId tilbake — men upload-URL er stub.
    const placeholder = `stub://r2-not-configured/${input.projectId}/${input.candidateId}/${timestamp}-${safeName}`;
    const r = await pool.query(
      `INSERT INTO casting_candidate_videos
         (candidate_id, project_id, title, video_url, mime_type, file_size_bytes, status, uploaded_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, '{"stub":true}'::jsonb)
       RETURNING *`,
      [input.candidateId, input.projectId, safeName, placeholder, input.mimeType, input.fileSizeBytes, input.uploadedBy],
    );
    return {
      videoId: String(r.rows[0].id),
      uploadUrl: placeholder,
      videoUrl: placeholder,
      expiresInSeconds: 0,
      configured: false,
    };
  }

  const { client, cfg } = handle;
  const key = `casting/${input.projectId}/${input.candidateId}/${timestamp}-${safeName}`;
  const finalUrl = cfg.publicBaseUrl
    ? `${cfg.publicBaseUrl.replace(/\/+$/, '')}/${key}`
    : `${cfg.endpoint.replace(/\/+$/, '')}/${cfg.bucket}/${key}`;

  const cmd = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: input.mimeType,
    ContentLength: input.fileSizeBytes,
  });
  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: SIGNED_URL_TTL });

  const r = await pool.query(
    `INSERT INTO casting_candidate_videos
       (candidate_id, project_id, title, video_url, mime_type, file_size_bytes, status, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
     RETURNING *`,
    [input.candidateId, input.projectId, safeName, finalUrl, input.mimeType, input.fileSizeBytes, input.uploadedBy],
  );
  return {
    videoId: String(r.rows[0].id),
    uploadUrl,
    videoUrl: finalUrl,
    expiresInSeconds: SIGNED_URL_TTL,
    configured: true,
  };
}

// ── Confirm + queries + delete ──────────────────────────────────────────

export async function confirmVideoUpload(
  pool: Pool,
  videoId: string,
  patch: { durationSeconds?: number | null; thumbnailUrl?: string | null },
): Promise<CastingVideo | null> {
  const r = await pool.query(
    `UPDATE casting_candidate_videos
        SET status = 'ready',
            duration_seconds = COALESCE($1, duration_seconds),
            thumbnail_url = COALESCE($2, thumbnail_url),
            updated_at = now()
      WHERE id = $3
      RETURNING *`,
    [patch.durationSeconds ?? null, patch.thumbnailUrl ?? null, videoId],
  );
  return r.rowCount ? mapVideo(r.rows[0]) : null;
}

export async function listVideosForCandidate(pool: Pool, candidateId: string): Promise<CastingVideo[]> {
  const r = await pool.query(
    `SELECT * FROM casting_candidate_videos
      WHERE candidate_id = $1
      ORDER BY created_at DESC`,
    [candidateId],
  );
  return r.rows.map(mapVideo);
}

export async function listVideosForProject(pool: Pool, projectId: string): Promise<CastingVideo[]> {
  const r = await pool.query(
    `SELECT * FROM casting_candidate_videos
      WHERE project_id = $1
      ORDER BY created_at DESC`,
    [projectId],
  );
  return r.rows.map(mapVideo);
}

export async function getVideo(pool: Pool, videoId: string): Promise<CastingVideo | null> {
  const r = await pool.query(`SELECT * FROM casting_candidate_videos WHERE id = $1`, [videoId]);
  return r.rowCount ? mapVideo(r.rows[0]) : null;
}

export async function updateVideo(
  pool: Pool,
  videoId: string,
  patch: { rating?: number | null; notes?: string | null; title?: string | null },
): Promise<CastingVideo | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (patch.rating !== undefined) { fields.push(`rating = $${i++}`); params.push(patch.rating); }
  if (patch.notes !== undefined)  { fields.push(`notes = $${i++}`); params.push(patch.notes); }
  if (patch.title !== undefined)  { fields.push(`title = $${i++}`); params.push(patch.title); }
  fields.push(`updated_at = now()`);
  if (fields.length === 1) return getVideo(pool, videoId);
  params.push(videoId);
  const r = await pool.query(
    `UPDATE casting_candidate_videos SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  );
  return r.rowCount ? mapVideo(r.rows[0]) : null;
}

export async function deleteVideo(pool: Pool, videoId: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM casting_candidate_videos WHERE id = $1`, [videoId]);
  return (r.rowCount ?? 0) > 0;
}

// ── Annotations ─────────────────────────────────────────────────────────

export async function listAnnotations(pool: Pool, videoId: string): Promise<VideoAnnotation[]> {
  const r = await pool.query(
    `SELECT * FROM casting_video_annotations
      WHERE video_id = $1
      ORDER BY timestamp_seconds ASC, created_at ASC`,
    [videoId],
  );
  return r.rows.map(mapAnnotation);
}

export async function createAnnotation(
  pool: Pool,
  videoId: string,
  input: { timestampSeconds: number; comment: string; authorUserId?: string; authorName?: string },
): Promise<VideoAnnotation> {
  const r = await pool.query(
    `INSERT INTO casting_video_annotations
       (video_id, timestamp_seconds, comment, author_user_id, author_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [videoId, input.timestampSeconds, input.comment, input.authorUserId ?? null, input.authorName ?? null],
  );
  return mapAnnotation(r.rows[0]);
}

export async function deleteAnnotation(pool: Pool, annotationId: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM casting_video_annotations WHERE id = $1`, [annotationId]);
  return (r.rowCount ?? 0) > 0;
}
