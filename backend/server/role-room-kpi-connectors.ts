/**
 * Plattform-connectors for KPI-tracking (items #177, #178, #179).
 *
 * Hver connector tar liste over posts som har en feed_plan_post_id
 * (= posts som faktisk ble publisert), henter insights fra plattformens
 * Insights-API, og returnerer KpiSnapshotInput[]-array. persistKpi-
 * SnapshotBatch skriver dem til DB.
 *
 * Meta og TikTok leser via feed_plan_post_id. LinkedIn leser via
 * external_post_id (direkte publisering fra markedsplanen) og henter kun
 * likes/kommentarer fra socialActions — impressions krever Page-stats og
 * rapporteres ikke.
 */

import type { Pool } from "pg";
import type { KpiSnapshotInput } from "./role-room-kpi-tracking.js";
import { ensureFreshTikTokConnection } from "./role-room-tiktok-oauth.js";
import { getProjectProducerUserId } from "./client-portal-connected-platforms.js";
import { fetchTikTokVideoMetrics } from "./role-room-tiktok-insights.js";
import { fetchLinkedInSocialActions } from "./social-linkedin-social-actions.js";
import { decryptLinkedInToken } from "./social-publisher-linkedin.js";

// ─────────────────────────────────────────────────────────────────────
// #177 — Meta Graph API connector (IG Business + Facebook Pages)
// ─────────────────────────────────────────────────────────────────────

interface MetaConnection {
  igUserId: string | null;
  pageId: string | null;
  accessToken: string;
}

async function loadMetaConnection(pool: Pool, projectId: string): Promise<MetaConnection | null> {
  try {
    const r = await pool.query<{ ig_user_id: string | null; page_id: string | null; access_token: string }>(
      `SELECT ig_user_id, page_id, access_token
         FROM role_room_instagram_connections
        WHERE project_id = $1
        ORDER BY connected_at DESC
        LIMIT 1`,
      [projectId],
    );
    if (!r.rows[0]?.access_token) return null;
    return {
      igUserId: r.rows[0].ig_user_id,
      pageId: r.rows[0].page_id,
      accessToken: r.rows[0].access_token,
    };
  } catch {
    return null;
  }
}

/** Henter IG-media-insights for én publisert post. Meta returnerer:
 *  impressions, reach, engagement, saved, total_interactions, video_views (for reels).
 *  Vi map'er disse direkte til metric-navn med snake_case-norm. */
