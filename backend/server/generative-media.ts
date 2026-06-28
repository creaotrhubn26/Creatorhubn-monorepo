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
    sendsPersonalData: true,
  },
};

export function publicModelList() {
  return Object.values(GEN_MODELS).map((m) => ({ key: m.key, label: m.label, kind: m.kind, provider: m.provider, estCostUsd: m.estCostUsd }));
}

// ─── Styring (DB-basert, admin-redigerbar — env som fallback) ────────────────
// Konfig ligger i generative_ai_settings (singleton id=1) slik at admin kan
// skru av/på, bytte billing-modus, sette dagstak/whitelist/kvote fra Admin
// Dashboard — uten å røre env. Env brukes kun som default når raden mangler.
export interface GenSettings {
  enabled: boolean;
  billingMode: "free_whitelist" | "metered";
  dailyCapUsd: number;
  whitelist: string[];     // e-poster (lowercase)
  includedQuota: number;   // inkluderte genereringer pr bruker pr mnd (metered)
}
let _settingsCache: { at: number; val: GenSettings } | null = null;
export function invalidateGenSettings() { _settingsCache = null; }

export async function getGenSettings(pool: any): Promise<GenSettings> {
  if (_settingsCache && Date.now() - _settingsCache.at < 30_000) return _settingsCache.val;
  await pool.query(`CREATE TABLE IF NOT EXISTS generative_ai_settings (
    id int PRIMARY KEY DEFAULT 1, enabled boolean DEFAULT true,
    billing_mode text DEFAULT 'free_whitelist', daily_cap_usd numeric DEFAULT 20,
    whitelist jsonb DEFAULT '[]'::jsonb, included_quota int DEFAULT 0,
    updated_by varchar, updated_at timestamptz DEFAULT now())`).catch(() => {});
  const r = await pool.query(`SELECT * FROM generative_ai_settings WHERE id = 1`).catch(() => ({ rows: [] }));
  const envWl = (process.env.GENERATIVE_AI_WHITELIST || "daniel@creatorhubn.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const envCap = Number(process.env.GENERATIVE_AI_DAILY_CAP_USD || 20);
  const row = r.rows[0];
  const val: GenSettings = row ? {
    enabled: row.enabled !== false,
    billingMode: row.billing_mode === "metered" ? "metered" : "free_whitelist",
    dailyCapUsd: Number(row.daily_cap_usd ?? envCap) || envCap,
    whitelist: Array.isArray(row.whitelist) && row.whitelist.length ? row.whitelist.map((x: any) => String(x).toLowerCase()) : envWl,
    includedQuota: Number(row.included_quota ?? 0) || 0,
  } : { enabled: true, billingMode: "free_whitelist", dailyCapUsd: envCap > 0 ? envCap : 20, whitelist: envWl, includedQuota: 0 };
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
    const value = String(Math.max(0, Math.round(opts.valueUsd * 100))); // USD-cent
    await stripe.billing.meterEvents.create({ event_name: eventName, payload: { stripe_customer_id: String(customerId), value } });
    return { emitted: true };
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
