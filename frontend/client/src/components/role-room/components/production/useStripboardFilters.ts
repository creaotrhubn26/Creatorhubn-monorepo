/**
 * useStripboardFilters.ts
 * Manages filter / sort / group state and all derived memos
 * (filteredStrips, stripsByDay, stripsByLocation, stats, uniqueLocations).
 */

import { useState, useMemo, useCallback } from 'react';
import type {
  StripboardStrip,
  ShootingDay,
} from '../../services/productionWorkflowService';
import { getStripColorFromHex } from './stripboard.constants';
import type { GroupBy, StripsByDay, LocationGroup, StripboardStats } from './stripboard.types';

export function useStripboardFilters(
  strips: StripboardStrip[],
  shootingDays: ShootingDay[],
  optimizationCount: number,
) {
  // ── Filter / sort state ───────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ── Filtered base list ────────────────────────────────────────────────────

  const filteredStripsMemo = useMemo(() => {
    let base =
      filterStatus === 'all' ? strips : strips.filter(s => s.status === filterStatus);
    if (filterLocation !== 'all') {
      base = base.filter(s => (s.location || 'Ukjent') === filterLocation);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter(
        s =>
          s.sceneNumber.toLowerCase().includes(q) ||
          (s.location || '').toLowerCase().includes(q),
      );
    }
    return base;
  }, [strips, filterStatus, filterLocation, searchQuery]);

  // ── Group by day ──────────────────────────────────────────────────────────

  const stripsByDay = useMemo((): StripsByDay[] => {
    const grouped: Map<string | null, StripsByDay> = new Map();

    shootingDays.forEach(day => {
      grouped.set(day.id, {
        dayId: day.id,
        dayNumber: day.dayNumber,
        date: day.date,
        location: day.location,
        strips: [],
        totalPages: 0,
        totalTime: 0,
      });
    });

    grouped.set(null, {
      dayId: null,
      dayNumber: null,
      date: null,
      location: null,
      strips: [],
      totalPages: 0,
      totalTime: 0,
    });

    filteredStripsMemo.forEach(strip => {
      const dayId = strip.shootingDayId || null;
      const day = grouped.get(dayId);
      if (day) {
        day.strips.push(strip);
        day.totalPages += strip.pages;
        day.totalTime += strip.estimatedTime;
      }
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.dayNumber === null) return 1;
      if (b.dayNumber === null) return -1;
      return a.dayNumber - b.dayNumber;
    });
  }, [filteredStripsMemo, shootingDays]);

  // ── Group by location ─────────────────────────────────────────────────────

  const stripsByLocation = useMemo((): LocationGroup[] => {
    const grouped: Map<string, LocationGroup> = new Map();

    filteredStripsMemo.forEach(strip => {
      const loc = strip.location || 'Ukjent';
      if (!grouped.has(loc)) {
        grouped.set(loc, {
          location: loc,
          strips: [],
          totalPages: 0,
          totalTime: 0,
          uniqueCast: [],
          dayNumbers: [],
        });
      }
      const group = grouped.get(loc)!;
      group.strips.push(strip);
      group.totalPages += strip.pages;
      group.totalTime += strip.estimatedTime;

      strip.cast?.forEach(castName => {
        if (!group.uniqueCast.includes(castName)) group.uniqueCast.push(castName);
      });

      const day = shootingDays.find(d => d.id === strip.shootingDayId);
      if (day && !group.dayNumbers.includes(day.dayNumber)) {
        group.dayNumbers.push(day.dayNumber);
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.strips.length - a.strips.length);
  }, [filteredStripsMemo, shootingDays]);

  // ── Unique locations for filter dropdown ──────────────────────────────────

  const uniqueLocations = useMemo(
    () =>
      Array.from(new Set(strips.map(s => s.location).filter(Boolean))).sort() as string[],
    [strips],
  );

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo((): StripboardStats => {
    const total            = strips.length;
    const shot             = strips.filter(s => s.status === 'shot').length;
    const scheduled        = strips.filter(s => s.status === 'scheduled').length;
    const notScheduled     = strips.filter(s => s.status === 'not-scheduled').length;
    const totalPages       = strips.reduce((sum, s) => sum + s.pages, 0);
    const pagesShot        = strips.filter(s => s.status === 'shot').reduce((sum, s) => sum + s.pages, 0);
    const totalTime        = strips.reduce((sum, s) => sum + s.estimatedTime, 0);
    const uniqueLocationsCount = new Set(strips.map(s => s.location)).size;
    const uniqueCastCount  = new Set(strips.flatMap(s => s.cast || [])).size;
    return {
      total, shot, scheduled, notScheduled,
      totalPages, pagesShot, totalTime,
      uniqueLocationsCount, uniqueCastCount,
      optimizationCount,
    };
  }, [strips, optimizationCount]);

  // ── Sort helper ───────────────────────────────────────────────────────────

  const getSortedStrips = useCallback(
    (items: StripboardStrip[]): StripboardStrip[] => {
      const statusOrder: Record<StripboardStrip['status'], number> = {
        shot: 0,
        scheduled: 1,
        'not-scheduled': 2,
        postponed: 3,
      };
      const sorted = [...items];
      switch (groupBy) {
        case 'location':
          sorted.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
          break;
        case 'cast':
          sorted.sort((a, b) => (b.cast?.length || 0) - (a.cast?.length || 0));
          break;
        case 'status':
          sorted.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
          break;
        case 'intExt':
          sorted.sort((a, b) =>
            getStripColorFromHex(a.color).localeCompare(getStripColorFromHex(b.color)),
          );
          break;
        case 'day':
        default:
          sorted.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          break;
      }
      return sortDirection === 'desc' ? sorted.reverse() : sorted;
    },
    [groupBy, sortDirection],
  );

  return {
    // state
    filterStatus, setFilterStatus,
    filterLocation, setFilterLocation,
    searchQuery, setSearchQuery,
    groupBy, setGroupBy,
    sortDirection, setSortDirection,
    // derived
    filteredStripsMemo,
    stripsByDay,
    stripsByLocation,
    uniqueLocations,
    stats,
    getSortedStrips,
  };
}
