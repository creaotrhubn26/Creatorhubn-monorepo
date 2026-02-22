/**
 * shotListFilters.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure filter / sort / search state types and the filtering function.
 * No React imports — usable in useMemo, server-side, or unit tests.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ShotListSummary } from '../../models/derivedState';

// ─── Filter state ─────────────────────────────────────────────────────────────

export type ShotListSortField = 'scene' | 'shots' | 'progress' | 'updated' | 'duration';
export type SortDirection     = 'asc' | 'desc';
export type ViewMode          = 'grid' | 'list';
export type StatusFilter      = 'all' | 'not_started' | 'in_progress' | 'completed';

export interface ShotListFilters {
  /** Free-text search against scene name / heading */
  search: string;
  /** Only show lists where the current user is a top assignee */
  onlyMine: boolean;
  /** Only show lists with at least one unassigned shot */
  onlyUnassigned: boolean;
  /** Filter by shot status composition */
  status: StatusFilter;
  /** Filter by scene ID ('' = all) */
  sceneId: string;
  /** Sort field */
  sortField: ShotListSortField;
  /** Sort direction */
  sortDir: SortDirection;
  /** Grid or list layout */
  viewMode: ViewMode;
}

export const DEFAULT_FILTERS: ShotListFilters = {
  search: '',
  onlyMine: false,
  onlyUnassigned: false,
  status: 'all',
  sceneId: '',
  sortField: 'updated',
  sortDir: 'desc',
  viewMode: 'grid',
};

// ─── Pure filter + sort function ──────────────────────────────────────────────

/**
 * Apply filters and sort to a list of ShotListSummary objects.
 *
 * @param summaries   Full list (all project shot lists).
 * @param filters     Current filter state.
 * @param currentUserId  Used for `onlyMine` — matches against topAssignees.
 */
export function applyFilters(
  summaries: ShotListSummary[],
  filters: ShotListFilters,
  currentUserId?: string,
): ShotListSummary[] {
  let result = summaries;

  // ── search ───────────────────────────────────────────────────────────────
  const q = filters.search.trim().toLowerCase();
  if (q) {
    result = result.filter((s) => {
      const name = (s.sceneName ?? '').toLowerCase();
      const heading = (s.sceneMeta?.heading ?? '').toLowerCase();
      const loc = (s.sceneMeta?.locationName ?? '').toLowerCase();
      return name.includes(q) || heading.includes(q) || loc.includes(q);
    });
  }

  // ── onlyMine ──────────────────────────────────────────────────────────────
  if (filters.onlyMine && currentUserId) {
    result = result.filter((s) =>
      s.topAssignees.some((a) => a.personId === currentUserId),
    );
  }

  // ── onlyUnassigned ────────────────────────────────────────────────────────
  if (filters.onlyUnassigned) {
    result = result.filter((s) => s.unassignedShots > 0);
  }

  // ── status ────────────────────────────────────────────────────────────────
  if (filters.status !== 'all') {
    result = result.filter((s) => {
      if (filters.status === 'not_started')
        return s.statusBreakdown.not_started === s.totalShots && s.totalShots > 0;
      if (filters.status === 'completed')
        return s.completionPct === 100 && s.totalShots > 0;
      if (filters.status === 'in_progress')
        return s.completionPct > 0 && s.completionPct < 100;
      return true;
    });
  }

  // ── sceneId ───────────────────────────────────────────────────────────────
  if (filters.sceneId) {
    result = result.filter((s) => s.sceneId === filters.sceneId);
  }

  // ── sort ──────────────────────────────────────────────────────────────────
  const dir = filters.sortDir === 'asc' ? 1 : -1;
  result = [...result].sort((a, b) => {
    switch (filters.sortField) {
      case 'scene':
        return dir * (a.sceneName ?? '').localeCompare(b.sceneName ?? '');
      case 'shots':
        return dir * (a.totalShots - b.totalShots);
      case 'progress':
        return dir * (a.completionPct - b.completionPct);
      case 'duration':
        return dir * (a.estimatedMinutes - b.estimatedMinutes);
      case 'updated':
      default:
        return dir * a.lastUpdated.localeCompare(b.lastUpdated);
    }
  });

  return result;
}

// ─── Unique scene options (for Scene dropdown) ────────────────────────────────

export interface SceneOption {
  sceneId: string;
  label: string;
}

export function getSceneOptions(summaries: ShotListSummary[]): SceneOption[] {
  const seen = new Set<string>();
  const options: SceneOption[] = [];
  for (const s of summaries) {
    if (!seen.has(s.sceneId)) {
      seen.add(s.sceneId);
      options.push({
        sceneId: s.sceneId,
        label:
          s.sceneMeta?.heading ??
          s.sceneName ??
          s.sceneId,
      });
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}
