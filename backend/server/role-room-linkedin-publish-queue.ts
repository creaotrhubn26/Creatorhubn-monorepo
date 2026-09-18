/**
 * Durable LinkedIn scheduler for Role Room.
 *
 * LinkedIn Posts API has no member-level scheduling primitive, so future
 * posts are persisted and claimed by an in-process worker. Media data URLs are
 * uploaded to R2 before the request returns; workers re-sign and download the
 * private objects only when the job becomes due.
 */

import crypto from 'crypto';
import type { Pool, PoolClient } from 'pg';
import {
  dispatchPublish,
  type PublishResult,
  type SocialMediaKind,
} from './social-publisher.js';
import {
  deleteInstagramHostedImage,
  signInstagramHostedImageUrl,
  uploadImageForInstagram,
} from './role-room-instagram-image-upload.js';
import {
  markFeedPlanPostFailed,
  markFeedPlanPostPublished,
  markFeedPlanPostScheduledInTransaction,
} from './role-room-feed-plan.js';

export type LinkedInPublishJobStatus =
  | 'queued'
  | 'processing'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'uncertain';
export type LinkedInQueueMediaKind = Extract<
  SocialMediaKind,
  'text' | 'image' | 'carousel' | 'video' | 'reel' | 'link'
>;

export interface LinkedInPublishMediaPart {
  kind: 'image' | 'video';
  bucket: string;
  key: string;
  contentType: string;
  bytes: number;
}

export interface LinkedInPublishJobRow {
  id: string;
  userId: string;
  projectId: string;
  connectionId: string;
  feedPlanPostId: string | null;
  idempotencyKey: string;
  mediaKind: LinkedInQueueMediaKind;
  caption: string;
  extras: Record<string, unknown>;
  mediaParts: LinkedInPublishMediaPart[];
  authorType: 'personal' | 'organization';
  organizationUrn: string | null;
  status: LinkedInPublishJobStatus;
  scheduledFor: Date;
  availableAt: Date;
  attemptCount: number;
  maxAttempts: number;
  claimedAt: Date | null;
  lastAttemptAt: Date | null;
  lastError: string | null;
  externalPostId: string | null;
  permalink: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueLinkedInPublishInput {
  userId: string;
  projectId: string;
  connectionId: string;
  feedPlanPostId: string;
  mediaKind: LinkedInQueueMediaKind;
  caption: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  extras?: Record<string, unknown>;
  scheduledFor: Date;
  idempotencyKey?: string | null;
  changedBy: string;
}

export class LinkedInPublishQueueConflictError extends Error {
  readonly code = 'linkedin_feed_post_already_scheduled';
}

const MAX_LINKEDIN_IMAGES = 20;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_LINKEDIN_PUBLISH_ATTEMPTS = 5;
export const LINKEDIN_STUCK_JOB_THRESHOLD_MS = 15 * 60 * 1000;
const RETRY_MINUTES = [1, 5, 15, 60];
const MAX_CAPTION_LENGTH = 3_000;

function sanitizeLinkedInExtras(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!value) return {};
  const result: Record<string, unknown> = {};
  const boundedString = (key: string, max: number) => {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.length > 0 && candidate.length <= max) {
      result[key] = candidate;
    }
  };
  boundedString('linkedInOrganizationUrn', 200);
  boundedString('link', 2_048);
  boundedString('linkTitle', 300);
  boundedString('linkDescription', 1_000);
  boundedString('linkThumbnailUrn', 500);
  boundedString('altText', 300);
  boundedString('videoTitle', 300);
  if (Array.isArray(value.imageAltTexts)) {
    result.imageAltTexts = value.imageAltTexts
      .slice(0, MAX_LINKEDIN_IMAGES)
      .map((entry) => typeof entry === 'string' ? entry.slice(0, 300) : '');
  }
  return result;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return Number.POSITIVE_INFINITY;
  const encoded = dataUrl.slice(comma + 1).replace(/\s/g, '');
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
}

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function parseMediaParts(value: unknown): LinkedInPublishMediaPart[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((part) => part as Partial<LinkedInPublishMediaPart>)
    .filter(
      (part): part is LinkedInPublishMediaPart =>
        (part.kind === 'image' || part.kind === 'video') &&
        typeof part.bucket === 'string' &&
        typeof part.key === 'string' &&
        typeof part.contentType === 'string' &&
        typeof part.bytes === 'number',
    );
}

