import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
  GEN_MODELS,
  aiAllowed,
  falConfigured,
  falOutputUrl,
  falPoll,
  falSubmit,
  getGenSettings,
  verifyGenAiMeterEligibility,
  higgsfieldEstimate,
  higgsfieldConfigured,
  higgsfieldPoll,
  higgsfieldSubmit,
} from './generative-media.js';
import { getUserCredits } from './ai-credits.js';
import { archiveToRoleRoomB2, presignRoleRoomB2Download } from './b2-archive-helper.js';
import type { Storyboard } from './storyboard-service.js';
import {
  lockAndValidateStoryboardCompatSource,
  StoryboardAIImageStageError,
  storyboardSourceRevision,
  validateStoryboardCompatMirror,
} from './storyboard-ai-image-stage-service.js';
import { normalizeShotFramingState } from '../../frontend/shared/storyboard-shot-framing.js';
import {
  deliverStoryboardVideoBillingSettlementNow,
  enqueueStoryboardVideoBillingSettlement,
  trustedStoryboardVideoOutputUrl,
} from './storyboard-ai-video-durability.js';
import {
  StoryboardPaintoverCompositeError,
  storyboardPaintoverBindingState,
  storyboardPaintoverBindingForStage,
  validateStoryboardPaintoverCompositeBinding,
  validateStoryboardPaintoverCompositeImage,
  type StoryboardPaintoverComposite,
  type StoryboardPaintoverBindingState,
  type ValidatedStoryboardPaintoverComposite,
} from './storyboard-paintover-composite.js';
import {
  CAMERA_MOTION_ENVELOPE_FIELDS,
  cameraMotionRenderFingerprintV1,
  cameraMotionShotDurationFromFrameV1,
  normalizeCameraMotionTrackV1,
  type CameraMotionStatusV1,
  type StoryboardMediaTimeV1,
} from './storyboard-camera-motion.js';
import {
  normalizeShotDurationV1,
  storyboardMediaTimesEqualV1,
} from './storyboard-shot-duration.js';

export class StoryboardVideoError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly safeDetail: string,
  ) { super(code); }
}

export interface StoryboardVideoPreflight {
  model: string;
  provider: string;
  duration: number;
  estimatedCostUsd: number;
  providerCredits?: number;
  sourceFingerprint: string;
  sourceB2Key: string;
  sourceUrl: string;
  sourceBinding: StoryboardVideoSourceBinding;
  generationBinding: StoryboardVideoGenerationBindingV1;
  bindingFingerprint: string;
}
export type StoryboardVideoSourceStage = 'color' | 'atmosphere';

export interface StoryboardVideoMotionBindingV1 {
  cameraMotionRevision: number;
  cameraMotionFingerprint: string | null;
  cameraMotionStatus: CameraMotionStatusV1;
  cameraMotionBaseFramingFingerprint: string | null;
  shotDuration: StoryboardMediaTimeV1;
  durationRevision: number;
}

export interface StoryboardVideoGenerationBindingV1 {
  version: 1;
  source: StoryboardVideoSourceBinding;
  motion: StoryboardVideoMotionBindingV1;
}

export interface StoryboardVideoSourceRequest {
  sourceStage: StoryboardVideoSourceStage;
  baseVersionId: string;
  paintoverComposite?: StoryboardPaintoverComposite;
  shotFraming: unknown;
}

export interface StoryboardVideoSourceBinding
  extends StoryboardPaintoverBindingState {
  sourceStage: StoryboardVideoSourceStage;
  baseVersionId: string;
  frameUpdatedAt: string;
  sourceUpdatedAt: string;
  sourceRevision: number;
  framingFingerprint: string;
  compositeFingerprint: string | null;
}

export interface ResolvedStoryboardVideoSource {
  bytes: Buffer;
  contentType: string;
  extension: string;
  sourceFingerprint: string;
  binding: StoryboardVideoSourceBinding;
  validatedComposite: ValidatedStoryboardPaintoverComposite | null;
}

const STORYBOARD_VIDEO_SUBMIT_GRACE_MS = 2 * 60 * 1_000;

export function storyboardVideoSubmittingIsWithinGrace(
  submitStartedAt: unknown,
  nowMs = Date.now(),
): boolean {
  const startedMs = new Date(String(submitStartedAt ?? '')).getTime();
  return Number.isFinite(startedMs)
    && Number.isFinite(nowMs)
    && nowMs >= startedMs
    && nowMs - startedMs < STORYBOARD_VIDEO_SUBMIT_GRACE_MS;
}

async function ensureVideoSchema(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS storyboard_ai_video_jobs (
    id uuid PRIMARY KEY, project_id varchar NOT NULL, storyboard_id uuid NOT NULL,
    user_id varchar, user_email varchar,
    model varchar, kind varchar, status varchar DEFAULT 'queued', provider varchar,
    fal_request_id varchar, response_url text, input jsonb, source_asset_id uuid,
    provider_request_id varchar, provider_status_url text,
    provider_cancel_url text, provider_status varchar,
    provider_correlation_id varchar,
    submit_started_at timestamptz, provider_accepted_at timestamptz,
    provider_status_updated_at timestamptz,provider_terminal_at timestamptz,
    callback_token_hash varchar(64),callback_token_expires_at timestamptz,
    callback_token_revoked_at timestamptz,
    updated_at timestamptz DEFAULT now(),
    next_poll_at timestamptz, poll_attempts integer DEFAULT 0,
    last_polled_at timestamptz,last_poll_error text,
    reconcile_lease_owner varchar,reconcile_lease_expires_at timestamptz,
    archive_status varchar DEFAULT 'not_ready',
    archive_next_attempt_at timestamptz,archive_deadline_at timestamptz,
    archive_error text,archived_at timestamptz,
    archive_attempts integer DEFAULT 0,
    archive_lease_owner varchar,archive_lease_expires_at timestamptz,
    output_b2_key text, output_url_temp text, est_cost_usd numeric DEFAULT 0,
    error text, created_at timestamptz DEFAULT now(), completed_at timestamptz)`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS storyboard_ai_video_provider_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES storyboard_ai_video_jobs(id) ON DELETE CASCADE,
    provider varchar NOT NULL,provider_request_id varchar NOT NULL,
    provider_status varchar NOT NULL,source varchar NOT NULL,payload jsonb NOT NULL,
    payload_fingerprint varchar(64) NOT NULL,provider_correlation_id varchar,
    received_at timestamptz DEFAULT now(),processed_at timestamptz,
    processing_error text,
    UNIQUE(provider,provider_request_id,provider_status))`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS storyboard_ai_video_billing_settlements (
    id uuid PRIMARY KEY,job_id uuid NOT NULL REFERENCES storyboard_ai_video_jobs(id) ON DELETE RESTRICT,
    kind varchar(24) NOT NULL,user_id varchar NOT NULL,model varchar NOT NULL,
    amount_usd numeric NOT NULL,billing_mode varchar(24) NOT NULL,
    external_ref varchar(255) NOT NULL,status varchar(24) DEFAULT 'pending',
    attempts integer DEFAULT 0,next_attempt_at timestamptz,
    delivery_deadline_at timestamptz,lease_owner varchar,lease_expires_at timestamptz,
    last_error text,completed_at timestamptz,created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),UNIQUE(job_id,kind),UNIQUE(external_ref))`)
    .catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS project_ai_consent (
    project_id varchar PRIMARY KEY, consented boolean DEFAULT false,
    consented_by varchar, consented_at timestamptz)`).catch(() => undefined);
}

function providerFor(modelId: string) {
  const key = modelId === 'higgsfield-dop-i2v'
    ? 'higgsfield-dop-i2v' : 'seedance-2-i2v';
  return GEN_MODELS[key];
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown> : {};
    } catch { return {}; }
  }
  return {};
}


function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function canonicalizeJSON(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJSON);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeJSON(entry)]),
  );
}

function canonicalJSONString(value: unknown): string {
  return JSON.stringify(canonicalizeJSON(value));
}

function storyboardVideoPaidIdentityV1(
  binding: StoryboardVideoGenerationBindingV1,
): unknown {
  // frameUpdatedAt is an audit/composite-CAS token. Submission/adoption status
  // writes advance it without changing the render source, so it must not make
  // a paid generation look new. All source, paintover, framing, motion and
  // timing authority remains in the canonical identity.
  const stableSource = Object.fromEntries(
    Object.entries(binding.source)
      .filter(([key]) => key !== 'frameUpdatedAt'),
  );
  return { ...binding, source: stableSource };
}

export function storyboardVideoBindingFingerprintV1(
  binding: StoryboardVideoGenerationBindingV1,
): string {
  return `sha256:${crypto.createHash('sha256')
    .update(canonicalJSONString(storyboardVideoPaidIdentityV1(binding)))
    .digest('hex')}`;
}

function safeNonnegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value : null;
}

function normalizedStoryboardVideoDuration(value: number): number {
  return Math.min(15, Math.max(4, Math.round(value || 5)));
}

function cameraMotionNotRenderable(): StoryboardVideoError {
  return new StoryboardVideoError(
    409,
    'camera_motion_not_renderable',
    'Kamerabevegelsen eller shot-varigheten må synkroniseres før animasjon.',
  );
}

/**
 * Builds the only motion/timing identity accepted for paid video work. Raw
 * future schemas remain untouched in persistence, but cannot cross the
 * provider boundary until this server understands them.
 */
export function storyboardVideoMotionBindingV1(
  rawFrame: unknown,
  framingFingerprint: string,
): StoryboardVideoMotionBindingV1 {
  const frame = jsonObject(rawFrame);
  const shotDuration = cameraMotionShotDurationFromFrameV1(frame);
  if (!shotDuration) throw cameraMotionNotRenderable();

  const hasCanonicalDuration = hasOwn(frame, 'shotDuration');
  let durationRevision = 0;
  if (hasCanonicalDuration) {
    const storedRevision = hasOwn(frame, 'durationRevision')
      ? safeNonnegativeInteger(frame.durationRevision) : 1;
    if (storedRevision == null || storedRevision < 1) {
      throw cameraMotionNotRenderable();
    }
    durationRevision = storedRevision;
  } else if (hasOwn(frame, 'durationRevision')) {
    throw cameraMotionNotRenderable();
  }

  const hasMotionEnvelope = CAMERA_MOTION_ENVELOPE_FIELDS.some((key) =>
    hasOwn(frame, key));
  const hasCompleteMotionEnvelope = CAMERA_MOTION_ENVELOPE_FIELDS.every((key) =>
    hasOwn(frame, key));
  const rawTrack = frame.cameraMotionTrack;
  if (!hasMotionEnvelope) {
    return {
      cameraMotionRevision: 0,
      cameraMotionFingerprint: null,
      cameraMotionStatus: 'valid',
      cameraMotionBaseFramingFingerprint: null,
      shotDuration,
      durationRevision,
    };
  }
  if (!hasCompleteMotionEnvelope) throw cameraMotionNotRenderable();

  const revision = safeNonnegativeInteger(frame.cameraMotionRevision);
  const updatedAt = typeof frame.cameraMotionUpdatedAt === 'string'
    ? frame.cameraMotionUpdatedAt.trim() : '';
  if (revision == null || revision < 1 || !updatedAt
      || frame.cameraMotionStatus !== 'valid') {
    throw cameraMotionNotRenderable();
  }

  if (rawTrack === null) {
    if (frame.cameraMotionFingerprint !== null
        || frame.cameraMotionBaseFramingFingerprint !== null) {
      throw cameraMotionNotRenderable();
    }
    return {
      cameraMotionRevision: revision,
      cameraMotionFingerprint: null,
      cameraMotionStatus: 'valid',
      cameraMotionBaseFramingFingerprint: null,
      shotDuration,
      durationRevision,
    };
  }

  const normalized = normalizeCameraMotionTrackV1(rawTrack, shotDuration);
  if (!normalized.ok) throw cameraMotionNotRenderable();
  const fingerprint = cameraMotionRenderFingerprintV1(
    normalized.value,
    shotDuration,
  );
  if (frame.cameraMotionFingerprint !== fingerprint
      || frame.cameraMotionBaseFramingFingerprint !== framingFingerprint) {
    throw cameraMotionNotRenderable();
  }
  return {
    cameraMotionRevision: revision,
    cameraMotionFingerprint: fingerprint,
    cameraMotionStatus: 'valid',
    cameraMotionBaseFramingFingerprint: framingFingerprint,
    shotDuration,
    durationRevision,
  };
}

function assertStoryboardVideoMotionMirror(
  normalizedMetadata: unknown,
  compatFrame: unknown,
  binding: StoryboardVideoMotionBindingV1,
): void {
  const metadata = jsonObject(normalizedMetadata);
  const frame = jsonObject(compatFrame);
  const compatHasMotion = CAMERA_MOTION_ENVELOPE_FIELDS.some((key) =>
    hasOwn(frame, key));
  const metadataHasMotion = CAMERA_MOTION_ENVELOPE_FIELDS.some((key) =>
    hasOwn(metadata, key));
  const motionMatches = compatHasMotion === metadataHasMotion
    && (!compatHasMotion || CAMERA_MOTION_ENVELOPE_FIELDS.every((key) =>
      hasOwn(metadata, key)
      && canonicalJSONString(metadata[key]) === canonicalJSONString(frame[key])));

  const metadataHasDuration = hasOwn(metadata, 'shotDuration')
    || hasOwn(metadata, 'durationRevision');
  let durationMatches = true;
  if (metadataHasDuration) {
    const mirroredDuration = normalizeShotDurationV1(metadata.shotDuration);
    const mirroredRevision = hasOwn(metadata, 'durationRevision')
      ? safeNonnegativeInteger(metadata.durationRevision)
      : 1;
    durationMatches = Boolean(mirroredDuration
      && mirroredRevision != null
      && storyboardMediaTimesEqualV1(mirroredDuration, binding.shotDuration)
      && mirroredRevision === binding.durationRevision);
  }
  if (!motionMatches || !durationMatches) {
    throw new StoryboardVideoError(
      409,
      'camera_motion_state_unsynced',
      'Kamerabevegelsen er ikke ferdig synkronisert. Lagre shotet og prøv igjen.',
    );
  }
}

