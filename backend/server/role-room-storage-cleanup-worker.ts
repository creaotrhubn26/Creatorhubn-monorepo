/**
 * role-room-storage-cleanup-worker.ts
 *
 * L7 — Background-worker som rydder soft-deleted filer fra B2.
 *
 * Når brukeren sletter en fil i UI-en setter vi `deleted_at = NOW()` i
 * `role_room_user_files` og dekrementerer consumption umiddelbart — slik
 * at quota frigis selv om B2-DELETE feiler eller henger. Denne worker-en
 * kjører periodisk og rydder de faktiske B2-objektene.
 *
 * Tre kjøremåter:
 *   1. CLI: `node dist/server/role-room-storage-cleanup-worker.js`
 *      (krever B2_ROLE_ROOM_*-env-vars + DATABASE_URL)
 *   2. Cron-endepunkt: POST /api/role-room/storage/admin/cleanup-soft-deleted
 *      (gated på cron-token eller admin-sesjon)
 *   3. setInterval inne i samme prosess som backend — startes
 *      automatisk hvis ROLE_ROOM_STORAGE_CLEANUP_INTERVAL_MS er satt
 *
 * Hver run henter opp til BATCH_SIZE filer, prøver å slette fra B2 hver
 * for seg, og fjerner DB-radene hvis B2-delete lyktes (eller filen
 * allerede er borte fra B2).
 */

import type { Pool } from "pg";
import { DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const BATCH_SIZE = 100;
const B2_REGION = process.env.B2_REGION || "eu-central-003";

function getAdminB2Client(): { client: S3Client; bucket: string } | null {
  const keyId = process.env.B2_ROLE_ROOM_APPLICATION_KEY_ID;
  const appKey = process.env.B2_ROLE_ROOM_APPLICATION_KEY;
  const bucket = process.env.B2_ROLE_ROOM_BUCKET_NAME;
  if (!keyId || !appKey || !bucket) return null;
  return {
    client: new S3Client({
      region: B2_REGION,
      endpoint: `https://s3.${B2_REGION}.backblazeb2.com`,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      forcePathStyle: true,
    }),
    bucket,
  };
}

export interface CleanupResult {
  scanned: number;
  deletedFromB2: number;
  alreadyMissing: number;
  errors: number;
  errorMessages: Array<{ b2Key: string; error: string }>;
  durationMs: number;
}

/**
 * Hovedfunksjonen — kalles fra cron-endepunkt eller setInterval.
 * Sletter opptil BATCH_SIZE filer per run.
 */
export async function cleanupSoftDeletedFiles(
  pool: Pool,
  opts: { batchSize?: number; dryRun?: boolean } = {},
): Promise<CleanupResult> {
  const startedAt = Date.now();
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const dryRun = opts.dryRun ?? false;

  const result: CleanupResult = {
    scanned: 0,
    deletedFromB2: 0,
    alreadyMissing: 0,
    errors: 0,
    errorMessages: [],
    durationMs: 0,
  };

  const config = getAdminB2Client();
  if (!config) {
    result.errorMessages.push({ b2Key: '-', error: 'B2 ikke konfigurert' });
    result.durationMs = Date.now() - startedAt;
    return result;
  }

  // Hent kandidater
  const r = await pool.query<{ id: string; b2_key: string }>(
    `SELECT id, b2_key FROM role_room_user_files
     WHERE deleted_at IS NOT NULL
     ORDER BY deleted_at ASC
     LIMIT $1`,
    [batchSize],
  );

  result.scanned = r.rows.length;

  for (const row of r.rows) {
    if (dryRun) {
      // bare logg
      continue;
    }

    try {
      // Test om filen finnes i B2 først
      let exists = true;
      try {
        await config.client.send(
          new HeadObjectCommand({ Bucket: config.bucket, Key: row.b2_key }),
        );
      } catch (err) {
        // S3-HEAD med 404 = filen er allerede borte
        const code = (err as { name?: string; $metadata?: { httpStatusCode?: number } });
        if (code.name === 'NotFound' || code.$metadata?.httpStatusCode === 404) {
          exists = false;
        } else {
          // Annen feil — logg, men fortsett (kanskje DELETE virker)
          console.warn("[storage-cleanup] HEAD feilet (fortsetter med DELETE)", {
            key: row.b2_key, err: (err as Error).message,
          });
        }
      }

      if (exists) {
        await config.client.send(
          new DeleteObjectCommand({ Bucket: config.bucket, Key: row.b2_key }),
        );
        result.deletedFromB2 += 1;
      } else {
        result.alreadyMissing += 1;
      }

      // Fjern DB-raden — om vi nådde DELETE eller filen allerede var borte
      await pool.query(
        `DELETE FROM role_room_user_files WHERE id = $1::uuid`,
        [row.id],
      );
    } catch (err) {
      result.errors += 1;
      const msg = (err as Error).message?.slice(0, 200) ?? 'unknown';
      result.errorMessages.push({ b2Key: row.b2_key, error: msg });
      console.error("[storage-cleanup] feilet på fil", { key: row.b2_key, err: msg });
    }
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}

/**
 * Start in-process cleanup-loop hvis env-var er satt.
 * Kalles fra index.ts ved boot. Trygt å kalle uten env — gjør ingenting.
 */
export function startInProcessCleanupLoop(pool: Pool): void {
  const intervalMs = Number(process.env.ROLE_ROOM_STORAGE_CLEANUP_INTERVAL_MS);
  if (!intervalMs || intervalMs < 60_000) {
    // Krever minimum 1 min for å unngå utilsiktede busy-loops
    return;
  }
  console.log(`[storage-cleanup] starter in-process loop hvert ${intervalMs / 1000}s`);
  setInterval(() => {
    void cleanupSoftDeletedFiles(pool).then((r) => {
      if (r.scanned > 0 || r.errors > 0) {
        console.log("[storage-cleanup] run ferdig", {
          scanned: r.scanned,
          deletedFromB2: r.deletedFromB2,
          alreadyMissing: r.alreadyMissing,
          errors: r.errors,
          durationMs: r.durationMs,
        });
      }
    }).catch((err) => {
      console.error("[storage-cleanup] worker crashet", err);
    });
  }, intervalMs);
}
