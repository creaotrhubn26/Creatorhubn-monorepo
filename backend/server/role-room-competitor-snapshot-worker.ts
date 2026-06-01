/**
 * role-room-competitor-snapshot-worker.ts
 *
 * In-process background worker som hver time:
 *   1. Finner alle competitor-rows med auto_snapshot=true OG (last_snapshot_at IS NULL
 *      ELLER last_snapshot_at < now()-24h)
 *   2. For hver: kall fetchPageSnapshot via Meta API (samme path som manual snapshot)
 *   3. Lagre snapshot + oppdater last_snapshot_at på row
 *
 * Bruker THEROLERROOM_PAGE_ACCESS_TOKEN som default token. Hvis en row trenger
 * et explicit token (annet brand-Page), kan vi senere lagre per-brand-tokens.
 *
 * Worker er trygt idempotent — flere instances kan kjøre samtidig uten å lage
 * dobbel-snapshots takket være last_snapshot_at-sjekken (race-condition vinduet
 * er minimalt og verste fall = 2 snapshots tatt nær i tid; det bryter ingenting).
 */

import type { Pool } from 'pg';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const WORKER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SNAPSHOT_FRESHNESS_MS = 24 * 60 * 60 * 1000; // 24 hours
const STARTUP_DELAY_MS = 60_000; // wait 1 min after boot so the server is healthy

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
      fields: 'id,created_time', limit: '100', access_token: accessToken,
    });
    const postsR = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/posts?${postsParams}`);
    const posts = (await postsR.json().catch(() => ({}))) as Record<string, unknown>;
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

async function fetchInstagramSnapshot(
  igUsername: string,
  callerIgUserId: string,
  accessToken: string,
): Promise<SnapshotData> {
  const empty: SnapshotData = {
    fanCount: null, name: null, category: null, website: null, about: null,
    recentPostCount7d: null, recentPostCount30d: null, rawProfile: null, rawPosts: null,
    fetchError: null,
  };
  try {
    const params = new URLSearchParams({
      fields: `business_discovery.username(${igUsername}){username,name,followers_count,media_count,biography,website,media.limit(50){id,timestamp}}`,
      access_token: accessToken,
    });
    const r = await fetch(`${META_GRAPH_BASE}/${encodeURIComponent(callerIgUserId)}?${params}`);
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok || !body.business_discovery) {
      const err = body.error as Record<string, unknown> | undefined;
      return { ...empty, rawProfile: body, fetchError: typeof err?.message === 'string' ? err.message : `status ${r.status}` };
    }
    const bd = body.business_discovery as Record<string, unknown>;
    let c7 = 0, c30 = 0;
    const media = (bd.media as Record<string, unknown> | undefined)?.data;
    const now = Date.now();
    if (Array.isArray(media)) {
      for (const m of media as Array<Record<string, unknown>>) {
        const created = typeof m.timestamp === 'string' ? Date.parse(m.timestamp) : NaN;
        if (!Number.isFinite(created)) continue;
        const ageDays = (now - created) / 86_400_000;
        if (ageDays < 7) c7++;
        if (ageDays < 30) c30++;
      }
    }
    return {
      fanCount: typeof bd.followers_count === 'number' ? bd.followers_count : null,
      name: typeof bd.name === 'string' ? bd.name : null,
      category: null,
      website: typeof bd.website === 'string' ? bd.website : null,
      about: typeof bd.biography === 'string' ? bd.biography : null,
      recentPostCount7d: c7, recentPostCount30d: c30,
      rawProfile: bd, rawPosts: null, fetchError: null,
    };
  } catch (err) {
    return { ...empty, fetchError: String(err) };
  }
}

async function runOnce(pool: Pool, accessToken: string): Promise<{ checked: number; snapshotted: number; errors: number }> {
  const cutoff = new Date(Date.now() - SNAPSHOT_FRESHNESS_MS).toISOString();
  let due: Array<{ id: number; pageId: string; brandKey: string; accountType: string; igUsername: string | null }> = [];
  try {
    const r = await pool.query(
      `SELECT id, page_id, brand_key, account_type, ig_username
       FROM marketing_competitor_pages
       WHERE auto_snapshot = true AND active = true
         AND (last_snapshot_at IS NULL OR last_snapshot_at < $1)`,
      [cutoff],
    );
    due = r.rows.map((row) => ({
      id: Number(row.id), pageId: row.page_id, brandKey: row.brand_key,
      accountType: String(row.account_type || 'facebook'),
      igUsername: row.ig_username as string | null,
    }));
  } catch (err) {
    console.error('[competitor-worker] query failed', err);
    return { checked: 0, snapshotted: 0, errors: 1 };
  }
  const callerIgUserId = (process.env.THEROLERROOM_IG_USER_ID || '').trim();
  let snapshotted = 0, errors = 0;
  for (const c of due) {
    try {
      const snapshot = c.accountType === 'instagram' && c.igUsername && callerIgUserId
        ? await fetchInstagramSnapshot(c.igUsername, callerIgUserId, accessToken)
        : await fetchPageSnapshot(c.pageId, accessToken);
      await pool.query(
        `INSERT INTO marketing_competitor_snapshots
           (competitor_id, fan_count, name, category, website, about,
            recent_post_count_7d, recent_post_count_30d, raw_profile_json, raw_posts_json, fetch_error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          c.id, snapshot.fanCount, snapshot.name, snapshot.category, snapshot.website, snapshot.about,
          snapshot.recentPostCount7d, snapshot.recentPostCount30d,
          snapshot.rawProfile ? JSON.stringify(snapshot.rawProfile) : null,
          snapshot.rawPosts ? JSON.stringify(snapshot.rawPosts) : null,
          snapshot.fetchError,
        ],
      );
      await pool.query(
        `UPDATE marketing_competitor_pages SET last_snapshot_at = now()
         ${snapshot.category ? ', category = COALESCE(NULLIF(category, \'\'), $2)' : ''}
         WHERE id = $1`,
        snapshot.category ? [c.id, snapshot.category] : [c.id],
      );
      if (snapshot.fetchError) errors++;
      else snapshotted++;
    } catch (err) {
      console.error(`[competitor-worker] snapshot ${c.id} failed`, err);
      errors++;
    }
  }
  return { checked: due.length, snapshotted, errors };
}

