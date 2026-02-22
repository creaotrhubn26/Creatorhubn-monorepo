/**
 * domain/quickFilter.ts
 *
 * In-memory scene filter / query engine.
 * Pure functions — NO React, NO state.
 *
 * The filter system is composable:
 *
 *   const results = filterScenes(allScenes, query, { locations, castMembers });
 *
 * Every filter predicate is a pure function and can be applied independently.
 * This makes it trivial to swap to server-side filtering later —
 * simply send the same StripboardQuery object to the API.
 *
 * Performance note: for 200 scenes the full in-memory pass takes < 1ms.
 * For 2000+ scenes, add server-side pagination (same query shape).
 */

import type {
  Scene, Location, CastMember, Conflict,
  StripboardQuery, SceneStatus, IntExtType, TimeOfDay,
} from './types';

// ─── Resolution context ───────────────────────────────────────────────────────

/**
 * Optional resolved maps for join-style filtering
 * (e.g. filter by location name rather than ID).
 */
export interface FilterContext {
  locations:   Map<string, Location>;
  castMembers: Map<string, CastMember>;
  conflicts:   Conflict[];
}

// ─── Individual predicates ────────────────────────────────────────────────────

function matchesSearch(scene: Scene, query: string, ctx: FilterContext): boolean {
  const q = query.toLowerCase();
  if (scene.sceneNumber.toLowerCase().includes(q)) return true;
  if (scene.slugLine.toLowerCase().includes(q))    return true;
  if ((scene.synopsis ?? '').toLowerCase().includes(q)) return true;
  if ((scene.notes ?? '').toLowerCase().includes(q))    return true;
  const locName = ctx.locations.get(scene.locationId)?.name ?? '';
  if (locName.toLowerCase().includes(q)) return true;
  // Cast name search
  for (const castId of scene.castIds) {
    const member = ctx.castMembers.get(castId);
    if (!member) continue;
    if (member.characterName.toLowerCase().includes(q)) return true;
    if ((member.actorName ?? '').toLowerCase().includes(q)) return true;
  }
  return false;
}

function matchesIntExt(scene: Scene, value: IntExtType | 'all'): boolean {
  return value === 'all' || scene.intExtType === value;
}

function matchesTimeOfDay(scene: Scene, value: TimeOfDay | 'all'): boolean {
  return value === 'all' || scene.timeOfDay === value;
}

function matchesStatus(scene: Scene, value: SceneStatus | 'all'): boolean {
  return value === 'all' || scene.status === value;
}

function matchesLocations(scene: Scene, locationIds: string[]): boolean {
  return locationIds.length === 0 || locationIds.includes(scene.locationId);
}

function matchesCast(scene: Scene, castIds: string[]): boolean {
  if (castIds.length === 0) return true;
  return castIds.some(id => scene.castIds.includes(id));
}

function matchesSpecialRequirements(scene: Scene, reqs: string[]): boolean {
  if (reqs.length === 0) return true;
  return reqs.some(r => scene.specialRequirements.includes(r));
}

function hasConflict(scene: Scene, conflicts: Conflict[]): boolean {
  return conflicts.some(c => c.affectedSceneIds.includes(scene.id));
}

function isStunts(scene: Scene): boolean {
  return scene.specialRequirements.includes('STUNT');
}

function isVFX(scene: Scene): boolean {
  return scene.specialRequirements.includes('VFX') ||
    scene.specialRequirements.some(r => r.startsWith('VFX_'));
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

function sortScenes(
  scenes: Scene[],
  sortBy: StripboardQuery['sortBy'],
  sortDir: 'asc' | 'desc',
  ctx: FilterContext,
): Scene[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...scenes].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'sceneNumber':
        cmp = a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true });
        break;
      case 'pageCount':
        cmp = a.pageCount - b.pageCount;
        break;
      case 'location': {
        const la = ctx.locations.get(a.locationId)?.name ?? a.locationId;
        const lb = ctx.locations.get(b.locationId)?.name ?? b.locationId;
        cmp = la.localeCompare(lb);
        break;
      }
      case 'castSize':
        cmp = a.castIds.length - b.castIds.length;
        break;
      case 'estimatedMinutes':
        cmp = a.estimatedMinutes - b.estimatedMinutes;
        break;
      case 'status': {
        const order: Record<string, number> = {
          'not-scheduled': 0, scheduled: 1, shot: 2, postponed: 3, omitted: 4,
        };
        cmp = (order[a.status] ?? 5) - (order[b.status] ?? 5);
        break;
      }
      default:
        cmp = a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true });
    }
    return cmp * dir;
  });
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Filter and sort a flat list of scenes according to a StripboardQuery.
 *
 * @param scenes  All scenes in the project.
 * @param query   The current query (all fields optional).
 * @param ctx     Resolved look-up maps for joins and conflict data.
 * @returns       Filtered and sorted scene list.
 */
export function filterScenes(
  scenes: Scene[],
  query: StripboardQuery,
  ctx: FilterContext,
): Scene[] {
  let result = scenes.filter(scene => {
    if (query.search    && !matchesSearch(scene, query.search, ctx))              return false;
    if (query.intExtType && !matchesIntExt(scene, query.intExtType))              return false;
    if (query.timeOfDay  && !matchesTimeOfDay(scene, query.timeOfDay))            return false;
    if (query.status     && !matchesStatus(scene, query.status))                  return false;
    if (query.locationIds?.length && !matchesLocations(scene, query.locationIds)) return false;
    if (query.castIds?.length     && !matchesCast(scene, query.castIds))          return false;
    if (query.specialRequirements?.length && !matchesSpecialRequirements(scene, query.specialRequirements)) return false;
    if (query.hasConflicts  && !hasConflict(scene, ctx.conflicts))                return false;
    if (query.stuntsOnly    && !isStunts(scene))                                  return false;
    if (query.vfxOnly       && !isVFX(scene))                                     return false;
    return true;
  });

  if (query.sortBy) {
    result = sortScenes(result, query.sortBy, query.sortDir ?? 'asc', ctx);
  }

  return result;
}

