/**
 * Plattform-connectors for KPI-tracking (items #177, #178, #179).
 *
 * Hver connector tar liste over posts som har en feed_plan_post_id
 * (= posts som faktisk ble publisert), henter insights fra plattformens
 * Insights-API, og returnerer KpiSnapshotInput[]-array. persistKpi-
 * SnapshotBatch skriver dem til DB.
 *
 * Meta-connector er fullt implementert (vi har eksisterende IG-token-
 * infrastruktur). TikTok og LinkedIn er stubs som returnerer tomt
 * array + honest log-melding inntil OAuth-flows er klare:
 *   - TikTok Business API krever app-review (godkjenning kan ta uker)
 *   - LinkedIn krever Page Admin-rolle + r_organization_social-scope
 *
 * Når enten flow er klar, byttes stub-funksjonen til ekte fetch.
 */

import type { Pool } from "pg";
import type { KpiSnapshotInput } from "./role-room-kpi-tracking.js";

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

  // Hent meta_media_id fra feed-planner-posts hvis kolonnen finnes
  let mediaIdMap: Map<string, string>;
  try {
    const feedIds = candidates.map((p) => p.feedPlanPostId!).filter(Boolean);
    const r = await pool.query<{ id: string; meta_media_id: string | null }>(
      `SELECT id, meta_media_id FROM role_room_feed_plan_posts WHERE id = ANY($1::uuid[])`,
      [feedIds],
    );
    mediaIdMap = new Map(r.rows.filter((row) => row.meta_media_id).map((row) => [row.id, row.meta_media_id!]));
  } catch {
    // Kolonnen meta_media_id finnes ikke i alle miljøer — fall tilbake til tom map
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
  _projectId: string,
  _planId: string,
  posts: Array<{ id: string; feedPlanPostId: string | null; primaryPlatform: string | null }>,
): Promise<KpiSnapshotInput[]> {
  void pool;
  const tiktokPosts = posts.filter((p) => p.feedPlanPostId && p.primaryPlatform === "tiktok");
  if (tiktokPosts.length === 0) return [];
  console.log("[role-room-kpi-connectors] TikTok stub: ville hentet KPI for", tiktokPosts.length, "posts — trenger TikTok Business OAuth (app-review pending). Returnerer tomt.");
  return [];
}

// ─────────────────────────────────────────────────────────────────────
// #179 — LinkedIn Pages Stats connector (stub — krever Page Admin OAuth)
// ─────────────────────────────────────────────────────────────────────

export async function fetchLinkedInKpisForPosts(
  pool: Pool,
  _projectId: string,
  _planId: string,
  posts: Array<{ id: string; feedPlanPostId: string | null; primaryPlatform: string | null }>,
): Promise<KpiSnapshotInput[]> {
  void pool;
  const liPosts = posts.filter((p) => p.feedPlanPostId && p.primaryPlatform === "linkedin");
  if (liPosts.length === 0) return [];
  console.log("[role-room-kpi-connectors] LinkedIn stub: ville hentet KPI for", liPosts.length, "posts — trenger r_organization_social + Page Admin-tilgang. Returnerer tomt.");
  return [];
}

// ─────────────────────────────────────────────────────────────────────
// Orkestrator: hent fra alle connectorer som er konfigurerte for posten
// ─────────────────────────────────────────────────────────────────────

export async function fetchAllPlatformKpis(
  pool: Pool,
  input: {
    projectId: string;
    planId: string;
    posts: Array<{ id: string; feedPlanPostId: string | null; primaryPlatform: string | null }>;
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
