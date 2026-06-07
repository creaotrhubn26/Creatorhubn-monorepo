/**
 * cloudAssetsService — synk av Demo Studio-biblioteket til backend (delt på
 * tvers av enheter/team). Speiler base-URL/auth-mønsteret i brandAssetsService.
 */
import { loadSettings } from "../components/SettingsModal";
import type { AssetItem } from "../components/demo-studio/assetLibrary";

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}
function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}
function authHeaders(): Record<string, string> {
  const b = getBearer();
  if (!b) throw new Error("Ikke innlogget — RR_BEARER_TOKEN mangler");
  return { Authorization: `Bearer ${b}` };
}

export async function pushCloudAsset(a: AssetItem): Promise<{ id: string }> {
  const res = await fetch(`${getBaseUrl()}/api/role-room/demo-assets`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ kind: a.kind, title: a.title, host: a.host, svg: a.svg, text: a.text, dataUrl: a.dataUrl, note: a.note }),
  });
  if (!res.ok) throw new Error(`sky-lagring: HTTP ${res.status}`);
  return (await res.json()) as { id: string };
}

export async function listCloudAssets(host?: string): Promise<AssetItem[]> {
  const u = host ? `?host=${encodeURIComponent(host)}` : "";
  const res = await fetch(`${getBaseUrl()}/api/role-room/demo-assets${u}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`sky-liste: HTTP ${res.status}`);
  const json = (await res.json()) as { assets: AssetItem[] };
  return json.assets;
}

export async function removeCloudAsset(id: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/role-room/demo-assets/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`sky-slett: HTTP ${res.status}`);
}
