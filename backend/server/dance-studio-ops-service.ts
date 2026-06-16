/**
 * Dance studio ops — én service-fil for de 4 hovedressursene som hører
 * studio-driften til: classes (m/ enrollments), instructors, rooms (m/
 * bookings), og movement_vocab.
 *
 * Holder dem samlet siden de deler scoping (per owner_user_id,
 * valgfri project_id) og er rene CRUD uten cross-cutting kompleksitet.
 */

import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

function generateId(prefix: string): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${randomUUID()}`;
}

function isoTs(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function isoTsOrNull(value: unknown): string | null {
  if (value == null) return null;
  return isoTs(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ═══════════════════════════════════════════════════════════════════════
//  CLASSES
// ═══════════════════════════════════════════════════════════════════════

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

function mapClassRow(row: Record<string, unknown>): DanceClass {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    title: String(row.title),
    kind: String(row.kind) as ClassKind,
    schedulePattern: row.schedule_pattern == null ? null : String(row.schedule_pattern),
    instructorId: row.instructor_id == null ? null : String(row.instructor_id),
    roomId: row.room_id == null ? null : String(row.room_id),
    startsAt: isoTsOrNull(row.starts_at),
    endsAt: isoTsOrNull(row.ends_at),
    maxStudents: asNumberOrNull(row.max_students),
    priceKr: asNumberOrNull(row.price_kr),
    description: row.description == null ? null : String(row.description),
    level: row.level == null ? null : String(row.level),
    enrollmentCount: asNumberOrNull(row.enrollment_count) ?? 0,
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapEnrollmentRow(row: Record<string, unknown>): DanceClassEnrollment {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    classId: String(row.class_id),
    studentDancerId: String(row.student_dancer_id),
    paymentStatus: String(row.payment_status) as EnrollmentPaymentStatus,
    enrolledAt: isoTs(row.enrolled_at),
    notes: row.notes == null ? null : String(row.notes),
  };
}

export interface ClassInput {
  title: string;
  kind?: ClassKind;
  schedulePattern?: string | null;
  instructorId?: string | null;
  roomId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  maxStudents?: number | null;
  priceKr?: number | null;
  description?: string | null;
  projectId?: string | null;
  level?: string | null;
}

export type ClassPatch = Partial<ClassInput>;

export async function listClasses(
  pool: Pool,
  ownerUserId: string,
  projectId?: string | null,
): Promise<DanceClass[]> {
  const conditions = ['c.owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];
  if (projectId) {
    params.push(projectId);
    conditions.push(`(c.project_id = $${params.length} OR c.project_id IS NULL)`);
  }
  const { rows } = await pool.query(
    `SELECT c.*,
            (SELECT count(*) FROM dance_class_enrollment e WHERE e.class_id = c.id) AS enrollment_count
       FROM dance_class c
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.starts_at DESC NULLS LAST, c.created_at DESC LIMIT 500`,
    params,
  );
  return rows.map((r) => mapClassRow(r));
}

export async function createClass(
  pool: Pool,
  ownerUserId: string,
  input: ClassInput,
): Promise<DanceClass> {
  const id = generateId('cls');
  const { rows } = await pool.query(
    `INSERT INTO dance_class (
       id, owner_user_id, project_id, title, kind, schedule_pattern,
       instructor_id, room_id, starts_at, ends_at, max_students, price_kr, description, level
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null, input.title, input.kind ?? 'semester',
      input.schedulePattern ?? null, input.instructorId ?? null, input.roomId ?? null,
      input.startsAt ?? null, input.endsAt ?? null, input.maxStudents ?? null,
      input.priceKr ?? null, input.description ?? null, input.level ?? null,
    ],
  );
  return mapClassRow(rows[0]);
}

export async function patchClass(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: ClassPatch,
): Promise<DanceClass | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.title !== undefined) push('title', patch.title);
  if (patch.kind !== undefined) push('kind', patch.kind);
  if (patch.schedulePattern !== undefined) push('schedule_pattern', patch.schedulePattern);
  if (patch.instructorId !== undefined) push('instructor_id', patch.instructorId);
  if (patch.roomId !== undefined) push('room_id', patch.roomId);
  if (patch.startsAt !== undefined) push('starts_at', patch.startsAt);
  if (patch.endsAt !== undefined) push('ends_at', patch.endsAt);
  if (patch.maxStudents !== undefined) push('max_students', patch.maxStudents);
  if (patch.priceKr !== undefined) push('price_kr', patch.priceKr);
  if (patch.description !== undefined) push('description', patch.description);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (patch.level !== undefined) push('level', patch.level);
  if (sets.length === 0) {
    const { rows } = await pool.query(
      `SELECT * FROM dance_class WHERE owner_user_id = $1 AND id = $2`,
      [ownerUserId, id],
    );
    return rows.length ? mapClassRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_class SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  return rows.length ? mapClassRow(rows[0]) : null;
}

