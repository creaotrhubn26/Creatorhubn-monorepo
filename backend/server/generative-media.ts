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

// ─── Sovende Stripe-metering-hook ────────────────────────────────────────────
// No-op i free_whitelist-modus ELLER til måler-env er satt. Når admin setter
// billingMode='metered' OG STRIPE_OVERAGE_GENAI_METER_EVENT_NAME finnes, emittes
// ett meter-event pr generering (samme mønster som role-room-ads-meter-emitter).
export async function emitGenAiMeter(
  pool: any,
  opts: { userId?: string | null; valueUsd: number; settings: GenSettings },
): Promise<{ emitted?: boolean; skipped?: string; error?: string }> {
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
    const stripe = new Stripe(secret);
    // Kunde-pris = vår-kost × påslag → faktureres i USD-cent (Stripe-pris = $0.01/enhet).
    const billedUsd = opts.valueUsd * (opts.settings.markupMultiplier || 1);
    const value = String(Math.max(0, Math.round(billedUsd * 100)));
    await stripe.billing.meterEvents.create({ event_name: eventName, payload: { stripe_customer_id: String(customerId), value } });
    return { emitted: true, billedUsd };
  } catch (e: any) { return { error: String(e?.message || e) }; }
}

// ─── fal queue-klient (REST, ingen SDK) ──────────────────────────────────────
const FAL_BASE = "https://queue.fal.run";

export function falConfigured(): boolean { return !!process.env.FAL_KEY; }

export async function falSubmit(falPath: string, input: any): Promise<{ requestId?: string; responseUrl?: string; status?: string; error?: string }> {
  const key = process.env.FAL_KEY;
  if (!key) return { error: "fal_not_configured" };
  try {
    const r = await fetch(`${FAL_BASE}/${falPath}`, {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
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
