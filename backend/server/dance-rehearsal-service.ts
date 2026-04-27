/**
 * Dance rehearsal service — DB-laget for prøvelogg-oppføringer.
 * Eier `dance_rehearsal` (migration 0065).
 *
 * Slice 7 nøkkel-feature: når et segment-review markeres som 'approved',
 * bumpes også `dance_choreography_segment.approval = 'approved'` automatisk.
 * Dette eliminerer manuell mellomstegget hvor koreografen måtte oppdatere
 * approval-status to ulike steder etter samme prøve.
 */

import type { Pool } from 'pg';

export type RehearsalStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type RehearsalOutcome = 'approved' | 'needs_repeat' | 'pending';

export interface RehearsalFocusArea {
  id: string;
  title: string;
  segmentId?: string;
  startSec?: number;
  endSec?: number;
  formationFromId?: string;
  formationToId?: string;
  goal?: string;
  estimatedMinutes?: number;
}

export interface RehearsalSegmentReview {
  segmentId: string;
  outcome: RehearsalOutcome;
  note?: string;
}

export interface RehearsalDancerFollowUp {
  dancerId: string;
  followUp: string;
  dueBy?: string;
}

export interface RehearsalRecord {
  id: string;
  ownerUserId: string;
  choreographyId: string;
  projectId: string | null;
  title: string;
  scheduledAt: string;
  estimatedMinutes: number;
  location: string | null;
  invitedDancerIds: string[];
  status: RehearsalStatus;
  focusAreas: RehearsalFocusArea[];
  videoReviewPlanned: boolean;
  preNotes: string | null;
  segmentReviews: RehearsalSegmentReview[];
  dancerFollowUps: RehearsalDancerFollowUp[];
  postNotes: string | null;
  recordingUrl: string | null;
  choreographyChangelog: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RehearsalInput {
  choreographyId: string;
  title: string;
  scheduledAt: string;
  estimatedMinutes?: number;
  location?: string | null;
  invitedDancerIds?: string[];
  status?: RehearsalStatus;
  focusAreas?: RehearsalFocusArea[];
  videoReviewPlanned?: boolean;
  preNotes?: string | null;
  segmentReviews?: RehearsalSegmentReview[];
  dancerFollowUps?: RehearsalDancerFollowUp[];
  postNotes?: string | null;
  recordingUrl?: string | null;
  choreographyChangelog?: string | null;
  projectId?: string | null;
}

export type RehearsalPatch = Partial<Omit<RehearsalInput, 'choreographyId'>>;

// ─── Mapping helpers ────────────────────────────────────────────────────

function isoTs(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asFocusAreas(value: unknown): RehearsalFocusArea[] {
  if (!Array.isArray(value)) return [];
  const out: RehearsalFocusArea[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.title !== 'string') continue;
    const fa: RehearsalFocusArea = { id: r.id, title: r.title };
    if (typeof r.segmentId === 'string') fa.segmentId = r.segmentId;
    if (typeof r.startSec === 'number') fa.startSec = r.startSec;
    if (typeof r.endSec === 'number') fa.endSec = r.endSec;
    if (typeof r.formationFromId === 'string') fa.formationFromId = r.formationFromId;
    if (typeof r.formationToId === 'string') fa.formationToId = r.formationToId;
    if (typeof r.goal === 'string') fa.goal = r.goal;
    if (typeof r.estimatedMinutes === 'number') fa.estimatedMinutes = r.estimatedMinutes;
    out.push(fa);
  }
  return out;
}

function isOutcome(value: unknown): value is RehearsalOutcome {
  return value === 'approved' || value === 'needs_repeat' || value === 'pending';
}

function asSegmentReviews(value: unknown): RehearsalSegmentReview[] {
  if (!Array.isArray(value)) return [];
  const out: RehearsalSegmentReview[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.segmentId !== 'string') continue;
    if (!isOutcome(r.outcome)) continue;
    const review: RehearsalSegmentReview = { segmentId: r.segmentId, outcome: r.outcome };
    if (typeof r.note === 'string') review.note = r.note;
    out.push(review);
  }
  return out;
}

