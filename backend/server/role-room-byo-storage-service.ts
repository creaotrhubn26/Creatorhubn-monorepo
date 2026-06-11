/**
 * role-room-byo-storage-service.ts
 *
 * L3b — Bring Your Own Backblaze B2.
 *
 * Lar Role Room-brukere koble sin egen B2-konto + bucket. Vi:
 *   1. Validerer at credsen autoriserer (HeadBucket-call)
 *   2. Lagrer krypterte creds i `user_b2_credentials` (migrasjon 256)
 *   3. Setter `role_room_user_buckets.tier = 'byo'` + nullstiller quota
 *   4. Tilbyr 1-klikks migrate fra admin-B2 til user-B2
 *
 * Sikkerhet:
 *   - Creds krypteres med per-user KEK derivert via HKDF fra
 *     STORAGE_MASTER_KEK_HEX (samme nøkkel-hierarki som
 *     user-b2-credentials-routes.ts)
 *   - HKDF_INFO matches user-b2-credentials så vi kan READ-FROM samme tabell
 *
 * Migrate-jobben kjører i bakgrunnen (setImmediate-spawn). En cron-job
 * kunne tatt over for robusthet, men 1-klikks-migrate kjøres typisk
 * < 5 min for < 1 GB filer så in-process worker holder for L3b.
 */

import type { Pool } from "pg";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Match user-b2-credentials-routes.ts crypto-konstanter eksakt
const KEK_LENGTH = 32;
const IV_LENGTH_GCM = 12;
const AUTH_TAG_LENGTH = 16;
const HKDF_DIGEST = "sha256";
const HKDF_INFO = Buffer.from("creatorhub-user-b2-credentials-v1", "utf8");

let masterKekCache: Buffer | null = null;

function getMasterKek(): Buffer | null {
  if (masterKekCache) return masterKekCache;
  const raw = process.env.STORAGE_MASTER_KEK_HEX;
  if (!raw || raw.trim().length === 0) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(raw.trim())) return null;
  masterKekCache = Buffer.from(raw.trim(), "hex");
  return masterKekCache;
}

function deriveUserKek(userId: string): Buffer | null {
  const master = getMasterKek();
  if (!master) return null;
  const salt = createHash("sha256").update(userId).digest();
  return Buffer.from(hkdfSync(HKDF_DIGEST, master, salt, HKDF_INFO, KEK_LENGTH));
}

function encryptForUser(plaintext: string, userKek: Buffer): { ciphertext: string; iv: string } {
  const iv = randomBytes(IV_LENGTH_GCM);
  const cipher = createCipheriv("aes-256-gcm", userKek, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([iv, tag, ct]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

function decryptForUser(packedBase64: string, userKek: Buffer): string {
  const buf = Buffer.from(packedBase64, "base64");
  const iv = buf.subarray(0, IV_LENGTH_GCM);
  const tag = buf.subarray(IV_LENGTH_GCM, IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const dec = createDecipheriv("aes-256-gcm", userKek, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct), dec.final()]).toString("utf8");
}

export interface ByoB2Creds {
  keyId: string;
  applicationKey: string;
  bucketName: string;
  endpointUrl?: string;
  region?: string;
}

function makeByoClient(creds: ByoB2Creds): { client: S3Client; bucket: string } {
  const region = creds.region || "us-west-001";
  const endpoint = creds.endpointUrl || `https://s3.${region}.backblazeb2.com`;
  return {
    client: new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId: creds.keyId, secretAccessKey: creds.applicationKey },
      forcePathStyle: true,
    }),
    bucket: creds.bucketName,
  };
}

function makeAdminB2Client(): { client: S3Client; bucket: string } | null {
  const keyId = process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID;
  const appKey = process.env.B2_ROLE_ROOM_APPLICATION_KEY;
  const bucket = process.env.B2_ROLE_ROOM_BUCKET_NAME;
  if (!keyId || !appKey || !bucket) return null;
  const region = process.env.B2_REGION || "eu-central-003";
  return {
    client: new S3Client({
      region,
      endpoint: `https://s3.${region}.backblazeb2.com`,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      forcePathStyle: true,
    }),
    bucket,
  };
}