function mapJob(row: Record<string, unknown>): LinkedInPublishJobRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    projectId: typeof row.project_id === 'string' ? row.project_id : '',
    connectionId: String(row.connection_id),
    feedPlanPostId:
      typeof row.feed_plan_post_id === 'string' ? row.feed_plan_post_id : null,
    idempotencyKey: String(row.idempotency_key),
    mediaKind: row.media_kind as LinkedInQueueMediaKind,
    caption: String(row.caption ?? ''),
    extras:
      row.extras && typeof row.extras === 'object' && !Array.isArray(row.extras)
        ? (row.extras as Record<string, unknown>)
        : {},
    mediaParts: parseMediaParts(row.media_parts),
    authorType: row.author_type === 'organization' ? 'organization' : 'personal',
    organizationUrn:
      typeof row.organization_urn === 'string' ? row.organization_urn : null,
    status: row.status as LinkedInPublishJobStatus,
    scheduledFor: asDate(row.scheduled_for),
    availableAt: asDate(row.available_at),
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? MAX_LINKEDIN_PUBLISH_ATTEMPTS),
    claimedAt: row.claimed_at ? asDate(row.claimed_at) : null,
    lastAttemptAt: row.last_attempt_at ? asDate(row.last_attempt_at) : null,
    lastError: typeof row.last_error === 'string' ? row.last_error : null,
    externalPostId:
      typeof row.external_post_id === 'string' ? row.external_post_id : null,
    permalink: typeof row.permalink === 'string' ? row.permalink : null,
    publishedAt: row.published_at ? asDate(row.published_at) : null,
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

