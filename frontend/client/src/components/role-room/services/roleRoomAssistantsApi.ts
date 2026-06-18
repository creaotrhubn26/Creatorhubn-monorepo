/**
 * roleRoomAssistantsApi — typet klient for assistent-scoping (mig 311).
 * Produsent-only: inviter assistenter m/ begrenset tilgang per prosjekt.
 */
import authSessionService from './authSessionService';

export const ASSISTANT_AREAS = [
  'deliverables', 'materials', 'plan', 'meetings', 'brief', 'economy', 'client_info', 'internal_chat',
] as const;
export type AssistantArea = typeof ASSISTANT_AREAS[number];
export const SENSITIVE_AREAS: AssistantArea[] = ['economy', 'client_info', 'internal_chat'];

export const AREA_LABELS: Record<AssistantArea, string> = {
  deliverables: 'Leveranser',
  materials: 'Materiale',
  plan: 'Plan / tidslinje',
  meetings: 'Møter',
  brief: 'Brief',
  economy: 'Økonomi / budsjett',
  client_info: 'Klient-kontaktinfo',
  internal_chat: 'Internt team-rom (chat)',
};

export const ROLE_PRESETS: { value: string; label: string }[] = [
  { value: 'editor', label: 'Redigerer' },
  { value: 'photographer', label: 'Fotograf' },
  { value: 'coordinator', label: 'Koordinator' },
  { value: 'custom', label: 'Egendefinert' },
];

export interface RoleRoomAssistant {
  id: string;
  projectId: string;
  assistantUserId: string | null;
  assistantEmail: string;
  assistantName: string | null;
  rolePreset: string;
  areas: Partial<Record<AssistantArea, boolean>>;
  status: string;
  inviteToken: string | null;
  createdAt: string | null;
  revokedAt: string | null;
}

const base = (projectId: string) =>
  `/api/role-room/projects/${encodeURIComponent(projectId)}/assistants`;

function headers(json = false): Record<string, string> {
  const h = { ...authSessionService.getAuthHeadersSync() };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function listAssistants(projectId: string): Promise<RoleRoomAssistant[]> {
  const res = await fetch(base(projectId), { headers: headers() });
  if (!res.ok) throw new Error(`Kunne ikke hente assistenter (HTTP ${res.status})`);
  const payload = (await res.json().catch(() => null)) as { items?: RoleRoomAssistant[] } | null;
  return Array.isArray(payload?.items) ? payload!.items : [];
}

export async function inviteAssistant(
  projectId: string,
  input: { email: string; name?: string; rolePreset?: string; areas?: Partial<Record<AssistantArea, boolean>> },
): Promise<RoleRoomAssistant> {
  const res = await fetch(base(projectId), { method: 'POST', headers: headers(true), body: JSON.stringify(input) });
  const payload = (await res.json().catch(() => null)) as { assistant?: RoleRoomAssistant; error?: string } | null;
  if (!res.ok || !payload?.assistant) throw new Error(payload?.error || `Kunne ikke invitere (HTTP ${res.status})`);
  return payload.assistant;
}

export async function updateAssistant(
  projectId: string, id: string, patch: { rolePreset?: string; areas?: Partial<Record<AssistantArea, boolean>>; status?: string },
): Promise<RoleRoomAssistant> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: headers(true), body: JSON.stringify(patch) });
  const payload = (await res.json().catch(() => null)) as { assistant?: RoleRoomAssistant; error?: string } | null;
  if (!res.ok || !payload?.assistant) throw new Error(payload?.error || `Kunne ikke oppdatere (HTTP ${res.status})`);
  return payload.assistant;
}

export async function revokeAssistant(projectId: string, id: string): Promise<void> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() });
  if (!res.ok) throw new Error(`Kunne ikke trekke tilbake (HTTP ${res.status})`);
}
