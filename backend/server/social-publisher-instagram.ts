/**
 * InstagramPublisher — adapter som pakker eksisterende
 * role-room-instagram-publish.ts (queueAndPublish + publish-pipeline) inn
 * i det enhetlige SocialPublisher-grensesnittet.
 *
 * Ingen endringer i underliggende IG-pipeline; bare en oversetter mellom
 * SocialPostInput og IgPublishInput.
 */

import type { Pool } from 'pg';
import type {
  FetchInsightsInput,
  MetricSnapshot,
  PublishResult,
  SocialPlatform,
  SocialPostInput,
  SocialPublisher,
} from './social-publisher.js';
import { registerPublisher } from './social-publisher.js';
import {
  queueAndPublish as queueAndPublishIg,
  type IgMediaType,
  type IgPublishInput,
} from './role-room-instagram-publish.js';
import {
  ensureFreshConnection,
  getConnection,
  META_GRAPH_API_VERSION,
} from './role-room-instagram-oauth.js';

const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

function toIgMediaType(kind: SocialPostInput['mediaKind']): IgMediaType | null {
  switch (kind) {
    case 'image':
      return 'image';
    case 'reel':
    case 'video':
      return 'reel';
    case 'carousel':
      return 'carousel';
    default:
      return null;
  }
}

function buildIgInput(post: SocialPostInput, mediaType: IgMediaType): IgPublishInput {
  return {
    connectionId: post.connectionId,
    userId: post.userId,
    projectId: post.projectId,
    feedPlanPostId: post.feedPlanPostId ?? '',
    mediaType,
    caption: post.caption,
    imageDataUrl: post.imageUrl,
    imageDataUrls: post.imageUrls,
    videoDataUrl: post.videoUrl,
    scheduledFor: post.scheduledFor ? post.scheduledFor.toISOString() : null,
  };
}

export function makeInstagramPublisher(pool: Pool): SocialPublisher {
  const platform: SocialPlatform = 'instagram';

  return {
    platform,

    validate(post: SocialPostInput): string | null {
      const mediaType = toIgMediaType(post.mediaKind);
      if (!mediaType) {
        return `Instagram supports image, reel, video, or carousel — got ${post.mediaKind}`;
      }
      if (mediaType === 'reel' && !post.videoUrl) {
        return 'Instagram Reel requires videoUrl (data: URL or hosted MP4)';
      }
      if (mediaType === 'carousel') {
        const len = post.imageUrls?.length ?? 0;
        if (len < 2 || len > 10) {
          return `Instagram Carousel requires 2-10 images, got ${len}`;
        }
      }
      if (mediaType === 'image') {
        const len = post.imageUrls?.length ?? (post.imageUrl ? 1 : 0);
        if (len !== 1) return `Instagram image post requires exactly 1 image, got ${len}`;
      }
      // Meta hard-cap caption length is 2200 chars
      if (post.caption.length > 2200) {
        return `Caption must be under 2200 chars (got ${post.caption.length})`;
      }
      return null;
    },

    async publish(post: SocialPostInput): Promise<PublishResult> {
      const mediaType = toIgMediaType(post.mediaKind);
      if (!mediaType) {
        return {
          ok: false,
          status: 'unsupported',
          reason: 'unsupported_media_kind',
          error: `Instagram does not support media kind "${post.mediaKind}"`,
        };
      }
      try {
        const result = await queueAndPublishIg(pool, buildIgInput(post, mediaType));
        if (result.rateLimited) {
          return {
            ok: false,
            status: 'rate_limited',
            jobId: result.job.id,
            reason: 'rate_limited',
            error: 'IG account hit 50/24h Meta rate limit',
          };
        }
        if (result.immediatelyPublished && result.job.igMediaId) {
          return {
            ok: true,
            status: 'published',
            jobId: result.job.id,
            externalPostId: result.job.igMediaId,
            permalink: `https://www.instagram.com/p/${result.job.igMediaId}/`,
          };
        }
        // Scheduled or queued — worker fires it later
        return {
          ok: true,
          status: post.scheduledFor ? 'scheduled' : 'queued',
          jobId: result.job.id,
        };
      } catch (error) {
        return {
          ok: false,
          status: 'failed',
          reason: 'pipeline_error',
          error: (error as Error).message,
          raw: error,
        };
      }
    },

    async fetchInsights(input: FetchInsightsInput): Promise<MetricSnapshot[]> {
      // Hent fresh token + page-scope.
      // userId må slås opp via connectionId — getConnection krever userId,
      // så vi tar en omvei via SQL først.
      const userRow = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM role_room_instagram_connections WHERE id = $1 LIMIT 1`,
        [input.connectionId],
      );
      const userId = userRow.rows[0]?.user_id;
      if (!userId) return [];
      const conn = await getConnection(pool, input.connectionId, userId);
      if (!conn) return [];
      const fresh = await ensureFreshConnection(pool, conn);

      const recordedAt = new Date();
      const snapshots: MetricSnapshot[] = [];

      try {
        if (input.scope === 'account' && fresh.igBusinessAccountId) {
          // Account-level: refetch profile + basic counts
          const url =
            `${META_GRAPH_BASE}/${fresh.igBusinessAccountId}?` +
            new URLSearchParams({
              fields: 'followers_count,follows_count,media_count',
              access_token: fresh.accessToken,
            }).toString();
          const resp = await fetch(url);
          const data = (await resp.json()) as {
            followers_count?: number;
            follows_count?: number;
            media_count?: number;
          };
          if (typeof data.followers_count === 'number') {
            snapshots.push({
              metricName: 'followers_count',
              metricValue: data.followers_count,
              scope: 'account',
              recordedAt,
            });
          }
          if (typeof data.follows_count === 'number') {
            snapshots.push({
              metricName: 'follows_count',
              metricValue: data.follows_count,
              scope: 'account',
              recordedAt,
            });
          }
          if (typeof data.media_count === 'number') {
            snapshots.push({
              metricName: 'media_count',
              metricValue: data.media_count,
              scope: 'account',
              recordedAt,
            });
          }
        } else if (input.externalPostId) {
          // Post-level: /{ig_media_id}/insights with metric=engagement,impressions,reach,saved
          const metricSet =
            input.scope === 'reel'
              ? 'plays,reach,likes,comments,saved,shares,total_interactions'
              : 'impressions,reach,likes,comments,saved,shares,total_interactions';
          const url =
            `${META_GRAPH_BASE}/${input.externalPostId}/insights?` +
            new URLSearchParams({
              metric: metricSet,
              access_token: fresh.accessToken,
            }).toString();
          const resp = await fetch(url);
          const data = (await resp.json()) as {
            data?: Array<{ name: string; values?: Array<{ value: number }> }>;
          };
          for (const m of data.data ?? []) {
            const v = m.values?.[0]?.value;
            if (typeof v === 'number') {
              snapshots.push({
                metricName: m.name,
                metricValue: v,
                scope: input.scope,
                recordedAt,
                raw: m,
              });
            }
          }
        }
      } catch (error) {
        console.warn('[ig-insights] fetch failed', error);
      }

      return snapshots;
    },
  };
}

/**
 * Init-helper — kalles fra index.ts ved app-start, samme sted hvor
 * pool initialiseres.
 */
export function registerInstagramPublisher(pool: Pool): void {
  registerPublisher(makeInstagramPublisher(pool));
}
