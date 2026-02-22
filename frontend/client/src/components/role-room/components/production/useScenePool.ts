/**
 * useScenePool.ts
 *
 * Manages the "unscheduled scene pool" – every scene lives here first,
 * before the ShootDay Engine pulls it onto a day.
 *
 * Responsibilities:
 *  - CRUD for ScenePoolItem[]
 *  - Filter / sort state
 *  - Derived stats
 *  - Colour derivation from INT/EXT + time-of-day
 */

import { useState, useMemo, useCallback } from 'react';
import type {
  ScenePoolItem,
  ScenePoolStats,
  IntExtType,
  TimeOfDay,
} from './stripboard.types';

// ─── Color derivation ─────────────────────────────────────────────────────────

/**
 * Maps (IntExtType × TimeOfDay) → hex colour used on the physical strip.
 * Classic TV/film colour-coding convention.
 */
const COLOR_MAP: Record<IntExtType, Record<TimeOfDay, string>> = {
  INT:     { DAY: '#fff9c4', NIGHT: '#1a237e', DAWN: '#ffe0b2', DUSK: '#f3e5f5' },
  EXT:     { DAY: '#e3f2fd', NIGHT: '#263238', DAWN: '#fff3e0', DUSK: '#fce4ec' },
  'INT/EXT': { DAY: '#e8f5e9', NIGHT: '#4a148c', DAWN: '#fbe9e7', DUSK: '#ede7f6' },
};

export function deriveStripColor(intExt: IntExtType, timeOfDay: TimeOfDay): string {
  return COLOR_MAP[intExt]?.[timeOfDay] ?? '#f5f5f5';
}

// ─── Filter / sort types ──────────────────────────────────────────────────────

export type PoolSortKey =
  | 'sceneNumber'
  | 'pageCount'
  | 'location'
  | 'castSize'
  | 'estimatedMinutes'
  | 'addedAt';

export type PoolSortDir = 'asc' | 'desc';

export interface ScenePoolFilters {
  intExtType: IntExtType | 'all';
  timeOfDay: TimeOfDay | 'all';
  location: string;        // '' = any
  castMember: string;      // '' = any
  hasSpecialReqs: boolean | null; // null = any
  searchQuery: string;
}