function makeStoryboardVideoGenerationBinding(
  source: StoryboardVideoSourceBinding,
  motion: StoryboardVideoMotionBindingV1,
): StoryboardVideoGenerationBindingV1 {
  return { version: 1, source, motion };
}
function storyboardHiggsfieldWebhookUrl(token: string): string {
  const configured = process.env.ROLE_ROOM_PUBLIC_URL?.trim()
    || 'https://theroleroom.com';
  try {
    const base = new URL(configured);
    if (base.protocol !== 'https:' || base.username || base.password
        || base.search || base.hash) {
      throw new Error('invalid_public_origin');
    }
    return new URL(
      `/api/role-room/storyboard-video-webhooks/higgsfield/${token}`,
      base.origin,
    ).toString();
  } catch {
    return `https://theroleroom.com/api/role-room/`
      + `storyboard-video-webhooks/higgsfield/${token}`;
  }
}

async function persistStoryboardVideoProviderEvent(
  pool: Pool,
  input: {
    jobId: string;
    provider: string;
    providerRequestId: string;
    providerStatus: 'completed' | 'failed' | 'nsfw' | 'canceled';
    providerCorrelationId?: string;
    outputUrl?: string | null;
    error?: string;
  },
): Promise<void> {
  const payload = {
    request_id: input.providerRequestId,
    status: input.providerStatus,
    error: input.error ?? null,
    video: input.outputUrl ? { url: input.outputUrl } : null,
  };
  const encoded = JSON.stringify(payload);
  const fingerprint = crypto.createHash('sha256').update(encoded).digest('hex');
  try {
    await pool.query(
      `INSERT INTO storyboard_ai_video_provider_events
       (job_id,provider,provider_request_id,provider_status,source,payload,
         payload_fingerprint,provider_correlation_id)
       VALUES ($1,$2,$3,$4,'poll',$5::jsonb,$6,$7)
       ON CONFLICT (provider,provider_request_id,provider_status) DO UPDATE
         SET source='poll',payload=EXCLUDED.payload,
             payload_fingerprint=EXCLUDED.payload_fingerprint,
             provider_correlation_id=COALESCE(
               EXCLUDED.provider_correlation_id,
               storyboard_ai_video_provider_events.provider_correlation_id
             ),
             processing_error=NULL`,
      [
        input.jobId,
        input.provider,
        input.providerRequestId,
        input.providerStatus,
        encoded,
        fingerprint,
        input.providerCorrelationId ?? null,
      ],
    );
  } catch {
    throw new StoryboardVideoError(
      503,
      'provider_event_persist_failed',
      'Leverandørstatusen kunne ikke lagres sikkert. Avstemmingen prøves igjen.',
    );
  }
}

async function markStoryboardVideoProviderEventProcessed(
  pool: Pool,
  input: {
    provider: string;
    providerRequestId: string;
    providerStatus: string;
  },
): Promise<void> {
  await pool.query(
    `UPDATE storyboard_ai_video_provider_events
        SET processed_at=COALESCE(processed_at,NOW()),processing_error=NULL
      WHERE provider=$1 AND provider_request_id=$2 AND provider_status=$3`,
    [input.provider, input.providerRequestId, input.providerStatus],
  ).catch(() => undefined);
}

export async function acceptStoryboardVideoHiggsfieldWebhook(
  pool: Pool,
  input: { token: string; body: unknown },
): Promise<{ accepted: true; wakeScheduled: boolean }> {
  if (!/^[0-9a-f]{64}$/.test(input.token)) {
    throw new StoryboardVideoError(
      404, 'webhook_not_found', 'Webhook-adressen finnes ikke.',
    );
  }
  const body = jsonObject(input.body);
  const providerRequestId = typeof body.request_id === 'string'
    ? body.request_id.trim().toLowerCase() : '';
  const providerStatus = typeof body.status === 'string' ? body.status : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      .test(providerRequestId)
      || !['completed', 'failed', 'nsfw'].includes(providerStatus)) {
    throw new StoryboardVideoError(
      422, 'invalid_webhook_payload', 'Webhook-payloaden er ugyldig.',
    );
  }
  const encoded = JSON.stringify(input.body);
  if (Buffer.byteLength(encoded, 'utf8') > 256 * 1024) {
    throw new StoryboardVideoError(
      413, 'webhook_payload_too_large', 'Webhook-payloaden er for stor.',
    );
  }
  const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
  const payloadFingerprint = crypto.createHash('sha256')
    .update(encoded)
    .digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      `SELECT id,provider_request_id,provider_status_url,provider_status,status
         FROM storyboard_ai_video_jobs
        WHERE provider='higgsfield' AND callback_token_hash=$1
          AND callback_token_revoked_at IS NULL
          AND callback_token_expires_at > NOW()
        FOR UPDATE`,
      [tokenHash],
    );
    const job = selected.rows[0];
    if (!job) {
      throw new StoryboardVideoError(
        404, 'webhook_not_found', 'Webhook-adressen finnes ikke.',
      );
    }
    if (job.provider_request_id
        && String(job.provider_request_id).toLowerCase() !== providerRequestId) {
      throw new StoryboardVideoError(
        409, 'webhook_request_mismatch',
        'Webhooken tilhører en annen leverandørjobb.',
      );
    }
    await client.query(
      `INSERT INTO storyboard_ai_video_provider_events
        (job_id,provider,provider_request_id,provider_status,source,payload,
         payload_fingerprint)
       VALUES ($1,'higgsfield',$2,$3,'webhook',$4::jsonb,$5)
       ON CONFLICT (provider,provider_request_id,provider_status) DO NOTHING`,
      [
        job.id,
        providerRequestId,
        providerStatus,
        encoded,
        payloadFingerprint,
      ],
    );
    const wakeScheduled = Boolean(
      job.provider_request_id
      && job.provider_status_url
      && ['queued', 'in_progress'].includes(String(job.provider_status))
      && ['queued', 'running', 'processing'].includes(String(job.status)),
    );
    if (wakeScheduled) {
      await client.query(
        `UPDATE storyboard_ai_video_jobs
            SET next_poll_at=NOW(),updated_at=NOW()
          WHERE id=$1`,
        [job.id],
      );
    }
    await client.query('COMMIT');
    return { accepted: true, wakeScheduled };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof StoryboardVideoError) throw error;
    throw new StoryboardVideoError(
      503,
      'webhook_persist_failed',
      'Webhooken kunne ikke lagres sikkert. Leverandøren kan prøve igjen.',
    );
  } finally {
    client.release();
  }
}

export async function getStoryboardVideoConfig(
  pool: Pool,
  input: { projectId: string; userEmail: string; userRole: string },
) {
  await ensureVideoSchema(pool);
  const settings = await getGenSettings(pool);
  const consent = await pool.query(
    `SELECT consented, consented_by, consented_at
       FROM project_ai_consent WHERE project_id = $1`, [input.projectId],
  ).catch(() => ({ rows: [] }));
  return {
    enabled: settings.enabled,
    allowed: aiAllowed(settings, input.userEmail, input.userRole),
    billingMode: settings.billingMode,
    consent: consent.rows[0]
      ? { consented: Boolean(consent.rows[0].consented), by: consent.rows[0].consented_by,
        at: consent.rows[0].consented_at }
      : { consented: false },
    models: [providerFor('seedance-2-i2v'), providerFor('higgsfield-dop-i2v')].map((model) => ({
      id: model.key, label: model.label, provider: model.provider,
      configured: model.provider === 'higgsfield' ? higgsfieldConfigured() : falConfigured(),
      estimatedCostUsd5s: 5 * (model.costPerSecondUsd ?? model.estCostUsd / 5),
    })),
  };
}

export async function setStoryboardVideoConsent(
  pool: Pool,
  input: { projectId: string; consented: boolean; consentedBy: string },
): Promise<void> {
  await ensureVideoSchema(pool);
  await pool.query(
    `INSERT INTO project_ai_consent (project_id, consented, consented_by, consented_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (project_id) DO UPDATE SET consented=EXCLUDED.consented,
       consented_by=EXCLUDED.consented_by, consented_at=NOW()`,
    [input.projectId, input.consented, input.consentedBy],
  );
}

function decodeStoryboardImage(imageData: string | null): {
  bytes: Buffer; contentType: string; extension: string;
} {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageData ?? '');
  if (!match) {
    throw new StoryboardVideoError(
      409, 'storyboard_image_required',
      'Generer eller importer et panelbilde før animasjon.',
    );
  }
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
    throw new StoryboardVideoError(413, 'storyboard_image_too_large', 'Startbildet er for stort.');
  }
  return {
    bytes, contentType: match[1], extension: match[1] === 'image/jpeg' ? 'jpg' : match[1].slice(6),
  };
}
export interface StoryboardVideoApprovedBase {
  id: string;
  stage: StoryboardVideoSourceStage;
  imageData: string;
  metadata: Record<string, unknown>;
}

function exactStoryboardPaintoverState(
  liveValue: unknown,
  mirroredValue: unknown,
  stage: StoryboardVideoSourceStage,
): {
  binding: StoryboardPaintoverBindingState;
  atmosphereStale: boolean;
  videoStale: boolean;
} {
  const rawLive = storyboardPaintoverBindingState(liveValue);
  const rawMirrored = storyboardPaintoverBindingState(mirroredValue);
  const live = rawLive
    ? storyboardPaintoverBindingForStage(rawLive, stage) : null;
  const mirrored = rawMirrored
    ? storyboardPaintoverBindingForStage(rawMirrored, stage) : null;
  const liveRecord = jsonObject(liveValue);
  const mirroredRecord = jsonObject(mirroredValue);
  if (!live || !mirrored
      || canonicalJSONString(live) !== canonicalJSONString(mirrored)
      || (stage === 'atmosphere'
        && ((liveRecord.atmosphereStale === true)
          !== (mirroredRecord.atmosphereStale === true)
          || (liveRecord.videoStale === true)
            !== (mirroredRecord.videoStale === true)))) {
    throw new StoryboardVideoError(
      409,
      'paintover_state_unsynced',
      'Paintover-lagene er ikke ferdig synket. Lagre panelet og prøv igjen.',
    );
  }
  return {
    binding: live,
    atmosphereStale: liveRecord.atmosphereStale === true,
    videoStale: liveRecord.videoStale === true,
  };
}

export async function validateStoryboardVideoSourceSnapshot(input: {
  request: StoryboardVideoSourceRequest;
  base: StoryboardVideoApprovedBase;
  sourceRevision: number;
  framingFingerprint: string;
  frameUpdatedAt: string;
  sourceUpdatedAt: string;
  livePaintoverState: unknown;
  mirroredPaintoverState: unknown;
}): Promise<ResolvedStoryboardVideoSource> {
  const metadata = input.base.metadata;
  const baseSourceRevision = Number(metadata.sourceRevision);
  const baseSourceUpdatedAt = typeof metadata.compatSourceUpdatedAt === 'string'
    ? metadata.compatSourceUpdatedAt
    : typeof metadata.compatFrameUpdatedAt === 'string'
      ? metadata.compatFrameUpdatedAt : '';
  const baseFraming = typeof metadata.framingFingerprint === 'string'
    ? metadata.framingFingerprint : '';
  if (input.base.id !== input.request.baseVersionId
      || input.base.stage !== input.request.sourceStage
      || !Number.isSafeInteger(baseSourceRevision)
      || baseSourceRevision !== input.sourceRevision
      || baseSourceUpdatedAt !== input.sourceUpdatedAt
      || baseFraming !== input.framingFingerprint) {
    throw new StoryboardVideoError(
      409,
      'animation_base_stale',
      'Den godkjente AI-basen tilhører et eldre shot. Velg en oppdatert base.',
    );
  }
  const state = exactStoryboardPaintoverState(
    input.livePaintoverState,
    input.mirroredPaintoverState,
    input.request.sourceStage,
  );
  if (input.request.sourceStage === 'atmosphere' && state.atmosphereStale) {
    throw new StoryboardVideoError(
      409,
      'atmosphere_source_stale',
      'Color-paintoveren er endret. Godkjenn Atmosphere på nytt før animasjon.',
    );
  }
  const relevantHasContent = input.request.sourceStage === 'color'
    ? state.binding.colorHasContent : state.binding.atmosphereHasContent;
  let source: {
    bytes: Buffer;
    contentType: string;
    extension: string;
  };
  let validatedComposite: ValidatedStoryboardPaintoverComposite | null = null;
  if (input.request.paintoverComposite) {
    try {
      validateStoryboardPaintoverCompositeBinding({
        composite: input.request.paintoverComposite,
        expectedIncludedThroughStage: input.request.sourceStage,
        expectedBaseVersionId: input.base.id,
        liveFrameUpdatedAt: input.frameUpdatedAt,
        liveSourceUpdatedAt: input.sourceUpdatedAt,
        liveSourceRevision: input.sourceRevision,
        liveFramingFingerprint: input.framingFingerprint,
        livePaintoverState: input.livePaintoverState,
        mirroredPaintoverState: input.mirroredPaintoverState,
      });
      const framing = normalizeShotFramingState(input.request.shotFraming);
      if (!framing) {
        throw new StoryboardPaintoverCompositeError(
          409,
          'framing_context_required',
          'Paintover-kilden mangler anvendt kamerautsnitt.',
        );
      }
      validatedComposite = await validateStoryboardPaintoverCompositeImage(
        input.request.paintoverComposite,
        framing.aspectRatio,
      );
    } catch (error) {
      if (error instanceof StoryboardPaintoverCompositeError) {
        throw new StoryboardVideoError(error.status, error.code, error.safeDetail);
      }
      throw error;
    }
    source = {
      bytes: validatedComposite.bytes,
      contentType: validatedComposite.contentType,
      extension: 'png',
    };
  } else {
    if (relevantHasContent) {
      throw new StoryboardVideoError(
        409,
        'paintover_composite_required',
        'Frys den redigerbare paintoveren sammen med den godkjente AI-basen før animasjon.',
      );
    }
    source = decodeStoryboardImage(input.base.imageData);
  }
  const sourceFingerprint = crypto.createHash('sha256')
    .update(source.bytes).digest('hex').slice(0, 16);
  return {
    ...source,
    sourceFingerprint,
    validatedComposite,
    binding: {
      ...state.binding,
      sourceStage: input.request.sourceStage,
      baseVersionId: input.base.id,
      frameUpdatedAt: input.frameUpdatedAt,
      sourceUpdatedAt: input.sourceUpdatedAt,
      sourceRevision: input.sourceRevision,
      framingFingerprint: input.framingFingerprint,
      compositeFingerprint: validatedComposite?.fingerprint ?? null,
    },
  };
}