function asFollowUps(value: unknown): RehearsalDancerFollowUp[] {
  if (!Array.isArray(value)) return [];
  const out: RehearsalDancerFollowUp[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.dancerId !== 'string' || typeof r.followUp !== 'string') continue;
    const f: RehearsalDancerFollowUp = { dancerId: r.dancerId, followUp: r.followUp };
    if (typeof r.dueBy === 'string') f.dueBy = r.dueBy;
    out.push(f);
  }
  return out;
}

function isStatus(value: unknown): value is RehearsalStatus {
  return value === 'planned' || value === 'in_progress'
    || value === 'completed' || value === 'cancelled';
}

function mapRow(row: Record<string, unknown>): RehearsalRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    choreographyId: String(row.choreography_id),
    projectId: row.project_id == null ? null : String(row.project_id),
    title: String(row.title),
    scheduledAt: isoTs(row.scheduled_at),
    estimatedMinutes: Number(row.estimated_minutes) || 60,
    location: row.location == null ? null : String(row.location),
    invitedDancerIds: asStringArray(row.invited_dancer_ids),
    status: isStatus(row.status) ? row.status : 'planned',
    focusAreas: asFocusAreas(row.focus_areas),
    videoReviewPlanned: row.video_review_planned === true,
    preNotes: row.pre_notes == null ? null : String(row.pre_notes),
    segmentReviews: asSegmentReviews(row.segment_reviews),
    dancerFollowUps: asFollowUps(row.dancer_follow_ups),
    postNotes: row.post_notes == null ? null : String(row.post_notes),
    recordingUrl: row.recording_url == null ? null : String(row.recording_url),
    choreographyChangelog: row.choreography_changelog == null ? null : String(row.choreography_changelog),
    createdAt: isoTs(row.created_at),
    updatedAt: isoTs(row.updated_at),
  };
}

function generateId(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return `reh_${globalThis.crypto.randomUUID()}`;
  }
  return `reh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── CRUD ───────────────────────────────────────────────────────────────

export interface ListRehearsalsOptions {
  choreographyId?: string | null;
  projectId?: string | null;
  status?: RehearsalStatus | null;
  limit?: number;
}

export async function listRehearsals(
  pool: Pool,
  ownerUserId: string,
  options: ListRehearsalsOptions = {},
): Promise<RehearsalRecord[]> {
  const safeLimit = Math.max(1, Math.min(500, options.limit ?? 100));
  const conditions: string[] = ['owner_user_id = $1'];
  const params: unknown[] = [ownerUserId];

  if (typeof options.choreographyId === 'string' && options.choreographyId.length > 0) {
    params.push(options.choreographyId);
    conditions.push(`choreography_id = $${params.length}`);
  }
  if (typeof options.projectId === 'string' && options.projectId.length > 0) {
    params.push(options.projectId);
    conditions.push(`(project_id = $${params.length} OR project_id IS NULL)`);
  }
  if (options.status) {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  }

  params.push(safeLimit);

  const { rows } = await pool.query(
    `SELECT *
     FROM dance_rehearsal
     WHERE ${conditions.join(' AND ')}
     ORDER BY scheduled_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => mapRow(r));
}

