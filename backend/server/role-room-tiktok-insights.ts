// =============================================================================
// TikTok organic video metrics (Spor A) — Display API /v2/video/query/.
//
// Fetches view/like/comment/share counts for SPECIFIC published video ids
// (unlike /v2/video/list/ which paginates all the user's videos). Requires the
// `video.list` scope on the user's TikTok connection.
//
// Pure mapping (`mapTikTokVideoToMetrics`) is unit-tested; the fetch has an
// injectable transport (`__setTikTokInsightsFetch`) so the request/parse path
// is testable without hitting TikTok.
// =============================================================================

const TIKTOK_VIDEO_QUERY_URL = "https://open.tiktokapis.com/v2/video/query/";
/** Metric fields we pull for organic video KPI. */
const TIKTOK_VIDEO_FIELDS = "id,view_count,like_count,comment_count,share_count";

export interface TikTokVideoMetric {
  videoId: string;
  metric: string; // 'view_count' | 'like_count' | 'comment_count' | 'share_count'
  value: number;
}

interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
    text: () => Promise<string>;
  }>;
}

let fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike;
export function __setTikTokInsightsFetch(impl: FetchLike): void {
  fetchImpl = impl;
}
export function __resetTikTokInsightsFetch(): void {
  fetchImpl = globalThis.fetch as unknown as FetchLike;
}

function asCount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  // TikTok returns counts as numbers or numeric strings; reject anything else
  // (null/undefined/bool/non-numeric) so a missing count is skipped, not 0.
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/** Map one TikTok video object → KPI metric rows. Pure; skips absent counts. */
export function mapTikTokVideoToMetrics(video: unknown): TikTokVideoMetric[] {
  if (!video || typeof video !== "object" || Array.isArray(video)) return [];
  const v = video as Record<string, unknown>;
  const videoId = typeof v.id === "string" ? v.id : v.id != null ? String(v.id) : "";
  if (!videoId) return [];
  const out: TikTokVideoMetric[] = [];
  for (const metric of ["view_count", "like_count", "comment_count", "share_count"]) {
    const value = asCount(v[metric]);
    if (value !== null) out.push({ videoId, metric, value });
  }
  return out;
}

/**
 * Fetch metrics for specific published TikTok video ids via /v2/video/query/.
 * Returns a flat metric list; throws on a non-ok TikTok response so the caller
 * can log + degrade. Chunks to 20 ids/request (TikTok's per-call cap).
 */
export async function fetchTikTokVideoMetrics(
  accessToken: string,
  videoIds: string[],
): Promise<TikTokVideoMetric[]> {
  const ids = Array.from(new Set(videoIds.filter((id) => typeof id === "string" && id.trim())));
  if (ids.length === 0) return [];

  const out: TikTokVideoMetric[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const res = await fetchImpl(`${TIKTOK_VIDEO_QUERY_URL}?fields=${TIKTOK_VIDEO_FIELDS}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filters: { video_ids: chunk } }),
    });
    const raw = (await res.json().catch(() => null)) as
      | { data?: { videos?: unknown[] }; error?: { code?: string; message?: string } }
      | null;
    if (!res.ok) {
      const msg = raw?.error?.message || `TikTok video/query failed (HTTP ${res.status})`;
      throw new Error(msg);
    }
    // TikTok wraps a business-status error inside a 200 too — treat code!=ok as error.
    const code = raw?.error?.code;
    if (code && code !== "ok") {
      throw new Error(raw?.error?.message || `TikTok video/query error: ${code}`);
    }
    for (const video of raw?.data?.videos ?? []) {
      out.push(...mapTikTokVideoToMetrics(video));
    }
  }
  return out;
}
