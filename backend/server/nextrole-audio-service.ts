/**
 * nextrole-audio-service.ts
 *
 * Felles pipeline for audio/video-opptak i NextRole. Brukes av:
 *   • Voice Mock Interview (#80)        — kun audio
 *   • Video-presentasjon-trening (#87)  — audio + video + keyframes
 *   • Case-intervju (#88)               — kun audio (samme som voice)
 *
 * Operasjoner:
 *   1. uploadTrainingMedia(buffer, mime, prefix, userId)
 *        → R2-key + signed playback URL (24t TTL)
 *
 *   2. transcribeAudioWithWhisper(buffer, filename, mime)
 *        → { text, durationMs, language }
 *
 *   3. extractAudioKeyframes (TODO: for video, brukes av #87)
 *
 * Konfig (samme env-vars som cms-media-service):
 *   R2_*, CLOUDFLARE_R2_*, CMS_R2_* — første gyldige sett brukes
 *   OPENAI_API_KEY                  — Whisper-tilgang
 *   NEXTROLE_TRAINING_PREFIX        — R2-prefix for sesjons-opptak
 *                                      (default: 'nextrole-training/')
 *
 * Levetid på opptak: 24 t (lifecycle policy bør settes i R2).
 * Bruker beholder transkripsjonen permanent — kun råopptaket slettes.
 */

import { randomUUID } from "crypto";
import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface R2Config {
  enabled: boolean;
  endpoint?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix: string;
}

function firstNonEmpty(...vs: (string | undefined)[]): string | undefined {
  for (const v of vs) if (v && v.trim().length > 0) return v;
  return undefined;
}

export function buildTrainingR2Config(): R2Config {
  const endpoint = firstNonEmpty(
    process.env.NEXTROLE_R2_ENDPOINT,
    process.env.CMS_R2_ENDPOINT,
    process.env.CLOUDFLARE_R2_ENDPOINT,
    process.env.R2_ENDPOINT,
  );
  const bucket = firstNonEmpty(
    process.env.NEXTROLE_R2_BUCKET,
    process.env.CMS_R2_BUCKET,
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.R2_BUCKET,
  );
  const accessKeyId = firstNonEmpty(
    process.env.NEXTROLE_R2_ACCESS_KEY_ID,
    process.env.CMS_R2_ACCESS_KEY_ID,
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID,
  );
  const secretAccessKey = firstNonEmpty(
    process.env.NEXTROLE_R2_SECRET_ACCESS_KEY,
    process.env.CMS_R2_SECRET_ACCESS_KEY,
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY,
  );
  return {
    enabled: Boolean(endpoint && bucket && accessKeyId && secretAccessKey),
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    prefix:
      process.env.NEXTROLE_TRAINING_PREFIX ?? "nextrole-training/",
  };
}

let cachedClient: S3Client | null = null;
let cachedKey = "";

function getClient(cfg: R2Config): S3Client | null {
  if (!cfg.enabled || !cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey)
    return null;
  const k = `${cfg.endpoint}|${cfg.accessKeyId}`;
  if (cachedClient && cachedKey === k) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  cachedKey = k;
  return cachedClient;
}

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
  "audio/ogg": "ogg",
  "audio/ogg;codecs=opus": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "video/webm": "webm",
  "video/mp4": "mp4",
};

function extFromMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  return EXT_BY_MIME[mime] ?? EXT_BY_MIME[base] ?? "bin";
}

export interface UploadTrainingMediaResult {
  ok: true;
  key: string;
  url: string;
  bytes: number;
}
export interface UploadTrainingMediaError {
  ok: false;
  error: "storage_not_configured" | "upload_failed";
  detail?: string;
}

const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60; // 24t

/**
 * Last opp et opptak (audio/video) til R2 og returner signed URL.
 * Path: {prefix}/{kind}/{userId}/{sessionId}/{uuid}.{ext}
 */
export async function uploadTrainingMedia(input: {
  buffer: Buffer;
  mime: string;
  kind: "audio" | "video";
  userId: string;
  sessionId: string;
}): Promise<UploadTrainingMediaResult | UploadTrainingMediaError> {
  const cfg = buildTrainingR2Config();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) {
    return { ok: false, error: "storage_not_configured" };
  }
  const ext = extFromMime(input.mime);
  const key = `${cfg.prefix}${input.kind}/${input.userId}/${input.sessionId}/${randomUUID()}.${ext}`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mime,
        Metadata: {
          userId: input.userId,
          sessionId: input.sessionId,
          kind: input.kind,
          createdAt: new Date().toISOString(),
        },
      }),
    );
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
    return { ok: true, key, url, bytes: input.buffer.byteLength };
  } catch (err) {
    console.error("[nextrole-audio] upload failed", err);
    return {
      ok: false,
      error: "upload_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Generer ny signed URL for en eksisterende key (brukes når
 * gammel URL har utløpt og bruker vil spille av igjen).
 */
export async function refreshSignedUrl(
  r2Key: string,
): Promise<string | null> {
  const cfg = buildTrainingR2Config();
  const client = getClient(cfg);
  if (!client || !cfg.bucket) return null;
  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: cfg.bucket, Key: r2Key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  } catch (err) {
    console.error("[nextrole-audio] signed-url refresh failed", err);
    return null;
  }
}

// ── Whisper-transkripsjon ──────────────────────────────────────────

export interface TranscriptionResult {
  text: string;
  durationMs: number | null;
  language: string | null;
}
export interface TranscriptionError {
  ok: false;
  error: "no_api_key" | "whisper_failed";
  detail?: string;
}

/**
 * Sender buffer til OpenAI Whisper og returnerer transkripsjon.
 * Bruker `whisper-1`-modellen. Norge-spesifikk: vi tipser med
 * language='no' (norsk bokmål) for å unngå at modellen tolker svake
 * lydopptak som svensk eller dansk.
 *
 * Whisper API krever multipart/form-data — vi bruker globalThis.fetch
 * + FormData (Node 18+ støtter det native).
 */
export async function transcribeAudioWithWhisper(input: {
  buffer: Buffer;
  filename: string;
  mime: string;
  preferredLanguage?: string;
}): Promise<TranscriptionResult | TranscriptionError> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "no_api_key" };
  }

  const form = new FormData();
  // OpenAI godtar webm/ogg/mp3/mp4/wav/m4a — webm fra MediaRecorder
  // fungerer ut av boksen.
  const blob = new Blob([new Uint8Array(input.buffer)], { type: input.mime });
  form.append("file", blob, input.filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("language", input.preferredLanguage ?? "no");
  // Tar med liten kontekst-prompt så modellen vet at vi er på et
  // jobbintervju → bedre tolkning av "STAR", "Claude", domeneord, m.m.
  form.append(
    "prompt",
    "Dette er et jobbintervju på norsk. Kandidaten svarer på spørsmål fra en intervjuer. Vanlige begreper: STAR-metoden, prosjektledelse, teamarbeid, resultat, KPI, ATS.",
  );

  try {
    const res = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      },
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error: "whisper_failed",
        detail: `${res.status} ${errText.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as {
      text?: string;
      duration?: number;
      language?: string;
    };
    return {
      text: (json.text ?? "").trim(),
      durationMs: typeof json.duration === "number"
        ? Math.round(json.duration * 1000)
        : null,
      language: json.language ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: "whisper_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export function isTranscriptionError(
  r: TranscriptionResult | TranscriptionError,
): r is TranscriptionError {
  return (r as TranscriptionError).ok === false;
}
