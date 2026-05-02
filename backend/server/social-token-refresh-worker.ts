/**
 * Proaktiv token-refresh worker for sosiale plattform-tilkoblinger.
 *
 * Bakgrunn:
 *   ensureFreshConnection() refresher token kun on-demand (når noen kaller
 *   en publish/insights-funksjon). Det betyr at en aktiv tilkobling som
 *   ikke brukes på 60+ dager vil ende opp med utløpt token, og deretter
 *   feile på neste forsøk — uten å varsle brukeren før det er for sent.
 *
 *   Denne workeren rydder opp i det: én sweep i timen som plukker
 *   connections hvor token_expires_at er innen 7 dager, og refresher dem
 *   proaktivt.
 *
 *   Refresh-failures er ikke fatale — vi setter connection_state='expired'
 *   og lar brukeren se det i Connections Bar slik at de kan reconnecte.
 *
 * Stabilitet:
 *   - Idempotent: kjører gjentatte sweeps uten å forstyrre eksisterende
 *     refresh-flyt.
 *   - Defensive: feiler stille hvis ensureFreshConnection throw-er; bare
 *     logger advarsel og går videre.
 *   - Throttled: max 10 refresh per sweep for å ikke hamre Meta API.
 *   - No-op uten Meta-config: hvis META_APP_ID/SECRET ikke er satt,
 *     deaktiveres workeren automatisk.
 */

import type { Pool } from 'pg';
import {
  ensureFreshConnection,
  getConnection,
  getMetaAppConfig,
} from './role-room-instagram-oauth.js';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 time
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 dager
const MAX_PER_SWEEP = 10;

interface RefreshCandidate {
  id: string;
  user_id: string;
  ig_business_account_id: string;
  token_expires_at: Date;
}

export async function listExpiringConnections(
  pool: Pool,
  withinMs: number = REFRESH_WINDOW_MS,
  limit: number = MAX_PER_SWEEP,
): Promise<RefreshCandidate[]> {
  try {
    const result = await pool.query<RefreshCandidate>(
      `SELECT id, user_id, ig_business_account_id, token_expires_at
         FROM role_room_instagram_connections
        WHERE connection_state = 'connected'
          AND token_expires_at IS NOT NULL
          AND token_expires_at < now() + ($1 || ' milliseconds')::interval
        ORDER BY token_expires_at ASC
        LIMIT $2`,
      [String(withinMs), limit],
    );
    return result.rows;
  } catch (error) {
    console.warn('[token-refresh] listExpiringConnections failed', error);
    return [];
  }
}

export async function sweepOnce(pool: Pool): Promise<{ refreshed: number; failed: number }> {
  const candidates = await listExpiringConnections(pool);
  if (candidates.length === 0) return { refreshed: 0, failed: 0 };

  let refreshed = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const conn = await getConnection(pool, candidate.id, candidate.user_id);
      if (!conn) {
        console.warn(
          `[token-refresh] connection ${candidate.id} not found via getConnection — skipping`,
        );
        continue;
      }
      if (conn.connectionState !== 'connected') {
        // Allerede markert expired/revoked — hopp over
        continue;
      }
      // ensureFreshConnection oppdaterer rad-en i DB hvis token er innenfor
      // 24t av expiry. Vi caller den uansett siden vi vet token er innen
      // 7 dager — det vil bare være en passthrough hvis 24t-vinduet ikke
      // er truffet ennå, men ingen skade gjort.
      const fresh = await ensureFreshConnection(pool, conn);
      if (fresh.tokenExpiresAt && fresh.tokenExpiresAt > conn.tokenExpiresAt!) {
        refreshed += 1;
        console.log(
          `[token-refresh] ${candidate.ig_business_account_id} refreshed; new expiry ${fresh.tokenExpiresAt.toISOString()}`,
        );
      }
    } catch (error) {
      failed += 1;
      console.warn(
        `[token-refresh] ${candidate.ig_business_account_id} refresh failed`,
        error,
      );
      // Marker eksplicitt som expired hvis Meta avviste — connection_state
      // satt allerede av ensureFreshConnection sin catch-grein, men vi
      // dobbel-sjekker for å være safe.
      try {
        await pool.query(
          `UPDATE role_room_instagram_connections
              SET connection_state = 'expired',
                  last_error = $2,
                  updated_at = now()
            WHERE id = $1 AND connection_state = 'connected'`,
          [candidate.id, (error as Error).message.slice(0, 500)],
        );
      } catch {
        /* ignore — best effort */
      }
    }
  }

  return { refreshed, failed };
}

let workerHandle: NodeJS.Timeout | null = null;

export function startTokenRefreshWorker(pool: Pool): void {
  if (workerHandle) return;
  if (!getMetaAppConfig()) {
    console.warn(
      '[token-refresh] META_APP_ID / META_APP_SECRET ikke satt — worker deaktivert',
    );
    return;
  }
  console.log('[token-refresh] starting (sweep every 1h, refresh window 7d)');
  workerHandle = setInterval(() => {
    sweepOnce(pool)
      .then(({ refreshed, failed }) => {
        if (refreshed > 0 || failed > 0) {
          console.log(
            `[token-refresh] sweep done: refreshed=${refreshed} failed=${failed}`,
          );
        }
      })
      .catch((err) => {
        console.warn('[token-refresh] sweep threw', err);
      });
  }, SWEEP_INTERVAL_MS);
  // Kjør én med en gang ved boot så et nylig oppstartet servervindu
  // ikke etterlater utløpte tokens i 1 time.
  setTimeout(() => {
    sweepOnce(pool).catch(() => {});
  }, 30_000);
}

export function stopTokenRefreshWorker(): void {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}
