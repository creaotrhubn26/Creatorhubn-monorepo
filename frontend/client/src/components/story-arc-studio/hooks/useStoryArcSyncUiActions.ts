import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { AudioSyncResult as EngineAudioSyncResult } from '../../../services/audio-sync-engine';

type SyncResultsMap = Record<string, EngineAudioSyncResult> | null;

interface UseStoryArcSyncUiActionsParams {
  setSyncPreviewMode: Dispatch<SetStateAction<boolean>>;
  setSyncResults: Dispatch<SetStateAction<SyncResultsMap>>;
  setManualOffsets: Dispatch<SetStateAction<Record<string, number>>>;
  setSyncMaxOffsetSeconds: Dispatch<SetStateAction<number>>;
  setSelectedSyncClips: Dispatch<SetStateAction<Set<string>>>;
}

export function useStoryArcSyncUiActions({
  setSyncPreviewMode,
  setSyncResults,
  setManualOffsets,
  setSyncMaxOffsetSeconds,
  setSelectedSyncClips,
}: UseStoryArcSyncUiActionsParams) {
  const resetSyncPreview = useCallback(() => {
    setSyncPreviewMode(false);
    setSyncResults(null);
    setManualOffsets({});
  }, [setSyncPreviewMode, setSyncResults, setManualOffsets]);

  const updateSyncMaxOffsetWindow = useCallback((_: Event, value: number | number[]) => {
    const numericValue = Array.isArray(value) ? value[0] : value;
    setSyncMaxOffsetSeconds(Math.max(5, Math.min(120, numericValue)));
  }, [setSyncMaxOffsetSeconds]);

  const toggleSyncClipSelection = useCallback((clipId: string) => {
    setSelectedSyncClips((previous) => {
      const next = new Set(previous);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  }, [setSelectedSyncClips]);

  const updateManualOffset = useCallback((clipId: string, value: number | number[]) => {
    const numericValue = Array.isArray(value) ? value[0] : value;
    setManualOffsets((previous) => ({
      ...previous,
      [clipId]: numericValue,
    }));
  }, [setManualOffsets]);

  const resetManualOffsetToDetected = useCallback((clipId: string, detectedOffset: number) => {
    setManualOffsets((previous) => ({
      ...previous,
      [clipId]: detectedOffset,
    }));
  }, [setManualOffsets]);

  const clearManualOffsetForClip = useCallback((clipId: string) => {
    setManualOffsets((previous) => ({
      ...previous,
      [clipId]: 0,
    }));
  }, [setManualOffsets]);

  return {
    resetSyncPreview,
    updateSyncMaxOffsetWindow,
    toggleSyncClipSelection,
    updateManualOffset,
    resetManualOffsetToDetected,
    clearManualOffsetForClip,
  };
}
