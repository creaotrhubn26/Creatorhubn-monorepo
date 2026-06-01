/**
 * role-room-brand-metrics-routes.ts
 *
 * Snapshot The Role Rooms egne metrics (FB Page + IG Business) for å gi
 * AI-rapporten "vår tilstand"-input. Worker tikker hver 6. time og lagrer
 * et nytt snapshot hvis siste er ≥24h gammelt.
 *
 * Endepunkter (alle requireAdminOrDemoBypass):
 *   POST /api/role-room/marketing-cockpit/brand-metrics/snapshot
 *        Body: { platforms?: ['facebook','instagram'] } — default begge
 *   GET  /api/role-room/marketing-cockpit/brand-metrics?days=30
 */

import type { Application, Request, Response } from 'express';
import type { Pool } from 'pg';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export interface SetupBrandMetricsDeps {
  app: Application;
  pool: Pool;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

interface FbPageMetrics {
  pageId: string;
  fanCount: number | null;
  followersCount: number | null;
  // From /insights endpoint (last 7d aggregated)
  pageImpressions7d: number | null;
  pageEngagedUsers7d: number | null;
  // Post-frequency
  posts7d: number | null;
  posts30d: number | null;
  about: string | null;
  category: string | null;
  pictureUrl: string | null;
}

interface IgBusinessMetrics {
  igUserId: string;
  username: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  biography: string | null;
  website: string | null;
  // Recent post engagement
  recent10MediaAvgLikes: number | null;
  recent10MediaAvgComments: number | null;
}

async function fetchFacebookPageMetrics(pageId: string, accessToken: string): Promise<{ ok: boolean; data: FbPageMetrics | null; error?: string }> {
  try {
    const profileParams = new URLSearchParams({
      fields: 'id,name,fan_count,followers_count,about,category,picture.type(large)',
      access_token: accessToken,
    });
    const profileR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(pageId)}?${profileParams}`);
    const profile = (await profileR.json().catch(() => ({}))) as Record<string, unknown>;
    if (!profileR.ok) {
      const err = profile.error as Record<string, unknown> | undefined;
      return { ok: false, data: null, error: typeof err?.message === 'string' ? err.message : `status ${profileR.status}` };
    }

    // Posts in last 30d for frequency stat
    const postsParams = new URLSearchParams({
      fields: 'id,created_time',
      limit: '100', access_token: accessToken,
    });
    const postsR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/posts?${postsParams}`);
    const posts = (await postsR.json().catch(() => ({}))) as Record<string, unknown>;
    let posts7 = 0, posts30 = 0;
    const now = Date.now();
    if (Array.isArray(posts.data)) {
      for (const p of posts.data as Array<Record<string, unknown>>) {
        const created = typeof p.created_time === 'string' ? Date.parse(p.created_time) : NaN;
        if (!Number.isFinite(created)) continue;
        const ageDays = (now - created) / 86_400_000;
        if (ageDays < 7) posts7++;
        if (ageDays < 30) posts30++;
      }
    }

    // Page Insights — page_impressions, page_engaged_users (last 7d, day-period)
    const insightsParams = new URLSearchParams({
      metric: 'page_impressions,page_engaged_users',
      period: 'days_28',
      access_token: accessToken,
    });
    const insightsR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/insights?${insightsParams}`);
    const insights = (await insightsR.json().catch(() => ({}))) as Record<string, unknown>;
    let pageImpressions: number | null = null;
    let pageEngagedUsers: number | null = null;
    if (Array.isArray(insights.data)) {
      for (const m of insights.data as Array<Record<string, unknown>>) {
        const name = String(m.name || '');
        const values = m.values as Array<{ value?: number }> | undefined;
        const v = values && values.length > 0 ? Number(values[values.length - 1]?.value ?? 0) : null;
        if (name === 'page_impressions') pageImpressions = v;
        if (name === 'page_engaged_users') pageEngagedUsers = v;
      }
    }

    const picture = profile.picture as Record<string, unknown> | undefined;
    const pictureData = picture?.data as Record<string, unknown> | undefined;
    return {
      ok: true,
      data: {
        pageId: String(profile.id ?? pageId),
        fanCount: typeof profile.fan_count === 'number' ? profile.fan_count : null,
        followersCount: typeof profile.followers_count === 'number' ? profile.followers_count : null,
        pageImpressions7d: pageImpressions,
        pageEngagedUsers7d: pageEngagedUsers,
        posts7d: posts7,
        posts30d: posts30,
        about: typeof profile.about === 'string' ? profile.about : null,
        category: typeof profile.category === 'string' ? profile.category : null,
        pictureUrl: typeof pictureData?.url === 'string' ? pictureData.url : null,
      },
    };
  } catch (err) {
    return { ok: false, data: null, error: String(err) };
  }
}

async function fetchInstagramBusinessMetrics(igUserId: string, accessToken: string): Promise<{ ok: boolean; data: IgBusinessMetrics | null; error?: string }> {
  try {
    const profileParams = new URLSearchParams({
      fields: 'id,username,followers_count,follows_count,media_count,biography,website',
      access_token: accessToken,
    });
    const profileR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(igUserId)}?${profileParams}`);
    const profile = (await profileR.json().catch(() => ({}))) as Record<string, unknown>;
    if (!profileR.ok) {
      const err = profile.error as Record<string, unknown> | undefined;
      return { ok: false, data: null, error: typeof err?.message === 'string' ? err.message : `status ${profileR.status}` };
    }

    // Recent 10 media with engagement signals
    const mediaParams = new URLSearchParams({
      fields: 'id,like_count,comments_count',
      limit: '10', access_token: accessToken,
    });
    const mediaR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(igUserId)}/media?${mediaParams}`);
    const media = (await mediaR.json().catch(() => ({}))) as Record<string, unknown>;
    let avgLikes: number | null = null;
    let avgComments: number | null = null;
    if (mediaR.ok && Array.isArray(media.data) && media.data.length > 0) {
      const items = media.data as Array<Record<string, unknown>>;
      const likeCounts = items.map((m) => typeof m.like_count === 'number' ? m.like_count : 0);
      const commentCounts = items.map((m) => typeof m.comments_count === 'number' ? m.comments_count : 0);
      avgLikes = Math.round(likeCounts.reduce((a, b) => a + b, 0) / items.length);
      avgComments = Math.round(commentCounts.reduce((a, b) => a + b, 0) / items.length);
    }

    return {
      ok: true,
      data: {
        igUserId: String(profile.id ?? igUserId),
        username: typeof profile.username === 'string' ? profile.username : null,
        followersCount: typeof profile.followers_count === 'number' ? profile.followers_count : null,
        followsCount: typeof profile.follows_count === 'number' ? profile.follows_count : null,
        mediaCount: typeof profile.media_count === 'number' ? profile.media_count : null,
        biography: typeof profile.biography === 'string' ? profile.biography : null,
        website: typeof profile.website === 'string' ? profile.website : null,
        recent10MediaAvgLikes: avgLikes,
        recent10MediaAvgComments: avgComments,
      },
    };
  } catch (err) {
    return { ok: false, data: null, error: String(err) };
  }
}

export async function captureSelfBrandMetrics(pool: Pool, source: 'manual' | 'auto-worker' | 'cron' = 'manual'): Promise<{
  ok: boolean;
  facebook: { ok: boolean; snapshotId: number | null; error?: string };
  instagram: { ok: boolean; snapshotId: number | null; error?: string };
}> {
  const pageId = (process.env.THEROLERROOM_PAGE_ID || '').trim();
  const pageToken = (process.env.THEROLERROOM_PAGE_ACCESS_TOKEN || '').trim();
  const igUserId = (process.env.THEROLERROOM_IG_USER_ID || '').trim();

  const facebook: { ok: boolean; snapshotId: number | null; error?: string } = { ok: false, snapshotId: null };
  const instagram: { ok: boolean; snapshotId: number | null; error?: string } = { ok: false, snapshotId: null };

  if (pageId && pageToken) {
    const fb = await fetchFacebookPageMetrics(pageId, pageToken);
    try {
      const ins = await pool.query(
        `INSERT INTO brand_metrics_snapshots (brand_key, platform, metrics_json, source, fetch_error)
         VALUES ('theroleroom', 'facebook', $1, $2, $3)
         RETURNING id`,
        [JSON.stringify(fb.data ?? {}), source, fb.error ?? null],
      );
      facebook.snapshotId = Number(ins.rows[0]?.id ?? 0);
      facebook.ok = fb.ok;
      if (!fb.ok) facebook.error = fb.error;
    } catch (err) {
      facebook.error = String(err);
    }
  } else {
    facebook.error = 'THEROLERROOM_PAGE_ID/TOKEN missing';
  }

  if (igUserId && pageToken) {
    const ig = await fetchInstagramBusinessMetrics(igUserId, pageToken);
    try {
      const ins = await pool.query(
        `INSERT INTO brand_metrics_snapshots (brand_key, platform, metrics_json, source, fetch_error)
         VALUES ('theroleroom', 'instagram', $1, $2, $3)
         RETURNING id`,
        [JSON.stringify(ig.data ?? {}), source, ig.error ?? null],
      );
      instagram.snapshotId = Number(ins.rows[0]?.id ?? 0);
      instagram.ok = ig.ok;
      if (!ig.ok) instagram.error = ig.error;
    } catch (err) {
      instagram.error = String(err);
    }
  } else {
    instagram.error = 'THEROLERROOM_IG_USER_ID/PAGE_TOKEN missing';
  }

  return { ok: facebook.ok || instagram.ok, facebook, instagram };
}

export function setupBrandMetricsRoutes(deps: SetupBrandMetricsDeps): void {
  const { app, pool, requireAdminOrDemoBypass } = deps;

  // ── POST snapshot — capture both platforms ──────────────────────────────
  app.post('/api/role-room/marketing-cockpit/brand-metrics/snapshot', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    try {
      const result = await captureSelfBrandMetrics(pool, 'manual');
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── GET history ─────────────────────────────────────────────────────────
  app.get('/api/role-room/marketing-cockpit/brand-metrics', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const brandKey = typeof req.query.brandKey === 'string' && req.query.brandKey.trim()
      ? req.query.brandKey.trim() : 'theroleroom';
    const days = Math.min(parseInt(String(req.query.days || '30'), 10) || 30, 365);
    try {
      const r = await pool.query(
        `SELECT id, platform, snapshot_at, metrics_json, source, fetch_error
         FROM brand_metrics_snapshots
         WHERE brand_key = $1 AND snapshot_at > now() - ($2 || ' days')::interval
         ORDER BY snapshot_at DESC`,
        [brandKey, String(days)],
      );
      res.json({
        ok: true, brandKey, days,
        snapshots: r.rows.map((row) => ({
          id: Number(row.id),
          platform: row.platform,
          snapshotAt: row.snapshot_at,
          metrics: row.metrics_json,
          source: row.source,
          fetchError: row.fetch_error,
        })),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
}

// ── In-process worker ───────────────────────────────────────────────────
const WORKER_INTERVAL_MS = 6 * 60 * 60 * 1000;        // 6 hours
const SNAPSHOT_FRESHNESS_MS = 24 * 60 * 60 * 1000;    // 24 hours
const STARTUP_DELAY_MS = 90_000;                       // 90s after boot

let workerInterval: NodeJS.Timeout | null = null;

export function startBrandMetricsWorker(pool: Pool): void {
  if (workerInterval) return;
  if (!process.env.THEROLERROOM_PAGE_ACCESS_TOKEN) {
    console.warn('[brand-metrics-worker] THEROLERROOM_PAGE_ACCESS_TOKEN missing — worker stays idle');
    return;
  }
  const tick = async () => {
    try {
      // Only snapshot if latest is >24h old.
      const r = await pool.query(
        `SELECT MAX(snapshot_at) AS latest FROM brand_metrics_snapshots
         WHERE brand_key = 'theroleroom' AND fetch_error IS NULL`,
      );
      const latest = r.rows[0]?.latest as Date | null;
      const ageMs = latest ? Date.now() - new Date(latest).getTime() : Infinity;
      if (ageMs < SNAPSHOT_FRESHNESS_MS) return;
      const t0 = Date.now();
      const result = await captureSelfBrandMetrics(pool, 'auto-worker');
      console.log(`[brand-metrics-worker] tick: fb=${result.facebook.ok ? 'ok' : 'err'} ig=${result.instagram.ok ? 'ok' : 'err'} elapsed=${Date.now() - t0}ms`);
    } catch (err) {
      console.error('[brand-metrics-worker] tick crashed', err);
    }
  };
  setTimeout(() => {
    void tick();
    workerInterval = setInterval(() => void tick(), WORKER_INTERVAL_MS);
    console.log(`[brand-metrics-worker] started (interval=${WORKER_INTERVAL_MS / 3_600_000}h, freshness=${SNAPSHOT_FRESHNESS_MS / 3_600_000}h)`);
  }, STARTUP_DELAY_MS);
}
