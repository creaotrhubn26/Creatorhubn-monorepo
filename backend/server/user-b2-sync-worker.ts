/**
 * user-b2-sync-worker.ts
 *
 * Periodisk sync av brukerens egen Backblaze B2-bucket mot vår
 * `user_b2_files`-tabell. Backblaze gir oss ingen webhook, så vi må
 * pollere bucketen for å vite hva som faktisk ligger der.
 *
 * Hver sync:
 *   1. Lister alle objekter i bucketen (ListObjectsV2, paginated)
 *   2. Upserter rad pr fil — bumper `last_seen_at` til nå
 *   3. Markerer rader som IKKE ble sett som `is_deleted = TRUE`
 *      (brukeren har trolig slettet dem manuelt i B2 web-UI)
 *   4. Skriver en sammendrags-rad i `user_b2_sync_runs`
 *
 * Krypterings-modell speiler `user-b2-credentials-routes.ts`:
 *   - Master KEK = STORAGE_MASTER_KEK_HEX (64 hex-tegn)
 *   - Per-bruker KEK = HKDF(masterKek, salt=sha256(userId), info=…)
 *   - AES-256-GCM med 12-byte IV; packed = base64(iv || tag || ciphertext)
 *
 * Sync trigges på 3 måter:
 *   a) cron — `startB2SyncCron(pool)` kjører hvert 6. time for alle
 *      brukere med aktive + verifiserte credentials
 *   b) manuelt — `POST /api/user/b2-credentials/sync` setIntermediate'r
 *      `runUserB2Sync(pool, userId)`
 *   c) testing — kalles direkte fra unit-tester
 */

import type { Pool } from "pg";
import {
  S3Client,
  ListObjectsV2Command,
  type _Object,
} from "@aws-sdk/client-s3";
import { createHash, hkdfSync, createDecipheriv } from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ───────────────────────────────────────────────────────────────────
// Crypto-helpers — MÅ være konsistente med user-b2-credentials-routes.ts
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
    console.error(
      "[user-b2-sync-worker] STORAGE_MASTER_KEK_HEX må være eksakt 64 hex-tegn (32 bytes)",
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

function decryptCredentials(
  userId: string,
  encryptedKeyId: string,
  encryptedAppKey: string,
): { keyId: string; appKey: string } {
  const userKek = deriveUserKek(userId);
  const keyId = decryptForUser(encryptedKeyId, userKek);
  const appKey = decryptForUser(encryptedAppKey, userKek);
  return { keyId, appKey };
}

// ───────────────────────────────────────────────────────────────────
// Sync-logikk
// ───────────────────────────────────────────────────────────────────

interface UserB2CredsRow {
  bucket_name: string;
  key_id_encrypted: string;
  app_key_encrypted: string;
  region: string | null;
  endpoint_url: string | null;
}

function defaultEndpointFor(region: string): string {
  return `https://s3.${region}.backblazeb2.com`;
}

function isUndefinedTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "42P01" ||
    /relation "user_b2_files" does not exist/i.test(e?.message || "") ||
    /relation "user_b2_sync_runs" does not exist/i.test(e?.message || "") ||
    /relation "user_b2_credentials" does not exist/i.test(e?.message || "")
  );
}

/**
 * Kjør én sync for én bruker. Returnerer når synken er ferdig eller
 * feilet — caller bør kalle via setImmediate hvis de ikke vil vente.
 *
 * Idempotent: gjentatte kall lager bare nye `user_b2_sync_runs`-rader.
 * Ingen rad-låser på `user_b2_files` — UPSERT er trygt under samtidighet.
 *
 * Hvis `existingRunId` er satt, gjenbruker vi den raden (typisk når
 * /api/.../sync endpoint allerede har pre-INSERTet en rad for å kunne
 * returnere runId synkront).
 */