// ─── Quick filter presets ─────────────────────────────────────────────────────

/**
 * Pre-built query presets for the Quick Filter toolbar.
 * The UI renders these as toggle buttons.
 */
export const QUICK_FILTER_PRESETS: Array<{
  id: string;
  label: string;
  labelNo: string;
  query: Partial<StripboardQuery>;
  color?: string;
}> = [
  {
    id: 'all',
    label: 'All Scenes',
    labelNo: 'Alle scener',
    query: {},
  },
  {
    id: 'unscheduled',
    label: 'Unscheduled',
    labelNo: 'Ikke planlagt',
    query: { status: 'not-scheduled' },
    color: '#EF4444',
  },
  {
    id: 'scheduled',
    label: 'Scheduled',
    labelNo: 'Planlagt',
    query: { status: 'scheduled' },
    color: '#3B82F6',
  },
  {
    id: 'shot',
    label: 'Shot',
    labelNo: 'Skutt',
    query: { status: 'shot' },
    color: '#10B981',
  },
  {
    id: 'stunts',
    label: 'Stunts',
    labelNo: 'Stunt',
    query: { stuntsOnly: true },
    color: '#F59E0B',
  },
  {
    id: 'vfx',
    label: 'VFX',
    labelNo: 'VFX',
    query: { vfxOnly: true },
    color: '#8B5CF6',
  },
  {
    id: 'night',
    label: 'Night Shoots',
    labelNo: 'Nattopptak',
    query: { timeOfDay: 'NIGHT' },
    color: '#1E3A5F',
  },
  {
    id: 'conflicts',
    label: 'Has Conflicts',
    labelNo: 'Har konflikter',
    query: { hasConflicts: true },
    color: '#EF4444',
  },
];

// ─── Aggregation helpers for the filter panel ────────────────────────────────

/**
 * Count scenes per special requirement tag.
 * Used to show "badge counts" on the special req filter chips.
 */
export function countBySpecialRequirement(scenes: Scene[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const scene of scenes) {
    for (const req of scene.specialRequirements) {
      map.set(req, (map.get(req) ?? 0) + 1);
    }
  }
  return map;
}

/**
 * Count scenes per location ID.
 */
export function countByLocation(scenes: Scene[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const scene of scenes) {
    map.set(scene.locationId, (map.get(scene.locationId) ?? 0) + 1);
  }
  return map;
}

/**
 * Count scenes per cast member ID.
 */
export function countByCastMember(scenes: Scene[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const scene of scenes) {
    for (const id of scene.castIds) {
      map.set(id, (map.get(id) ?? 0) + 1);
    }
  }
  return map;
}

/**
 * Serialise a StripboardQuery to URL search params (for shareable filter URLs).
 */
export function queryToParams(query: StripboardQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.search)        p.set('q', query.search);
  if (query.intExtType && query.intExtType !== 'all') p.set('ie', query.intExtType);
  if (query.timeOfDay  && query.timeOfDay  !== 'all') p.set('tod', query.timeOfDay);
  if (query.status     && query.status     !== 'all') p.set('status', query.status);
  if (query.unit       && query.unit       !== 'all') p.set('unit', query.unit);
  if (query.locationIds?.length)  p.set('locs', query.locationIds.join(','));
  if (query.castIds?.length)      p.set('cast', query.castIds.join(','));
  if (query.specialRequirements?.length) p.set('sr', query.specialRequirements.join(','));
  if (query.hasConflicts)  p.set('conflicts', '1');
  if (query.stuntsOnly)    p.set('stunts', '1');
  if (query.vfxOnly)       p.set('vfx', '1');
  if (query.sortBy)        p.set('sort', query.sortBy);
  if (query.sortDir)       p.set('dir', query.sortDir);
  return p;
}

/**
 * Parse URL search params back to a StripboardQuery.
 */
export function paramsToQuery(p: URLSearchParams): StripboardQuery {
  const query: StripboardQuery = {};
  const q    = p.get('q');     if (q)    query.search = q;
  const ie   = p.get('ie');   if (ie)   query.intExtType = ie as IntExtType;
  const tod  = p.get('tod');  if (tod)  query.timeOfDay = tod as TimeOfDay;
  const stat = p.get('status'); if (stat) query.status = stat as SceneStatus;
  const locs = p.get('locs'); if (locs) query.locationIds = locs.split(',');
  const cast = p.get('cast'); if (cast) query.castIds = cast.split(',');
  const sr   = p.get('sr');   if (sr)   query.specialRequirements = sr.split(',');
  if (p.get('conflicts') === '1') query.hasConflicts = true;
  if (p.get('stunts') === '1')    query.stuntsOnly = true;
  if (p.get('vfx') === '1')       query.vfxOnly = true;
  const sort = p.get('sort');
  if (sort) query.sortBy = sort as StripboardQuery['sortBy'];
  const dir = p.get('dir');
  if (dir === 'asc' || dir === 'desc') query.sortDir = dir;
  return query;
}
