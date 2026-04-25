/**
 * Dancer profile service — DB-laget for dans-spesifikke ekstrafelt på
 * danser-objekter (utvidet CrewMember). Eier `dancer_profile_extras`
 * (migration 0061).
 *
 * Scoping: per `owner_user_id` + `dancer_id` (composite PK). `project_id`
 * er valgfri — NULL = profilen er synlig på tvers av alle prosjekter for
 * eieren (samme mønster som dance_choreography 0060). Når listing
 * filtreres på et prosjekt, returneres rader der `project_id = $projectId
 * OR project_id IS NULL`.
 *
 * `dancer_id` holdes som TEXT — enten en `Dancer.id` fra DEMO_DANCERS
 * eller en stabil string-nøkkel fra en CrewMember. Vi gjør ingen FK mot
 * andre tabeller fordi CrewMember-modellen kan være både en
 * frontend-fixture og en DB-rad.
 */

import type { Pool } from 'pg';

// ─── Enum-type alias (samme verdier som frontend dancerProfile.ts) ───────

export type DanceStyle =
  | 'contemporary'
  | 'ballet'
  | 'jazz'
  | 'commercial'
  | 'hip-hop'
  | 'folk'
  | 'other';

export type InjuryStatus =
  | 'healthy'
  | 'rehab'
  | 'cleared-with-restriction';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';

export interface DancerAvailabilityWindow {
  from: string;
  to: string;
  note?: string;
}

export interface DancerBodyMeasurements {
  inseamCm?: number;
  reachCm?: number;
  weightKg?: number;
  shoeSize?: number;
}

/** De skrivbare/valgfrie feltene som klienten kan sende inn. */
export interface DancerProfileExtras {
  displayName: string | null;
  heightCm: number | null;
  primaryStyle: DanceStyle | null;
  strengths: string[];
  availabilityWindows: DancerAvailabilityWindow[];
  injuryStatus: InjuryStatus;
  injuryNote: string | null;
  reelUrls: string[];
  bodyMeasurements: DancerBodyMeasurements;
  skillLevels: Partial<Record<string, SkillLevel>>;
  notes: string | null;
  projectId: string | null;
}

/** Full record som returneres fra DB. */
export interface DancerProfileRecord extends DancerProfileExtras {
  ownerUserId: string;
  dancerId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Row → DTO mapping ──────────────────────────────────────────────────

function isoFrom(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asAvailabilityWindows(value: unknown): DancerAvailabilityWindow[] {
  if (!Array.isArray(value)) return [];
  const out: DancerAvailabilityWindow[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.from !== 'string' || typeof r.to !== 'string') continue;
    const window: DancerAvailabilityWindow = { from: r.from, to: r.to };
    if (typeof r.note === 'string') window.note = r.note;
    out.push(window);
  }
  return out;
}

function asBodyMeasurements(value: unknown): DancerBodyMeasurements {
  if (!value || typeof value !== 'object') return {};
  const r = value as Record<string, unknown>;
  const out: DancerBodyMeasurements = {};
  const inseam = asNumberOrNull(r.inseamCm ?? r.inseam_cm);
  const reach = asNumberOrNull(r.reachCm ?? r.reach_cm);
  const weight = asNumberOrNull(r.weightKg ?? r.weight_kg);
  const shoe = asNumberOrNull(r.shoeSize ?? r.shoe_size);
  if (inseam != null) out.inseamCm = inseam;
  if (reach != null) out.reachCm = reach;
  if (weight != null) out.weightKg = weight;
  if (shoe != null) out.shoeSize = shoe;
  return out;
}

function asSkillLevels(value: unknown): Partial<Record<string, SkillLevel>> {
  if (!value || typeof value !== 'object') return {};
  const allowed: SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'pro'];
  const r = value as Record<string, unknown>;
  const out: Partial<Record<string, SkillLevel>> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'string' && (allowed as string[]).includes(v)) {
      out[k] = v as SkillLevel;
    }
  }
  return out;
}

function isInjuryStatus(value: unknown): value is InjuryStatus {
  return value === 'healthy' || value === 'rehab' || value === 'cleared-with-restriction';
}

function isDanceStyle(value: unknown): value is DanceStyle {
  return value === 'contemporary'
    || value === 'ballet'
    || value === 'jazz'
    || value === 'commercial'
    || value === 'hip-hop'
    || value === 'folk'
    || value === 'other';
}

function mapRow(row: Record<string, unknown>): DancerProfileRecord {
  const primaryStyle = isDanceStyle(row.primary_style) ? row.primary_style : null;
  const injuryStatus = isInjuryStatus(row.injury_status) ? row.injury_status : 'healthy';
  return {
    ownerUserId: String(row.owner_user_id),
    dancerId: String(row.dancer_id),
    displayName: row.display_name == null ? null : String(row.display_name),
    heightCm: asNumberOrNull(row.height_cm),
    primaryStyle,
    strengths: asStringArray(row.strengths),
    availabilityWindows: asAvailabilityWindows(row.availability_windows),
    injuryStatus,
    injuryNote: row.injury_note == null ? null : String(row.injury_note),
    reelUrls: asStringArray(row.reel_urls),
    bodyMeasurements: asBodyMeasurements(row.body_measurements),
    skillLevels: asSkillLevels(row.skill_levels),
    notes: row.notes == null ? null : String(row.notes),
    projectId: row.project_id == null ? null : String(row.project_id),
    createdAt: isoFrom(row.created_at),
    updatedAt: isoFrom(row.updated_at),
  };
}

// ─── CRUD ───────────────────────────────────────────────────────────────

