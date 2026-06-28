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

// ─── Styring ───────────────────────────────────────────────────────────────
// Whitelist: super_admin alltid, ellers e-post i GENERATIVE_AI_WHITELIST
// (komma-separert). Default inkluderer eieren så pilot kan testes umiddelbart.
export function isAiWhitelisted(email?: string | null, role?: string | null): boolean {
  if (role === "super_admin") return true;
  const raw = process.env.GENERATIVE_AI_WHITELIST || "daniel@creatorhubn.com";
  const list = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

export function aiDailyCapUsd(): number {
  const n = Number(process.env.GENERATIVE_AI_DAILY_CAP_USD || 20);
  return Number.isFinite(n) && n > 0 ? n : 20;
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
