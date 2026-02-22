/**
 * domain/productionStats.ts
 *
 * Derived production statistics.
 * Pure functions — NO React, NO state.
 *
 * All values in ProductionStats are COMPUTED from the schedule graph.
 * Nothing is manually set. When the schedule changes, call
 * computeProductionStats() again (put it in a useMemo).
 */

import type {
  Scene, Strip, ShootDay, CastMember, Breakdown, BreakdownCategory,
  ProductionStats, ConflictType,
} from './types';
import type { Conflict } from './types';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface StatsContext {
  scenes:      Map<string, Scene>;
  strips:      Map<string, Strip>;
  shootDays:   Map<string, ShootDay>;
  castMembers: Map<string, CastMember>;
  breakdowns:  Map<string, Breakdown>;
  conflicts:   Conflict[];   // pass current conflict list from conflictEngine
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Compute the full ProductionStats snapshot.
 * Deterministic — same input → same output.
 */
export function computeProductionStats(ctx: StatsContext): ProductionStats {
  const { scenes, strips, shootDays, castMembers, breakdowns, conflicts } = ctx;

  // ── Scenes ──────────────────────────────────────────────────────────────
  let totalPages = 0, pagesShot = 0, pagesScheduled = 0, pagesUnscheduled = 0;
  let scenesShot = 0, scenesScheduled = 0, scenesNotScheduled = 0;
  let scenesPostponed = 0, scenesOmitted = 0;
  let totalEstimatedMinutes = 0;
  let scenesWithBreakdown = 0, scenesWithSpecialReqs = 0;
  const scheduledLocationIds = new Set<string>();

  for (const scene of scenes.values()) {
    totalPages            += scene.pageCount;
    totalEstimatedMinutes += scene.estimatedMinutes;
    if (scene.breakdownId && breakdowns.has(scene.breakdownId)) scenesWithBreakdown++;
    if (scene.specialRequirements.length > 0) scenesWithSpecialReqs++;

    switch (scene.status) {
      case 'shot':
        scenesShot++;
        pagesShot += scene.pageCount;
        scheduledLocationIds.add(scene.locationId);
        break;
      case 'scheduled':
        scenesScheduled++;
        pagesScheduled += scene.pageCount;
        scheduledLocationIds.add(scene.locationId);
        break;
      case 'not-scheduled':
        scenesNotScheduled++;
        pagesUnscheduled += scene.pageCount;
        break;
      case 'postponed':
        scenesPostponed++;
        pagesUnscheduled += scene.pageCount;
        break;
      case 'omitted':
        scenesOmitted++;
        break;
    }
  }

  // ── Shoot days ───────────────────────────────────────────────────────────
  const daysByUnit: ProductionStats['daysByUnit'] = { A: 0, B: 0, C: 0, D: 0 };
  let daysWrapped = 0, overloadedDays = 0;

  for (const day of shootDays.values()) {
    daysByUnit[day.unit] = (daysByUnit[day.unit] ?? 0) + 1;
    if (day.status === 'wrapped') daysWrapped++;

    // Compute day minutes from strips
    let dayMinutes = 0;
    for (const sid of day.stripIds) {
      const strip = strips.get(sid);
      if (!strip) continue;
      const scene = scenes.get(strip.sceneId);
      dayMinutes += strip.overrideEstimatedMinutes ?? scene?.estimatedMinutes ?? 0;
    }
    if (dayMinutes > 600) overloadedDays++;
  }

  const totalShootDays = shootDays.size;
  const daysRemaining  = totalShootDays - daysWrapped;

  // ── Cast ─────────────────────────────────────────────────────────────────
  // Average work days: total strip-actor pairs / total cast members
  let totalActorDayPairs = 0;
  for (const day of shootDays.values()) {
    const castOnDay = new Set<string>();
    for (const sid of day.stripIds) {
      const strip = strips.get(sid);
      if (!strip) continue;
      const scene = scenes.get(strip.sceneId);
      scene?.castIds.forEach(c => castOnDay.add(c));
    }
    totalActorDayPairs += castOnDay.size;
  }
  const totalCastMembers = castMembers.size;
  const averageWorkDaysPerActor = totalCastMembers > 0
    ? totalActorDayPairs / totalCastMembers
    : 0;

  // ── Locations ────────────────────────────────────────────────────────────
  const totalLocations = new Set([...scenes.values()].map(s => s.locationId)).size;
  const uniqueLocationsScheduled = scheduledLocationIds.size;

  // ── Pages per minute ─────────────────────────────────────────────────────
  const scheduledScenes = [...scenes.values()].filter(s => s.status === 'shot' || s.status === 'scheduled');
  const pagesWithMinutes = scheduledScenes.filter(s => s.estimatedMinutes > 0);
  const averageMinutesPerPage = pagesWithMinutes.length > 0
    ? pagesWithMinutes.reduce((acc, s) => acc + s.estimatedMinutes / s.pageCount, 0) / pagesWithMinutes.length
    : 0;

  // ── Conflicts ────────────────────────────────────────────────────────────
  const conflictsByType: Partial<Record<ConflictType, number>> = {};
  for (const c of conflicts) {
    conflictsByType[c.type] = (conflictsByType[c.type] ?? 0) + 1;
  }

  return {
    totalScenes: scenes.size,
    scenesShot,
    scenesScheduled,
    scenesNotScheduled,
    scenesPostponed,
    scenesOmitted,
    totalPages,
    pagesShot,
    pagesScheduled,
    pagesUnscheduled,
    percentPagesShot: totalPages > 0 ? (pagesShot / totalPages) * 100 : 0,
    totalShootDays,
    daysWrapped,
    daysRemaining,
    daysByUnit,
    totalEstimatedMinutes,
    averageMinutesPerPage,
    overloadedDays,
    totalCastMembers,
    averageWorkDaysPerActor,
    totalLocations,
    uniqueLocationsScheduled,
    scenesWithBreakdown,
    scenesWithSpecialRequirements: scenesWithSpecialReqs,
    activeConflicts: conflicts.length,
    conflictsByType,
    computedAt: new Date().toISOString(),
  };
}

// ─── Breakdown element stats ─────────────────────────────────────────────────

// ─── Breakdown element stats ─────────────────────────────────────────────────

/**
 * Aggregate counts of breakdown elements across all breakdowns.
 * Useful for production dashboards showing total props, VFX shots, stunts, etc.
 */
export interface BreakdownElementStats {
  /** Total number of breakdown sheets. */
  totalBreakdowns: number;
  /** Breakdown sheets that have been locked (AD sign-off). */
  lockedBreakdowns: number;
  /** Total breakdown elements across all categories. */
  totalElements: number;
  /** Per-category element counts. */
  byCategory: Partial<Record<BreakdownCategory, number>>;
  /** Sum of element quantities (where specified). */
  totalQuantity: number;
}

/**
 * Compute aggregate breakdown element statistics from the breakdowns map.
 * Call this alongside computeProductionStats() when the breakdowns panel
 * is displayed or when generating a production report.
 */
export function computeBreakdownElementStats(
  breakdowns: Map<string, Breakdown>,
): BreakdownElementStats {
  const byCategory: Partial<Record<BreakdownCategory, number>> = {};
  let totalElements = 0;
  let lockedBreakdowns = 0;
  let totalQuantity = 0;

  for (const bd of breakdowns.values()) {
    if (bd.isLocked) lockedBreakdowns++;
    for (const el of bd.elements) {
      byCategory[el.category] = (byCategory[el.category] ?? 0) + 1;
      totalElements++;
      if (el.quantity !== undefined) totalQuantity += el.quantity;
    }
  }

  return {
    totalBreakdowns: breakdowns.size,
    lockedBreakdowns,
    totalElements,
    byCategory,
    totalQuantity,
  };
}

// ─── Per-day derived values (used by both UI and DOOD) ───────────────────────

export interface DayStats {
  dayId: string;
  dayNumber: number;
  totalPages: number;
  totalMinutes: number;
  sceneCount: number;
  castRequired: string[];   // cast member IDs
  locationIds: string[];
  hasConflict: boolean;
  isOverCapacity: boolean;
  percentageOfDay: number;  // totalMinutes / 600
}

export function computeDayStats(
  day: ShootDay,
  strips: Map<string, Strip>,
  scenes: Map<string, Scene>,
  conflicts: Conflict[],
): DayStats {
  const castIds   = new Set<string>();
  const locIds    = new Set<string>();
  let totalPages  = 0;
  let totalMinutes = 0;

  for (const sid of day.stripIds) {
    const strip = strips.get(sid);
    if (!strip) continue;
    const scene = scenes.get(strip.sceneId);
    if (!scene) continue;
    totalPages   += scene.pageCount;
    totalMinutes += strip.overrideEstimatedMinutes ?? scene.estimatedMinutes;
    scene.castIds.forEach(id => castIds.add(id));
    locIds.add(scene.locationId);
  }

  const hasConflict = conflicts.some(c => c.affectedDayIds.includes(day.id));

  return {
    dayId:         day.id,
    dayNumber:     day.dayNumber,
    totalPages,
    totalMinutes,
    sceneCount:    day.stripIds.length,
    castRequired:  [...castIds],
    locationIds:   [...locIds],
    hasConflict,
    isOverCapacity: totalMinutes > 600,
    percentageOfDay: Math.min(totalMinutes / 600, 1),
  };
}
