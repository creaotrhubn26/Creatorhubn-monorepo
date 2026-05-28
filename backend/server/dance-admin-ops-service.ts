/**
 * Dance admin ops — service-lag for performance, music_archive,
 * reel_clip, grant_application, invoice, union_membership.
 *
 * Ren CRUD per ressurs, alle scoped på owner_user_id (+ valgfri project_id).
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
function asNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

// ═══════════════════════════════════════════════════════════════════════
//  PERFORMANCES
// ═══════════════════════════════════════════════════════════════════════

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

function asProgram(value: unknown): DancePerformanceProgramItem[] {
  if (!Array.isArray(value)) return [];
  const out: DancePerformanceProgramItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.choreographyId !== 'string') continue;
    const item: DancePerformanceProgramItem = { choreographyId: r.choreographyId };
    if (typeof r.durationSec === 'number') item.durationSec = r.durationSec;
    if (typeof r.notes === 'string') item.notes = r.notes;
    out.push(item);
  }
  return out;
}

function mapPerformanceRow(row: Record<string, unknown>): DancePerformance {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    title: String(row.title),
    performanceDate: isoTs(row.performance_date),
    venue: row.venue == null ? null : String(row.venue),
    status: String(row.status) as PerformanceStatus,
    ticketUrl: row.ticket_url == null ? null : String(row.ticket_url),
    capacity: asNumberOrNull(row.capacity),
    ticketsSold: Number(row.tickets_sold) || 0,
    program: asProgram(row.program),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface PerformanceInput {
  title: string;
  performanceDate: string;
  venue?: string | null;
  status?: PerformanceStatus;
  ticketUrl?: string | null;
  capacity?: number | null;
  ticketsSold?: number;
  program?: DancePerformanceProgramItem[];
  notes?: string | null;
  projectId?: string | null;
}
export type PerformancePatch = Partial<PerformanceInput>;

export async function listPerformances(
  pool: Pool,
  ownerUserId: string,
  projectId?: string | null,
): Promise<DancePerformance[]> {
  const conditions = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];
  if (projectId) {
    params.push(projectId);
    conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM dance_performance WHERE ${conditions.join(' AND ')}
     ORDER BY performance_date DESC LIMIT 500`,
    params,
  );
  return rows.map((r) => mapPerformanceRow(r));
}

export async function createPerformance(pool: Pool, ownerUserId: string, input: PerformanceInput): Promise<DancePerformance> {
  const id = generateId('perf');
  const { rows } = await pool.query(
    `INSERT INTO dance_performance (
       id, owner_user_id, project_id, title, performance_date, venue, status,
       ticket_url, capacity, tickets_sold, program, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null, input.title, input.performanceDate,
      input.venue ?? null, input.status ?? 'planned', input.ticketUrl ?? null,
      input.capacity ?? null, input.ticketsSold ?? 0,
      JSON.stringify(input.program ?? []), input.notes ?? null,
    ],
  );
  return mapPerformanceRow(rows[0]);
}

export async function patchPerformance(pool: Pool, ownerUserId: string, id: string, patch: PerformancePatch): Promise<DancePerformance | null> {
  const sets: string[] = []; const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.title !== undefined) push('title', patch.title);
  if (patch.performanceDate !== undefined) push('performance_date', patch.performanceDate);
  if (patch.venue !== undefined) push('venue', patch.venue);
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.ticketUrl !== undefined) push('ticket_url', patch.ticketUrl);
  if (patch.capacity !== undefined) push('capacity', patch.capacity);
  if (patch.ticketsSold !== undefined) push('tickets_sold', patch.ticketsSold);
  if (patch.program !== undefined) push('program', JSON.stringify(patch.program));
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM dance_performance WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
    return rows.length ? mapPerformanceRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(`UPDATE dance_performance SET ${sets.join(', ')} WHERE owner_user_id = $1 AND id = $2 RETURNING *`, params);
  return rows.length ? mapPerformanceRow(rows[0]) : null;
}

export async function deletePerformance(pool: Pool, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM dance_performance WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  AUDITIONS
// ═══════════════════════════════════════════════════════════════════════

export type AuditionStatus = 'open' | 'applied' | 'shortlisted' | 'rejected' | 'accepted' | 'withdrawn' | 'closed';

export interface DanceAudition {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  title: string;
  organizer: string;
  deadline: string | null;
  auditionDate: string | null;
  location: string | null;
  status: AuditionStatus;
  applied: boolean;
  appliedAt: string | null;
  sourceUrl: string | null;
  feeKr: number | null;
  requirements: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapAuditionRow(row: Record<string, unknown>): DanceAudition {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    title: String(row.title),
    organizer: String(row.organizer),
    deadline: isoTsOrNull(row.deadline),
    auditionDate: isoTsOrNull(row.audition_date),
    location: row.location == null ? null : String(row.location),
    status: String(row.status) as AuditionStatus,
    applied: Boolean(row.applied),
    appliedAt: isoTsOrNull(row.applied_at),
    sourceUrl: row.source_url == null ? null : String(row.source_url),
    feeKr: asNumberOrNull(row.fee_kr),
    requirements: row.requirements == null ? null : String(row.requirements),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface AuditionInput {
  title: string;
  organizer: string;
  deadline?: string | null;
  auditionDate?: string | null;
  location?: string | null;
  status?: AuditionStatus;
  applied?: boolean;
  appliedAt?: string | null;
  sourceUrl?: string | null;
  feeKr?: number | null;
  requirements?: string | null;
  notes?: string | null;
  projectId?: string | null;
}
export type AuditionPatch = Partial<AuditionInput>;

export async function listAuditions(
  pool: Pool,
  ownerUserId: string,
  projectId?: string | null,
): Promise<DanceAudition[]> {
  const conditions = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];
  if (projectId) {
    params.push(projectId);
    conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM dance_audition WHERE ${conditions.join(' AND ')}
     ORDER BY deadline ASC NULLS LAST LIMIT 500`,
    params,
  );
  return rows.map((r) => mapAuditionRow(r));
}

export async function createAudition(pool: Pool, ownerUserId: string, input: AuditionInput): Promise<DanceAudition> {
  const id = generateId('aud');
  const { rows } = await pool.query(
    `INSERT INTO dance_audition (
       id, owner_user_id, project_id, title, organizer, deadline, audition_date, location,
       status, applied, applied_at, source_url, fee_kr, requirements, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null, input.title, input.organizer,
      input.deadline ?? null, input.auditionDate ?? null, input.location ?? null,
      input.status ?? 'open', input.applied ?? false, input.appliedAt ?? null,
      input.sourceUrl ?? null, input.feeKr ?? null, input.requirements ?? null, input.notes ?? null,
    ],
  );
  return mapAuditionRow(rows[0]);
}

export async function patchAudition(pool: Pool, ownerUserId: string, id: string, patch: AuditionPatch): Promise<DanceAudition | null> {
  const sets: string[] = []; const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.title !== undefined) push('title', patch.title);
  if (patch.organizer !== undefined) push('organizer', patch.organizer);
  if (patch.deadline !== undefined) push('deadline', patch.deadline);
  if (patch.auditionDate !== undefined) push('audition_date', patch.auditionDate);
  if (patch.location !== undefined) push('location', patch.location);
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.applied !== undefined) push('applied', patch.applied);
  if (patch.appliedAt !== undefined) push('applied_at', patch.appliedAt);
  if (patch.sourceUrl !== undefined) push('source_url', patch.sourceUrl);
  if (patch.feeKr !== undefined) push('fee_kr', patch.feeKr);
  if (patch.requirements !== undefined) push('requirements', patch.requirements);
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM dance_audition WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
    return rows.length ? mapAuditionRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(`UPDATE dance_audition SET ${sets.join(', ')} WHERE owner_user_id = $1 AND id = $2 RETURNING *`, params);
  return rows.length ? mapAuditionRow(rows[0]) : null;
}

export async function deleteAudition(pool: Pool, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM dance_audition WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  MUSIC ARCHIVE
// ═══════════════════════════════════════════════════════════════════════

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

function mapMusicRow(row: Record<string, unknown>): DanceMusicArchiveItem {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    title: String(row.title),
    composer: row.composer == null ? null : String(row.composer),
    bpm: asNumberOrNull(row.bpm),
    musicalKey: row.musical_key == null ? null : String(row.musical_key),
    durationSec: asNumberOrNull(row.duration_sec),
    tonoStatus: String(row.tono_status) as TonoStatus,
    tonoReference: row.tono_reference == null ? null : String(row.tono_reference),
    storageKey: row.storage_key == null ? null : String(row.storage_key),
    signedUrl: row.signed_url == null ? null : String(row.signed_url),
    mime: row.mime == null ? null : String(row.mime),
    sourceUrl: row.source_url == null ? null : String(row.source_url),
    tags: asStringArray(row.tags),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface MusicArchiveInput {
  title: string;
  composer?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  durationSec?: number | null;
  tonoStatus?: TonoStatus;
  tonoReference?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
  notes?: string | null;
  projectId?: string | null;
}
export type MusicArchivePatch = Partial<MusicArchiveInput>;

export async function listMusic(pool: Pool, ownerUserId: string, projectId?: string | null): Promise<DanceMusicArchiveItem[]> {
  const conditions = ['owner_user_id = $1']; const params: unknown[] = [ownerUserId];
  if (projectId) { params.push(projectId); conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`); }
  const { rows } = await pool.query(`SELECT * FROM dance_music_archive WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 500`, params);
  return rows.map((r) => mapMusicRow(r));
}

export async function createMusic(pool: Pool, ownerUserId: string, input: MusicArchiveInput): Promise<DanceMusicArchiveItem> {
  const id = generateId('mus');
  const { rows } = await pool.query(
    `INSERT INTO dance_music_archive (
       id, owner_user_id, project_id, title, composer, bpm, musical_key,
       duration_sec, tono_status, tono_reference, source_url, tags, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null, input.title,
      input.composer ?? null, input.bpm ?? null, input.musicalKey ?? null,
      input.durationSec ?? null, input.tonoStatus ?? 'unknown',
      input.tonoReference ?? null, input.sourceUrl ?? null,
      JSON.stringify(input.tags ?? []), input.notes ?? null,
    ],
  );
  return mapMusicRow(rows[0]);
}

export async function patchMusic(pool: Pool, ownerUserId: string, id: string, patch: MusicArchivePatch): Promise<DanceMusicArchiveItem | null> {
  const sets: string[] = []; const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.title !== undefined) push('title', patch.title);
  if (patch.composer !== undefined) push('composer', patch.composer);
  if (patch.bpm !== undefined) push('bpm', patch.bpm);
  if (patch.musicalKey !== undefined) push('musical_key', patch.musicalKey);
  if (patch.durationSec !== undefined) push('duration_sec', patch.durationSec);
  if (patch.tonoStatus !== undefined) push('tono_status', patch.tonoStatus);
  if (patch.tonoReference !== undefined) push('tono_reference', patch.tonoReference);
  if (patch.sourceUrl !== undefined) push('source_url', patch.sourceUrl);
  if (patch.tags !== undefined) push('tags', JSON.stringify(patch.tags));
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM dance_music_archive WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
    return rows.length ? mapMusicRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(`UPDATE dance_music_archive SET ${sets.join(', ')} WHERE owner_user_id = $1 AND id = $2 RETURNING *`, params);
  return rows.length ? mapMusicRow(rows[0]) : null;
}

export async function deleteMusic(pool: Pool, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM dance_music_archive WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  REEL CLIPS
// ═══════════════════════════════════════════════════════════════════════

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

function mapReelRow(row: Record<string, unknown>): DanceReelClip {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    title: String(row.title),
    sourceUrl: row.source_url == null ? null : String(row.source_url),
    embedUrl: row.embed_url == null ? null : String(row.embed_url),
    thumbnailUrl: row.thumbnail_url == null ? null : String(row.thumbnail_url),
    storageKey: row.storage_key == null ? null : String(row.storage_key),
    signedUrl: row.signed_url == null ? null : String(row.signed_url),
    durationSec: asNumberOrNull(row.duration_sec),
    tags: asStringArray(row.tags),
    featureOrder: Number(row.feature_order) || 0,
    publicShareToken: row.public_share_token == null ? null : String(row.public_share_token),
    recordedAt: isoTsOrNull(row.recorded_at),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface ReelClipInput {
  title: string;
  sourceUrl?: string | null;
  embedUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  tags?: string[];
  featureOrder?: number;
  recordedAt?: string | null;
  notes?: string | null;
  projectId?: string | null;
}
export type ReelClipPatch = Partial<ReelClipInput> & { publicShareEnabled?: boolean };

export async function listReel(pool: Pool, ownerUserId: string, projectId?: string | null): Promise<DanceReelClip[]> {
  const conditions = ['owner_user_id = $1']; const params: unknown[] = [ownerUserId];
  if (projectId) { params.push(projectId); conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`); }
  const { rows } = await pool.query(`SELECT * FROM dance_reel_clip WHERE ${conditions.join(' AND ')} ORDER BY feature_order DESC, recorded_at DESC NULLS LAST, created_at DESC LIMIT 200`, params);
  return rows.map((r) => mapReelRow(r));
}

export async function getReelByShareToken(pool: Pool, token: string): Promise<DanceReelClip[]> {
  // Public unauthenticated lookup — returns only clips with that share token.
  const { rows } = await pool.query(
    `SELECT * FROM dance_reel_clip WHERE public_share_token = $1 LIMIT 1`,
    [token],
  );
  return rows.map((r) => mapReelRow(r));
}

export async function getOwnerPublicReel(pool: Pool, ownerUserId: string): Promise<DanceReelClip[]> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_reel_clip
     WHERE owner_user_id = $1 AND public_share_token IS NOT NULL
     ORDER BY feature_order DESC, recorded_at DESC NULLS LAST, created_at DESC LIMIT 200`,
    [ownerUserId],
  );
  return rows.map((r) => mapReelRow(r));
}

export async function createReel(pool: Pool, ownerUserId: string, input: ReelClipInput): Promise<DanceReelClip> {
  const id = generateId('reel');
  const { rows } = await pool.query(
    `INSERT INTO dance_reel_clip (
       id, owner_user_id, project_id, title, source_url, embed_url,
       thumbnail_url, duration_sec, tags, feature_order, recorded_at, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null, input.title,
      input.sourceUrl ?? null, input.embedUrl ?? null, input.thumbnailUrl ?? null,
      input.durationSec ?? null, JSON.stringify(input.tags ?? []),
      input.featureOrder ?? 0, input.recordedAt ?? null, input.notes ?? null,
    ],
  );
  return mapReelRow(rows[0]);
}

export async function patchReel(pool: Pool, ownerUserId: string, id: string, patch: ReelClipPatch): Promise<DanceReelClip | null> {
  const sets: string[] = []; const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.title !== undefined) push('title', patch.title);
  if (patch.sourceUrl !== undefined) push('source_url', patch.sourceUrl);
  if (patch.embedUrl !== undefined) push('embed_url', patch.embedUrl);
  if (patch.thumbnailUrl !== undefined) push('thumbnail_url', patch.thumbnailUrl);
  if (patch.durationSec !== undefined) push('duration_sec', patch.durationSec);
  if (patch.tags !== undefined) push('tags', JSON.stringify(patch.tags));
  if (patch.featureOrder !== undefined) push('feature_order', patch.featureOrder);
  if (patch.recordedAt !== undefined) push('recorded_at', patch.recordedAt);
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (patch.publicShareEnabled === true) {
    push('public_share_token', generateId('share').slice(6));
  } else if (patch.publicShareEnabled === false) {
    push('public_share_token', null);
  }
  if (sets.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM dance_reel_clip WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
    return rows.length ? mapReelRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(`UPDATE dance_reel_clip SET ${sets.join(', ')} WHERE owner_user_id = $1 AND id = $2 RETURNING *`, params);
  return rows.length ? mapReelRow(rows[0]) : null;
}

export async function deleteReel(pool: Pool, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM dance_reel_clip WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  GRANTS
// ═══════════════════════════════════════════════════════════════════════

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

function mapGrantRow(row: Record<string, unknown>): DanceGrantApplication {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    title: String(row.title),
    fundName: String(row.fund_name),
    amountRequestedKr: asNumberOrNull(row.amount_requested_kr),
    amountAwardedKr: asNumberOrNull(row.amount_awarded_kr),
    status: String(row.status) as GrantStatus,
    deadline: isoTsOrNull(row.deadline),
    submittedAt: isoTsOrNull(row.submitted_at),
    decidedAt: isoTsOrNull(row.decided_at),
    applicationText: row.application_text == null ? null : String(row.application_text),
    notes: row.notes == null ? null : String(row.notes),
    attachments: asStringArray(row.attachments),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface GrantInput {
  title: string;
  fundName?: string;
  amountRequestedKr?: number | null;
  amountAwardedKr?: number | null;
  status?: GrantStatus;
  deadline?: string | null;
  submittedAt?: string | null;
  decidedAt?: string | null;
  applicationText?: string | null;
  notes?: string | null;
  attachments?: string[];
  projectId?: string | null;
}
export type GrantPatch = Partial<GrantInput>;

export async function listGrants(pool: Pool, ownerUserId: string, projectId?: string | null): Promise<DanceGrantApplication[]> {
  const conditions = ['owner_user_id = $1']; const params: unknown[] = [ownerUserId];
  if (projectId) { params.push(projectId); conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`); }
  const { rows } = await pool.query(`SELECT * FROM dance_grant_application WHERE ${conditions.join(' AND ')} ORDER BY deadline ASC NULLS LAST, created_at DESC LIMIT 500`, params);
  return rows.map((r) => mapGrantRow(r));
}

export async function createGrant(pool: Pool, ownerUserId: string, input: GrantInput): Promise<DanceGrantApplication> {
  const id = generateId('grant');
  const { rows } = await pool.query(
    `INSERT INTO dance_grant_application (
       id, owner_user_id, project_id, title, fund_name, amount_requested_kr,
       amount_awarded_kr, status, deadline, submitted_at, decided_at,
       application_text, notes, attachments
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null, input.title,
      input.fundName ?? 'kulturradet', input.amountRequestedKr ?? null,
      input.amountAwardedKr ?? null, input.status ?? 'draft',
      input.deadline ?? null, input.submittedAt ?? null, input.decidedAt ?? null,
      input.applicationText ?? null, input.notes ?? null,
      JSON.stringify(input.attachments ?? []),
    ],
  );
  return mapGrantRow(rows[0]);
}

export async function patchGrant(pool: Pool, ownerUserId: string, id: string, patch: GrantPatch): Promise<DanceGrantApplication | null> {
  const sets: string[] = []; const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.title !== undefined) push('title', patch.title);
  if (patch.fundName !== undefined) push('fund_name', patch.fundName);
  if (patch.amountRequestedKr !== undefined) push('amount_requested_kr', patch.amountRequestedKr);
  if (patch.amountAwardedKr !== undefined) push('amount_awarded_kr', patch.amountAwardedKr);
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.deadline !== undefined) push('deadline', patch.deadline);
  if (patch.submittedAt !== undefined) push('submitted_at', patch.submittedAt);
  if (patch.decidedAt !== undefined) push('decided_at', patch.decidedAt);
  if (patch.applicationText !== undefined) push('application_text', patch.applicationText);
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.attachments !== undefined) push('attachments', JSON.stringify(patch.attachments));
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM dance_grant_application WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
    return rows.length ? mapGrantRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(`UPDATE dance_grant_application SET ${sets.join(', ')} WHERE owner_user_id = $1 AND id = $2 RETURNING *`, params);
  return rows.length ? mapGrantRow(rows[0]) : null;
}

export async function deleteGrant(pool: Pool, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM dance_grant_application WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  INVOICES
// ═══════════════════════════════════════════════════════════════════════

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

function asLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value)) return [];
  const out: InvoiceLineItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.description !== 'string') continue;
    out.push({
      description: r.description,
      quantity: Number(r.quantity) || 1,
      unitPriceKr: Number(r.unitPriceKr) || 0,
      amountKr: Number(r.amountKr) || 0,
    });
  }
  return out;
}

function mapInvoiceRow(row: Record<string, unknown>): DanceInvoice {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    invoiceNumber: row.invoice_number == null ? null : String(row.invoice_number),
    customerName: String(row.customer_name),
    customerOrgNo: row.customer_org_no == null ? null : String(row.customer_org_no),
    customerEmail: row.customer_email == null ? null : String(row.customer_email),
    customerAddress: row.customer_address == null ? null : String(row.customer_address),
    amountKr: Number(row.amount_kr) || 0,
    vatKr: Number(row.vat_kr) || 0,
    status: String(row.status) as InvoiceStatus,
    deliveryMethod: String(row.delivery_method) as InvoiceDelivery,
    kidNumber: row.kid_number == null ? null : String(row.kid_number),
    ehfStatus: row.ehf_status == null ? null : String(row.ehf_status),
    issueDate: isoTsOrNull(row.issue_date),
    dueDate: isoTsOrNull(row.due_date),
    paidAt: isoTsOrNull(row.paid_at),
    lineItems: asLineItems(row.line_items),
    notes: row.notes == null ? null : String(row.notes),
    fikenInvoiceId: row.fiken_invoice_id == null ? null : String(row.fiken_invoice_id),
    tripletexInvoiceId: row.tripletex_invoice_id == null ? null : String(row.tripletex_invoice_id),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface InvoiceInput {
  invoiceNumber?: string | null;
  customerName: string;
  customerOrgNo?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  amountKr?: number;
  vatKr?: number;
  status?: InvoiceStatus;
  deliveryMethod?: InvoiceDelivery;
  kidNumber?: string | null;
  ehfStatus?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  paidAt?: string | null;
  lineItems?: InvoiceLineItem[];
  notes?: string | null;
  projectId?: string | null;
}
export type InvoicePatch = Partial<InvoiceInput>;

export async function listInvoices(pool: Pool, ownerUserId: string, projectId?: string | null): Promise<DanceInvoice[]> {
  const conditions = ['owner_user_id = $1']; const params: unknown[] = [ownerUserId];
  if (projectId) { params.push(projectId); conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`); }
  const { rows } = await pool.query(`SELECT * FROM dance_invoice WHERE ${conditions.join(' AND ')} ORDER BY due_date ASC NULLS LAST, created_at DESC LIMIT 500`, params);
  return rows.map((r) => mapInvoiceRow(r));
}

export async function createInvoice(pool: Pool, ownerUserId: string, input: InvoiceInput): Promise<DanceInvoice> {
  const id = generateId('inv');
  const { rows } = await pool.query(
    `INSERT INTO dance_invoice (
       id, owner_user_id, project_id, invoice_number, customer_name,
       customer_org_no, customer_email, customer_address,
       amount_kr, vat_kr, status, delivery_method, kid_number, ehf_status,
       issue_date, due_date, paid_at, line_items, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [
      id, ownerUserId, input.projectId ?? null,
      input.invoiceNumber ?? null, input.customerName,
      input.customerOrgNo ?? null, input.customerEmail ?? null,
      input.customerAddress ?? null,
      input.amountKr ?? 0, input.vatKr ?? 0,
      input.status ?? 'draft', input.deliveryMethod ?? 'manual',
      input.kidNumber ?? null, input.ehfStatus ?? null,
      input.issueDate ?? null, input.dueDate ?? null, input.paidAt ?? null,
      JSON.stringify(input.lineItems ?? []), input.notes ?? null,
    ],
  );
  return mapInvoiceRow(rows[0]);
}

export async function patchInvoice(pool: Pool, ownerUserId: string, id: string, patch: InvoicePatch): Promise<DanceInvoice | null> {
  const sets: string[] = []; const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.invoiceNumber !== undefined) push('invoice_number', patch.invoiceNumber);
  if (patch.customerName !== undefined) push('customer_name', patch.customerName);
  if (patch.customerOrgNo !== undefined) push('customer_org_no', patch.customerOrgNo);
  if (patch.customerEmail !== undefined) push('customer_email', patch.customerEmail);
  if (patch.customerAddress !== undefined) push('customer_address', patch.customerAddress);
  if (patch.amountKr !== undefined) push('amount_kr', patch.amountKr);
  if (patch.vatKr !== undefined) push('vat_kr', patch.vatKr);
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.deliveryMethod !== undefined) push('delivery_method', patch.deliveryMethod);
  if (patch.kidNumber !== undefined) push('kid_number', patch.kidNumber);
  if (patch.ehfStatus !== undefined) push('ehf_status', patch.ehfStatus);
  if (patch.issueDate !== undefined) push('issue_date', patch.issueDate);
  if (patch.dueDate !== undefined) push('due_date', patch.dueDate);
  if (patch.paidAt !== undefined) push('paid_at', patch.paidAt);
  if (patch.lineItems !== undefined) push('line_items', JSON.stringify(patch.lineItems));
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (patch.projectId !== undefined) push('project_id', patch.projectId);
  if (sets.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM dance_invoice WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
    return rows.length ? mapInvoiceRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(`UPDATE dance_invoice SET ${sets.join(', ')} WHERE owner_user_id = $1 AND id = $2 RETURNING *`, params);
  return rows.length ? mapInvoiceRow(rows[0]) : null;
}

export async function deleteInvoice(pool: Pool, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM dance_invoice WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
  return (rowCount ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  UNION
// ═══════════════════════════════════════════════════════════════════════

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

function asWorkDays(value: unknown): UnionWorkDay[] {
  if (!Array.isArray(value)) return [];
  const out: UnionWorkDay[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.ymd !== 'string' || typeof r.hours !== 'number') continue;
    const d: UnionWorkDay = { ymd: r.ymd, hours: r.hours };
    if (typeof r.classKind === 'string') d.classKind = r.classKind;
    if (typeof r.tariffKr === 'number') d.tariffKr = r.tariffKr;
    if (typeof r.jobTitle === 'string') d.jobTitle = r.jobTitle;
    if (typeof r.project === 'string') d.project = r.project;
    out.push(d);
  }
  return out;
}

function mapUnionRow(row: Record<string, unknown>): DanceUnionMembership {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    organization: String(row.organization) as UnionOrganization,
    memberId: row.member_id == null ? null : String(row.member_id),
    status: String(row.status) as UnionStatus,
    joinedAt: isoTsOrNull(row.joined_at),
    workDays: asWorkDays(row.work_days),
    tariffSnapshot: typeof row.tariff_snapshot === 'object' && row.tariff_snapshot != null
      ? row.tariff_snapshot as Record<string, unknown>
      : {},
    notes: row.notes == null ? null : String(row.notes),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

export interface UnionInput {
  organization?: UnionOrganization;
  memberId?: string | null;
  status?: UnionStatus;
  joinedAt?: string | null;
  workDays?: UnionWorkDay[];
  tariffSnapshot?: Record<string, unknown>;
  notes?: string | null;
}
export type UnionPatch = Partial<UnionInput>;

export async function listUnion(pool: Pool, ownerUserId: string): Promise<DanceUnionMembership[]> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_union_membership WHERE owner_user_id = $1 ORDER BY organization ASC LIMIT 50`,
    [ownerUserId],
  );
  return rows.map((r) => mapUnionRow(r));
}

export async function createUnion(pool: Pool, ownerUserId: string, input: UnionInput): Promise<DanceUnionMembership> {
  const id = generateId('union');
  const { rows } = await pool.query(
    `INSERT INTO dance_union_membership (
       id, owner_user_id, organization, member_id, status, joined_at,
       work_days, tariff_snapshot, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      id, ownerUserId, input.organization ?? 'skuda',
      input.memberId ?? null, input.status ?? 'active',
      input.joinedAt ?? null,
      JSON.stringify(input.workDays ?? []),
      JSON.stringify(input.tariffSnapshot ?? {}),
      input.notes ?? null,
    ],
  );
  return mapUnionRow(rows[0]);
}

export async function patchUnion(pool: Pool, ownerUserId: string, id: string, patch: UnionPatch): Promise<DanceUnionMembership | null> {
  const sets: string[] = []; const params: unknown[] = [ownerUserId, id];
  const push = (col: string, v: unknown): void => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.organization !== undefined) push('organization', patch.organization);
  if (patch.memberId !== undefined) push('member_id', patch.memberId);
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.joinedAt !== undefined) push('joined_at', patch.joinedAt);
  if (patch.workDays !== undefined) push('work_days', JSON.stringify(patch.workDays));
  if (patch.tariffSnapshot !== undefined) push('tariff_snapshot', JSON.stringify(patch.tariffSnapshot));
  if (patch.notes !== undefined) push('notes', patch.notes);
  if (sets.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM dance_union_membership WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
    return rows.length ? mapUnionRow(rows[0]) : null;
  }
  sets.push('updated_at = now()');
  const { rows } = await pool.query(`UPDATE dance_union_membership SET ${sets.join(', ')} WHERE owner_user_id = $1 AND id = $2 RETURNING *`, params);
  return rows.length ? mapUnionRow(rows[0]) : null;
}

export async function deleteUnion(pool: Pool, ownerUserId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM dance_union_membership WHERE owner_user_id = $1 AND id = $2`, [ownerUserId, id]);
  return (rowCount ?? 0) > 0;
}

export { asArray };
