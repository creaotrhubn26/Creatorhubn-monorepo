/**
 * generative-media.ts — provider-agnostisk lag for generativ AI (bilde/video).
 *
 * Kjernen i en gjennomtenkt integrasjon: ett modell-register (capability +
 * kostnad + datapolicy) over fal sin queue-API, så kallsteder (Photo Room,
 * Video Room, Moodboard) er uavhengige av hvilken modell som kjører. Lett å
 * bytte Seedance↔Kling↔Wan↔Nano Banana eller legge til Replicate/self-host
 * (Wan på RunPod) senere uten å røre rommene.
 *
 * Styring (Daniels valg): alle fal-modeller TILLATT, men bak (1) per-prosjekt
 * SAMTYKKE (persondata forlater EØS), (2) WHITELIST (kun utvalgte i pilot), og
 * (3) global DAGSTAK-kostnadsbrems. Ingen generering uten attribusjon.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface GenModel {
  key: string;
  label: string;
  falPath: string;          // fal queue-sti, f.eks. fal-ai/nano-banana-2/edit
  kind: "image-edit" | "image-to-video" | "text-to-image" | "text-to-video";
  provider: string;         // google | bytedance | kuaishou | alibaba …
  estCostUsd: number;       // grovt estimat pr generering (for dagstak + visning)
  costPerSecondUsd?: number; // for video: kost pr sekund (estimat = sek × dette)
  imageField?: string;      // fal-input-feltnavn for kildebildet (image_url/image_urls/start_image_url)
  outputField?: "images" | "video"; // hvor resultatet ligger i fal-responsen
  sendsPersonalData: boolean; // sender kilde-bildet/-videoen (kundedata) til tredjepart
}

// Register — utvides etter hvert som vi piloterer flere modeller.
export const GEN_MODELS: Record<string, GenModel> = {
  "nano-banana-2-edit": {
    key: "nano-banana-2-edit",
    label: "Nano Banana 2 — rediger",
    falPath: "fal-ai/nano-banana-2/edit",
    kind: "image-edit",
    provider: "google",
    estCostUsd: 0.06,
    imageField: "image_urls", outputField: "images",
    sendsPersonalData: true,
  },
  "seedance-2-i2v": {
    key: "seedance-2-i2v",
    label: "Seedance 2.0 — bilde→video",
    falPath: "bytedance/seedance-2.0/image-to-video",
    kind: "image-to-video",
    provider: "bytedance",
    estCostUsd: 0.5,
    costPerSecondUsd: 0.10,
    imageField: "image_url", outputField: "video",
    sendsPersonalData: true,
  },
  // Seedance v1 Pro i2v — den PRODUKSJONS-BEVISTE stien (samme som ad-film-Python).
  // 🔑 Har `fal-ai/`-prefiks (queue.fal.run krever eier-prefiks); uten den svarer
  // fal 403. Brukes av Post Agent Demo Studio sin /ai/generate-video-rute.
  "seedance-i2v-pro": {
    key: "seedance-i2v-pro",
    label: "Seedance v1 Pro — bilde→video",
    falPath: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    kind: "image-to-video",
    provider: "bytedance",
    estCostUsd: 0.5,
    costPerSecondUsd: 0.12,
    imageField: "image_url", outputField: "video",
    sendsPersonalData: true,
  },
  // Photo enhancer (GFPGAN/Real-ESRGAN) — kjører på VÅR infra (CPU/RunPod-GPU),
  // ikke fal. «Kost» = compute; margin via påslag. Egen kø (enqueuePhotoEnhancer…).
  "photo-enhance": {
    key: "photo-enhance",
    label: "Foto-forbedring (GFPGAN/Real-ESRGAN)",
    falPath: "",
    kind: "image-edit",
    provider: "creatorhub",
    estCostUsd: 0.04,
    sendsPersonalData: false,
  },
  // Nano Banana 2 — tekst→bilde (konsept-generering for moodboard). Ikke
  // persondata (genererer fra tekst) → ingen samtykke-gate nødvendig.
  "nano-banana-2-t2i": {
    key: "nano-banana-2-t2i",
    label: "Nano Banana 2 — konsept (tekst→bilde)",
    falPath: "fal-ai/nano-banana-2",
    kind: "text-to-image",
    provider: "google",
    estCostUsd: 0.06,
    outputField: "images",
    sendsPersonalData: false,
  },
  // SwitchX (Beeble) — video-til-video relighting/restyle. Bevarer bevegelse/
  // performance, endrer kun lys/atmosfære/stil. Egen provider (ikke fal).
  "switchx-restyle": {
    key: "switchx-restyle",
    label: "SwitchX — relight / restyle",
    falPath: "", // bruker beeble-helperne, ikke fal
    kind: "image-to-video", // video-til-video; gjenbruker video-output-håndtering
    provider: "beeble",
    estCostUsd: 0.8,            // ~240 frames @720p ≈ 8×$0.10
    costPerSecondUsd: 0.08,    // ~24fps/30×$0.10
    sendsPersonalData: true,
  },
  // Higgsfield DoP — bilde→video med kinematisk kamera-bevegelse. Egen provider
  // (ikke fal), samme async-jobb-mønster som Seedance/Beeble.
  "higgsfield-dop-i2v": {
    key: "higgsfield-dop-i2v",
    label: "Higgsfield DoP — bilde→video (kinematisk)",
    falPath: "", // bruker higgsfield-helperne, ikke fal
    kind: "image-to-video",
    provider: "higgsfield",
    estCostUsd: 0.5,
    costPerSecondUsd: 0.10,
    imageField: "input_images", outputField: "video",
    sendsPersonalData: true,
  },
};

// ─── Beeble SwitchX-klient (video relight/restyle) ──────────────────────────
// Verifisert skjema: POST https://api.beeble.ai/v1/switchx/generations m/
// x-api-key. Krav: generation_type, source_uri, alpha_mode (auto|fill|custom|
// select), max_resolution (720|1080), prompt. Valgfri reference_image_uri.
const BEEBLE_BASE = "https://api.beeble.ai/v1/switchx";

export function beebleConfigured(): boolean { return !!process.env.BEEBLE_API_KEY; }

export async function beebleSubmit(opts: { sourceUri: string; prompt: string; referenceImageUri?: string | null; maxResolution?: 720 | 1080 }): Promise<{ id?: string; error?: string }> {
  const key = process.env.BEEBLE_API_KEY;
  if (!key) return { error: "beeble_not_configured" };
  try {
    const body: any = { generation_type: "video", source_uri: opts.sourceUri, alpha_mode: "auto", max_resolution: opts.maxResolution || 720, prompt: opts.prompt };
    if (opts.referenceImageUri) body.reference_image_uri = opts.referenceImageUri;
    const r = await fetch(`${BEEBLE_BASE}/generations`, { method: "POST", headers: { "x-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j?.error?.code || j?.error?.message || `beeble_${r.status}` };
    const id = j.id || j.generation_id || j.generationId;
    return id ? { id } : { error: "beeble_no_id" };
  } catch (e: any) { return { error: `beeble_submit_threw:${e?.message || e}` }; }
}

export async function beeblePoll(generationId: string): Promise<{ status: string; outputUrl?: string | null; error?: string }> {
  const key = process.env.BEEBLE_API_KEY;
  if (!key) return { status: "ERROR", error: "beeble_not_configured" };
  try {
    const r = await fetch(`${BEEBLE_BASE}/generations/${generationId}`, { headers: { "x-api-key": key } });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { status: "ERROR", error: j?.error?.code || `beeble_${r.status}` };
    const raw = String(j.status || j.state || "").toLowerCase();
    const out = j.output_uri || j.result_uri || j.output?.uri || j.output?.url || j.video?.uri || j.video?.url || j.result?.uri || null;
    if (raw === "completed" || raw === "succeeded" || raw === "success" || raw === "done" || out) return { status: "COMPLETED", outputUrl: out };
    if (raw === "failed" || raw === "error" || raw === "canceled" || raw === "cancelled") return { status: "ERROR", error: j?.error?.message || raw };
    return { status: raw ? raw.toUpperCase() : "IN_PROGRESS" };
  } catch (e: any) { return { status: "ERROR", error: `beeble_poll_threw:${e?.message || e}` }; }
}

// ─── Higgsfield DoP-klient (bilde→video, kinematisk kamera) ──────────────────
// Offentlig OpenAPI: https://docs.higgsfield.ai/docs/openapi.json
//   POST /higgsfield-ai/dop/turbo, body { prompt, image_url, enhance_prompt }
//   estimate bruker /estimate + samme modellsti og body.
// Render kan lagre legitimasjonen som separate secrets. Kombinert variabel
// beholdes som bakoverkompatibel fallback for eksisterende miljøer.
const HIGGSFIELD_BASE = "https://api.higgsfield.ai";
const HIGGSFIELD_DOP_PATH = "/higgsfield-ai/dop/turbo";
// Every request stays below the reconciler's 60-second lease. The async API
// should acknowledge generation quickly; it does not stream generation work
// through these HTTP requests.
const HIGGSFIELD_ESTIMATE_TIMEOUT_MS = 20_000;
const HIGGSFIELD_SUBMIT_TIMEOUT_MS = 45_000;
const HIGGSFIELD_POLL_TIMEOUT_MS = 15_000;

function higgsfieldCredentials(): string | undefined {
  const keyId = process.env.HIGGSFIELD_API_KEY_ID?.trim();
  const keySecret = process.env.HIGGSFIELD_API_KEY_SECRET?.trim();
  if (keyId && keySecret) return `${keyId}:${keySecret}`;

  const combined = process.env.HIGGSFIELD_API_KEY?.trim();
  return combined || undefined;
}

export function higgsfieldConfigured(): boolean {
  return Boolean(higgsfieldCredentials());
}

export const HIGGSFIELD_REQUEST_STATUSES = [
  "queued",
  "in_progress",
  "completed",
  "failed",
  "nsfw",
  "canceled",
] as const;

export type HiggsfieldRequestStatus =
  (typeof HIGGSFIELD_REQUEST_STATUSES)[number];

export type HiggsfieldSubmitResult = {
  id?: string;
  status?: HiggsfieldRequestStatus;
  statusUrl?: string;
  cancelUrl?: string;
  correlationId?: string;
  error?: string;
  submissionUnknown?: true;
  acceptedContractUnknown?: true;
  rejectionKind?: "retryable" | "permanent" | "unknown";
};

export type HiggsfieldPollResult = {
  status:
    | "QUEUED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "ERROR"
    | "RETRYABLE_ERROR"
    | "POLLING_BLOCKED"
    | "CONTRACT_UNKNOWN";
  providerStatus?: HiggsfieldRequestStatus;
  requestId?: string;
  outputUrl?: string | null;
  correlationId?: string;
  error?: string;
};

const HIGGSFIELD_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function higgsfieldCorrelationId(response: {
  headers?: { get?: (name: string) => string | null };
}): string | undefined {
  const value = response.headers?.get?.("x-correlation-id")?.trim();
  return value || undefined;
}

function higgsfieldRequestStatus(value: unknown):
  HiggsfieldRequestStatus | undefined {
  return typeof value === "string"
    && (HIGGSFIELD_REQUEST_STATUSES as readonly string[]).includes(value)
    ? value as HiggsfieldRequestStatus
    : undefined;
}

function higgsfieldRequestUrl(
  value: unknown,
  requestId: string,
  action: "status" | "cancel",
): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    const expectedPath = `/requests/${requestId}/${action}`;
    if (parsed.protocol !== "https:"
        || parsed.host !== "api.higgsfield.ai"
        || parsed.username || parsed.password
        || parsed.search || parsed.hash
        || parsed.pathname.toLowerCase() !== expectedPath.toLowerCase()) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function higgsfieldErrorMessage(body: any, status: number): string {
  const nested = body?.error?.message;
  if (typeof nested === "string" && nested.trim()) return nested;
  if (typeof body?.detail === "string" && body.detail.trim()) return body.detail;
  return `higgsfield_${status}`;
}

function higgsfieldDopBody(opts: { imageUrl: string; prompt: string }) {
  return { prompt: opts.prompt, image_url: opts.imageUrl, enhance_prompt: false };
}

export async function higgsfieldEstimate(opts: { imageUrl: string; prompt: string }): Promise<{ credits?: number; usd?: number; error?: string }> {
  const key = higgsfieldCredentials();
  if (!key) return { error: "higgsfield_not_configured" };
  try {
    const r = await fetch(`${HIGGSFIELD_BASE}/estimate${HIGGSFIELD_DOP_PATH}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(higgsfieldDopBody(opts)),
      redirect: "error",
      signal: AbortSignal.timeout(HIGGSFIELD_ESTIMATE_TIMEOUT_MS),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j?.error?.message || j?.detail || `higgsfield_estimate_${r.status}` };
    const credits = Number(j.credits);
    const usd = Number(j.usd);
    if (!Number.isFinite(usd) || usd < 0) return { error: "higgsfield_estimate_invalid" };
    return { credits: Number.isFinite(credits) ? credits : undefined, usd };
  } catch (e: any) {
    return { error: `higgsfield_estimate_threw:${e?.message || e}` };
  }
}

export async function higgsfieldSubmit(opts: {
  imageUrl: string;
  prompt: string;
  model?: string;
  webhookUrl?: string;
}): Promise<HiggsfieldSubmitResult> {
  const key = higgsfieldCredentials();
  if (!key) return { error: "higgsfield_not_configured" };
  try {
    // Higgsfield generation POST does not currently provide provider-side
    // idempotency. Never send a local job id as though the provider honored it.
    const submitUrl = new URL(`${HIGGSFIELD_BASE}${HIGGSFIELD_DOP_PATH}`);
    if (opts.webhookUrl) {
      let callback: URL;
      try {
        callback = new URL(opts.webhookUrl);
      } catch {
        return { error: "higgsfield_invalid_webhook_url" };
      }
      if (callback.protocol !== "https:" || callback.username
          || callback.password || callback.hash) {
        return { error: "higgsfield_invalid_webhook_url" };
      }
      submitUrl.searchParams.set("hf_webhook", callback.toString());
    }
    const r = await fetch(submitUrl.toString(), {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(higgsfieldDopBody(opts)),
      redirect: "error",
      signal: AbortSignal.timeout(HIGGSFIELD_SUBMIT_TIMEOUT_MS),
    });
    const j: any = await r.json().catch(() => ({}));
    const correlationId = higgsfieldCorrelationId(r);
    const correlation = correlationId ? { correlationId } : {};
    if (!r.ok) {
      const error = higgsfieldErrorMessage(j, r.status);
      // A server-side failure can happen after acceptance. Without an
      // idempotency contract a second POST could create a second paid job.
      if (r.status >= 500 || r.status === 408) {
        return { error, ...correlation, submissionUnknown: true };
      }
      const rejectionKind = [400, 403, 423].includes(r.status)
        ? "retryable" as const
        : [401, 404, 422].includes(r.status)
          ? "permanent" as const
          : "unknown" as const;
      return { error, ...correlation, rejectionKind };
    }
    const id = typeof j.request_id === "string"
      ? j.request_id.trim().toLowerCase() : "";
    if (!HIGGSFIELD_UUID_RE.test(id)) {
      return {
        error: "higgsfield_invalid_request_id",
        ...correlation,
        submissionUnknown: true,
      };
    }
    const status = higgsfieldRequestStatus(j.status);
    const statusUrl = higgsfieldRequestUrl(j.status_url, id, "status");
    const cancelUrl = higgsfieldRequestUrl(j.cancel_url, id, "cancel");
    if (!status || !["queued", "in_progress"].includes(status)
        || !statusUrl || !cancelUrl) {
      return {
        id,
        status,
        statusUrl,
        cancelUrl,
        ...correlation,
        error: "higgsfield_lifecycle_url_missing_or_invalid",
        acceptedContractUnknown: true,
      };
    }
    return { id, status, statusUrl, cancelUrl, ...correlation };
  } catch (e: any) {
    return {
      error: `higgsfield_submit_threw:${e?.message || e}`,
      submissionUnknown: true,
    };
  }
}

export async function higgsfieldPoll(statusUrl: string):
Promise<HiggsfieldPollResult> {
  const key = higgsfieldCredentials();
  if (!key) {
    return {
      status: "POLLING_BLOCKED",
      error: "higgsfield_not_configured",
    };
  }
  const requestId = (() => {
    try {
      const parsed = new URL(statusUrl);
      const match = /^\/requests\/([0-9a-f-]+)\/status$/i.exec(parsed.pathname);
      if (!match || !HIGGSFIELD_UUID_RE.test(match[1])) return undefined;
      return higgsfieldRequestUrl(statusUrl, match[1], "status")
        ? match[1] : undefined;
    } catch {
      return undefined;
    }
  })();
  if (!requestId) {
    return { status: "CONTRACT_UNKNOWN", error: "higgsfield_invalid_status_url" };
  }
  try {
    const r = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
      redirect: "error",
      signal: AbortSignal.timeout(HIGGSFIELD_POLL_TIMEOUT_MS),
    });
    const j: any = await r.json().catch(() => ({}));
    const correlationId = higgsfieldCorrelationId(r);
    const correlation = correlationId ? { correlationId } : {};
    if (!r.ok) {
      const error = higgsfieldErrorMessage(j, r.status);
      if (r.status >= 500 || r.status === 423 || r.status === 429) {
        return { status: "RETRYABLE_ERROR", error, ...correlation };
      }
      return { status: "POLLING_BLOCKED", error, ...correlation };
    }
    if (typeof j.request_id !== "string"
        || j.request_id.toLowerCase() !== requestId.toLowerCase()) {
      return {
        status: "CONTRACT_UNKNOWN",
        error: "higgsfield_poll_request_mismatch",
        ...correlation,
      };
    }
    const raw = higgsfieldRequestStatus(j.status);
    if (!raw) {
      return {
        status: "CONTRACT_UNKNOWN",
        error: "higgsfield_poll_status_invalid",
        ...correlation,
      };
    }
    const out = typeof j.video?.url === "string" ? j.video.url : null;
    if (raw === "completed") {
      return out
        ? { status: "COMPLETED", providerStatus: raw, requestId,
          outputUrl: out,
          ...correlation }
        : { status: "CONTRACT_UNKNOWN", providerStatus: raw, requestId,
          error: "higgsfield_completed_without_output", ...correlation };
    }
    if (raw === "failed" || raw === "nsfw" || raw === "canceled") {
      return { status: "ERROR", providerStatus: raw, requestId,
        error: j?.error?.message || raw, ...correlation };
    }
    return {
      status: raw === "queued" ? "QUEUED" : "IN_PROGRESS",
      providerStatus: raw,
      requestId,
      ...correlation,
    };
  } catch (e: any) {
    return { status: "RETRYABLE_ERROR",
      error: `higgsfield_poll_threw:${e?.message || e}` };
  }
}

// Hent ut resultat-URL fra en fal-respons (bilde vs video).
export function falOutputUrl(result: any): { url: string | null; isVideo: boolean } {
  if (result?.video?.url) return { url: result.video.url, isVideo: true };
  if (Array.isArray(result?.images) && result.images[0]?.url) return { url: result.images[0].url, isVideo: false };
  if (result?.image?.url) return { url: result.image.url, isVideo: false };
  return { url: null, isVideo: false };
}

export function publicModelList() {
  return Object.values(GEN_MODELS).map((m) => ({ key: m.key, label: m.label, kind: m.kind, provider: m.provider, estCostUsd: m.estCostUsd }));
}

// ─── Styring (DB-basert, admin-redigerbar — env som fallback) ────────────────
// Konfig ligger i generative_ai_settings (singleton id=1) slik at admin kan
// skru av/på, bytte billing-modus, sette dagstak/whitelist/kvote fra Admin
// Dashboard — uten å røre env. Env brukes kun som default når raden mangler.
export interface CreditPack { id: string; creditUsd: number; priceNok: number; }
export interface GenSettings {
  enabled: boolean;
  billingMode: "free_whitelist" | "metered" | "credits";
  dailyCapUsd: number;
  whitelist: string[];     // e-poster (lowercase)
  includedQuota: number;   // inkluderte genereringer pr bruker pr mnd (metered)
  markupMultiplier: number; // kunde-pris = vår-kost × dette (margin = profitt for CreatorHub)
  creditPacks: CreditPack[]; // selvbetjente forhåndsbetalte pakker (credits-modus)
}

// Standard kredittpakker (retail USD-verdi brukeren kan bruke + pris i NOK).
// Profitt sikres av påslaget når kreditter BRUKES (kost×påslag trekkes, vi betaler
// kun kost) — pluss float på ubrukt saldo.
export const DEFAULT_CREDIT_PACKS: CreditPack[] = [
  { id: "starter", creditUsd: 10, priceNok: 129 },
  { id: "pro", creditUsd: 25, priceNok: 299 },
  { id: "studio", creditUsd: 60, priceNok: 649 },
];
let _settingsCache: { at: number; val: GenSettings } | null = null;
export function invalidateGenSettings() { _settingsCache = null; }

export async function getGenSettings(pool: any): Promise<GenSettings> {
  if (_settingsCache && Date.now() - _settingsCache.at < 30_000) return _settingsCache.val;
  await pool.query(`CREATE TABLE IF NOT EXISTS generative_ai_settings (
    id int PRIMARY KEY DEFAULT 1, enabled boolean DEFAULT true,
    billing_mode text DEFAULT 'free_whitelist', daily_cap_usd numeric DEFAULT 20,
    whitelist jsonb DEFAULT '[]'::jsonb, included_quota int DEFAULT 0,
    updated_by varchar, updated_at timestamptz DEFAULT now())`).catch(() => {});
  await pool.query(`ALTER TABLE generative_ai_settings ADD COLUMN IF NOT EXISTS markup_multiplier numeric DEFAULT 3`).catch(() => {});
  await pool.query(`ALTER TABLE generative_ai_settings ADD COLUMN IF NOT EXISTS credit_packs jsonb`).catch(() => {});
  const r = await pool.query(`SELECT * FROM generative_ai_settings WHERE id = 1`).catch(() => ({ rows: [] }));
  const envWl = (process.env.GENERATIVE_AI_WHITELIST || "daniel@creatorhubn.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const envCap = Number(process.env.GENERATIVE_AI_DAILY_CAP_USD || 20);
  const row = r.rows[0];
  const bm = (m: any): GenSettings["billingMode"] => (m === "metered" || m === "credits") ? m : "free_whitelist";
  const packs = (p: any): CreditPack[] => Array.isArray(p) && p.length ? p.map((x: any) => ({ id: String(x.id), creditUsd: Number(x.creditUsd), priceNok: Number(x.priceNok) })).filter((x: any) => x.id && x.creditUsd > 0 && x.priceNok > 0) : DEFAULT_CREDIT_PACKS;
  const val: GenSettings = row ? {
    enabled: row.enabled !== false,
    billingMode: bm(row.billing_mode),
    dailyCapUsd: Number(row.daily_cap_usd ?? envCap) || envCap,
    whitelist: Array.isArray(row.whitelist) && row.whitelist.length ? row.whitelist.map((x: any) => String(x).toLowerCase()) : envWl,
    includedQuota: Number(row.included_quota ?? 0) || 0,
    markupMultiplier: Number(row.markup_multiplier ?? 3) || 3,
    creditPacks: packs(row.credit_packs),
  } : { enabled: true, billingMode: "free_whitelist", dailyCapUsd: envCap > 0 ? envCap : 20, whitelist: envWl, includedQuota: 0, markupMultiplier: 3, creditPacks: DEFAULT_CREDIT_PACKS };
  _settingsCache = { at: Date.now(), val };
  return val;
}

export function isWhitelisted(settings: GenSettings, email?: string | null, role?: string | null): boolean {
  if (role === "super_admin") return true;
  return !!email && settings.whitelist.includes(email.toLowerCase());
}

// Hvem får BRUKE AI: whitelist KUN i gratis-pilot. I betalt-modus (metered/credits)
// er det åpent for alle — faktisk bruk gates av kreditt-saldo / kunde-status.
export function aiAllowed(settings: GenSettings, email?: string | null, role?: string | null): boolean {
  if (!settings.enabled) return false;
  if (settings.billingMode === "free_whitelist") return isWhitelisted(settings, email, role);
  return true;
}

export type GenAiMeterEligibility =
  | { eligible: true; customerId: string; subscriptionId: string }
  | { eligible: false; reason:
      | "not_metered"
      | "meter_not_configured"
      | "no_stripe"
      | "no_user"
      | "no_customer"
      | "no_active_subscription"
      | "customer_not_billable"
      | "subscription_not_billable"
      | "subscription_customer_mismatch"
      | "stripe_unavailable" };

type GenAiStripeEligibilityClient = {
  customers: { retrieve: (customerId: string) => Promise<any> };
  subscriptions: { retrieve: (subscriptionId: string) => Promise<any> };
};

/**
 * Read-only, fail-closed gate used before any paid provider request.
 *
 * Meter events are intentionally not emitted here. The gate only proves that
 * the user has a live Stripe customer and an active subscription which belong
 * to each other, so a later idempotent settlement has somewhere billable to go.
 */