export async function deleteClass(pool: Pool, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_class WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

export async function listEnrollments(
  pool: Pool,
  ownerUserId: string,
  classId: string,
): Promise<DanceClassEnrollment[]> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_class_enrollment
     WHERE owner_user_id = $1 AND class_id = $2
     ORDER BY enrolled_at DESC`,
    [ownerUserId, classId],
  );
  return rows.map((r) => mapEnrollmentRow(r));
}

export interface EnrollmentInput {
  classId: string;
  studentDancerId: string;
  paymentStatus?: EnrollmentPaymentStatus;
  notes?: string | null;
}

export async function createEnrollment(
  pool: Pool,
  ownerUserId: string,
  input: EnrollmentInput,
): Promise<DanceClassEnrollment> {
  const id = generateId('enr');
  const { rows } = await pool.query(
    `INSERT INTO dance_class_enrollment (
       id, owner_user_id, class_id, student_dancer_id, payment_status, notes
     ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      id, ownerUserId, input.classId, input.studentDancerId,
      input.paymentStatus ?? 'unpaid', input.notes ?? null,
    ],
  );
  return mapEnrollmentRow(rows[0]);
}

export async function patchEnrollment(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: { paymentStatus?: EnrollmentPaymentStatus; notes?: string | null },
): Promise<DanceClassEnrollment | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => {
    params.push(v); sets.push(`${col} = $${params.length}`);
  };
  if (patch.paymentStatus !== undefined) push('payment_status', patch.paymentStatus);
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (sets.length === 0) {
    const { rows } = await pool.query(
      `SELECT * FROM dance_class_enrollment WHERE owner_user_id = $1 AND id = $2`,
      [ownerUserId, id],
    );
    return rows.length ? mapEnrollmentRow(rows[0]) : null;
  }
  const { rows } = await pool.query(
    `UPDATE dance_class_enrollment SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  return rows.length ? mapEnrollmentRow(rows[0]) : null;
}

export async function deleteEnrollment(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_class_enrollment WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  INSTRUCTORS
// ═══════════════════════════════════════════════════════════════════════

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

function asHoursLog(value: unknown): InstructorHoursEntry[] {
  if (!Array.isArray(value)) return [];
  const out: InstructorHoursEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.ymd !== 'string' || typeof r.hours !== 'number') continue;
    const e: InstructorHoursEntry = { ymd: r.ymd, hours: r.hours };
    if (typeof r.classId === 'string') e.classId = r.classId;
    if (typeof r.note === 'string') e.note = r.note;
    out.push(e);
  }
  return out;
}

function mapInstructorRow(row: Record<string, unknown>): DanceInstructor {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    displayName: String(row.display_name),
    email: row.email == null ? null : String(row.email),
    phone: row.phone == null ? null : String(row.phone),
    contractKind: String(row.contract_kind) as InstructorContractKind,
    hourlyRateKr: asNumberOrNull(row.hourly_rate_kr),
    styles: asStringArray(row.styles),
    hoursLogged: asHoursLog(row.hours_logged),
    notes: row.notes == null ? null : String(row.notes),
    specialtyText: row.specialty_text == null ? null : String(row.specialty_text),
    avatarUrl: row.avatar_url == null ? null : String(row.avatar_url),
    ratingAvg: asNumberOrNull(row.rating_avg),
    ratingCount: asNumberOrNull(row.rating_count) ?? 0,
    nextClassText: row.next_class_text == null ? null : String(row.next_class_text),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface InstructorInput {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  contractKind?: InstructorContractKind;
  hourlyRateKr?: number | null;
  styles?: string[];
  hoursLogged?: InstructorHoursEntry[];
  notes?: string | null;
  projectId?: string | null;
  specialtyText?: string | null;
  avatarUrl?: string | null;
  ratingAvg?: number | null;
  ratingCount?: number;
  nextClassText?: string | null;
}

export type InstructorPatch = Partial<InstructorInput>;

export async function listInstructors(
  pool: Pool,
  ownerUserId: string,
  projectId?: string | null,
): Promise<DanceInstructor[]> {
  const conditions = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];
  if (projectId) {
    params.push(projectId);
    conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM dance_instructor WHERE ${conditions.join(' AND ')}
     ORDER BY display_name ASC LIMIT 500`,
    params,
  );
  return rows.map((r) => mapInstructorRow(r));
}

