/**
 * user-storage-providers.ts
 *
 * Provider-abstraksjon for mirror-pipelinen. Lar callers fyre én
 * `mirrorToAllConfiguredProviders(...)` og treffer alle providere
 * brukeren har koblet til (B2 + Google Drive osv.) i parallell.
 *
 * Designprinsipper (samme som user-b2-mirror-worker.ts):
 *   1. Non-blocking — selve mirror-skrivingen er fire-and-forget.
 *      Den primære R2/Stream-uploaden skal ALDRI feile pga mirror.
 *   2. Skip silent — hvis bruker ikke har creds, eller creds er
 *      is_active=FALSE / is_verified=FALSE → ingen logg-støy.
 *   3. Defensive mot tabeller som ikke finnes (`42P01`) — vi går
 *      live med Drive før migrasjonen er kjørt overalt.
 *   4. Defensive mot worker-modul som ikke finnes — Drive-worker
 *      leveres av en annen agent og er kanskje ikke i sync ennå.
 *      Hvis dynamic-importen feiler logger vi én warning og dropper
 *      Drive-mirror inntil videre.
 *
 * NB: Denne fila eier IKKE provider-spesifikk logikk (crypto, S3-PUT,
 *     Drive-API-kall). Den bare ruter til riktig worker.
 */

import type { Pool } from "pg";
import { mirrorUploadToUserB2, type MirrorSource } from "./user-b2-mirror-worker";

// ───────────────────────────────────────────────────────────────────
// Typer
// ───────────────────────────────────────────────────────────────────

export type StorageProvider = "b2" | "drive";

export interface MirrorRequest {
  userId: string;
  source: MirrorSource;
  sourceId: string;
  fileName: string;
  contentType?: string | null;
  /** URL primær-uploaden kan hentes fra hvis ingen buffer er gitt. */
  primaryUrl?: string;
  /** Innholdet i minnet — raskeste sti hvis caller har det. */
  buffer?: Buffer;
}

export interface ProviderStatus {
  provider: StorageProvider;
  active: boolean;
  reason?: "no_credentials" | "table_missing" | "query_failed";
}

// ───────────────────────────────────────────────────────────────────
// Detektering av aktive providere
// ───────────────────────────────────────────────────────────────────

function isUndefinedTableError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return (
    e?.code === "42P01" ||
    /relation "user_(b2|drive)_credentials" does not exist/i.test(
      e?.message || "",
    )
  );
}

async function hasActiveB2(pool: Pool, userId: string): Promise<ProviderStatus> {
  try {
    const r = await pool.query(
      `SELECT 1
         FROM user_b2_credentials
        WHERE user_id = $1::uuid
          AND is_active = TRUE
          AND is_verified = TRUE
        LIMIT 1`,
      [userId],
    );
    return {
      provider: "b2",
      active: (r.rowCount ?? 0) > 0,
      reason: (r.rowCount ?? 0) > 0 ? undefined : "no_credentials",
    };
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return { provider: "b2", active: false, reason: "table_missing" };
    }
    console.warn("[storage-providers] hasActiveB2 query failed:", err);
    return { provider: "b2", active: false, reason: "query_failed" };
  }
}

async function hasActiveDrive(
  pool: Pool,
  userId: string,
): Promise<ProviderStatus> {
  try {
    const r = await pool.query(
      `SELECT 1
         FROM user_drive_credentials
        WHERE user_id = $1::uuid
          AND is_active = TRUE
          AND is_verified = TRUE
        LIMIT 1`,
      [userId],
    );
    return {
      provider: "drive",
      active: (r.rowCount ?? 0) > 0,
      reason: (r.rowCount ?? 0) > 0 ? undefined : "no_credentials",
    };
  } catch (err) {
    if (isUndefinedTableError(err)) {
      return { provider: "drive", active: false, reason: "table_missing" };
    }
    console.warn("[storage-providers] hasActiveDrive query failed:", err);
    return { provider: "drive", active: false, reason: "query_failed" };
  }
}

/**
 * Returner liste over hvilke providere brukeren har koblet til. Brukes
 * av frontend-aggregat-endepunkt og av mirror-routing under.
 */
export async function getActiveProviders(
  pool: Pool,
  userId: string,
): Promise<ProviderStatus[]> {
  const [b2, drive] = await Promise.all([
    hasActiveB2(pool, userId),
    hasActiveDrive(pool, userId),
  ]);
  return [b2, drive];
}