export async function verifyGenAiMeterEligibility(
  pool: any,
  opts: {
    userId?: string | null;
    settings: GenSettings;
    stripeClient?: GenAiStripeEligibilityClient;
  },
): Promise<GenAiMeterEligibility> {
  if (opts.settings.billingMode !== "metered") {
    return { eligible: false, reason: "not_metered" };
  }
  if (!process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME) {
    return { eligible: false, reason: "meter_not_configured" };
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { eligible: false, reason: "no_stripe" };
  if (!opts.userId) return { eligible: false, reason: "no_user" };

  const customer = await pool.query(
    `SELECT stripe_customer_id FROM stripe_customers
      WHERE user_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1`,
    [opts.userId],
  ).catch(() => ({ rows: [] }));
  const customerId = String(customer.rows[0]?.stripe_customer_id ?? "").trim();
  if (!customerId) return { eligible: false, reason: "no_customer" };

  const subscription = await pool.query(
    `SELECT stripe_subscription_id, status FROM subscriptions
      WHERE user_id = $1 AND status IN ('active','trialing')
        AND stripe_subscription_id IS NOT NULL
      ORDER BY start_date DESC LIMIT 1`,
    [opts.userId],
  ).catch(() => ({ rows: [] }));
  const subscriptionId = String(
    subscription.rows[0]?.stripe_subscription_id ?? "",
  ).trim();
  if (!subscriptionId) {
    return { eligible: false, reason: "no_active_subscription" };
  }

  try {
    let stripeClient: GenAiStripeEligibilityClient;
    if (opts.stripeClient) {
      stripeClient = opts.stripeClient;
    } else {
      const mod: any = await import("stripe");
      const Stripe = mod.default ?? mod;
      stripeClient = new Stripe(secret, {
        timeout: 10_000,
        maxNetworkRetries: 0,
      });
    }
    const [liveCustomer, liveSubscription] = await Promise.all([
      stripeClient.customers.retrieve(customerId),
      stripeClient.subscriptions.retrieve(subscriptionId),
    ]);
    if (!liveCustomer || liveCustomer.deleted === true) {
      return { eligible: false, reason: "customer_not_billable" };
    }
    const liveStatus = String(liveSubscription?.status ?? "").toLowerCase();
    if (liveStatus !== "active" && liveStatus !== "trialing") {
      return { eligible: false, reason: "subscription_not_billable" };
    }
    const liveCustomerId = typeof liveSubscription?.customer === "string"
      ? liveSubscription.customer
      : liveSubscription?.customer?.id;
    if (String(liveCustomerId ?? "") !== customerId) {
      return { eligible: false, reason: "subscription_customer_mismatch" };
    }
    return { eligible: true, customerId, subscriptionId };
  } catch {
    return { eligible: false, reason: "stripe_unavailable" };
  }
}

// ─── Sovende Stripe-metering-hook ────────────────────────────────────────────
// No-op i free_whitelist-modus ELLER til måler-env er satt. Når admin setter
// billingMode='metered' OG STRIPE_OVERAGE_GENAI_METER_EVENT_NAME finnes, emittes
// ett meter-event pr generering (samme mønster som role-room-ads-meter-emitter).
export async function emitGenAiMeter(
  pool: any,
  opts: {
    userId?: string | null;
    valueUsd: number;
    settings: GenSettings;
    billedUsdOverride?: number;
    meterEventIdentifier?: string;
    idempotencyKey?: string;
    stripeTimeoutMs?: number;
    stripeMaxNetworkRetries?: number;
  },
): Promise<{ emitted?: boolean; skipped?: string; error?: string; billedUsd?: number }> {
  if (opts.settings.billingMode !== "metered") return { skipped: "free_mode" };
  const eventName = process.env.STRIPE_OVERAGE_GENAI_METER_EVENT_NAME;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!eventName) return { skipped: "meter_not_configured" };
  if (!secret) return { skipped: "no_stripe" };
  if (!opts.userId) return { skipped: "no_user" };
  try {
    const u = await pool.query(`SELECT stripe_customer_id FROM stripe_customers WHERE user_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1`, [opts.userId]).catch(() => ({ rows: [] }));
    const customerId = u.rows[0]?.stripe_customer_id;
    if (!customerId) return { skipped: "no_customer" };
    const mod: any = await import("stripe");
    const Stripe = mod.default ?? mod;
    const stripeTimeoutMs = Number.isFinite(opts.stripeTimeoutMs)
      ? Math.min(60_000, Math.max(5_000, Math.floor(opts.stripeTimeoutMs as number)))
      : undefined;
    const stripeMaxNetworkRetries = Number.isFinite(opts.stripeMaxNetworkRetries)
      ? Math.min(2, Math.max(0, Math.floor(opts.stripeMaxNetworkRetries as number)))
      : undefined;
    const stripe = stripeTimeoutMs !== undefined
      || stripeMaxNetworkRetries !== undefined
      ? new Stripe(secret, {
        ...(stripeTimeoutMs !== undefined ? { timeout: stripeTimeoutMs } : {}),
        ...(stripeMaxNetworkRetries !== undefined
          ? { maxNetworkRetries: stripeMaxNetworkRetries } : {}),
      })
      : new Stripe(secret);
    // Kunde-pris = vår-kost × påslag → faktureres i USD-cent (Stripe-pris = $0.01/enhet).
    const billedUsd = opts.billedUsdOverride
      ?? opts.valueUsd * (opts.settings.markupMultiplier || 1);
    const value = String(Math.max(0, Math.round(billedUsd * 100)));
    await stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: { stripe_customer_id: String(customerId), value },
      ...(opts.meterEventIdentifier
        ? { identifier: opts.meterEventIdentifier }
        : {}),
    }, opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined);
    return { emitted: true, billedUsd };
  } catch (e: any) { return { error: String(e?.message || e) }; }
}