/**
 * Test om credsen virker — HeadBucket gir oss både auth-test og
 * bucket-eksistens-test i ett kall.
 */
export async function validateByoB2(creds: ByoB2Creds): Promise<
  | { ok: true; region: string; endpoint: string }
  | { ok: false; error: string }
> {
  try {
    const { client, bucket } = makeByoClient(creds);
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return {
      ok: true,
      region: creds.region || "us-west-001",
      endpoint: creds.endpointUrl || `https://s3.${creds.region || "us-west-001"}.backblazeb2.com`,
    };
  } catch (err) {
    const msg = (err as Error).message || "unknown_error";
    return { ok: false, error: msg };
  }
}

/**
 * Koble brukerens egen B2 + sett tier='byo' på role_room_user_buckets.
 * Pre-condition: validateByoB2 har returnert ok.
 */
export async function connectByoB2(
  pool: Pool,
  opts: { userId: string; creds: ByoB2Creds },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const userKek = deriveUserKek(opts.userId);
  if (!userKek) return { ok: false, reason: "encryption_not_configured" };

  const keyIdPacked = encryptForUser(opts.creds.keyId, userKek);
  const appKeyPacked = encryptForUser(opts.creds.applicationKey, userKek);

  await pool.query(
    `INSERT INTO user_b2_credentials (
       user_id, bucket_name, key_id_encrypted, key_id_iv,
       app_key_encrypted, app_key_iv, endpoint_url, region,
       is_active, is_verified, last_verified_at
     ) VALUES (
       $1::uuid, $2, $3, $4, $5, $6, $7, $8, TRUE, TRUE, NOW()
     )
     ON CONFLICT (user_id) DO UPDATE SET
       bucket_name = EXCLUDED.bucket_name,
       key_id_encrypted = EXCLUDED.key_id_encrypted,
       key_id_iv = EXCLUDED.key_id_iv,
       app_key_encrypted = EXCLUDED.app_key_encrypted,
       app_key_iv = EXCLUDED.app_key_iv,
       endpoint_url = EXCLUDED.endpoint_url,
       region = EXCLUDED.region,
       is_active = TRUE,
       is_verified = TRUE,
       last_verified_at = NOW(),
       last_error = NULL,
       updated_at = NOW()`,
    [
      opts.userId,
      opts.creds.bucketName,
      keyIdPacked.ciphertext, keyIdPacked.iv,
      appKeyPacked.ciphertext, appKeyPacked.iv,
      opts.creds.endpointUrl ?? null,
      opts.creds.region ?? "us-west-001",
    ],
  );

  // Bytt tier til 'byo' + fjern quota
  await pool.query(
    `UPDATE role_room_user_buckets
       SET tier = 'byo', quota_bytes = NULL, updated_at = NOW()
     WHERE user_id = $1::uuid`,
    [opts.userId],
  );

  return { ok: true };
}

/**
 * Koble fra BYO B2 — setter tier tilbake til 'free' med 1 GB quota.
 * Filene blir IKKE migrert automatisk — UI må advare brukeren om at
 * de fortsatt ligger på deres egen B2 og må migreres med direction='from_byo'
 * hvis de vil ha tilbake admin-B2-lagring.
 */
export async function disconnectByoB2(
  pool: Pool,
  opts: { userId: string },
): Promise<void> {
  await pool.query(
    `UPDATE user_b2_credentials SET is_active = FALSE, updated_at = NOW()
     WHERE user_id = $1::uuid`,
    [opts.userId],
  );
  await pool.query(
    `UPDATE role_room_user_buckets
       SET tier = 'free', quota_bytes = 1073741824, updated_at = NOW()
     WHERE user_id = $1::uuid`,
    [opts.userId],
  );
}

/**
 * Hent BYO B2-creds for en bruker — dekrypterer. Brukes av migrate-worker
 * og av storage-helper som vil bruke BYO som default-target.
 */
