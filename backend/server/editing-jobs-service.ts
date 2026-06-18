/**
 * editing-jobs-service.ts
 *
 * Kjernelogikk for redigerings-marketplace (Foto & Video): sikker filflyt
 * mellom ekstern redigeringsvendor og fotografens egen B2-konto.
 *
 * Sikkerhetsmodell (se discovery-plan 2026-06-18):
 *   - Vendor får ALDRI fotografens B2-credentials eller skrivetilgang til
 *     kundens bøtte.
 *   - Vendor laster opp til en Creatorhub-styrt STAGING-bøtte (Role Room B2,
 *     eu-central-003) under prefix `editing-staging/{jobId}/`, via en
 *     SCOPED, kortlivet, revokerbar opplastings-token.
 *   - Ved levering kopierer backend server-side: GET fra staging -> PUT inn i
 *     fotografens egen B2-bøtte (creds dekryptert via getByoCreds). Filene
 *     strømmes gjennom backend (cross-account, så CopyObject duger ikke).
 *   - Staging-filer slettes etter vellykket kopi (GDPR-rent).
 *
 * Token: opak (crypto.randomBytes), kun sha256-hash lagres i
 * editing_jobs.upload_token_jti. Revoker ved å nulle kolonnen.
 */

import type { Pool } from "pg";
import { randomBytes, createHash } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getByoCreds } from "./role-room-byo-storage-service";

// ─────────────────────────────────────────────────────────────────────
// Staging-bøtte: Creatorhub-styrt Role Room B2 (samme env som b2-archive)
// ─────────────────────────────────────────────────────────────────────
const STAGING_REGION = process.env.B2_REGION || "eu-central-003";
const STAGING_ENDPOINT = `https://s3.${STAGING_REGION}.backblazeb2.com`;

function getStagingClient(): { client: S3Client; bucket: string } | null {
  const keyId = process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID;
  const appKey = process.env.B2_ROLE_ROOM_APPLICATION_KEY;
  const bucket = process.env.B2_ROLE_ROOM_BUCKET_NAME;
  if (!keyId || !appKey || !bucket) return null;
  const client = new S3Client({
    region: STAGING_REGION,
    endpoint: STAGING_ENDPOINT,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    forcePathStyle: true,
  });
  return { client, bucket };
}

export function stagingPrefix(jobId: string): string {
  return `editing-staging/${jobId}/`;
}

/** Sanitize filnavn til trygt key-segment (behold extension). */
export function safeFileName(name: string): string {
  const cleaned = (name || "file")
    .replace(/[æå]/gi, "a")
    .replace(/[øö]/gi, "o")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 140) || "file";
}

// ─────────────────────────────────────────────────────────────────────
// Opplastings-token (scoped pr. jobb, kortlivet, revokerbar)
// ─────────────────────────────────────────────────────────────────────
const DEFAULT_TOKEN_TTL_DAYS = 7;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Mint en ny opplastings-token for en jobb. Lagrer KUN hashen + utløp på
 * jobben (revoker ved å nulle upload_token_jti). Returnerer klartekst-token
 * (vises kun denne ene gangen til vendor).
 */