// ─── fal queue-klient (REST, ingen SDK) ──────────────────────────────────────
const FAL_BASE = "https://queue.fal.run";

export function falConfigured(): boolean { return !!process.env.FAL_KEY; }

export async function falSubmit(
  falPath: string,
  input: any,
  idempotencyKey?: string,
): Promise<{ requestId?: string; responseUrl?: string; status?: string; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { error: "fal_not_configured" };
  try {
    const r = await fetch(`${FAL_BASE}/${falPath}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(input),
    });
    if (!r.ok) return { error: `fal_submit_${r.status}` };
    const j: any = await r.json();
    return { requestId: j.request_id, responseUrl: j.response_url, status: j.status };
  } catch (e: any) { return { error: `fal_submit_threw:${e?.message || e}` }; }
}

// Poll en jobb via response_url fra submit (status/result-stien dropper /edit —
// derfor lagrer vi response_url i stedet for å rekonstruere den).
export async function falPoll(responseUrl: string): Promise<{ status: string; result?: any; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { status: "ERROR", error: "fal_not_configured" };
  try {
    const s = await fetch(`${responseUrl}/status`, { headers: { Authorization: `Key ${key}` } });
    if (!s.ok) return { status: "ERROR", error: `fal_status_${s.status}` };
    const sj: any = await s.json();
    if (sj.status !== "COMPLETED") return { status: sj.status || "IN_PROGRESS" };
    const r = await fetch(responseUrl, { headers: { Authorization: `Key ${key}` } });
    if (!r.ok) return { status: "ERROR", error: `fal_result_${r.status}` };
    return { status: "COMPLETED", result: await r.json() };
  } catch (e: any) { return { status: "ERROR", error: `fal_poll_threw:${e?.message || e}` }; }
}
