import { useMemo } from 'react';
import type { BeatClip } from '../../../services/storyArcDataIntegration';
import type { SpeedKeyframe } from '../../../services/speed-ramp-engine';
import type { TextOverlay } from '../../../services/text-overlay-engine';
import type { FilterConfig } from '../../../services/pixi-filter-engine';
import type { ColorGrade } from '../../../services/color-grading-engine';
import type { CaptionSegment } from '../../timeline/AutoCaptionsPanel';

interface UseStoryArcPanelFlowsParams {
  showAIGeneratorDialog: boolean;
  closeAIGeneratorDialog: () => void;
  handleAIStoryGenerated: (data: unknown) => void;
  showTransitionLibrary: boolean;
  closeTransitionLibrary: () => void;
  handleTransitionSelect: (type: string, duration: number, engine: 'canvas2d' | 'webgl') => void;
  selectedClipsSize: number;
  showSpeedRampPanel: boolean;
  selectedPrimaryClipId: string | null;
  selectedPrimaryClipDuration: number;
  currentSpeedKeyframes: SpeedKeyframe[];
  handleSpeedRampKeyframesChange: (keyframes: SpeedKeyframe[]) => void;
  handleSpeedRampPreview: () => void;
  showTextOverlayPanel: boolean;
  closeTextOverlayPanel: () => void;
  handleTextOverlayAdd: (overlay: TextOverlay) => void;
  showGPUFiltersPanel: boolean;
  closeGPUFiltersPanel: () => void;
  handleGPUFilterApply: (filterId: string, config: FilterConfig) => void;
  showColorGradingPanel: boolean;
  closeColorGradingPanel: () => void;
  handleColorGradeApply: (grade: Partial<ColorGrade>) => void;
  showAutoCaptionsPanel: boolean;
  closeAutoCaptionsPanel: () => void;
  captionVideoPath: string | null;
  captionSourceVideoFile: File | null;
  captionFallbackVideoPaths: string[];
  captionFallbackVideoFiles: File[];
  handleCaptionsGenerated: (captions: CaptionSegment[], srt: string, vtt: string) => void;
  waveformAudioUrl: string;
  showBeatSyncPanel: boolean;
  closeBeatSyncPanel: () => void;
  clips: BeatClip[];
  handleBeatSyncClipsSnapped: (snappedClips: BeatClip[]) => void;
  showObjectSegmentationPanel: boolean;
  closeObjectSegmentationPanel: () => void;
  showMotionTrackingPanel: boolean;
  closeMotionTrackingPanel: () => void;
  selectedPrimaryClipSourceFile?: string;
  handleBackgroundRemovalProcessed: (result: unknown) => void;
  handleObjectSegmentationComplete: (result: unknown) => void;
  handleMotionTrackingComplete: (result: unknown) => void;
}

