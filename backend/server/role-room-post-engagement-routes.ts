/**
 * role-room-post-engagement-routes.ts
 *
 * Tracker engagement for publiserte post-drafts:
 *   - Reactions + comments + shares fra /v21.0/{post-id}
 *   - Insights (impressions/reach/engaged) fra /v21.0/{post-id}/insights
 *   - engagement_rate beregnes som (reactions + comments + shares) / reach
 *
 * Worker poller hvert 30 min i 7 dager etter publish, deretter en
 * gang per dag i 30 dager. Snapshots brukes som "feedback-loop"-input
 * til AI-rapporten (top performers + content-mønstre).
 *
 * Endepunkter:
 *   POST /api/role-room/agent/post-drafts/:id/refresh-engagement
 *   GET  /api/role-room/agent/post-drafts/:id/engagement
 *   GET  /api/role-room/marketing-cockpit/top-performers?days=30
 */

import type { Application, Request, Response } from 'express';
import type { Pool } from 'pg';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const WORKER_INTERVAL_MS = 30 * 60 * 1000;          // 30 min
const STARTUP_DELAY_MS = 150_000;                     // 2.5 min etter boot
const POLL_DENSITY_HOURS = [1, 6, 24, 72, 168, 336, 720]; // 1h, 6h, 24h, 3d, 7d, 14d, 30d

interface FbEngagementData {
  reactionsTotal: number | null;
  reactionsLike: number | null;
  reactionsLove: number | null;
  reactionsOther: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  impressions: number | null;
  reach: number | null;
  engagedUsers: number | null;
  clicks: number | null;
  rawInsights: unknown;
  fetchError: string | null;
}

async function fetchFacebookPostEngagement(postId: string, pageAccessToken: string): Promise<FbEngagementData> {
  const empty: FbEngagementData = {
    reactionsTotal: null, reactionsLike: null, reactionsLove: null, reactionsOther: null,
    commentsCount: null, sharesCount: null,
    impressions: null, reach: null, engagedUsers: null, clicks: null,
    rawInsights: null, fetchError: null,
  };

  try {
    // 1. Reactions + comments + shares (summary-counts uten Page Public Content Access)
    const profileParams = new URLSearchParams({
      fields: 'reactions.summary(true).limit(0),comments.summary(true).limit(0),shares,reactions.type(LIKE).summary(true).limit(0).as(likes),reactions.type(LOVE).summary(true).limit(0).as(loves)',
      access_token: pageAccessToken,
    });
    const profileR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(postId)}?${profileParams}`);
    const profile = (await profileR.json().catch(() => ({}))) as Record<string, unknown>;
    if (!profileR.ok) {
      const err = profile.error as Record<string, unknown> | undefined;
      return { ...empty, fetchError: typeof err?.message === 'string' ? err.message : `profile status ${profileR.status}`, rawInsights: profile };
    }

    const reactionsObj = profile.reactions as { summary?: { total_count?: number } } | undefined;
    const commentsObj = profile.comments as { summary?: { total_count?: number } } | undefined;
    const sharesObj = profile.shares as { count?: number } | undefined;
    const likesObj = profile.likes as { summary?: { total_count?: number } } | undefined;
    const lovesObj = profile.loves as { summary?: { total_count?: number } } | undefined;

    const reactionsTotal = reactionsObj?.summary?.total_count ?? null;
    const reactionsLike = likesObj?.summary?.total_count ?? null;
    const reactionsLove = lovesObj?.summary?.total_count ?? null;
    const reactionsOther = (reactionsTotal != null && reactionsLike != null && reactionsLove != null)
      ? Math.max(0, reactionsTotal - reactionsLike - reactionsLove) : null;

    // 2. Insights (krever Page-token + scope)
    const insightsParams = new URLSearchParams({
      metric: 'post_impressions,post_impressions_unique,post_engaged_users,post_clicks',
      access_token: pageAccessToken,
    });
    const insightsR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(postId)}/insights?${insightsParams}`);
    const insights = (await insightsR.json().catch(() => ({}))) as Record<string, unknown>;
    let impressions: number | null = null;
    let reach: number | null = null;
    let engagedUsers: number | null = null;
    let clicks: number | null = null;
    if (insightsR.ok && Array.isArray(insights.data)) {
      for (const m of insights.data as Array<Record<string, unknown>>) {
        const name = String(m.name || '');
        const values = m.values as Array<{ value?: number }> | undefined;
        const v = values && values.length > 0 ? Number(values[values.length - 1]?.value ?? 0) : null;
        if (name === 'post_impressions') impressions = v;
        if (name === 'post_impressions_unique') reach = v;
        if (name === 'post_engaged_users') engagedUsers = v;
        if (name === 'post_clicks') clicks = v;
      }
    }

    return {
      reactionsTotal, reactionsLike, reactionsLove, reactionsOther,
      commentsCount: commentsObj?.summary?.total_count ?? null,
      sharesCount: sharesObj?.count ?? null,
      impressions, reach, engagedUsers, clicks,
      rawInsights: { profile, insights },
      fetchError: null,
    };
  } catch (err) {
    return { ...empty, fetchError: String(err) };
  }
}

