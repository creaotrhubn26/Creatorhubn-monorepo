/**
 * Frontend client for /api/dance/studio.
 */

import { danceAuthHeaders } from './danceAuthHeaders';

const BASE = '/api/dance/studio';

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

// ─── Types ──────────────────────────────────────────────────────────────

export type ClassKind = 'semester' | 'drop_in' | 'workshop' | 'private';
export type EnrollmentPaymentStatus = 'unpaid' | 'invoiced' | 'paid' | 'comp';

export interface DanceClass {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  title: string;
  kind: ClassKind;
  schedulePattern: string | null;
  instructorId: string | null;
  roomId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  maxStudents: number | null;
  priceKr: number | null;
  description: string | null;
  level: string | null;
  enrollmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DanceClassEnrollment {
  id: string;
  ownerUserId: string;
  classId: string;
  studentDancerId: string;
  paymentStatus: EnrollmentPaymentStatus;
  enrolledAt: string;
  notes: string | null;
}

export type InstructorContractKind = 'enk_freelance' | 'employee' | 'guest';
export interface InstructorHoursEntry {
  ymd: string;
  hours: number;
  classId?: string;
  note?: string;
}
export interface DanceInstructor {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  contractKind: InstructorContractKind;
  hourlyRateKr: number | null;
  styles: string[];
  hoursLogged: InstructorHoursEntry[];
  notes: string | null;
  specialtyText: string | null;
  avatarUrl: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  nextClassText: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RoomKind = 'mirror_studio' | 'sprung_floor' | 'ballet' | 'rehearsal' | 'theater';
export interface DanceRoom {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  name: string;
  roomKind: RoomKind;
  capacity: number | null;
  hasSprungFloor: boolean;
  hasMirror: boolean;
  hasSoundSystem: boolean;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DanceRoomBooking {
  id: string;
  ownerUserId: string;
  roomId: string;
  choreographyId: string | null;
  classId: string | null;
  purpose: string | null;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VocabCategory = 'turn' | 'leap' | 'lift' | 'extension' | 'partnering' | 'improv' | 'other';
export type VocabDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'pro';
export interface MovementVocabTerm {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  term: string;
  category: VocabCategory;
  definition: string;
  referenceVideoUrl: string | null;
  aliases: string[];
  difficulty: VocabDifficulty | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Generic CRUD ───────────────────────────────────────────────────────

async function fetchList<T>(path: string, projectId?: string | null): Promise<T[]> {
  const res = await fetch(`${BASE}${path}${qs({ projectId: projectId ?? undefined })}`, {
    headers: danceAuthHeaders(),
    credentials: 'include',
  });
  const body = await readJson<{ success: boolean; data: T[] }>(res);
  return body.data;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const body = await readJson<{ success: boolean; data: T }>(res);
  return body.data;
}

async function patchJson<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const body = await readJson<{ success: boolean; data: T }>(res);
  return body.data;
}

async function deletePath(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: danceAuthHeaders(), credentials: 'include' });
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }
}

// ─── Classes ────────────────────────────────────────────────────────────
export const listClasses = (projectId?: string | null) => fetchList<DanceClass>('/classes', projectId);
export const createClass = (input: Partial<DanceClass> & { title: string }) =>
  postJson<DanceClass>('/classes', input);
export const patchClass = (id: string, patch: Partial<DanceClass>) =>
  patchJson<DanceClass>(`/classes/${encodeURIComponent(id)}`, patch);
export const deleteClass = (id: string) => deletePath(`/classes/${encodeURIComponent(id)}`);

export const listEnrollments = async (classId: string): Promise<DanceClassEnrollment[]> => {
  const res = await fetch(`${BASE}/classes/${encodeURIComponent(classId)}/enrollments`, {
    headers: danceAuthHeaders(),
    credentials: 'include',
  });
  const body = await readJson<{ success: boolean; data: DanceClassEnrollment[] }>(res);
  return body.data;
};
export const createEnrollment = (input: { classId: string; studentDancerId: string; paymentStatus?: EnrollmentPaymentStatus; notes?: string | null }) =>
  postJson<DanceClassEnrollment>('/class-enrollments', input);
export const patchEnrollment = (id: string, patch: { paymentStatus?: EnrollmentPaymentStatus; notes?: string | null }) =>
  patchJson<DanceClassEnrollment>(`/class-enrollments/${encodeURIComponent(id)}`, patch);
export const deleteEnrollment = (id: string) => deletePath(`/class-enrollments/${encodeURIComponent(id)}`);

// ─── Instructors ────────────────────────────────────────────────────────
export const listInstructors = (projectId?: string | null) => fetchList<DanceInstructor>('/instructors', projectId);
export const createInstructor = (input: Partial<DanceInstructor> & { displayName: string }) =>
  postJson<DanceInstructor>('/instructors', input);
export const patchInstructor = (id: string, patch: Partial<DanceInstructor>) =>
  patchJson<DanceInstructor>(`/instructors/${encodeURIComponent(id)}`, patch);
export const deleteInstructor = (id: string) => deletePath(`/instructors/${encodeURIComponent(id)}`);

// ─── Rooms + Bookings ───────────────────────────────────────────────────
export const listRooms = (projectId?: string | null) => fetchList<DanceRoom>('/rooms', projectId);
export const createRoom = (input: Partial<DanceRoom> & { name: string }) =>
  postJson<DanceRoom>('/rooms', input);
export const patchRoom = (id: string, patch: Partial<DanceRoom>) =>
  patchJson<DanceRoom>(`/rooms/${encodeURIComponent(id)}`, patch);
export const deleteRoom = (id: string) => deletePath(`/rooms/${encodeURIComponent(id)}`);

export const listBookings = async (filters: { roomId?: string; from?: string; to?: string } = {}): Promise<DanceRoomBooking[]> => {
  const sp = new URLSearchParams();
  if (filters.roomId) sp.set('roomId', filters.roomId);
  if (filters.from) sp.set('from', filters.from);
  if (filters.to) sp.set('to', filters.to);
  const url = sp.toString() ? `${BASE}/room-bookings?${sp}` : `${BASE}/room-bookings`;
  const res = await fetch(url, { headers: danceAuthHeaders(), credentials: 'include' });
  const body = await readJson<{ success: boolean; data: DanceRoomBooking[] }>(res);
  return body.data;
};
export const createBooking = (input: Partial<DanceRoomBooking> & { roomId: string; startsAt: string; endsAt: string }) =>
  postJson<DanceRoomBooking>('/room-bookings', input);
export const patchBooking = (id: string, patch: Partial<DanceRoomBooking>) =>
  patchJson<DanceRoomBooking>(`/room-bookings/${encodeURIComponent(id)}`, patch);
export const deleteBooking = (id: string) => deletePath(`/room-bookings/${encodeURIComponent(id)}`);

// ─── Movement vocab ─────────────────────────────────────────────────────
export const listVocab = (projectId?: string | null) => fetchList<MovementVocabTerm>('/movement-vocab', projectId);
export const createVocab = (input: Partial<MovementVocabTerm> & { term: string; definition: string }) =>
  postJson<MovementVocabTerm>('/movement-vocab', input);
export const patchVocab = (id: string, patch: Partial<MovementVocabTerm>) =>
  patchJson<MovementVocabTerm>(`/movement-vocab/${encodeURIComponent(id)}`, patch);
export const deleteVocab = (id: string) => deletePath(`/movement-vocab/${encodeURIComponent(id)}`);

// ─── Season plan (sesongplan) ─────────────────────────────────────────────
export type SeasonMilestoneStatus = 'done' | 'upcoming';
export interface SeasonMilestone {
  id: string;
  title: string;
  dateLabel: string;
  status: SeasonMilestoneStatus;
  icon?: string;
}
export interface DanceSeason {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  label: string;
  subtitle: string | null;
  milestones: SeasonMilestone[];
  createdAt: string;
  updatedAt: string;
}
export interface DanceSeasonInput {
  label: string;
  subtitle?: string | null;
  milestones?: SeasonMilestone[];
  projectId?: string | null;
}

export const fetchSeason = async (projectId?: string | null): Promise<DanceSeason | null> => {
  const res = await fetch(`${BASE}/season${qs({ projectId: projectId ?? undefined })}`, {
    headers: danceAuthHeaders(), credentials: 'include',
  });
  const body = await readJson<{ success: boolean; data: DanceSeason | null }>(res);
  return body.data;
};
export const saveSeason = async (input: DanceSeasonInput): Promise<DanceSeason> => {
  const res = await fetch(`${BASE}/season`, {
    method: 'PUT',
    headers: danceAuthHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: JSON.stringify(input),
  });
  const body = await readJson<{ success: boolean; data: DanceSeason }>(res);
  return body.data;
};