async function resolveStoryboardVideoSource(
  pool: Pool,
  input: {
    projectId: string;
    storyboard: Storyboard;
    request: StoryboardVideoSourceRequest;
    expectedSourceUpdatedAt?: string;
    expectedFramingFingerprint?: string;
  },
): Promise<ResolvedStoryboardVideoSource & {
  motionBinding: StoryboardVideoMotionBindingV1;
}> {
  const snapshot = await validateStoryboardCompatMirror(pool, {
    storyboard: input.storyboard,
    shotFraming: input.request.shotFraming,
  });
  if ((input.expectedSourceUpdatedAt
        && snapshot.compatSource.sourceUpdatedAt !== input.expectedSourceUpdatedAt)
      || (input.expectedFramingFingerprint
        && snapshot.framingFingerprint !== input.expectedFramingFingerprint)) {
    throw new StoryboardVideoError(
      409,
      'preflight_changed',
      'Storyboard-kilden ble endret etter forhåndskontrollen.',
    );
  }
  const motionBinding = storyboardVideoMotionBindingV1(
    snapshot.compatSource.frameDocument,
    snapshot.framingFingerprint,
  );
  assertStoryboardVideoMotionMirror(snapshot.storyboard.metadata,
    snapshot.compatSource.frameDocument, motionBinding);
  const selected = await pool.query(
    `SELECT id,stage,image_data,metadata
       FROM storyboard_ai_image_versions
      WHERE id=$1 AND storyboard_id=$2 AND project_id=$3
        AND status='approved' AND stage=$4
      LIMIT 1`,
    [
      input.request.baseVersionId,
      snapshot.storyboard.id,
      input.projectId,
      input.request.sourceStage,
    ],
  );
  const row = selected.rows[0];
  if (!row) {
    throw new StoryboardVideoError(
      409,
      'animation_base_not_approved',
      'Velg en godkjent Color- eller Atmosphere-versjon før animasjon.',
    );
  }
  const source = await validateStoryboardVideoSourceSnapshot({
    request: input.request,
    base: {
      id: String(row.id),
      stage: String(row.stage) as StoryboardVideoSourceStage,
      imageData: String(row.image_data ?? ''),
      metadata: jsonObject(row.metadata),
    },
    sourceRevision: snapshot.sourceRevision,
    framingFingerprint: snapshot.framingFingerprint,
    frameUpdatedAt: snapshot.compatSource.frameUpdatedAt,
    sourceUpdatedAt: snapshot.compatSource.sourceUpdatedAt,
    livePaintoverState: snapshot.compatSource.paintoverState,
    mirroredPaintoverState: snapshot.storyboard.metadata.aiPaintoverState,
  });
  return { ...source, motionBinding };
}

export async function preflightStoryboardVideo(
  pool: Pool,
  input: {
    projectId: string;
    storyboard: Storyboard;
    userId: string;
    userEmail: string;
    userRole: string;
    modelId: 'seedance-2-i2v' | 'higgsfield-dop-i2v';
    duration: number;
    compiledPrompt: string;
    sourceStage: StoryboardVideoSourceStage;
    baseVersionId: string;
    paintoverComposite?: StoryboardPaintoverComposite;
    shotFraming: unknown;
    expectedCompatSourceUpdatedAt?: string;
    expectedFramingFingerprint?: string;
    expectedSourceFingerprint?: string;
    expectedBindingFingerprint?: string;
  },
): Promise<StoryboardVideoPreflight> {
  await ensureVideoSchema(pool);
  const settings = await getGenSettings(pool);
  if (!settings.enabled || !aiAllowed(settings, input.userEmail, input.userRole)) {
    throw new StoryboardVideoError(403, 'ai_not_allowed', 'AI-video er ikke aktivert for kontoen.');
  }
  const model = providerFor(input.modelId);
  const ready = model.provider === 'higgsfield' ? higgsfieldConfigured() : falConfigured();
  if (!ready) {
    throw new StoryboardVideoError(503, 'provider_not_configured',
      model.provider === 'higgsfield' ? 'Higgsfield er ikke konfigurert.' : 'Seedance/fal er ikke konfigurert.');
  }
  const consent = await pool.query(
    `SELECT consented FROM project_ai_consent WHERE project_id = $1`, [input.projectId],
  ).catch(() => ({ rows: [] }));
  if (!consent.rows[0]?.consented) {
    throw new StoryboardVideoError(409, 'consent_required',
      'Prosjektet må samtykke før et storyboard sendes til tredjeparts AI.');
  }
  const duration = normalizedStoryboardVideoDuration(input.duration);
  const knownEstimateUsd = model.provider === 'higgsfield'
    ? null
    : duration * (model.costPerSecondUsd ?? model.estCostUsd / 5);
  // Run every cheap local gate before source composition, B2 upload, or a
  // provider estimate. Higgsfield's exact price still requires its estimate,
  // but an exhausted cap/empty wallet is rejected without external I/O.
  const workspaceSpent = await pool.query(
    `SELECT COALESCE(SUM(est_cost_usd),0)::float AS spent
       FROM generative_ai_jobs WHERE created_at::date = NOW()::date`,
  ).catch(() => ({ rows: [{ spent: 0 }] }));
  const storyboardSpent = await pool.query(
    `SELECT COALESCE(SUM(est_cost_usd),0)::float AS spent
       FROM storyboard_ai_video_jobs
      WHERE created_at::date = NOW()::date
        AND status NOT IN (
          'failed','rejected_retryable','failed_permanent','nsfw','canceled'
        )`,
  ).catch(() => ({ rows: [{ spent: 0 }] }));
  const spentToday = Number(workspaceSpent.rows[0]?.spent ?? 0)
    + Number(storyboardSpent.rows[0]?.spent ?? 0);
  if (spentToday >= settings.dailyCapUsd
      || (knownEstimateUsd != null
        && spentToday + knownEstimateUsd > settings.dailyCapUsd)) {
    throw new StoryboardVideoError(429, 'daily_cap', 'Det globale dagstaket for AI er nådd.');
  }
  const creditBalance = settings.billingMode === 'credits'
    ? (await getUserCredits(pool, input.userId)).balanceUsd
    : null;
  if (creditBalance != null
      && (creditBalance <= 0
        || (knownEstimateUsd != null
          && creditBalance < knownEstimateUsd * settings.markupMultiplier))) {
    throw new StoryboardVideoError(402, 'insufficient_credits', 'Ikke nok AI-kreditter.');
  }
  if (settings.billingMode === 'metered') {
    const eligibility = await verifyGenAiMeterEligibility(pool, {
      userId: input.userId,
      settings,
    });
    if (!eligibility.eligible) {
      throw new StoryboardVideoError(
        402,
        'metered_billing_required',
        'Koble til et aktivt, fakturerbart abonnement før AI-generering.',
      );
    }
  }
  const source = await resolveStoryboardVideoSource(pool, {
    projectId: input.projectId,
    storyboard: input.storyboard,
    request: {
      sourceStage: input.sourceStage,
      baseVersionId: input.baseVersionId,
      paintoverComposite: input.paintoverComposite,
      shotFraming: input.shotFraming,
    },
    expectedSourceUpdatedAt: input.expectedCompatSourceUpdatedAt,
    expectedFramingFingerprint: input.expectedFramingFingerprint,
  });
  const sourceFingerprint = source.sourceFingerprint;
  const generationBinding = makeStoryboardVideoGenerationBinding(
    source.binding,
    source.motionBinding,
  );
  const bindingFingerprint = storyboardVideoBindingFingerprintV1(
    generationBinding,
  );
  if ((input.expectedSourceFingerprint
        && input.expectedSourceFingerprint !== sourceFingerprint)
      || (input.expectedBindingFingerprint
        && input.expectedBindingFingerprint !== bindingFingerprint)) {
    throw new StoryboardVideoError(
      409, 'preflight_changed',
      'Kilde, kamerabevegelse eller shot-varighet er endret. Kontroller på nytt.',
    );
  }
  const sourceKey = `workspace/${input.projectId}/storyboards/${input.storyboard.id}/animation-sources/${sourceFingerprint}.${source.extension}`;
  const stored = await archiveToRoleRoomB2(sourceKey, source.bytes, source.contentType);
  if (!stored) throw new StoryboardVideoError(503, 'source_unavailable', 'Startbildet kunne ikke klargjøres.');
  const sourceUrl = await presignRoleRoomB2Download(sourceKey, undefined, 3600);
  if (!sourceUrl) throw new StoryboardVideoError(503, 'source_unavailable', 'Startbildet kunne ikke åpnes.');

  let providerCredits: number | undefined;
  let estimatedCostUsd: number;
  if (model.provider === 'higgsfield') {
    const estimate = await higgsfieldEstimate({ imageUrl: sourceUrl, prompt: input.compiledPrompt });
    if (estimate.error || estimate.usd === undefined) {
      throw new StoryboardVideoError(
        502, 'provider_estimate_failed',
        'Higgsfield kunne ikke beregne kostnaden; jobben ble ikke startet.',
      );
    }
    providerCredits = estimate.credits;
    estimatedCostUsd = estimate.usd;
  } else {
    estimatedCostUsd = knownEstimateUsd as number;
  }
  if (spentToday + estimatedCostUsd > settings.dailyCapUsd) {
    throw new StoryboardVideoError(429, 'daily_cap', 'Det globale dagstaket for AI er nådd.');
  }
  if (creditBalance != null
      && creditBalance < estimatedCostUsd * settings.markupMultiplier) {
    throw new StoryboardVideoError(402, 'insufficient_credits', 'Ikke nok AI-kreditter.');
  }

  return {
    model: model.key, provider: model.provider, duration, estimatedCostUsd,
    providerCredits, sourceFingerprint, sourceB2Key: sourceKey, sourceUrl,
    sourceBinding: source.binding,
    generationBinding,
    bindingFingerprint,
  };
}

async function ensureStoryboardVideoCreditReservation(
  pool: Pool,
  input: {
    jobId: string;
    userId: string;
    model: string;
    billedUsd: number;
    billingMode: string;
  },
): Promise<void> {
  if (input.billingMode !== 'credits' || input.billedUsd <= 0) return;
  await enqueueStoryboardVideoBillingSettlement(pool, {
    jobId: input.jobId,
    kind: 'credit_debit',
    userId: input.userId,
    model: input.model,
    amountUsd: input.billedUsd,
    billingMode: input.billingMode,
  });
  const outcome = await deliverStoryboardVideoBillingSettlementNow(pool, {
    jobId: input.jobId,
    kind: 'credit_debit',
  });
  if (outcome === 'permanent_failed') {
    throw new StoryboardVideoError(402, 'insufficient_credits', 'Ikke nok AI-kreditter.');
  }
  if (outcome !== 'completed') {
    throw new StoryboardVideoError(
      503,
      'credit_reservation_pending',
      'Kredittreservasjonen er lagret og prøves igjen. Ingen generering er sendt.',
    );
  }
}

