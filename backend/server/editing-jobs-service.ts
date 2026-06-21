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

/**
 * Presignert PUT-URL for at FOTOGRAFEN laster kildefiler (rå-/originaler) opp
 * til staging, slik at redigereren kan hente dem. Lagres under `source/` slik at
 * de aldri forveksles med vendorens leveranse. Nøkkelen returneres og lagres på
 * editing_job_files med file_role='source'.
 */
export async function presignStagingSourceUpload(
  jobId: string,
  fileName: string,
  contentType: string,
  expiresInSeconds = 3600,
): Promise<{ url: string; key: string; bucket: string } | null> {
  const cfg = getStagingClient();
  if (!cfg) return null;
  const key = `${stagingPrefix(jobId)}source/${safeFileName(fileName)}`;
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });
  const url = await getSignedUrl(cfg.client, command, { expiresIn: expiresInSeconds });
  return { url, key, bucket: cfg.bucket };
}

/** Presignert GET-URL fra staging — for at redigereren skal hente en kildefil. */
export async function presignStagingDownload(
  key: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const cfg = getStagingClient();
  if (!cfg || !key) return null;
  const command = new GetObjectCommand({ Bucket: cfg.bucket, Key: key });
  return getSignedUrl(cfg.client, command, { expiresIn: expiresInSeconds });
}

/**
 * Slett kildefiler fra staging (GDPR-rent) når oppdraget er ferdig eller avbrutt.
 * Vendor-leveranser ryddes allerede i transferStagingToPhotographer.
 */
export async function purgeStagingSourceFiles(pool: Pool, jobId: string): Promise<number> {
  const cfg = getStagingClient();
  if (!cfg) return 0;
  const r = await pool.query<{ id: string; staging_key: string | null }>(
    `SELECT id, staging_key FROM editing_job_files
      WHERE job_id = $1 AND file_role = 'source' AND transfer_status <> 'deleted'`,
    [jobId],
  );
  let purged = 0;
  for (const f of r.rows) {
    if (!f.staging_key) continue;
    try {
      await cfg.client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: f.staging_key }));
      await pool.query(`UPDATE editing_job_files SET transfer_status = 'deleted' WHERE id = $1`, [f.id]);
      purged++;
    } catch {
      // beste forsøk — neste opprydding tar den
    }
  }
  return purged;
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
// Showcase-levering: lag klient-galleri fra leverte filer (i fotografens B2)
// ─────────────────────────────────────────────────────────────────────
const GALLERY_URL_TTL = 7 * 24 * 60 * 60; // B2/S3 SigV4-maks (presignert)

export interface GalleryResult {
  ok: boolean;
  galleryId?: string;
  accessToken?: string;
  imageCount?: number;
  error?: string;
}

/**
 * Oppretter et photographer_client_galleries + client_gallery_images fra de
 * leverte redigerings-filene (som ligger i fotografens egen B2 etter overføring).
 * Bilde-URL-er presigneres fra fotografens BYO-B2; key lagres i metadata for
 * senere re-signering (presignert maks 7 dager). Knytter gallery_id på jobben.
 */
export async function createClientGalleryFromJob(
  pool: Pool,
  jobId: string,
  clientName: string,
  clientEmail: string,
): Promise<GalleryResult> {
  const jr = await pool.query<{ photographer_id: string; project_title: string | null; gallery_id: string | null }>(
    `SELECT photographer_id, project_title, gallery_id FROM editing_jobs WHERE id = $1`,
    [jobId],
  );
  const job = jr.rows[0];
  if (!job) return { ok: false, error: "ikke_funnet" };

  const byo = await getByoCreds(pool, job.photographer_id);
  if (!byo) return { ok: false, error: "photographer_b2_not_connected" };
  const client = new S3Client({
    region: byo.region,
    endpoint: byo.endpointUrl || `https://s3.${byo.region}.backblazeb2.com`,
    credentials: { accessKeyId: byo.keyId, secretAccessKey: byo.applicationKey },
    forcePathStyle: true,
  });

  const files = await pool.query<{ file_name: string; destination_key: string | null; content_type: string | null }>(
    `SELECT file_name, destination_key, content_type FROM editing_job_files
      WHERE job_id = $1 AND destination_key IS NOT NULL
      ORDER BY created_at ASC`,
    [jobId],
  );
  if (files.rows.length === 0) return { ok: false, error: "ingen_leverte_filer" };

  // Gjenbruk galleri hvis jobben allerede har ett, ellers opprett nytt
  let galleryId = job.gallery_id || "";
  let accessToken = "";
  if (galleryId) {
    const g = await pool.query<{ access_token: string }>(
      `SELECT access_token FROM photographer_client_galleries WHERE id = $1`,
      [galleryId],
    );
    accessToken = g.rows[0]?.access_token || "";
  }
  if (!galleryId || !accessToken) {
    accessToken = randomBytes(24).toString("base64url");
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO photographer_client_galleries
         (photographer_id, client_name, client_email, project_title, access_token, gallery_settings, status)
       VALUES ($1,$2,$3,$4,$5,$6,'active')
       RETURNING id`,
      [
        job.photographer_id,
        clientName,
        clientEmail.toLowerCase().trim(),
        job.project_title || "Redigert leveranse",
        accessToken,
        JSON.stringify({ source: "editing_job", editingJobId: jobId }),
      ],
    );
    galleryId = ins.rows[0].id;
  }

  let sortOrder = 0;
  for (const f of files.rows) {
    if (!f.destination_key) continue;
    let signed = "";
    try {
      signed = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: byo.bucketName, Key: f.destination_key }),
        { expiresIn: GALLERY_URL_TTL },
      );
    } catch {
      continue;
    }
    await pool.query(
      `INSERT INTO client_gallery_images
         (gallery_id, photographer_id, image_title, thumbnail_url, full_size_url, image_metadata, sort_order)
       VALUES ($1,$2,$3,$4,$4,$5,$6)`,
      [
        galleryId,
        job.photographer_id,
        f.file_name,
        signed,
        // Lagre key+bucket for senere re-signering (presignert URL utløper)
        JSON.stringify({ b2Key: f.destination_key, bucket: byo.bucketName, source: "editing_job" }),
        sortOrder++,
      ],
    );
  }

  await pool.query(`UPDATE editing_jobs SET gallery_id = $2, updated_at = NOW() WHERE id = $1`, [jobId, galleryId]);
  return { ok: true, galleryId, accessToken, imageCount: sortOrder };
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
