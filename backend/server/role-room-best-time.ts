// =============================================================================
// DB adapter for data-driven "best time to post". Turns social_metrics rows for
// a project into PostObservation[] and hands them to the pure core
// (role-room-best-time-to-post.ts).
//
// Data model (see migration 118_social_events_and_metrics.sql):
//   • Publish events:  scope='account', metric_name='publish_count',
//                      external_post_id = platform post id, recorded_at ≈ the
//                      real publish time. This is our timestamp source.
//   • Metric snapshots: scope in (post|reel|video|story), metric_name in
//                      reach|likes|comments|shares|views|…, external_post_id =
//                      same platform post id. These carry engagement.
// The two are joined on (platform, external_post_id).
//
// Scoping: project_id → role_room_instagram_connections.id (connection_id) →
// social_metrics.connection_id. This covers the primary organic surfaces
// (Instagram + Facebook Page). Other platforms can be layered on later; the
// pure core is already platform-agnostic.
// =============================================================================

import type { Pool } from 'pg';
import {
  computeBestTimesByPlatform,
  scoreEngagement,
  type BestTimeOptions,
  type BestTimeResult,
  type PostObservation,
} from './role-room-best-time-to-post.js';

export interface LoadObservationsOptions {
  /** Only consider posts published within this many days. Default 180. */
  windowDays?: number;
}

interface PubRow {
  platform: string;
  external_post_id: string;
  published_at: string; // ISO
}
interface EngRow {
  platform: string;
  external_post_id: string;
  metric_name: string;
  metric_value: string; // numeric comes back as string from pg
  first_seen: string; // ISO — fallback timestamp
}

/**
 * Load historical post observations for a project from social_metrics.
 * Returns one PostObservation per post that has both a timestamp and at least
 * one engagement metric.
 */
export async function loadPostObservations(
  pool: Pool,
  projectId: string,
  options: LoadObservationsOptions = {},
): Promise<PostObservation[]> {
  const windowDays = options.windowDays ?? 180;

  // Accurate publish timestamps (from publish_count events).
  const pub = await pool.query<PubRow>(
    `SELECT sm.platform,
            sm.external_post_id,
            MIN(sm.recorded_at) AS published_at
       FROM social_metrics sm
      WHERE sm.metric_name = 'publish_count'
        AND sm.external_post_id IS NOT NULL
        AND sm.recorded_at >= now() - ($2::int * interval '1 day')
        AND sm.connection_id IN (
              SELECT id FROM role_room_instagram_connections
               WHERE project_id = $1 AND connection_state = 'connected'
            )
      GROUP BY sm.platform, sm.external_post_id`,
    [projectId, windowDays],
  );

  // Latest engagement value per (post, metric), plus a first-seen fallback ts.
  const eng = await pool.query<EngRow>(
    `SELECT sm.platform,
            sm.external_post_id,
            sm.metric_name,
            MAX(sm.metric_value) AS metric_value,
            MIN(sm.recorded_at)  AS first_seen
       FROM social_metrics sm
      WHERE sm.scope IN ('post','reel','video','story')
        AND sm.external_post_id IS NOT NULL
        AND sm.metric_value IS NOT NULL
        AND sm.recorded_at >= now() - ($2::int * interval '1 day')
        AND sm.connection_id IN (
              SELECT id FROM role_room_instagram_connections
               WHERE project_id = $1 AND connection_state = 'connected'
            )
      GROUP BY sm.platform, sm.external_post_id, sm.metric_name`,
    [projectId, windowDays],
  );

  const key = (platform: string, postId: string) => `${platform}::${postId}`;

  const publishedAtByPost = new Map<string, string>();
  for (const r of pub.rows) publishedAtByPost.set(key(r.platform, r.external_post_id), r.published_at);

  // Pivot engagement rows into a metrics bag per post, tracking first-seen.
  const bags = new Map<
    string,
    { platform: string; metrics: Record<string, number>; firstSeen: string }
  >();
  for (const r of eng.rows) {
    const k = key(r.platform, r.external_post_id);
    const bag = bags.get(k) ?? { platform: r.platform, metrics: {}, firstSeen: r.first_seen };
    const val = Number(r.metric_value);
    if (Number.isFinite(val)) bag.metrics[r.metric_name] = val;
    if (r.first_seen < bag.firstSeen) bag.firstSeen = r.first_seen;
    bags.set(k, bag);
  }

  const observations: PostObservation[] = [];
  for (const [k, bag] of bags) {
    // Prefer the accurate publish time; fall back to first-seen snapshot time.
    const ts = publishedAtByPost.get(k) ?? bag.firstSeen;
    const publishedAt = new Date(ts);
    if (Number.isNaN(publishedAt.getTime())) continue;
    const engagement = scoreEngagement(bag.metrics);
    if (engagement <= 0) continue;
    observations.push({ platform: bag.platform, publishedAt, engagement });
  }
  return observations;
}

/**
 * One-shot: load a project's post history and compute best posting times per
 * platform. Returns [] when the project has no usable history.
 */
export async function getBestTimesForProject(
  pool: Pool,
  projectId: string,
  options: LoadObservationsOptions & BestTimeOptions = {},
): Promise<BestTimeResult[]> {
  const observations = await loadPostObservations(pool, projectId, options);
  return computeBestTimesByPlatform(observations, options);
}