async function persistStoryboardVideoSubmissionFailure(
  pool: Pool,
  input: {
    jobId: string;
    status: 'rejected_retryable' | 'failed_permanent' | 'failed';
    error: string;
    providerCorrelationId?: string;
    expectedStatuses: string[];
    reservation: {
      userId: string;
      model: string;
      billedUsd: number;
      billingMode: string;
    };
  },
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE storyboard_ai_video_jobs
          SET status=$2,error=$3,
              provider_correlation_id=COALESCE($4,provider_correlation_id),
              callback_token_revoked_at=CASE WHEN provider='higgsfield'
                THEN NOW() ELSE callback_token_revoked_at END,
              updated_at=NOW()
        WHERE id=$1 AND status=ANY($5::varchar[])
        RETURNING id`,
      [
        input.jobId,
        input.status,
        input.error,
        input.providerCorrelationId ?? null,
        input.expectedStatuses,
      ],
    );
    if (updated.rowCount === 1) {
      await enqueueStoryboardVideoBillingSettlement(client, {
        jobId: input.jobId,
        kind: 'credit_refund',
        userId: input.reservation.userId,
        model: input.reservation.model,
        amountUsd: input.reservation.billedUsd,
        billingMode: input.reservation.billingMode,
      });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await deliverStoryboardVideoBillingSettlementNow(pool, {
    jobId: input.jobId,
    kind: 'credit_refund',
  }).catch(() => 'retrying');
}

async function persistSubmittingVideoHandle(
  client: PoolClient,
  input: {
    projectId: string;
    storyboardId: string;
    jobId: string;
    model: string;
    sourceRevision: number;
    framingFingerprint: string;
    compatSource: {
      manuscriptId: string;
      sceneId: string;
      frameId: string;
      sourceUpdatedAt: string;
    };
    sourceBinding: StoryboardVideoSourceBinding;
    generationBinding: StoryboardVideoGenerationBindingV1;
    bindingFingerprint: string;
  },
): Promise<void> {
  const storeKey = `casting:scenes:${input.compatSource.manuscriptId}`;
  const selected = await client.query(
    `SELECT store_value FROM legacy_compat_store WHERE store_key=$1 FOR UPDATE`,
    [storeKey],
  );
  const scenes = parseSceneBlob(selected.rows[0]?.store_value);
  const sceneIndex = scenes.findIndex((scene) => scene.id === input.compatSource.sceneId);
  const scene = sceneIndex >= 0 ? scenes[sceneIndex] : null;
  const frames = Array.isArray(scene?.storyboardFrames)
    ? (scene.storyboardFrames as Record<string, unknown>[]) : [];
  const frameIndex = frames.findIndex((frame) => frame?.id === input.compatSource.frameId);
  if (!scene || frameIndex < 0) {
    throw new StoryboardVideoError(
      409, 'compat_source_missing', 'Storyboard-shotet forsvant før videojobben ble lagret.',
    );
  }
  const frame = frames[frameIndex];
  const binding = input.sourceBinding;
  const paintover = exactStoryboardPaintoverState(
    frame.aiPaintoverState,
    frame.aiPaintoverState,
    binding.sourceStage,
  );
  const motionBinding = storyboardVideoMotionBindingV1(
    frame,
    input.framingFingerprint,
  );
  const generationBinding = makeStoryboardVideoGenerationBinding(
    binding, motionBinding,
  );
  const bindingFingerprint = storyboardVideoBindingFingerprintV1(generationBinding);
  const liveSourceUpdatedAt = typeof frame.sourceUpdatedAt === 'string'
      && frame.sourceUpdatedAt.trim()
    ? frame.sourceUpdatedAt.trim()
    : typeof frame.updatedAt === 'string' ? frame.updatedAt : '';
  if ((binding.sourceStage === 'atmosphere'
        && frame.updatedAt !== binding.frameUpdatedAt)
      || liveSourceUpdatedAt !== binding.sourceUpdatedAt
      || liveSourceUpdatedAt !== input.compatSource.sourceUpdatedAt
      || binding.sourceRevision !== input.sourceRevision
      || binding.framingFingerprint !== input.framingFingerprint
      || paintover.binding.colorRevision !== binding.colorRevision
      || paintover.binding.atmosphereRevision !== binding.atmosphereRevision
      || paintover.binding.colorFingerprint !== binding.colorFingerprint
      || paintover.binding.atmosphereFingerprint !== binding.atmosphereFingerprint
      || paintover.binding.colorHasContent !== binding.colorHasContent
      || paintover.binding.atmosphereHasContent !== binding.atmosphereHasContent
      || (binding.sourceStage === 'atmosphere' && paintover.atmosphereStale)
      || bindingFingerprint !== input.bindingFingerprint
      || canonicalJSONString(generationBinding)
        !== canonicalJSONString(input.generationBinding)
      || input.generationBinding.source.sourceRevision
        !== input.sourceRevision) {
    throw new StoryboardVideoError(
      409,
      'preflight_changed',
      'Paintover-kilden ble endret før videojobben ble lagret.',
    );
  }
  const currentTimestamp = Date.parse(String(frame.updatedAt ?? ''));
  const updatedAt = new Date(Math.max(
    Date.now(), Number.isFinite(currentTimestamp) ? currentTimestamp + 1 : 0,
  )).toISOString();
  const nextFrames = frames.slice();
  nextFrames[frameIndex] = {
    ...frame,
    aiStoryboardId: input.storyboardId,
    aiVideoJobId: input.jobId,
    aiVideoStatus: 'submitting',
    aiVideoModel: input.model,
    aiVideoURL: null,
    aiVideoArchiveKey: null,
    aiVideoSourceRevision: input.sourceRevision,
    aiVideoSourceUpdatedAt: input.compatSource.sourceUpdatedAt,
    aiVideoSourceFramingFingerprint: input.framingFingerprint,
    aiVideoSourceFrameUpdatedAt: binding.frameUpdatedAt,
    aiVideoSourceBaseVersionId: binding.baseVersionId,
    aiVideoSourceStage: binding.sourceStage,
    aiVideoSourceColorRevision: binding.colorRevision,
    aiVideoSourceAtmosphereRevision: binding.atmosphereRevision,
    aiVideoSourceColorFingerprint: binding.colorFingerprint,
    aiVideoSourceAtmosphereFingerprint: binding.atmosphereFingerprint,
    aiVideoSourceColorHasContent: binding.colorHasContent,
    aiVideoSourceAtmosphereHasContent: binding.atmosphereHasContent,
    aiVideoSourceCompositeFingerprint: binding.compositeFingerprint,
    sourceUpdatedAt: input.compatSource.sourceUpdatedAt,
    updatedAt,
    aiVideoSourceBindingFingerprint: input.bindingFingerprint,
    aiVideoSourceMotionRevision: motionBinding.cameraMotionRevision,
    aiVideoSourceMotionFingerprint: motionBinding.cameraMotionFingerprint,
    aiVideoSourceMotionStatus: motionBinding.cameraMotionStatus,
    aiVideoSourceMotionBaseFramingFingerprint:
      motionBinding.cameraMotionBaseFramingFingerprint,
    aiVideoSourceShotDuration: motionBinding.shotDuration,
    aiVideoSourceDurationRevision: motionBinding.durationRevision,
  };
  const nextScenes = scenes.slice();
  nextScenes[sceneIndex] = {
    ...scene,
    storyboardFrames: nextFrames,
    updatedAt,
  };
  const updated = await client.query(
    `UPDATE legacy_compat_store SET store_value=$2::jsonb,updated_at=NOW()
      WHERE store_key=$1`,
    [storeKey, JSON.stringify(nextScenes)],
  );
  if (updated.rowCount !== 1) {
    throw new StoryboardVideoError(
      409, 'compat_source_missing', 'Storyboard-shotet kunne ikke lagre videojobben.',
    );
  }
  await client.query(
    `UPDATE legacy_compat_store
        SET store_value=jsonb_set(
          store_value,'{version}',to_jsonb(
            CASE WHEN COALESCE(store_value->>'version','') ~ '^[0-9]+$'
              THEN (store_value->>'version')::bigint + 1 ELSE 1 END),true),
            updated_at=NOW()
      WHERE store_key=$1`,
    [`casting:manuscript:${input.compatSource.manuscriptId}`],
  );
  await client.query(
    `UPDATE casting_storyboards
        SET metadata=COALESCE(metadata,'{}'::jsonb) || $1::jsonb,updated_at=NOW()
      WHERE id=$2 AND project_id=$3`,
    [JSON.stringify({
      aiVideo: {
        jobId: input.jobId,
        status: 'submitting',
        model: input.model,
        sourceRevision: input.sourceRevision,
        sourceUpdatedAt: input.compatSource.sourceUpdatedAt,
        framingFingerprint: input.framingFingerprint,
        frameUpdatedAt: binding.frameUpdatedAt,
        baseVersionId: binding.baseVersionId,
        sourceStage: binding.sourceStage,
        colorRevision: binding.colorRevision,
        atmosphereRevision: binding.atmosphereRevision,
        colorFingerprint: binding.colorFingerprint,
        atmosphereFingerprint: binding.atmosphereFingerprint,
        compositeFingerprint: binding.compositeFingerprint,
        bindingFingerprint: input.bindingFingerprint,
        cameraMotionRevision: motionBinding.cameraMotionRevision,
        cameraMotionFingerprint: motionBinding.cameraMotionFingerprint,
        cameraMotionStatus: motionBinding.cameraMotionStatus,
        cameraMotionBaseFramingFingerprint:
          motionBinding.cameraMotionBaseFramingFingerprint,
        shotDuration: motionBinding.shotDuration,
        durationRevision: motionBinding.durationRevision,
      },
      compatFrameUpdatedAt: updatedAt,
      compatSourceUpdatedAt: input.compatSource.sourceUpdatedAt,
    }), input.storyboardId, input.projectId],
  );
}

export async function submitStoryboardVideo(
  pool: Pool,
  input: {
    projectId: string;
    storyboard: Storyboard;
    userId: string;
    userEmail: string;
    userRole: string;
    modelId: 'seedance-2-i2v' | 'higgsfield-dop-i2v';
    duration: number;
    compiledPrompt: string;
    compilationFingerprint: string;
    confirmedPreflight: {
      compilationFingerprint: string;
      sourceFingerprint: string;
      bindingFingerprint: string;
      duration: number;
      maxEstimatedCostUsd: number;
    };
    expectedCompatSourceUpdatedAt: string;
    expectedFramingFingerprint: string;
    sourceStage: StoryboardVideoSourceStage;
    baseVersionId: string;
    paintoverComposite?: StoryboardPaintoverComposite;
    shotFraming: unknown;
  },
) {
  const confirmed = input.confirmedPreflight as
    | typeof input.confirmedPreflight
    | undefined;
  if (!confirmed) {
    throw new StoryboardVideoError(
      400,
      'preflight_confirmation_required',
      'Bekreft forhåndsvisningen før videojobben startes.',
    );
  }
  if (confirmed.compilationFingerprint
      !== input.compilationFingerprint) {
    throw new StoryboardVideoError(
      409, 'preflight_changed',
      'Prompten er endret. Kontroller den nye forhåndsvisningen før start.',
    );
  }
  if (confirmed.duration !== normalizedStoryboardVideoDuration(input.duration)) {
    throw new StoryboardVideoError(
      409,
      'preflight_changed',
      'Varigheten er endret. Kontroller den nye forhåndsvisningen før start.',
    );
  }
  const preflight = await preflightStoryboardVideo(pool, {
    ...input,
    expectedSourceFingerprint: confirmed.sourceFingerprint,
    expectedBindingFingerprint: confirmed.bindingFingerprint,
  });
  const estimateIncreased = preflight.estimatedCostUsd
    > confirmed.maxEstimatedCostUsd + 0.000_001;
  if (confirmed.compilationFingerprint !== input.compilationFingerprint
      || confirmed.bindingFingerprint !== preflight.bindingFingerprint
      || confirmed.duration !== preflight.duration
      || confirmed.sourceFingerprint !== preflight.sourceFingerprint
      || estimateIncreased) {
    throw new StoryboardVideoError(
      409, 'preflight_changed',
      'Kilde, prompt eller pris er endret. Kontroller den nye forhåndsvisningen før start.',
    );
  }
  const model = providerFor(input.modelId);
  const duration = preflight.duration;
  const estimatedCostUsd = preflight.estimatedCostUsd;
  const sourceKey = preflight.sourceB2Key;
  const sourceUrl = preflight.sourceUrl;

  const settings = await getGenSettings(pool);
  const billedUsd = settings.billingMode === 'credits'
    ? estimatedCostUsd * settings.markupMultiplier : 0;
  let reservation = {
    userId: input.userId,
    model: model.key,
    billedUsd,
    billingMode: settings.billingMode as string,
  };
  let effectiveEstimatedCostUsd = estimatedCostUsd;
  let jobId = '';
  let resumeSubmitting = false;
  let resumePrepared = false;
  let higgsfieldCallbackToken: string | undefined;

  // Persist a durable outbox row while the final normalized + compat CAS is
  // locked. Higgsfield stays prepared until credits are reserved, then a
  // single CAS claimant changes it to submitting immediately before provider
  // IO. A crash before that claim is safely resumable; after it, never.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const authoritative = await client.query(
      `SELECT project_id, image_data, metadata, scene_id, frame_id, updated_at
         FROM casting_storyboards
        WHERE id = $1 AND project_id = $2
        FOR UPDATE`,
      [input.storyboard.id, input.projectId],
    );
    const row = authoritative.rows[0];
    if (!row) {
      throw new StoryboardVideoError(409, 'preflight_changed',
        'Storyboardet ble endret eller fjernet. Kjør forhåndskontrollen på nytt.');
    }
    const expectedUpdatedAt = new Date(input.storyboard.updatedAt).getTime();
    const currentUpdatedAt = new Date(row.updated_at).getTime();
    // Color intent is independent from Atmosphere. An Atmosphere-only edit
    // legitimately advances the normalized row token, while the locked final
    // source/motion/framing/Color binding below remains the authority. The
    // cumulative Atmosphere stage still requires the broad row token CAS.
    if (input.sourceStage === 'atmosphere'
        && (!Number.isFinite(expectedUpdatedAt)
          || !Number.isFinite(currentUpdatedAt)
          || currentUpdatedAt !== expectedUpdatedAt)) {
      throw new StoryboardVideoError(
        409, 'preflight_changed',
        'Kilde eller produksjonskontekst er endret. Kontroller på nytt før start.',
      );
    }
    const compatSource = await lockAndValidateStoryboardCompatSource(client, {
      storyboard: {
        ...input.storyboard,
        sceneId: row.scene_id ? String(row.scene_id) : null,
        frameId: row.frame_id ? String(row.frame_id) : null,
        metadata: row.metadata && typeof row.metadata === 'object'
          ? row.metadata : input.storyboard.metadata,
      },
      expectedSourceUpdatedAt: input.expectedCompatSourceUpdatedAt,
      expectedFramingFingerprint: input.expectedFramingFingerprint,
    });
    const finalMotionBinding = storyboardVideoMotionBindingV1(
      compatSource.frameDocument,
      input.expectedFramingFingerprint,
    );
    assertStoryboardVideoMotionMirror(row.metadata,
      compatSource.frameDocument, finalMotionBinding);
    const approvedBase = await client.query(
      `SELECT id,stage,image_data,metadata
         FROM storyboard_ai_image_versions
        WHERE id=$1 AND storyboard_id=$2 AND project_id=$3
          AND status='approved' AND stage=$4
        FOR SHARE`,
      [
        input.baseVersionId,
        input.storyboard.id,
        input.projectId,
        input.sourceStage,
      ],
    );
    const baseRow = approvedBase.rows[0];
    if (!baseRow) {
      throw new StoryboardVideoError(
        409,
        'animation_base_not_approved',
        'AI-basen ble erstattet etter forhåndskontrollen.',
      );
    }
    const finalSource = await validateStoryboardVideoSourceSnapshot({
      request: {
        sourceStage: input.sourceStage,
        baseVersionId: input.baseVersionId,
        paintoverComposite: input.paintoverComposite,
        shotFraming: input.shotFraming,
      },
      base: {
        id: String(baseRow.id),
        stage: String(baseRow.stage) as StoryboardVideoSourceStage,
        imageData: String(baseRow.image_data ?? ''),
        metadata: jsonObject(baseRow.metadata),
      },
      sourceRevision: storyboardSourceRevision(row.metadata),
      framingFingerprint: input.expectedFramingFingerprint,
      frameUpdatedAt: compatSource.frameUpdatedAt,
      sourceUpdatedAt: compatSource.sourceUpdatedAt,
      livePaintoverState: compatSource.paintoverState,
      mirroredPaintoverState: jsonObject(row.metadata).aiPaintoverState,
    });
    const finalGenerationBinding = makeStoryboardVideoGenerationBinding(
      finalSource.binding,
      finalMotionBinding,
    );
    const finalBindingFingerprint = storyboardVideoBindingFingerprintV1(
      finalGenerationBinding,
    );
    if (finalSource.sourceFingerprint !== preflight.sourceFingerprint
        || finalBindingFingerprint !== preflight.bindingFingerprint
        || finalBindingFingerprint
          !== input.confirmedPreflight.bindingFingerprint
        || canonicalJSONString(storyboardVideoPaidIdentityV1(
          finalGenerationBinding,
        )) !== canonicalJSONString(storyboardVideoPaidIdentityV1(
          preflight.generationBinding,
        ))) {
      throw new StoryboardVideoError(
        409,
        'preflight_changed',
        'Paintover-kilden ble endret etter forhåndskontrollen.',
      );
    }

    const duplicate = await client.query(
      `SELECT id,status,est_cost_usd,model,input,user_id,submit_started_at
         FROM storyboard_ai_video_jobs
        WHERE project_id=$1 AND storyboard_id=$2
          AND status IN (
            'prepared','submitting','submission_unknown',
            'accepted_contract_unknown','queued','running','processing'
          )
          AND model=$3
          AND input->>'sourceFingerprint'=$4
          AND input->>'compilationFingerprint'=$5
          AND CASE
                WHEN COALESCE(input->>'duration','') ~ '^[0-9]+$'
                  THEN (input->>'duration')::int
                ELSE 0
              END=$6
          AND input->>'sourceStage'=$7
          AND input->>'baseVersionId'=$8
          AND input->>'bindingFingerprint'=$9
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [
        input.projectId,
        input.storyboard.id,
        model.key,
        preflight.sourceFingerprint,
        input.compilationFingerprint,
        duration,
        finalSource.binding.sourceStage,
        finalSource.binding.baseVersionId,
        finalBindingFingerprint,
      ],
    );
    if (duplicate.rows[0]) {
      const existing = duplicate.rows[0];
      const existingStatus = String(existing.status);
      if (existingStatus === 'prepared' && model.provider === 'higgsfield') {
        const originalUserId = typeof existing.user_id === 'string'
          ? existing.user_id : '';
        if (!originalUserId || originalUserId !== input.userId) {
          await client.query('COMMIT');
          return {
            jobId: String(existing.id),
            status: 'prepared',
            estimatedCostUsd: Number(existing.est_cost_usd ?? estimatedCostUsd),
            model: String(existing.model ?? model.key),
            deduplicated: true,
          };
        }
        const storedInput = jsonObject(existing.input);
        const storedBillingMode = storedInput.billingMode;
        const storedBilledUsd = Number(storedInput.billedUsd);
        const storedModel = typeof existing.model === 'string'
          ? existing.model : '';
        const validBillingMode = storedBillingMode === 'free_whitelist'
          || storedBillingMode === 'metered'
          || storedBillingMode === 'credits';
        const validBilledUsd = Number.isFinite(storedBilledUsd)
          && storedBilledUsd >= 0
          && (storedBillingMode !== 'credits' || storedBilledUsd > 0);
        if (!validBillingMode || !validBilledUsd
            || !storedModel || storedModel !== model.key) {
          throw new StoryboardVideoError(
            409,
            'prepared_billing_invalid',
            'Den lagrede betalingsreservasjonen kan ikke verifiseres. Jobben ble ikke sendt.',
          );
        }
        jobId = String(existing.id);
        resumePrepared = true;
        effectiveEstimatedCostUsd = Number(existing.est_cost_usd);
        if (!Number.isFinite(effectiveEstimatedCostUsd)
            || effectiveEstimatedCostUsd < 0) {
          throw new StoryboardVideoError(
            409,
            'prepared_billing_invalid',
            'Den lagrede kostnaden kan ikke verifiseres. Jobben ble ikke sendt.',
          );
        }
        reservation = {
          userId: originalUserId,
          model: storedModel,
          billedUsd: storedBilledUsd,
          billingMode: storedBillingMode,
        };
        await client.query('COMMIT');
      } else if (existingStatus === 'submitting'
          && model.provider !== 'higgsfield') {
        jobId = String(existing.id);
        resumeSubmitting = true;
        await client.query('COMMIT');
      } else {
        let safeStatus = existingStatus;
        if (model.provider === 'higgsfield'
            && existingStatus === 'submitting') {
          const freshSubmit = storyboardVideoSubmittingIsWithinGrace(
            existing.submit_started_at,
          );
          if (!freshSubmit) {
            const parked = await client.query(
            `UPDATE storyboard_ai_video_jobs
                SET status='submission_unknown',
                    error=COALESCE(error,'higgsfield_submit_recovery_unknown')
              WHERE id=$1 AND status='submitting'
                AND (
                  submit_started_at IS NULL
                  OR submit_started_at <= NOW()-INTERVAL '2 minutes'
                )
              RETURNING status`,
              [existing.id],
            );
            if (parked.rowCount === 1) safeStatus = 'submission_unknown';
          }
        }
        await client.query('COMMIT');
        return {
          jobId: String(existing.id),
          status: safeStatus,
          estimatedCostUsd: Number(existing.est_cost_usd ?? estimatedCostUsd),
          model: String(existing.model ?? model.key),
          deduplicated: true,
        };
      }
    } else {
      // The storyboard row lock serializes every new paid generation. Stable
      // exact retries resume above; any other active identity must fail closed
      // so a status-only frame timestamp change cannot create a second job.
      const activeJob = await client.query(
        `SELECT id,status
           FROM storyboard_ai_video_jobs
          WHERE project_id=$1 AND storyboard_id=$2
            AND status IN (
              'prepared','submitting','submission_unknown',
              'accepted_contract_unknown','queued','running','processing'
            )
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE`,
        [input.projectId, input.storyboard.id],
      );
      if (activeJob.rows[0]) {
        throw new StoryboardVideoError(
          409,
          'animation_in_progress',
          'En annen animasjonsjobb er allerede aktiv for dette storyboardet.',
        );
      }
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('storyboard-ai-daily-cap'))",
      );
      const spent = await client.query(
        `SELECT
          COALESCE((SELECT SUM(est_cost_usd) FROM generative_ai_jobs
            WHERE created_at::date=NOW()::date),0)::float
          + COALESCE((SELECT SUM(est_cost_usd) FROM storyboard_ai_image_usage
            WHERE created_at::date=NOW()::date
              AND status IN ('reserved','completed')),0)::float
          + COALESCE((SELECT SUM(est_cost_usd) FROM storyboard_ai_video_jobs
            WHERE created_at::date=NOW()::date
              AND status NOT IN (
                'failed','rejected_retryable','failed_permanent','nsfw','canceled'
              )),0)::float
          AS spent`,
      );
      if (Number(spent.rows[0]?.spent ?? 0) + estimatedCostUsd
          > settings.dailyCapUsd) {
        throw new StoryboardVideoError(
          429, 'daily_cap', 'Det globale dagstaket for AI er nådd.',
        );
      }
      jobId = crypto.randomUUID();
      const sourceRevision = storyboardSourceRevision(row.metadata);
      await client.query(
       `INSERT INTO storyboard_ai_video_jobs
         (id,project_id,storyboard_id,user_id,user_email,model,kind,status,provider,
          input,source_asset_id,est_cost_usd)
       VALUES ($1,$2,$3,$4,$5,$6,'image-to-video',
         CASE WHEN $7='higgsfield' THEN 'prepared' ELSE 'submitting' END,
         $7,$8::jsonb,NULL,$9)`,
        [
          jobId, input.projectId, input.storyboard.id, input.userId,
          input.userEmail, model.key, model.provider, JSON.stringify({
            storyboardId: input.storyboard.id,
            prompt: input.compiledPrompt,
            duration,
            sourceB2Key: sourceKey,
            sourceFingerprint: preflight.sourceFingerprint,
            sourceBinding: finalSource.binding,
            generationBinding: finalGenerationBinding,
            bindingFingerprint: finalBindingFingerprint,
            sourceStage: finalSource.binding.sourceStage,
            baseVersionId: finalSource.binding.baseVersionId,
            paintoverFrameUpdatedAt: finalSource.binding.frameUpdatedAt,
            paintoverColorRevision: finalSource.binding.colorRevision,
            paintoverAtmosphereRevision: finalSource.binding.atmosphereRevision,
            paintoverColorFingerprint: finalSource.binding.colorFingerprint,
            paintoverAtmosphereFingerprint:
              finalSource.binding.atmosphereFingerprint,
            paintoverCompositeFingerprint:
              finalSource.binding.compositeFingerprint,
            compilationFingerprint: input.compilationFingerprint,
            compatSourceUpdatedAt: compatSource.sourceUpdatedAt,
            sourceRevision,
            framingFingerprint: input.expectedFramingFingerprint,
            billingMode: settings.billingMode,
            billedUsd,
            billingMarkupMultiplier: settings.markupMultiplier,
            creditsReserved: false,
          }),
          estimatedCostUsd,
        ],
      );
      await enqueueStoryboardVideoBillingSettlement(client, {
        jobId,
        kind: 'credit_debit',
        userId: input.userId,
        model: model.key,
        amountUsd: billedUsd,
        billingMode: settings.billingMode,
      });
      await persistSubmittingVideoHandle(client, {
        projectId: input.projectId,
        storyboardId: input.storyboard.id,
        jobId,
        model: model.key,
        sourceRevision,
        framingFingerprint: input.expectedFramingFingerprint,
        compatSource,
        sourceBinding: finalSource.binding,
        generationBinding: finalGenerationBinding,
        bindingFingerprint: finalBindingFingerprint,
      });
      await client.query('COMMIT');
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  await ensureStoryboardVideoCreditReservation(pool, {
    jobId,
    ...reservation,
  });

  if (model.provider === 'higgsfield') {
    higgsfieldCallbackToken = crypto.randomBytes(32).toString('hex');
    const callbackTokenHash = crypto.createHash('sha256')
      .update(higgsfieldCallbackToken)
      .digest('hex');
    const claimed = await pool.query(
      `UPDATE storyboard_ai_video_jobs
          SET status='submitting',error=NULL,submit_started_at=NOW(),
              callback_token_hash=$2,
              callback_token_expires_at=NOW()+INTERVAL '8 days',
              callback_token_revoked_at=NULL,
              updated_at=NOW()
        WHERE id=$1 AND status='prepared'
        RETURNING id`,
      [jobId, callbackTokenHash],
    );
    if (claimed.rowCount !== 1) {
      // Another request or a crashed predecessor crossed the provider-IO
      // boundary. From here acceptance is unknowable, so recovery parks the
      // job and must never issue another generation POST.
      const parked = await pool.query(
        `UPDATE storyboard_ai_video_jobs
            SET status='submission_unknown',
                error=COALESCE(error,'higgsfield_submit_recovery_unknown')
          WHERE id=$1 AND status='submitting'
            AND (
              submit_started_at IS NULL
              OR submit_started_at <= NOW()-INTERVAL '2 minutes'
            )
          RETURNING status`,
        [jobId],
      ).catch(() => undefined);
      const current = parked?.rowCount === 1
        ? { status: 'submission_unknown' }
        : (await pool.query(
          `SELECT status FROM storyboard_ai_video_jobs WHERE id=$1`,
          [jobId],
        ).catch(() => ({ rows: [] }))).rows[0];
      const recoveryStatus = String(current?.status || 'submitting');
      return {
        jobId,
        status: recoveryStatus,
        estimatedCostUsd: effectiveEstimatedCostUsd,
        model: model.key,
        recovered: true,
        deduplicated: true,
      };
    }
  }

  let requestId: string | undefined;
  let responseUrl: string | null | undefined;
  let cancelUrl: string | null | undefined;
  let providerStatus: string | undefined;
  let providerCorrelationId: string | undefined;
  let providerError: string | undefined;
  let submissionUnknown = false;
  let acceptedContractUnknown = false;
  let rejectionKind: 'retryable' | 'permanent' | 'unknown' | undefined;
  if (model.provider === 'higgsfield') {
    const submitted = await higgsfieldSubmit({
      imageUrl: sourceUrl,
      prompt: input.compiledPrompt,
      model: 'dop-turbo',
      webhookUrl: higgsfieldCallbackToken
        ? storyboardHiggsfieldWebhookUrl(higgsfieldCallbackToken)
        : undefined,
    });
    requestId = submitted.id;
    responseUrl = submitted.statusUrl;
    cancelUrl = submitted.cancelUrl;
    providerStatus = submitted.status;
    providerCorrelationId = submitted.correlationId;
    providerError = submitted.error;
    submissionUnknown = submitted.submissionUnknown === true;
    acceptedContractUnknown = submitted.acceptedContractUnknown === true;
    rejectionKind = submitted.rejectionKind;
  } else {
    const submitted = await falSubmit(model.falPath, {
      prompt: input.compiledPrompt,
      image_url: sourceUrl,
      duration: String(duration),
      resolution: '720p',
    }, jobId);
    requestId = submitted.requestId;
    responseUrl = submitted.responseUrl;
    providerError = submitted.error;
  }
  if (model.provider === 'higgsfield' && submissionUnknown) {
    await pool.query(
      `UPDATE storyboard_ai_video_jobs
          SET status='submission_unknown',error=$2,
              provider_correlation_id=COALESCE($3,provider_correlation_id),
              updated_at=NOW()
        WHERE id=$1 AND status='submitting'`,
      [
        jobId,
        providerError ?? 'higgsfield_submission_unknown',
        providerCorrelationId ?? null,
      ],
    ).catch(() => undefined);
    return {
      jobId,
      status: 'submission_unknown',
      estimatedCostUsd: effectiveEstimatedCostUsd,
      model: model.key,
    };
  }
  if (model.provider === 'higgsfield' && acceptedContractUnknown) {
    await pool.query(
      `UPDATE storyboard_ai_video_jobs
          SET status='accepted_contract_unknown',
              fal_request_id=$2,response_url=$3,
              provider_request_id=$2,provider_status_url=$3,
              provider_cancel_url=$4,provider_status=$5,
              provider_correlation_id=$6,error=$7,
              provider_accepted_at=NOW(),provider_status_updated_at=NOW(),
              updated_at=NOW()
        WHERE id=$1 AND status='submitting'`,
      [
        jobId,
        requestId ?? null,
        responseUrl ?? null,
        cancelUrl ?? null,
        providerStatus ?? null,
        providerCorrelationId ?? null,
        providerError ?? 'higgsfield_lifecycle_url_missing_or_invalid',
      ],
    );
    return {
      jobId,
      status: 'accepted_contract_unknown',
      estimatedCostUsd: effectiveEstimatedCostUsd,
      model: model.key,
    };
  }
  if (model.provider === 'higgsfield' && rejectionKind) {
    const rejectedStatus = rejectionKind === 'retryable'
      ? 'rejected_retryable' : 'failed_permanent';
    await persistStoryboardVideoSubmissionFailure(pool, {
      jobId,
      status: rejectedStatus,
      error: providerError ?? 'higgsfield_rejected',
      providerCorrelationId,
      expectedStatuses: ['submitting'],
      reservation,
    });
    return {
      jobId,
      status: rejectedStatus,
      error: providerError ?? 'higgsfield_rejected',
      estimatedCostUsd: effectiveEstimatedCostUsd,
      model: model.key,
    };
  }
  if (!requestId || providerError
      || (model.provider !== 'higgsfield' && !responseUrl)) {
    const ambiguousAcceptance = model.provider !== 'higgsfield'
      && (!providerError || providerError.includes('_submit_threw:'));
    if (ambiguousAcceptance) {
      // fal may have accepted the stable idempotency key before the connection
      // failed. Keep its outbox + reserved credits recoverable; this branch is
      // deliberately unreachable for Higgsfield.
      throw new StoryboardVideoError(
        503,
        'provider_submit_pending',
        'Leverandørsvaret er uavklart. Prøv samme handling på nytt.',
      );
    }
    await persistStoryboardVideoSubmissionFailure(pool, {
      jobId,
      status: 'failed',
      error: providerError ?? 'provider_submit_failed',
      providerCorrelationId,
      expectedStatuses: ['submitting', 'submission_unknown'],
      reservation,
    });
    throw new StoryboardVideoError(
      502, 'provider_submit_failed', 'Videoleverandøren avviste jobben.',
    );
  }
  await pool.query(
    `UPDATE storyboard_ai_video_jobs
        SET status=$4,fal_request_id=$2,response_url=$3,error=NULL,
            provider_request_id=CASE WHEN provider='higgsfield' THEN $2
              ELSE provider_request_id END,
            provider_status_url=CASE WHEN provider='higgsfield' THEN $3
              ELSE provider_status_url END,
            provider_cancel_url=CASE WHEN provider='higgsfield' THEN $5
              ELSE provider_cancel_url END,
            provider_status=CASE WHEN provider='higgsfield' THEN $6
              ELSE provider_status END,
            provider_correlation_id=CASE WHEN provider='higgsfield' THEN $7
              ELSE provider_correlation_id END,
            provider_accepted_at=CASE WHEN provider='higgsfield' THEN NOW()
              ELSE provider_accepted_at END,
            provider_status_updated_at=CASE WHEN provider='higgsfield' THEN NOW()
              ELSE provider_status_updated_at END,
            next_poll_at=CASE WHEN provider='higgsfield'
              THEN NOW() + INTERVAL '2 seconds' ELSE next_poll_at END,
            updated_at=NOW()
      WHERE id=$1 AND status IN ('submitting','submission_unknown')`,
    [
      jobId,
      requestId,
      responseUrl ?? null,
      model.provider === 'higgsfield' && providerStatus === 'in_progress'
        ? 'running' : 'queued',
      cancelUrl ?? null,
      providerStatus ?? null,
      providerCorrelationId ?? null,
    ],
  );
  return {
    jobId,
    status: model.provider === 'higgsfield' && providerStatus === 'in_progress'
      ? 'running' : 'queued',
    estimatedCostUsd: effectiveEstimatedCostUsd,
    model: model.key,
    ...((resumeSubmitting || resumePrepared)
      ? { recovered: true, deduplicated: true } : {}),
  };
}

