/**
 * role-room-marketing-competitors-routes.ts — Konkurrent-monitor for
 * Marketing Cockpit. Tracker FB Pages, lagrer daglige snapshots av
 * fan_count + activity, gir frontend en trendlinje + en aktivitets-feed.
 *
 * Endpoints (alle requireAdminOrDemoBypass):
 *   GET    /api/role-room/marketing-cockpit/competitors?brandKey=…
 *   POST   /api/role-room/marketing-cockpit/competitors
 *   DELETE /api/role-room/marketing-cockpit/competitors/:id
 *   POST   /api/role-room/marketing-cockpit/competitors/:id/snapshot
 *          → fetcher fersk profil fra Meta + lagrer snapshot, returnerer diff vs forrige
 *   GET    /api/role-room/marketing-cockpit/competitors/:id/snapshots?days=30
 *
 * Bruker THEROLERROOM_PAGE_ACCESS_TOKEN som default (samme token funker for
 * å lese andre Pages som har Page Public Content Access godkjent — eller
 * et explicit accessToken kan sendes i POST snapshot-body).
 */

import type { Application, Request, Response } from 'express';
import type { Pool } from 'pg';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export interface SetupCompetitorsRoutesDeps {
  app: Application;
  pool: Pool;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

interface SnapshotData {
  fanCount: number | null;
  name: string | null;
  category: string | null;
  website: string | null;
  about: string | null;
  recentPostCount7d: number | null;
  recentPostCount30d: number | null;
  rawProfile: unknown;
  rawPosts: unknown;
  fetchError: string | null;
}

async function fetchPageSnapshot(pageId: string, accessToken: string): Promise<SnapshotData> {
  const empty: SnapshotData = {
    fanCount: null, name: null, category: null, website: null, about: null,
    recentPostCount7d: null, recentPostCount30d: null, rawProfile: null, rawPosts: null,
    fetchError: null,
  };

  try {
    const profileParams = new URLSearchParams({
      fields: 'id,name,fan_count,category,website,about',
      access_token: accessToken,
    });
    const profileR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(pageId)}?${profileParams}`);
    const profile = (await profileR.json().catch(() => ({}))) as Record<string, unknown>;
    if (!profileR.ok) {
      const err = profile.error as Record<string, unknown> | undefined;
      return { ...empty, rawProfile: profile, fetchError: typeof err?.message === 'string' ? err.message : `status ${profileR.status}` };
    }

    const postsParams = new URLSearchParams({
      fields: 'id,created_time',
      limit: '100',
      access_token: accessToken,
    });
    const postsR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/posts?${postsParams}`);
    const posts = (await postsR.json().catch(() => ({}))) as Record<string, unknown>;

    // Count posts in last 7 days and last 30 days (best-effort — null if posts unavailable).
    let count7 = 0, count30 = 0;
    const now = Date.now();
    if (Array.isArray(posts.data)) {
      for (const p of posts.data as Array<Record<string, unknown>>) {
        const created = typeof p.created_time === 'string' ? Date.parse(p.created_time) : NaN;
        if (!Number.isFinite(created)) continue;
        const ageDays = (now - created) / 86_400_000;
        if (ageDays < 7) count7++;
        if (ageDays < 30) count30++;
      }
    }

    return {
      fanCount: typeof profile.fan_count === 'number' ? profile.fan_count : null,
      name: typeof profile.name === 'string' ? profile.name : null,
      category: typeof profile.category === 'string' ? profile.category : null,
      website: typeof profile.website === 'string' ? profile.website : null,
      about: typeof profile.about === 'string' ? profile.about : null,
      recentPostCount7d: postsR.ok && Array.isArray(posts.data) ? count7 : null,
      recentPostCount30d: postsR.ok && Array.isArray(posts.data) ? count30 : null,
      rawProfile: profile,
      rawPosts: postsR.ok ? posts : { error: posts, status: postsR.status },
      fetchError: null,
    };
  } catch (err) {
    return { ...empty, fetchError: String(err) };
  }
}

