/**
 * campaignQueueService — sender en Kampanje-regissør-kampanje til sosial-køen.
 * POST /api/post-agent/campaign/enqueue (bearer) → poster legges som `draft`
 * i køen for godkjenning + publisering (backend fase 3b).
 */
import { loadSettings } from "../components/SettingsModal";

function getOrigin(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://www.creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}
function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export interface EnqueuePost { platform: string; body: string; facts?: unknown }

/** Køer kampanje-postene. Returnerer { created, skipped }. */
export async function enqueueCampaign(posts: EnqueuePost[]): Promise<{ created: number; skipped: number }> {
  const bearer = getBearer();
  if (!bearer) throw new Error("Ikke innlogget til The Role Room (logg inn i Settings).");
  const res = await fetch(`${getOrigin()}/api/post-agent/campaign/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ posts }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Kø-innsending feilet: HTTP ${res.status}${msg ? ` — ${msg.slice(0, 120)}` : ""}`);
  }
  return res.json() as Promise<{ created: number; skipped: number }>;
}