export async function mintUploadToken(
  pool: Pool,
  jobId: string,
  ttlDays = DEFAULT_TOKEN_TTL_DAYS,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await pool.query(
    `UPDATE editing_jobs
        SET upload_token_jti = $2,
            upload_token_expires_at = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [jobId, hashToken(token), expiresAt],
  );
  return { token, expiresAt };
}

/**
 * Slå opp en jobb fra en opplastings-token. Returnerer jobb-id hvis token
 * er gyldig, matcher jobben og ikke er utløpt — ellers null.
 */
export async function resolveJobFromUploadToken(
  pool: Pool,
  jobId: string,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  const r = await pool.query<{ upload_token_jti: string | null; upload_token_expires_at: Date | null }>(
    `SELECT upload_token_jti, upload_token_expires_at FROM editing_jobs WHERE id = $1`,
    [jobId],
  );
  const row = r.rows[0];
  if (!row || !row.upload_token_jti || !row.upload_token_expires_at) return false;
  if (new Date(row.upload_token_expires_at).getTime() < Date.now()) return false;
  return row.upload_token_jti === hashToken(token);
}

export async function revokeUploadToken(pool: Pool, jobId: string): Promise<void> {
  await pool.query(
    `UPDATE editing_jobs SET upload_token_jti = NULL, upload_token_expires_at = NULL, updated_at = NOW() WHERE id = $1`,
    [jobId],
  );
}

// ─────────────────────────────────────────────────────────────────────
// Staging-operasjoner (presigned PUT for vendor, GET/DELETE for backend)
// ─────────────────────────────────────────────────────────────────────

/** Presignert PUT-URL for at vendor laster ferdig fil opp til staging. */
export async function presignStagingUpload(
  jobId: string,
  fileName: string,
  contentType: string,
  expiresInSeconds = 3600,
): Promise<{ url: string; key: string; bucket: string } | null> {
  const cfg = getStagingClient();
  if (!cfg) return null;
  const key = `${stagingPrefix(jobId)}${safeFileName(fileName)}`;
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });
  const url = await getSignedUrl(cfg.client, command, { expiresIn: expiresInSeconds });
  return { url, key, bucket: cfg.bucket };
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  const maybe = body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
  if (maybe?.transformToByteArray) {
    return Buffer.from(await maybe.transformToByteArray());
  }
  // Fallback for Node-stream bodies
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = body as NodeJS.ReadableStream;
    stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return Buffer.concat(chunks);
}

export interface TransferResult {
  ok: boolean;
  copied: number;
  failed: number;
  error?: string;
  destinationBucket?: string;
}

/**
 * Server-side overføring: kopier alle staged filer for en jobb fra
 * Creatorhub staging-bøtte -> fotografens egen B2-bøtte. Strømmer gjennom
 * backend (cross-account). Sletter staging-fil etter vellykket kopi.
 *
 * Returnerer aldri kast — feil per fil registreres på editing_job_files.
 */
export async function transferStagingToPhotographer(
  pool: Pool,
  jobId: string,
  photographerId: string,
): Promise<TransferResult> {
  const stagingCfg = getStagingClient();
  if (!stagingCfg) {
    return { ok: false, copied: 0, failed: 0, error: "staging_not_configured" };
  }

  const byo = await getByoCreds(pool, photographerId);
  if (!byo) {
    return { ok: false, copied: 0, failed: 0, error: "photographer_b2_not_connected" };
  }
  const destClient = new S3Client({
    region: byo.region,
    endpoint: byo.endpointUrl || `https://s3.${byo.region}.backblazeb2.com`,
    credentials: { accessKeyId: byo.keyId, secretAccessKey: byo.applicationKey },
    forcePathStyle: true,
  });

  const files = await pool.query<{ id: string; file_name: string; staging_key: string | null; content_type: string | null }>(
    `SELECT id, file_name, staging_key, content_type
       FROM editing_job_files
      WHERE job_id = $1 AND transfer_status IN ('staged', 'failed')`,
    [jobId],
  );

  let copied = 0;
  let failed = 0;
  for (const f of files.rows) {
    if (!f.staging_key) {
      failed++;
      continue;
    }
    try {
      await pool.query(
        `UPDATE editing_job_files SET transfer_status = 'copying' WHERE id = $1`,
        [f.id],
      );
      const obj = await stagingCfg.client.send(
        new GetObjectCommand({ Bucket: stagingCfg.bucket, Key: f.staging_key }),
      );
      const buf = await streamToBuffer(obj.Body);
      const destKey = `deliveries/editing/${jobId}/${safeFileName(f.file_name)}`;
      await destClient.send(
        new PutObjectCommand({
          Bucket: byo.bucketName,
          Key: destKey,
          Body: buf,
          ContentType: f.content_type || obj.ContentType || "application/octet-stream",
        }),
      );
      // Slett staging-fil etter vellykket kopi (GDPR-rent)
      let purged = true;
      try {
        await stagingCfg.client.send(
          new DeleteObjectCommand({ Bucket: stagingCfg.bucket, Key: f.staging_key }),
        );
      } catch {
        purged = false;
      }
      await pool.query(
        `UPDATE editing_job_files
            SET transfer_status = $2, destination_key = $3, size_bytes = $4, copied_at = NOW(), transfer_error = NULL
          WHERE id = $1`,
        [f.id, purged ? "deleted" : "copied", destKey, buf.length],
      );
      copied++;
    } catch (err) {
      failed++;
      await pool.query(
        `UPDATE editing_job_files SET transfer_status = 'failed', transfer_error = $2 WHERE id = $1`,
        [f.id, String((err as Error)?.message ?? err).slice(0, 500)],
      );
    }
  }

  return {
    ok: failed === 0,
    copied,
    failed,
    destinationBucket: byo.bucketName,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Audit-logg
// ─────────────────────────────────────────────────────────────────────
export async function logJobEvent(
  pool: Pool,
  jobId: string,
  eventType: string,
  actor: string | null,
  actorRole: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO editing_job_events (job_id, event_type, actor, actor_role, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [jobId, eventType, actor, actorRole, detail ? JSON.stringify(detail) : null],
    );
  } catch (err) {
    console.warn("[editing-jobs] logJobEvent failed", { jobId, eventType, err: (err as Error).message });
  }
}
