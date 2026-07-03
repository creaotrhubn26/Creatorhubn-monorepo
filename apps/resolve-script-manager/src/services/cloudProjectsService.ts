/**
 * cloudProjectsService — sky-synk av selve DemoProject-et (G16): scener,
 * manus, hotspots og innstillinger overlever maskinen og kan åpnes fra en
 * annen enhet. Speiler base-URL/auth-mønsteret i cloudAssetsService.
 *
 * Endepunkter (auth: RR_BEARER_TOKEN):
 *   GET    /api/role-room/demo-projects           → liste (metadata)
 *   GET    /api/role-room/demo-projects/:id       → fullt prosjekt
 *   PUT    /api/role-room/demo-projects/:id       → upsert
 *   DELETE /api/role-room/demo-projects/:id
 *
 * Base64-tunge felter (scanShots, scene-thumbnails) STRIPPES før push —
 * de er cache som gjenskapes med et skann, og sky-payloaden holdes < 1,5 MB.
 */

import { loadSettings } from "../components/SettingsModal";
import type { DemoProject } from "../components/demo-studio/demoStudioModel";

export interface CloudProjectMeta {
  id: string;
  name: string;
  url: string;
  sceneCount: number;
  updatedAt: string;
}

function getBaseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || "https://creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}
function getBearer(): string | null {
  const s = loadSettings();
  return s.RR_BEARER_TOKEN?.trim() || null;
}
function authHeaders(): Record<string, string> | null {
  const b = getBearer();
  return b ? { Authorization: `Bearer ${b}` } : null;
}

/** Slank sky-kopi: uten base64-bilder (gjenskapes lokalt med et skann). */
function slimForCloud(p: DemoProject): DemoProject {
  return {
    ...p,
    scanShots: undefined,
    scenes: p.scenes.map((s) => ({ ...s, thumbnailDataUrl: undefined })),
  };
}

/** Push (upsert) prosjektet til skyen. Stille no-op når ikke innlogget. */
export async function pushCloudProject(p: DemoProject): Promise<boolean> {
  const h = authHeaders();
  if (!h) return false;
  const res = await fetch(`${getBaseUrl()}/api/role-room/demo-projects/${encodeURIComponent(p.id)}`, {
    method: "PUT",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ project: slimForCloud(p) }),
  });
  return res.ok;
}

/** List brukerens sky-prosjekter (metadata). Tom liste når ikke innlogget/feil. */
export async function listCloudProjects(): Promise<CloudProjectMeta[]> {
  const h = authHeaders();
  if (!h) return [];
  try {
    const res = await fetch(`${getBaseUrl()}/api/role-room/demo-projects`, { headers: h });
    if (!res.ok) return [];
    const json = (await res.json()) as { projects: CloudProjectMeta[] };
    return json.projects ?? [];
  } catch {
    return [];
  }
}

/** Hent fullt prosjekt fra skyen, eller null. */
export async function pullCloudProject(id: string): Promise<DemoProject | null> {
  const h = authHeaders();
  if (!h) return null;
  try {
    const res = await fetch(`${getBaseUrl()}/api/role-room/demo-projects/${encodeURIComponent(id)}`, { headers: h });
    if (!res.ok) return null;
    const json = (await res.json()) as { project: DemoProject };
    return json.project ?? null;
  } catch {
    return null;
  }
}

/** Slett sky-kopien (den lokale røres ikke). */
export async function deleteCloudProject(id: string): Promise<boolean> {
  const h = authHeaders();
  if (!h) return false;
  try {
    const res = await fetch(`${getBaseUrl()}/api/role-room/demo-projects/${encodeURIComponent(id)}`, { method: "DELETE", headers: h });
    return res.ok;
  } catch {
    return false;
  }
}
