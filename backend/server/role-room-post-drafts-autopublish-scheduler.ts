/**
 * role-room-post-drafts-autopublish-scheduler.ts
 *
 * PR 11: In-process worker som tikker hvert 60 sek og auto-publiserer
 * post-drafts hvor:
 *   - auto_publish_enabled = TRUE
 *   - status IN ('draft', 'edited')
 *   - suggested_publish_time <= now()
 *   - (auto_publish_attempted_at IS NULL OR attempted < now() - 30 min)
 *   - auto_publish_attempts < MAX_ATTEMPTS
 *
 * Publish-kallet går via self-HTTP til vår egen
 * /api/role-room/agent/post-drafts/:id/publish-endpoint slik at vi
 * gjenbruker hele platform-routingen + DB-oppdateringene uten
 * sirkulær import.
 *
 * Endepunkter:
 *   POST /api/role-room/agent/autopublish-scheduler/tick — manuell trigger (admin)
 *   GET  /api/role-room/agent/autopublish-scheduler/status — siste tick + statistikk
 */

import type { Application, Request, Response } from 'express';
import type { Pool } from 'pg';
import crypto from 'node:crypto';

export interface SetupAutoPublishSchedulerDeps {
  app: Application;
  pool: Pool;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const TICK_INTERVAL_MS = 60_000;        // hver 60 sek
const STARTUP_DELAY_MS = 60_000;        // 1 min etter boot
const RETRY_BACKOFF_MS = 30 * 60_000;   // 30 min mellom retry-forsøk
const MAX_ATTEMPTS = 3;
const BATCH_LIMIT = 5;                  // max drafts pr tick

interface SchedulerState {
  lastTickAt: string | null;
  lastTickPublishedCount: number;
  lastTickFailedCount: number;
  totalPublished: number;
  totalFailed: number;
}

const state: SchedulerState = {
  lastTickAt: null,
  lastTickPublishedCount: 0,
  lastTickFailedCount: 0,
  totalPublished: 0,
  totalFailed: 0,
};

let tickInterval: NodeJS.Timeout | null = null;
const INTERNAL_PUBLISH_HEADER = 'x-role-room-autopublish-token';
const internalPublishToken = crypto.randomBytes(32).toString('base64url');

function isLoopbackAddress(value: string | undefined): boolean {
  return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
}

/**
 * Kun self-HTTP fra samme prosess får bruke den interne publish-broen.
 * Tokenet genereres ved boot og eksponeres aldri som env/config, og
 * loopback-sjekken hindrer at headeren kan brukes eksternt.
 */
export function isAutoPublishInternalRequest(req: Request): boolean {
  const supplied = req.get(INTERNAL_PUBLISH_HEADER) ?? '';
  if (!supplied || !isLoopbackAddress(req.socket.remoteAddress)) return false;
  const expected = Buffer.from(internalPublishToken);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function publishDraftViaSelfHttp(draftId: number): Promise<{
  ok: boolean;
  status?: string;
  externalPostId?: string;
  error?: string;
}> {
  const port = process.env.PORT || '10000';
  try {
    const resp = await fetch(
      `http://127.0.0.1:${port}/api/role-room/agent/post-drafts/${draftId}/publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [INTERNAL_PUBLISH_HEADER]: internalPublishToken,
        },
      },
    );
    const body = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (resp.ok && body.ok === true) {
      return {
        ok: true,
        status: typeof body.status === 'string' ? body.status : undefined,
        externalPostId: typeof body.externalPostId === 'string' ? body.externalPostId : undefined,
      };
    }
    return {
      ok: false,
      status: typeof body.status === 'string' ? body.status : undefined,
      error: (body.error as string) || (body.reason as string) || `http ${resp.status}`,
    };
  } catch (err) {
    // Når requesten kan ha nådd endepunktet, vet vi ikke om den eksterne
    // sideeffekten allerede skjedde. Dette må aldri bli en automatisk retry.
    return { ok: false, status: 'uncertain', error: 'self_http_outcome_uncertain' };
  }
}

async function runTickInternal(pool: Pool): Promise<{ published: number; failed: number; processed: number }> {
  // Claim i én transaksjon. SKIP LOCKED gjør at flere Render-instanser kan
  // kjøre samme worker uten dobbeltpublisering.
  const client = await pool.connect();
  let due: { rows: Array<{ id: string; platform: string; auto_publish_attempts: number }>; rowCount: number | null };
  try {
    await client.query('BEGIN');
    // En prosess kan dø etter at LinkedIn/Meta mottok requesten, men før vi
    // lagret svaret. Slike claims må granskes manuelt, aldri auto-retries.
    await client.query(
      `UPDATE marketing_post_drafts
          SET status = 'uncertain',
              auto_publish_enabled = FALSE,
              publish_error = COALESCE(
                publish_error,
                'Uavklart publiseringsutfall — kontroller plattformen før nytt forsøk'
              ),
              updated_at = now()
        WHERE status = 'publishing'
          AND updated_at < now() - interval '15 minutes'`,
    );
    due = await client.query<{ id: string; platform: string; auto_publish_attempts: number }>(
      `SELECT id, platform, auto_publish_attempts
         FROM marketing_post_drafts
        WHERE auto_publish_enabled = TRUE
          AND status IN ('draft', 'edited')
          AND suggested_publish_time IS NOT NULL
          AND suggested_publish_time <= now()
          AND auto_publish_attempts < $1
          AND (
            auto_publish_attempted_at IS NULL
            OR auto_publish_attempted_at < now() - ($2::int * INTERVAL '1 millisecond')
          )
        ORDER BY suggested_publish_time ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED`,
      [MAX_ATTEMPTS, RETRY_BACKOFF_MS, BATCH_LIMIT],
    );
    if (due.rows.length > 0) {
      await client.query(
        `UPDATE marketing_post_drafts
            SET auto_publish_attempted_at = now(),
                auto_publish_attempts = auto_publish_attempts + 1
          WHERE id = ANY($1::bigint[])`,
        [due.rows.map((row) => row.id)],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  if (due.rows.length === 0) {
    return { published: 0, failed: 0, processed: 0 };
  }

  let published = 0, failed = 0;

  for (const row of due.rows) {
    const draftId = Number(row.id);
    const result = await publishDraftViaSelfHttp(draftId);
    if (result.ok && result.status === 'published') {
      published++;
      console.log(`[autopublish] draftId=${draftId} platform=${row.platform} → published (${result.externalPostId})`);
    } else if (result.ok && result.status === 'manual_copy') {
      // Plattformer som ikke støtter auto-publish (IG/TikTok) — disable auto
      await pool.query(
        `UPDATE marketing_post_drafts
            SET auto_publish_enabled = FALSE,
                publish_error = $2
          WHERE id = $1`,
          [draftId, `Platform ${row.platform} støtter ikke auto-publish. Disablet.`],
      );
      console.log(`[autopublish] draftId=${draftId} platform=${row.platform} → manual_copy, disabled auto`);
    } else if (result.status === 'uncertain') {
      failed++;
      await pool.query(
        `UPDATE marketing_post_drafts
            SET status = 'uncertain',
                auto_publish_enabled = FALSE,
                publish_error = COALESCE(
                  publish_error,
                  'Uavklart publiseringsutfall — kontroller plattformen før nytt forsøk'
                ),
                updated_at = now()
          WHERE id = $1`,
        [draftId],
      );
      console.warn(
        '[autopublish] draftId=' + draftId
        + ' platform=' + row.platform
        + ' → uncertain; automatic retry disabled',
      );
    } else {
      failed++;
      const attemptNumber = Number(row.auto_publish_attempts) + 1;
      await pool.query(
        `UPDATE marketing_post_drafts
            SET status = CASE WHEN $2 < $3 THEN 'edited' ELSE 'failed' END,
                publish_error = $4,
                updated_at = now()
          WHERE id = $1`,
        [draftId, attemptNumber, MAX_ATTEMPTS, String(result.error || 'Auto-publisering feilet').slice(0, 1000)],
      );
      console.warn(`[autopublish] draftId=${draftId} platform=${row.platform} → failed: ${result.error}`);
    }
  }

  return { published, failed, processed: due.rows.length };
}

export async function runAutoPublishTick(pool: Pool): Promise<{ published: number; failed: number; processed: number }> {
  const result = await runTickInternal(pool);
  state.lastTickAt = new Date().toISOString();
  state.lastTickPublishedCount = result.published;
  state.lastTickFailedCount = result.failed;
  state.totalPublished += result.published;
  state.totalFailed += result.failed;
  return result;
}

export function startAutoPublishScheduler(deps: { pool: Pool }): void {
  if (tickInterval) return;
  if ((process.env.MARKETING_AUTOPUBLISH_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('[autopublish] disabled via MARKETING_AUTOPUBLISH_ENABLED=false');
    return;
  }
  const tick = async () => {
    try {
      const r = await runAutoPublishTick(deps.pool);
      if (r.processed > 0) {
        console.log(`[autopublish] tick: processed=${r.processed} published=${r.published} failed=${r.failed}`);
      }
    } catch (err) {
      console.error('[autopublish] tick crashed', err);
    }
  };
  setTimeout(() => {
    void tick();
    tickInterval = setInterval(() => { void tick(); }, TICK_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
  console.log(`[autopublish] scheduler scheduled — tick every ${TICK_INTERVAL_MS / 1000}s, max ${MAX_ATTEMPTS} attempts, retry backoff ${RETRY_BACKOFF_MS / 60_000}min`);
}

export function setupAutoPublishSchedulerRoutes(deps: SetupAutoPublishSchedulerDeps): void {
  const { app, pool, requireAdminOrDemoBypass } = deps;

  // Manuell trigger — bruk i e2e og for å verifisere live
  app.post('/api/role-room/agent/autopublish-scheduler/tick', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    try {
      const r = await runAutoPublishTick(pool);
      res.json({ ok: true, ...r, state });
    } catch (err) {
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });

  // Status — for UI å vise siste tick + statistikk
  app.get('/api/role-room/agent/autopublish-scheduler/status', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    try {
      // Pending count
      const pending = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM marketing_post_drafts
          WHERE auto_publish_enabled = TRUE
            AND status IN ('draft', 'edited')
            AND suggested_publish_time IS NOT NULL`,
      );
      const due = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM marketing_post_drafts
          WHERE auto_publish_enabled = TRUE
            AND status IN ('draft', 'edited')
            AND suggested_publish_time <= now()
            AND auto_publish_attempts < $1`,
        [MAX_ATTEMPTS],
      );
      res.json({
        ok: true,
        state,
        pendingCount: Number(pending.rows[0]?.count ?? 0),
        dueCount: Number(due.rows[0]?.count ?? 0),
        config: {
          tickIntervalMs: TICK_INTERVAL_MS,
          maxAttempts: MAX_ATTEMPTS,
          retryBackoffMs: RETRY_BACKOFF_MS,
          batchLimit: BATCH_LIMIT,
          enabled: (process.env.MARKETING_AUTOPUBLISH_ENABLED || 'true').toLowerCase() !== 'false',
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: "internal_error" });
    }
  });
}