export function useStoryArcPanelFlows({
  showAIGeneratorDialog,
  closeAIGeneratorDialog,
  handleAIStoryGenerated,
  showTransitionLibrary,
  closeTransitionLibrary,
  handleTransitionSelect,
  selectedClipsSize,
  showSpeedRampPanel,
  selectedPrimaryClipId,
  selectedPrimaryClipDuration,
  currentSpeedKeyframes,
  handleSpeedRampKeyframesChange,
  handleSpeedRampPreview,
  showTextOverlayPanel,
  closeTextOverlayPanel,
  handleTextOverlayAdd,
  showGPUFiltersPanel,
  closeGPUFiltersPanel,
  handleGPUFilterApply,
  showColorGradingPanel,
  closeColorGradingPanel,
  handleColorGradeApply,
  showAutoCaptionsPanel,
  closeAutoCaptionsPanel,
  captionVideoPath,
  captionSourceVideoFile,
  captionFallbackVideoPaths,
  captionFallbackVideoFiles,
  handleCaptionsGenerated,
  waveformAudioUrl,
  showBeatSyncPanel,
  closeBeatSyncPanel,
  clips,
  handleBeatSyncClipsSnapped,
  showObjectSegmentationPanel,
  closeObjectSegmentationPanel,
  showMotionTrackingPanel,
  closeMotionTrackingPanel,
  selectedPrimaryClipSourceFile,
  handleBackgroundRemovalProcessed,
  handleObjectSegmentationComplete,
  handleMotionTrackingComplete,
}: UseStoryArcPanelFlowsParams) {
  const aiStoryGeneratorDialogProps = useMemo(
    () => ({
      open: showAIGeneratorDialog,
      onClose: closeAIGeneratorDialog,
      onStoryGenerated: handleAIStoryGenerated,
    }),
    [showAIGeneratorDialog, closeAIGeneratorDialog, handleAIStoryGenerated]
  );

  const transitionLibraryProps = useMemo(
    () => ({
      open: showTransitionLibrary,
      onClose: closeTransitionLibrary,
      onSelectTransition: handleTransitionSelect,
    }),
    [showTransitionLibrary, closeTransitionLibrary, handleTransitionSelect]
  );

  const speedRampPanelProps = useMemo(
    () => ({
      isVisible: selectedClipsSize > 0 && showSpeedRampPanel,
      clipId: selectedPrimaryClipId || '',
      clipDuration: selectedPrimaryClipDuration || 10,
      currentKeyframes: currentSpeedKeyframes,
      onKeyframesChange: handleSpeedRampKeyframesChange,
      onPreview: handleSpeedRampPreview,
    }),
    [
      selectedClipsSize,
      showSpeedRampPanel,
      selectedPrimaryClipId,
      selectedPrimaryClipDuration,
      currentSpeedKeyframes,
      handleSpeedRampKeyframesChange,
      handleSpeedRampPreview,
    ]
  );

  const textOverlayPanelProps = useMemo(
    () => ({
      open: showTextOverlayPanel,
      onClose: closeTextOverlayPanel,
      onAddOverlay: handleTextOverlayAdd,
    }),
    [showTextOverlayPanel, closeTextOverlayPanel, handleTextOverlayAdd]
  );

  const gpuFiltersPanelProps = useMemo(
    () => ({
      open: showGPUFiltersPanel,
      onClose: closeGPUFiltersPanel,
      onApplyFilter: handleGPUFilterApply,
    }),
    [showGPUFiltersPanel, closeGPUFiltersPanel, handleGPUFilterApply]
  );

  const colorGradingPanelProps = useMemo(
    () => ({
      open: showColorGradingPanel,
      onClose: closeColorGradingPanel,
      onApplyGrade: handleColorGradeApply,
    }),
    [showColorGradingPanel, closeColorGradingPanel, handleColorGradeApply]
  );

  const autoCaptionsPanelProps = useMemo(
    () => ({
      open: showAutoCaptionsPanel,
      onClose: closeAutoCaptionsPanel,
      videoPath: captionVideoPath || '',
      sourceVideoFile: captionSourceVideoFile,
      fallbackVideoPaths: captionFallbackVideoPaths,
      fallbackVideoFiles: captionFallbackVideoFiles,
      onCaptionsGenerated: handleCaptionsGenerated,
    }),
    [
      showAutoCaptionsPanel,
      closeAutoCaptionsPanel,
      captionVideoPath,
      captionSourceVideoFile,
      captionFallbackVideoPaths,
      captionFallbackVideoFiles,
      handleCaptionsGenerated,
    ]
  );

  const beatSyncPanelProps = useMemo(
    () => ({
      isVisible: Boolean(waveformAudioUrl),
      open: showBeatSyncPanel,
      onClose: closeBeatSyncPanel,
      audioPath: waveformAudioUrl,
      clips,
      onClipsSnapped: handleBeatSyncClipsSnapped,
    }),
    [
      waveformAudioUrl,
      showBeatSyncPanel,
      closeBeatSyncPanel,
      clips,
      handleBeatSyncClipsSnapped,
    ]
  );

  const backgroundRemovalPanelProps = useMemo(
    () => ({
      clipId: selectedPrimaryClipId || '',
      onClose: closeGPUFiltersPanel,
      onProcessed: handleBackgroundRemovalProcessed,
    }),
    [
      selectedPrimaryClipId,
      closeGPUFiltersPanel,
      handleBackgroundRemovalProcessed,
    ]
  );

  const objectSegmentationPanelProps = useMemo(
    () => ({
      open: showObjectSegmentationPanel,
      onClose: closeObjectSegmentationPanel,
      clipId: selectedPrimaryClipId || '',
      videoUrl: selectedPrimaryClipSourceFile,
      onSegmentationComplete: handleObjectSegmentationComplete,
    }),
    [
      showObjectSegmentationPanel,
      closeObjectSegmentationPanel,
      selectedPrimaryClipId,
      selectedPrimaryClipSourceFile,
      handleObjectSegmentationComplete,
    ]
  );

  const motionTrackingPanelProps = useMemo(
    () => ({
      open: showMotionTrackingPanel,
      onClose: closeMotionTrackingPanel,
      clipId: selectedPrimaryClipId || '',
      videoUrl: selectedPrimaryClipSourceFile,
      onTrackingComplete: handleMotionTrackingComplete,
    }),
    [
      showMotionTrackingPanel,
      closeMotionTrackingPanel,
      selectedPrimaryClipId,
      selectedPrimaryClipSourceFile,
      handleMotionTrackingComplete,
    ]
  );

  return {
    aiStoryGeneratorDialogProps,
    transitionLibraryProps,
    speedRampPanelProps,
    textOverlayPanelProps,
    gpuFiltersPanelProps,
    colorGradingPanelProps,
    autoCaptionsPanelProps,
    beatSyncPanelProps,
    backgroundRemovalPanelProps,
    objectSegmentationPanelProps,
    motionTrackingPanelProps,
  };
}
