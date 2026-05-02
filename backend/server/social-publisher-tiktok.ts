/**
 * TikTokPublisher — implementerer SocialPublisher-grensesnittet for
 * publisering av video til TikTok via Content Posting API.
 *
 * Flyt (inbox/draft-modus, krever video.upload-scope):
 *   1. POST /v2/post/publish/inbox/video/init/  → få upload_url + publish_id
 *   2. PUT video-bytes til upload_url med Content-Range chunks
 *   3. Polling /v2/post/publish/status/fetch/ til status === 'PUBLISH_COMPLETE'
 *      (eller 'INBOX_DELIVERED' for inbox-mode)
 *
 * For direct publish (krever video.publish-scope, ekstra App Review):
 *   - Init-endpointet bytter til /v2/post/publish/video/init/ og caption +
 *     privacy_level + disable_comment osv. sendes med i init-body.
 *
 * Validering:
 *   - Vertikal video (9:16) anbefales men ikke krevd
 *   - Maks lengde: 60s for free accounts, opp til 10 min for Business
 *   - Maks filstørrelse: 4 GB
 *   - Vi sjekker bare videoUrl finnes; format-validering gjør TikTok selv
 *
 * Insights (fetchInsights):
 *   - TikTok Display API støtter video metrics via /v2/video/list/, men
 *     krever ekstra scopes. For nå returnerer vi tom liste — insights
 *     henter vi senere via egen polling-worker (samme mønster som
 *     LinkedIn/YouTube).
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
import { ensureFreshTikTokConnection, getTikTokConnection } from './role-room-tiktok-oauth.js';

const TIKTOK_INBOX_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
const TIKTOK_DIRECT_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
const TIKTOK_STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
const STATUS_POLL_INTERVAL_MS = 3000;
const STATUS_POLL_TIMEOUT_MS = 4 * 60 * 1000; // 4 min

interface InitResponse {
  data?: {
    publish_id?: string;
    upload_url?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

interface StatusResponse {
  data?: {
    status?: string; // PROCESSING_UPLOAD | INBOX_DELIVERED | PUBLISH_COMPLETE | FAILED
    publicaly_available_post_id?: string[];
    fail_reason?: string;
    publish_id?: string;
  };
  error?: { code?: string; message?: string };
}

async function fetchVideoBytes(videoUrl: string): Promise<Buffer> {
  if (videoUrl.startsWith('data:')) {
    const commaIdx = videoUrl.indexOf(',');
    if (commaIdx < 0) throw new Error('Invalid data: URL');
    const meta = videoUrl.slice(5, commaIdx);
    const payload = videoUrl.slice(commaIdx + 1);
    if (meta.includes('base64')) {
      return Buffer.from(payload, 'base64');
    }
    return Buffer.from(decodeURIComponent(payload), 'utf8');
  }
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Klarte ikke hente video: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function initInboxUpload(
  accessToken: string,
  videoSize: number,
): Promise<{ uploadUrl: string; publishId: string }> {
  const body = {
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
      chunk_size: videoSize, // single chunk for files <= 64MB; for larger we'd split
      total_chunk_count: 1,
    },
  };
  const response = await fetch(TIKTOK_INBOX_INIT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as InitResponse;
  if (!response.ok || !data?.data?.upload_url || !data.data.publish_id) {
    const msg = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`TikTok inbox init feilet: ${msg}`);
  }
  return { uploadUrl: data.data.upload_url, publishId: data.data.publish_id };
}

async function uploadVideoBytes(uploadUrl: string, bytes: Buffer): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(bytes.byteLength),
      'Content-Range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
    },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`TikTok upload PUT feilet: HTTP ${response.status} ${text}`);
  }
}

async function pollPublishStatus(
  accessToken: string,
  publishId: string,
): Promise<StatusResponse['data']> {
  const start = Date.now();
  while (Date.now() - start < STATUS_POLL_TIMEOUT_MS) {
    const response = await fetch(TIKTOK_STATUS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const data = (await response.json().catch(() => ({}))) as StatusResponse;
    const status = data?.data?.status;
    if (
      status === 'PUBLISH_COMPLETE' ||
      status === 'INBOX_DELIVERED' ||
      status === 'PUBLISH_FAILED' ||
      status === 'SEND_TO_USER_INBOX'
    ) {
      return data.data;
    }
    await new Promise((r) => setTimeout(r, STATUS_POLL_INTERVAL_MS));
  }
  throw new Error('TikTok publish status polling timed out');
}

export function makeTikTokPublisher(pool: Pool): SocialPublisher {
  const platform: SocialPlatform = 'tiktok';
  return {
    platform,
    validate(post) {
      if (post.mediaKind !== 'video' && post.mediaKind !== 'reel') {
        return `TikTok støtter kun video — fikk ${post.mediaKind}`;
      }
      if (!post.videoUrl) return 'TikTok video krever videoUrl (data: URL eller MP4-link)';
      // Caption-grense: 2200 tegn, men TikTok aksepterer fortsatt opplasting
      // selv om captionen er lengre. Vi lar TikTok selv kutte/varsle.
      return null;
    },
    async publish(post: SocialPostInput): Promise<PublishResult> {
      try {
        const authorized = await ensureFreshTikTokConnection(pool, post.userId);
        if (!authorized) {
          return {
            ok: false,
            status: 'failed',
            reason: 'no_connection',
            error: 'Ingen aktiv TikTok-tilkobling for brukeren.',
          };
        }
        if (!authorized.connection.scopes.includes('video.upload')) {
          return {
            ok: false,
            status: 'failed',
            reason: 'scope_missing',
            error: 'TikTok-tilkoblingen mangler video.upload-scope. Re-connect for å aktivere publisering.',
          };
        }
        if (!post.videoUrl) {
          return { ok: false, status: 'failed', reason: 'missing_video', error: 'videoUrl mangler.' };
        }
        const bytes = await fetchVideoBytes(post.videoUrl);
        if (bytes.byteLength === 0) {
          return { ok: false, status: 'failed', reason: 'empty_video', error: 'Video er tom.' };
        }
        const { uploadUrl, publishId } = await initInboxUpload(
          authorized.accessToken,
          bytes.byteLength,
        );
        await uploadVideoBytes(uploadUrl, bytes);
        const finalStatus = await pollPublishStatus(authorized.accessToken, publishId);
        const status = finalStatus?.status ?? 'UNKNOWN';
        if (status === 'PUBLISH_FAILED') {
          return {
            ok: false,
            status: 'failed',
            reason: 'tiktok_publish_failed',
            error: finalStatus?.fail_reason || 'TikTok publish failed',
            raw: finalStatus,
          };
        }
        // INBOX_DELIVERED / SEND_TO_USER_INBOX = video sendt til brukerens
        // TikTok-app-inbox; brukeren må selv åpne og publisere. Vi
        // returnerer 'queued' så feed-plan-statusen blir 'scheduled' i
        // stedet for 'published' helt til vi vet via polling at videoen
        // faktisk ble publisert.
        if (status === 'INBOX_DELIVERED' || status === 'SEND_TO_USER_INBOX') {
          return {
            ok: true,
            status: 'queued',
            externalPostId: publishId,
            accountId: authorized.connection.openId ?? undefined,
            jobId: publishId,
            reason: 'inbox_delivered',
            raw: finalStatus,
          };
        }
        const externalPostId = finalStatus?.publicaly_available_post_id?.[0] ?? publishId;
        return {
          ok: true,
          status: 'published',
          externalPostId,
          accountId: authorized.connection.openId ?? undefined,
          permalink:
            authorized.connection.username && externalPostId
              ? `https://www.tiktok.com/@${authorized.connection.username}/video/${externalPostId}`
              : undefined,
          raw: finalStatus,
        };
      } catch (error) {
        return {
          ok: false,
          status: 'failed',
          reason: 'tiktok_exception',
          error: (error as Error).message,
        };
      }
    },
    async fetchInsights(_input: FetchInsightsInput): Promise<MetricSnapshot[]> {
      // Insights hentes via egen polling-worker (todo). Returner tom for nå
      // så dispatchFetchInsights ikke faller over.
      return [];
    },
  };
}

export function registerTikTokPublisher(pool: Pool): void {
  registerPublisher(makeTikTokPublisher(pool));
}

// ── Helpers eksponert for connection-card UI ────────────────────────────

export interface TikTokConnectionSummary {
  connected: boolean;
  openId: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  scopes: string[];
  expiryDate: string | null;
}

export async function getTikTokConnectionSummary(
  pool: Pool,
  userId: string,
): Promise<TikTokConnectionSummary> {
  const connection = await getTikTokConnection(pool, userId);
  if (!connection || connection.connectionState !== 'connected') {
    return {
      connected: false,
      openId: null,
      username: null,
      displayName: null,
      avatarUrl: null,
      scopes: [],
      expiryDate: null,
    };
  }
  return {
    connected: true,
    openId: connection.openId,
    username: connection.username,
    displayName: connection.displayName,
    avatarUrl: connection.avatarUrl,
    scopes: connection.scopes,
    expiryDate: connection.expiryDate ? connection.expiryDate.toISOString() : null,
  };
}