let workerInterval: NodeJS.Timeout | null = null;

export function startCompetitorSnapshotWorker(pool: Pool): void {
  if (workerInterval) {
    console.warn('[competitor-worker] already running, ignoring start');
    return;
  }
  const accessToken = (process.env.THEROLERROOM_PAGE_ACCESS_TOKEN || '').trim();
  if (!accessToken) {
    console.warn('[competitor-worker] THEROLERROOM_PAGE_ACCESS_TOKEN missing — worker stays idle');
    return;
  }
  const tick = async () => {
    const t0 = Date.now();
    try {
      const result = await runOnce(pool, accessToken);
      if (result.checked > 0) {
        console.log(`[competitor-worker] tick: checked=${result.checked} snapshotted=${result.snapshotted} errors=${result.errors} elapsed=${Date.now() - t0}ms`);
      }
    } catch (err) {
      console.error('[competitor-worker] tick crashed', err);
    }
  };
  setTimeout(() => {
    void tick();
    workerInterval = setInterval(() => void tick(), WORKER_INTERVAL_MS);
    console.log(`[competitor-worker] started (interval=${WORKER_INTERVAL_MS / 60_000} min, freshness=${SNAPSHOT_FRESHNESS_MS / 3_600_000}h)`);
  }, STARTUP_DELAY_MS);
}

// Exposed for manual trigger / tests.
export async function runCompetitorSnapshotWorkerOnce(pool: Pool): Promise<{
  ok: boolean; checked: number; snapshotted: number; errors: number;
}> {
  const accessToken = (process.env.THEROLERROOM_PAGE_ACCESS_TOKEN || '').trim();
  if (!accessToken) return { ok: false, checked: 0, snapshotted: 0, errors: 1 };
  const r = await runOnce(pool, accessToken);
  return { ok: true, ...r };
}
