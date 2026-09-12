/**
 * roleRoomMeetingsApi — typet klient for møte-flyten (role_room_meetings).
 * Brukes av Møter-fanen i Creative Sync Workspace (produsent + klient).
 */
import authSessionService from './authSessionService';

export interface MeetingParticipant {
  name?: string;
  email?: string;
  role?: string; // 'Produsent' | 'Klient' | fri tekst
}

export interface MeetingActionItem {
  text: string;
  owner?: string;
  done?: boolean;
}

export interface RoleRoomMeeting {
  id: string;
  projectId: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  participants: MeetingParticipant[];
  meetLink: string | null;
  calendarEventId: string | null;
  location: string | null;
  status: string; // upcoming | completed | cancelled
  notes: string | null;
  notesStatus: string; // pending | ready
  agenda: string[];
  actionItems: MeetingActionItem[];
  clientVisible: boolean;
  createdByRole: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateMeetingInput {
  title: string;
  startsAt?: string | null;
  endsAt?: string | null;
  timeZone?: string;
  participants?: MeetingParticipant[];
  generateMeet?: boolean;
  meetLink?: string | null;
  location?: string | null;
  projectName?: string | null;
  clientVisible?: boolean;
  agenda?: string[];
}

const base = (projectId: string) =>
  `/api/role-room/projects/${encodeURIComponent(projectId)}/meetings`;

function headers(json = false): Record<string, string> {
  const h = { ...authSessionService.getAuthHeadersSync() };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function listMeetings(projectId: string): Promise<RoleRoomMeeting[]> {
  const res = await fetch(base(projectId), { headers: headers() });
  if (!res.ok) throw new Error(`Kunne ikke hente møter (HTTP ${res.status})`);
  const payload = (await res.json().catch(() => null)) as { items?: RoleRoomMeeting[] } | null;
  return Array.isArray(payload?.items) ? payload!.items : [];
}

export async function createMeeting(projectId: string, input: CreateMeetingInput): Promise<RoleRoomMeeting> {
  const res = await fetch(base(projectId), {
    method: 'POST', headers: headers(true), body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => null)) as { meeting?: RoleRoomMeeting; error?: string } | null;
  if (!res.ok || !payload?.meeting) throw new Error(payload?.error || `Kunne ikke opprette møte (HTTP ${res.status})`);
  return payload.meeting;
}

export async function updateMeeting(
  projectId: string, id: string, patch: Partial<RoleRoomMeeting>,
): Promise<RoleRoomMeeting> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: headers(true), body: JSON.stringify(patch),
  });
  const payload = (await res.json().catch(() => null)) as { meeting?: RoleRoomMeeting; error?: string } | null;
  if (!res.ok || !payload?.meeting) throw new Error(payload?.error || `Kunne ikke oppdatere møte (HTTP ${res.status})`);
  return payload.meeting;
}

export async function deleteMeeting(projectId: string, id: string): Promise<void> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() });
  if (!res.ok) throw new Error(`Kunne ikke slette møte (HTTP ${res.status})`);
}
