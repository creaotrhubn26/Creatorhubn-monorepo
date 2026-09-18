/**
 * roleCardService — rollekort og plantegning for en scene.
 *
 * Tynt lag med vilje: kortene er vanlige rader, og siden som bruker dem er
 * en redigeringsflate. Det som ligger her er de to tingene kallstedet ikke
 * skal måtte huske — at alt er prosjekt-scopet, og at lenken personen får
 * bygges av token og ingenting annet.
 */

import authSessionService from './authSessionService';

export interface RoleCard {
  id: string;
  project_id: string;
  scene_id: string | null;
  person_name: string;
  person_kind: 'extra' | 'actor' | 'crew';
  action: string;
  cue: string | null;
  position: { x: number; y: number } | null;
  wardrobe: string | null;
  frame_image_url: string | null;
  call_time: string | null;
  sort_order: number | null;
  token: string;
  revoked_at: string | null;
  contact_email: string | null;
  sent_at: string | null;
  /** Første gang kortet ble åpnet av personen selv. Null = ikke sett ennå. */
  opened_at: string | null;
  /** Personens eget svar på om hen kommer. Null = ikke svart. */
  response: 'kommer' | 'kan_ikke' | null;
  responded_at: string | null;
  response_note: string | null;
}

export interface SceneBlocking {
  planUrl: string | null;
  camera: { x: number; y: number } | null;
  updatedAt?: string;
}

export interface StoryboardFrame {
  id: string;
  frameId: string | null;
  title: string | null;
  hasImage: boolean;
  updatedAt: string;
}

export interface RoleCardDraft {
  person_name: string;
  action: string;
  person_kind?: RoleCard['person_kind'];
  cue?: string | null;
  position?: { x: number; y: number } | null;
  wardrobe?: string | null;
  frame_image_url?: string | null;
  scene_id?: string | null;
  /** Dagen kortet hører til. Stedet henger på dagen, så uten den mangler kortet oppmøtestedet. */
  production_day_id?: string | null;
  sort_order?: number | null;
  contact_email?: string | null;
}

export interface SendResultat {
  sent: number;
  sentIds: string[];
  skipped: Array<{ id: string; grunn: string }>;
}

const base = (projectId: string) => `/api/role-room/projects/${encodeURIComponent(projectId)}`;

function authFetch(path: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    credentials: 'include',
    headers: { ...(init?.headers ?? {}), ...authSessionService.getAuthHeadersSync() },
  });
}

/** Lenken personen får. Bygges ett sted, så den ikke finnes i tre varianter. */
export function roleCardLink(token: string): string {
  const origin = typeof window === 'undefined' ? 'https://theroleroom.com' : window.location.origin;
  return `${origin}/statist/${token}`;
}

export const roleCardService = {
  async list(projectId: string, sceneId?: string): Promise<RoleCard[]> {
    const q = sceneId ? `?sceneId=${encodeURIComponent(sceneId)}` : '';
    const r = await authFetch(`${base(projectId)}/role-cards${q}`);
    if (!r.ok) return [];
    return (await r.json().catch(() => null))?.cards ?? [];
  },

  async create(projectId: string, draft: RoleCardDraft): Promise<RoleCard | { error: string }> {
    const r = await authFetch(`${base(projectId)}/role-cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error ?? 'Klarte ikke å lage kortet' };
    return payload.card as RoleCard;
  },

  async update(projectId: string, id: string, patch: Partial<RoleCardDraft> & { revoked?: boolean }): Promise<RoleCard | { error: string }> {
    const r = await authFetch(`${base(projectId)}/role-cards/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error ?? 'Klarte ikke å oppdatere kortet' };
    return payload.card as RoleCard;
  },

  async remove(projectId: string, id: string): Promise<{ ok: boolean; error?: string }> {
    const r = await authFetch(`${base(projectId)}/role-cards/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) return { ok: false, error: (await r.json().catch(() => null))?.error ?? 'Klarte ikke å slette' };
    return { ok: true };
  },

  /** Rammene i scenen — uten bildene, som kan være store data-URL-er. */
  /** Sender lenken til alle i scenen som har adresse og ikke alt har fått den. */
  async send(projectId: string, sceneId: string, resend = false): Promise<SendResultat | { error: string }> {
    const r = await authFetch(`${base(projectId)}/role-cards/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, resend }),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error ?? 'Klarte ikke å sende lenkene' };
    return payload as SendResultat;
  },

  async listFrames(projectId: string, sceneId: string): Promise<StoryboardFrame[]> {
    const r = await authFetch(`${base(projectId)}/scenes/${encodeURIComponent(sceneId)}/frames`);
    if (!r.ok) return [];
    return (await r.json().catch(() => null))?.frames ?? [];
  },

  /** Bildet, først når én ramme er valgt. */
  async frameImage(projectId: string, frameId: string): Promise<string | null> {
    const r = await authFetch(`${base(projectId)}/frames/${encodeURIComponent(frameId)}/image`);
    if (!r.ok) return null;
    return (await r.json().catch(() => null))?.imageData ?? null;
  },

  async getBlocking(projectId: string, sceneId: string): Promise<SceneBlocking | null> {
    const r = await authFetch(`${base(projectId)}/scenes/${encodeURIComponent(sceneId)}/blocking`);
    if (!r.ok) return null;
    return (await r.json().catch(() => null))?.blocking ?? null;
  },

  async saveBlocking(projectId: string, sceneId: string, blocking: SceneBlocking): Promise<SceneBlocking | { error: string }> {
    const r = await authFetch(`${base(projectId)}/scenes/${encodeURIComponent(sceneId)}/blocking`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blocking),
    });
    const payload = await r.json().catch(() => null);
    if (!r.ok) return { error: payload?.error ?? 'Klarte ikke å lagre plantegningen' };
    return payload.blocking as SceneBlocking;
  },
};

export default roleCardService;
