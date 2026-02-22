/**
 * domain/conflictEngine.ts
 *
 * Pure conflict-detection functions.
 * NO React, NO state, NO side-effects.
 *
 * The engine takes a snapshot of the current schedule and returns a flat
 * array of Conflict objects. Call this after every Strip move.
 *
 * Detects:
 *   page_overload        – day has more than MAX_PAGES_PER_DAY
 *   time_overload        – day shoot time exceeds MAX_SHOOT_MINUTES
 *   actor_conflict       – same actor required on two different units on the same date
 *   actor_unavailable    – actor blackout date or outside contract window
 *   actor_turnaround     – < TURNAROUND_HOURS between wrap and next call
 *   location_mismatch    – day has scenes at 3+ distinct locations
 *   night_day_violation  – DAY and NIGHT scenes on the same day
 *   stunt_isolation      – stunt scene not alone on a day (safety rule)
 *   child_actor_hours    – child actor would exceed MAX_CHILD_HOURS per day
 */

import type {
  Scene, Strip, ShootDay, CastMember, Location,
  Conflict, ConflictType, ConflictSeverity,
} from './types';

// ─── Thresholds ───────────────────────────────────────────────────────────────

const MAX_PAGES_PER_DAY    = 8;    // industry standard max
const MAX_SHOOT_MINUTES    = 600;  // 10 hours
const TURNAROUND_HOURS     = 12;   // minimum rest between wrap and call
const MAX_LOCATIONS_PER_DAY = 2;   // 3+ = logistical warning
const MAX_CHILD_HOURS      = 480;  // 8 hours per Norwegian labour law

// ─── Schedule context ─────────────────────────────────────────────────────────

/**
 * Everything the engine needs to evaluate conflicts.
 * Pass this as one argument — avoids 6-parameter function signatures.
 */
