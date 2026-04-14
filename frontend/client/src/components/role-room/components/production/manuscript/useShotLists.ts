import { useCallback, useEffect, useState } from 'react';
import type { CastingShot, ShotList } from '../../../models/casting';
import { castingService } from '../../../services/castingService';

export const useShotLists = (projectId: string) => {
  const [shotLists, setShotLists] = useState<ShotList[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadShotLists = async () => {
      try {
        await castingService.initializeMockData();
        const lists = await castingService.getShotLists(projectId);
        if (!cancelled) {
          setShotLists(Array.isArray(lists) ? lists : []);
        }
      } catch (error) {
        console.error('Error loading shot lists:', error);
        if (!cancelled) {
          setShotLists([]);
        }
      }
    };

    if (projectId) {
      void loadShotLists();
    } else {
      setShotLists([]);
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const getShotsForScene = useCallback((sceneId: string): CastingShot[] => {
    const shotList = shotLists.find((entry) => entry.sceneId === sceneId);
    return shotList?.shots || [];
  }, [shotLists]);

  return { shotLists, setShotLists, getShotsForScene };
};
