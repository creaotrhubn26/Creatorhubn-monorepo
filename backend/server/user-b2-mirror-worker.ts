/**
 * user-b2-mirror-worker.ts
 *
 * Mirror-skriving av brukers opplastinger til BRUKERENS EGNE B2-bucket.
 *
 * Hvorfor finnes denne?
 *   - Default-flyt: bruker laster opp foto/video → vi lagrer i admin's
 *     Cloudflare R2/Stream. Bra for app-fly, men brukeren har ingen
 *     uavhengig kopi av originalene sine.
 *   - Mål: hvis brukeren har konfigurert egne B2-credentials i
 *     `user_b2_credentials`, mirror-skriv også til DERES bucket.
 *     Da eier de originalene direkte i sin egen Backblaze-konto,
 *     uavhengig av CreatorHub.
 *
 * Designprinsipper:
 *   1. Non-blocking — primær upload (R2/Stream) skal ALDRI feile pga
 *      B2-mirror. Mirror-call er fire-and-forget; alle exceptions
 *      catches og logges.
 *   2. Skip silent — hvis bruker ikke har creds, eller creds er
 *      is_active=FALSE eller is_verified=FALSE → mirror skippes uten
 *      å lage støy.
 *   3. Best-effort — hvis B2-PUT feiler logges det. (TODO i fremtid:
 *      legg jobben i en persistent retry-kø med backoff.)
 *   4. Same crypto-konstanter som `user-b2-credentials-routes.ts` —
 *      dekryptering må bruke EKSAKT samme HKDF_INFO + KEK-derivasjon
 *      ellers feiler GCM auth-tag-sjekken.
 *
 * Threat-model:
 *   - decrypt-feil betyr at en mirror-jobb dør stille (med logg). Vi
 *     vil aldri stoppe brukerens upload pga mirror-feil.
 *   - Hvis admin-bucket og bruker-bucket ender opp ut-av-sync, er det
 *     bare admin-versjonen som er "canonical" for app-flyt. Mirror er
 *     en bonus, ikke en kontrakt.
 */

import type { Pool } from "pg";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  createDecipheriv,
  hkdfSync,
  createHash,
} from "crypto";

// ───────────────────────────────────────────────────────────────────
// Crypto-helpers — MÅ matche user-b2-credentials-routes.ts EKSAKT
// (HKDF_INFO + KEK_LENGTH + AES-GCM-format). Ellers feiler decrypt.
// ───────────────────────────────────────────────────────────────────

const KEK_LENGTH = 32;
const IV_LENGTH_GCM = 12;
const AUTH_TAG_LENGTH = 16;
const HKDF_DIGEST = "sha256";
const HKDF_INFO = Buffer.from("creatorhub-user-b2-credentials-v1", "utf8");

const isHex64 = (s: string): boolean => /^[0-9a-fA-F]{64}$/.test(s);

let masterKekCache: Buffer | null = null;

function getMasterKek(): Buffer | null {
  if (masterKekCache) return masterKekCache;
  const raw = process.env.STORAGE_MASTER_KEK_HEX;
  if (!raw || raw.trim().length === 0) return null;
  if (!isHex64(raw.trim())) {
    // Logg én gang og returner null — vi vil ikke spamme loggen for hver mirror-call
    console.error(
      "[b2-mirror] STORAGE_MASTER_KEK_HEX må være eksakt 64 hex-tegn",
    );
    return null;
  }
  masterKekCache = Buffer.from(raw.trim(), "hex");
  return masterKekCache;
}

function deriveUserKek(userId: string): Buffer {
  const master = getMasterKek();
  if (!master) throw new Error("encryption_not_configured");
  const salt = createHash("sha256").update(userId).digest();
  return Buffer.from(hkdfSync(HKDF_DIGEST, master, salt, HKDF_INFO, KEK_LENGTH));
}

function decryptForUser(packedBase64: string, userKek: Buffer): string {
  const buf = Buffer.from(packedBase64, "base64");
  if (buf.length < IV_LENGTH_GCM + AUTH_TAG_LENGTH) {
    throw new Error("ciphertext_invalid_length");
  }
  const iv = buf.subarray(0, IV_LENGTH_GCM);
  const tag = buf.subarray(IV_LENGTH_GCM, IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH_GCM + AUTH_TAG_LENGTH);
  const dec = createDecipheriv("aes-256-gcm", userKek, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct), dec.final()]).toString("utf8");
}