export interface ScheduleContext {
  scenes:      Map<string, Scene>;
  strips:      Map<string, Strip>;
  shootDays:   Map<string, ShootDay>;
  castMembers: Map<string, CastMember>;
  locations:   Map<string, Location>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _conflictCounter = 0;
function makeId(): string {
  return `conflict-${++_conflictCounter}-${Date.now()}`;
}

function conflict(
  type: ConflictType,
  severity: ConflictSeverity,
  title: string,
  description: string,
  extra: Partial<Omit<Conflict, 'id' | 'type' | 'severity' | 'title' | 'description'>> = {},
): Conflict {
  return { id: makeId(), type, severity, title, description, affectedDayIds: [], affectedSceneIds: [], ...extra };
}

/** Parse "HH:mm" → total minutes since midnight. */
function hmToMinutes(hm: string | undefined): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Scenes placed on a given shoot day. */
function scenesOnDay(day: ShootDay, strips: Map<string, Strip>, scenes: Map<string, Scene>): Scene[] {
  return day.stripIds
    .map(sid => strips.get(sid))
    .filter((s): s is Strip => s !== undefined)
    .map(s => scenes.get(s.sceneId))
    .filter((s): s is Scene => s !== undefined);
}

/** Effective estimated minutes for a strip (overridden or from scene). */
function effectiveMinutes(strip: Strip, scenes: Map<string, Scene>): number {
  if (strip.overrideEstimatedMinutes !== undefined) return strip.overrideEstimatedMinutes;
  return scenes.get(strip.sceneId)?.estimatedMinutes ?? 0;
}

/** Total estimated shoot minutes for a day. */
function totalDayMinutes(day: ShootDay, strips: Map<string, Strip>, scenes: Map<string, Scene>): number {
  return day.stripIds
    .map(sid => strips.get(sid))
    .filter((s): s is Strip => s !== undefined)
    .reduce((acc, s) => acc + effectiveMinutes(s, scenes), 0);
}

// ─── Individual detectors ─────────────────────────────────────────────────────

function detectPageOverload(
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
): Conflict | null {
  const totalPages = scenesOnDay(day, strips, scenes).reduce((acc, s) => acc + s.pageCount, 0);
  if (totalPages <= MAX_PAGES_PER_DAY) return null;
  return conflict(
    'page_overload', 'warning',
    `Dag ${day.dayNumber} overbelastet (sider)`,
    `${totalPages.toFixed(1)} sider planlagt – anbefalt maks ${MAX_PAGES_PER_DAY} sider per dag.`,
    { affectedDayIds: [day.id], affectedSceneIds: scenesOnDay(day, strips, scenes).map(s => s.id) },
  );
}

function detectTimeOverload(
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
): Conflict | null {
  const minutes = totalDayMinutes(day, strips, scenes);
  if (minutes <= MAX_SHOOT_MINUTES) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return conflict(
    'time_overload', 'error',
    `Dag ${day.dayNumber} overbelastet (tid)`,
    `Estimert ${h}t ${m}min – maks er ${MAX_SHOOT_MINUTES / 60}t. Skuespillere og crew kan ikke jobbe så lenge.`,
    { affectedDayIds: [day.id], affectedSceneIds: scenesOnDay(day, strips, scenes).map(s => s.id) },
  );
}

function detectLocationMismatch(
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
  locations: Map<string, Location>,
): Conflict | null {
  const sceneList = scenesOnDay(day, strips, scenes);
  const locIds = [...new Set(sceneList.map(s => s.locationId))];
  if (locIds.length <= MAX_LOCATIONS_PER_DAY) return null;
  const names = locIds.map(id => locations.get(id)?.name ?? id).join(', ');
  return conflict(
    'location_mismatch', 'warning',
    `Dag ${day.dayNumber}: mange lokasjoner`,
    `${locIds.length} ulike lokasjoner samme dag: ${names}. Vurder å dele på to dager.`,
    { affectedDayIds: [day.id], affectedSceneIds: sceneList.map(s => s.id),
      suggestion: 'Flytt noen scener til en nabodag på samme lokasjon.' },
  );
}

function detectNightDayViolation(
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
): Conflict | null {
  const sceneList = scenesOnDay(day, strips, scenes);
  const hasDay   = sceneList.some(s => s.timeOfDay === 'DAY');
  const hasNight = sceneList.some(s => s.timeOfDay === 'NIGHT');
  if (!(hasDay && hasNight)) return null;
  return conflict(
    'night_day_violation', 'warning',
    `Dag ${day.dayNumber}: DAG og NATT blandet`,
    'Dagen inneholder både DAG- og NATT-scener. Lighting og crew-turnaround gjør dette problematisk.',
    {
      affectedDayIds: [day.id],
      affectedSceneIds: sceneList.filter(s => s.timeOfDay === 'DAY' || s.timeOfDay === 'NIGHT').map(s => s.id),
      suggestion: 'Samle NATT-scener på dedikerte nattopptaks-dager.',
    },
  );
}

function detectStuntIsolation(
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
): Conflict | null {
  const sceneList = scenesOnDay(day, strips, scenes);
  const stuntScenes = sceneList.filter(s => s.specialRequirements.includes('STUNT'));
  if (stuntScenes.length === 0) return null;
  if (stuntScenes.length === sceneList.length) return null; // all stunt = ok
  // Stunt scenes exist alongside non-stunt scenes → isolation warning
  return conflict(
    'stunt_isolation', 'warning',
    `Dag ${day.dayNumber}: stunt med vanlige scener`,
    `${stuntScenes.length} stunt-scene(r) planlagt samme dag som vanlige scener. Stuntkoordinator anbefaler dedikert dag.`,
    {
      affectedDayIds: [day.id],
      affectedSceneIds: stuntScenes.map(s => s.id),
      suggestion: 'Isoler stunt-scener på egne dager for HMS og stuntkoordinator-tilgjengelighet.',
    },
  );
}

function detectChildActorHours(
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
  castMembers: Map<string, CastMember>,
): Conflict[] {
  const sceneList = scenesOnDay(day, strips, scenes);
  const childCastIds = new Set(
    [...castMembers.values()]
      .filter(c => c.notes?.toLowerCase().includes('barn') || c.notes?.toLowerCase().includes('child'))
      .map(c => c.id),
  );
  if (childCastIds.size === 0) return [];

  const conflicts: Conflict[] = [];
  for (const childId of childCastIds) {
    const childScenes = sceneList.filter(s => s.castIds.includes(childId));
    if (childScenes.length === 0) continue;
    const childMinutes = childScenes.reduce((acc, s) => acc + s.estimatedMinutes, 0);
    if (childMinutes > MAX_CHILD_HOURS) {
      const actor = castMembers.get(childId);
      conflicts.push(conflict(
        'child_actor_hours', 'error',
        `Dag ${day.dayNumber}: barneskuespiller overstiger grense`,
        `${actor?.actorName ?? actor?.characterName ?? childId} estimeres til ${Math.round(childMinutes / 60)}t – lovlig maks er ${MAX_CHILD_HOURS / 60}t.`,
        {
          affectedDayIds: [day.id],
          affectedSceneIds: childScenes.map(s => s.id),
          affectedCastIds: [childId],
        },
      ));
    }
  }
  return conflicts;
}

function detectActorConflicts(
  shootDays: Map<string, ShootDay>,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
): Conflict[] {
  // Bucket: date → unit → Set<castId>
  const dateUnitCast = new Map<string, Map<string, Set<string>>>();
  const dateUnitDays = new Map<string, Map<string, string>>(); // date → unit → dayId

  for (const day of shootDays.values()) {
    if (!day.date) continue;
    const dayCast = new Set(scenesOnDay(day, strips, scenes).flatMap(s => s.castIds));

    if (!dateUnitCast.has(day.date)) { dateUnitCast.set(day.date, new Map()); dateUnitDays.set(day.date, new Map()); }
    dateUnitCast.get(day.date)!.set(day.unit, dayCast);
    dateUnitDays.get(day.date)!.set(day.unit, day.id);
  }

  const conflicts: Conflict[] = [];

  for (const [date, unitMap] of dateUnitCast.entries()) {
    const units = [...unitMap.keys()];
    // Check all pairs of units on the same date
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const castA = unitMap.get(units[i])!;
        const castB = unitMap.get(units[j])!;
        const overlap = [...castA].filter(id => castB.has(id));
        if (overlap.length === 0) continue;
        conflicts.push(conflict(
          'actor_conflict', 'error',
          `Skuespillerkonflikt ${date}: ${units[i]}-enhet vs ${units[j]}-enhet`,
          `${overlap.length} skuespiller(e) er booket på begge enheter samtidig den ${date}.`,
          {
            affectedDayIds: [dateUnitDays.get(date)!.get(units[i])!, dateUnitDays.get(date)!.get(units[j])!],
            affectedSceneIds: [],
            affectedCastIds: overlap,
            suggestion: 'Flytt scener til ulike datoer eller fordel cast mellom enheter.',
          },
        ));
      }
    }
  }
  return conflicts;
}