async function fetchInstagramMediaInsights(
  accessToken: string,
  mediaId: string,
): Promise<Array<{ metric: string; value: number }>> {
  // Standard metrics som returneres for media av type IMAGE/VIDEO/CAROUSEL_ALBUM.
  // Meta returnerer 400 hvis metric ikke finnes for posten — vi splittet
  // i to kall (standard + reel-only) for å håndtere det.
  const standardMetrics = "impressions,reach,saved,likes,comments,shares";
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}/insights` +
    `?metric=${standardMetrics}&access_token=${encodeURIComponent(accessToken)}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const payload = await response.json() as { data?: Array<{ name?: string; values?: Array<{ value?: number }> }> };
    const data = payload.data ?? [];
    return data
      .map((entry) => {
        const name = typeof entry.name === "string" ? entry.name : null;
        const value = entry.values?.[0]?.value;
        if (!name || typeof value !== "number") return null;
        return { metric: name, value };
      })
      .filter((e): e is { metric: string; value: number } => e !== null);
  } catch (error) {
    console.error("[role-room-kpi-connectors] Meta insights failed", { mediaId, error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export async function fetchMetaKpisForPosts(
  pool: Pool,
  projectId: string,
  planId: string,
  posts: Array<{ id: string; feedPlanPostId: string | null; primaryPlatform: string | null }>,
): Promise<KpiSnapshotInput[]> {
  const connection = await loadMetaConnection(pool, projectId);
  if (!connection?.accessToken) {
    console.log("[role-room-kpi-connectors] Meta: ingen IG-connection for prosjekt", projectId);
    return [];
  }

  // Bare IG-posts som faktisk er publisert. feedPlanPostId er proxy for
  // "accepted-til-feed-planner", men vi trenger også media_id fra
  // feed-planner-tabellen. Forenkles: vi prøver feed_plan_post_id som
  // media_id-substituent (feed-planner skal lagre meta_media_id-feltet
  // når publisert, men det er en annen utvidelse — for nå returnerer vi
  // tomt for posts der vi ikke har en mappet media_id).
  const candidates = posts.filter((p) =>
    p.feedPlanPostId
    && (p.primaryPlatform === "instagram" || p.primaryPlatform === "facebook"),
  );
  if (candidates.length === 0) return [];

  // Koble feed-plan-ID til det faktiske Meta media-id-et som publish-jobben
  // persisterer. Feed-plan-postene ligger som JSONB i role_room_feed_plans;
  // det finnes derfor ingen separat role_room_feed_plan_posts-tabell.
  let mediaIdMap: Map<string, string>;
  try {
    const feedIds = candidates.map((p) => p.feedPlanPostId!).filter(Boolean);
    const r = await pool.query<{ id: string; meta_media_id: string | null }>(
      `SELECT DISTINCT ON (feed_plan_post_id)
              feed_plan_post_id AS id,
              ig_media_id AS meta_media_id
         FROM role_room_instagram_publish_jobs
        WHERE feed_plan_post_id = ANY($1::text[])
          AND status = 'published'
          AND ig_media_id IS NOT NULL
        ORDER BY feed_plan_post_id, published_at DESC NULLS LAST, updated_at DESC`,
      [feedIds],
    );
    mediaIdMap = new Map(r.rows.filter((row) => row.meta_media_id).map((row) => [row.id, row.meta_media_id!]));
  } catch {
    // Publiseringsskjemaet kan mangle før migrasjoner er kjørt.
    mediaIdMap = new Map();
  }

  const snapshots: KpiSnapshotInput[] = [];
  for (const post of candidates) {
    const mediaId = mediaIdMap.get(post.feedPlanPostId!);
    if (!mediaId) continue;
    const insights = await fetchInstagramMediaInsights(connection.accessToken, mediaId);
    for (const ins of insights) {
      snapshots.push({
        postId: post.id,
        planId,
        platform: post.primaryPlatform === "facebook" ? "facebook" : "instagram",
        metric: ins.metric,
        value: ins.value,
        source: "meta_graph",
      });
    }
  }
  return snapshots;
}

// ─────────────────────────────────────────────────────────────────────
// #178 — TikTok Business API connector (stub — krever app-review)
// ─────────────────────────────────────────────────────────────────────

export async function fetchTikTokKpisForPosts(
  pool: Pool,
  projectId: string,
  planId: string,
  posts: Array<{ id: string; feedPlanPostId: string | null; primaryPlatform: string | null }>,
): Promise<KpiSnapshotInput[]> {
  const tiktokPosts = posts.filter((p) => p.feedPlanPostId && p.primaryPlatform === "tiktok");
  if (tiktokPosts.length === 0) return [];

  // The producer's TikTok connection holds the token; posts are project-scoped.
  const userId = await getProjectProducerUserId(pool, projectId);
  if (!userId) return [];
  const authorized = await ensureFreshTikTokConnection(pool, userId);
  if (!authorized?.accessToken) return [];
  if (!authorized.connection.scopes.includes("video.list")) {
    console.log("[role-room-kpi-connectors] TikTok: mangler video.list-scope — brukeren må re-koble TikTok. Returnerer tomt.");
    return [];
  }

  // Map feedPlanPostId → published TikTok video id. The publish flow records
  // external_post_id in social_metrics with raw.feedPlanPostId (see
  // role-room-social-routes.ts) — no separate media-id column exists.
  const feedIds = tiktokPosts.map((p) => p.feedPlanPostId!).filter(Boolean);
  const videoIdByPost = new Map<string, string>();
  try {
    const r = await pool.query<{ feed_plan_post_id: string | null; external_post_id: string | null }>(
      `SELECT raw->>'feedPlanPostId' AS feed_plan_post_id, external_post_id
         FROM social_metrics
        WHERE platform = 'tiktok'
          AND external_post_id IS NOT NULL
          AND raw->>'feedPlanPostId' = ANY($1::text[])`,
      [feedIds],
    );
    for (const row of r.rows) {
      if (row.feed_plan_post_id && row.external_post_id && !videoIdByPost.has(row.feed_plan_post_id)) {
        videoIdByPost.set(row.feed_plan_post_id, row.external_post_id);
      }
    }
  } catch (err) {
    console.warn("[role-room-kpi-connectors] TikTok: kunne ikke lese external_post_id fra social_metrics", err);
    return [];
  }

  const videoIds = Array.from(new Set(videoIdByPost.values()));
  if (videoIds.length === 0) return [];

  let metrics: Awaited<ReturnType<typeof fetchTikTokVideoMetrics>>;
  try {
    metrics = await fetchTikTokVideoMetrics(authorized.accessToken, videoIds);
  } catch (err) {
    console.warn("[role-room-kpi-connectors] TikTok video/query feilet", err);
    return [];
  }
  const metricsByVideo = new Map<string, typeof metrics>();
  for (const m of metrics) {
    const arr = metricsByVideo.get(m.videoId) ?? [];
    arr.push(m);
    metricsByVideo.set(m.videoId, arr);
  }

  const snapshots: KpiSnapshotInput[] = [];
  for (const post of tiktokPosts) {
    const videoId = videoIdByPost.get(post.feedPlanPostId!);
    if (!videoId) continue;
    for (const m of metricsByVideo.get(videoId) ?? []) {
      snapshots.push({
        postId: post.id,
        planId,
        platform: "tiktok",
        metric: m.metric,
        value: m.value,
        source: "tiktok_business",
      });
    }
  }
  return snapshots;
}

// ─────────────────────────────────────────────────────────────────────
// #179 — LinkedIn connector (member-/organisasjonsposter via socialActions)
// ─────────────────────────────────────────────────────────────────────

/**
 * Henter likes + kommentarer for LinkedIn-poster som ble publisert direkte
 * fra markedsplanen (Markedssjef-modus fase 1b): posten har external_post_id
 * og published_by_user_id, og tokenet er den brukerens globale LinkedIn-
 * tilkobling (project_id IS NULL). Impressions krever Page-statistikk med
 * egen scope og hentes ikke — vi rapporterer bare det vi faktisk kan lese.
 *
 * Poster uten external_post_id (feed-planner-veien) hoppes over: der
 * finnes ingen kobling til LinkedIn-posten i denne tabellen.
 */
export async function fetchLinkedInKpisForPosts(
  pool: Pool,
  _projectId: string,
  planId: string,
  posts: Array<{
    id: string;
    feedPlanPostId: string | null;
    primaryPlatform: string | null;
    externalPostId?: string | null;
    publishedByUserId?: string | null;
  }>,
  deps: { fetchImpl?: typeof fetch; now?: () => Date } = {},
): Promise<KpiSnapshotInput[]> {
  const liPosts = posts.filter(
    (p) => p.externalPostId && (p.primaryPlatform === "linkedin" || p.primaryPlatform === null),
  );
  if (liPosts.length === 0) return [];

  const tokenByUser = new Map<string, string | null>();
  const tokenFor = async (userId: string): Promise<string | null> => {
    if (!tokenByUser.has(userId)) {
      tokenByUser.set(userId, await loadLinkedInAccessTokenForUser(pool, userId));
    }
    return tokenByUser.get(userId) ?? null;
  };

  const capturedAt = deps.now ? deps.now() : new Date();
  const snapshots: KpiSnapshotInput[] = [];
  for (const post of liPosts) {
    const userId = post.publishedByUserId ?? (await loadPlanOwnerUserId(pool, planId));
    if (!userId) continue;
    const token = await tokenFor(userId);
    if (!token) continue;
    const actions = await fetchLinkedInSocialActions(post.externalPostId as string, token, deps.fetchImpl);
    if (!actions) continue;
    const likes = actions.likes ?? 0;
    const comments = actions.comments ?? 0;
    const base = { postId: post.id, planId, platform: "linkedin" as const, capturedAt, source: "linkedin_pages" as const };
    if (actions.likes !== null) snapshots.push({ ...base, metric: "likes", value: likes });
    if (actions.comments !== null) snapshots.push({ ...base, metric: "comments", value: comments });
    if (actions.likes !== null || actions.comments !== null) {
      snapshots.push({ ...base, metric: "engagement", value: likes + comments });
    }
  }
  return snapshots;
}

async function loadLinkedInAccessTokenForUser(pool: Pool, userId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ access_token_encrypted: string | null }>(
      `SELECT access_token_encrypted
         FROM role_room_linkedin_connections
        WHERE user_id = $1 AND project_id IS NULL AND connection_state IN ('connected', 'active')
        LIMIT 1`,
      [userId],
    );
    return decryptLinkedInToken(r.rows[0]?.access_token_encrypted ?? null);
  } catch {
    return null;
  }
}

async function loadPlanOwnerUserId(pool: Pool, planId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ owner_user_id: string | null }>(
      `SELECT owner_user_id FROM role_room_marketing_plans WHERE id = $1`,
      [planId],
    );
    return r.rows[0]?.owner_user_id ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Orkestrator: hent fra alle connectorer som er konfigurerte for posten
// ─────────────────────────────────────────────────────────────────────

export async function fetchAllPlatformKpis(
  pool: Pool,
  input: {
    projectId: string;
    planId: string;
    posts: Array<{
      id: string;
      feedPlanPostId: string | null;
      primaryPlatform: string | null;
      externalPostId?: string | null;
      publishedByUserId?: string | null;
    }>;
  },
): Promise<{
  snapshots: KpiSnapshotInput[];
  perConnectorCount: Record<string, number>;
}> {
  const [meta, tiktok, linkedin] = await Promise.all([
    fetchMetaKpisForPosts(pool, input.projectId, input.planId, input.posts),
    fetchTikTokKpisForPosts(pool, input.projectId, input.planId, input.posts),
    fetchLinkedInKpisForPosts(pool, input.projectId, input.planId, input.posts),
  ]);
  return {
    snapshots: [...meta, ...tiktok, ...linkedin],
    perConnectorCount: {
      meta_graph: meta.length,
      tiktok_business: tiktok.length,
      linkedin_pages: linkedin.length,
    },
  };
}
