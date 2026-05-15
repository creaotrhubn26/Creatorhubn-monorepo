/**
 * coverage-take-service.ts
 *
 * Service-laget for casting_takes — on-set captured media. R2-integrasjon
 * for upload + signed URLs, CRUD-operasjoner, og status-transisjoner som
 * job-køen og analysepipelinen koordinerer mot.
 *
 * Arkitekturen følger samme mønster som casting-video-service for
 * candidate-videoer, men er en separat data-løype fordi:
 *   - Takes lever på prosjekt/scene-nivå, ikke kandidat-nivå
 *   - Coverage-tagging (shot_list_id + shot_index) er et nytt konsept
 *   - Job-køen for analyse er separat fra candidate-video-prosessen
 *
 * Arkitekturreferanse:
 *   backend/migrations/152_casting_takes_and_analysis.sql
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import type { Pool } from "pg";

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

export type ProcessingStatus =
  | "pending"
  | "queued"
  | "processing"
  | "analyzed"
  | "failed";

export interface CastingTake {
  id: string;
  projectId: string;
  sceneId: string | null;
  shotListId: string | null;
  shotIndex: number | null;
  takeNumber: number;
  mediaKey: string;
  mediaUrl: string | null;
  mediaType: "video" | "audio";
  mimeType: string | null;
  sizeBytes: number | null;
  durationSec: number | null;
  capturedAt: string | null;
  uploadedBy: string | null;
  notes: string | null;
  markedCircled: boolean;
  processingStatus: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUploadUrlInput {
  projectId: string;
  sceneId?: string;
  shotListId?: string;
  shotIndex?: number;
  takeNumber?: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  mediaType?: "video" | "audio";
  notes?: string;
  markedCircled?: boolean;
  uploadedBy?: string;
}

export interface CreateUploadUrlResult {
  takeId: string;
  uploadUrl: string;
  finalUrl: string;
  expiresInSeconds: number;
  configured: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// R2-konfig (samme env-vars som eksisterende casting-video-service)
// ─────────────────────────────────────────────────────────────────────

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
    region: process.env.R2_REGION ?? "auto",
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.CASTING_R2_PUBLIC_BASE
      ?? process.env.CLOUDFLARE_R2_PUBLIC_BASE
      ?? null,
  };
}

let cachedClient: { client: S3Client; cfg: R2Config } | null = null;
function getR2(): { client: S3Client; cfg: R2Config } | null {
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

const UPLOAD_URL_TTL_SEC = 3600;
const READ_URL_TTL_SEC = 3600;

// ─────────────────────────────────────────────────────────────────────
// Row-mapper
// ─────────────────────────────────────────────────────────────────────

interface TakeRow {
  id: string;
  project_id: string;
  scene_id: string | null;
  shot_list_id: string | null;
  shot_index: number | null;
  take_number: number;
  media_key: string;
  media_url: string | null;
  media_type: string;
  mime_type: string | null;
  size_bytes: string | number | null;
  duration_sec: string | number | null;
  captured_at: Date | null;
  uploaded_by: string | null;
  notes: string | null;
  marked_circled: boolean;
  processing_status: string;
  created_at: Date;
  updated_at: Date;
}

function rowToTake(row: TakeRow): CastingTake {
  return {
    id: row.id,
    projectId: row.project_id,
    sceneId: row.scene_id,
    shotListId: row.shot_list_id,
    shotIndex: row.shot_index,
    takeNumber: row.take_number,
    mediaKey: row.media_key,
    mediaUrl: row.media_url,
    mediaType: (row.media_type as "video" | "audio"),
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    durationSec: row.duration_sec != null ? Number(row.duration_sec) : null,
    capturedAt: row.captured_at ? row.captured_at.toISOString() : null,
    uploadedBy: row.uploaded_by,
    notes: row.notes,
    markedCircled: row.marked_circled,
    processingStatus: row.processing_status as ProcessingStatus,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Upload-flyt
// ─────────────────────────────────────────────────────────────────────

function sanitizeFilenameSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9.\-_]/g, "_").slice(0, 120);
}

export async function createTakeUploadUrl(
  pool: Pool,
  input: CreateUploadUrlInput,
): Promise<CreateUploadUrlResult> {
  const takeId = crypto.randomUUID();
  const mediaType: "video" | "audio" = input.mediaType ?? "video";
  const safeName = sanitizeFilenameSegment(input.filename);
  const timestamp = Date.now();
  const scenePart = input.sceneId ? `${input.sceneId}/` : "_unscoped/";
  const mediaKey = `takes/${input.projectId}/${scenePart}${timestamp}-${takeId}-${safeName}`;

  const r2 = getR2();
  let uploadUrl: string;
  let finalUrl: string | null;
  let configured = false;
  let expiresInSeconds = 0;

  if (!r2) {
    // Stub-modus — fortsatt lag rad så frontend får takeId tilbake
    const placeholder = `stub://r2-not-configured/${mediaKey}`;
    uploadUrl = placeholder;
    finalUrl = placeholder;
  } else {
    const { client, cfg } = r2;
    finalUrl = cfg.publicBaseUrl
      ? `${cfg.publicBaseUrl.replace(/\/+$/, "")}/${mediaKey}`
      : `${cfg.endpoint.replace(/\/+$/, "")}/${cfg.bucket}/${mediaKey}`;

    const cmd = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: mediaKey,
      ContentType: input.mimeType,
      ContentLength: input.sizeBytes,
    });
    uploadUrl = await getSignedUrl(client, cmd, { expiresIn: UPLOAD_URL_TTL_SEC });
    expiresInSeconds = UPLOAD_URL_TTL_SEC;
    configured = true;
  }

  await pool.query(
    `INSERT INTO casting_takes
       (id, project_id, scene_id, shot_list_id, shot_index, take_number,
        media_key, media_url, media_type, mime_type, size_bytes, notes,
        marked_circled, uploaded_by, processing_status, created_at, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending', NOW(), NOW())`,
    [
      takeId,
      input.projectId,
      input.sceneId ?? null,
      input.shotListId ?? null,
      input.shotIndex ?? null,
      input.takeNumber ?? 1,
      mediaKey,
      finalUrl,
      mediaType,
      input.mimeType,
      input.sizeBytes,
      input.notes ?? null,
      input.markedCircled ?? false,
      input.uploadedBy ?? null,
    ],
  );

  return {
    takeId,
    uploadUrl,
    finalUrl: finalUrl ?? "",
    expiresInSeconds,
    configured,
  };
}

/**
 * Confirm-upload markerer at media er ferdig opplastet i R2 og kødd-er
 * analyse-jobben. Frontend kaller dette etter at PUT mot signed URL
 * returnerer 200.
 */