// ───────────────────────────────────────────────────────────────────
// Mirror-jobb + kø
// ───────────────────────────────────────────────────────────────────

export type MirrorSource =
  | "gallery"
  | "post-agent"
  | "role-room"
  | "admin-upload"
  | "chunked-upload"
  | "single-upload"
  | "talent-media"
  | "marketing-preview"
  | "selftape";

export interface MirrorJob {
  userId: string;
  source: MirrorSource;
  sourceId: string;
  fileName: string;
  contentType?: string | null;
  // Hentes via fetch hvis ingen buffer er satt
  primaryUrl?: string;
  // Hvis caller har innholdet i minnet er det raskere å gi det direkte
  buffer?: Buffer;
}

interface MirrorParams {
  userId: string;
  source: MirrorSource;
  sourceId: string;
  fileName: string;
  contentType?: string | null;
  primaryUrl?: string;
  buffer?: Buffer;
}

// In-memory FIFO. Vi bytter til persistent kø (Postgres-tabell + cron)
// hvis Render-restarts begynner å spise jobber, men for nå er mirroring
// best-effort og det er greit å miste en og annen jobb.
const mirrorQueue: MirrorJob[] = [];
let isProcessing = false;

// Test-hook: la enhetstest kunne vente på at køen drenes
let drainPromise: Promise<void> | null = null;
let drainResolve: (() => void) | null = null;

export function _b2MirrorQueueDepth(): number {
  return mirrorQueue.length;
}

export function _b2MirrorWaitForDrain(): Promise<void> {
  if (!isProcessing && mirrorQueue.length === 0) return Promise.resolve();
  if (drainPromise) return drainPromise;
  drainPromise = new Promise<void>((resolve) => {
    drainResolve = resolve;
  });
  return drainPromise;
}

/**
 * Sett en mirror-jobb i kø. Returnerer umiddelbart — selve mirror-skrivingen
 * skjer i bakgrunnen. Kallere SKAL bruke `void` foran kallet for å markere
 * fire-and-forget.
 */
export function enqueueMirrorToUserB2(pool: Pool, job: MirrorJob): void {
  // Defensive: minst userId, sourceId og fileName må være satt
  if (!job.userId || !job.sourceId || !job.fileName) {
    console.warn("[b2-mirror] dropping malformed job:", {
      hasUserId: !!job.userId,
      hasSourceId: !!job.sourceId,
      hasFileName: !!job.fileName,
    });
    return;
  }
  if (!job.buffer && !job.primaryUrl) {
    console.warn("[b2-mirror] dropping job — neither buffer nor primaryUrl set:", {
      userId: job.userId,
      source: job.source,
      sourceId: job.sourceId,
    });
    return;
  }
  mirrorQueue.push(job);
  if (!isProcessing) {
    void processQueue(pool);
  }
}

/**
 * Convenience-wrapper: samme API som dokumentert i RFC-en. Tar deps-objekt
 * (matcher mønstret andre helpers bruker) og params. Fire-and-forget.
 */
export function mirrorUploadToUserB2(
  deps: { pool: Pool },
  params: MirrorParams,
): void {
  enqueueMirrorToUserB2(deps.pool, params);
}

async function processQueue(pool: Pool): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  try {
    while (mirrorQueue.length > 0) {
      const job = mirrorQueue.shift()!;
      try {
        await processJob(pool, job);
      } catch (err) {
        console.error(
          `[b2-mirror] job ${job.userId}/${job.source}/${job.sourceId} failed:`,
          err,
        );
      }
    }
  } finally {
    isProcessing = false;
    if (drainResolve) {
      const r = drainResolve;
      drainResolve = null;
      drainPromise = null;
      r();
    }
  }
}

function defaultEndpointFor(region: string): string {
  return `https://s3.${region}.backblazeb2.com`;
}

function isUndefinedTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "42P01" ||
    /relation "user_b2_(credentials|files)" does not exist/i.test(
      e?.message || "",
    )
  );
}

interface UserB2CredsRow {
  bucket_name: string;
  key_id_encrypted: string;
  app_key_encrypted: string;
  region: string | null;
  endpoint_url: string | null;
}

