/**
 * Periodisk worker som henter view/like/comment-counts + comment-bodies
 * for YouTube-poster publisert siste 14 dager. YouTube har ingen webhook
 * for member-channels, så polling er eneste vei (samme mønster som
 * LinkedIn-insights-worker).
 *
 * Strategi:
 *   - 1h sweep → finn YouTube-posts i social_metrics siste 14 dager
 *   - Per video: youtube.videos.list({ part: ['statistics'] }) →
 *     viewCount/likeCount/commentCount → social_metrics
 *   - Per video: youtube.commentThreads.list → bodies + author info →
 *     social_events (auto sentiment-scored av eksisterende worker)
 *   - YouTube returnerer authorDisplayName + authorProfileImageUrl direkte
 *     i comment-payload, så ingen separat name-resolusjon trengs
 *     (i motsetning til LinkedIn).
 *
 * No-op uten Google OAuth-konfig eller hvis ingen poster å polle.
 */

import type { Pool } from 'pg';
import { google } from 'googleapis';
import { resolveRoleRoomGoogleConnection } from './contract-google-signing.js';
import { persistSocialEvent } from './social-events.js';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 time
const MAX_POSTS_PER_SWEEP = 50;
const MAX_COMMENTS_PER_VIDEO = 100;
const POLL_WINDOW_DAYS = 14;

interface YouTubePostToPoll {
  external_post_id: string; // video ID
  account_id: string; // channel ID
  user_id: string;
  connection_id: string | null;
}

async function listYouTubePostsToPoll(
  pool: Pool,
  limit: number,
): Promise<YouTubePostToPoll[]> {
  try {
    // Vi linker via account_id som er channel_id. user_id må finnes for å
    // resolve OAuth-klient. Derfor join'er vi mot role_room_google_connections
    // hvis vi har det, ellers bruker vi connection_id som faller tilbake til
    // null. For YouTube er det vanligvis én user per channel, så vi tar
    // vurdering basert på den nyeste publish-metric-raden.
    const result = await pool.query<{
      external_post_id: string;
      account_id: string;
      connection_id: string | null;
    }>(
      `SELECT DISTINCT ON (sm.external_post_id)
              sm.external_post_id, sm.account_id, sm.connection_id::text AS connection_id
         FROM social_metrics sm
        WHERE sm.platform = 'youtube'
          AND sm.metric_name = 'publish_count'
          AND sm.external_post_id IS NOT NULL
          AND sm.recorded_at >= now() - ($1 || ' days')::interval
        ORDER BY sm.external_post_id, sm.recorded_at DESC
        LIMIT $2`,
      [String(POLL_WINDOW_DAYS), limit],
    );

    // Vi trenger user_id for å resolve OAuth. social_metrics har ikke
    // direkte user_id, men vi kan finne det via creatorhub_users hvis
    // det finnes en kobling mellom channel_id og user. For nå: hent
    // siste user som publisert videoer på denne channelen.
    const enriched: YouTubePostToPoll[] = [];
    for (const row of result.rows) {
      const userRow = await pool.query<{ user_id: string | null }>(
        `SELECT user_id FROM role_room_google_connections rgc
          INNER JOIN social_metrics sm ON sm.account_id = $1
          WHERE rgc.user_id IS NOT NULL
          ORDER BY rgc.last_used_at DESC NULLS LAST, rgc.updated_at DESC NULLS LAST
          LIMIT 1`,
        [row.account_id],
      );
      const userId = userRow.rows[0]?.user_id;
      if (userId) {
        enriched.push({
          external_post_id: row.external_post_id,
          account_id: row.account_id,
          connection_id: row.connection_id,
          user_id: userId,
        });
      }
    }
    return enriched;
  } catch (error) {
    console.warn('[youtube-insights] listYouTubePostsToPoll failed', error);
    return [];
  }
}

async function recordVideoMetrics(
  pool: Pool,
  post: YouTubePostToPoll,
  stats: { viewCount?: number; likeCount?: number; commentCount?: number },
): Promise<void> {
  const recordedAt = new Date();
  const rows: Array<{ name: string; value: number }> = [];
  if (typeof stats.viewCount === 'number') rows.push({ name: 'views', value: stats.viewCount });
  if (typeof stats.likeCount === 'number') rows.push({ name: 'likes', value: stats.likeCount });
  if (typeof stats.commentCount === 'number') {
    rows.push({ name: 'comments', value: stats.commentCount });
  }
  for (const m of rows) {
    try {
      await pool.query(
        `INSERT INTO social_metrics
           (connection_id, platform, account_id, external_post_id, scope,
            metric_name, metric_value, recorded_at, raw)
         VALUES ($1, 'youtube', $2, $3, 'video', $4, $5, $6, '{}'::jsonb)`,
        [
          post.connection_id,
          post.account_id,
          post.external_post_id,
          m.name,
          m.value,
          recordedAt,
        ],
      );
    } catch (error) {
      console.warn('[youtube-insights] insert metric failed', error);
    }
  }
}

