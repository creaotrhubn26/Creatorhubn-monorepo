/**
 * Provider-uavhengig bilde→video for Storyboard Room.
 *
 * Appen velger en produktopplevelse (billigst / kvalitet / premium), mens
 * backend eier leverandørkontrakter, polling og permanent arkivering. Dermed
 * kan vi bytte modell uten å publisere en ny iPad-versjon.
 */

import crypto from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Pool } from "pg";
import {
  GEN_MODELS,
  type GenModel,
  falOutputUrl,
  falPoll,
  falSubmit,
  genModelConfigured,
  higgsfieldPoll,
  higgsfieldSubmit,
} from "./generative-media.js";
import { archiveToRoleRoomB2, presignRoleRoomB2Download } from "./b2-archive-helper.js";

const MODEL_KEYS = [
  "longcat-video-i2v",
  "seedance-2-i2v",
  "higgsfield-dop-i2v",
] as const;

export type StoryboardVideoModelKey = (typeof MODEL_KEYS)[number];

export interface StoryboardVideoModelView {
  key: StoryboardVideoModelKey;
  label: string;
  provider: string;
  gateway: "fal" | "higgsfield";
  costPerSecondUsd: number;
  configured: boolean;
}

export interface StoryboardVideoJobView {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  model: string;
  provider: string;
  duration: number;
  estCostUsd: number;
  prompt: string;
  videoUrl?: string;
  error?: string;
  newlyCompleted?: boolean;
  userId?: string | null;
}

function gatewayFor(model: GenModel): "fal" | "higgsfield" {
  return model.provider === "higgsfield" ? "higgsfield" : "fal";
}

export function listStoryboardVideoModels(): StoryboardVideoModelView[] {
  return MODEL_KEYS.map((key) => {
    const model = GEN_MODELS[key];
    return {
      key,
      label: model.label,
      provider: model.provider,
      gateway: gatewayFor(model),
      costPerSecondUsd: model.costPerSecondUsd ?? model.estCostUsd,
      configured: genModelConfigured(model),
    };
  });
}

/** `auto` velger billigste konfigurerte modell. */
export function resolveStoryboardVideoModel(requested?: string | null): GenModel | null {
  const normalized = String(requested || "auto").trim().toLowerCase();
  if (normalized === "auto") {
    return MODEL_KEYS
      .map((key) => GEN_MODELS[key])
      .filter(genModelConfigured)
      .sort((a, b) => (a.costPerSecondUsd ?? Infinity) - (b.costPerSecondUsd ?? Infinity))[0] ?? null;
  }
  const aliases: Record<string, StoryboardVideoModelKey> = {
    longcat: "longcat-video-i2v",
    cheap: "longcat-video-i2v",
    seedance: "seedance-2-i2v",
    quality: "seedance-2-i2v",
    higgsfield: "higgsfield-dop-i2v",
  };
  const wanted = aliases[normalized] ?? normalized;
  if (!MODEL_KEYS.includes(wanted as StoryboardVideoModelKey)) return null;
  return GEN_MODELS[wanted];
}

export function normalizeStoryboardVideoDuration(modelKey: string, requested: number): number {
  const parsed = Number.isFinite(requested) ? Math.round(requested) : 4;
  if (modelKey === "longcat-video-i2v") return Math.min(10, Math.max(2, parsed));
  return Math.min(15, Math.max(4, parsed));
}

export function buildStoryboardVideoInput(
  modelKey: string,
  imageUrl: string,
  prompt: string,
  duration: number,
): Record<string, unknown> {
  if (modelKey === "longcat-video-i2v") {
    return { image_url: imageUrl, prompt, num_frames: duration * 30 };
  }
  return {
    image_url: imageUrl,
    prompt,
    duration: String(duration),
    resolution: "720p",
    generate_audio: false,
  };
}

