import { useCallback } from 'react';
import type { SceneBreakdown, ShotList } from '../../../models/casting';
import type { SceneFilters } from '../types';
import { toDisplayString, toSceneNumber, toTimestamp } from './productionManuscriptUi';

export type SceneSortField = 'number' | 'duration' | 'date' | 'name';
export type SceneSortOrder = 'asc' | 'desc';

interface UseSceneListQueryOptions {
  scenes: SceneBreakdown[];
  searchQuery: string;
  selectedTags: Set<string>;
  sceneTags: Record<string, string[]>;
  sceneNeeds: Record<string, { cam: boolean; light: boolean; sound: boolean }>;
  filters: SceneFilters;
  sortBy: SceneSortField;
  sortOrder: SceneSortOrder;
  shotLists: ShotList[];
}

export const useSceneListQuery = ({
  scenes,
  searchQuery,
  selectedTags,
  sceneTags,
  sceneNeeds,
  filters,
  sortBy,
  sortOrder,
  shotLists,
}: UseSceneListQueryOptions) => {
  const getSortedAndFilteredScenes = useCallback((): SceneBreakdown[] => {
    let result = [...scenes];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((scene) => (
        scene.sceneHeading?.toLowerCase().includes(query)
        || scene.locationName?.toLowerCase().includes(query)
        || scene.description?.toLowerCase().includes(query)
        || scene.characters?.some((character) => character.toLowerCase().includes(query))
        || toDisplayString(scene.sceneNumber).toLowerCase().includes(query)
      ));
    }

    if (selectedTags.size > 0) {
      result = result.filter((scene) => (
        (sceneTags[scene.id] || []).some((tag) => selectedTags.has(tag))
      ));
    }

    if (filters.missing.cam) {
      result = result.filter((scene) => sceneNeeds[scene.id]?.cam);
    }
    if (filters.missing.light) {
      result = result.filter((scene) => sceneNeeds[scene.id]?.light);
    }
    if (filters.missing.sound) {
      result = result.filter((scene) => sceneNeeds[scene.id]?.sound);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'number':
          comparison = (toSceneNumber(a.sceneNumber) ?? 0) - (toSceneNumber(b.sceneNumber) ?? 0);
          break;
        case 'duration': {
          const aDuration = shotLists.find((list) => list.sceneId === a.id)?.shots.reduce((sum, shot) => sum + (shot.duration || 5), 0) || 0;
          const bDuration = shotLists.find((list) => list.sceneId === b.id)?.shots.reduce((sum, shot) => sum + (shot.duration || 5), 0) || 0;
          comparison = aDuration - bDuration;
          break;
        }
        case 'date':
          comparison = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
          break;
        case 'name':
          comparison = (a.sceneHeading || '').localeCompare(b.sceneHeading || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [filters, sceneNeeds, sceneTags, scenes, searchQuery, selectedTags, shotLists, sortBy, sortOrder]);

  return { getSortedAndFilteredScenes };
};
