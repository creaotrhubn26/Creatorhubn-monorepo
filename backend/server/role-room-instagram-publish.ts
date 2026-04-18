/**
 * Instagram publishing pipeline.
 *
 * Two-step Meta Graph API flow:
 *   1. POST /{ig-business-account}/media     → returns container creation_id
 *   2. POST /{ig-business-account}/media_publish?creation_id=… → publishes
 *
 * Reels and Stories use the same shape but with media_type=REELS or
 * media_type=STORIES. This module handles all three plus carousel.
 *
 * Hard limit: Meta caps publishes at 50 per IG Business Account per
 * rolling 24h. We check the role_room_instagram_publishes_last_24h view
 * before kicking off a publish and return 'rate_limited' early.
 */

import type { Pool } from 'pg';
import {
  ensureFreshConnection,
  getConnection,
  type InstagramConnectionRow,
  META_GRAPH_API_VERSION,
} from './role-room-instagram-oauth.js';
import {
  deleteInstagramHostedImage,
  uploadImageForInstagram,
  type InstagramHostedImage,
} from './role-room-instagram-image-upload.js';

const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
const META_RATE_LIMIT_PER_24H = 50;

export type IgMediaType = 'image' | 'reel' | 'carousel';

export type IgJobStatus =
  | 'queued'
  | 'uploading'
  | 'container'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'rate_limited';

export interface IgPublishInput {
  connectionId: string;
  userId: string;
  projectId: string;
  feedPlanPostId: string;
  mediaType: IgMediaType;
  caption: string;
  imageDataUrl: string;
  scheduledFor?: string | null;
}

export interface IgPublishJobRow {
  id: string;
  userId: string;
  projectId: string;
  connectionId: string;
  feedPlanPostId: string;
  mediaType: IgMediaType;
  caption: string;
  imagePublicUrl: string | null;
  igContainerId: string | null;
  igMediaId: string | null;
  status: IgJobStatus;
  scheduledFor: Date | null;
  attemptedCount: number;
  lastAttemptAt: Date | null;
  lastError: string | null;
  publishedAt: Date | null;
}

function mapJob(row: Record<string, unknown>): IgPublishJobRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: String(row.project_id),
    connectionId: String(row.connection_id),
    feedPlanPostId: String(row.feed_plan_post_id),
    mediaType: row.media_type as IgMediaType,
    caption: String(row.caption ?? ''),
    imagePublicUrl: (row.image_public_url as string | null) ?? null,
    igContainerId: (row.ig_container_id as string | null) ?? null,
    igMediaId: (row.ig_media_id as string | null) ?? null,
    status: row.status as IgJobStatus,
    scheduledFor: (row.scheduled_for as Date | null) ?? null,
    attemptedCount: Number(row.attempted_count ?? 0),
    lastAttemptAt: (row.last_attempt_at as Date | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    publishedAt: (row.published_at as Date | null) ?? null,
  };
}

async function metaPost(url: string, body: URLSearchParams): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    body,
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const err = (json as { error?: { message?: string; code?: number } } | null)?.error;
    throw new Error(err?.message || `Meta API ${response.status}`);
  }
  return json;
}

async function metaGet(url: string): Promise<unknown> {
  const response = await fetch(url);
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const err = (json as { error?: { message?: string; code?: number } } | null)?.error;
    throw new Error(err?.message || `Meta API ${response.status}`);
  }
  return json;
}

async function rateLimitedCheck(pool: Pool, connectionId: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT published_count FROM role_room_instagram_publishes_last_24h WHERE connection_id = $1`,
      [connectionId],
    );
    return Number(result.rows[0]?.published_count ?? 0);
  } catch {
    return 0;
  }
}

async function insertJob(pool: Pool, input: IgPublishInput): Promise<IgPublishJobRow | null> {
  try {
    const result = await pool.query(
      `INSERT INTO role_room_instagram_publish_jobs
         (user_id, project_id, connection_id, feed_plan_post_id, media_type, caption, scheduled_for)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.userId,
        input.projectId,
        input.connectionId,
        input.feedPlanPostId,
        input.mediaType,
        input.caption,
        input.scheduledFor ? new Date(input.scheduledFor) : null,
      ],
    );
    return result.rows[0] ? mapJob(result.rows[0]) : null;
  } catch (error) {
    console.error('[ig-publish] insert job failed', error);
    return null;
  }
}

async function updateJob(
  pool: Pool,
  jobId: string,
  patch: Partial<IgPublishJobRow> & { lastError?: string | null },
): Promise<void> {
  const setParts: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const push = (column: string, value: unknown) => {
    setParts.push(`${column} = $${i + 1}`);
    values.push(value);
    i += 1;
  };
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.imagePublicUrl !== undefined) push('image_public_url', patch.imagePublicUrl);
  if (patch.igContainerId !== undefined) push('ig_container_id', patch.igContainerId);
  if (patch.igMediaId !== undefined) push('ig_media_id', patch.igMediaId);
  if (patch.lastError !== undefined) push('last_error', patch.lastError);
  if (patch.publishedAt !== undefined) push('published_at', patch.publishedAt);
  if (patch.attemptedCount !== undefined) push('attempted_count', patch.attemptedCount);

  if (setParts.length === 0) return;
  setParts.push('last_attempt_at = now()');
  setParts.push('updated_at = now()');

  try {
    await pool.query(`UPDATE role_room_instagram_publish_jobs SET ${setParts.join(', ')} WHERE id = $1`, [jobId, ...values]);
  } catch (error) {
    console.error('[ig-publish] update job failed', error);
  }
}

/**
 * Run the full publish pipeline for a job. Returns the final job row.
 */
