/**
 * Sky-synk for Mockup Studio.
 *
 * Lokal lagring er fortsatt første sannhetskilde under redigering. Ved åpning
 * flettes lokal og ekstern kopi etter MockupDoc.updatedAt; lokale endringer
 * debounces til skyen, og serveren avviser eldre overskrivinger.
 */

import { loadSettings } from "../components/SettingsModal";
import type { MockupDoc } from "../components/mockup-studio/mockupStudioModel";

export interface CloudMockupProjectMeta {
  id: string;
  name: string;
  status: string;
  template: string;
  projectUpdatedAt: number;
  syncedAt: string;
}

function getBaseUrl(): string {
  const settings = loadSettings();
  const base = settings.RR_POST_AGENT_BASE_URL || "https://www.creatorhubn.com/api/post-agent";
  return base.replace(/\/api\/post-agent\/?$/, "");
}

function authHeaders(): Record<string, string> | null {
  const bearer = loadSettings().RR_BEARER_TOKEN?.trim();
  return bearer ? { Authorization: `Bearer ${bearer}` } : null;
}

export async function pushCloudMockupProject(
  project: MockupDoc,
  signal?: AbortSignal,
): Promise<boolean> {
  const headers = authHeaders();
  if (!headers) return false;
  try {
    const response = await fetch(
      `${getBaseUrl()}/api/role-room/mockup-projects/${encodeURIComponent(project.id)}`,
      {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
        signal,
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

async function listCloudMockupProjects(): Promise<CloudMockupProjectMeta[] | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const response = await fetch(`${getBaseUrl()}/api/role-room/mockup-projects`,
      { headers },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as {
      projects?: CloudMockupProjectMeta[];
    };
    return Array.isArray(json.projects) ? json.projects : [];
  } catch {
    return null;
  }
}

export async function pullCloudMockupProject(
  id: string,
): Promise<MockupDoc | null> {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const response = await fetch(
      `${getBaseUrl()}/api/role-room/mockup-projects/${encodeURIComponent(id)}`,
      { headers },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { project?: MockupDoc };
    return json.project ?? null;
  } catch {
    return null;
  }
}

/**
 * Toveis oppstartssynk. Ved nettverks-/auth-feil beholdes lokale data urørt.
 * Ukjente eller nyere skyprosjekter lastes ned; lokale nyere/ukjente prosjekter
 * backfylles til skyen.
 */
export async function syncCloudMockupProjects(localProjects: MockupDoc[]): Promise<MockupDoc[]> {
  const remoteMeta = await listCloudMockupProjects();
  if (remoteMeta === null) return localProjects;

  const localById = new Map(localProjects.map((project) => [project.id, project]));
  const remoteById = new Map(remoteMeta.map((meta) => [meta.id, meta]));
  const pullIds = remoteMeta
    .filter((meta) => {
      const local = localById.get(meta.id);
      return !local || meta.projectUpdatedAt > local.updatedAt;
    })
    .map((meta) => meta.id);

  const pulled = await Promise.all(pullIds.map((id) => pullCloudMockupProject(id)));
  const merged = new Map(localById);
  for (const project of pulled) {
    if (!project) continue;
    const local = merged.get(project.id);
    if (!local || project.updatedAt > local.updatedAt) merged.set(project.id, project);
  }

  const uploads = [...merged.values()].filter((project) => {
    const remote = remoteById.get(project.id);
    return !remote || project.updatedAt > remote.projectUpdatedAt;
  });
  await Promise.allSettled(uploads.map((project) => pushCloudMockupProject(project)));

  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

const pending = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, AbortController>();

/** Debouncet autolagring så dra-operasjoner ikke lager én forespørsel per frame. */
export function scheduleCloudMockupProject(project: MockupDoc): void {
  const existingTimer = pending.get(project.id);
  if (existingTimer) clearTimeout(existingTimer);
  inFlight.get(project.id)?.abort();

  const timer = setTimeout(() => {
    pending.delete(project.id);
    const controller = new AbortController();
    inFlight.set(project.id, controller);
    void pushCloudMockupProject(project, controller.signal).finally(() => {
      if (inFlight.get(project.id) === controller) inFlight.delete(project.id);
    });
  }, 1_200);
  pending.set(project.id, timer);
}

/** Avbryt ventende push før sletting, så prosjektet ikke gjenopprettes av et race. */
export async function deleteCloudMockupProject(id: string): Promise<boolean> {
  const timer = pending.get(id);
  if (timer) clearTimeout(timer);
  pending.delete(id);
  inFlight.get(id)?.abort();
  inFlight.delete(id);

  const headers = authHeaders();
  if (!headers) return false;
  try {
    const response = await fetch(
      `${getBaseUrl()}/api/role-room/mockup-projects/${encodeURIComponent(id)}`,
      { method: "DELETE", headers },
    );
    return response.ok;
  } catch {
    return false;
  }
}
