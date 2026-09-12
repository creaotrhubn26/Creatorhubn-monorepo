/**
 * roleRoomDeliverablesApi — typet klient for den strukturerte leveranse-
 * modellen (data-gap #2). Speiler backend role-room-deliverables-routes.
 */
import authSessionService from './authSessionService';

export type DeliverableStatus = 'draft' | 'internal_review' | 'client_review' | 'delivered';
export type DeliverablePhase = 'preproduction' | 'production' | 'postproduction';

export const DELIVERABLE_STATUS_ORDER: DeliverableStatus[] = [
  'draft', 'internal_review', 'client_review', 'delivered',
];
export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  draft: 'Utkast',
  internal_review: 'Intern review',
  client_review: 'Klient-review',
  delivered: 'Levert',
};

export interface RoleRoomDeliverable {
  id: string;
  projectId: string;
  title: string;
  format: string | null;
  phase: DeliverablePhase | null;
  status: DeliverableStatus;
  dueAt: string | null;
  version: number;
  assigneeUserId: string | null;
  assigneeLabel: string | null;
  waitingOn: string | null;
  notes: string | null;
  sortOrder: number;
  deliveredAt: string | null;
  /** NULL = draft/intern (privat), satt = publisert til klient (status client_review/delivered). */
  publishedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliverablePatch {
  title?: string;
  format?: string | null;
  phase?: DeliverablePhase | null;
  status?: DeliverableStatus;
  dueAt?: string | null;
  assigneeUserId?: string | null;
  assigneeLabel?: string | null;
  waitingOn?: string | null;
  notes?: string | null;
  sortOrder?: number;
  bumpVersion?: boolean;
}

function headers(json = false): Record<string, string> {
  const h = { ...authSessionService.getAuthHeadersSync() };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

const base = (projectId: string) =>
  `/api/role-room/projects/${encodeURIComponent(projectId)}/deliverables`;

export async function listDeliverables(projectId: string): Promise<RoleRoomDeliverable[]> {
  const res = await fetch(base(projectId), { headers: headers() });
  const payload = (await res.json().catch(() => null)) as { items?: RoleRoomDeliverable[] } | null;
  if (!res.ok) throw new Error(`Kunne ikke hente leveranser (HTTP ${res.status})`);
  return Array.isArray(payload?.items) ? payload!.items : [];
}

export async function createDeliverable(
  projectId: string,
  input: { title: string } & Partial<Omit<DeliverablePatch, 'bumpVersion'>>,
): Promise<RoleRoomDeliverable> {
  const res = await fetch(base(projectId), {
    method: 'POST', headers: headers(true), body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => null)) as { deliverable?: RoleRoomDeliverable; error?: string } | null;
  if (!res.ok || !payload?.deliverable) throw new Error(payload?.error || `Kunne ikke opprette leveranse (HTTP ${res.status})`);
  return payload.deliverable;
}

export async function updateDeliverable(
  projectId: string,
  id: string,
  patch: DeliverablePatch,
): Promise<RoleRoomDeliverable> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: headers(true), body: JSON.stringify(patch),
  });
  const payload = (await res.json().catch(() => null)) as { deliverable?: RoleRoomDeliverable; error?: string } | null;
  if (!res.ok || !payload?.deliverable) throw new Error(payload?.error || `Kunne ikke oppdatere leveranse (HTTP ${res.status})`);
  return payload.deliverable;
}

export async function deleteDeliverable(projectId: string, id: string): Promise<void> {
  const res = await fetch(`${base(projectId)}/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: headers(),
  });
  if (!res.ok) throw new Error(`Kunne ikke slette leveranse (HTTP ${res.status})`);
}
