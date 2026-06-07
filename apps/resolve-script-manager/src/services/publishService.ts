/**
 * publishService — publiser en selvstendig interaktiv guide (HTML) til en
 * PERMANENT, delbar offentlig lenke via backend (B2-backet, servert på /g/:id).
 * Auth: RR_BEARER_TOKEN. Speiler base-URL-mønsteret i brandAssetsService.
 */

import { loadSettings } from "../components/SettingsModal";

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}
function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}

export interface PublishedGuide { id: string; url: string; bytes?: number }

/** Publiser guide-HTML → returner offentlig delbar lenke. */
export async function publishGuide(html: string, name: string): Promise<PublishedGuide> {
  const bearer = getBearer();
  if (!bearer) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");
  const res = await fetch(`${getBaseUrl()}/api/role-room/published-guides`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify({ html, name }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 503) throw new Error("Publisering ikke aktivert på serveren (B2_ROLE_ROOM_* mangler).");
    throw new Error(`publish: HTTP ${res.status} ${detail}`.trim());
  }
  return (await res.json()) as PublishedGuide;
}