export async function createInstructor(
  pool: Pool,
  ownerUserId: string,
  input: InstructorInput,
): Promise<DanceInstructor> {
  const id = generateId('ins');
  const { rows } = await pool.query(
    `INSERT INTO dance_instructor (
       id, owner_user_id, project_id, display_name, email, phone,
       contract_kind, hourly_rate_kr, styles, hours_logged, notes,
       specialty_text, avatar_url, rating_avg, rating_count, next_class_text
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null,
      input.displayName, input.email ?? null, input.phone ?? null,
      input.contractKind ?? 'enk_freelance', input.hourlyRateKr ?? null,
      JSON.stringify(input.styles ?? []),
      JSON.stringify(input.hoursLogged ?? []),
      input.notes ?? null,
      input.specialtyText ?? null, input.avatarUrl ?? null,
      input.ratingAvg ?? null, input.ratingCount ?? 0, input.nextClassText ?? null,
    ],
  );
  return mapInstructorRow(rows[0]);
}

export async function patchInstructor(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: InstructorPatch,
): Promise<DanceInstructor | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => {
    params.push(v); sets.push(`${col} = $${params.length}`);
  };
  if (patch.displayName !== undefined) push('display_name', patch.displayName);
  if (patch.email !== undefined) push('email', patch.email);
  if (patch.phone !== undefined) push('phone', patch.phone);
  if (patch.contractKind !== undefined) push('contract_kind', patch.contractKind);
  if (patch.hourlyRateKr !== undefined) push('hourly_rate_kr', patch.hourlyRateKr);
  if (patch.styles !== undefined) push('styles', JSON.stringify(patch.styles));
  if (patch.hoursLogged !== undefined) push('hours_logged', JSON.stringify(patch.hoursLogged));
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.specialtyText !== undefined) push('specialty_text', patch.specialtyText);
  if (patch.avatarUrl !== undefined) push('avatar_url', patch.avatarUrl);
  if (patch.ratingAvg !== undefined) push('rating_avg', patch.ratingAvg);
  if (patch.ratingCount !== undefined) push('rating_count', patch.ratingCount);
  if (patch.nextClassText !== undefined) push('next_class_text', patch.nextClassText);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(
      `SELECT * FROM dance_instructor WHERE owner_user_id = $1 AND id = $2`,
      [ownerUserId, id],
    );
    return rows.length ? mapInstructorRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_instructor SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  return rows.length ? mapInstructorRow(rows[0]) : null;
}

export async function deleteInstructor(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_instructor WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  ROOMS + BOOKINGS
// ═══════════════════════════════════════════════════════════════════════

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

function mapRoomRow(row: Record<string, unknown>): DanceRoom {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    name: String(row.name),
    roomKind: String(row.room_kind) as RoomKind,
    capacity: asNumberOrNull(row.capacity),
    hasSprungFloor: row.has_sprung_floor === true,
    hasMirror: row.has_mirror === true,
    hasSoundSystem: row.has_sound_system === true,
    address: row.address == null ? null : String(row.address),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function mapBookingRow(row: Record<string, unknown>): DanceRoomBooking {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    roomId: String(row.room_id),
    choreographyId: row.choreography_id == null ? null : String(row.choreography_id),
    classId: row.class_id == null ? null : String(row.class_id),
    purpose: row.purpose == null ? null : String(row.purpose),
    startsAt: isoTs(row.starts_at),
    endsAt: isoTs(row.ends_at),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface RoomInput {
  name: string;
  roomKind?: RoomKind;
  capacity?: number | null;
  hasSprungFloor?: boolean;
  hasMirror?: boolean;
  hasSoundSystem?: boolean;
  address?: string | null;
  notes?: string | null;
  projectId?: string | null;
}
export type RoomPatch = Partial<RoomInput>;

export async function listRooms(
  pool: Pool,
  ownerUserId: string,
  projectId?: string | null,
): Promise<DanceRoom[]> {
  const conditions = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];
  if (projectId) {
    params.push(projectId);
    conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM dance_room WHERE ${conditions.join(' AND ')}
     ORDER BY name ASC LIMIT 200`,
    params,
  );
  return rows.map((r) => mapRoomRow(r));
}