export async function confirmTakeUpload(
  pool: Pool,
  takeId: string,
  opts: { durationSec?: number; capturedAt?: string } = {},
): Promise<CastingTake | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query<TakeRow>(
      `UPDATE casting_takes
       SET processing_status = 'queued',
           duration_sec      = COALESCE($2, duration_sec),
           captured_at       = COALESCE($3::timestamptz, captured_at),
           updated_at        = NOW()
       WHERE id = $1 AND processing_status = 'pending'
       RETURNING *`,
      [takeId, opts.durationSec ?? null, opts.capturedAt ?? null],
    );
    if (updated.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const take = rowToTake(updated.rows[0]);

    // Enqueue analyse-job i samme transaksjon — atomisk "upload bekreftet
    // OG job lagt på kø" eller ingen av delene.
    await client.query(
      `INSERT INTO casting_analysis_jobs
         (take_id, project_id, status, created_at, updated_at)
       VALUES ($1, $2, 'pending', NOW(), NOW())`,
      [take.id, take.projectId],
    );

    await client.query("COMMIT");
    return take;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────

export async function getTake(pool: Pool, takeId: string): Promise<CastingTake | null> {
  const r = await pool.query<TakeRow>(
    `SELECT * FROM casting_takes WHERE id = $1`,
    [takeId],
  );
  return r.rows[0] ? rowToTake(r.rows[0]) : null;
}

export async function listTakesForScene(pool: Pool, sceneId: string): Promise<CastingTake[]> {
  const r = await pool.query<TakeRow>(
    `SELECT * FROM casting_takes
     WHERE scene_id = $1
     ORDER BY shot_index NULLS LAST, take_number, created_at`,
    [sceneId],
  );
  return r.rows.map(rowToTake);
}

export async function listTakesForProject(pool: Pool, projectId: string): Promise<CastingTake[]> {
  const r = await pool.query<TakeRow>(
    `SELECT * FROM casting_takes
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId],
  );
  return r.rows.map(rowToTake);
}

export async function listTakesForShot(
  pool: Pool,
  shotListId: string,
  shotIndex: number,
): Promise<CastingTake[]> {
  const r = await pool.query<TakeRow>(
    `SELECT * FROM casting_takes
     WHERE shot_list_id = $1 AND shot_index = $2
     ORDER BY take_number, created_at`,
    [shotListId, shotIndex],
  );
  return r.rows.map(rowToTake);
}

// ─────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────

export interface UpdateTakeInput {
  shotListId?: string | null;
  shotIndex?: number | null;
  takeNumber?: number;
  notes?: string | null;
  markedCircled?: boolean;
}

export async function updateTake(
  pool: Pool,
  takeId: string,
  patch: UpdateTakeInput,
): Promise<CastingTake | null> {
  const sets: string[] = [];
  const params: unknown[] = [takeId];
  if (patch.shotListId !== undefined) {
    params.push(patch.shotListId);
    sets.push(`shot_list_id = $${params.length}`);
  }
  if (patch.shotIndex !== undefined) {
    params.push(patch.shotIndex);
    sets.push(`shot_index = $${params.length}`);
  }
  if (patch.takeNumber !== undefined) {
    params.push(patch.takeNumber);
    sets.push(`take_number = $${params.length}`);
  }
  if (patch.notes !== undefined) {
    params.push(patch.notes);
    sets.push(`notes = $${params.length}`);
  }
  if (patch.markedCircled !== undefined) {
    params.push(patch.markedCircled);
    sets.push(`marked_circled = $${params.length}`);
  }
  if (sets.length === 0) return getTake(pool, takeId);

  sets.push("updated_at = NOW()");
  const r = await pool.query<TakeRow>(
    `UPDATE casting_takes SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
    params,
  );
  return r.rows[0] ? rowToTake(r.rows[0]) : null;
}

export async function deleteTake(pool: Pool, takeId: string): Promise<boolean> {
  const take = await getTake(pool, takeId);
  if (!take) return false;

  // Best-effort: slett media fra R2 før DB-rad. Hvis R2-slett feiler, lar
  // vi DB-rad bestå (manuell cleanup) — bedre å ha orphan-rad enn å lekke
  // R2-objekt uten referanse.
  const r2 = getR2();
  if (r2 && take.mediaKey) {
    try {
      await r2.client.send(new DeleteObjectCommand({
        Bucket: r2.cfg.bucket,
        Key: take.mediaKey,
      }));
    } catch (err) {
      console.warn("[coverage-take] R2 delete failed:", err);
    }
  }

  const r = await pool.query(`DELETE FROM casting_takes WHERE id = $1`, [takeId]);
  return (r.rowCount ?? 0) > 0;
}

// ─────────────────────────────────────────────────────────────────────
// Signed read URL — for playback i UI
// ─────────────────────────────────────────────────────────────────────

const readUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function presignTakeReadUrl(mediaKey: string): Promise<string | null> {
  const r2 = getR2();
  if (!r2) return null;

  const cached = readUrlCache.get(mediaKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  try {
    const cmd = new GetObjectCommand({ Bucket: r2.cfg.bucket, Key: mediaKey });
    const url = await getSignedUrl(r2.client, cmd, { expiresIn: READ_URL_TTL_SEC });
    // Cache 50% av TTL så URLs ikke utløper midt i playback
    readUrlCache.set(mediaKey, {
      url,
      expiresAt: Date.now() + (READ_URL_TTL_SEC * 1000) / 2,
    });
    if (readUrlCache.size > 500) readUrlCache.clear();
    return url;
  } catch (err) {
    console.warn("[coverage-take] presign-read failed:", err);
    return null;
  }
}

/**
 * Hjelper for analyse-pipelinen: download til lokal temp-fil. Returnerer
 * stien til en lokal kopi av media-objektet, som callerens må slette.
 */
export async function downloadTakeMediaToTemp(
  mediaKey: string,
  destPath: string,
): Promise<boolean> {
  const r2 = getR2();
  if (!r2) return false;

  try {
    const cmd = new GetObjectCommand({ Bucket: r2.cfg.bucket, Key: mediaKey });
    const response = await r2.client.send(cmd);
    if (!response.Body) return false;

    const fs = await import("fs");
    const stream = response.Body as NodeJS.ReadableStream;
    const writeStream = fs.createWriteStream(destPath);
    await new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on("error", reject);
      writeStream.on("error", reject);
      writeStream.on("finish", () => resolve());
    });
    return true;
  } catch (err) {
    console.warn("[coverage-take] download failed:", err);
    return false;
  }
}
