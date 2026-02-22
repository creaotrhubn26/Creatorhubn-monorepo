/**
 * domain/doodEngine.ts
 *
 * Day Out Of Days (DOOD) Engine.
 * Pure functions — NO React, NO state, NO UI.
 *
 * DOOD is a cast × shoot-day matrix, standard in film production.
 * Each cell holds a DOODCode: W (Work), T (Travel), H (Hold), O (Off), etc.
 *
 * This engine is DERIVED entirely from:
 *   Scene.castIds  ←  which actors are in which scenes
 *   Strip          ←  which scenes are on which days
 *   ShootDay       ←  the ordered calendar
 *   CastMember     ←  contract windows + home location
 *
 * When any Strip moves, call generateDOOD() again. It is intentionally
 * a pure function so you can call it in a useMemo with zero side-effects.
 *
 * Industry notation reference:
 *   S  – Start (first day of work for this actor)
 *   W  – Work
 *   F  – Finish (last day of work)
 *   SWF – Start/Work/Finish (one-day role)
 *   SW  – Start/Work (starts today, continues tomorrow)
 *   WF  – Work/Finish (worked yesterday, last day today)
 *   T   – Travel to location
 *   TF  – Travel From (wrap travel)
 *   H   – Hold (on contract, not shooting)
 *   O   – Off (not on contract today)
 */

import type {
  Scene, Strip, ShootDay, CastMember,
  DOODEntry, DOODMatrix, DOODCode, ProductionUnit, ISODate,
} from './types';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface DOODContext {
  scenes:      Map<string, Scene>;
  strips:      Map<string, Strip>;
  shootDays:   Map<string, ShootDay>;
  castMembers: Map<string, CastMember>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Days sorted by date (TBD last), then unit, then dayNumber. */
function sortedDays(shootDays: Map<string, ShootDay>): ShootDay[] {
  return [...shootDays.values()].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date)  return -1;
    if (b.date)  return  1;
    if (a.unit !== b.unit) return a.unit.localeCompare(b.unit);
    return a.dayNumber - b.dayNumber;
  });
}

/** Cast members sorted by castNumber (ascending), then characterName. */
function sortedCast(castMembers: Map<string, CastMember>): CastMember[] {
  return [...castMembers.values()].sort((a, b) => {
    const na = a.castNumber ?? 999;
    const nb = b.castNumber ?? 999;
    if (na !== nb) return na - nb;
    return a.characterName.localeCompare(b.characterName);
  });
}

/** All cast IDs required on a given ShootDay. */
function castIdsForDay(
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
): Set<string> {
  const ids = new Set<string>();
  for (const sid of day.stripIds) {
    const strip = strips.get(sid);
    if (!strip) continue;
    const scene = scenes.get(strip.sceneId);
    if (!scene) continue;
    scene.castIds.forEach(id => ids.add(id));
  }
  return ids;
}

/** Scene IDs on a given day for a given cast member. */
function sceneIdsForCastOnDay(
  castId: string,
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
): string[] {
  const result: string[] = [];
  for (const sid of day.stripIds) {
    const strip = strips.get(sid);
    if (!strip) continue;
    const scene = scenes.get(strip.sceneId);
    if (scene?.castIds.includes(castId)) result.push(scene.id);
  }
  return result;
}

/**
 * Given a sorted list of dates on which a cast member works,
 * produce the set of HOLD dates (non-work dates between first and last work day).
 */