export interface ListDancerProfilesOptions {
  /**
   * Hvis satt, filtrer på `project_id = $projectId OR project_id IS NULL`.
   * Profiler uten prosjekt følger alltid med så de er synlige i alle scoper.
   */
  projectId?: string | null;
  limit?: number;
}

export async function listDancerProfiles(
  pool: Pool,
  ownerUserId: string,
  optionsOrLimit: ListDancerProfilesOptions | number = {},
): Promise<DancerProfileRecord[]> {
  const opts: ListDancerProfilesOptions =
    typeof optionsOrLimit === 'number' ? { limit: optionsOrLimit } : optionsOrLimit;
  const safeLimit = Math.max(1, Math.min(500, opts.limit ?? 200));
  const filterProject = typeof opts.projectId === 'string' && opts.projectId.length > 0;

  if (filterProject) {
    const { rows } = await pool.query(
      `SELECT *
       FROM dancer_profile_extras
       WHERE owner_user_id = $1
         AND (project_id = $2 OR project_id IS NULL)
       ORDER BY updated_at DESC
       LIMIT $3`,
      [ownerUserId, opts.projectId, safeLimit],
    );
    return rows.map((r) => mapRow(r));
  }

  const { rows } = await pool.query(
    `SELECT *
     FROM dancer_profile_extras
     WHERE owner_user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [ownerUserId, safeLimit],
  );
  return rows.map((r) => mapRow(r));
}

export async function getDancerProfile(
  pool: Pool,
  ownerUserId: string,
  dancerId: string,
): Promise<DancerProfileRecord | null> {
  const { rows } = await pool.query(
    `SELECT *
     FROM dancer_profile_extras
     WHERE owner_user_id = $1 AND dancer_id = $2`,
    [ownerUserId, dancerId],
  );
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

/**
 * Upsert — INSERT ON CONFLICT DO UPDATE for (owner_user_id, dancer_id).
 * Felter som ikke er med i `extras` blir igjen som de var (eller default
 * for nye rader). JSONB-felter erstattes i sin helhet hvis sendt — vi gjør
 * ingen merging serverside.
 */
export async function upsertDancerProfile(
  pool: Pool,
  ownerUserId: string,
  dancerId: string,
  extras: Partial<DancerProfileExtras>,
): Promise<DancerProfileRecord> {
  // Behandle hvert felt eksplisitt slik at ON CONFLICT DO UPDATE kun rør
  // det som faktisk ble sendt inn. Vi bruker COALESCE($n, kolonne) for å
  // beholde eksisterende verdier når input er undefined.
  //
  // For null-bare felt (displayName, heightCm, primaryStyle, injuryNote,
  // notes, projectId) tolkes `null` som "tøm verdien" og `undefined` som
  // "rør ikke". For å skille disse, bruker vi `=== undefined`-sjekk for å
  // bestemme om vi skal sende NULL eller en sentinel via separat kolonne-sett.
  //
  // Enkleste pragmatiske løsning: bygg dynamisk SET-klausul, og send kun
  // verdier som er definert i extras. INSERT-delen bruker defaults for de
  // som ikke er definert.
  const insertCols: string[] = ['owner_user_id', 'dancer_id'];
  const insertVals: unknown[] = [ownerUserId, dancerId];
  const updateSets: string[] = [];

  const push = (col: string, value: unknown): void => {
    insertCols.push(col);
    insertVals.push(value);
    const idx = insertVals.length;
    updateSets.push(`${col} = $${idx}`);
  };

  if (extras.displayName !== undefined) push('display_name', extras.displayName);
  if (extras.heightCm !== undefined) push('height_cm', extras.heightCm);
  if (extras.primaryStyle !== undefined) push('primary_style', extras.primaryStyle);
  if (extras.strengths !== undefined) push('strengths', JSON.stringify(extras.strengths));
  if (extras.availabilityWindows !== undefined) {
    push('availability_windows', JSON.stringify(extras.availabilityWindows));
  }
  if (extras.injuryStatus !== undefined) push('injury_status', extras.injuryStatus);
  if (extras.injuryNote !== undefined) push('injury_note', extras.injuryNote);
  if (extras.reelUrls !== undefined) push('reel_urls', JSON.stringify(extras.reelUrls));
  if (extras.bodyMeasurements !== undefined) {
    push('body_measurements', JSON.stringify(extras.bodyMeasurements));
  }
  if (extras.skillLevels !== undefined) {
    push('skill_levels', JSON.stringify(extras.skillLevels));
  }
  if (extras.notes !== undefined) push('notes', extras.notes);
  if (extras.projectId !== undefined) push('project_id', extras.projectId);

  // updated_at er alltid med i UPDATE-klausulen.
  const updateClause = updateSets.length > 0
    ? `${updateSets.join(', ')}, updated_at = now()`
    : 'updated_at = now()';

  const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');

  await pool.query(
    `INSERT INTO dancer_profile_extras (${insertCols.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT (owner_user_id, dancer_id)
     DO UPDATE SET ${updateClause}`,
    insertVals,
  );

  // Re-les for å returnere den effektive raden (inkludert defaults).
  const result = await getDancerProfile(pool, ownerUserId, dancerId);
  if (!result) {
    // Burde aldri skje siden vi nettopp upserted, men vi kaster eksplisitt
    // for å holde TS strict-kompatibel.
    throw new Error('upsertDancerProfile: row missing after upsert');
  }
  return result;
}

export async function deleteDancerProfile(
  pool: Pool,
  ownerUserId: string,
  dancerId: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM dancer_profile_extras
     WHERE owner_user_id = $1 AND dancer_id = $2`,
    [ownerUserId, dancerId],
  );
  return (rowCount ?? 0) > 0;
}
