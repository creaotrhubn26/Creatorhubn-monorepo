/**
 * roleRoomMessagesApi — typet klient for klient-samtalen (role_room_messages).
 * Brukes av Meldinger-fanen. Aktivitet flettes inn fra notifications separat.
 */
import authSessionService from './authSessionService';

export interface RoleRoomMessage {
  id: string;
  projectId: string;
  authorUserId: string | null;
  authorRole: string | null;
  authorName: string | null;
  body: string;
  kind: string; // message | request | answer
  status: string; // open | closed
  replyToId: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
}

const base = (projectId: string) =>
  `/api/role-room/projects/${encodeURIComponent(projectId)}/messages`;

function headers(json = false): Record<string, string> {
  const h = { ...authSessionService.getAuthHeadersSync() };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function listMessages(projectId: string): Promise<RoleRoomMessage[]> {
  const res = await fetch(base(projectId), { headers: headers() });
  if (!res.ok) throw new Error(`Kunne ikke hente meldinger (HTTP ${res.status})`);
  const payload = (await res.json().catch(() => null)) as { items?: RoleRoomMessage[] } | null;
  return Array.isArray(payload?.items) ? payload!.items : [];
}

export async function sendMessage(
  projectId: string,
  input: { body: string; kind?: string; linkedEntityType?: string; linkedEntityId?: string; authorName?: string; metadata?: Record<string, unknown> },
): Promise<RoleRoomMessage> {
  const res = await fetch(base(projectId), { method: 'POST', headers: headers(true), body: JSON.stringify(input) });
  const payload = (await res.json().catch(() => null)) as { message?: RoleRoomMessage; error?: string } | null;
  if (!res.ok || !payload?.message) throw new Error(payload?.error || `Kunne ikke sende melding (HTTP ${res.status})`);
  return payload.message;
}

export async function updateMessage(
  projectId: string, id: string, patch: { status?: string; body?: string },
): Promise<RoleRoomMessage> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: headers(true), body: JSON.stringify(patch),
  });
  const payload = (await res.json().catch(() => null)) as { message?: RoleRoomMessage; error?: string } | null;
  if (!res.ok || !payload?.message) throw new Error(payload?.error || `Kunne ikke oppdatere melding (HTTP ${res.status})`);
  return payload.message;
}