export async function runUserB2Sync(
  pool: Pool,
  userId: string,
  existingRunId?: string,
): Promise<void> {
  // Start sync-run-rad (eller gjenbruk eksisterende)
  let runId: string;
  if (existingRunId) {
    runId = existingRunId;
  } else {
    try {
      const runRes = await pool.query<{ id: string }>(
        `INSERT INTO user_b2_sync_runs (user_id) VALUES ($1::uuid) RETURNING id`,
        [userId],
      );
      runId = runRes.rows[0].id;
    } catch (e) {
      if (isUndefinedTableError(e)) {
        console.warn(
          "[user-b2-sync-worker] sync-tabellene mangler — migrasjon 257 ikke kjørt",
        );
        return;
      }
      console.error("[user-b2-sync-worker] kunne ikke starte sync-run:", e);
      return;
    }
  }

  try {
    // Hent + dekrypter credentials
    let creds: UserB2CredsRow | undefined;
    try {
      const credsRes = await pool.query<UserB2CredsRow>(
        `SELECT bucket_name, key_id_encrypted, app_key_encrypted, region, endpoint_url
           FROM user_b2_credentials
          WHERE user_id = $1::uuid AND is_active = TRUE
          LIMIT 1`,
        [userId],
      );
      creds = credsRes.rows[0];
    } catch (e) {
      if (isUndefinedTableError(e)) {
        await pool.query(
          `UPDATE user_b2_sync_runs SET status='failed', finished_at=now(),
             error_message='table_missing' WHERE id=$1::uuid`,
          [runId],
        );
        return;
      }
      throw e;
    }

    if (!creds) {
      await pool.query(
        `UPDATE user_b2_sync_runs SET status='failed', finished_at=now(),
           error_message='no_credentials' WHERE id=$1::uuid`,
        [runId],
      );
      return;
    }

    if (!getMasterKek()) {
      await pool.query(
        `UPDATE user_b2_sync_runs SET status='failed', finished_at=now(),
           error_message='encryption_not_configured' WHERE id=$1::uuid`,
        [runId],
      );
      return;
    }

    const { keyId, appKey } = decryptCredentials(
      userId,
      creds.key_id_encrypted,
      creds.app_key_encrypted,
    );
    const region = creds.region || "us-west-001";
    const endpointUrl = creds.endpoint_url || defaultEndpointFor(region);

    const s3 = new S3Client({
      region,
      endpoint: endpointUrl,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      forcePathStyle: true,
    });

    // List alle objekter (paginated)
    let continuationToken: string | undefined = undefined;
    const seenKeys: string[] = [];
    let totalBytes = 0;
    let filesSeen = 0;
    let filesAdded = 0;

    do {
      const cmd: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: creds.bucket_name,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const result = await s3.send(cmd);
      const contents: _Object[] = result.Contents || [];
      for (const obj of contents) {
        if (!obj.Key) continue;
        seenKeys.push(obj.Key);
        filesSeen += 1;
        totalBytes += obj.Size || 0;

        // Upsert: ny → insert, eksisterende → bump last_seen_at + størrelse
        // RETURNING (xmax = 0) gir oss "var dette en insert?"
        const ins = await pool.query<{ inserted: boolean }>(
          `INSERT INTO user_b2_files
             (user_id, file_key, file_name, size_bytes, source, last_seen_at)
           VALUES ($1::uuid, $2, $3, $4, 'b2-sync', now())
           ON CONFLICT (user_id, file_key) DO UPDATE SET
             last_seen_at = now(),
             size_bytes = EXCLUDED.size_bytes,
             is_deleted = FALSE,
             deleted_at = NULL
           RETURNING (xmax = 0) AS inserted`,
          [
            userId,
            obj.Key,
            obj.Key.split("/").pop() || obj.Key,
            obj.Size || 0,
          ],
        );
        if (ins.rows[0]?.inserted) filesAdded += 1;
      }
      continuationToken = result.IsTruncated
        ? result.NextContinuationToken
        : undefined;
    } while (continuationToken);

    // Marker filer som ikke ble sett som slettet (manuell sletting i B2)
    let filesMarkedDeleted = 0;
    if (seenKeys.length > 0) {
      // Vi har sett noen filer — flag alle OTHERS som slettet
      const placeholders = seenKeys.map((_, i) => `$${i + 2}`).join(",");
      const markRes = await pool.query(
        `UPDATE user_b2_files
            SET is_deleted = TRUE, deleted_at = now()
          WHERE user_id = $1::uuid
            AND is_deleted = FALSE
            AND file_key NOT IN (${placeholders})`,
        [userId, ...seenKeys],
      );
      filesMarkedDeleted = markRes.rowCount || 0;
    } else {
      // Bucketen er TOM — marker ALT som slettet
      const markRes = await pool.query(
        `UPDATE user_b2_files
            SET is_deleted = TRUE, deleted_at = now()
          WHERE user_id = $1::uuid AND is_deleted = FALSE`,
        [userId],
      );
      filesMarkedDeleted = markRes.rowCount || 0;
    }

    await pool.query(
      `UPDATE user_b2_sync_runs SET
         status='success', finished_at=now(),
         files_seen=$2, files_added=$3,
         files_marked_deleted=$4, total_bytes=$5
       WHERE id=$1::uuid`,
      [runId, filesSeen, filesAdded, filesMarkedDeleted, totalBytes],
    );

    console.info(
      `[user-b2-sync-worker] user=${userId} success: seen=${filesSeen} added=${filesAdded} marked_deleted=${filesMarkedDeleted} total_bytes=${totalBytes}`,
    );
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 500);
    console.error(`[user-b2-sync-worker] user ${userId} failed:`, msg);
    try {
      await pool.query(
        `UPDATE user_b2_sync_runs SET status='failed', finished_at=now(),
           error_message=$2 WHERE id=$1::uuid`,
        [runId, msg],
      );
    } catch (innerErr) {
      console.error(
        "[user-b2-sync-worker] kunne heller ikke skrive failed-status:",
        innerErr,
      );
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// Cron-style scheduler
// ───────────────────────────────────────────────────────────────────

let cronStarted = false;

/**
 * Start en periodisk sync hver 6. time for alle aktive+verifiserte
 * brukere. Idempotent — gjentatte kall starter ikke flere intervaller.
 *
 * Første tick kjøres etter 60 sek så backend rekker å starte ferdig
 * (DB-connection-pool, KEK, etc.).
 */
export function startB2SyncCron(deps: { pool: Pool }): void {
  if (cronStarted) {
    console.warn("[user-b2-sync-cron] allerede startet — ignorer duplikat-kall");
    return;
  }
  cronStarted = true;

  const { pool } = deps;
  const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 timer

  const tick = async (): Promise<void> => {
    try {
      let users: { user_id: string }[];
      try {
        const result = await pool.query<{ user_id: string }>(
          `SELECT user_id FROM user_b2_credentials
            WHERE is_active = TRUE AND is_verified = TRUE`,
        );
        users = result.rows;
      } catch (e) {
        if (isUndefinedTableError(e)) {
          console.warn(
            "[user-b2-sync-cron] credentials-tabellen finnes ikke enda — skipper tick",
          );
          return;
        }
        throw e;
      }

      console.log(
        `[user-b2-sync-cron] starter sync for ${users.length} bruker(e)`,
      );
      // Kjør sekvensielt for å unngå burst mot Backblaze fra alle brukere
      // samtidig. Hver sync er allerede paginated og rate-vennlig.
      for (const row of users) {
        try {
          await runUserB2Sync(pool, row.user_id);
        } catch (perUserErr) {
          // runUserB2Sync skal ALDRI kaste — men forsvar oss likevel
          console.error(
            `[user-b2-sync-cron] uventet feil for user ${row.user_id}:`,
            perUserErr,
          );
        }
      }
    } catch (e) {
      console.error("[user-b2-sync-cron] tick feilet:", e);
    }
  };

  // Første tick etter 60 sek så backend rekker boot ferdig
  setTimeout(() => {
    void tick();
  }, 60_000);

  // Deretter hver 6. time
  setInterval(() => {
    void tick();
  }, SYNC_INTERVAL_MS);

  console.log(
    "[user-b2-sync-cron] startet — kjører første tick om 60s, deretter hver 6. time",
  );
}