// ───────────────────────────────────────────────────────────────────
// Drive-worker — dynamic import for å unngå hard kobling mens den
// andre agenten leverer fila. Hvis modulen ikke finnes skipper vi
// silent (med én warning per worker-prosess for diagnostikk).
// ───────────────────────────────────────────────────────────────────

type DriveMirrorFn = (
  deps: { pool: Pool },
  params: MirrorRequest,
) => void | Promise<void>;

let cachedDriveMirror: DriveMirrorFn | null | undefined = undefined;
let driveImportWarned = false;

async function loadDriveMirror(): Promise<DriveMirrorFn | null> {
  if (cachedDriveMirror !== undefined) return cachedDriveMirror;
  try {
    // Eslint-disable: dynamic-import er hele poenget her.
    const mod = (await import("./user-drive-mirror-worker")) as {
      mirrorUploadToUserDrive?: DriveMirrorFn;
      enqueueMirrorToUserDrive?: DriveMirrorFn;
    };
    cachedDriveMirror =
      mod.mirrorUploadToUserDrive ?? mod.enqueueMirrorToUserDrive ?? null;
    if (!cachedDriveMirror && !driveImportWarned) {
      driveImportWarned = true;
      console.info(
        "[storage-providers] user-drive-mirror-worker har ingen mirrorUploadToUserDrive/enqueueMirrorToUserDrive export ennå",
      );
    }
    return cachedDriveMirror;
  } catch (err) {
    cachedDriveMirror = null;
    if (!driveImportWarned) {
      driveImportWarned = true;
      console.info(
        "[storage-providers] user-drive-mirror-worker mangler — Drive-mirror skippes (other agent leverer)",
        err instanceof Error ? err.message : err,
      );
    }
    return null;
  }
}

// Test-hook
export function _resetDriveMirrorCache(): void {
  cachedDriveMirror = undefined;
  driveImportWarned = false;
}

// ───────────────────────────────────────────────────────────────────
// Hoved-API
// ───────────────────────────────────────────────────────────────────

/**
 * Mirror-skriv en upload til ALLE providere brukeren har aktivt
 * konfigurert. Returnerer umiddelbart — alle providere kalles
 * fire-and-forget via sine respektive workers (som har egne in-memory
 * køer + retry-policy).
 *
 * Callers SKAL bruke `void` foran kallet:
 *
 *   void mirrorToAllConfiguredProviders(pool, {
 *     userId, source: 'gallery', sourceId, fileName, primaryUrl,
 *   });
 */
export async function mirrorToAllConfiguredProviders(
  pool: Pool,
  req: MirrorRequest,
): Promise<void> {
  if (!req.userId || !req.sourceId || !req.fileName) {
    console.warn("[storage-providers] dropping malformed mirror request:", {
      hasUserId: !!req.userId,
      hasSourceId: !!req.sourceId,
      hasFileName: !!req.fileName,
    });
    return;
  }
  if (!req.buffer && !req.primaryUrl) {
    console.warn(
      "[storage-providers] dropping request — neither buffer nor primaryUrl set",
      {
        userId: req.userId,
        source: req.source,
        sourceId: req.sourceId,
      },
    );
    return;
  }

  const statuses = await getActiveProviders(pool, req.userId);

  for (const status of statuses) {
    if (!status.active) continue;
    if (status.provider === "b2") {
      try {
        mirrorUploadToUserB2({ pool }, req);
      } catch (err) {
        // mirrorUploadToUserB2 er allerede non-throwing internt, men vi
        // dobbelt-vegg her uansett for å beskytte den primære uploaden.
        console.error("[storage-providers] B2 enqueue failed:", err);
      }
    } else if (status.provider === "drive") {
      const driveFn = await loadDriveMirror();
      if (!driveFn) continue;
      try {
        // Kan være sync void OR async — begge OK; vi avventer ikke.
        void driveFn({ pool }, req);
      } catch (err) {
        console.error("[storage-providers] Drive enqueue failed:", err);
      }
    }
  }
}

/**
 * Helper for diagnostikk-/admin-endepunkter: returner liste over
 * provider-navn brukeren har aktivt.
 */
export async function listActiveProviderNames(
  pool: Pool,
  userId: string,
): Promise<StorageProvider[]> {
  const statuses = await getActiveProviders(pool, userId);
  return statuses.filter((s) => s.active).map((s) => s.provider);
}