function parseSceneBlob(value: unknown): Record<string, unknown>[] {
  const parsed = typeof value === 'string'
    ? (() => { try { return JSON.parse(value); } catch { return []; } })()
    : value;
  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    : [];
}
function nonnegativeInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value
    : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function storyboardVideoSourceBindingFromValue(
  value: unknown,
): StoryboardVideoSourceBinding | null {
  const raw = jsonObject(value);
  const sourceStage = raw.sourceStage === 'color' || raw.sourceStage === 'atmosphere'
    ? raw.sourceStage : null;
  const baseVersionId = typeof raw.baseVersionId === 'string'
    ? raw.baseVersionId : '';
  const frameUpdatedAt = typeof raw.frameUpdatedAt === 'string'
    ? raw.frameUpdatedAt : '';
  const sourceUpdatedAt = typeof raw.sourceUpdatedAt === 'string'
    ? raw.sourceUpdatedAt : '';
  const framingFingerprint = typeof raw.framingFingerprint === 'string'
    ? raw.framingFingerprint : '';
  const sourceRevision = nonnegativeInteger(raw.sourceRevision);
  const colorRevision = nonnegativeInteger(raw.colorRevision);
  const atmosphereRevision = nonnegativeInteger(raw.atmosphereRevision);
  const colorFingerprint = typeof raw.colorFingerprint === 'string'
    && /^[a-f0-9]{64}$/i.test(raw.colorFingerprint)
    ? raw.colorFingerprint.toLowerCase() : '';
  const atmosphereFingerprint = typeof raw.atmosphereFingerprint === 'string'
    && /^[a-f0-9]{64}$/i.test(raw.atmosphereFingerprint)
    ? raw.atmosphereFingerprint.toLowerCase() : '';
  const compositeFingerprint = raw.compositeFingerprint === null
    ? null
    : typeof raw.compositeFingerprint === 'string'
      && /^[a-f0-9]{32}$/i.test(raw.compositeFingerprint)
      ? raw.compositeFingerprint.toLowerCase() : undefined;
  if (!sourceStage || !baseVersionId || !frameUpdatedAt || !sourceUpdatedAt
      || !framingFingerprint || sourceRevision == null || colorRevision == null
      || atmosphereRevision == null || !colorFingerprint
      || !atmosphereFingerprint || compositeFingerprint === undefined
      || typeof raw.colorHasContent !== 'boolean'
      || typeof raw.atmosphereHasContent !== 'boolean') return null;
  return {
    sourceStage,
    baseVersionId,
    frameUpdatedAt,
    sourceUpdatedAt,
    sourceRevision,
    framingFingerprint,
    colorRevision,
    atmosphereRevision,
    colorFingerprint,
    atmosphereFingerprint,
    colorHasContent: raw.colorHasContent,
    atmosphereHasContent: raw.atmosphereHasContent,
    compositeFingerprint,
  };
}

