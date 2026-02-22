/**
 * useShootDayEngine.ts
 *
 * The ShootDay Engine.
 * Manages an ordered list of ShootDay entities and the scene strips they hold.
 *
 * Responsibilities:
 *  - CRUD for ShootDay[]
 *  - Assign / un-assign ScenePoolItems to/from days
 *  - Reorder strips within a day (drag-and-drop)
 *  - Move a strip from one day to another
 *  - Derive per-day totals + whole-project summary
 *
 * The engine is pool-aware: it calls pool.removeMany / pool.restore
 * when scenes move between pool and days, keeping the two in sync.
 */

import { useState, useMemo, useCallback } from 'react';
import type {
  ShootDay,
  ShootDayStrip,
  ShootDayDerived,
  ShootDayEngineSummary,
  ProductionUnit,
  ScenePoolItem,
} from './stripboard.types';
import type { ScenePoolHandle } from './useScenePool';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const MAX_SHOOT_MINUTES = 600; // 10 hours — beyond this a day is flagged over-capacity

const UNIT_LABELS: Record<ProductionUnit, string> = {
  A: 'A-enhet',
  B: 'B-enhet',
  C: 'C-enhet',
  D: 'D-enhet',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useShootDayEngine
 *
 * @param pool        The scene pool handle returned by useScenePool.
 *                    The engine reads pool.allItems to resolve scene data
 *                    and calls pool.removeMany / pool.restore to keep
 *                    the pool in sync.
 * @param initialDays Optional initial shoot days (e.g. loaded from API).
 *
 * Usage:
 * ```tsx
 * const pool   = useScenePool(DEMO_POOL_ITEMS);
 * const engine = useShootDayEngine(pool, DEMO_SHOOT_DAYS);
 *
 * engine.createDay('A', '2026-03-01');
 * engine.assignScene('scene-7', 'day-1');
 * engine.reorderStrip('day-1', 2, 0);   // move strip from index 2 to 0
 * engine.moveStrip(fromDayId, toDayId, stripId);
 * engine.unassignScene('scene-7', 'day-1');
 * ```
 */
export function useShootDayEngine(
  pool: ScenePoolHandle,
  initialDays: ShootDay[] = [],
) {
  const [days, setDays] = useState<ShootDay[]>(initialDays);

  // ── Lookup helpers (not state, recalculated inline) ───────────────────────

  /** Find the ScenePoolItem for a given pool-item id, across all days' strips. */
  const resolvePoolItem = useCallback(
    (scenePoolItemId: string): ScenePoolItem | undefined =>
      pool.allItems.find(s => s.id === scenePoolItemId),
    [pool.allItems],
  );

  // ── Day CRUD ──────────────────────────────────────────────────────────────

  /**
   * Create a new (empty) shoot day.
   * @returns The newly created ShootDay.
   */
  const createDay = useCallback(
    (unit: ProductionUnit = 'A', date?: string, callTime?: string, location?: string) => {
      const ts = new Date().toISOString();
      const newDay: ShootDay = {
        id: makeId('day'),
        projectId: '',          // caller may patch via updateDay
        dayNumber: 0,           // recalculated below
        date,
        unit,
        strips: [],
        callTime,
        location,
        createdAt: ts,
        updatedAt: ts,
      };
      setDays(prev => {
        const withNew = [...prev, newDay];
        // Assign sequential dayNumbers within each unit
        return renumberDays(withNew);
      });
      return newDay;
    },
    [],
  );

  /**
   * Delete a shoot day. All its strips are returned to the pool.
   */
  const deleteDay = useCallback(
    (dayId: string) => {
      setDays(prev => {
        const day = prev.find(d => d.id === dayId);
        if (day && day.strips.length > 0) {
          // Restore scenes to pool
          const poolItems: ScenePoolItem[] = day.strips
            .map(s => resolvePoolItem(s.scenePoolItemId))
            .filter((x): x is ScenePoolItem => x !== undefined);
          pool.restore(poolItems);
        }
        return renumberDays(prev.filter(d => d.id !== dayId));
      });
    },
    [resolvePoolItem, pool],
  );

  /**
   * Update non-strip fields of a ShootDay.
   */
  const updateDay = useCallback(
    (dayId: string, patch: Partial<Omit<ShootDay, 'id' | 'projectId' | 'strips' | 'createdAt' | 'updatedAt'>>) => {
      setDays(prev => prev.map(d => {
        if (d.id !== dayId) return d;
        return { ...d, ...patch, updatedAt: new Date().toISOString() };
      }));
    },
    [],
  );

  // ── Strip operations ──────────────────────────────────────────────────────

  /**
   * Assign a scene (by pool item id) to a shoot day.
   * Removes it from the pool. Adds at the end (or at `position` if given).
   */
  const assignScene = useCallback(
    (scenePoolItemId: string, dayId: string, position?: number) => {
      const newStrip: ShootDayStrip = {
        stripId: makeId('strip'),
        scenePoolItemId,
        sortOrder: 0, // recalculated in reducer
      };

      setDays(prev => prev.map(d => {
        if (d.id !== dayId) return d;
        const existing = d.strips.find(s => s.scenePoolItemId === scenePoolItemId);
        if (existing) return d; // already on this day

        const strips = [...d.strips];
        if (position !== undefined && position >= 0 && position <= strips.length) {
          strips.splice(position, 0, newStrip);
        } else {
          strips.push(newStrip);
        }
        return {
          ...d,
          strips: normaliseStripOrder(strips),
          updatedAt: new Date().toISOString(),
        };
      }));

      pool.removeMany([scenePoolItemId]);
    },
    [pool],
  );

  /**
   * Assign multiple scenes at once.
   */
  const assignScenes = useCallback(
    (scenePoolItemIds: string[], dayId: string) => {
      const newStrips: ShootDayStrip[] = scenePoolItemIds.map(id => ({
        stripId: makeId('strip'),
        scenePoolItemId: id,
        sortOrder: 0,
      }));

      setDays(prev => prev.map(d => {
        if (d.id !== dayId) return d;
        const existingIds = new Set(d.strips.map(s => s.scenePoolItemId));
        const fresh = newStrips.filter(s => !existingIds.has(s.scenePoolItemId));
        return {
          ...d,
          strips: normaliseStripOrder([...d.strips, ...fresh]),
          updatedAt: new Date().toISOString(),
        };
      }));

      pool.removeMany(scenePoolItemIds);
    },
    [pool],
  );

  /**
   * Remove a scene from a shoot day and return it to the pool.
   */
  const unassignScene = useCallback(
    (scenePoolItemId: string, dayId: string) => {
      setDays(prev => prev.map(d => {
        if (d.id !== dayId) return d;
        return {
          ...d,
          strips: normaliseStripOrder(d.strips.filter(s => s.scenePoolItemId !== scenePoolItemId)),
          updatedAt: new Date().toISOString(),
        };
      }));

      const poolItem = resolvePoolItem(scenePoolItemId);
      if (poolItem) pool.restore([poolItem]);
    },
    [resolvePoolItem, pool],
  );

  /**
   * Reorder a strip within the same day using from/to indices.
   * Classic drag-and-drop reorder.
   */
  const reorderStrip = useCallback(
    (dayId: string, fromIndex: number, toIndex: number) => {
      setDays(prev => prev.map(d => {
        if (d.id !== dayId || fromIndex === toIndex) return d;
        const strips = [...d.strips];
        const [moved] = strips.splice(fromIndex, 1);
        strips.splice(toIndex, 0, moved);
        return {
          ...d,
          strips: normaliseStripOrder(strips),
          updatedAt: new Date().toISOString(),
        };
      }));
    },
    [],
  );

  /**
   * Move a strip from one day to another (optionally at a specific position).
   * Does NOT touch the pool.
   */
  const moveStrip = useCallback(
    (fromDayId: string, toDayId: string, stripId: string, toPosition?: number) => {
      if (fromDayId === toDayId) return;

      setDays(prev => {
        let movedStrip: ShootDayStrip | undefined;
        // Remove from source
        const updated = prev.map(d => {
          if (d.id !== fromDayId) return d;
          const st = d.strips.find(s => s.stripId === stripId);
          if (!st) return d;
          movedStrip = { ...st, stripId: makeId('strip') }; // new id on target day
          return {
            ...d,
            strips: normaliseStripOrder(d.strips.filter(s => s.stripId !== stripId)),
            updatedAt: new Date().toISOString(),
          };
        });
        if (!movedStrip) return prev;
        // Insert into target
        return updated.map(d => {
          if (d.id !== toDayId) return d;
          const strips = [...d.strips];
          if (toPosition !== undefined && toPosition >= 0 && toPosition <= strips.length) {
            strips.splice(toPosition, 0, movedStrip!);
          } else {
            strips.push(movedStrip!);
          }
          return {
            ...d,
            strips: normaliseStripOrder(strips),
            updatedAt: new Date().toISOString(),
          };
        });
      });
    },
    [],
  );

  /**
   * Update per-strip metadata without affecting ordering or pool.
   */
  const updateStrip = useCallback(
    (dayId: string, stripId: string, patch: Partial<Pick<ShootDayStrip, 'overrideEstimatedMinutes' | 'notes'>>) => {
      setDays(prev => prev.map(d => {
        if (d.id !== dayId) return d;
        return {
          ...d,
          strips: d.strips.map(s => s.stripId === stripId ? { ...s, ...patch } : s),
          updatedAt: new Date().toISOString(),
        };
      }));
    },
    [],
  );

  // ── Derived per-day totals ────────────────────────────────────────────────

  const derivedDays = useMemo((): Map<string, ShootDayDerived> => {
    const map = new Map<string, ShootDayDerived>();

    for (const day of days) {
      const cast = new Set<string>();
      const locations = new Set<string>();
      let totalPages = 0;
      let totalMinutes = 0;
      let hasSpecialRequirements = false;

      for (const strip of day.strips) {
        const scene = resolvePoolItem(strip.scenePoolItemId);
        if (!scene) continue;
        totalPages   += scene.pageCount;
        totalMinutes += strip.overrideEstimatedMinutes ?? scene.estimatedMinutes;
        scene.cast.forEach(c => cast.add(c));
        locations.add(scene.location);
        if (scene.specialRequirements.length > 0) hasSpecialRequirements = true;
      }

      map.set(day.id, {
        dayId: day.id,
        totalPages,
        totalMinutes,
        castRequired: [...cast].sort(),
        locations: [...locations].sort(),
        isOverCapacity: totalMinutes > MAX_SHOOT_MINUTES,
        hasSpecialRequirements,
        unitLabel: UNIT_LABELS[day.unit] ?? day.unit,
      });
    }

    return map;
  }, [days, resolvePoolItem]);

  // ── Project-level summary ─────────────────────────────────────────────────

  const summary = useMemo((): ShootDayEngineSummary => {
    const byUnit: Record<ProductionUnit, number> = { A: 0, B: 0, C: 0, D: 0 };
    let scheduledScenes = 0, totalScheduledPages = 0, totalScheduledMinutes = 0;

    for (const day of days) {
      byUnit[day.unit] = (byUnit[day.unit] ?? 0) + 1;
      const derived = derivedDays.get(day.id);
      if (derived) {
        scheduledScenes     += day.strips.length;
        totalScheduledPages += derived.totalPages;
        totalScheduledMinutes += derived.totalMinutes;
      }
    }

    return {
      totalDays: days.length,
      byUnit,
      scheduledScenes,
      unscheduledScenes: pool.allItems.length,
      totalScheduledPages,
      totalScheduledMinutes,
    };
  }, [days, derivedDays, pool.allItems.length]);

  // ── Sorted view for UI ────────────────────────────────────────────────────

  /** Days sorted by date (TBD last), then dayNumber, then unit. */
  const sortedDays = useMemo((): ShootDay[] =>
    [...days].sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      if (a.unit !== b.unit) return a.unit.localeCompare(b.unit);
      return a.dayNumber - b.dayNumber;
    }),
  [days]);

  return {
    // state
    days,
    sortedDays,
    derivedDays,
    summary,
    // day CRUD
    createDay,
    deleteDay,
    updateDay,
    // strip operations
    assignScene,
    assignScenes,
    unassignScene,
    reorderStrip,
    moveStrip,
    updateStrip,
  } as const;
}

export type ShootDayEngineHandle = ReturnType<typeof useShootDayEngine>;

// ─── Pure helpers (not exported) ─────────────────────────────────────────────

/** Ensure sortOrder is 0-based sequential after any mutation. */
function normaliseStripOrder(strips: ShootDayStrip[]): ShootDayStrip[] {
  return strips.map((s, idx) => ({ ...s, sortOrder: idx }));
}

/**
 * Renumber dayNumber sequentially within each unit (A: 1,2,3 … B: 1,2,3 …).
 * Sort by date first, then insertion order.
 */
function renumberDays(days: ShootDay[]): ShootDay[] {
  const unitCounters: Partial<Record<ProductionUnit, number>> = {};
  return [...days]
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    })
    .map(d => {
      unitCounters[d.unit] = (unitCounters[d.unit] ?? 0) + 1;
      return { ...d, dayNumber: unitCounters[d.unit]! };
    });
}