export async function ensureStoryboardVideoSchema(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS generative_ai_jobs (
    id uuid PRIMARY KEY, project_id uuid NOT NULL, user_id varchar, user_email varchar,
    model varchar, kind varchar, status varchar DEFAULT 'queued', provider varchar,
    fal_request_id varchar, response_url text, input jsonb, source_asset_id uuid,
    output_b2_key text, output_url_temp text, est_cost_usd numeric DEFAULT 0,
    error text, created_at timestamptz DEFAULT now(), completed_at timestamptz)`).catch(() => {});
  await pool.query(`CREATE TABLE IF NOT EXISTS project_ai_consent (
    project_id varchar PRIMARY KEY, consented boolean DEFAULT false,
    consented_by varchar, consented_at timestamptz)`).catch(() => {});
}

export async function spentOnGenerativeAIToday(pool: Pool): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(est_cost_usd), 0)::float AS total
       FROM generative_ai_jobs WHERE created_at::date = NOW()::date`,
  ).catch(() => ({ rows: [{ total: 0 }] }));
  return Number(result.rows[0]?.total || 0);
}

export async function submitStoryboardVideoJob(
  pool: Pool,
  opts: {
    projectId: string;
    userId: string;
    userEmail?: string | null;
    storyboardId: string;
    frameId: string;
    sourceFileId: string;
    sourceUrl: string;
    prompt: string;
    requestedModel?: string | null;
    requestedDuration: number;
  },
): Promise<StoryboardVideoJobView> {
  const model = resolveStoryboardVideoModel(opts.requestedModel);
  if (!model) throw new Error("unsupported_model");
  if (!genModelConfigured(model)) throw new Error("provider_not_configured");

  const duration = normalizeStoryboardVideoDuration(model.key, opts.requestedDuration);
  const estCostUsd = Number((duration * (model.costPerSecondUsd ?? model.estCostUsd)).toFixed(4));
  let requestId: string | undefined;
  let responseUrl: string | null | undefined;
  let submitError: string | undefined;

  if (gatewayFor(model) === "higgsfield") {
    const result = await higgsfieldSubmit({ imageUrl: opts.sourceUrl, prompt: opts.prompt, model: "dop-turbo" });
    requestId = result.id;
    responseUrl = result.statusUrl;
    submitError = result.error;
  } else {
    const result = await falSubmit(
      model.falPath,
      buildStoryboardVideoInput(model.key, opts.sourceUrl, opts.prompt, duration),
    );
    requestId = result.requestId;
    responseUrl = result.responseUrl;
    submitError = result.error;
  }
  if (submitError || !requestId) throw new Error(submitError || "provider_submit_failed");

  const jobId = crypto.randomUUID();
  const input = {
    prompt: opts.prompt,
    duration,
    storyboardId: opts.storyboardId,
    frameId: opts.frameId,
    sourceFileId: opts.sourceFileId,
    modelProvider: model.provider,
  };
  await pool.query(
    `INSERT INTO generative_ai_jobs
      (id, project_id, user_id, user_email, model, kind, status, provider,
       fal_request_id, response_url, input, est_cost_usd)
     VALUES ($1,$2,$3,$4,$5,'image-to-video','queued',$6,$7,$8,$9::jsonb,$10)`,
    [jobId, opts.projectId, opts.userId, opts.userEmail ?? null, model.key,
      gatewayFor(model), requestId, responseUrl ?? null, JSON.stringify(input), estCostUsd],
  );
  return { jobId, status: "queued", model: model.key, provider: model.provider,
    duration, estCostUsd, prompt: opts.prompt };
}

async function responseBufferWithLimit(response: Awaited<ReturnType<typeof fetch>>, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("output_too_large");
  if (!response.body) throw new Error("output_empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("output_too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

/** Blokker loopback, link-local, private og andre ikke-offentlige mål. */
export function isPrivateNetworkAddress(rawAddress: string): boolean {
  let address = rawAddress.toLowerCase().split('%')[0];
  if (address.startsWith('::ffff:')) address = address.slice(7);
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113);
  }
  if (isIP(address) === 6) {
    // Offentlig IPv6 global-unicast er 2000::/3. Alt annet avvises her.
    return !/^[23][0-9a-f]{3}:/.test(address) || /^2001:(0?db8):/.test(address);
  }
  return true;
}