export async function getRehearsal(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<RehearsalRecord | null> {
  const { rows } = await pool.query(
    `SELECT * FROM dance_rehearsal WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function createRehearsal(
  pool: Pool,
  ownerUserId: string,
  input: RehearsalInput,
): Promise<RehearsalRecord> {
  const id = generateId();
  const { rows } = await pool.query(
    `INSERT INTO dance_rehearsal (
       id, owner_user_id, choreography_id, project_id,
       title, scheduled_at, estimated_minutes, location,
       invited_dancer_ids, status,
       focus_areas, video_review_planned, pre_notes,
       segment_reviews, dancer_follow_ups, post_notes,
       recording_url, choreography_changelog
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      id,
      ownerUserId,
      input.choreographyId,
      input.projectId ?? null,
      input.title,
      input.scheduledAt,
      input.estimatedMinutes ?? 60,
      input.location ?? null,
      JSON.stringify(input.invitedDancerIds ?? []),
      input.status ?? 'planned',
      JSON.stringify(input.focusAreas ?? []),
      input.videoReviewPlanned === true,
      input.preNotes ?? null,
      JSON.stringify(input.segmentReviews ?? []),
      JSON.stringify(input.dancerFollowUps ?? []),
      input.postNotes ?? null,
      input.recordingUrl ?? null,
      input.choreographyChangelog ?? null,
    ],
  );
  return mapRow(rows[0]);
}

export async function patchRehearsal(
  pool: Pool,
  ownerUserId: string,
  id: string,
  patch: RehearsalPatch,
): Promise<RehearsalRecord | null> {
  const before = await getRehearsal(pool, ownerUserId, id);
  if (!before) return null;

  const sets: string[] = [];
  const params: unknown[] = [ownerUserId, id];

  const push = (col: string, value: unknown): void => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };

  if (patch.title !== undefined) push('title', patch.title);
  if (patch.scheduledAt !== undefined) push('scheduled_at', patch.scheduledAt);
  if (patch.estimatedMinutes !== undefined) push('estimated_minutes', patch.estimatedMinutes);
  if (patch.location !== undefined) push('location', patch.location);
  if (patch.invitedDancerIds !== undefined) {
    push('invited_dancer_ids', JSON.stringify(patch.invitedDancerIds));
  }
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.focusAreas !== undefined) push('focus_areas', JSON.stringify(patch.focusAreas));
  if (patch.videoReviewPlanned !== undefined) push('video_review_planned', patch.videoReviewPlanned);
  if (patch.preNotes !== undefined) push('pre_notes', patch.preNotes);
  if (patch.segmentReviews !== undefined) {
    push('segment_reviews', JSON.stringify(patch.segmentReviews));
  }
  if (patch.dancerFollowUps !== undefined) {
    push('dancer_follow_ups', JSON.stringify(patch.dancerFollowUps));
  }
  if (patch.postNotes !== undefined) push('post_notes', patch.postNotes);
  if (patch.recordingUrl !== undefined) push('recording_url', patch.recordingUrl);
  if (patch.choreographyChangelog !== undefined) {
    push('choreography_changelog', patch.choreographyChangelog);
  }
  if (patch.projectId !== undefined) push('project_id', patch.projectId);

  if (sets.length === 0) return before;

  sets.push('updated_at = now()');

  const { rows } = await pool.query(
    `UPDATE dance_rehearsal
     SET ${sets.join(', ')}
     WHERE owner_user_id = $1 AND id = $2
     RETURNING *`,
    params,
  );
  if (rows.length === 0) return null;
  const after = mapRow(rows[0]);

  // ─── Auto-flip segment.approval når reviews går til 'approved' ─────
  if (patch.segmentReviews !== undefined) {
    const oldOutcomeBySegment = new Map(
      before.segmentReviews.map((r) => [r.segmentId, r.outcome] as const),
    );
    const newlyApproved: string[] = [];
    for (const r of after.segmentReviews) {
      if (r.outcome !== 'approved') continue;
      if (oldOutcomeBySegment.get(r.segmentId) !== 'approved') {
        newlyApproved.push(r.segmentId);
      }
    }
    if (newlyApproved.length > 0) {
      await pool.query(
        `UPDATE dance_choreography_segment AS s
         SET approval = 'approved', updated_at = now()
         FROM dance_choreography AS c
         WHERE s.choreography_id = c.id
           AND c.owner_user_id = $1
           AND s.choreography_id = $2
           AND s.id = ANY($3::text[])
           AND s.approval <> 'approved'`,
        [ownerUserId, after.choreographyId, newlyApproved],
      );
    }
  }

  return after;
}

export async function deleteRehearsal(
  pool: Pool,
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dance_rehearsal WHERE owner_user_id = $1 AND id = $2`,
    [ownerUserId, id],
  );
  return (rowCount ?? 0) > 0;
}
