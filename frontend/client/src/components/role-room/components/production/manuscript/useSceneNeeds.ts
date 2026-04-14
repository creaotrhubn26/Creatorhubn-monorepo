import { useCallback, useEffect, useRef, useState } from 'react';
import type { SceneBreakdown } from '../../../models/casting';
import { sceneNeedsService } from '../../../services/sceneNeedsService';

export type ProductionSceneNeeds = Record<string, { cam: boolean; light: boolean; sound: boolean }>;

function useDebouncedAsyncCallback<T extends (...args: never[]) => Promise<void> | void>(fn: T, delay: number) {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    if (!lastArgsRef.current) return;
    cancel();
    void fnRef.current(...lastArgsRef.current);
    lastArgsRef.current = null;
  }, [cancel]);

  const debounced = useCallback((...args: Parameters<T>) => {
    lastArgsRef.current = args;
    cancel();
    timerRef.current = setTimeout(() => {
      if (lastArgsRef.current) {
        void fnRef.current(...lastArgsRef.current);
      }
      lastArgsRef.current = null;
      timerRef.current = null;
    }, delay);
  }, [cancel, delay]);

  useEffect(() => cancel, [cancel]);

  return { debounced, flush };
}

export const useSceneNeeds = (projectId: string, scenes: SceneBreakdown[]) => {
  const [sceneNeeds, setSceneNeeds] = useState<ProductionSceneNeeds>({});

  useEffect(() => {
    setSceneNeeds((prev) => {
      const sceneIds = new Set(scenes.map((scene) => scene.id));
      let changed = false;
      const next = { ...prev };

      for (const scene of scenes) {
        if (!next[scene.id]) {
          next[scene.id] = { cam: false, light: false, sound: false };
          changed = true;
        }
      }

      for (const id of Object.keys(next)) {
        if (!sceneIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [scenes]);

  const { debounced: debouncedSaveNeeds, flush: flushSceneNeeds } = useDebouncedAsyncCallback(
    async (needs: ProductionSceneNeeds) => {
      if (!projectId || Object.keys(needs).length === 0) return;
      try {
        await sceneNeedsService.saveSceneNeeds(projectId, needs);
      } catch (error) {
        console.error('Could not save scene needs:', error);
      }
    },
    1500,
  );

  useEffect(() => {
    debouncedSaveNeeds(sceneNeeds);
  }, [debouncedSaveNeeds, sceneNeeds]);

  useEffect(() => {
    let cancelled = false;

    const loadNeeds = async () => {
      if (!projectId) return;
      try {
        const saved = await sceneNeedsService.getSceneNeeds(projectId);
        if (!cancelled && saved && Object.keys(saved).length > 0) {
          setSceneNeeds(saved);
        }
      } catch (error) {
        console.error('Could not load scene needs:', error);
      }
    };

    void loadNeeds();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { sceneNeeds, setSceneNeeds, flushSceneNeeds };
};