interface YouTubeCommentSnippet {
  textOriginal?: string;
  authorDisplayName?: string;
  authorChannelUrl?: string;
  authorProfileImageUrl?: string;
  authorChannelId?: { value?: string };
  publishedAt?: string;
}

interface YouTubeCommentThread {
  id?: string;
  snippet?: {
    topLevelComment?: {
      id?: string;
      snippet?: YouTubeCommentSnippet;
    };
  };
}

async function persistYouTubeComments(
  pool: Pool,
  post: YouTubePostToPoll,
  threads: YouTubeCommentThread[],
): Promise<number> {
  let inserted = 0;
  for (const thread of threads) {
    const top = thread.snippet?.topLevelComment;
    if (!top?.id || !top.snippet) continue;
    const occurredAt = top.snippet.publishedAt ? new Date(top.snippet.publishedAt) : null;
    const result = await persistSocialEvent(pool, {
      platform: 'youtube',
      accountId: post.account_id,
      connectionId: post.connection_id,
      externalEventId: top.id,
      externalPostId: post.external_post_id,
      kind: 'comment',
      authorExternalId: top.snippet.authorChannelId?.value ?? null,
      authorUsername: null, // YouTube har ikke @handles
      authorDisplayName: top.snippet.authorDisplayName ?? null,
      authorAvatarUrl: top.snippet.authorProfileImageUrl ?? null,
      body: top.snippet.textOriginal ?? null,
      occurredAt,
      raw: thread as unknown as Record<string, unknown>,
    });
    if (result.inserted) inserted += 1;
  }
  return inserted;
}

export async function sweepYouTubeInsights(
  pool: Pool,
): Promise<{ polled: number; metricsUpdated: number; commentsInserted: number }> {
  const posts = await listYouTubePostsToPoll(pool, MAX_POSTS_PER_SWEEP);
  if (posts.length === 0) {
    return { polled: 0, metricsUpdated: 0, commentsInserted: 0 };
  }

  let metricsUpdated = 0;
  let commentsInserted = 0;
  const oauthCache = new Map<string, ReturnType<typeof google.youtube> | null>();

  for (const post of posts) {
    let youtube = oauthCache.get(post.user_id);
    if (youtube === undefined) {
      try {
        const authorized = await resolveRoleRoomGoogleConnection(pool, post.user_id, {
          allowFallbackToAnyUser: false,
        });
        youtube = google.youtube({ version: 'v3', auth: authorized.oauthClient });
      } catch {
        youtube = null;
      }
      oauthCache.set(post.user_id, youtube);
    }
    if (!youtube) continue;

    try {
      // Statistics + comments parallelt
      const [statsResp, commentsResp] = await Promise.all([
        youtube.videos.list({
          part: ['statistics'],
          id: [post.external_post_id],
          maxResults: 1,
        }),
        youtube.commentThreads
          .list({
            part: ['snippet'],
            videoId: post.external_post_id,
            maxResults: MAX_COMMENTS_PER_VIDEO,
            order: 'time',
          })
          .catch(() => null), // commentThreads kan være disabled per video
      ]);

      const stats = statsResp.data.items?.[0]?.statistics;
      if (stats) {
        await recordVideoMetrics(pool, post, {
          viewCount: stats.viewCount ? Number(stats.viewCount) : undefined,
          likeCount: stats.likeCount ? Number(stats.likeCount) : undefined,
          commentCount: stats.commentCount ? Number(stats.commentCount) : undefined,
        });
        metricsUpdated += 1;
      }

      const threads = commentsResp?.data.items ?? [];
      if (threads.length > 0) {
        const inserted = await persistYouTubeComments(pool, post, threads as YouTubeCommentThread[]);
        commentsInserted += inserted;
      }
    } catch (error) {
      console.warn(
        `[youtube-insights] poll failed for ${post.external_post_id}`,
        error,
      );
    }
  }

  return { polled: posts.length, metricsUpdated, commentsInserted };
}

let workerHandle: NodeJS.Timeout | null = null;

export function startYouTubeInsightsWorker(pool: Pool): void {
  if (workerHandle) return;
  console.log('[youtube-insights] starting (sweep every 1h, 14-day window)');
  workerHandle = setInterval(() => {
    sweepYouTubeInsights(pool)
      .then(({ polled, metricsUpdated, commentsInserted }) => {
        if (polled > 0) {
          console.log(
            `[youtube-insights] sweep: polled=${polled} metricsUpdated=${metricsUpdated} commentsInserted=${commentsInserted}`,
          );
        }
      })
      .catch((err) => {
        console.warn('[youtube-insights] sweep threw', err);
      });
  }, SWEEP_INTERVAL_MS);
  setTimeout(() => {
    sweepYouTubeInsights(pool).catch(() => {});
  }, 90_000);
}

export function stopYouTubeInsightsWorker(): void {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}