function mediaDataUrls(input: EnqueueLinkedInPublishInput): Array<{
  kind: 'image' | 'video';
  dataUrl: string;
}> {
  if (input.mediaKind === 'text' || input.mediaKind === 'link') return [];

  if (input.mediaKind === 'video' || input.mediaKind === 'reel') {
    if (!input.videoUrl || !/^data:video\/[a-z0-9+.-]+;base64,/i.test(input.videoUrl)) {
      throw new Error('LinkedIn video scheduling krever videoUrl som data:video/*;base64');
    }
    if (estimateDataUrlBytes(input.videoUrl) > MAX_VIDEO_BYTES) {
      throw new Error(`LinkedIn-video er over ${MAX_VIDEO_BYTES / 1024 / 1024} MB`);
    }
    return [{ kind: 'video', dataUrl: input.videoUrl }];
  }

  const images =
    input.imageUrls && input.imageUrls.length > 0
      ? input.imageUrls
      : input.imageUrl
        ? [input.imageUrl]
        : [];
  const expectedMin = input.mediaKind === 'carousel' ? 2 : 1;
  const expectedMax = input.mediaKind === 'carousel' ? MAX_LINKEDIN_IMAGES : 1;
  if (images.length < expectedMin || images.length > expectedMax) {
    throw new Error(
      input.mediaKind === 'carousel'
        ? `LinkedIn multi-image krever 2-${MAX_LINKEDIN_IMAGES} bilder`
        : 'LinkedIn image scheduling krever nøyaktig ett bilde',
    );
  }
  if (images.some((value) => !/^data:image\/[a-z0-9+.-]+;base64,/i.test(value))) {
    throw new Error('LinkedIn-bilder må være data:image/*;base64');
  }
  const estimatedImageBytes = images.map(estimateDataUrlBytes);
  if (estimatedImageBytes.some((bytes) => bytes > MAX_IMAGE_BYTES)) {
    throw new Error(`LinkedIn-bilder kan ikke være over ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
  }
  if (estimatedImageBytes.reduce((sum, bytes) => sum + bytes, 0) > MAX_TOTAL_IMAGE_BYTES) {
    throw new Error(
      `LinkedIn-bilder kan ikke være over ${MAX_TOTAL_IMAGE_BYTES / 1024 / 1024} MB totalt`,
    );
  }
  return images.map((dataUrl) => ({ kind: 'image' as const, dataUrl }));
}

export function buildLinkedInPublishIdempotencyKey(
  input: EnqueueLinkedInPublishInput,
): string {
  const provided = input.idempotencyKey?.trim();
  if (provided) {
    if (provided.length > 240) throw new Error('idempotencyKey er for lang');
    return provided;
  }
  const hash = crypto.createHash('sha256');
  hash.update(input.userId);
  hash.update('\0');
  hash.update(input.projectId);
  hash.update('\0');
  hash.update(input.feedPlanPostId);
  hash.update('\0');
  hash.update(input.connectionId);
  hash.update('\0');
  hash.update(input.mediaKind);
  hash.update('\0');
  hash.update(input.scheduledFor.toISOString());
  hash.update('\0');
  hash.update(input.caption);
  hash.update('\0');
  hash.update(JSON.stringify(sanitizeLinkedInExtras(input.extras)));
  for (const media of mediaDataUrls(input)) {
    hash.update('\0');
    hash.update(media.dataUrl);
  }
  return `linkedin-scheduled:${hash.digest('hex')}`;
}

async function cleanupMedia(parts: LinkedInPublishMediaPart[]): Promise<void> {
  await Promise.all(
    parts.map((part) =>
      deleteInstagramHostedImage(part.bucket, part.key).catch(() => undefined),
    ),
  );
}

async function uploadMedia(
  pool: Pool,
  input: EnqueueLinkedInPublishInput,
): Promise<LinkedInPublishMediaPart[]> {
  const uploaded: LinkedInPublishMediaPart[] = [];
  try {
    for (const media of mediaDataUrls(input)) {
      const hosted = await uploadImageForInstagram({
        userId: input.userId,
        dataUrl: media.dataUrl,
        pool,
      });
      if (!hosted) throw new Error('R2 er ikke konfigurert for LinkedIn scheduling');
      const cap = media.kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (hosted.bytes <= 0 || hosted.bytes > cap) {
        await deleteInstagramHostedImage(hosted.bucket, hosted.key);
        throw new Error(
          `${media.kind === 'video' ? 'Video' : 'Bilde'} er over ${Math.round(cap / 1024 / 1024)} MB`,
        );
      }
      uploaded.push({
        kind: media.kind,
        bucket: hosted.bucket,
        key: hosted.key,
        contentType: hosted.contentType,
        bytes: hosted.bytes,
      });
    }
    return uploaded;
  } catch (error) {
    await cleanupMedia(uploaded);
    throw error;
  }
}

/**
 * Persists a future LinkedIn publish. The unique (user,idempotency) index is
 * authoritative; a race loser deletes any duplicate R2 objects it uploaded.
 */
export async function enqueueLinkedInPublishJob(
  pool: Pool,
  input: EnqueueLinkedInPublishInput,
): Promise<{ job: LinkedInPublishJobRow; deduped: boolean }> {
  if (!input.userId || !input.projectId || !input.feedPlanPostId || !input.connectionId) {
    throw new Error('userId, projectId, feedPlanPostId og connectionId er påkrevd');
  }
  if (!input.caption.trim()) throw new Error('LinkedIn-posten må ha tekst');
  if (input.caption.length > MAX_CAPTION_LENGTH) {
    throw new Error(`LinkedIn-posten kan ikke være over ${MAX_CAPTION_LENGTH} tegn`);
  }
  if (!Number.isFinite(input.scheduledFor.getTime())) {
    throw new Error('scheduledFor er ugyldig');
  }
  if (input.scheduledFor.getTime() <= Date.now()) {
    throw new Error('Durable LinkedIn-kø brukes bare for fremtidige tidspunkt');
  }
  const sanitizedExtras = sanitizeLinkedInExtras(input.extras);
  if (input.mediaKind === 'link') {
    const link = typeof sanitizedExtras.link === 'string' ? sanitizedExtras.link : '';
    if (!/^https?:\/\//i.test(link)) {
      throw new Error('Link-post krever extras.link som absolutt http(s)-URL');
    }
  }
  const organizationUrn =
    typeof sanitizedExtras.linkedInOrganizationUrn === 'string'
      ? sanitizedExtras.linkedInOrganizationUrn
      : null;
  if (organizationUrn && !/^urn:li:organization:[^:]+$/.test(organizationUrn)) {
    throw new Error('linkedInOrganizationUrn har ugyldig format');
  }

  const idempotencyKey = buildLinkedInPublishIdempotencyKey(input);
  const usableConnection = await pool.query(
    `SELECT 1
       FROM role_room_linkedin_connections
      WHERE id::text = $1
        AND user_id = $2
        AND (project_id IS NULL OR project_id = $3)
        AND connection_state IN ('connected', 'active')
        AND expiry_date > NOW()
        AND scopes @> $4::jsonb
      LIMIT 1`,
    [
      input.connectionId,
      input.userId,
      input.projectId,
      JSON.stringify(
        organizationUrn
          ? ['r_organization_admin', 'w_organization_social']
          : ['w_member_social'],
      ),
    ],
  );
  if (!usableConnection.rows[0]) {
    throw new Error('linkedin_connection_not_available_for_project');
  }
  const existing = await pool.query(
    `SELECT * FROM role_room_linkedin_publish_jobs
      WHERE user_id = $1 AND idempotency_key = $2
        AND status IN ('queued', 'processing', 'publishing', 'published', 'uncertain')
      LIMIT 1`,
    [input.userId, idempotencyKey],
  );
  if (existing.rows[0]) return { job: mapJob(existing.rows[0]), deduped: true };

  if (input.projectId && input.feedPlanPostId) {
    const active = await pool.query(
      `SELECT * FROM role_room_linkedin_publish_jobs
        WHERE project_id = $1
          AND feed_plan_post_id = $2
          AND status IN ('queued', 'processing', 'publishing', 'uncertain')
        LIMIT 1`,
      [input.projectId, input.feedPlanPostId],
    );
    if (active.rows[0]) {
      throw new LinkedInPublishQueueConflictError(
        'Feed-plan-posten har allerede en aktiv LinkedIn-jobb',
      );
    }
  }

  const parts = await uploadMedia(pool, input);
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch (error) {
    await cleanupMedia(parts);
    throw error;
  }
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO role_room_linkedin_publish_jobs (
         user_id, project_id, connection_id, feed_plan_post_id,
         idempotency_key, media_kind, caption, extras, media_parts,
         author_type, organization_urn, scheduled_for, available_at, max_attempts
       ) VALUES (
         $1, NULLIF($2, ''), $3, NULLIF($4, ''), $5, $6, $7, $8::jsonb,
         $9::jsonb, $10, $11, $12, $12, $13
       )
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        input.userId,
        input.projectId,
        input.connectionId,
        input.feedPlanPostId ?? '',
        idempotencyKey,
        input.mediaKind,
        input.caption,
        JSON.stringify(sanitizedExtras),
        JSON.stringify(parts),
        organizationUrn ? 'organization' : 'personal',
        organizationUrn,
        input.scheduledFor,
        MAX_LINKEDIN_PUBLISH_ATTEMPTS,
      ],
    );

    let job: LinkedInPublishJobRow;
    let deduped = false;
    if (inserted.rows[0]) {
      job = mapJob(inserted.rows[0]);
    } else {
      const winner = await client.query(
        `SELECT * FROM role_room_linkedin_publish_jobs
          WHERE user_id = $1 AND idempotency_key = $2
            AND status IN ('queued', 'processing', 'publishing', 'published', 'uncertain')
          LIMIT 1`,
        [input.userId, idempotencyKey],
      );
      if (!winner.rows[0] && input.projectId && input.feedPlanPostId) {
        const active = await client.query(
          `SELECT * FROM role_room_linkedin_publish_jobs
            WHERE project_id = $1
              AND feed_plan_post_id = $2
              AND status IN ('queued', 'processing', 'publishing', 'uncertain')
            LIMIT 1`,
          [input.projectId, input.feedPlanPostId],
        );
        if (active.rows[0]) {
          throw new LinkedInPublishQueueConflictError(
            'Feed-plan-posten ble planlagt av en annen request',
          );
        }
      }
      if (!winner.rows[0]) throw new Error('Idempotent LinkedIn-jobb kunne ikke leses');
      job = mapJob(winner.rows[0]);
      deduped = true;
    }

    if (!deduped && input.projectId && input.feedPlanPostId) {
      const transition = await markFeedPlanPostScheduledInTransaction(
        client,
        input.projectId,
        input.feedPlanPostId,
        job.id,
        input.scheduledFor,
        input.changedBy,
      );
      if (!transition.touched) {
        throw new Error('feed_plan_approval_changed_before_enqueue_commit');
      }
    }
    await client.query('COMMIT');
    if (deduped) await cleanupMedia(parts);
    return { job, deduped };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    await cleanupMedia(parts);
    throw error;
  } finally {
    client.release();
  }
}

export function computeLinkedInRetryAt(attemptCount: number, now = Date.now()): Date | null {
  if (attemptCount >= MAX_LINKEDIN_PUBLISH_ATTEMPTS) return null;
  const minutes = RETRY_MINUTES[Math.max(0, attemptCount - 1)] ?? 60;
  return new Date(now + minutes * 60 * 1000);
}

async function readResponseWithinLimit(response: Response, cap: number): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > cap) {
    throw new Error('R2-media overstiger tillatt størrelse');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('R2-media mangler responsinnhold');
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel().catch(() => undefined);
        throw new Error('R2-media overstiger tillatt størrelse');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (total <= 0) throw new Error('R2-media er tomt');
  return Buffer.concat(chunks, total);
}

async function hostedPartToDataUrl(part: LinkedInPublishMediaPart): Promise<string> {
  const cap = part.kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (!Number.isFinite(part.bytes) || part.bytes <= 0 || part.bytes > cap) {
    throw new Error('R2-media har ugyldig lagret størrelse');
  }
  const signedUrl = await signInstagramHostedImageUrl(part.bucket, part.key);
  if (!signedUrl) throw new Error('Klarte ikke å signere R2-mediet');
  const response = await fetch(signedUrl, {
    signal: AbortSignal.timeout(part.kind === 'video' ? 120_000 : 30_000),
  });
  if (!response.ok) throw new Error(`R2-media kunne ikke leses (HTTP ${response.status})`);
  const bytes = await readResponseWithinLimit(response, cap);
  if (bytes.length !== part.bytes) {
    throw new Error('R2-media samsvarer ikke med lagret størrelse');
  }
  const storedContentType = part.contentType.split(';', 1)[0].trim().toLowerCase();
  const responseContentType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (
    !storedContentType.startsWith(`${part.kind}/`)
    || (responseContentType && !responseContentType.startsWith(`${part.kind}/`))
  ) {
    const contentType = responseContentType || storedContentType;
    throw new Error(`R2-media har uventet MIME-type ${contentType || 'ukjent'}`);
  }
  const contentType = responseContentType || storedContentType;
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

export async function recoverStuckLinkedInPublishJobs(pool: Pool): Promise<{
  requeued: number;
  failed: number;
  uncertain: number;
}> {
  const result = await pool.query(
    `UPDATE role_room_linkedin_publish_jobs
        SET status = CASE
              WHEN status = 'publishing' THEN 'uncertain'
              WHEN attempt_count >= max_attempts THEN 'failed'
              ELSE 'queued'
            END,
            available_at = CASE
              WHEN status = 'processing' AND attempt_count < max_attempts THEN NOW()
              ELSE available_at
            END,
            claimed_at = NULL,
            last_error = LEFT(
              CONCAT(
                COALESCE(last_error, ''),
                CASE
                  WHEN status = 'publishing'
                    THEN ' [publish outcome unknown; verify LinkedIn manually]'
                  ELSE ' [recovered_stuck_processing]'
                END
              ),
              1000
            ),
            updated_at = NOW()
      WHERE status IN ('processing', 'publishing')
        AND claimed_at < NOW() - ($1 || ' milliseconds')::interval
      RETURNING *`,
    [String(LINKEDIN_STUCK_JOB_THRESHOLD_MS)],
  );
  let requeued = 0;
  let failed = 0;
  let uncertain = 0;
  for (const raw of result.rows) {
    const job = mapJob(raw);
    if (job.status === 'failed' || job.status === 'uncertain') {
      if (job.status === 'uncertain') uncertain += 1;
      else failed += 1;
      if (job.status === 'failed') await cleanupMedia(job.mediaParts);
      if (job.projectId && job.feedPlanPostId) {
        await markFeedPlanPostFailed(
          pool,
          job.projectId,
          job.feedPlanPostId,
          job.status === 'uncertain'
            ? 'Utfallet er ukjent. Kontroller LinkedIn manuelt før du forsøker på nytt.'
            : 'LinkedIn-jobben kunne ikke gjenopptas. Kontroller tilkoblingen før nytt forsøk.',
        );
      }
    } else {
      requeued += 1;
    }
  }
  return { requeued, failed, uncertain };
}

export async function claimDueLinkedInPublishJobs(
  pool: Pool,
  batchSize = 10,
): Promise<LinkedInPublishJobRow[]> {
  const safeBatchSize = Math.max(1, Math.min(50, Math.floor(batchSize)));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `WITH due AS (
         SELECT id
           FROM role_room_linkedin_publish_jobs
          WHERE status = 'queued'
            AND available_at <= NOW()
          ORDER BY available_at, created_at
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       UPDATE role_room_linkedin_publish_jobs AS job
          SET status = 'processing',
              attempt_count = job.attempt_count + 1,
              claimed_at = NOW(),
              last_attempt_at = NOW(),
              updated_at = NOW()
         FROM due
        WHERE job.id = due.id
       RETURNING job.*`,
      [safeBatchSize],
    );
    await client.query('COMMIT');
    return result.rows.map(mapJob);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function markPermanentFailure(
  pool: Pool,
  job: LinkedInPublishJobRow,
  message: string,
  userMessage = 'LinkedIn-publiseringen feilet. Kontroller tilkobling og innhold før nytt forsøk.',
): Promise<void> {
  const updated = await pool.query(
    `UPDATE role_room_linkedin_publish_jobs
        SET status = 'failed',
            claimed_at = NULL,
            last_error = $2,
            updated_at = NOW()
      WHERE id = $1 AND status IN ('processing', 'publishing')`,
    [job.id, message.slice(0, 1000)],
  );
  if ((updated.rowCount ?? updated.rows.length) === 0) return;
  await cleanupMedia(job.mediaParts);
  if (job.projectId && job.feedPlanPostId) {
    await markFeedPlanPostFailed(pool, job.projectId, job.feedPlanPostId, userMessage);
  }
}

function isRetryable(result: PublishResult | null): boolean {
  if (!result) return true;
  return ![
    'validation_failed',
    'unsupported_media_kind',
    'organization_not_managed',
    'org_not_managed',
    'organization_access_denied',
    'permission_denied',
    'scope_missing',
    'token_expired',
    'reconnect_required',
    'connection_not_found',
  ].includes(result.reason ?? '');
}

function hasUncertainExternalOutcome(result: PublishResult): boolean {
  if (result.reason === 'network_error') return true;
  return result.reason === 'linkedin_api_error'
    && /^publisering feilet:/i.test(result.error ?? '');
}

function userFacingFailure(result: PublishResult | null): string {
  switch (result?.reason) {
    case 'scope_missing':
    case 'reconnect_required':
    case 'token_expired':
    case 'connection_not_found':
    case 'organization_access_denied':
    case 'permission_denied':
      return result.error ?? 'LinkedIn-tilkoblingen må oppdateres før nytt forsøk.';
    default:
      return 'LinkedIn-publiseringen feilet. Kontroller tilkobling og innhold før nytt forsøk.';
  }
}

async function markUncertainOutcome(
  pool: Pool,
  job: LinkedInPublishJobRow,
  message: string,
): Promise<void> {
  const updated = await pool.query(
    `UPDATE role_room_linkedin_publish_jobs
        SET status = 'uncertain',
            claimed_at = NULL,
            last_error = $2,
            updated_at = NOW()
      WHERE id = $1 AND status = 'publishing'`,
    [job.id, message.slice(0, 1000)],
  );
  if ((updated.rowCount ?? updated.rows.length) === 0) return;
  if (job.projectId && job.feedPlanPostId) {
    await markFeedPlanPostFailed(
      pool,
      job.projectId,
      job.feedPlanPostId,
      'Utfallet er ukjent. Kontroller LinkedIn manuelt før du forsøker på nytt.',
    );
  }
}

async function executeLinkedInPublishJob(
  pool: Pool,
  job: LinkedInPublishJobRow,
): Promise<'published' | 'retrying' | 'failed' | 'uncertain'> {
  let result: PublishResult | null = null;
  let externalCallStarted = false;
  try {
    const dataUrls: string[] = [];
    for (const part of job.mediaParts) {
      dataUrls.push(await hostedPartToDataUrl(part));
    }
    const extras: Record<string, unknown> = { ...job.extras };
    if (job.organizationUrn) {
      extras.linkedInOrganizationUrn = job.organizationUrn;
    }
    const claimed = await pool.query(
      `UPDATE role_room_linkedin_publish_jobs
          SET status = 'publishing',
              claimed_at = NOW(),
              updated_at = NOW()
        WHERE id = $1 AND status = 'processing'
        RETURNING id`,
      [job.id],
    );
    if ((claimed.rowCount ?? claimed.rows.length) === 0) {
      throw new Error('LinkedIn-jobben er ikke lenger claimet av denne workeren');
    }
    externalCallStarted = true;
    result = await dispatchPublish('linkedin', {
      connectionId: job.connectionId,
      userId: job.userId,
      projectId: job.projectId,
      feedPlanPostId: job.feedPlanPostId ?? undefined,
      mediaKind: job.mediaKind,
      caption: job.caption,
      imageUrl: job.mediaKind === 'image' ? dataUrls[0] : undefined,
      imageUrls: job.mediaKind === 'carousel' ? dataUrls : undefined,
      videoUrl:
        job.mediaKind === 'video' || job.mediaKind === 'reel'
          ? dataUrls[0]
          : undefined,
      extras,
      scheduledFor: null,
    });
    if (result.ok && result.status === 'published') {
      const published = await pool.query(
        `UPDATE role_room_linkedin_publish_jobs
            SET status = 'published',
                claimed_at = NULL,
                last_error = NULL,
                external_post_id = $2,
                permalink = $3,
                published_at = NOW(),
                updated_at = NOW()
          WHERE id = $1 AND status = 'publishing'
          RETURNING id`,
        [job.id, result.externalPostId ?? null, result.permalink ?? null],
      );
      if ((published.rowCount ?? published.rows.length) !== 1) {
        throw new Error('publish_result_persistence_conflict');
      }
      await cleanupMedia(job.mediaParts);
      if (job.projectId && job.feedPlanPostId) {
        try {
          const transition = await markFeedPlanPostPublished(
            pool,
            job.projectId,
            job.feedPlanPostId,
            {
              jobId: job.id,
              externalPostId: result.externalPostId ?? null,
              permalink: result.permalink ?? null,
              changedBy: 'system:linkedin-publish-worker',
            },
          );
          if (!transition.touched) {
            console.warn('[linkedin-publish-worker] published job missing feed-plan post', job.id);
          }
        } catch (error) {
          console.error('[linkedin-publish-worker] feed-plan publish transition failed', error);
        }
      }
      return 'published';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukjent worker-feil';
    if (externalCallStarted) {
      await markUncertainOutcome(pool, job, message);
      return 'uncertain';
    }
    result = {
      ok: false,
      status: 'failed',
      reason: 'worker_exception',
      error: error instanceof Error ? error.message : 'Ukjent worker-feil',
    };
  }

  const message = (
    result?.error ??
    result?.reason ??
    'LinkedIn publisering feilet uten feilmelding'
  ).slice(0, 1000);
  if (result && hasUncertainExternalOutcome(result)) {
    await markUncertainOutcome(pool, job, message);
    return 'uncertain';
  }
  const retryAt = isRetryable(result)
    ? computeLinkedInRetryAt(job.attemptCount)
    : null;
  if (retryAt && job.attemptCount < job.maxAttempts) {
    await pool.query(
      `UPDATE role_room_linkedin_publish_jobs
          SET status = 'queued',
              available_at = $2,
              claimed_at = NULL,
              last_error = $3,
              updated_at = NOW()
        WHERE id = $1 AND status IN ('processing', 'publishing')`,
      [
        job.id,
        retryAt,
        `Forsøk ${job.attemptCount}/${job.maxAttempts} feilet: ${message}`.slice(0, 1000),
      ],
    );
    return 'retrying';
  }
  await markPermanentFailure(pool, job, message, userFacingFailure(result));
  return 'failed';
}

export async function processDueLinkedInPublishJobs(
  pool: Pool,
  batchSize = 10,
): Promise<{
  picked: number;
  published: number;
  retrying: number;
  failed: number;
  recovered: number;
  uncertain: number;
}> {
  const recovery = await recoverStuckLinkedInPublishJobs(pool);
  const jobs = await claimDueLinkedInPublishJobs(pool, batchSize);
  const stats = {
    picked: jobs.length,
    published: 0,
    retrying: 0,
    failed: recovery.failed,
    recovered: recovery.requeued,
    uncertain: recovery.uncertain,
  };
  for (const job of jobs) {
    const outcome = await executeLinkedInPublishJob(pool, job);
    stats[outcome] += 1;
  }
  return stats;
}

export async function getLinkedInPublishQueueStats(pool: Pool): Promise<{
  queued: number;
  processing: number;
  uncertain: number;
  failedLast24h: number;
  publishedLast24h: number;
  oldestDueAt: Date | null;
}> {
  try {
    const result = await pool.query<{
      queued: string;
      processing: string;
      uncertain: string;
      failed_last_24h: string;
      published_last_24h: string;
      oldest_due_at: Date | null;
    }>(
      `SELECT
         count(*) FILTER (WHERE status = 'queued')::text AS queued,
         count(*) FILTER (WHERE status IN ('processing', 'publishing'))::text AS processing,
         count(*) FILTER (WHERE status = 'uncertain')::text AS uncertain,
         count(*) FILTER (
           WHERE status = 'failed' AND updated_at >= NOW() - interval '24 hours'
         )::text AS failed_last_24h,
         count(*) FILTER (
           WHERE status = 'published' AND published_at >= NOW() - interval '24 hours'
         )::text AS published_last_24h,
         min(available_at) FILTER (WHERE status = 'queued') AS oldest_due_at
       FROM role_room_linkedin_publish_jobs`,
    );
    const row = result.rows[0];
    return {
      queued: Number(row?.queued ?? 0),
      processing: Number(row?.processing ?? 0),
      uncertain: Number(row?.uncertain ?? 0),
      failedLast24h: Number(row?.failed_last_24h ?? 0),
      publishedLast24h: Number(row?.published_last_24h ?? 0),
      oldestDueAt: row?.oldest_due_at ?? null,
    };
  } catch (error) {
    console.warn('[linkedin-publish-worker] queue stats unavailable', error);
    return {
      queued: 0,
      processing: 0,
      uncertain: 0,
      failedLast24h: 0,
      publishedLast24h: 0,
      oldestDueAt: null,
    };
  }
}

export function startLinkedInPublishWorker(
  pool: Pool,
  options: { intervalSeconds?: number; batchSize?: number } = {},
): { stop: () => void } {
  const intervalMs = Math.max(5, options.intervalSeconds ?? 30) * 1000;
  const batchSize = Math.max(1, Math.min(50, options.batchSize ?? 10));
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const stats = await processDueLinkedInPublishJobs(pool, batchSize);
      if (stats.picked > 0 || stats.recovered > 0) {
        console.log(
          `[linkedin-publish-worker] picked=${stats.picked} published=${stats.published} retrying=${stats.retrying} failed=${stats.failed} uncertain=${stats.uncertain} recovered=${stats.recovered}`,
        );
      }
    } catch (error) {
      console.error('[linkedin-publish-worker] tick failed', error);
    } finally {
      running = false;
    }
  };
  const kickoff = setTimeout(() => void tick(), 2_000);
  const timer = setInterval(() => void tick(), intervalMs);
  kickoff.unref?.();
  timer.unref?.();
  return {
    stop: () => {
      stopped = true;
      clearTimeout(kickoff);
      clearInterval(timer);
    },
  };
}