function storyboardVideoMotionBindingFromValue(
  value: unknown,
): StoryboardVideoMotionBindingV1 | null {
  const raw = jsonObject(value);
  const cameraMotionRevision = safeNonnegativeInteger(
    raw.cameraMotionRevision,
  );
  const durationRevision = safeNonnegativeInteger(raw.durationRevision);
  const shotDuration = normalizeShotDurationV1(raw.shotDuration);
  const cameraMotionFingerprint = raw.cameraMotionFingerprint === null
    ? null
    : typeof raw.cameraMotionFingerprint === 'string'
      && /^sha256:[a-f0-9]{64}$/.test(raw.cameraMotionFingerprint)
      ? raw.cameraMotionFingerprint : undefined;
  const cameraMotionBaseFramingFingerprint =
    raw.cameraMotionBaseFramingFingerprint === null
      ? null
      : typeof raw.cameraMotionBaseFramingFingerprint === 'string'
        && raw.cameraMotionBaseFramingFingerprint.trim()
        ? raw.cameraMotionBaseFramingFingerprint : undefined;
  if (cameraMotionRevision == null || durationRevision == null || !shotDuration
      || raw.cameraMotionStatus !== 'valid'
      || cameraMotionFingerprint === undefined
      || cameraMotionBaseFramingFingerprint === undefined
      || (cameraMotionFingerprint === null)
        !== (cameraMotionBaseFramingFingerprint === null)
      || canonicalJSONString(shotDuration)
        !== canonicalJSONString(raw.shotDuration)) {
    return null;
  }
  return {
    cameraMotionRevision,
    cameraMotionFingerprint,
    cameraMotionStatus: 'valid',
    cameraMotionBaseFramingFingerprint,
    shotDuration,
    durationRevision,
  };
}

function storyboardVideoGenerationBindingFromJob(
  value: unknown,
): {
  binding: StoryboardVideoGenerationBindingV1;
  fingerprint: string;
} | null {
  const jobInput = jsonObject(value);
  const raw = jsonObject(jobInput.generationBinding);
  if (raw.version !== 1) return null;
  const source = storyboardVideoSourceBindingFromValue(raw.source);
  const motion = storyboardVideoMotionBindingFromValue(raw.motion);
  const mirroredSource = storyboardVideoSourceBindingFromValue(
    jobInput.sourceBinding,
  );
  if (!source || !motion || !mirroredSource
      || canonicalJSONString(source) !== canonicalJSONString(mirroredSource)) {
    return null;
  }
  const binding = makeStoryboardVideoGenerationBinding(source, motion);
  const fingerprint = storyboardVideoBindingFingerprintV1(binding);
  if (jobInput.bindingFingerprint !== fingerprint
      || canonicalJSONString(binding) !== canonicalJSONString(raw)) {
    return null;
  }
  return { binding, fingerprint };
}

function sourceBindingMatchesPaintover(
  binding: StoryboardVideoSourceBinding,
  value: unknown,
): boolean {
  const rawState = storyboardPaintoverBindingState(value);
  const state = rawState
    ? storyboardPaintoverBindingForStage(rawState, binding.sourceStage) : null;
  const expected: StoryboardPaintoverBindingState = {
    colorRevision: binding.colorRevision,
    atmosphereRevision: binding.atmosphereRevision,
    colorFingerprint: binding.colorFingerprint,
    atmosphereFingerprint: binding.atmosphereFingerprint,
    colorHasContent: binding.colorHasContent,
    atmosphereHasContent: binding.atmosphereHasContent,
  };
  const record = jsonObject(value);
  return Boolean(state
    && canonicalJSONString(state) === canonicalJSONString(expected)
    && (binding.sourceStage !== 'atmosphere'
      || record.atmosphereStale !== true));
}

function frameVideoSourceBindingMatches(
  frame: Record<string, unknown>,
  binding: StoryboardVideoGenerationBindingV1,
  bindingFingerprint: string,
  jobId: string,
): boolean {
  const source = binding.source;
  const composite = frame.aiVideoSourceCompositeFingerprint == null
    ? null : String(frame.aiVideoSourceCompositeFingerprint).toLowerCase();
  const motion = storyboardVideoMotionBindingFromValue({
    cameraMotionRevision: frame.aiVideoSourceMotionRevision,
    cameraMotionFingerprint: frame.aiVideoSourceMotionFingerprint,
    cameraMotionStatus: frame.aiVideoSourceMotionStatus,
    cameraMotionBaseFramingFingerprint:
      frame.aiVideoSourceMotionBaseFramingFingerprint,
    shotDuration: frame.aiVideoSourceShotDuration,
    durationRevision: frame.aiVideoSourceDurationRevision,
  });
  return Boolean(motion
    && canonicalJSONString(motion) === canonicalJSONString(binding.motion)
    && frame.aiVideoSourceBindingFingerprint === bindingFingerprint
    && String(frame.aiVideoJobId ?? '') === jobId
    && frame.aiVideoSourceFrameUpdatedAt === source.frameUpdatedAt
    && frame.aiVideoSourceBaseVersionId === source.baseVersionId
    && frame.aiVideoSourceStage === source.sourceStage
    && nonnegativeInteger(frame.aiVideoSourceRevision) === source.sourceRevision
    && frame.aiVideoSourceUpdatedAt === source.sourceUpdatedAt
    && frame.aiVideoSourceFramingFingerprint === source.framingFingerprint
    && nonnegativeInteger(frame.aiVideoSourceColorRevision) === source.colorRevision
    && nonnegativeInteger(frame.aiVideoSourceAtmosphereRevision)
      === source.atmosphereRevision
    && String(frame.aiVideoSourceColorFingerprint ?? '').toLowerCase()
      === source.colorFingerprint
    && String(frame.aiVideoSourceAtmosphereFingerprint ?? '').toLowerCase()
      === source.atmosphereFingerprint
    && frame.aiVideoSourceColorHasContent === source.colorHasContent
    && frame.aiVideoSourceAtmosphereHasContent === source.atmosphereHasContent
    && composite === source.compositeFingerprint);
}

