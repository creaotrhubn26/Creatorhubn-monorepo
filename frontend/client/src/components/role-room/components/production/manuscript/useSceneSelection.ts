import { useCallback, useState } from 'react';
import type { SelectedMap } from '../types';
import { EMPTY_SELECTION, selectedMapFromIds, selectedMapToggle } from '../types';

export const useSceneSelection = () => {
  const [selectedScenes, setSelectedScenes] = useState<SelectedMap>(EMPTY_SELECTION);
  const [batchMode, setBatchMode] = useState(false);

  const toggleSceneSelection = useCallback((sceneId: string) => {
    setBatchMode((wasBatchMode) => {
      if (!wasBatchMode) {
        setSelectedScenes({ [sceneId]: true });
        return true;
      }
      setSelectedScenes((prev) => selectedMapToggle(prev, sceneId));
      return wasBatchMode;
    });
  }, []);

  const selectAllScenes = useCallback((sceneIds: string[]) => {
    setBatchMode(true);
    setSelectedScenes(selectedMapFromIds(sceneIds));
  }, []);

  const clearSceneSelection = useCallback(() => {
    setBatchMode(false);
    setSelectedScenes(EMPTY_SELECTION);
  }, []);

  return {
    selectedScenes,
    setSelectedScenes,
    batchMode,
    setBatchMode,
    toggleSceneSelection,
    selectAllScenes,
    clearSceneSelection,
  };
};