const DEFAULT_FILTERS: ScenePoolFilters = {
  intExtType: 'all',
  timeOfDay: 'all',
  location: '',
  castMember: '',
  hasSpecialReqs: null,
  searchQuery: '',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useScenePool – manages the unscheduled scene pool.
 *
 * Usage:
 * ```tsx
 * const pool = useScenePool(initialItems);
 * // pool.items         – filtered + sorted list for UI
 * // pool.allItems      – raw canonical list
 * // pool.stats         – aggregate stats
 * // pool.add(item)
 * // pool.remove(id)
 * // pool.update(id, patch)
 * // pool.bulkAdd(items)
 * // pool.filters / pool.setFilter
 * // pool.sort / pool.setSort
 * ```
 */
export function useScenePool(initialItems: ScenePoolItem[] = []) {
  // ── Canonical state ──────────────────────────────────────────────────────
  const [allItems, setAllItems] = useState<ScenePoolItem[]>(initialItems);

  // ── Filter / sort state ──────────────────────────────────────────────────
  const [filters, setFiltersState] = useState<ScenePoolFilters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey]       = useState<PoolSortKey>('sceneNumber');
  const [sortDir, setSortDir]       = useState<PoolSortDir>('asc');

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const add = useCallback((item: Omit<ScenePoolItem, 'addedAt'>) => {
    const full: ScenePoolItem = {
      ...item,
      color: item.color || deriveStripColor(item.intExtType, item.timeOfDay),
      addedAt: new Date().toISOString(),
    };
    setAllItems(prev => [...prev, full]);
    return full;
  }, []);

  const remove = useCallback((id: string) => {
    setAllItems(prev => prev.filter(s => s.id !== id));
  }, []);

  const update = useCallback((id: string, patch: Partial<Omit<ScenePoolItem, 'id' | 'addedAt'>>) => {
    setAllItems(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = { ...s, ...patch };
      // Re-derive colour only when the relevant fields change
      if (patch.intExtType !== undefined || patch.timeOfDay !== undefined) {
        next.color = patch.color ?? deriveStripColor(next.intExtType, next.timeOfDay);
      }
      return next;
    }));
  }, []);

  const bulkAdd = useCallback((items: Omit<ScenePoolItem, 'addedAt'>[]) => {
    const ts = new Date().toISOString();
    const full: ScenePoolItem[] = items.map(item => ({
      ...item,
      color: item.color || deriveStripColor(item.intExtType, item.timeOfDay),
      addedAt: ts,
    }));
    setAllItems(prev => [...prev, ...full]);
    return full;
  }, []);

  /** Remove multiple scenes at once (called by engine when assigning to a day). */
  const removeMany = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setAllItems(prev => prev.filter(s => !set.has(s.id)));
  }, []);

  /** Re-add scenes to the pool (called when unassigning from a day). */
  const restore = useCallback((items: ScenePoolItem[]) => {
    setAllItems(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const fresh = items.filter(s => !existingIds.has(s.id));
      return [...prev, ...fresh];
    });
  }, []);

  // ── Filter helpers ────────────────────────────────────────────────────────

  const setFilter = useCallback(
    <K extends keyof ScenePoolFilters>(key: K, value: ScenePoolFilters[K]) => {
      setFiltersState(prev => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), []);

  // ── Derived filtered + sorted list ────────────────────────────────────────

  const items = useMemo((): ScenePoolItem[] => {
    const q = filters.searchQuery.toLowerCase();

    let result = allItems.filter(s => {
      if (filters.intExtType !== 'all' && s.intExtType !== filters.intExtType) return false;
      if (filters.timeOfDay !== 'all' && s.timeOfDay !== filters.timeOfDay) return false;
      if (filters.location && !s.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
      if (filters.castMember && !s.cast.some(c => c.toLowerCase().includes(filters.castMember.toLowerCase()))) return false;
      if (filters.hasSpecialReqs === true && s.specialRequirements.length === 0) return false;
      if (filters.hasSpecialReqs === false && s.specialRequirements.length > 0) return false;
      if (q && !s.sceneNumber.toLowerCase().includes(q) &&
               !s.location.toLowerCase().includes(q) &&
               !(s.title ?? '').toLowerCase().includes(q) &&
               !s.cast.some(c => c.toLowerCase().includes(q))) return false;
      return true;
    });

    result = result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'sceneNumber':      cmp = a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true }); break;
        case 'pageCount':        cmp = a.pageCount - b.pageCount; break;
        case 'location':         cmp = a.location.localeCompare(b.location); break;
        case 'castSize':         cmp = a.cast.length - b.cast.length; break;
        case 'estimatedMinutes': cmp = a.estimatedMinutes - b.estimatedMinutes; break;
        case 'addedAt':          cmp = a.addedAt.localeCompare(b.addedAt); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [allItems, filters, sortKey, sortDir]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo((): ScenePoolStats => {
    const allCast = new Set<string>();
    const allLocs = new Set<string>();

    const byIntExt: Record<IntExtType, number> = { INT: 0, EXT: 0, 'INT/EXT': 0 };
    const byTimeOfDay: Record<TimeOfDay, number> = { DAY: 0, NIGHT: 0, DAWN: 0, DUSK: 0 };
    let totalPages = 0, totalMinutes = 0, hasSpecialRequirements = 0;

    for (const s of allItems) {
      totalPages   += s.pageCount;
      totalMinutes += s.estimatedMinutes;
      byIntExt[s.intExtType]   = (byIntExt[s.intExtType]   ?? 0) + 1;
      byTimeOfDay[s.timeOfDay] = (byTimeOfDay[s.timeOfDay] ?? 0) + 1;
      s.cast.forEach(c => allCast.add(c));
      allLocs.add(s.location);
      if (s.specialRequirements.length > 0) hasSpecialRequirements++;
    }

    return {
      totalScenes: allItems.length,
      totalPages,
      totalMinutes,
      byIntExt,
      byTimeOfDay,
      uniqueLocations: allLocs.size,
      uniqueCastMembers: allCast.size,
      hasSpecialRequirements,
    };
  }, [allItems]);

  // ── Derived quick-access data ─────────────────────────────────────────────

  const uniqueLocations = useMemo(
    () => [...new Set(allItems.map(s => s.location))].sort(),
    [allItems],
  );

  const uniqueCastMembers = useMemo(
    () => [...new Set(allItems.flatMap(s => s.cast))].sort(),
    [allItems],
  );

  return {
    // data
    allItems,
    items,
    stats,
    uniqueLocations,
    uniqueCastMembers,
    // CRUD
    add,
    remove,
    update,
    bulkAdd,
    removeMany,
    restore,
    // filters
    filters,
    setFilter,
    resetFilters,
    // sort
    sortKey,
    setSortKey,
    sortDir,
    setSortDir,
  } as const;
}

export type ScenePoolHandle = ReturnType<typeof useScenePool>;
