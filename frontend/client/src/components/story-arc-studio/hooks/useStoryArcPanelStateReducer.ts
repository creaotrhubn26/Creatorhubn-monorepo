import { useCallback, useReducer, type SetStateAction } from 'react';

export interface StoryArcPanelState {
  showExportDialog: boolean;
  showAutoMonitor: boolean;
  showFaceDetectionDialog: boolean;
  showSceneDetectionDialog: boolean;
  showFaceDetectionOptionsDialog: boolean;
  showSubclipsConfirmDialog: boolean;
  showProgramMonitor: boolean;
  showCompositionGuides: boolean;
  showCompositionGuideDialog: boolean;
  showAssetPanel: boolean;
  showInspectorPanel: boolean;
  showEffectsPanel: boolean;
  showMixerPanel: boolean;
  showLUTLibraryDialog: boolean;
  showHLSImportDialog: boolean;
  showResolveExportDialog: boolean;
  settingsOpen: boolean;
  pushSettingsOpen: boolean;
  onboardingOpen: boolean;
  showAIGeneratorDialog: boolean;
  showRatingDialog: boolean;
  showTransitionLibrary: boolean;
  showSpeedRampPanel: boolean;
  showTextOverlayPanel: boolean;
  showGPUFiltersPanel: boolean;
  showColorGradingPanel: boolean;
  showAutoCaptionsPanel: boolean;
  showBeatSyncPanel: boolean;
  showMotionTrackingPanel: boolean;
  showObjectSegmentationPanel: boolean;
  showSyncDialog: boolean;
  showAudioEnhancementDialog: boolean;
  showBatchAudioDialog: boolean;
  showAIAudioAssistant: boolean;
}

type StoryArcPanelStateKey = keyof StoryArcPanelState;

interface StoryArcPanelStateAction {
  type: 'set_flag';
  key: StoryArcPanelStateKey;
  value: SetStateAction<boolean>;
}

function resolveNextBoolean(
  currentValue: boolean,
  nextValue: SetStateAction<boolean>
): boolean {
  return typeof nextValue === 'function'
    ? (nextValue as (previous: boolean) => boolean)(currentValue)
    : nextValue;
}

export function storyArcPanelStateReducer(
  state: StoryArcPanelState,
  action: StoryArcPanelStateAction
): StoryArcPanelState {
  if (action.type !== 'set_flag') {
    return state;
  }

  const nextValue = resolveNextBoolean(state[action.key], action.value);
  if (nextValue === state[action.key]) {
    return state;
  }

  return {
    ...state,
    [action.key]: nextValue,
  };
}

export function buildInitialStoryArcPanelState(
  showCompositionGuidesDefault: boolean
): StoryArcPanelState {
  return {
    showExportDialog: false,
    showAutoMonitor: false,
    showFaceDetectionDialog: false,
    showSceneDetectionDialog: false,
    showFaceDetectionOptionsDialog: false,
    showSubclipsConfirmDialog: false,
    showProgramMonitor: true,
    showCompositionGuides: showCompositionGuidesDefault,
    showCompositionGuideDialog: false,
    showAssetPanel: true,
    showInspectorPanel: true,
    showEffectsPanel: false,
    showMixerPanel: false,
    showLUTLibraryDialog: false,
    showHLSImportDialog: false,
    showResolveExportDialog: false,
    settingsOpen: false,
    pushSettingsOpen: false,
    onboardingOpen: false,
    showAIGeneratorDialog: false,
    showRatingDialog: false,
    showTransitionLibrary: false,
    showSpeedRampPanel: false,
    showTextOverlayPanel: false,
    showGPUFiltersPanel: false,
    showColorGradingPanel: false,
    showAutoCaptionsPanel: false,
    showBeatSyncPanel: false,
    showMotionTrackingPanel: false,
    showObjectSegmentationPanel: false,
    showSyncDialog: false,
    showAudioEnhancementDialog: false,
    showBatchAudioDialog: false,
    showAIAudioAssistant: false,
  };
}

