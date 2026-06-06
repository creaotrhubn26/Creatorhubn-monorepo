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

async function publishDraftViaSelfHttp(draftId: number): Promise<{
  ok: boolean;
  status?: string;
  externalPostId?: string;
  error?: string;
}> {
  const port = process.env.PORT || '10000';
  const bypassToken = (process.env.WHATSAPP_DEMO_BYPASS_TOKEN || '').trim();
  if (!bypassToken) {
    return { ok: false, error: 'WHATSAPP_DEMO_BYPASS_TOKEN missing' };
  }
  try {
    const resp = await fetch(
      `http://127.0.0.1:${port}/api/role-room/agent/post-drafts/${draftId}/publish?token=${encodeURIComponent(bypassToken)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
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
      error: (body.error as string) || (body.reason as string) || `http ${resp.status}`,
    };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function runTickInternal(pool: Pool): Promise<{ published: number; failed: number; processed: number }> {
  // Hent drafts som er due. Atomisk: marker auto_publish_attempted_at før vi
  // ringer publish, så to ticks samtidig ikke begge prøver samme draft.
  const due = await pool.query<{ id: string; platform: string; auto_publish_attempts: number }>(
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
      LIMIT $3`,
    [MAX_ATTEMPTS, RETRY_BACKOFF_MS, BATCH_LIMIT],
  );

  if (due.rowCount === 0) {
    return { published: 0, failed: 0, processed: 0 };
  }

  let published = 0, failed = 0;

  for (const row of due.rows) {
    const draftId = Number(row.id);
    // Reserver med å bumpe attempted_at + attempts FØR publish
    await pool.query(
      `UPDATE marketing_post_drafts
          SET auto_publish_attempted_at = now(),
              auto_publish_attempts = auto_publish_attempts + 1
        WHERE id = $1`,
      [draftId],
    );

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
    } else {
      failed++;
      console.warn(`[autopublish] draftId=${draftId} platform=${row.platform} → failed: ${result.error}`);
    }
  }

  return { published, failed, processed: due.rowCount ?? 0 };
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
      res.status(500).json({ ok: false, error: String(err) });
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
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
}
