/**
 * FacebookPagePublisher — implementerer SocialPublisher-interfacet for
 * Facebook Pages, mot Meta Graph API v21.0.
 *
 * Eksisterende /api/role-room/facebook/publish-video og publish-page-post
 * endepunkter forblir intakte (UI bruker dem fortsatt). Denne modulen
 * gir Feed Planner / Marketing Plan / cron-worker en plattform-agnostic
 * vei via dispatcher → publish, slik at samme post-input-format funker
 * for både IG og FB.
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
  getConnection,
  ensureFreshConnection,
  META_GRAPH_API_VERSION,
} from './role-room-instagram-oauth.js';

const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

// FB Page caption har ingen offisiell hard-cap, men 63206 chars er
// praksis-cap fra Graph API. Vi setter konservativt 5000 så vi unngår
// overaskelser i UI.
const FB_CAPTION_HARD_CAP = 5000;
const FB_VIDEO_BYTES_CAP = 100 * 1024 * 1024;

/**
 * Hent Page-scoped access-token fra brukerens long-lived user token.
 * Vi cacher ikke per-page-tokens i DB; de er kortlevde nok at vi heller
 * ber Meta hver gang.
 */
async function fetchPageAccessToken(
  userAccessToken: string,
  pageId: string,
): Promise<string | null> {
  try {
    const url =
      `${META_GRAPH_BASE}/me/accounts?` +
      new URLSearchParams({
        fields: 'id,access_token',
        access_token: userAccessToken,
        limit: '50',
      }).toString();
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const body = (await resp.json()) as {
      data?: Array<{ id?: string; access_token?: string }>;
    };
    const match = (body.data ?? []).find((p) => String(p.id) === pageId);
    return match?.access_token ?? null;
  } catch (error) {
    console.warn('[fb-page] fetchPageAccessToken failed', error);
    return null;
  }
}

/**
 * Decoded data-URL → { mimeType, buffer }. Returnerer null på ugyldig.
 */
function decodeDataUrl(
  dataUrl: string,
  expected: 'image' | 'video',
): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(
    new RegExp(`^data:(${expected}\\/[a-z0-9.+-]+);base64,(.+)$`, 'i'),
  );
  if (!match) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) return null;
  return { mimeType: match[1], buffer };
}

async function publishPhoto(
  pageId: string,
  pageAccessToken: string,
  imageDataUrl: string,
  caption: string,
  scheduledPublishUnix?: number,
): Promise<PublishResult> {
  const decoded = decodeDataUrl(imageDataUrl, 'image');
  if (!decoded) {
    return {
      ok: false,
      status: 'failed',
      reason: 'invalid_data_url',
      error: 'imageUrl må være data:image/*;base64,…',
    };
  }
  const form = new FormData();
  const blob = new Blob([new Uint8Array(decoded.buffer)], { type: decoded.mimeType });
  form.append('source', blob, `upload.${decoded.mimeType.split('/')[1] || 'jpg'}`);
  if (caption) form.append('caption', caption);
  if (scheduledPublishUnix) {
    form.append('published', 'false');
    form.append('scheduled_publish_time', String(scheduledPublishUnix));
  }
  form.append('access_token', pageAccessToken);

  try {
    const response = await fetch(
      `${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/photos`,
      { method: 'POST', body: form },
    );
    const text = await response.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* keep raw */
    }
    if (!response.ok) {
      const err = payload?.error as { message?: string; code?: number } | undefined;
      return {
        ok: false,
        status: 'failed',
        reason: err?.code === 4 ? 'rate_limited' : 'meta_error',
        error: err?.message ?? `Meta Graph returnerte ${response.status}`,
        raw: payload,
      };
    }
    const photoId = typeof payload?.id === 'string' ? (payload.id as string) : null;
    const postId = typeof payload?.post_id === 'string' ? (payload.post_id as string) : null;
    return {
      ok: true,
      status: scheduledPublishUnix ? 'scheduled' : 'published',
      externalPostId: postId ?? photoId ?? undefined,
      permalink: postId
        ? `https://www.facebook.com/${postId}`
        : photoId
          ? `https://www.facebook.com/${photoId}`
          : undefined,
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      reason: 'network_error',
      error: (error as Error).message,
    };
  }
}