function holdDates(workDates: ISODate[]): Set<ISODate> {
  if (workDates.length < 2) return new Set();
  const sorted = [...workDates].sort();
  const first = new Date(sorted[0]);
  const last  = new Date(sorted[sorted.length - 1]);
  const holds = new Set<ISODate>();
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor < last) {
    const iso = cursor.toISOString().split('T')[0];
    if (!workDates.includes(iso)) holds.add(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return holds;
}

/**
 * Calculate the DOOD code for a cast member on a specific shoot day.
 *
 * Logic (in priority order):
 *   1. If actor works this day → determine W / SW / WF / SWF / S / F
 *   2. If day falls between first and last work day → H (Hold)
 *   3. Otherwise → O (Off)
 *   4. Travel days are a special-case override when the location changes
 *      between consecutive work days.
 */
function calculateCode(
  castId: string,
  day: ShootDay,
  worksOnDay: boolean,
  allWorkDates: ISODate[],
  holdDateSet: Set<ISODate>,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
  castMember: CastMember | undefined,
): DOODCode {
  const sortedWork = [...allWorkDates].sort();
  const firstWork  = sortedWork[0];
  const lastWork   = sortedWork[sortedWork.length - 1];
  const todayDate  = day.date;

  if (worksOnDay) {
    const isFirst = todayDate === firstWork;
    const isLast  = todayDate === lastWork;
    if (isFirst && isLast) return 'SWF';
    if (isFirst)           return 'SW';
    if (isLast)            return 'WF';
    return 'W';
  }

  if (todayDate && holdDateSet.has(todayDate)) return 'H';

  // Check travel: if this day has a date, the previous work day had a different
  // location, and the actor needs to travel → T or TF
  // (Simplified: flag as T if day before first work, TF if day after last work)
  if (todayDate && firstWork && todayDate < firstWork) {
    const hasTravel = castMember?.homeLocation !== undefined;
    if (hasTravel) return 'T';
  }
  if (todayDate && lastWork && todayDate > lastWork) {
    const hasTravel = castMember?.homeLocation !== undefined;
    if (hasTravel) return 'TF';
  }

  return 'O';
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generate the full DOOD matrix for a project.
 *
 * @param ctx   Resolved DOODContext (scenes, strips, shootDays, castMembers).
 * @returns     DOODMatrix — a grid of cast × shoot-day with DOODCode per cell.
 */
export function generateDOOD(ctx: DOODContext): DOODMatrix {
  const { scenes, strips, shootDays, castMembers } = ctx;

  const days = sortedDays(shootDays);
  const cast = sortedCast(castMembers);

  // Build per-actor work date list (for hold/travel calculation)
  // actorWorkDates: castId → Set<ISODate>
  const actorWorkDates = new Map<string, Set<ISODate>>();
  for (const day of days) {
    if (!day.date) continue;
    const castIds = castIdsForDay(day, strips, scenes);
    for (const castId of castIds) {
      if (!actorWorkDates.has(castId)) actorWorkDates.set(castId, new Set());
      actorWorkDates.get(castId)!.add(day.date);
    }
  }

  // Build columns
  const columns: DOODMatrix['columns'] = days.map(d => ({
    shootDayId: d.id,
    dayNumber:  d.dayNumber,
    unit:       d.unit,
    date:       d.date,
  }));

  // Build rows
  const rows: DOODMatrix['rows'] = cast.map(member => {
    const workDates    = [...(actorWorkDates.get(member.id) ?? new Set<ISODate>())];
    const holdDateSet  = holdDates(workDates);
    const entries: Record<string, DOODEntry> = {};

    for (const day of days) {
      const dayWorkSet  = castIdsForDay(day, strips, scenes);
      const worksOnDay  = dayWorkSet.has(member.id);
      const code = calculateCode(
        member.id, day, worksOnDay, workDates, holdDateSet,
        strips, scenes, castMembers.get(member.id),
      );

      entries[day.id] = {
        castMemberId: member.id,
        shootDayId:   day.id,
        date:         day.date,
        dayNumber:    day.dayNumber,
        code,
        sceneIds: worksOnDay
          ? sceneIdsForCastOnDay(member.id, day, strips, scenes)
          : [],
      };
    }

    const totalWorkDays = Object.values(entries).filter(e => ['W', 'SW', 'WF', 'SWF'].includes(e.code)).length;
    const totalHoldDays = Object.values(entries).filter(e => e.code === 'H').length;

    return {
      castMember: {
        id:            member.id,
        characterName: member.characterName,
        actorName:     member.actorName,
        castNumber:    member.castNumber,
      },
      entries,
      totalWorkDays,
      totalHoldDays,
    };
  });

  return {
    projectId:   days[0]?.projectId ?? '',
    columns,
    rows,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Accessors / helpers ──────────────────────────────────────────────────────

/**
 * Get the DOODCode for a specific actor on a specific day.
 * Returns 'O' if the matrix doesn't cover that cell.
 */
export function getCode(matrix: DOODMatrix, castMemberId: string, shootDayId: string): DOODCode {
  const row = matrix.rows.find(r => r.castMember.id === castMemberId);
  return row?.entries[shootDayId]?.code ?? 'O';
}

/**
 * Get all days on which an actor is working (W / SW / WF / SWF).
 */
export function getWorkDays(matrix: DOODMatrix, castMemberId: string): DOODEntry[] {
  const row = matrix.rows.find(r => r.castMember.id === castMemberId);
  if (!row) return [];
  return Object.values(row.entries).filter(e =>
    ['W', 'SW', 'WF', 'SWF'].includes(e.code),
  );
}

/**
 * DOOD code display configuration for the visual matrix.
 */
export const DOOD_CODE_CONFIG: Record<DOODCode, {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  W:   { label: 'W',   color: '#fff', bgColor: '#1976d2', description: 'Arbeider' },
  SW:  { label: 'SW',  color: '#fff', bgColor: '#2196f3', description: 'Start / Arbeider' },
  WF:  { label: 'WF',  color: '#fff', bgColor: '#1565c0', description: 'Arbeider / Ferdig' },
  SWF: { label: 'SWF', color: '#fff', bgColor: '#0d47a1', description: 'Start / Arbeid / Ferdig (én dag)' },
  T:   { label: 'T',   color: '#fff', bgColor: '#9333ea', description: 'Reise til' },
  TF:  { label: 'TF',  color: '#fff', bgColor: '#f57c00', description: 'Reise fra' },
  H:   { label: 'H',   color: '#333', bgColor: '#fff9c4', description: 'Hold (lønnet, ikke opptak)' },
  F:   { label: 'F',   color: '#fff', bgColor: '#4caf50', description: 'Ferdig (siste dag)' },
  O:   { label: '',    color: '#bbb', bgColor: 'transparent', description: 'Fri' },
};

/**
 * Return the columns (shoot days) belonging to a specific production unit,
 * preserving the sorted order from the matrix.
 */
export function getColumnsForUnit(
  matrix: DOODMatrix,
  unit: ProductionUnit,
): DOODMatrix['columns'] {
  return matrix.columns.filter(col => col.unit === unit);
}

/**
 * Slice a DOODMatrix to only include columns for the given production unit.
 * Useful when rendering a per-unit view of the DOOD grid.
 */
export function sliceDOODByUnit(
  matrix: DOODMatrix,
  unit: ProductionUnit,
): DOODMatrix {
  const filteredColumns = getColumnsForUnit(matrix, unit);
  const columnIds = new Set(filteredColumns.map(c => c.shootDayId));

  const rows: DOODMatrix['rows'] = matrix.rows.map(row => {
    const entries: Record<string, DOODEntry> = {};
    for (const [dayId, entry] of Object.entries(row.entries)) {
      if (columnIds.has(dayId)) entries[dayId] = entry;
    }
    const workDays = Object.values(entries).filter(e =>
      ['W', 'SW', 'WF', 'SWF'].includes(e.code),
    ).length;
    const holdDays = Object.values(entries).filter(e => e.code === 'H').length;
    return { ...row, entries, totalWorkDays: workDays, totalHoldDays: holdDays };
  }).filter(row => Object.keys(row.entries).length > 0);

  return { ...matrix, columns: filteredColumns, rows };
}

/**
 * Summarise DOOD costs: work days + hold days per actor.
 */
export interface DOODActorSummary {
  castMemberId: string;
  characterName: string;
  actorName?: string;
  castNumber?: number;
  workDays: number;
  holdDays: number;
  travelDays: number;
  totalContractDays: number; // work + hold + travel
}

export function summariseDOOD(matrix: DOODMatrix): DOODActorSummary[] {
  return matrix.rows.map(row => {
    const entries = Object.values(row.entries);
    const workDays   = entries.filter(e => ['W','SW','WF','SWF'].includes(e.code)).length;
    const holdDays   = entries.filter(e => e.code === 'H').length;
    const travelDays = entries.filter(e => e.code === 'T' || e.code === 'TF').length;
    return {
      castMemberId:   row.castMember.id,
      characterName:  row.castMember.characterName,
      actorName:      row.castMember.actorName,
      castNumber:     row.castMember.castNumber,
      workDays,
      holdDays,
      travelDays,
      totalContractDays: workDays + holdDays + travelDays,
    };
  });
}