async function adoptCompletedVideoIfCurrent(
  client: PoolClient,
  input: {
    job: Record<string, any>;
    projectId: string;
    storyboardId: string;
    providerUrl: string;
    outputKey: string | null;
  },
): Promise<boolean> {
  const persistedBinding = storyboardVideoGenerationBindingFromJob(input.job.input);
  if (!persistedBinding) return false;
  const generationBinding = persistedBinding.binding;
  const binding = generationBinding.source;
  const motionBinding = generationBinding.motion;
  const bindingFingerprint = persistedBinding.fingerprint;
  const expectedSourceUpdatedAt = binding.sourceUpdatedAt;
  const expectedFramingFingerprint = binding.framingFingerprint;
  const expectedSourceRevision = binding.sourceRevision;

  const selected = await client.query(
    `SELECT id,project_id,scene_id,frame_id,metadata
       FROM casting_storyboards
      WHERE id=$1 AND project_id=$2 FOR UPDATE`,
    [input.storyboardId, input.projectId],
  );
  const row = selected.rows[0];
  const metadata = jsonObject(row?.metadata);
  if (!row || storyboardSourceRevision(metadata) !== expectedSourceRevision
      || metadata.currentFramingFingerprint !== expectedFramingFingerprint
      || (metadata.compatSourceUpdatedAt ?? metadata.compatFrameUpdatedAt)
        !== expectedSourceUpdatedAt) return false;
  const activeVideo = jsonObject(metadata.aiVideo);
  const activeMotion = storyboardVideoMotionBindingFromValue(activeVideo);
  if (String(activeVideo.jobId ?? '') !== String(input.job.id)
      || activeVideo.bindingFingerprint !== bindingFingerprint
      || !activeMotion
      || canonicalJSONString(activeMotion)
        !== canonicalJSONString(motionBinding)
      || !sourceBindingMatchesPaintover(binding, metadata.aiPaintoverState)) {
    return false;
  }
  const selectedBase = await client.query(
    `SELECT metadata FROM storyboard_ai_image_versions
      WHERE id=$1 AND storyboard_id=$2 AND project_id=$3
        AND stage=$4 AND status='approved'
      FOR SHARE`,
    [
      binding.baseVersionId,
      input.storyboardId,
      input.projectId,
      binding.sourceStage,
    ],
  );
  const baseMetadata = jsonObject(selectedBase.rows[0]?.metadata);
  const baseSourceUpdatedAt = baseMetadata.compatSourceUpdatedAt
    ?? baseMetadata.compatFrameUpdatedAt;
  if (!selectedBase.rows[0]
      || Number(baseMetadata.sourceRevision) !== binding.sourceRevision
      || baseMetadata.framingFingerprint !== binding.framingFingerprint
      || baseSourceUpdatedAt !== binding.sourceUpdatedAt) {
    return false;
  }

  let compatSource;
  try {
    compatSource = await lockAndValidateStoryboardCompatSource(client, {
      storyboard: {
        id: input.storyboardId,
        projectId: input.projectId,
        sceneId: row.scene_id ? String(row.scene_id) : null,
        frameId: row.frame_id ? String(row.frame_id) : null,
        metadata,
      } as Storyboard,
      expectedSourceUpdatedAt,
      expectedFramingFingerprint,
    });
  } catch (error) {
    if (error instanceof StoryboardAIImageStageError && error.status === 409) {
      return false;
    }
    throw error;
  }
  let currentMotionBinding: StoryboardVideoMotionBindingV1;
  try {
    currentMotionBinding = storyboardVideoMotionBindingV1(
      compatSource.frameDocument,
      expectedFramingFingerprint,
    );
    assertStoryboardVideoMotionMirror(
      metadata, compatSource.frameDocument, currentMotionBinding,
    );
  } catch (error) {
    if (error instanceof StoryboardVideoError) return false;
    throw error;
  }
  if (canonicalJSONString(currentMotionBinding)
      !== canonicalJSONString(motionBinding)) return false;


  const storeKey = `casting:scenes:${compatSource.manuscriptId}`;
  const selectedCompat = await client.query(
    `SELECT store_value FROM legacy_compat_store WHERE store_key=$1 FOR UPDATE`,
    [storeKey],
  );
  const scenes = parseSceneBlob(selectedCompat.rows[0]?.store_value);
  const sceneIndex = scenes.findIndex((scene) => scene.id === compatSource.sceneId);
  const scene = sceneIndex >= 0 ? scenes[sceneIndex] : null;
  const frames = Array.isArray(scene?.storyboardFrames)
    ? (scene.storyboardFrames as Record<string, unknown>[]) : [];
  const frameIndex = frames.findIndex((frame) => frame?.id === compatSource.frameId);
  if (!scene || frameIndex < 0) return false;
  const frame = frames[frameIndex];
  if (!frameVideoSourceBindingMatches(
    frame, generationBinding, bindingFingerprint, String(input.job.id))
      || !sourceBindingMatchesPaintover(binding, frame.aiPaintoverState)) {
    return false;
  }
  const adoptedPaintoverState = {
    ...jsonObject(frame.aiPaintoverState),
    videoStale: false,
  };
  const currentTimestamp = Date.parse(String(frame.updatedAt ?? ''));
  const adoptedAt = new Date(Math.max(
    Date.now(), Number.isFinite(currentTimestamp) ? currentTimestamp + 1 : 0,
  )).toISOString();
  const nextFrames = frames.slice();
  nextFrames[frameIndex] = {
    ...frame,
    aiPaintoverState: adoptedPaintoverState,
    aiVideoJobId: String(input.job.id),
    aiVideoStatus: 'completed',
    aiVideoModel: String(input.job.model),
    aiVideoURL: input.providerUrl,
    aiVideoArchiveKey: input.outputKey,
    aiVideoSourceFramingFingerprint: expectedFramingFingerprint,
    aiVideoSourceRevision: expectedSourceRevision,
    aiVideoSourceUpdatedAt: expectedSourceUpdatedAt,
    aiStoryboardId: input.storyboardId,
    sourceUpdatedAt: expectedSourceUpdatedAt,
    updatedAt: adoptedAt,
  };
  const nextScenes = scenes.slice();
  nextScenes[sceneIndex] = {
    ...scene,
    storyboardFrames: nextFrames,
    updatedAt: adoptedAt,
  };
  const compatUpdate = await client.query(
    `UPDATE legacy_compat_store SET store_value=$2::jsonb,updated_at=NOW()
      WHERE store_key=$1`,
    [storeKey, JSON.stringify(nextScenes)],
  );
  if (compatUpdate.rowCount !== 1) return false;
  await client.query(
    `UPDATE legacy_compat_store
        SET store_value=jsonb_set(
          store_value,'{version}',to_jsonb(
            CASE WHEN COALESCE(store_value->>'version','') ~ '^[0-9]+$'
              THEN (store_value->>'version')::bigint + 1 ELSE 1 END),true),
            updated_at=NOW()
      WHERE store_key=$1`,
    [`casting:manuscript:${compatSource.manuscriptId}`],
  );
  await client.query(
    `UPDATE casting_storyboards
        SET metadata=COALESCE(metadata,'{}'::jsonb) || $1::jsonb,updated_at=NOW()
      WHERE id=$2 AND project_id=$3`,
    [JSON.stringify({
      aiVideo: {
        jobId: input.job.id,
        model: input.job.model,
        generatedAt: adoptedAt,
        outputB2Key: input.outputKey,
        baseVersionId: binding.baseVersionId,
        sourceStage: binding.sourceStage,
        frameUpdatedAt: binding.frameUpdatedAt,
        colorRevision: binding.colorRevision,
        atmosphereRevision: binding.atmosphereRevision,
        colorFingerprint: binding.colorFingerprint,
        atmosphereFingerprint: binding.atmosphereFingerprint,
        compositeFingerprint: binding.compositeFingerprint,
        sourceRevision: expectedSourceRevision,
        sourceUpdatedAt: expectedSourceUpdatedAt,
        framingFingerprint: expectedFramingFingerprint,
        bindingFingerprint,
        cameraMotionRevision: motionBinding.cameraMotionRevision,
        cameraMotionFingerprint: motionBinding.cameraMotionFingerprint,
        cameraMotionStatus: motionBinding.cameraMotionStatus,
        cameraMotionBaseFramingFingerprint:
          motionBinding.cameraMotionBaseFramingFingerprint,
        shotDuration: motionBinding.shotDuration,
        durationRevision: motionBinding.durationRevision,
      },
      aiPaintoverState: adoptedPaintoverState,
      compatFrameUpdatedAt: adoptedAt,
      compatSourceUpdatedAt: expectedSourceUpdatedAt,
    }), input.storyboardId, input.projectId],
  );
  return true;
}

/**
 * A completed provider result can no longer be attached when its source CAS is
 * stale. Keep the archive on the job, but retire the exact submitting handle
 * from the compat frame so clients do not display it as queued forever. The
 * job-id check prevents an older completion from clearing a newer video job,
 * and this path deliberately leaves every source/camera field untouched.
 */
async function markStaleCompletedVideoArchived(
  client: PoolClient,
  input: {
    jobId: string;
    projectId: string;
    storyboardId: string;
    outputKey: string | null;
  },
): Promise<boolean> {
  const selectedStoryboard = await client.query(
    `SELECT scene_id,frame_id
       FROM casting_storyboards
      WHERE id=$1 AND project_id=$2`,
    [input.storyboardId, input.projectId],
  );
  const sceneId = selectedStoryboard.rows[0]?.scene_id
    ? String(selectedStoryboard.rows[0].scene_id) : '';
  const frameId = selectedStoryboard.rows[0]?.frame_id
    ? String(selectedStoryboard.rows[0].frame_id) : '';
  if (!sceneId || !frameId) return false;

  const selectedScene = await client.query(
    `SELECT manuscript_id FROM casting_scenes
      WHERE id=$1 AND project_id=$2 LIMIT 1`,
    [sceneId, input.projectId],
  );
  const manuscriptId = selectedScene.rows[0]?.manuscript_id
    ? String(selectedScene.rows[0].manuscript_id) : '';
  if (!manuscriptId) return false;
  const storeKey = `casting:scenes:${manuscriptId}`;
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [storeKey],
  );
  const selectedCompat = await client.query(
    `SELECT store_value FROM legacy_compat_store WHERE store_key=$1 FOR UPDATE`,
    [storeKey],
  );
  const scenes = parseSceneBlob(selectedCompat.rows[0]?.store_value);
  const sceneIndex = scenes.findIndex((scene) => scene.id === sceneId);
  const scene = sceneIndex >= 0 ? scenes[sceneIndex] : null;
  const frames = Array.isArray(scene?.storyboardFrames)
    ? (scene.storyboardFrames as Record<string, unknown>[]) : [];
  const frameIndex = frames.findIndex((frame) => frame?.id === frameId);
  if (!scene || frameIndex < 0) return false;
  const frame = frames[frameIndex];
  if (String(frame.aiVideoJobId ?? '') !== input.jobId) return false;

  const currentTimestamp = Date.parse(String(frame.updatedAt ?? ''));
  const updatedAt = new Date(Math.max(
    Date.now(), Number.isFinite(currentTimestamp) ? currentTimestamp + 1 : 0,
  )).toISOString();
  const nextFrames = frames.slice();
  nextFrames[frameIndex] = {
    ...frame,
    aiVideoStatus: input.outputKey
      ? 'completed-archived' : 'completed-pending-archive',
    aiVideoURL: null,
    aiVideoArchiveKey: input.outputKey,
    updatedAt,
  };
  const nextScenes = scenes.slice();
  nextScenes[sceneIndex] = {
    ...scene,
    storyboardFrames: nextFrames,
    updatedAt,
  };
  const updated = await client.query(
    `UPDATE legacy_compat_store SET store_value=$2::jsonb,updated_at=NOW()
      WHERE store_key=$1`,
    [storeKey, JSON.stringify(nextScenes)],
  );
  if (updated.rowCount !== 1) return false;
  await client.query(
    `UPDATE legacy_compat_store
        SET store_value=jsonb_set(
          store_value,'{version}',to_jsonb(
            CASE WHEN COALESCE(store_value->>'version','') ~ '^[0-9]+$'
              THEN (store_value->>'version')::bigint + 1 ELSE 1 END),true),
            updated_at=NOW()
      WHERE store_key=$1`,
    [`casting:manuscript:${manuscriptId}`],
  );
  return true;
}

