/**
 * useConflictDetection.ts
 *
 * React hook that wraps the pure conflictEngine.
 *
 * Re-runs automatically whenever the strip/day/cast/location maps change.
 * Uses useMemo so the expensive scan only fires when something has actually
 * changed (Map reference equality).
 *
 * Usage:
 *
 *   const {
 *     conflicts,          // Conflict[] — sorted error → warning → info
 *     conflictsByDay,     // Map<dayId, Conflict[]>
 *     conflictsByScene,   // Map<sceneId, Conflict[]>
 *     summary,            // Partial<Record<ConflictType, number>>
 *     hasErrors,          // true if any severity==='error'
 *     hasWarnings,        // true if any severity==='warning'
 *   } = useConflictDetection(scenes, strips, shootDays, castMembers, locations);
 */

import { useMemo } from 'react';
import {
  detectConflicts,
  summariseConflicts,
} from './domain/conflictEngine';
import type {
  Scene, Strip, ShootDay, CastMember, Location, Conflict, ConflictType,
} from './domain/types';

// ─── Return shape ─────────────────────────────────────────────────────────────

export interface ConflictDetectionResult {
  /** Full sorted conflict list (error → warning → info). */
  conflicts: Conflict[];
  /** Conflicts indexed by the shoot-day IDs they affect. */
  conflictsByDay: Map<string, Conflict[]>;
  /** Conflicts indexed by the scene IDs they affect. */
  conflictsByScene: Map<string, Conflict[]>;
  /** Count of each ConflictType — for badge counters in the UI. */
  summary: Partial<Record<ConflictType, number>>;
  /** true if any conflict has severity 'error'. */
  hasErrors: boolean;
  /** true if any conflict has severity 'warning'. */
  hasWarnings: boolean;
  /** Total conflict count. */
  conflictCount: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConflictDetection(
  scenes:      Map<string, Scene>,
  strips:      Map<string, Strip>,
  shootDays:   Map<string, ShootDay>,
  castMembers: Map<string, CastMember>,
  locations:   Map<string, Location>,
): ConflictDetectionResult {

  // 1. Run full conflict scan (only when inputs change).
  const conflicts = useMemo(
    () => detectConflicts({ scenes, strips, shootDays, castMembers, locations }),
    [scenes, strips, shootDays, castMembers, locations],
  );

  // 2. Index conflicts by day.
  const conflictsByDay = useMemo<Map<string, Conflict[]>>(() => {
    const map = new Map<string, Conflict[]>();
    for (const c of conflicts) {
      for (const dayId of c.affectedDayIds) {
        if (!map.has(dayId)) map.set(dayId, []);
        map.get(dayId)!.push(c);
      }
    }
    return map;
  }, [conflicts]);

  // 3. Index conflicts by scene.
  const conflictsByScene = useMemo<Map<string, Conflict[]>>(() => {
    const map = new Map<string, Conflict[]>();
    for (const c of conflicts) {
      for (const sceneId of c.affectedSceneIds) {
        if (!map.has(sceneId)) map.set(sceneId, []);
        map.get(sceneId)!.push(c);
      }
    }
    return map;
  }, [conflicts]);

  // 4. Aggregate summary.
  const summary = useMemo(() => summariseConflicts(conflicts), [conflicts]);

  // 5. Boolean flags.
  const hasErrors   = conflicts.some(c => c.severity === 'error');
  const hasWarnings = conflicts.some(c => c.severity === 'warning');

  return {
    conflicts,
    conflictsByDay,
    conflictsByScene,
    summary,
    hasErrors,
    hasWarnings,
    conflictCount: conflicts.length,
  };
}