export async function createRoom(
  pool: Pool,
  ownerUserId: string,
  input: RoomInput,
): Promise<DanceRoom> {
  const id = generateId('room');
  const { rows } = await pool.query(
    `INSERT INTO dance_room (
       id, owner_user_id, project_id, name, room_kind, capacity,
       has_sprung_floor, has_mirror, has_sound_system, address, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null,
      input.name, input.roomKind ?? 'mirror_studio',
      input.capacity ?? null,
      input.hasSprungFloor === true,
      input.hasMirror !== false,
      input.hasSoundSystem === true,
      input.address ?? null, input.notes ?? null,
    ],
  );
  return mapRoomRow(rows[0]);
}

export async function patchRoom(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: RoomPatch,
): Promise<DanceRoom | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => {
    params.push(v); sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) push('name', patch.name);
  if (patch.roomKind !== undefined) push('room_kind', patch.roomKind);
  if (patch.capacity !== undefined) push('capacity', patch.capacity);
  if (patch.hasSprungFloor !== undefined) push('has_sprung_floor', patch.hasSprungFloor);
  if (patch.hasMirror !== undefined) push('has_mirror', patch.hasMirror);
  if (patch.hasSoundSystem !== undefined) push('has_sound_system', patch.hasSoundSystem);
  if (patch.address !== undefined) push('address', patch.address);
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(
      `SELECT * FROM dance_room WHERE owner_user_id = $1 AND id = $2`,
      [ownerUserId, id],
    );
    return rows.length ? mapRoomRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_room SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  return rows.length ? mapRoomRow(rows[0]) : null;
}

export async function deleteRoom(pool: Pool, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_room WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

export interface BookingInput {
  roomId: string;
  startsAt: string;
  endsAt: string;
  choreographyId?: string | null;
  classId?: string | null;
  purpose?: string | null;
  notes?: string | null;
}

export async function listBookings(
  pool: Pool,
  ownerUserId: string,
  filters: { roomId?: string; from?: string; to?: string } = {},
): Promise<DanceRoomBooking[]> {
  const conditions = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];
  if (filters.roomId) {
    params.push(filters.roomId);
    conditions.push(`room_id = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`ends_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`starts_at <= $${params.length}`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM dance_room_booking WHERE ${conditions.join(' AND ')}
     ORDER BY starts_at ASC LIMIT 500`,
    params,
  );
  return rows.map((r) => mapBookingRow(r));
}

export async function createBooking(
  pool: Pool,
  ownerUserId: string,
  input: BookingInput,
): Promise<DanceRoomBooking> {
  const id = generateId('book');
  const { rows } = await pool.query(
    `INSERT INTO dance_room_booking (
       id, owner_user_id, room_id, choreography_id, class_id, purpose,
       starts_at, ends_at, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      id, ownerUserId, input.roomId,
      input.choreographyId ?? null, input.classId ?? null,
      input.purpose ?? null, input.startsAt, input.endsAt,
      input.notes ?? null,
    ],
  );
  return mapBookingRow(rows[0]);
}

export async function patchBooking(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: Partial<BookingInput>,
): Promise<DanceRoomBooking | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => {
    params.push(v); sets.push(`${col} = $${params.length}`);
  };
  if (patch.roomId !== undefined) push('room_id', patch.roomId);
  if (patch.startsAt !== undefined) push('starts_at', patch.startsAt);
  if (patch.endsAt !== undefined) push('ends_at', patch.endsAt);
  if (patch.choreographyId !== undefined) push('choreography_id', patch.choreographyId);
  if (patch.classId !== undefined) push('class_id', patch.classId);
  if (patch.purpose !== undefined) push('purpose', patch.purpose);
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (sets.length === 0) {
    const { rows } = await pool.query(
      `SELECT * FROM dance_room_booking WHERE owner_user_id = $1 AND id = $2`,
      [ownerUserId, id],
    );
    return rows.length ? mapBookingRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_room_booking SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  return rows.length ? mapBookingRow(rows[0]) : null;
}

export async function deleteBooking(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_room_booking WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  MOVEMENT VOCAB
// ═══════════════════════════════════════════════════════════════════════

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

function mapVocabRow(row: Record<string, unknown>): MovementVocabTerm {
  const diffRaw = row.difficulty == null ? null : String(row.difficulty);
  const isDiff = (v: string | null): v is VocabDifficulty =>
    v === 'beginner' || v === 'intermediate' || v === 'advanced' || v === 'pro';
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    term: String(row.term),
    category: String(row.category) as VocabCategory,
    definition: String(row.definition),
    referenceVideoUrl: row.reference_video_url == null ? null : String(row.reference_video_url),
    aliases: asStringArray(row.aliases),
    difficulty: diffRaw && isDiff(diffRaw) ? diffRaw : null,
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface VocabInput {
  term: string;
  category?: VocabCategory;
  definition: string;
  referenceVideoUrl?: string | null;
  aliases?: string[];
  difficulty?: VocabDifficulty | null;
  projectId?: string | null;
}
export type VocabPatch = Partial<VocabInput>;

export async function listVocab(
  pool: Pool,
  ownerUserId: string,
  projectId?: string | null,
): Promise<MovementVocabTerm[]> {
  const conditions = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];
  if (projectId) {
    params.push(projectId);
    conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM dance_movement_vocab WHERE ${conditions.join(' AND ')}
     ORDER BY term ASC LIMIT 1000`,
    params,
  );
  return rows.map((r) => mapVocabRow(r));
}