async function settleCompletedVideo(
  pool: Pool,
  input: {
    job: Record<string, any>;
    projectId: string;
    storyboardId: string;
    providerUrl: string;
    outputKey: string | null;
    providerCorrelationId?: string;
  },
): Promise<{ claimed: boolean; adopted: boolean }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT * FROM storyboard_ai_video_jobs
        WHERE id=$1 AND project_id=$2 AND storyboard_id=$3 FOR UPDATE`,
      [input.job.id, input.projectId, input.storyboardId],
    );
    const current = locked.rows[0];
    if (!current || current.status === 'completed') {
      await client.query('COMMIT');
      return {
        claimed: false,
        adopted: jsonObject(current?.input).adoptionStatus === 'adopted',
      };
    }
    if (!['queued', 'running', 'processing'].includes(String(current.status))) {
      await client.query('COMMIT');
      return { claimed: false, adopted: false };
    }
    const adopted = await adoptCompletedVideoIfCurrent(client, {
      ...input,
      job: current,
    });
    if (!adopted) {
      await markStaleCompletedVideoArchived(client, {
        jobId: String(current.id),
        projectId: input.projectId,
        storyboardId: input.storyboardId,
        outputKey: input.outputKey,
      });
    }
    await client.query(
      `UPDATE storyboard_ai_video_jobs
          SET status='completed',output_b2_key=$1,output_url_temp=$2,
              input=COALESCE(input,'{}'::jsonb) || $4::jsonb,completed_at=NOW(),
              provider_status=CASE WHEN provider='higgsfield'
                THEN 'completed' ELSE provider_status END,
              provider_correlation_id=CASE WHEN provider='higgsfield'
                THEN COALESCE($5,provider_correlation_id)
                ELSE provider_correlation_id END,
              provider_status_updated_at=CASE WHEN provider='higgsfield'
                THEN NOW() ELSE provider_status_updated_at END,
              provider_terminal_at=CASE WHEN provider='higgsfield'
                THEN NOW() ELSE provider_terminal_at END,
              last_polled_at=CASE WHEN provider='higgsfield'
                THEN NOW() ELSE last_polled_at END,
              last_poll_error=CASE WHEN provider='higgsfield'
                THEN NULL ELSE last_poll_error END,
              poll_attempts=CASE WHEN provider='higgsfield'
                THEN COALESCE(poll_attempts,0)+1 ELSE poll_attempts END,
              next_poll_at=NULL,
              archive_status=CASE WHEN $1::text IS NULL
                THEN 'pending' ELSE 'archived' END,
              archive_next_attempt_at=CASE WHEN $1::text IS NULL
                THEN NOW() ELSE NULL END,
              archive_deadline_at=CASE WHEN $1::text IS NULL
                THEN NOW()+INTERVAL '6 days' ELSE NULL END,
              archived_at=CASE WHEN $1::text IS NULL THEN NULL ELSE NOW() END,
              callback_token_revoked_at=CASE WHEN provider='higgsfield'
                THEN NOW() ELSE callback_token_revoked_at END,
              updated_at=NOW()
        WHERE id=$3`,
      [
        input.outputKey,
        input.outputKey ? null : input.providerUrl,
        current.id,
        JSON.stringify({ adoptionStatus: adopted ? 'adopted' : 'source-stale' }),
        input.providerCorrelationId ?? null,
      ],
    );
    const billing = jsonObject(current.input);
    const markupMultiplier = Number(billing.billingMarkupMultiplier ?? 1);
    await enqueueStoryboardVideoBillingSettlement(client, {
      jobId: String(current.id),
      kind: 'meter',
      userId: String(current.user_id ?? ''),
      model: String(current.model ?? ''),
      amountUsd: Number(current.est_cost_usd ?? 0)
        * (Number.isFinite(markupMultiplier) && markupMultiplier > 0
          ? markupMultiplier : 1),
      billingMode: String(billing.billingMode ?? ''),
    });
    await client.query('COMMIT');
    return { claimed: true, adopted };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function pollStoryboardVideo(
  pool: Pool,
  input: { projectId: string; storyboardId: string; jobId: string; fetchImpl?: typeof fetch },
) {
  await ensureVideoSchema(pool);
  const result = await pool.query(
    `SELECT * FROM storyboard_ai_video_jobs
      WHERE id = $1 AND project_id = $2 AND storyboard_id = $3`,
    [input.jobId, input.projectId, input.storyboardId],
  ).catch(() => ({ rows: [] }));
  const job = result.rows[0];
  if (!job || job.input?.storyboardId !== input.storyboardId) {
    throw new StoryboardVideoError(404, 'not_found', 'Animasjonsjobben finnes ikke.');
  }
  if (job.status === 'completed') {
    const outputUrl = job.output_b2_key
      ? await presignRoleRoomB2Download(job.output_b2_key, undefined, 3600)
      : job.output_url_temp;
    return {
      status: 'completed', outputUrl, model: job.model,
      sourceCurrent: jsonObject(job.input).adoptionStatus === 'adopted',
    };
  }
  if ([
    'failed', 'failed_permanent', 'rejected_retryable',
    'nsfw', 'canceled',
  ].includes(String(job.status))) {
    return { status: job.status, error: job.error, model: job.model };
  }
  if (job.status === 'prepared'
      || job.status === 'submission_unknown'
      || job.status === 'accepted_contract_unknown'
      || job.status === 'submitting') {
    return { status: job.status, error: job.error, model: job.model };
  }

  let providerStatus: string;
  let providerLifecycleStatus: string | undefined;
  let providerRequestId: string | undefined;
  let providerCorrelationId: string | undefined;
  let providerError: string | undefined;
  let providerUrl: string | null | undefined;
  if (job.provider === 'higgsfield') {
    const providerStatusUrl = job.provider_status_url || job.response_url;
    if (!providerStatusUrl) {
      await pool.query(
        `UPDATE storyboard_ai_video_jobs
            SET status='accepted_contract_unknown',
                error='higgsfield_status_url_missing',
                next_poll_at=NULL,updated_at=NOW()
          WHERE id=$1 AND status IN ('queued','running','processing')`,
        [job.id],
      ).catch(() => undefined);
      return {
        status: 'accepted_contract_unknown',
        error: 'higgsfield_status_url_missing',
        model: job.model,
      };
    }
    const providerResult = await higgsfieldPoll(providerStatusUrl);
    if (providerResult.status === 'RETRYABLE_ERROR') {
      await pool.query(
        `UPDATE storyboard_ai_video_jobs
            SET error=$2,provider_correlation_id=COALESCE($3,provider_correlation_id),
                poll_attempts=COALESCE(poll_attempts,0)+1,
                last_polled_at=NOW(),last_poll_error=$2,
                next_poll_at=NOW()+INTERVAL '10 seconds',
                updated_at=NOW()
          WHERE id=$1 AND status IN ('queued','running','processing')`,
        [
          job.id,
          providerResult.error ?? 'higgsfield_poll_retryable',
          providerResult.correlationId ?? null,
        ],
      ).catch(() => undefined);
      return {
        status: job.status === 'queued' ? 'queued' : 'running',
        error: providerResult.error,
        model: job.model,
      };
    }
    if (providerResult.status === 'CONTRACT_UNKNOWN'
        || providerResult.status === 'POLLING_BLOCKED') {
      await pool.query(
        `UPDATE storyboard_ai_video_jobs
            SET status='accepted_contract_unknown',error=$2,
                provider_correlation_id=COALESCE($3,provider_correlation_id),
                provider_status=COALESCE($4,provider_status),
                provider_status_updated_at=CASE WHEN $4::text IS NULL
                  THEN provider_status_updated_at ELSE NOW() END,
                provider_terminal_at=CASE
                  WHEN $4::text IN ('completed','failed','nsfw','canceled')
                  THEN NOW() ELSE provider_terminal_at END,
                last_polled_at=NOW(),last_poll_error=$2,next_poll_at=NULL,
                updated_at=NOW()
          WHERE id=$1 AND status IN ('queued','running','processing')`,
        [
          job.id,
          providerResult.error ?? 'higgsfield_poll_contract_unknown',
          providerResult.correlationId ?? null,
          providerResult.providerStatus ?? null,
        ],
      );
      return {
        status: 'accepted_contract_unknown',
        error: providerResult.error,
        model: job.model,
      };
    }
    providerStatus = providerResult.status;
    providerLifecycleStatus = providerResult.providerStatus;
    providerRequestId = providerResult.requestId;
    providerCorrelationId = providerResult.correlationId;
    providerError = providerResult.error;
    providerUrl = providerResult.outputUrl;
    const providerTerminal = ['completed', 'failed', 'nsfw', 'canceled']
      .includes(String(providerResult.providerStatus));
    if (providerTerminal && providerRequestId && providerLifecycleStatus) {
      await persistStoryboardVideoProviderEvent(pool, {
        jobId: String(job.id),
        provider: 'higgsfield',
        providerRequestId,
        providerStatus: providerLifecycleStatus as
          'completed' | 'failed' | 'nsfw' | 'canceled',
        providerCorrelationId,
        outputUrl: providerUrl,
        error: providerError,
      });
    }
    if (!providerTerminal) {
      await pool.query(
        `UPDATE storyboard_ai_video_jobs
            SET provider_status=COALESCE($2,provider_status),
                provider_correlation_id=COALESCE($3,provider_correlation_id),
                provider_status_updated_at=NOW(),last_polled_at=NOW(),
                last_poll_error=NULL,poll_attempts=COALESCE(poll_attempts,0)+1,
                updated_at=NOW()
          WHERE id=$1
            AND status IN ('queued','running','processing')
            AND (provider_status IS NULL
              OR provider_status IN ('queued','in_progress'))`,
        [
          job.id,
          providerResult.providerStatus ?? null,
          providerResult.correlationId ?? null,
        ],
      );
    }
  } else {
    const providerResult = await falPoll(job.response_url);
    providerStatus = providerResult.status;
    providerError = providerResult.error;
    providerUrl = falOutputUrl(providerResult.result).url;
  }
  if (providerStatus === 'ERROR') {
    const terminalStatus = job.provider === 'higgsfield'
      && providerLifecycleStatus === 'nsfw' ? 'nsfw'
      : job.provider === 'higgsfield' && providerLifecycleStatus === 'canceled'
        ? 'canceled' : 'failed';
    const terminalClient = await pool.connect();
    let transitioned: Record<string, any> | undefined;
    try {
      await terminalClient.query('BEGIN');
      const terminalTransition = await terminalClient.query(
        `UPDATE storyboard_ai_video_jobs
            SET status=$1,error=$2,next_poll_at=NULL,
                provider_status=$4,provider_terminal_at=NOW(),
                provider_status_updated_at=NOW(),
                provider_correlation_id=COALESCE($5,provider_correlation_id),
                last_polled_at=NOW(),last_poll_error=NULL,
                poll_attempts=COALESCE(poll_attempts,0)+1,
                callback_token_revoked_at=NOW(),
                updated_at=NOW()
          WHERE id=$3
            AND status IN ('queued','running','processing')
            AND (provider_status IS NULL
              OR provider_status IN ('queued','in_progress'))
          RETURNING id,user_id,model,input`,
        [
          terminalStatus,
          providerError ?? 'provider_error',
          job.id,
          providerLifecycleStatus,
          providerCorrelationId ?? null,
        ],
      );
      transitioned = terminalTransition.rows[0];
      if (transitioned) {
        const billing = jsonObject(transitioned.input);
        await enqueueStoryboardVideoBillingSettlement(terminalClient, {
          jobId: String(transitioned.id),
          kind: 'credit_refund',
          userId: String(transitioned.user_id ?? ''),
          model: String(transitioned.model ?? ''),
          amountUsd: Number(billing.billedUsd ?? 0),
          billingMode: String(billing.billingMode ?? ''),
        });
      }
      await terminalClient.query('COMMIT');
    } catch (error) {
      await terminalClient.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      terminalClient.release();
    }
    if (!transitioned) {
      const current = (await pool.query(
        `SELECT status,error,model FROM storyboard_ai_video_jobs WHERE id=$1`,
        [job.id],
      ).catch(() => ({ rows: [] }))).rows[0];
      return {
        status: current?.status ?? job.status,
        error: current?.error,
        model: current?.model ?? job.model,
      };
    }
    await deliverStoryboardVideoBillingSettlementNow(pool, {
      jobId: String(job.id),
      kind: 'credit_refund',
    }).catch(() => 'retrying');
    if (job.provider === 'higgsfield'
        && providerRequestId && providerLifecycleStatus) {
      await markStoryboardVideoProviderEventProcessed(pool, {
        provider: 'higgsfield',
        providerRequestId,
        providerStatus: providerLifecycleStatus,
      });
    }
    return { status: terminalStatus, error: providerError, model: job.model };
  }
  if (providerStatus !== 'COMPLETED') {
    const activeStatus = providerStatus === 'QUEUED' ? 'queued' : 'running';
    await pool.query(
      `UPDATE storyboard_ai_video_jobs
          SET status=$2,error=NULL,next_poll_at=NOW()+INTERVAL '2 seconds',
              updated_at=NOW()
        WHERE id=$1
          AND status IN ('queued','running','processing')
          AND (provider_status IS NULL
            OR provider_status IN ('queued','in_progress'))`,
      [job.id, activeStatus],
    )
      .catch(() => undefined);
    return { status: activeStatus, model: job.model };
  }
  if (!providerUrl) throw new StoryboardVideoError(502, 'no_output', 'Leverandøren returnerte ingen video.');
  if (!trustedStoryboardVideoOutputUrl(providerUrl)) {
    if (job.provider === 'higgsfield') {
      await pool.query(
        `UPDATE storyboard_ai_video_jobs
            SET status='accepted_contract_unknown',
                error='untrusted_output_url',next_poll_at=NULL,
                updated_at=NOW()
          WHERE id=$1 AND status IN ('queued','running','processing')`,
        [job.id],
      ).catch(() => undefined);
      return {
        status: 'accepted_contract_unknown',
        error: 'untrusted_output_url',
        model: job.model,
      };
    }
    const billing = jsonObject(job.input);
    await persistStoryboardVideoSubmissionFailure(pool, {
      jobId: String(job.id),
      status: 'failed',
      error: 'untrusted_output_url',
      expectedStatuses: ['queued', 'running', 'processing'],
      reservation: {
        userId: String(job.user_id ?? ''),
        model: String(job.model ?? ''),
        billedUsd: Number(billing.billedUsd ?? 0),
        billingMode: String(billing.billingMode ?? ''),
      },
    });
    throw new StoryboardVideoError(502, 'untrusted_output_url',
      'Leverandøren returnerte en ukjent output-adresse.');
  }
  // Provider completion is settled before any media download. A separate
  // leased archive worker owns the bounded GET+B2 transfer, which prevents
  // concurrent client polls from amplifying egress or racing terminal state.
  const outputKey: string | null = null;
  const playbackUrl = providerUrl;
  // Job settlement and conditional frame/normalized adoption share one DB
  // transaction. A completed provider result is always archived, but it is
  // attached to the current shot only while the submit-time source CAS holds.
  const completion = await settleCompletedVideo(pool, {
    job,
    projectId: input.projectId,
    storyboardId: input.storyboardId,
    providerUrl: playbackUrl,
    outputKey,
    providerCorrelationId,
  });
  if (!completion.claimed) {
    const settled = await pool.query(
      `SELECT status,model,output_b2_key,output_url_temp,input
         FROM storyboard_ai_video_jobs WHERE id=$1 AND project_id=$2 AND storyboard_id=$3`,
      [job.id, input.projectId, input.storyboardId],
    );
    const current = settled.rows[0];
    if (!current || current.status !== 'completed') {
      return { status: current?.status ?? 'running', model: current?.model ?? job.model };
    }
    if (job.provider === 'higgsfield'
        && providerRequestId && providerLifecycleStatus) {
      await markStoryboardVideoProviderEventProcessed(pool, {
        provider: 'higgsfield',
        providerRequestId,
        providerStatus: providerLifecycleStatus,
      });
    }
    return {
      status: 'completed', model: current.model,
      sourceCurrent: jsonObject(current.input).adoptionStatus === 'adopted',
      outputUrl: current.output_b2_key
        ? await presignRoleRoomB2Download(current.output_b2_key, undefined, 3600)
        : current.output_url_temp,
    };
  }
  if (job.provider === 'higgsfield'
      && providerRequestId && providerLifecycleStatus) {
    await markStoryboardVideoProviderEventProcessed(pool, {
      provider: 'higgsfield',
      providerRequestId,
      providerStatus: providerLifecycleStatus,
    });
  }
  return {
    status: 'completed', model: job.model,
    sourceCurrent: completion.adopted,
    outputUrl: playbackUrl,
  };
}
