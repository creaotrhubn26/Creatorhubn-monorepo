/**
 * useOptimizationSuggestions.ts
 * Pure memoised hook — no side effects, no state.
 * Analyses strips vs. shooting days and returns a prioritised suggestion list.
 */

import { useMemo } from 'react';
import type { StripboardStrip, ShootingDay } from '../../services/productionWorkflowService';
import type { OptimizationSuggestion } from './stripboard.types';

export function useOptimizationSuggestions(
  strips: StripboardStrip[],
  shootingDays: ShootingDay[],
): OptimizationSuggestion[] {
  return useMemo((): OptimizationSuggestion[] => {
    const suggestions: OptimizationSuggestion[] = [];

    // ── Location fragmentation ─────────────────────────────────────────────
    // Same location appearing on more than one shooting day → consolidation candidate

    const locationDays: Map<string, Set<number>> = new Map();
    strips.forEach(strip => {
      const day = shootingDays.find(d => d.id === strip.shootingDayId);
      if (day && strip.location) {
        if (!locationDays.has(strip.location)) {
          locationDays.set(strip.location, new Set());
        }
        locationDays.get(strip.location)!.add(day.dayNumber);
      }
    });

    locationDays.forEach((days, location) => {
      if (days.size > 1) {
        const daysArray = Array.from(days).sort((a, b) => a - b);
        suggestions.push({
          id: `loc-${location}`,
          type: 'location',
          title: `Konsolider ${location}`,
          description: `Scener på "${location}" er spredt over dag ${daysArray.join(', ')}. Vurder å gruppere disse.`,
          potentialSaving: `${(days.size - 1) * 30} min reisetid`,
          affectedScenes: strips
            .filter(s => s.location === location)
            .map(s => s.sceneNumber),
          priority: days.size > 2 ? 'high' : 'medium',
        });
      }
    });

    // ── Cast efficiency ────────────────────────────────────────────────────
    // Actor called back after a multi-day gap → contract days can be reduced

    const castDays: Map<string, Set<number>> = new Map();
    strips.forEach(strip => {
      const day = shootingDays.find(d => d.id === strip.shootingDayId);
      if (day) {
        strip.cast?.forEach(castName => {
          if (!castDays.has(castName)) castDays.set(castName, new Set());
          castDays.get(castName)!.add(day.dayNumber);
        });
      }
    });

    castDays.forEach((days, castName) => {
      const daysArray = Array.from(days).sort((a, b) => a - b);
      for (let i = 1; i < daysArray.length; i++) {
        const gap = daysArray[i] - daysArray[i - 1];
        if (gap > 1 && gap < 4) {
          suggestions.push({
            id: `cast-${castName}-${i}`,
            type: 'cast',
            title: `Optimaliser ${castName}`,
            description: `${castName} har opptak dag ${daysArray[i - 1]} og ${daysArray[i]}. ${gap - 1} dagers gap kan reduseres.`,
            potentialSaving: `${gap - 1} dager skuespillerhonorar`,
            affectedScenes: strips
              .filter(s => s.cast?.includes(castName))
              .map(s => s.sceneNumber),
            priority: gap > 2 ? 'high' : 'low',
          });
          break; // one suggestion per actor is enough
        }
      }
    });

    // ── Sort by priority ───────────────────────────────────────────────────
    const priorityOrder: Record<OptimizationSuggestion['priority'], number> = {
      high: 0, medium: 1, low: 2,
    };
    return suggestions.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );
  }, [strips, shootingDays]);
}