async function publishVideo(
  pageId: string,
  pageAccessToken: string,
  videoDataUrl: string,
  caption: string,
  scheduledPublishUnix?: number,
): Promise<PublishResult> {
  const decoded = decodeDataUrl(videoDataUrl, 'video');
  if (!decoded) {
    return {
      ok: false,
      status: 'failed',
      reason: 'invalid_data_url',
      error: 'videoUrl må være data:video/*;base64,…',
    };
  }
  if (decoded.buffer.length > FB_VIDEO_BYTES_CAP) {
    return {
      ok: false,
      status: 'failed',
      reason: 'video_too_large',
      error: `Video er over ${FB_VIDEO_BYTES_CAP / 1024 / 1024} MB`,
    };
  }
  const form = new FormData();
  const blob = new Blob([new Uint8Array(decoded.buffer)], { type: decoded.mimeType });
  form.append('source', blob, `upload.${decoded.mimeType.split('/')[1] || 'mp4'}`);
  if (caption) form.append('description', caption);
  if (scheduledPublishUnix) {
    form.append('published', 'false');
    form.append('scheduled_publish_time', String(scheduledPublishUnix));
  }
  form.append('access_token', pageAccessToken);

  try {
    const response = await fetch(
      `${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/videos`,
      { method: 'POST', body: form },
    );
    const text = await response.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* keep raw */
    }
    if (!response.ok) {
      const err = payload?.error as { message?: string; code?: number } | undefined;
      return {
        ok: false,
        status: 'failed',
        reason: err?.code === 4 ? 'rate_limited' : 'meta_error',
        error: err?.message ?? `Meta Graph returnerte ${response.status}`,
        raw: payload,
      };
    }
    const videoId = typeof payload?.id === 'string' ? (payload.id as string) : null;
    return {
      ok: true,
      status: scheduledPublishUnix ? 'scheduled' : 'published',
      externalPostId: videoId ?? undefined,
      permalink: videoId ? `https://www.facebook.com/${videoId}` : undefined,
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      reason: 'network_error',
      error: (error as Error).message,
    };
  }
}

async function publishTextOrLink(
  pageId: string,
  pageAccessToken: string,
  message: string,
  link: string | undefined,
  scheduledPublishUnix?: number,
): Promise<PublishResult> {
  const params = new URLSearchParams();
  if (message) params.set('message', message);
  if (link) params.set('link', link);
  if (scheduledPublishUnix) {
    params.set('published', 'false');
    params.set('scheduled_publish_time', String(scheduledPublishUnix));
  }
  params.set('access_token', pageAccessToken);

  try {
    const response = await fetch(
      `${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      },
    );
    const text = await response.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* keep raw */
    }
    if (!response.ok) {
      const err = payload?.error as { message?: string; code?: number } | undefined;
      return {
        ok: false,
        status: 'failed',
        reason: err?.code === 4 ? 'rate_limited' : 'meta_error',
        error: err?.message ?? `Meta Graph returnerte ${response.status}`,
        raw: payload,
      };
    }
    const postId = typeof payload?.id === 'string' ? (payload.id as string) : null;
    return {
      ok: true,
      status: scheduledPublishUnix ? 'scheduled' : 'published',
      externalPostId: postId ?? undefined,
      permalink: postId ? `https://www.facebook.com/${postId}` : undefined,
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      reason: 'network_error',
      error: (error as Error).message,
    };
  }
}

async function fetchPagePostInsights(
  postId: string,
  pageAccessToken: string,
): Promise<MetricSnapshot[]> {
  // Standard Page-post insights metrics (Meta v21+)
  const metrics = [
    'post_impressions',
    'post_impressions_unique',
    'post_clicks',
    'post_reactions_by_type_total',
    'post_engaged_users',
    'post_video_views',
  ].join(',');

  try {
    const url =
      `${META_GRAPH_BASE}/${encodeURIComponent(postId)}/insights?` +
      new URLSearchParams({ metric: metrics, access_token: pageAccessToken }).toString();
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: unknown }> }>;
    };
    const recordedAt = new Date();
    const out: MetricSnapshot[] = [];
    for (const m of data.data ?? []) {
      const v = m.values?.[0]?.value;
      if (typeof v === 'number') {
        out.push({
          metricName: m.name,
          metricValue: v,
          scope: 'post',
          recordedAt,
          raw: m,
        });
      } else if (v && typeof v === 'object') {
        // f.eks. post_reactions_by_type_total returnerer {like: N, love: N, ...}
        for (const [reactionKey, reactionVal] of Object.entries(v as Record<string, unknown>)) {
          if (typeof reactionVal === 'number') {
            out.push({
              metricName: `${m.name}_${reactionKey}`,
              metricValue: reactionVal,
              scope: 'post',
              recordedAt,
              raw: { name: m.name, key: reactionKey, value: reactionVal },
            });
          }
        }
      }
    }
    return out;
  } catch (error) {
    console.warn('[fb-page] fetchPagePostInsights failed', error);
    return [];
  }
}

async function fetchPageAccountInsights(
  pageId: string,
  pageAccessToken: string,
): Promise<MetricSnapshot[]> {
  const metrics = [
    'page_impressions',
    'page_impressions_unique',
    'page_post_engagements',
    'page_views_total',
    'page_fans',
  ].join(',');

  try {
    const url =
      `${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/insights?` +
      new URLSearchParams({
        metric: metrics,
        period: 'day',
        access_token: pageAccessToken,
      }).toString();
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: unknown }> }>;
    };
    const recordedAt = new Date();
    const out: MetricSnapshot[] = [];
    for (const m of data.data ?? []) {
      const v = m.values?.[0]?.value;
      if (typeof v === 'number') {
        out.push({
          metricName: m.name,
          metricValue: v,
          scope: 'page',
          recordedAt,
          raw: m,
        });
      }
    }
    return out;
  } catch (error) {
    console.warn('[fb-page] fetchPageAccountInsights failed', error);
    return [];
  }
}

