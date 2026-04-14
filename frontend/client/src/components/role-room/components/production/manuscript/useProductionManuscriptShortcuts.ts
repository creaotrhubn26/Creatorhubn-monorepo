import { useEffect } from 'react';
import type { SceneBreakdown } from '../../../models/casting';
import type { SelectedMap } from '../types';
import { EMPTY_SELECTION, selectedMapFromIds, selectedMapSize } from '../types';

interface UseProductionManuscriptShortcutsOptions {
  selectedScene: SceneBreakdown | null;
  scenes: SceneBreakdown[];
  batchMode: boolean;
  selectedScenes: SelectedMap;
  showQuickNotes: boolean;
  showSceneTemplate: boolean;
  readThroughMode: boolean;
  onReadThroughPlay: () => void;
  onReadThroughNext: () => void;
  onReadThroughPrevious: () => void;
  onReadThroughToggle: () => void;
  onTimelinePlay: () => void;
  onScrollToScene: (scene: SceneBreakdown) => void;
  onUndo: () => void;
  onRedo: () => void;
  onBatchDelete: () => void;
  onDuplicateScene: (scene: SceneBreakdown) => void;
  onPdfExport: () => void;
  onGenerateCallSheet: () => void;
  onSceneDeleteRequest: (sceneId: string) => void;
  setBatchMode: (value: boolean) => void;
  setSelectedScenes: (value: SelectedMap) => void;
  setShowQuickNotes: (value: boolean) => void;
  setShowSceneTemplate: (value: boolean) => void;
  setTemplateName: (value: string) => void;
  canDeleteScene: boolean;
}

export const useProductionManuscriptShortcuts = ({
  selectedScene,
  scenes,
  batchMode,
  selectedScenes,
  showQuickNotes,
  showSceneTemplate,
  readThroughMode,
  onReadThroughPlay,
  onReadThroughNext,
  onReadThroughPrevious,
  onReadThroughToggle,
  onTimelinePlay,
  onScrollToScene,
  onUndo,
  onRedo,
  onBatchDelete,
  onDuplicateScene,
  onPdfExport,
  onGenerateCallSheet,
  onSceneDeleteRequest,
  setBatchMode,
  setSelectedScenes,
  setShowQuickNotes,
  setShowSceneTemplate,
  setTemplateName,
  canDeleteScene,
}: UseProductionManuscriptShortcutsOptions) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      if (readThroughMode) {
        if (event.code === 'Space') {
          event.preventDefault();
          onReadThroughPlay();
          return;
        }
        if (event.code === 'ArrowRight') {
          event.preventDefault();
          onReadThroughNext();
          return;
        }
        if (event.code === 'ArrowLeft') {
          event.preventDefault();
          onReadThroughPrevious();
          return;
        }
        if (event.code === 'Escape') {
          event.preventDefault();
          onReadThroughToggle();
          return;
        }
      }

      if (event.code === 'Space') {
        event.preventDefault();
        onTimelinePlay();
      } else if (event.code === 'ArrowUp' && selectedScene) {
        event.preventDefault();
        const currentIndex = scenes.findIndex((scene) => scene.id === selectedScene.id);
        if (currentIndex > 0) onScrollToScene(scenes[currentIndex - 1]);
      } else if (event.code === 'ArrowDown' && selectedScene) {
        event.preventDefault();
        const currentIndex = scenes.findIndex((scene) => scene.id === selectedScene.id);
        if (currentIndex < scenes.length - 1) onScrollToScene(scenes[currentIndex + 1]);
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ' && !event.shiftKey) {
        event.preventDefault();
        onUndo();
      } else if ((event.ctrlKey || event.metaKey) && ((event.shiftKey && event.code === 'KeyZ') || event.code === 'KeyY')) {
        event.preventDefault();
        onRedo();
      } else if (event.code === 'Delete' && (batchMode ? selectedMapSize(selectedScenes) > 0 : selectedScene)) {
        event.preventDefault();
        if (batchMode) {
          onBatchDelete();
        } else if (selectedScene && canDeleteScene) {
          onSceneDeleteRequest(selectedScene.id);
        }
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyA') {
        event.preventDefault();
        setBatchMode(true);
        setSelectedScenes(selectedMapFromIds(scenes.map((scene) => scene.id)));
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyD' && selectedScene) {
        event.preventDefault();
        onDuplicateScene(selectedScene);
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyT') {
        event.preventDefault();
        setShowQuickNotes(!showQuickNotes);
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS' && selectedScene) {
        event.preventDefault();
        setShowSceneTemplate(true);
      } else if ((event.ctrlKey || event.metaKey) && event.code === 'KeyE' && !event.shiftKey) {
        event.preventDefault();
        onPdfExport();
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyE') {
        event.preventDefault();
        onGenerateCallSheet();
      } else if (event.code === 'Escape') {
        if (batchMode) {
          setBatchMode(false);
          setSelectedScenes(EMPTY_SELECTION);
        }
        if (showQuickNotes) {
          setShowQuickNotes(false);
        }
        if (showSceneTemplate) {
          setShowSceneTemplate(false);
          setTemplateName('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    batchMode,
    canDeleteScene,
    onBatchDelete,
    onDuplicateScene,
    onGenerateCallSheet,
    onPdfExport,
    onReadThroughNext,
    onReadThroughPlay,
    onReadThroughPrevious,
    onReadThroughToggle,
    onRedo,
    onSceneDeleteRequest,
    onScrollToScene,
    onTimelinePlay,
    onUndo,
    readThroughMode,
    scenes,
    selectedScene,
    selectedScenes,
    setBatchMode,
    setSelectedScenes,
    setShowQuickNotes,
    setShowSceneTemplate,
    setTemplateName,
    showQuickNotes,
    showSceneTemplate,
  ]);
};
