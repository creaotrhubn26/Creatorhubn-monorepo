import { useMemo, useCallback } from "react";
import { generateDOOD, getCode as engineGetCode, getWorkDays, summariseDOOD, type DOODActorSummary } from "./domain/doodEngine";
import type { Scene, Strip, ShootDay, CastMember, DOODMatrix, DOODCode } from "./domain/types";

// ─── Return shape ─────────────────────────────────────────────────────────────

export interface DOODResult {
  /** Full cast × shoot-day DOOD matrix. */
  matrix: DOODMatrix;
  /** Per-actor summary: work days, hold days, travel days. */
  summaries: DOODActorSummary[];
  /**
   * Look up the DOOD code for a single cell.
   * Returns `undefined` when the actor has no presence on that day.
   */
  getCode: (castMemberId: string, shootDayId: string) => DOODCode | undefined;
  /**
   * Returns true if the actor is a Work day (W / SW / WF / SWF) on the given shoot day.
   */
  isWorkDay: (castMemberId: string, shootDayId: string) => boolean;
  /** Total work-day entries across the whole project (used for page-count warnings). */
  totalWorkDays: number;
  /** Total hold-day entries across the whole project. */
  totalHoldDays: number;
}

// ─── DOOD work-day codes ──────────────────────────────────────────────────────

const WORK_CODES = new Set<DOODCode>(['W', 'SW', 'WF', 'SWF']);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDOOD(
  scenes:      Map<string, Scene>,
  strips:      Map<string, Strip>,
  shootDays:   Map<string, ShootDay>,
  castMembers: Map<string, CastMember>,
): DOODResult {

  // 1. Build the full matrix.
  const matrix = useMemo(
    () => generateDOOD({ scenes, strips, shootDays, castMembers }),
    [scenes, strips, shootDays, castMembers],
  );

  // 2. Per-actor summaries.
  const summaries = useMemo<DOODActorSummary[]>(
    () => summariseDOOD(matrix),
    [matrix],
  );

  // 3. Stable cell look-up callback (no new object on re-renders).
  const getCode = useCallback(
    (castMemberId: string, shootDayId: string): DOODCode | undefined =>
      engineGetCode(matrix, castMemberId, shootDayId),
    [matrix],
  );

  const isWorkDay = useCallback(
    (castMemberId: string, shootDayId: string): boolean => {
      const code = engineGetCode(matrix, castMemberId, shootDayId);
      return code !== undefined && WORK_CODES.has(code);
    },
    [matrix],
  );

  // 4. Aggregate totals for quick stats.
  const { totalWorkDays, totalHoldDays } = useMemo(() => {
    let workDays = 0;
    let holdDays = 0;
    for (const row of matrix.rows) {
      const entries = getWorkDays(matrix, row.castMember.id);
      workDays += entries.filter(e => WORK_CODES.has(e.code)).length;
      holdDays += entries.filter(e => e.code === 'H').length;
    }
    return { totalWorkDays: workDays, totalHoldDays: holdDays };
  }, [matrix]);

  return {
    matrix,
    summaries,
    getCode,
    isWorkDay,
    totalWorkDays,
    totalHoldDays,
  };
}