export function makeFacebookPagePublisher(pool: Pool): SocialPublisher {
  const platform: SocialPlatform = 'facebook_page';

  return {
    platform,

    validate(post: SocialPostInput): string | null {
      if (post.caption.length > FB_CAPTION_HARD_CAP) {
        return `Caption må være under ${FB_CAPTION_HARD_CAP} tegn (fikk ${post.caption.length})`;
      }
      switch (post.mediaKind) {
        case 'image':
          if (!post.imageUrl) return 'image-post krever imageUrl (data:image/*;base64,…)';
          return null;
        case 'video':
        case 'reel':
          if (!post.videoUrl) return 'video-post krever videoUrl (data:video/*;base64,…)';
          return null;
        case 'text':
          if (!post.caption || !post.caption.trim()) return 'text-post krever ikke-tom caption';
          return null;
        case 'link': {
          const link = (post.extras?.link as string | undefined) ?? null;
          if (!link) return 'link-post krever extras.link';
          return null;
        }
        case 'carousel':
          return 'FB Pages støtter ikke carousel via Graph API — bruk feed-post med flere photos via attached_media i stedet (kommer senere).';
        case 'story':
          return 'FB Pages støtter ikke direkte story-publish via Graph API i denne implementasjonen.';
        default:
          return `Ukjent mediaKind: ${post.mediaKind}`;
      }
    },

    async publish(post: SocialPostInput): Promise<PublishResult> {
      // connectionId = id på role_room_instagram_connections-rad. FB-pageId
      // ligger i facebook_page_id-kolonnen på samme rad.
      const userRow = await pool.query<{
        user_id: string;
        facebook_page_id: string | null;
      }>(
        `SELECT user_id, facebook_page_id FROM role_room_instagram_connections WHERE id = $1 LIMIT 1`,
        [post.connectionId],
      );
      const userId = userRow.rows[0]?.user_id;
      const pageId = userRow.rows[0]?.facebook_page_id;
      if (!userId || !pageId) {
        return {
          ok: false,
          status: 'failed',
          reason: 'connection_not_found',
          error: 'Fant ingen FB Page tilknyttet denne connectionId',
        };
      }
      const conn = await getConnection(pool, post.connectionId, userId);
      if (!conn || conn.connectionState !== 'connected') {
        return {
          ok: false,
          status: 'failed',
          reason: 'connection_invalid',
          error: 'Connection finnes ikke eller er ikke aktiv',
        };
      }
      const fresh = await ensureFreshConnection(pool, conn);
      const pageAccessToken = await fetchPageAccessToken(fresh.accessToken, pageId);
      if (!pageAccessToken) {
        return {
          ok: false,
          status: 'failed',
          reason: 'no_page_token',
          error: 'Fant ingen Page-token fra Meta /me/accounts. Re-connect og bekreft Page-admin.',
        };
      }

      const scheduledPublishUnix = post.scheduledFor
        ? Math.floor(post.scheduledFor.getTime() / 1000)
        : undefined;

      switch (post.mediaKind) {
        case 'image':
          return publishPhoto(pageId, pageAccessToken, post.imageUrl!, post.caption, scheduledPublishUnix);
        case 'video':
        case 'reel':
          return publishVideo(pageId, pageAccessToken, post.videoUrl!, post.caption, scheduledPublishUnix);
        case 'text':
          return publishTextOrLink(pageId, pageAccessToken, post.caption, undefined, scheduledPublishUnix);
        case 'link':
          return publishTextOrLink(
            pageId,
            pageAccessToken,
            post.caption,
            (post.extras?.link as string | undefined) ?? undefined,
            scheduledPublishUnix,
          );
        default:
          return {
            ok: false,
            status: 'unsupported',
            reason: 'unsupported_media_kind',
            error: `FB Page Publisher støtter ikke ${post.mediaKind}`,
          };
      }
    },

    async fetchInsights(input: FetchInsightsInput): Promise<MetricSnapshot[]> {
      const userRow = await pool.query<{
        user_id: string;
        facebook_page_id: string | null;
      }>(
        `SELECT user_id, facebook_page_id FROM role_room_instagram_connections WHERE id = $1 LIMIT 1`,
        [input.connectionId],
      );
      const userId = userRow.rows[0]?.user_id;
      const pageId = userRow.rows[0]?.facebook_page_id;
      if (!userId || !pageId) return [];
      const conn = await getConnection(pool, input.connectionId, userId);
      if (!conn) return [];
      const fresh = await ensureFreshConnection(pool, conn);
      const pageAccessToken = await fetchPageAccessToken(fresh.accessToken, pageId);
      if (!pageAccessToken) return [];

      if (input.scope === 'page' || input.scope === 'account') {
        return fetchPageAccountInsights(pageId, pageAccessToken);
      }
      if (input.externalPostId) {
        return fetchPagePostInsights(input.externalPostId, pageAccessToken);
      }
      return [];
    },
  };
}

export function registerFacebookPagePublisher(pool: Pool): void {
  registerPublisher(makeFacebookPagePublisher(pool));
}
