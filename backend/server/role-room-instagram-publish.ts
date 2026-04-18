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
  signInstagramHostedImageUrl,
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
  /** Single-image / reel convenience field — ignored if imageDataUrls is set. */
  imageDataUrl?: string;
  /** 2-10 data URLs for carousel; overrides imageDataUrl when present. */
  imageDataUrls?: string[];
  scheduledFor?: string | null;
}

const CAROUSEL_MIN = 2;
const CAROUSEL_MAX = 10;

export interface IgJobImagePart {
  bucket: string;
  key: string;
  publicUrl?: string;
}

export interface IgPublishJobRow {
  id: string;
  userId: string;
  projectId: string;
  connectionId: string;
  feedPlanPostId: string;
  mediaType: IgMediaType;
  caption: string;
  imageBucket: string | null;
  imageKey: string | null;
  imageParts: IgJobImagePart[];
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

function parseImageParts(
  raw: unknown,
  fallbackBucket: string | null,
  fallbackKey: string | null,
): IgJobImagePart[] {
  if (Array.isArray(raw)) {
    return raw
      .map((p) => p as Partial<IgJobImagePart>)
      .filter((p): p is IgJobImagePart => typeof p?.bucket === 'string' && typeof p?.key === 'string');
  }
  if (fallbackBucket && fallbackKey) return [{ bucket: fallbackBucket, key: fallbackKey }];
  return [];
}

function mapJob(row: Record<string, unknown>): IgPublishJobRow {
  const bucket = (row.image_bucket as string | null) ?? null;
  const key = (row.image_key as string | null) ?? null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: String(row.project_id),
    connectionId: String(row.connection_id),
    feedPlanPostId: String(row.feed_plan_post_id),
    mediaType: row.media_type as IgMediaType,
    caption: String(row.caption ?? ''),
    imageBucket: bucket,
    imageKey: key,
    imageParts: parseImageParts(row.image_parts, bucket, key),
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

async function insertJob(
  pool: Pool,
  input: IgPublishInput,
  images: InstagramHostedImage[],
): Promise<IgPublishJobRow | null> {
  if (images.length === 0) return null;
  const head = images[0];
  const parts: IgJobImagePart[] = images.map((i) => ({
    bucket: i.bucket,
    key: i.key,
    publicUrl: i.publicUrl,
  }));
  try {
    const result = await pool.query(
      `INSERT INTO role_room_instagram_publish_jobs
         (user_id, project_id, connection_id, feed_plan_post_id, media_type, caption,
          scheduled_for, image_bucket, image_key, image_public_url, image_parts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING *`,
      [
        input.userId,
        input.projectId,
        input.connectionId,
        input.feedPlanPostId,
        input.mediaType,
        input.caption,
        input.scheduledFor ? new Date(input.scheduledFor) : null,
        head.bucket,
        head.key,
        head.publicUrl,
        JSON.stringify(parts),
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

async function pollContainerReady(
  connection: InstagramConnectionRow,
  containerId: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let containerStatus = 'IN_PROGRESS';
  while (Date.now() < deadline && containerStatus !== 'FINISHED') {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    try {
      const statusUrl = `${META_GRAPH_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(connection.accessToken)}`;
      const statusResp = (await metaGet(statusUrl)) as { status_code?: string };
      containerStatus = statusResp.status_code || 'IN_PROGRESS';
      if (containerStatus === 'ERROR') throw new Error(`Meta meldte ERROR på container ${containerId}`);
    } catch (pollError) {
      // Surface the ERROR status up immediately; otherwise keep polling.
      if ((pollError as Error).message?.includes('ERROR')) throw pollError;
    }
  }
  if (containerStatus !== 'FINISHED') {
    throw new Error(`Container ${containerId} ikke klar etter ${Math.round(timeoutMs / 1000)} sekunder`);
  }
}

async function createChildContainer(
  connection: InstagramConnectionRow,
  imageUrl: string,
): Promise<string> {
  const form = new URLSearchParams({
    image_url: imageUrl,
    is_carousel_item: 'true',
    access_token: connection.accessToken,
  });
  const url = `${META_GRAPH_BASE}/${connection.igBusinessAccountId}/media`;
  const resp = (await metaPost(url, form)) as { id?: string };
  if (!resp.id) throw new Error('Meta returnerte ingen child container-id');
  return resp.id;
}

/**
 * Run the publish pipeline for a job whose image(s) have already been
 * uploaded to R2. Image/reel jobs use a single container; carousel
 * jobs create N children (is_carousel_item=true) and one parent
 * container with children=[...] before publishing. Re-signs fresh 1h
 * URLs each time — the pre-signed URL stored at queue time is gone by
 * the time a scheduled job fires.
 */
async function executePublishJob(
  pool: Pool,
  job: IgPublishJobRow,
  connection: InstagramConnectionRow,
): Promise<IgPublishJobRow> {
  try {
    await updateJob(pool, job.id, { status: 'uploading', attemptedCount: job.attemptedCount + 1 });
    const parts = job.imageParts;
    if (parts.length === 0) throw new Error('Job mangler bildedata — kan ikke publisere');

    if (job.mediaType === 'carousel') {
      if (parts.length < CAROUSEL_MIN || parts.length > CAROUSEL_MAX) {
        throw new Error(`Carousel krever ${CAROUSEL_MIN}-${CAROUSEL_MAX} bilder, har ${parts.length}`);
      }
    }

    // Re-sign fresh URLs for every part.
    const signed: string[] = [];
    for (const part of parts) {
      const url = await signInstagramHostedImageUrl(part.bucket, part.key);
      if (!url) throw new Error('Klarte ikke å re-signere R2 URL (ikke konfigurert?)');
      signed.push(url);
    }

    let parentContainerId: string;

    if (job.mediaType === 'carousel') {
      await updateJob(pool, job.id, { status: 'container', imagePublicUrl: signed[0] });
      const childIds: string[] = [];
      for (const childUrl of signed) {
        childIds.push(await createChildContainer(connection, childUrl));
      }
      // Children need a few seconds to process before we reference them.
      for (const childId of childIds) {
        await pollContainerReady(connection, childId, 60_000);
      }
      const parentForm = new URLSearchParams({
        media_type: 'CAROUSEL',
        children: childIds.join(','),
        caption: job.caption,
        access_token: connection.accessToken,
      });
      const parentUrl = `${META_GRAPH_BASE}/${connection.igBusinessAccountId}/media`;
      const parentResp = (await metaPost(parentUrl, parentForm)) as { id?: string };
      if (!parentResp.id) throw new Error('Meta returnerte ingen carousel container-id');
      parentContainerId = parentResp.id;
    } else {
      // image or reel — single container.
      await updateJob(pool, job.id, { status: 'container', imagePublicUrl: signed[0] });
      const containerForm = new URLSearchParams({
        image_url: signed[0],
        caption: job.caption,
        access_token: connection.accessToken,
      });
      if (job.mediaType === 'reel') containerForm.set('media_type', 'REELS');
      const containerUrl = `${META_GRAPH_BASE}/${connection.igBusinessAccountId}/media`;
      const containerResp = (await metaPost(containerUrl, containerForm)) as { id?: string };
      if (!containerResp.id) throw new Error('Meta returnerte ingen container-id');
      parentContainerId = containerResp.id;
    }

    await updateJob(pool, job.id, { status: 'publishing', igContainerId: parentContainerId });
    // Reels + carousel parents both need a ready-check before publish.
    if (job.mediaType === 'reel' || job.mediaType === 'carousel') {
      await pollContainerReady(connection, parentContainerId, 90_000);
    }

    // Publish.
    const publishUrl = `${META_GRAPH_BASE}/${connection.igBusinessAccountId}/media_publish`;
    const publishForm = new URLSearchParams({
      creation_id: parentContainerId,
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

    // Cleanup: best-effort delete every part from R2.
    for (const part of parts) {
      void deleteInstagramHostedImage(part.bucket, part.key);
    }

    return { ...job, status: 'published', igMediaId: mediaId, publishedAt: new Date() };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'unknown';
    await updateJob(pool, job.id, { status: 'failed', lastError: message });
    // Keep images in R2 so a retry can re-use them.
    return { ...job, status: 'failed', lastError: message };
  }
}

/**
 * Public entry: queue + execute a publish. Always uploads to R2 first
 * so the image is reachable by either the caller (immediate) or the
 * scheduled-publish worker (future `scheduledFor`). The R2 URL gets
 * re-signed each time a job fires, so a job scheduled 10 days out is
 * still executable even though the original pre-signed URL expired
 * after an hour.
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

  // Resolve the image list from either the multi-image field (carousel)
  // or the single-image convenience field (image/reel).
  const dataUrls: string[] = input.imageDataUrls && input.imageDataUrls.length > 0
    ? input.imageDataUrls
    : input.imageDataUrl
      ? [input.imageDataUrl]
      : [];
  if (dataUrls.length === 0) throw new Error('Mangler bildedata for publisering');
  if (input.mediaType === 'carousel') {
    if (dataUrls.length < CAROUSEL_MIN || dataUrls.length > CAROUSEL_MAX) {
      throw new Error(`Carousel krever ${CAROUSEL_MIN}-${CAROUSEL_MAX} bilder, fikk ${dataUrls.length}`);
    }
  } else if (dataUrls.length !== 1) {
    throw new Error(`${input.mediaType} krever nøyaktig ett bilde, fikk ${dataUrls.length}`);
  }

  // Upload to R2 up-front so the job row stores image_bucket/image_key/
  // image_parts — the worker needs these to re-sign fresh URLs at
  // execute time. If any one upload fails, clean up the ones that did.
  const hosted: InstagramHostedImage[] = [];
  try {
    for (const dataUrl of dataUrls) {
      const h = await uploadImageForInstagram({ userId: input.userId, dataUrl });
      if (!h) throw new Error('Image upload failed (R2 ikke konfigurert?)');
      hosted.push(h);
    }
  } catch (error) {
    for (const h of hosted) void deleteInstagramHostedImage(h.bucket, h.key);
    throw error;
  }

  // Rate-limit pre-check — only applies to immediate publishes. A future
  // scheduled job is queued regardless; the worker re-checks when it
  // fires so rate-limit state is current, not stale from queueing.
  const used24h = await rateLimitedCheck(pool, conn.id);
  const wantsImmediate = !input.scheduledFor || new Date(input.scheduledFor).getTime() <= Date.now();
  if (wantsImmediate && used24h >= META_RATE_LIMIT_PER_24H) {
    const job = await insertJob(pool, input, hosted);
    if (job) await updateJob(pool, job.id, { status: 'rate_limited', lastError: `${used24h}/${META_RATE_LIMIT_PER_24H} brukt siste 24t` });
    return {
      job: job ?? ({} as IgPublishJobRow),
      immediatelyPublished: false,
      rateLimited: true,
    };
  }

  const job = await insertJob(pool, input, hosted);
  if (!job) throw new Error('Kunne ikke kø-legge publish-jobben');

  if (!wantsImmediate) {
    // Scheduled — return queued, worker picks up.
    return { job, immediatelyPublished: false, rateLimited: false };
  }

  // Refresh token if close to expiry, then run.
  const fresh = await ensureFreshConnection(pool, conn);
  const finalJob = await executePublishJob(pool, job, fresh);
  return { job: finalJob, immediatelyPublished: finalJob.status === 'published', rateLimited: false };
}

// ── Scheduled-publish worker ────────────────────────────────────────────

/**
 * Pick up to `batchSize` jobs that are due (scheduled_for in the past
 * or unset) and execute each. `FOR UPDATE SKIP LOCKED` means two worker
 * instances won't clobber each other if the app runs multi-instance.
 * Updates the jobs to status='uploading' inside the transaction so
 * siblings see them as taken.
 */
export async function processDuePublishJobs(
  pool: Pool,
  batchSize = 10,
): Promise<{ picked: number; published: number; failed: number; rateLimited: number }> {
  const stats = { picked: 0, published: 0, failed: 0, rateLimited: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dueResult = await client.query(
      `SELECT * FROM role_room_instagram_publish_jobs
        WHERE status = 'queued'
          AND (scheduled_for IS NULL OR scheduled_for <= now())
        ORDER BY scheduled_for NULLS FIRST, created_at
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [batchSize],
    );
    const jobs = dueResult.rows.map(mapJob);
    // Mark picked — release the row lock on commit so subsequent UPDATE
    // statements (inside executePublishJob) can proceed on the client.
    for (const j of jobs) {
      await client.query(
        `UPDATE role_room_instagram_publish_jobs SET status = 'uploading', updated_at = now() WHERE id = $1`,
        [j.id],
      );
    }
    await client.query('COMMIT');
    stats.picked = jobs.length;

    for (const job of jobs) {
      const conn = await getConnection(pool, job.connectionId, job.userId);
      if (!conn || conn.connectionState !== 'connected') {
        await updateJob(pool, job.id, {
          status: 'failed',
          lastError: 'Instagram-tilkoblingen er ikke lenger koblet til.',
        });
        stats.failed += 1;
        continue;
      }
      const used24h = await rateLimitedCheck(pool, conn.id);
      if (used24h >= META_RATE_LIMIT_PER_24H) {
        // Leave the job queued so a subsequent tick can retry once the
        // 24h window advances; don't flip to 'rate_limited' which would
        // require manual re-queue.
        await updateJob(pool, job.id, {
          status: 'queued',
          lastError: `Rate limit ${used24h}/${META_RATE_LIMIT_PER_24H} — venter`,
        });
        stats.rateLimited += 1;
        continue;
      }
      let fresh: InstagramConnectionRow;
      try {
        fresh = await ensureFreshConnection(pool, conn);
      } catch (error) {
        await updateJob(pool, job.id, {
          status: 'failed',
          lastError: `Token refresh feilet: ${(error as Error).message}`.slice(0, 500),
        });
        stats.failed += 1;
        continue;
      }
      const final = await executePublishJob(pool, job, fresh);
      if (final.status === 'published') stats.published += 1;
      else stats.failed += 1;
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[ig-publish-worker] unexpected error', error);
  } finally {
    client.release();
  }
  return stats;
}

interface WorkerHandle {
  stop: () => void;
}

/**
 * Start the in-process scheduled-publish worker. Runs every
 * `intervalSeconds` (default 30) and processes a batch of due jobs.
 * Returns a handle with .stop() for graceful shutdown.
 */
export function startInstagramPublishWorker(
  pool: Pool,
  options: { intervalSeconds?: number; batchSize?: number } = {},
): WorkerHandle {
  const interval = Math.max(5, options.intervalSeconds ?? 30) * 1000;
  const batchSize = options.batchSize ?? 10;
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const stats = await processDuePublishJobs(pool, batchSize);
      if (stats.picked > 0) {
        console.log(
          `[ig-publish-worker] picked=${stats.picked} published=${stats.published} failed=${stats.failed} rate_limited=${stats.rateLimited}`,
        );
      }
    } catch (error) {
      console.error('[ig-publish-worker] tick error', error);
    } finally {
      running = false;
    }
  };

  // Kick one tick shortly after startup so a server restart doesn't lose
  // up to `interval` seconds of latency on the first due job.
  const kickoff = setTimeout(tick, 2_000);
  const timer = setInterval(tick, interval);
  return {
    stop: () => {
      stopped = true;
      clearTimeout(kickoff);
      clearInterval(timer);
    },
  };
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