export function setupMarketingCompetitorsRoutes(deps: SetupCompetitorsRoutesDeps): void {
  const { app, pool, requireAdminOrDemoBypass } = deps;

  // ── GET list ─────────────────────────────────────────────────────────────
  app.get('/api/role-room/marketing-cockpit/competitors', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const brandKey = typeof req.query.brandKey === 'string' && req.query.brandKey.trim()
      ? req.query.brandKey.trim() : 'theroleroom';
    try {
      const r = await pool.query(
        `SELECT
           p.id, p.page_id, p.nickname, p.category, p.notes, p.active, p.added_at,
           (
             SELECT row_to_json(s)
             FROM (
               SELECT fan_count, name, category, website, recent_post_count_7d, recent_post_count_30d,
                      snapshot_at, fetch_error
               FROM marketing_competitor_snapshots
               WHERE competitor_id = p.id
               ORDER BY snapshot_at DESC LIMIT 1
             ) s
           ) AS latest_snapshot
         FROM marketing_competitor_pages p
         WHERE p.brand_key = $1
         ORDER BY p.added_at DESC`,
        [brandKey],
      );
      res.json({
        ok: true,
        brandKey,
        competitors: r.rows.map((row) => ({
          id: Number(row.id),
          pageId: row.page_id,
          nickname: row.nickname,
          category: row.category,
          notes: row.notes,
          active: row.active,
          addedAt: row.added_at,
          latestSnapshot: row.latest_snapshot,
        })),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── POST add ─────────────────────────────────────────────────────────────
  app.post('/api/role-room/marketing-cockpit/competitors', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const brandKey = typeof body.brandKey === 'string' && body.brandKey.trim() ? body.brandKey.trim() : 'theroleroom';
    const pageId = typeof body.pageId === 'string' ? body.pageId.trim() : '';
    const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    if (!pageId || !nickname) {
      res.status(400).json({ ok: false, error: 'pageId + nickname required' });
      return;
    }
    try {
      const r = await pool.query(
        `INSERT INTO marketing_competitor_pages (brand_key, page_id, nickname, notes, added_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (brand_key, page_id) DO UPDATE
           SET nickname = EXCLUDED.nickname, notes = EXCLUDED.notes, active = true
         RETURNING id, page_id, nickname, added_at`,
        [brandKey, pageId, nickname, notes, 'admin'],
      );
      res.json({
        ok: true,
        competitor: {
          id: Number(r.rows[0].id),
          pageId: r.rows[0].page_id,
          nickname: r.rows[0].nickname,
          addedAt: r.rows[0].added_at,
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── DELETE ───────────────────────────────────────────────────────────────
  app.delete('/api/role-room/marketing-cockpit/competitors/:id', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ ok: false, error: 'invalid id' });
      return;
    }
    try {
      const r = await pool.query('DELETE FROM marketing_competitor_pages WHERE id = $1', [id]);
      res.json({ ok: true, deleted: r.rowCount ?? 0 });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── POST snapshot-now ────────────────────────────────────────────────────
  app.post('/api/role-room/marketing-cockpit/competitors/:id/snapshot', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ ok: false, error: 'invalid id' });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const explicitToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
    const accessToken = explicitToken || (process.env.THEROLERROOM_PAGE_ACCESS_TOKEN || '').trim();
    if (!accessToken) {
      res.status(503).json({ ok: false, error: 'accessToken or THEROLERROOM_PAGE_ACCESS_TOKEN required' });
      return;
    }

    try {
      const compR = await pool.query('SELECT page_id FROM marketing_competitor_pages WHERE id = $1', [id]);
      if (!compR.rowCount || compR.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'competitor not found' });
        return;
      }
      const pageId = compR.rows[0].page_id as string;

      const snapshot = await fetchPageSnapshot(pageId, accessToken);

      // Get previous snapshot for diff.
      const prevR = await pool.query(
        `SELECT fan_count, recent_post_count_7d, snapshot_at
         FROM marketing_competitor_snapshots
         WHERE competitor_id = $1 AND fetch_error IS NULL
         ORDER BY snapshot_at DESC LIMIT 1`,
        [id],
      );
      const prev = prevR.rowCount && prevR.rowCount > 0 ? prevR.rows[0] : null;

      // Insert new snapshot.
      const insR = await pool.query(
        `INSERT INTO marketing_competitor_snapshots
           (competitor_id, fan_count, name, category, website, about,
            recent_post_count_7d, recent_post_count_30d, raw_profile_json, raw_posts_json, fetch_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, snapshot_at`,
        [
          id, snapshot.fanCount, snapshot.name, snapshot.category, snapshot.website, snapshot.about,
          snapshot.recentPostCount7d, snapshot.recentPostCount30d,
          snapshot.rawProfile ? JSON.stringify(snapshot.rawProfile) : null,
          snapshot.rawPosts ? JSON.stringify(snapshot.rawPosts) : null,
          snapshot.fetchError,
        ],
      );

      // Also persist category onto the competitor row if not already set.
      if (snapshot.category) {
        await pool.query(
          `UPDATE marketing_competitor_pages SET category = $2 WHERE id = $1 AND (category IS NULL OR category = '')`,
          [id, snapshot.category],
        );
      }

      const diff = prev ? {
        fanCountDelta: (snapshot.fanCount ?? 0) - (prev.fan_count ?? 0),
        postCount7dDelta: (snapshot.recentPostCount7d ?? 0) - (prev.recent_post_count_7d ?? 0),
        sincePrev: prev.snapshot_at,
      } : null;

      res.json({
        ok: !snapshot.fetchError,
        snapshotId: Number(insR.rows[0].id),
        snapshotAt: insR.rows[0].snapshot_at,
        snapshot: {
          fanCount: snapshot.fanCount,
          name: snapshot.name,
          category: snapshot.category,
          website: snapshot.website,
          recentPostCount7d: snapshot.recentPostCount7d,
          recentPostCount30d: snapshot.recentPostCount30d,
        },
        diff,
        fetchError: snapshot.fetchError,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // ── GET snapshots-history ────────────────────────────────────────────────
  app.get('/api/role-room/marketing-cockpit/competitors/:id/snapshots', async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ ok: false, error: 'invalid id' });
      return;
    }
    const days = Math.min(parseInt(String(req.query.days || '30'), 10) || 30, 365);
    try {
      const r = await pool.query(
        `SELECT id, snapshot_at, fan_count, name, category, website,
                recent_post_count_7d, recent_post_count_30d, fetch_error
         FROM marketing_competitor_snapshots
         WHERE competitor_id = $1 AND snapshot_at > now() - ($2 || ' days')::interval
         ORDER BY snapshot_at ASC`,
        [id, String(days)],
      );
      res.json({
        ok: true,
        competitorId: id,
        days,
        snapshots: r.rows.map((row) => ({
          id: Number(row.id),
          snapshotAt: row.snapshot_at,
          fanCount: row.fan_count,
          name: row.name,
          category: row.category,
          website: row.website,
          recentPostCount7d: row.recent_post_count_7d,
          recentPostCount30d: row.recent_post_count_30d,
          fetchError: row.fetch_error,
        })),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });
}