interface UseStoryArcPanelStateReducerResult extends StoryArcPanelState {
  setShowExportDialog: (value: SetStateAction<boolean>) => void;
  setShowAutoMonitor: (value: SetStateAction<boolean>) => void;
  setShowFaceDetectionDialog: (value: SetStateAction<boolean>) => void;
  setShowSceneDetectionDialog: (value: SetStateAction<boolean>) => void;
  setShowFaceDetectionOptionsDialog: (value: SetStateAction<boolean>) => void;
  setShowSubclipsConfirmDialog: (value: SetStateAction<boolean>) => void;
  setShowProgramMonitor: (value: SetStateAction<boolean>) => void;
  setShowCompositionGuides: (value: SetStateAction<boolean>) => void;
  setShowCompositionGuideDialog: (value: SetStateAction<boolean>) => void;
  setShowAssetPanel: (value: SetStateAction<boolean>) => void;
  setShowInspectorPanel: (value: SetStateAction<boolean>) => void;
  setShowEffectsPanel: (value: SetStateAction<boolean>) => void;
  setShowMixerPanel: (value: SetStateAction<boolean>) => void;
  setShowLUTLibraryDialog: (value: SetStateAction<boolean>) => void;
  setShowHLSImportDialog: (value: SetStateAction<boolean>) => void;
  setShowResolveExportDialog: (value: SetStateAction<boolean>) => void;
  setSettingsOpen: (value: SetStateAction<boolean>) => void;
  setPushSettingsOpen: (value: SetStateAction<boolean>) => void;
  setOnboardingOpen: (value: SetStateAction<boolean>) => void;
  setShowAIGeneratorDialog: (value: SetStateAction<boolean>) => void;
  setShowRatingDialog: (value: SetStateAction<boolean>) => void;
  setShowTransitionLibrary: (value: SetStateAction<boolean>) => void;
  setShowSpeedRampPanel: (value: SetStateAction<boolean>) => void;
  setShowTextOverlayPanel: (value: SetStateAction<boolean>) => void;
  setShowGPUFiltersPanel: (value: SetStateAction<boolean>) => void;
  setShowColorGradingPanel: (value: SetStateAction<boolean>) => void;
  setShowAutoCaptionsPanel: (value: SetStateAction<boolean>) => void;
  setShowBeatSyncPanel: (value: SetStateAction<boolean>) => void;
  setShowMotionTrackingPanel: (value: SetStateAction<boolean>) => void;
  setShowObjectSegmentationPanel: (value: SetStateAction<boolean>) => void;
  setShowSyncDialog: (value: SetStateAction<boolean>) => void;
  setShowAudioEnhancementDialog: (value: SetStateAction<boolean>) => void;
  setShowBatchAudioDialog: (value: SetStateAction<boolean>) => void;
  setShowAIAudioAssistant: (value: SetStateAction<boolean>) => void;
}

export function useStoryArcPanelStateReducer(
  showCompositionGuidesDefault: boolean
): UseStoryArcPanelStateReducerResult {
  const [state, dispatch] = useReducer(
    storyArcPanelStateReducer,
    showCompositionGuidesDefault,
    buildInitialStoryArcPanelState
  );

  const setFlag = useCallback(
    (key: StoryArcPanelStateKey, value: SetStateAction<boolean>) => {
      dispatch({ type: 'set_flag', key, value });
    },
    []
  );

  return {
    ...state,
    setShowExportDialog: (value) => setFlag('showExportDialog', value),
    setShowAutoMonitor: (value) => setFlag('showAutoMonitor', value),
    setShowFaceDetectionDialog: (value) => setFlag('showFaceDetectionDialog', value),
    setShowSceneDetectionDialog: (value) => setFlag('showSceneDetectionDialog', value),
    setShowFaceDetectionOptionsDialog: (value) => setFlag('showFaceDetectionOptionsDialog', value),
    setShowSubclipsConfirmDialog: (value) => setFlag('showSubclipsConfirmDialog', value),
    setShowProgramMonitor: (value) => setFlag('showProgramMonitor', value),
    setShowCompositionGuides: (value) => setFlag('showCompositionGuides', value),
    setShowCompositionGuideDialog: (value) => setFlag('showCompositionGuideDialog', value),
    setShowAssetPanel: (value) => setFlag('showAssetPanel', value),
    setShowInspectorPanel: (value) => setFlag('showInspectorPanel', value),
    setShowEffectsPanel: (value) => setFlag('showEffectsPanel', value),
    setShowMixerPanel: (value) => setFlag('showMixerPanel', value),
    setShowLUTLibraryDialog: (value) => setFlag('showLUTLibraryDialog', value),
    setShowHLSImportDialog: (value) => setFlag('showHLSImportDialog', value),
    setShowResolveExportDialog: (value) => setFlag('showResolveExportDialog', value),
    setSettingsOpen: (value) => setFlag('settingsOpen', value),
    setPushSettingsOpen: (value) => setFlag('pushSettingsOpen', value),
    setOnboardingOpen: (value) => setFlag('onboardingOpen', value),
    setShowAIGeneratorDialog: (value) => setFlag('showAIGeneratorDialog', value),
    setShowRatingDialog: (value) => setFlag('showRatingDialog', value),
    setShowTransitionLibrary: (value) => setFlag('showTransitionLibrary', value),
    setShowSpeedRampPanel: (value) => setFlag('showSpeedRampPanel', value),
    setShowTextOverlayPanel: (value) => setFlag('showTextOverlayPanel', value),
    setShowGPUFiltersPanel: (value) => setFlag('showGPUFiltersPanel', value),
    setShowColorGradingPanel: (value) => setFlag('showColorGradingPanel', value),
    setShowAutoCaptionsPanel: (value) => setFlag('showAutoCaptionsPanel', value),
    setShowBeatSyncPanel: (value) => setFlag('showBeatSyncPanel', value),
    setShowMotionTrackingPanel: (value) => setFlag('showMotionTrackingPanel', value),
    setShowObjectSegmentationPanel: (value) => setFlag('showObjectSegmentationPanel', value),
    setShowSyncDialog: (value) => setFlag('showSyncDialog', value),
    setShowAudioEnhancementDialog: (value) => setFlag('showAudioEnhancementDialog', value),
    setShowBatchAudioDialog: (value) => setFlag('showBatchAudioDialog', value),
    setShowAIAudioAssistant: (value) => setFlag('showAIAudioAssistant', value),
  };
}
