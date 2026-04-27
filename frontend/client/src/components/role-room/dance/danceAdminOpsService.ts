/**
 * Frontend client for /api/dance/ops.
 */

const BASE = '/api/dance/ops';

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v.length > 0) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function fetchList<T>(path: string, projectId?: string | null): Promise<T[]> {
  const res = await fetch(`${BASE}${path}${qs({ projectId: projectId ?? undefined })}`, { credentials: 'include' });
  const body = await readJson<{ success: boolean; data: T[] }>(res);
  return body.data;
}
async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(payload),
  });
  const body = await readJson<{ success: boolean; data: T }>(res);
  return body.data;
}
async function patchJson<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(payload),
  });
  const body = await readJson<{ success: boolean; data: T }>(res);
  return body.data;
}
async function deletePath(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────

export type PerformanceStatus = 'planned' | 'rehearsing' | 'tickets_open' | 'sold_out' | 'completed' | 'cancelled';
export interface DancePerformanceProgramItem {
  choreographyId: string;
  durationSec?: number;
  notes?: string;
}
export interface DancePerformance {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  title: string;
  performanceDate: string;
  venue: string | null;
  status: PerformanceStatus;
  ticketUrl: string | null;
  capacity: number | null;
  ticketsSold: number;
  program: DancePerformanceProgramItem[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TonoStatus = 'pending' | 'cleared' | 'blocked' | 'unknown';
export interface DanceMusicArchiveItem {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  title: string;
  composer: string | null;
  bpm: number | null;
  musicalKey: string | null;
  durationSec: number | null;
  tonoStatus: TonoStatus;
  tonoReference: string | null;
  storageKey: string | null;
  signedUrl: string | null;
  mime: string | null;
  sourceUrl: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DanceReelClip {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  title: string;
  sourceUrl: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  storageKey: string | null;
  signedUrl: string | null;
  durationSec: number | null;
  tags: string[];
  featureOrder: number;
  publicShareToken: string | null;
  recordedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type GrantStatus = 'draft' | 'submitted' | 'in_review' | 'awarded' | 'rejected' | 'withdrawn';
export interface DanceGrantApplication {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  title: string;
  fundName: string;
  amountRequestedKr: number | null;
  amountAwardedKr: number | null;
  status: GrantStatus;
  deadline: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  applicationText: string | null;
  notes: string | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type InvoiceDelivery = 'manual' | 'ehf' | 'kid';
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPriceKr: number;
  amountKr: number;
}
export interface DanceInvoice {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  invoiceNumber: string | null;
  customerName: string;
  customerOrgNo: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  amountKr: number;
  vatKr: number;
  status: InvoiceStatus;
  deliveryMethod: InvoiceDelivery;
  kidNumber: string | null;
  ehfStatus: string | null;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  lineItems: InvoiceLineItem[];
  notes: string | null;
  fikenInvoiceId: string | null;
  tripletexInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UnionOrganization = 'skuda' | 'noda' | 'sko' | 'other';
export type UnionStatus = 'active' | 'pending' | 'inactive' | 'suspended';
export interface UnionWorkDay {
  ymd: string;
  hours: number;
  classKind?: string;
  tariffKr?: number;
  jobTitle?: string;
  project?: string;
}
export interface DanceUnionMembership {
  id: string;
  ownerUserId: string;
  organization: UnionOrganization;
  memberId: string | null;
  status: UnionStatus;
  joinedAt: string | null;
  workDays: UnionWorkDay[];
  tariffSnapshot: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── CRUD wrappers ──────────────────────────────────────────────────────

export const listPerformances = (projectId?: string | null) => fetchList<DancePerformance>('/performances', projectId);
export const createPerformance = (input: Partial<DancePerformance> & { title: string; performanceDate: string }) =>
  postJson<DancePerformance>('/performances', input);
export const patchPerformance = (id: string, patch: Partial<DancePerformance>) =>
  patchJson<DancePerformance>(`/performances/${encodeURIComponent(id)}`, patch);
export const deletePerformance = (id: string) => deletePath(`/performances/${encodeURIComponent(id)}`);

export const listMusicArchive = (projectId?: string | null) => fetchList<DanceMusicArchiveItem>('/music', projectId);
export const createMusicArchive = (input: Partial<DanceMusicArchiveItem> & { title: string }) =>
  postJson<DanceMusicArchiveItem>('/music', input);
export const patchMusicArchive = (id: string, patch: Partial<DanceMusicArchiveItem>) =>
  patchJson<DanceMusicArchiveItem>(`/music/${encodeURIComponent(id)}`, patch);
export const deleteMusicArchive = (id: string) => deletePath(`/music/${encodeURIComponent(id)}`);

export const listReel = (projectId?: string | null) => fetchList<DanceReelClip>('/reel', projectId);
export const createReel = (input: Partial<DanceReelClip> & { title: string }) =>
  postJson<DanceReelClip>('/reel', input);
export const patchReel = (id: string, patch: Partial<DanceReelClip> & { publicShareEnabled?: boolean }) =>
  patchJson<DanceReelClip>(`/reel/${encodeURIComponent(id)}`, patch);
export const deleteReel = (id: string) => deletePath(`/reel/${encodeURIComponent(id)}`);

export const listGrants = (projectId?: string | null) => fetchList<DanceGrantApplication>('/grants', projectId);
export const createGrant = (input: Partial<DanceGrantApplication> & { title: string }) =>
  postJson<DanceGrantApplication>('/grants', input);
export const patchGrant = (id: string, patch: Partial<DanceGrantApplication>) =>
  patchJson<DanceGrantApplication>(`/grants/${encodeURIComponent(id)}`, patch);
export const deleteGrant = (id: string) => deletePath(`/grants/${encodeURIComponent(id)}`);

export const listInvoices = (projectId?: string | null) => fetchList<DanceInvoice>('/invoices', projectId);
export const createInvoice = (input: Partial<DanceInvoice> & { customerName: string }) =>
  postJson<DanceInvoice>('/invoices', input);
export const patchInvoice = (id: string, patch: Partial<DanceInvoice>) =>
  patchJson<DanceInvoice>(`/invoices/${encodeURIComponent(id)}`, patch);
export const deleteInvoice = (id: string) => deletePath(`/invoices/${encodeURIComponent(id)}`);

export const listUnion = () => fetchList<DanceUnionMembership>('/union');
export const createUnion = (input: Partial<DanceUnionMembership>) =>
  postJson<DanceUnionMembership>('/union', input);
export const patchUnion = (id: string, patch: Partial<DanceUnionMembership>) =>
  patchJson<DanceUnionMembership>(`/union/${encodeURIComponent(id)}`, patch);
export const deleteUnion = (id: string) => deletePath(`/union/${encodeURIComponent(id)}`);