async function assertSafeProviderOutputUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
    throw new Error("unsafe_provider_output_url");
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateNetworkAddress(entry.address))) {
    throw new Error("unsafe_provider_output_host");
  }
  return url;
}

export async function pollStoryboardVideoJob(
  pool: Pool,
  projectId: string,
  jobId: string,
): Promise<StoryboardVideoJobView | null> {
  const result = await pool.query(
    `SELECT * FROM generative_ai_jobs
      WHERE id = $1 AND project_id = $2 AND kind = 'image-to-video'`,
    [jobId, projectId],
  ).catch(() => ({ rows: [] }));
  const job = result.rows[0];
  if (!job) return null;

  const base = (): StoryboardVideoJobView => ({
    jobId: job.id,
    status: job.status,
    model: job.model,
    provider: job.input?.modelProvider || job.provider,
    duration: Number(job.input?.duration || 4),
    estCostUsd: Number(job.est_cost_usd || 0),
    prompt: String(job.input?.prompt || ""),
    userId: job.user_id,
  });
  if (job.status === "completed" && job.output_b2_key) {
    const videoUrl = await presignRoleRoomB2Download(job.output_b2_key, 3600);
    return { ...base(), status: "completed", ...(videoUrl ? { videoUrl } : {}) };
  }
  if (job.status === "failed") return { ...base(), status: "failed", error: job.error || "generation_failed" };

  let polled: { status: string; result?: unknown; error?: string };
  if (job.provider === "higgsfield") {
    const value = await higgsfieldPoll(job.response_url || job.fal_request_id);
    polled = { status: value.status,
      result: value.outputUrl ? { video: { url: value.outputUrl } } : undefined,
      error: value.error };
  } else {
    if (!job.response_url) return { ...base(), status: "queued" };
    polled = await falPoll(job.response_url);
  }
  if (polled.status !== "COMPLETED") {
    if (polled.status === "ERROR") {
      await pool.query(
        `UPDATE generative_ai_jobs SET status = 'failed', error = $1
          WHERE id = $2 AND status NOT IN ('completed', 'failed')`,
        [polled.error || "provider_error", job.id],
      ).catch(() => {});
      return { ...base(), status: "failed", error: polled.error || "provider_error" };
    }
    await pool.query(
      `UPDATE generative_ai_jobs SET status = 'running'
        WHERE id = $1 AND status NOT IN ('completed', 'failed')`,
      [job.id],
    ).catch(() => {});
    return { ...base(), status: "running" };
  }

  const outputUrl = falOutputUrl(polled.result).url;
  if (!outputUrl) throw new Error("provider_no_video");
  const parsedOutput = await assertSafeProviderOutputUrl(outputUrl);
  // Redirects valideres ikke av fetch mot vår DNS-policy, derfor avvises de.
  const response = await fetch(parsedOutput, { redirect: "error" });
  if (!response.ok) throw new Error(`provider_output_${response.status}`);
  const body = await responseBufferWithLimit(response, 64 * 1024 * 1024);
  const contentType = response.headers.get("content-type") || "video/mp4";
  if (!contentType.toLowerCase().startsWith("video/")) throw new Error("provider_output_not_video");
  const b2Key = `workspace/${projectId}/storyboard-ai-video/${job.id}.mp4`;
  const archived = await archiveToRoleRoomB2(b2Key, body, contentType);
  if (!archived) throw new Error("video_archive_failed");

  const completed = await pool.query(
    `UPDATE generative_ai_jobs
        SET status = 'completed', output_b2_key = $1, output_url_temp = NULL,
            completed_at = NOW(), error = NULL
      WHERE id = $2 AND status NOT IN ('completed', 'failed')
      RETURNING id`,
    [b2Key, job.id],
  ).catch(() => ({ rows: [] }));
  const videoUrl = await presignRoleRoomB2Download(b2Key, 3600);
  return { ...base(), status: "completed", newlyCompleted: completed.rows.length > 0,
    ...(videoUrl ? { videoUrl } : {}) };
}