async function executePublishJob(
  pool: Pool,
  job: IgPublishJobRow,
  connection: InstagramConnectionRow,
  imageDataUrl: string,
): Promise<IgPublishJobRow> {
  let hosted: InstagramHostedImage | null = null;
  try {
    // Step 1: upload image to R2 → public URL.
    await updateJob(pool, job.id, { status: 'uploading', attemptedCount: job.attemptedCount + 1 });
    hosted = await uploadImageForInstagram({ userId: job.userId, dataUrl: imageDataUrl });
    if (!hosted) throw new Error('Image upload failed (R2 not configured?)');

    // Step 2: create the IG container.
    await updateJob(pool, job.id, { status: 'container', imagePublicUrl: hosted.publicUrl });
    const containerForm = new URLSearchParams({
      image_url: hosted.publicUrl,
      caption: job.caption,
      access_token: connection.accessToken,
    });
    if (job.mediaType === 'reel') containerForm.set('media_type', 'REELS');
    const containerUrl = `${META_GRAPH_BASE}/${connection.igBusinessAccountId}/media`;
    const containerResp = (await metaPost(containerUrl, containerForm)) as { id?: string };
    const containerId = containerResp.id;
    if (!containerId) throw new Error('Meta returnerte ingen container-id');

    // Step 3: poll status until container is FINISHED (Reels can take time).
    await updateJob(pool, job.id, { status: 'publishing', igContainerId: containerId });
    if (job.mediaType === 'reel') {
      // Poll for up to 90 seconds.
      const deadline = Date.now() + 90_000;
      let containerStatus = 'IN_PROGRESS';
      while (Date.now() < deadline && containerStatus !== 'FINISHED') {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        try {
          const statusUrl = `${META_GRAPH_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(connection.accessToken)}`;
          const statusResp = (await metaGet(statusUrl)) as { status_code?: string };
          containerStatus = statusResp.status_code || 'IN_PROGRESS';
          if (containerStatus === 'ERROR') throw new Error('Meta meldte ERROR på reel-container');
        } catch {
          // Continue polling on transient errors.
        }
      }
      if (containerStatus !== 'FINISHED') throw new Error('Reel-container ikke klar etter 90 sekunder');
    }

    // Step 4: publish.
    const publishUrl = `${META_GRAPH_BASE}/${connection.igBusinessAccountId}/media_publish`;
    const publishForm = new URLSearchParams({
      creation_id: containerId,
      access_token: connection.accessToken,
    });
    const publishResp = (await metaPost(publishUrl, publishForm)) as { id?: string };
    const mediaId = publishResp.id;
    if (!mediaId) throw new Error('Meta returnerte ingen media_id ved publish');

    await updateJob(pool, job.id, {
      status: 'published',
      igMediaId: mediaId,
      publishedAt: new Date(),
      lastError: null,
    });

    // Cleanup: best-effort delete from R2 (image is now on Instagram).
    if (hosted) {
      void deleteInstagramHostedImage(hosted.bucket, hosted.key);
    }

    return { ...job, status: 'published', igMediaId: mediaId, publishedAt: new Date() };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'unknown';
    await updateJob(pool, job.id, { status: 'failed', lastError: message });
    if (hosted) {
      // Keep image around for 24h debugging — the nightly capture cleanup will sweep.
    }
    return { ...job, status: 'failed', lastError: message };
  }
}

/**
 * Public entry: queue + execute a publish synchronously (caller awaits).
 * For scheduled publishes (input.scheduledFor in the future) we just
 * queue and return — a separate worker picks up due jobs.
 */
export async function queueAndPublish(
  pool: Pool,
  input: IgPublishInput,
): Promise<{ job: IgPublishJobRow; immediatelyPublished: boolean; rateLimited: boolean }> {
  // Verify connection
  const conn = await getConnection(pool, input.connectionId, input.userId);
  if (!conn) throw new Error('Instagram-tilkoblingen finnes ikke eller tilhører ikke deg');
  if (conn.connectionState !== 'connected') {
    throw new Error('Instagram-tilkoblingen er utløpt. Koble til på nytt.');
  }

  // Rate-limit pre-check.
  const used24h = await rateLimitedCheck(pool, conn.id);
  const wantsImmediate = !input.scheduledFor || new Date(input.scheduledFor).getTime() <= Date.now();
  if (wantsImmediate && used24h >= META_RATE_LIMIT_PER_24H) {
    const job = await insertJob(pool, input);
    if (job) await updateJob(pool, job.id, { status: 'rate_limited', lastError: `${used24h}/${META_RATE_LIMIT_PER_24H} brukt siste 24t` });
    return {
      job: job ?? ({} as IgPublishJobRow),
      immediatelyPublished: false,
      rateLimited: true,
    };
  }

  const job = await insertJob(pool, input);
  if (!job) throw new Error('Kunne ikke kø-legge publish-jobben');

  if (!wantsImmediate) {
    // Scheduled — return queued, worker picks up.
    return { job, immediatelyPublished: false, rateLimited: false };
  }

  // Refresh token if close to expiry, then run.
  const fresh = await ensureFreshConnection(pool, conn);
  const finalJob = await executePublishJob(pool, job, fresh, input.imageDataUrl);
  return { job: finalJob, immediatelyPublished: finalJob.status === 'published', rateLimited: false };
}

export async function listPublishJobs(
  pool: Pool,
  projectId: string,
  userId: string,
): Promise<IgPublishJobRow[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM role_room_instagram_publish_jobs
        WHERE project_id = $1 AND user_id = $2
        ORDER BY created_at DESC
        LIMIT 100`,
      [projectId, userId],
    );
    return result.rows.map(mapJob);
  } catch (error) {
    console.error('[ig-publish] list jobs failed', error);
    return [];
  }
}

export const IG_RATE_LIMIT_PER_24H = META_RATE_LIMIT_PER_24H;