async function loadUserCreds(
  pool: Pool,
  userId: string,
): Promise<UserB2CredsRow | null> {
  try {
    const result = await pool.query(
      `SELECT bucket_name, key_id_encrypted, app_key_encrypted, region, endpoint_url
         FROM user_b2_credentials
        WHERE user_id = $1::uuid
          AND is_active = TRUE
          AND is_verified = TRUE
        LIMIT 1`,
      [userId],
    );
    if (result.rowCount === 0) return null;
    return result.rows[0] as UserB2CredsRow;
  } catch (err) {
    if (isUndefinedTableError(err)) {
      // Migrasjon ikke kjørt — skip silent, vi vil ikke logge en gang per
      // upload. processQueue logger uansett feilen.
      return null;
    }
    throw err;
  }
}

async function processJob(pool: Pool, job: MirrorJob): Promise<void> {
  // Sjekk om bruker har aktive verifiserte B2-creds. Ellers — skip silent.
  const creds = await loadUserCreds(pool, job.userId);
  if (!creds) return;

  if (!getMasterKek()) {
    // Master-KEK mangler på serveren — vi kan ikke dekryptere brukerens
    // creds, så vi kan ikke mirror. Skip silent.
    console.warn(
      "[b2-mirror] STORAGE_MASTER_KEK_HEX ikke satt — skipper mirror for",
      job.userId,
    );
    return;
  }

  const userKek = deriveUserKek(job.userId);
  let keyId: string;
  let appKey: string;
  try {
    keyId = decryptForUser(creds.key_id_encrypted, userKek);
    appKey = decryptForUser(creds.app_key_encrypted, userKek);
  } catch (err) {
    console.warn("[b2-mirror] decrypt creds failed for", job.userId, err);
    return;
  }

  const region = creds.region || "us-west-001";
  const endpoint = creds.endpoint_url || defaultEndpointFor(region);

  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    forcePathStyle: true,
  });

  // Hent innholdet
  let body: Buffer;
  let sizeBytes: number;
  if (job.buffer) {
    body = job.buffer;
    sizeBytes = job.buffer.length;
  } else if (job.primaryUrl) {
    const resp = await fetch(job.primaryUrl);
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch primary (${resp.status}): ${job.primaryUrl.slice(0, 120)}`,
      );
    }
    const arrayBuf = await resp.arrayBuffer();
    body = Buffer.from(arrayBuf);
    sizeBytes = body.length;
  } else {
    throw new Error("no_source_content");
  }

  // Sanér filnavn til S3-vennlig form. Behold path-segmenter sånn at
  // creatorhub-uploads/<source>/<sourceId>/<fileName> ser logisk ut.
  const safeFileName = job.fileName
    .replace(/[\\/]+/g, "_")
    .replace(/[^A-Za-z0-9._\-() ]+/g, "-")
    .slice(0, 200) || "upload.bin";

  const targetKey = `creatorhub-uploads/${job.source}/${job.sourceId}/${safeFileName}`;
  const contentType = job.contentType || "application/octet-stream";

  await s3.send(
    new PutObjectCommand({
      Bucket: creds.bucket_name,
      Key: targetKey,
      Body: body,
      ContentType: contentType,
      Metadata: {
        "creatorhub-source": job.source,
        "creatorhub-source-id": job.sourceId,
        "creatorhub-user-id": job.userId,
        "mirrored-at": new Date().toISOString(),
      },
    }),
  );

  // Registrer i user_b2_files (best-effort; tabellen finnes kanskje ikke
  // ennå — en fremtidig migrasjon kan legge den til for cost-tracking).
  try {
    await pool.query(
      `INSERT INTO user_b2_files (
         user_id, file_key, file_name, size_bytes, content_type,
         source, source_id, mirrored_at, last_seen_at, is_deleted
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6, $7, now(), now(), FALSE
       )
       ON CONFLICT (user_id, file_key) DO UPDATE SET
         last_seen_at = now(),
         size_bytes = EXCLUDED.size_bytes,
         is_deleted = FALSE`,
      [
        job.userId,
        targetKey,
        safeFileName,
        sizeBytes,
        contentType,
        job.source,
        job.sourceId,
      ],
    );
  } catch (err) {
    if (!isUndefinedTableError(err)) {
      // Tabellen finnes men insert feilet — logg, men ikke kast (mirror
      // er allerede ferdig på B2-siden, ledger-feilen er ikke dødelig)
      console.warn("[b2-mirror] user_b2_files insert failed:", err);
    }
    // Hvis tabellen ikke finnes: skip silent
  }

  console.info("[b2-mirror] mirrored", {
    userId: job.userId,
    source: job.source,
    sourceId: job.sourceId,
    key: targetKey,
    size: sizeBytes,
  });
}