function detectActorUnavailable(
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
  castMembers: Map<string, CastMember>,
): Conflict[] {
  if (!day.date) return [];
  const sceneList = scenesOnDay(day, strips, scenes);
  const allCastIds = [...new Set(sceneList.flatMap(s => s.castIds))];
  const conflicts: Conflict[] = [];

  for (const castId of allCastIds) {
    const member = castMembers.get(castId);
    if (!member) continue;
    const isBlackedOut = member.blackoutDates?.includes(day.date) ?? false;
    const beforeStart  = member.availableFrom  && day.date < member.availableFrom;
    const afterEnd     = member.availableUntil && day.date > member.availableUntil;
    if (isBlackedOut || beforeStart || afterEnd) {
      const reason = isBlackedOut ? 'påmeldt blackout-dato' : beforeStart ? 'ikke tilgjengelig ennå' : 'kontrakt utløpt';
      conflicts.push(conflict(
        'actor_unavailable', 'error',
        `${member.actorName ?? member.characterName} utilgjengelig – dag ${day.dayNumber}`,
        `${member.actorName ?? member.characterName} er ${reason} den ${day.date}.`,
        {
          affectedDayIds: [day.id],
          affectedSceneIds: sceneList.filter(s => s.castIds.includes(castId)).map(s => s.id),
          affectedCastIds: [castId],
        },
      ));
    }
  }
  return conflicts;
}