export async function createVocab(
  pool: Pool,
  ownerUserId: string,
  input: VocabInput,
): Promise<MovementVocabTerm> {
  const id = generateId('voc');
  const { rows } = await pool.query(
    `INSERT INTO dance_movement_vocab (
       id, owner_user_id, project_id, term, category, definition,
       reference_video_url, aliases, difficulty
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null,
      input.term, input.category ?? 'other', input.definition,
      input.referenceVideoUrl ?? null,
      JSON.stringify(input.aliases ?? []),
      input.difficulty ?? null,
    ],
  );
  return mapVocabRow(rows[0]);
}

export async function patchVocab(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: VocabPatch,
): Promise<MovementVocabTerm | null> {
  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => {
    params.push(v); sets.push(`${col} = $${params.length}`);
  };
  if (patch.term !== undefined) push('term', patch.term);
  if (patch.category !== undefined) push('category', patch.category);
  if (patch.definition !== undefined) push('definition', patch.definition);
  if (patch.referenceVideoUrl !== undefined) push('reference_video_url', patch.referenceVideoUrl);
  if (patch.aliases !== undefined) push('aliases', JSON.stringify(patch.aliases));
  if (patch.difficulty !== undefined) push('difficulty', patch.difficulty);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(
      `SELECT * FROM dance_movement_vocab WHERE owner_user_id = $1 AND id = $2`,
      [ownerUserId, id],
    );
    return rows.length ? mapVocabRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(
    `UPDATE dance_movement_vocab SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2 RETURNING *`,
    params,
  );
  return rows.length ? mapVocabRow(rows[0]) : null;
}

export async function deleteVocab(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_movement_vocab WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
// Sesongplan (dance_season, mig 0155) — helårsplan med milepæl-tidslinje.
// ═══════════════════════════════════════════════════════════════════════

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

function asMilestones(value: unknown): SeasonMilestone[] {
  if (!Array.isArray(value)) return [];
  const out: SeasonMilestone[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.title !== 'string') continue;
    out.push({
      id: typeof r.id === 'string' ? r.id : generateId('msn'),
      title: r.title,
      dateLabel: typeof r.dateLabel === 'string' ? r.dateLabel : '',
      status: r.status === 'done' ? 'done' : 'upcoming',
      icon: typeof r.icon === 'string' ? r.icon : undefined,
    });
  }
  return out;
}

function mapSeasonRow(row: Record<string, unknown>): DanceSeason {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    label: String(row.label),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    milestones: asMilestones(row.milestones),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export async function getSeason(
  pool: Pool,
  ownerUserId: string,
  projectId?: string | null,
): Promise<DanceSeason | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_season
      WHERE owner_user_id = $1 AND COALESCE(project_id, '') = COALESCE($2, '')
      LIMIT 1`,
    [ownerUserId, projectId ?? null],
  );
  return rows.length ? mapSeasonRow(rows[0]) : null;
}

/** Oppretter eller oppdaterer (upsert) sesongplanen for (owner, project). */
export async function upsertSeason(
  pool: Pool,
  ownerUserId: string,
  input: DanceSeasonInput,
): Promise<DanceSeason> {
  const milestones = asMilestones(input.milestones ?? []);
  const { rows } = await pool.query(
    `INSERT INTO dance_season (id, owner_user_id, project_id, label, subtitle, milestones)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (owner_user_id, COALESCE(project_id, ''))
       DO UPDATE SET label = EXCLUDED.label, subtitle = EXCLUDED.subtitle,
                     milestones = EXCLUDED.milestones, updated_at = now()
     RETURNING *`,
    [
      generateId('sea'), ownerUserId, input.projectId ?? null,
      input.label, input.subtitle ?? null, JSON.stringify(milestones),
    ],
  );
  return mapSeasonRow(rows[0]);
}
