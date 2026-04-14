import { useEffect, useMemo, useState } from 'react';
import type { CastingShot, SceneBreakdown } from '../../../models/casting';
import { computeStoryboardCoverageSummary } from '../../../models/derivedState';
import {
  buildSceneStoryboardCandidates,
  loadStoryboardLibraryItemsForProject,
  resolveStoryboardShotLink,
} from '../../../services/storyboardLibraryService';

export const useStoryboardShotLinks = (
  projectId: string,
  selectedScene: SceneBreakdown | null,
  selectedShot: CastingShot | null,
  selectedSceneShots: CastingShot[],
) => {
  const [projectStoryboardLibraryItems, setProjectStoryboardLibraryItems] = useState<
    Awaited<ReturnType<typeof loadStoryboardLibraryItemsForProject>>
  >([]);

  useEffect(() => {
    let cancelled = false;
    const loadLibraryItems = () => {
      void loadStoryboardLibraryItemsForProject(projectId, String(projectId || 'global')).then((items) => {
        if (!cancelled) {
          setProjectStoryboardLibraryItems(items);
        }
      });
    };

    loadLibraryItems();
    window.addEventListener('role-room:storyboard-library-updated', loadLibraryItems);
    return () => {
      cancelled = true;
      window.removeEventListener('role-room:storyboard-library-updated', loadLibraryItems);
    };
  }, [projectId]);

  const selectedSceneStoryboardCandidates = useMemo(
    () => (selectedScene ? buildSceneStoryboardCandidates(selectedScene, projectStoryboardLibraryItems) : []),
    [projectStoryboardLibraryItems, selectedScene],
  );

  const selectedShotStoryboardLink = useMemo(
    () => (selectedShot && selectedScene
      ? resolveStoryboardShotLink(selectedShot, selectedScene, projectStoryboardLibraryItems)
      : null),
    [projectStoryboardLibraryItems, selectedScene, selectedShot],
  );

  const selectedSceneStoryboardCoverage = useMemo(
    () => (selectedScene ? computeStoryboardCoverageSummary(selectedSceneShots, selectedScene) : null),
    [selectedScene, selectedSceneShots],
  );

  const selectedSceneStoryboardFirstLinkedFrameIndex = useMemo(() => {
    if (!selectedScene) {
      return undefined;
    }
    const sceneFrames = Array.isArray(selectedScene.storyboardFrames) ? selectedScene.storyboardFrames : [];
    const linkedFrameId = selectedSceneShots.find((shot) => (
      typeof shot.storyboardFrameId === 'string'
      && sceneFrames.some((frame) => frame.id === shot.storyboardFrameId)
    ))?.storyboardFrameId;
    if (!linkedFrameId) {
      return undefined;
    }
    const frameIndex = sceneFrames.findIndex((frame) => frame.id === linkedFrameId);
    return frameIndex >= 0 ? frameIndex : undefined;
  }, [selectedScene, selectedSceneShots]);

  const selectedSceneStoryboardFirstMissingFrameIndex = useMemo(() => {
    if (!selectedScene || !selectedSceneStoryboardCoverage?.missingFrameIds.length) {
      return undefined;
    }
    const sceneFrames = Array.isArray(selectedScene.storyboardFrames) ? selectedScene.storyboardFrames : [];
    const frameIndex = sceneFrames.findIndex((frame) => frame.id === selectedSceneStoryboardCoverage.missingFrameIds[0]);
    return frameIndex >= 0 ? frameIndex : undefined;
  }, [selectedScene, selectedSceneStoryboardCoverage]);

  return {
    projectStoryboardLibraryItems,
    selectedSceneStoryboardCandidates,
    selectedShotStoryboardLink,
    selectedSceneStoryboardCoverage,
    selectedSceneStoryboardFirstLinkedFrameIndex,
    selectedSceneStoryboardFirstMissingFrameIndex,
  };
};