function computeEngagementRate(d: FbEngagementData): number | null {
  if (d.reach == null || d.reach === 0) return null;
  const interactions = (d.reactionsTotal ?? 0) + (d.commentsCount ?? 0) + (d.sharesCount ?? 0);
  return Math.round((interactions / d.reach) * 10_000) / 10_000;
}

async function captureEngagementForDraft(pool: Pool, draftId: number): Promise<{
  ok: boolean;
  snapshotId: number | null;
  data?: FbEngagementData & { engagementRate: number | null; hoursAfterPublish: number | null };
  error?: string;
}> {
  // 1. Load draft to verify it's published
  const draftR = await pool.query(
    `SELECT id, platform, external_post_id, published_at FROM marketing_post_drafts WHERE id = $1`,
    [draftId],
  );
  if (!draftR.rowCount) return { ok: false, snapshotId: null, error: 'draft not found' };
  const draft = draftR.rows[0];
  if (!draft.external_post_id || !draft.published_at) {
    return { ok: false, snapshotId: null, error: 'draft not yet published' };
  }
  if (draft.platform !== 'facebook') {
    return { ok: false, snapshotId: null, error: `engagement-tracking only for facebook (got ${draft.platform})` };
  }

  const pageToken = (process.env.THEROLERROOM_PAGE_ACCESS_TOKEN || '').trim();
  if (!pageToken) return { ok: false, snapshotId: null, error: 'THEROLERROOM_PAGE_ACCESS_TOKEN missing' };

  const data = await fetchFacebookPostEngagement(String(draft.external_post_id), pageToken);
  const engagementRate = computeEngagementRate(data);
  const publishedAt = new Date(draft.published_at);
  const hoursAfter = (Date.now() - publishedAt.getTime()) / 3_600_000;

  try {
    const ins = await pool.query(
      `INSERT INTO post_engagement_snapshots
         (draft_id, external_post_id, platform, hours_after_publish,
          reactions_total, reactions_like, reactions_love, reactions_other,
          comments_count, shares_count,
          impressions, reach, engaged_users, clicks,
          engagement_rate, raw_insights_json, fetch_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [
        draftId, String(draft.external_post_id), String(draft.platform), Math.round(hoursAfter * 100) / 100,
        data.reactionsTotal, data.reactionsLike, data.reactionsLove, data.reactionsOther,
        data.commentsCount, data.sharesCount,
        data.impressions, data.reach, data.engagedUsers, data.clicks,
        engagementRate,
        data.rawInsights ? JSON.stringify(data.rawInsights) : null,
        data.fetchError,
      ],
    );
    return {
      ok: !data.fetchError,
      snapshotId: Number(ins.rows[0].id),
      data: { ...data, engagementRate, hoursAfterPublish: hoursAfter },
      error: data.fetchError ?? undefined,
    };
  } catch (err) {
    return { ok: false, snapshotId: null, error: String(err) };
  }
}

export function setupPostEngagementRoutes(deps: {
  app: Application;
  pool: Pool;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}): void {
  const { app, pool, requireAdminOrDemoBypass } = deps;

  // ── POST refresh-engagement ──────────────────────────────────────────────
  app.post('/api/role-room/agent/post-drafts/:id/refresh-engagement', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid id' }); return; }
    const result = await captureEngagementForDraft(pool, id);
    res.status(result.ok ? 200 : 400).json(result);
  });

  // ── GET engagement-history per draft ─────────────────────────────────────
  app.get('/api/role-room/agent/post-drafts/:id/engagement', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid id' }); return; }
    try {
      const r = await pool.query(
        `SELECT id, snapshot_at, hours_after_publish,
                reactions_total, comments_count, shares_count,
                impressions, reach, engaged_users, clicks, engagement_rate, fetch_error
         FROM post_engagement_snapshots
         WHERE draft_id = $1
         ORDER BY snapshot_at ASC`,
        [id],
      );
      res.json({
        ok: true,
        draftId: id,
        snapshots: r.rows.map((row) => ({
          id: Number(row.id),
          snapshotAt: row.snapshot_at,
          hoursAfterPublish: row.hours_after_publish != null ? Number(row.hours_after_publish) : null,
          reactionsTotal: row.reactions_total,
          commentsCount: row.comments_count,
          sharesCount: row.shares_count,
          impressions: row.impressions,
          reach: row.reach,
          engagedUsers: row.engaged_users,
          clicks: row.clicks,
          engagementRate: row.engagement_rate != null ? Number(row.engagement_rate) : null,
          fetchError: row.fetch_error,
        })),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── GET top-performers ───────────────────────────────────────────────────
  app.get('/api/role-room/marketing-cockpit/top-performers', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const days = Math.min(parseInt(String(req.query.days || '30'), 10) || 30, 365);
    const limit = Math.min(parseInt(String(req.query.limit || '10'), 10) || 10, 50);
    try {
      const r = await pool.query(
        `SELECT
           d.id AS draft_id, d.platform, d.caption, d.source_insight,
           d.external_post_id, d.published_at,
           (SELECT row_to_json(s)
            FROM (
              SELECT reactions_total, comments_count, shares_count,
                     impressions, reach, engaged_users, engagement_rate, snapshot_at
              FROM post_engagement_snapshots
              WHERE draft_id = d.id AND fetch_error IS NULL
              ORDER BY snapshot_at DESC LIMIT 1
            ) s
           ) AS latest_metrics
         FROM marketing_post_drafts d
         WHERE d.status = 'published' AND d.published_at > now() - ($1 || ' days')::interval
         ORDER BY (
           SELECT engagement_rate FROM post_engagement_snapshots
           WHERE draft_id = d.id AND fetch_error IS NULL
           ORDER BY snapshot_at DESC LIMIT 1
         ) DESC NULLS LAST
         LIMIT $2`,
        [String(days), limit],
      );
      res.json({
        ok: true,
        days,
        topPerformers: r.rows.map((row) => ({
          draftId: Number(row.draft_id),
          platform: row.platform,
          caption: typeof row.caption === 'string' ? row.caption.slice(0, 200) : '',
          sourceInsight: row.source_insight,
          externalPostId: row.external_post_id,
          publishedAt: row.published_at,
          metrics: row.latest_metrics,
        })),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
}

// ── In-process worker ───────────────────────────────────────────────────
let workerInterval: NodeJS.Timeout | null = null;

export function startPostEngagementWorker(pool: Pool): void {
  if (workerInterval) return;
  if (!process.env.THEROLERROOM_PAGE_ACCESS_TOKEN) {
    console.warn('[post-engagement-worker] THEROLERROOM_PAGE_ACCESS_TOKEN missing — worker stays idle');
    return;
  }
  const tick = async () => {
    try {
      // Find drafts due for a snapshot:
      // - published_at within last 30d
      // - last snapshot >X hours ago (X varies by age — denser early)
      const r = await pool.query(
        `SELECT d.id, d.published_at,
                (SELECT MAX(snapshot_at) FROM post_engagement_snapshots
                 WHERE draft_id = d.id) AS last_snapshot_at
         FROM marketing_post_drafts d
         WHERE d.status = 'published'
           AND d.platform = 'facebook'
           AND d.external_post_id IS NOT NULL
           AND d.published_at > now() - interval '30 days'`,
      );
      const due: number[] = [];
      const now = Date.now();
      for (const row of r.rows) {
        const publishedAt = new Date(row.published_at).getTime();
        const ageH = (now - publishedAt) / 3_600_000;
        const lastH = row.last_snapshot_at
          ? (now - new Date(row.last_snapshot_at).getTime()) / 3_600_000
          : Infinity;
        // Bestem grace-period basert på post-alder.
        // Tett poll første 24t, deretter avtagende
        let gracePeriod = 168; // default 7d (en gang i uka for gamle)
        if (ageH < 2) gracePeriod = 0.5;
        else if (ageH < 12) gracePeriod = 2;
        else if (ageH < 48) gracePeriod = 6;
        else if (ageH < 168) gracePeriod = 24;
        else if (ageH < 336) gracePeriod = 72;
        if (lastH >= gracePeriod) due.push(Number(row.id));
      }
      if (due.length > 0) {
        const t0 = Date.now();
        let ok = 0, fail = 0;
        for (const draftId of due) {
          const result = await captureEngagementForDraft(pool, draftId);
          if (result.ok) ok++; else fail++;
        }
        console.log(`[post-engagement-worker] tick: due=${due.length} ok=${ok} fail=${fail} elapsed=${Date.now() - t0}ms`);
      }
    } catch (err) {
      console.error('[post-engagement-worker] tick crashed', err);
    }
  };
  setTimeout(() => {
    void tick();
    workerInterval = setInterval(() => void tick(), WORKER_INTERVAL_MS);
    console.log(`[post-engagement-worker] started (interval=${WORKER_INTERVAL_MS / 60_000} min, density-based grace)`);
  }, STARTUP_DELAY_MS);
}