export async function getByoCreds(
  pool: Pool,
  userId: string,
): Promise<ByoB2Creds | null> {
  const userKek = deriveUserKek(userId);
  if (!userKek) return null;
  const r = await pool.query<{
    bucket_name: string;
    key_id_encrypted: string;
    app_key_encrypted: string;
    endpoint_url: string | null;
    region: string;
  }>(
    `SELECT bucket_name, key_id_encrypted, app_key_encrypted, endpoint_url, region
     FROM user_b2_credentials
     WHERE user_id = $1::uuid AND is_active = TRUE`,
    [userId],
  );
  const row = r.rows[0];
  if (!row) return null;
  try {
    return {
      keyId: decryptForUser(row.key_id_encrypted, userKek),
      applicationKey: decryptForUser(row.app_key_encrypted, userKek),
      bucketName: row.bucket_name,
      endpointUrl: row.endpoint_url ?? undefined,
      region: row.region,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Migrate-jobber
// ─────────────────────────────────────────────────────────────────────

export interface MigrationJob {
  id: string;
  userId: string;
  direction: 'to_byo' | 'from_byo';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled';
  totalFiles: number;
  totalBytes: number;
  filesCompleted: number;
  filesFailed: number;
  bytesCompleted: number;
  errors: Array<{ fileId: string; b2Key: string; error: string }>;
  startedAt: string | null;
  completedAt: string | null;
  statusMessage: string | null;
  createdAt: string;
}

export async function getActiveMigration(
  pool: Pool,
  userId: string,
): Promise<MigrationJob | null> {
  const r = await pool.query(
    `SELECT id, user_id, direction, status, total_files, total_bytes,
            files_completed, files_failed, bytes_completed, errors,
            started_at, completed_at, status_message, created_at
     FROM role_room_byo_migration_jobs
     WHERE user_id = $1::uuid
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    direction: row.direction,
    status: row.status,
    totalFiles: row.total_files,
    totalBytes: Number(row.total_bytes),
    filesCompleted: row.files_completed,
    filesFailed: row.files_failed,
    bytesCompleted: Number(row.bytes_completed),
    errors: row.errors ?? [],
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    statusMessage: row.status_message,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Start migrasjon admin-B2 → user-BYO-B2.
 * Returnerer jobId direkte; brukeren poller status via getActiveMigration.
 */
export async function startMigrationToByo(
  pool: Pool,
  userId: string,
): Promise<{ ok: true; jobId: string } | { ok: false; reason: string }> {
  // Sjekk at BYO er konfigurert
  const creds = await getByoCreds(pool, userId);
  if (!creds) return { ok: false, reason: "byo_not_configured" };

  // Pre-flight: tell antall filer + total-bytes
  const summary = await pool.query<{ files: number; bytes: string | null }>(
    `SELECT COUNT(*)::int AS files, COALESCE(SUM(size_bytes), 0)::text AS bytes
     FROM role_room_user_files
     WHERE user_id = $1::uuid AND deleted_at IS NULL`,
    [userId],
  );
  const totalFiles = summary.rows[0].files;
  const totalBytes = Number(summary.rows[0].bytes ?? "0");

  // Opprett job
  const j = await pool.query<{ id: string }>(
    `INSERT INTO role_room_byo_migration_jobs (
       user_id, direction, status, total_files, total_bytes, started_at, status_message
     ) VALUES ($1::uuid, 'to_byo', 'running', $2, $3::bigint, NOW(), 'Starter migrasjon …')
     ON CONFLICT (user_id) WHERE status IN ('queued','running') DO NOTHING
     RETURNING id`,
    [userId, totalFiles, totalBytes],
  );
  if (j.rows.length === 0) {
    return { ok: false, reason: "migration_already_running" };
  }
  const jobId = j.rows[0].id;

  // Spawn worker (fire-and-forget — kjører i samme prosess)
  void runMigrationWorker(pool, jobId, userId, creds).catch((err) => {
    console.error("[byo-migrate] worker crashed", { jobId, err });
    void pool.query(
      `UPDATE role_room_byo_migration_jobs
         SET status = 'failed', status_message = $1, completed_at = NOW()
       WHERE id = $2::uuid`,
      [`Worker crash: ${(err as Error).message}`.slice(0, 500), jobId],
    );
  });

  return { ok: true, jobId };
}

async function runMigrationWorker(
  pool: Pool,
  jobId: string,
  userId: string,
  creds: ByoB2Creds,
): Promise<void> {
  const admin = makeAdminB2Client();
  if (!admin) {
    await pool.query(
      `UPDATE role_room_byo_migration_jobs
         SET status='failed', status_message='Admin-B2 ikke konfigurert', completed_at=NOW()
       WHERE id = $1::uuid`,
      [jobId],
    );
    return;
  }
  const byo = makeByoClient(creds);

  // Hent alle filer for brukeren
  const filesRes = await pool.query<{
    id: string; b2_key: string; size_bytes: string; content_type: string | null;
  }>(
    `SELECT id, b2_key, size_bytes, content_type
     FROM role_room_user_files
     WHERE user_id = $1::uuid AND deleted_at IS NULL
     ORDER BY uploaded_at ASC`,
    [userId],
  );
  const files = filesRes.rows;

  for (const f of files) {
    try {
      // Read from admin-B2
      const getResp = await admin.client.send(
        new GetObjectCommand({ Bucket: admin.bucket, Key: f.b2_key }),
      );
      const bytes = await (getResp.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined)
        ?.transformToByteArray?.();
      if (!bytes) throw new Error("get_returned_empty_body");

      // Mål BYO-key — samme som admin (vi flytter prefiks-strukturen 1:1)
      const targetKey = f.b2_key;

      // Write to BYO
      await byo.client.send(
        new PutObjectCommand({
          Bucket: byo.bucket,
          Key: targetKey,
          Body: Buffer.from(bytes),
          ContentType: f.content_type ?? undefined,
        }),
      );

      // Delete from admin (kun etter vellykket write)
      try {
        await admin.client.send(
          new DeleteObjectCommand({ Bucket: admin.bucket, Key: f.b2_key }),
        );
      } catch {
        // Logger til notes, men teller ikke som feil — filen er allerede i BYO
      }

      await pool.query(
        `UPDATE role_room_byo_migration_jobs
           SET files_completed = files_completed + 1,
               bytes_completed = bytes_completed + $1::bigint,
               status_message = $2
         WHERE id = $3::uuid`,
        [f.size_bytes, `Migrerte ${f.b2_key}`, jobId],
      );
    } catch (err) {
      const message = (err as Error).message?.slice(0, 200) ?? "unknown";
      await pool.query(
        `UPDATE role_room_byo_migration_jobs
           SET files_failed = files_failed + 1,
               errors = errors || jsonb_build_array(
                 jsonb_build_object('fileId', $1::text, 'b2Key', $2::text, 'error', $3::text)
               ),
               status_message = $4
         WHERE id = $5::uuid`,
        [f.id, f.b2_key, message, `Feilet på ${f.b2_key}: ${message}`, jobId],
      );
    }
  }

  // Final status
  const summary = await pool.query<{ files_completed: number; files_failed: number; total_files: number }>(
    `SELECT files_completed, files_failed, total_files
     FROM role_room_byo_migration_jobs WHERE id = $1::uuid`,
    [jobId],
  );
  const row = summary.rows[0];
  const finalStatus = row.files_failed === 0
    ? 'completed'
    : row.files_completed === 0
      ? 'failed'
      : 'partial';

  await pool.query(
    `UPDATE role_room_byo_migration_jobs
       SET status = $1, completed_at = NOW(),
           status_message = $2
     WHERE id = $3::uuid`,
    [
      finalStatus,
      `Ferdig: ${row.files_completed}/${row.total_files} OK, ${row.files_failed} feilet.`,
      jobId,
    ],
  );
}
