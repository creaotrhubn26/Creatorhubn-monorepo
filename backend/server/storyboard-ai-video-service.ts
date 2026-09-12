import crypto from 'node:crypto';
import type { Pool } from 'pg';
import {
  GEN_MODELS,
  aiAllowed,
  emitGenAiMeter,
  falConfigured,
  falOutputUrl,
  falPoll,
  falSubmit,
  getGenSettings,
  higgsfieldEstimate,
  higgsfieldConfigured,
  higgsfieldPoll,
  higgsfieldSubmit,
} from './generative-media.js';
import { creditMove, getUserCredits } from './ai-credits.js';
import { archiveToRoleRoomB2, presignRoleRoomB2Download } from './b2-archive-helper.js';
import type { Storyboard } from './storyboard-service.js';

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
}

async function ensureVideoSchema(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS storyboard_ai_video_jobs (
    id uuid PRIMARY KEY, project_id varchar NOT NULL, storyboard_id uuid NOT NULL,
    user_id varchar, user_email varchar,
    model varchar, kind varchar, status varchar DEFAULT 'queued', provider varchar,
    fal_request_id varchar, response_url text, input jsonb, source_asset_id uuid,
    output_b2_key text, output_url_temp text, est_cost_usd numeric DEFAULT 0,
    error text, created_at timestamptz DEFAULT now(), completed_at timestamptz)`).catch(() => undefined);
  await pool.query(`CREATE TABLE IF NOT EXISTS project_ai_consent (
    project_id varchar PRIMARY KEY, consented boolean DEFAULT false,
    consented_by varchar, consented_at timestamptz)`).catch(() => undefined);
}

function providerFor(modelId: string) {
  const key = modelId === 'higgsfield-dop-i2v'
    ? 'higgsfield-dop-i2v' : 'seedance-2-i2v';
  return GEN_MODELS[key];
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
  const duration = Math.min(15, Math.max(4, Math.round(input.duration || 5)));
  const source = decodeStoryboardImage(input.storyboard.imageData);
  const sourceFingerprint = crypto.createHash('sha256').update(source.bytes).digest('hex').slice(0, 16);
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
    estimatedCostUsd = duration * (model.costPerSecondUsd ?? model.estCostUsd / 5);
  }
  const workspaceSpent = await pool.query(
    `SELECT COALESCE(SUM(est_cost_usd),0)::float AS spent
       FROM generative_ai_jobs WHERE created_at::date = NOW()::date`,
  ).catch(() => ({ rows: [{ spent: 0 }] }));
  const storyboardSpent = await pool.query(
    `SELECT COALESCE(SUM(est_cost_usd),0)::float AS spent
       FROM storyboard_ai_video_jobs WHERE created_at::date = NOW()::date`,
  ).catch(() => ({ rows: [{ spent: 0 }] }));
  const spentToday = Number(workspaceSpent.rows[0]?.spent ?? 0)
    + Number(storyboardSpent.rows[0]?.spent ?? 0);
  if (spentToday + estimatedCostUsd > settings.dailyCapUsd) {
    throw new StoryboardVideoError(429, 'daily_cap', 'Det globale dagstaket for AI er nådd.');
  }
  if (settings.billingMode === 'credits') {
    const credits = await getUserCredits(pool, input.userId);
    if (credits.balanceUsd < estimatedCostUsd * settings.markupMultiplier) {
      throw new StoryboardVideoError(402, 'insufficient_credits', 'Ikke nok AI-kreditter.');
    }
  }

  return {
    model: model.key, provider: model.provider, duration, estimatedCostUsd,
    providerCredits, sourceFingerprint, sourceB2Key: sourceKey, sourceUrl,
  };
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
    confirmedPreflight?: {
      compilationFingerprint: string;
      sourceFingerprint: string;
      maxEstimatedCostUsd: number;
    };
  },
) {
  const preflight = await preflightStoryboardVideo(pool, input);
  if (input.confirmedPreflight) {
    const estimateIncreased = preflight.estimatedCostUsd
      > input.confirmedPreflight.maxEstimatedCostUsd + 0.000_001;
    if (input.confirmedPreflight.compilationFingerprint !== input.compilationFingerprint
        || input.confirmedPreflight.sourceFingerprint !== preflight.sourceFingerprint
        || estimateIncreased) {
      throw new StoryboardVideoError(
        409, 'preflight_changed',
        'Kilde, prompt eller pris er endret. Kontroller den nye forhåndsvisningen før start.',
      );
    }
  }
  const model = providerFor(input.modelId);
  const duration = preflight.duration;
  const estimatedCostUsd = preflight.estimatedCostUsd;
  const sourceKey = preflight.sourceB2Key;
  const sourceUrl = preflight.sourceUrl;

  let requestId: string | undefined;
  let responseUrl: string | null | undefined;
  let providerError: string | undefined;
  if (model.provider === 'higgsfield') {
    const submitted = await higgsfieldSubmit({ imageUrl: sourceUrl, prompt: input.compiledPrompt,
      model: 'dop-turbo' });
    requestId = submitted.id;
    responseUrl = submitted.statusUrl;
    providerError = submitted.error;
  } else {
    const submitted = await falSubmit(model.falPath, {
      prompt: input.compiledPrompt, image_url: sourceUrl,
      duration: String(duration), resolution: '720p',
    });
    requestId = submitted.requestId;
    responseUrl = submitted.responseUrl;
    providerError = submitted.error;
  }
  if (!requestId || providerError || (model.provider !== 'higgsfield' && !responseUrl)) {
    throw new StoryboardVideoError(502, 'provider_submit_failed', 'Videoleverandøren avviste jobben.');
  }
  const jobId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO storyboard_ai_video_jobs
       (id, project_id, storyboard_id, user_id, user_email, model, kind, status, provider,
        fal_request_id, response_url, input, source_asset_id, est_cost_usd)
     VALUES ($1,$2,$3,$4,$5,$6,'image-to-video','queued',$7,$8,$9,$10::jsonb,NULL,$11)`,
    [jobId, input.projectId, input.storyboard.id, input.userId, input.userEmail, model.key, model.provider,
      requestId, responseUrl ?? null, JSON.stringify({
        storyboardId: input.storyboard.id, prompt: input.compiledPrompt, duration,
        sourceB2Key: sourceKey, sourceFingerprint: preflight.sourceFingerprint,
        compilationFingerprint: input.compilationFingerprint,
      }), estimatedCostUsd],
  );
  return { jobId, status: 'queued', estimatedCostUsd, model: model.key };
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
    return { status: 'completed', outputUrl, model: job.model };
  }
  if (job.status === 'failed') return { status: 'failed', error: job.error, model: job.model };

  let providerStatus: string;
  let providerError: string | undefined;
  let providerUrl: string | null | undefined;
  if (job.provider === 'higgsfield') {
    const providerResult = await higgsfieldPoll(job.response_url || job.fal_request_id);
    providerStatus = providerResult.status;
    providerError = providerResult.error;
    providerUrl = providerResult.outputUrl;
  } else {
    const providerResult = await falPoll(job.response_url);
    providerStatus = providerResult.status;
    providerError = providerResult.error;
    providerUrl = falOutputUrl(providerResult.result).url;
  }
  if (providerStatus === 'ERROR') {
    await pool.query(`UPDATE storyboard_ai_video_jobs SET status='failed', error=$1 WHERE id=$2`,
      [providerError ?? 'provider_error', job.id]).catch(() => undefined);
    return { status: 'failed', error: providerError, model: job.model };
  }
  if (providerStatus !== 'COMPLETED') {
    await pool.query(`UPDATE storyboard_ai_video_jobs SET status='running' WHERE id=$1`, [job.id])
      .catch(() => undefined);
    return { status: 'running', model: job.model };
  }
  if (!providerUrl) throw new StoryboardVideoError(502, 'no_output', 'Leverandøren returnerte ingen video.');
  const parsedProviderUrl = (() => { try { return new URL(providerUrl); } catch { return null; } })();
  const trustedHosts = [
    'fal.media', 'fal.ai', 'fal.run', 'higgsfield.ai',
    'cloudfront.net', 'amazonaws.com', 'storage.googleapis.com',
  ];
  if (!parsedProviderUrl || parsedProviderUrl.protocol !== 'https:'
      || !trustedHosts.some((host) => parsedProviderUrl.hostname === host
        || parsedProviderUrl.hostname.endsWith(`.${host}`))) {
    await pool.query(
      `UPDATE storyboard_ai_video_jobs SET status='failed', error='untrusted_output_url' WHERE id=$1`,
      [job.id],
    ).catch(() => undefined);
    throw new StoryboardVideoError(502, 'untrusted_output_url',
      'Leverandøren returnerte en ukjent output-adresse.');
  }
  let outputKey: string | null = null;
  try {
    const downloaded = await (input.fetchImpl ?? fetch)(providerUrl);
    if (downloaded.ok) {
      const bytes = Buffer.from(await downloaded.arrayBuffer());
      const key = `workspace/${input.projectId}/storyboards/${input.storyboardId}/animations/${job.id}.mp4`;
      if (await archiveToRoleRoomB2(key, bytes, downloaded.headers.get('content-type') || 'video/mp4')) {
        outputKey = key;
      }
    }
  } catch { /* provider URL remains a temporary fallback */ }
  // Polling can happen simultaneously from the board, animatic and a second
  // device. Claim completion atomically so provider cost is metered exactly
  // once even when several callers observe COMPLETED at the same time.
  const completion = await pool.query(
    `UPDATE storyboard_ai_video_jobs SET status='completed', output_b2_key=$1,
       output_url_temp=$2, completed_at=NOW()
     WHERE id=$3 AND status IN ('queued','running')
     RETURNING id`,
    [outputKey, outputKey ? null : providerUrl, job.id],
  );
  if (completion.rowCount !== 1) {
    const settled = await pool.query(
      `SELECT status, model, output_b2_key, output_url_temp
         FROM storyboard_ai_video_jobs WHERE id=$1 AND project_id=$2 AND storyboard_id=$3`,
      [job.id, input.projectId, input.storyboardId],
    );
    const current = settled.rows[0];
    if (!current || current.status !== 'completed') {
      return { status: current?.status ?? 'running', model: current?.model ?? job.model };
    }
    return {
      status: 'completed', model: current.model,
      outputUrl: current.output_b2_key
        ? await presignRoleRoomB2Download(current.output_b2_key, undefined, 3600)
        : current.output_url_temp,
    };
  }
  await pool.query(
    `UPDATE casting_storyboards
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at=NOW()
     WHERE id=$2 AND project_id=$3`,
    [JSON.stringify({ aiVideo: { jobId: job.id, model: job.model, generatedAt: new Date().toISOString() } }),
      input.storyboardId, input.projectId],
  ).catch(() => undefined);
  const settings = await getGenSettings(pool);
  await emitGenAiMeter(pool, { userId: job.user_id, valueUsd: Number(job.est_cost_usd || 0), settings });
  if (settings.billingMode === 'credits') {
    await creditMove(pool, job.user_id, 'spend',
      -(Number(job.est_cost_usd || 0) * settings.markupMultiplier),
      `job:${job.id}`, job.model).catch(() => false);
  }
  return {
    status: 'completed', model: job.model,
    outputUrl: outputKey
      ? await presignRoleRoomB2Download(outputKey, undefined, 3600) : providerUrl,
  };
}
