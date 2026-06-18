/**
 * roleRoomContentPlanApi — typet klient for Content Planner (mig 0322).
 * Prosjekt-scopet innholds-plan med dato (kalender/agenda).
 */
import authSessionService from './authSessionService';

export const CONTENT_PLATFORMS = ['instagram', 'tiktok', 'linkedin', 'youtube', 'facebook', 'other'] as const;
export type ContentPlatform = typeof CONTENT_PLATFORMS[number];
export const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', youtube: 'YouTube', facebook: 'Facebook', other: 'Annet',
};

export interface ContentPlanItem {
  id: string;
  projectId: string;
  title: string;
  caption: string | null;
  platform: string | null;
  scheduledAt: string | null;
  status: string; // draft | scheduled | published
  source: string; // chat | manual
  feedPlanPushed: boolean;
  notes: string | null;
  createdByRole: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const base = (projectId: string) =>
  `/api/role-room/projects/${encodeURIComponent(projectId)}/content-plan`;
function headers(json = false): Record<string, string> {
  const h = { ...authSessionService.getAuthHeadersSync() };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function listContentPlan(projectId: string): Promise<ContentPlanItem[]> {
  const res = await fetch(base(projectId), { headers: headers() });
  if (!res.ok) throw new Error(`Kunne ikke hente content-plan (HTTP ${res.status})`);
  const payload = (await res.json().catch(() => null)) as { items?: ContentPlanItem[] } | null;
  return Array.isArray(payload?.items) ? payload!.items : [];
}

export async function createContentPlanItem(
  projectId: string,
  input: { title: string; caption?: string; platform?: string; scheduledAt?: string | null; status?: string; source?: string },
): Promise<ContentPlanItem> {
  const res = await fetch(base(projectId), { method: 'POST', headers: headers(true), body: JSON.stringify(input) });
  const payload = (await res.json().catch(() => null)) as { item?: ContentPlanItem; error?: string } | null;
  if (!res.ok || !payload?.item) throw new Error(payload?.error || `Kunne ikke opprette (HTTP ${res.status})`);
  return payload.item;
}

export async function updateContentPlanItem(
  projectId: string, id: string, patch: Partial<Pick<ContentPlanItem, 'title' | 'caption' | 'platform' | 'scheduledAt' | 'status' | 'feedPlanPushed' | 'notes'>>,
): Promise<ContentPlanItem> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: headers(true), body: JSON.stringify(patch) });
  const payload = (await res.json().catch(() => null)) as { item?: ContentPlanItem; error?: string } | null;
  if (!res.ok || !payload?.item) throw new Error(payload?.error || `Kunne ikke oppdatere (HTTP ${res.status})`);
  return payload.item;
}

/** Push posten faktisk inn i feed-planneren (role_room_feed_plans). */
export async function pushToFeedPlan(projectId: string, id: string): Promise<ContentPlanItem> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}/push-to-feed`, { method: 'POST', headers: headers(true) });
  const payload = (await res.json().catch(() => null)) as { item?: ContentPlanItem; error?: string } | null;
  if (!res.ok || !payload?.item) throw new Error(payload?.error || `Kunne ikke pushe til feed-planner (HTTP ${res.status})`);
  return payload.item;
}

export async function deleteContentPlanItem(projectId: string, id: string): Promise<void> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() });
  if (!res.ok) throw new Error(`Kunne ikke slette (HTTP ${res.status})`);
}