function detectActorTurnaround(
  sortedDays: ShootDay[],
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
): Conflict[] {
  // For consecutive shoot days, check wrap → call gap per actor
  const conflicts: Conflict[] = [];

  for (let i = 0; i < sortedDays.length - 1; i++) {
    const dayA = sortedDays[i];
    const dayB = sortedDays[i + 1];
    if (!dayA.date || !dayB.date) continue;
    if (dayA.date !== dayB.date && dayB.date > String(Number(dayA.date.replace(/-/g, '')) + 1)) continue;

    const wrapMin  = hmToMinutes(dayA.actualWrapTime ?? dayA.estimatedWrapTime);
    const callMin  = hmToMinutes(dayB.callTime);
    if (wrapMin === null || callMin === null) continue;

    const gapMinutes = (callMin + 24 * 60) - wrapMin;
    if (gapMinutes >= TURNAROUND_HOURS * 60) continue;

    const castA = new Set(scenesOnDay(dayA, strips, scenes).flatMap(s => s.castIds));
    const castB = new Set(scenesOnDay(dayB, strips, scenes).flatMap(s => s.castIds));
    const overlap = [...castA].filter(id => castB.has(id));
    if (overlap.length === 0) continue;

    conflicts.push(conflict(
      'actor_turnaround', 'warning',
      `For kort hvile: dag ${dayA.dayNumber} → dag ${dayB.dayNumber}`,
      `${Math.round(gapMinutes / 60)}t hvile mellom wrap og call – minimum er ${TURNAROUND_HOURS}t.`,
      {
        affectedDayIds: [dayA.id, dayB.id],
        affectedSceneIds: [],
        affectedCastIds: overlap,
        suggestion: `Skyv oppstart dag ${dayB.dayNumber} til etter kl. ${String(Math.floor((wrapMin + TURNAROUND_HOURS * 60) / 60)).padStart(2,'0')}:${String((wrapMin + TURNAROUND_HOURS * 60) % 60).padStart(2,'0')}.`,
      },
    ));
  }
  return conflicts;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run all conflict detectors against the current schedule.
 *
 * @param ctx  The resolved ScheduleContext.
 * @returns    Flat array of Conflict objects, sorted by severity (error first).
 */
export function detectConflicts(ctx: ScheduleContext): Conflict[] {
  const { scenes, strips, shootDays, castMembers, locations } = ctx;
  const results: Conflict[] = [];

  // Sorted days (for turnaround check)
  const sortedDays = [...shootDays.values()].sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return a.dayNumber - b.dayNumber;
  });

  // Per-day detectors
  for (const day of sortedDays) {
    const po = detectPageOverload(day, strips, scenes);
    if (po) results.push(po);

    const to = detectTimeOverload(day, strips, scenes);
    if (to) results.push(to);

    const lm = detectLocationMismatch(day, strips, scenes, locations);
    if (lm) results.push(lm);

    const ndv = detectNightDayViolation(day, strips, scenes);
    if (ndv) results.push(ndv);

    const si = detectStuntIsolation(day, strips, scenes);
    if (si) results.push(si);

    results.push(...detectChildActorHours(day, strips, scenes, castMembers));
    results.push(...detectActorUnavailable(day, strips, scenes, castMembers));
  }

  // Cross-day detectors
  results.push(...detectActorConflicts(shootDays, strips, scenes));
  results.push(...detectActorTurnaround(sortedDays, strips, scenes));

  // Severity sort: error → warning → info
  const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
  return results.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
}

/**
 * Lightweight re-check for a single day.
 * Use after a single Strip move to avoid re-running the full scan.
 */
export function detectConflictsForDay(dayId: string, ctx: ScheduleContext): Conflict[] {
  const day = ctx.shootDays.get(dayId);
  if (!day) return [];
  const results: Conflict[] = [];

  const po = detectPageOverload(day, ctx.strips, ctx.scenes);
  if (po) results.push(po);

  const to = detectTimeOverload(day, ctx.strips, ctx.scenes);
  if (to) results.push(to);

  const lm = detectLocationMismatch(day, ctx.strips, ctx.scenes, ctx.locations);
  if (lm) results.push(lm);

  const ndv = detectNightDayViolation(day, ctx.strips, ctx.scenes);
  if (ndv) results.push(ndv);

  const si = detectStuntIsolation(day, ctx.strips, ctx.scenes);
  if (si) results.push(si);

  results.push(...detectChildActorHours(day, ctx.strips, ctx.scenes, ctx.castMembers));
  results.push(...detectActorUnavailable(day, ctx.strips, ctx.scenes, ctx.castMembers));

  return results.sort((a, b) => ({ error: 0, warning: 1, info: 2 }[a.severity] ?? 3) - ({ error: 0, warning: 1, info: 2 }[b.severity] ?? 3));
}

/**
 * Count conflicts by type for the stats panel.
 */
export function summariseConflicts(conflicts: Conflict[]): Partial<Record<ConflictType, number>> {
  const map: Partial<Record<ConflictType, number>> = {};
  for (const c of conflicts) map[c.type] = (map[c.type] ?? 0) + 1;
  return map;
}
