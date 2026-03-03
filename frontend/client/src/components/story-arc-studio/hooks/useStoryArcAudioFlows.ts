import { useMemo } from 'react';

type StoryArcAudioMetrics = Record<string, unknown>;
interface StoryArcBatchAudioResult {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  enhancedUrl?: string;
  metrics?: StoryArcAudioMetrics;
  error?: string;
}

interface AIAudioTrackOption {
  id: string;
  name: string;
  sourceFile: string;
  type?: 'dialogue' | 'music' | 'sfx';
}

interface UseStoryArcAudioFlowsParams {
  showAudioEnhancementDialog: boolean;
  closeAudioEnhancementDialog: () => void;
  pendingAudioFile: File | null;
  handleAudioEnhanced: (enhancedUrl: string, metrics: StoryArcAudioMetrics) => void;
  handleAudioEnhancementSkip: () => void;
  showBatchAudioDialog: boolean;
  closeBatchAudioDialog: () => void;
  batchAudioFiles: File[];
  handleBatchAudioComplete: (results: StoryArcBatchAudioResult[]) => void;
  showAIAudioAssistant: boolean;
  closeAIAudioAssistantDialog: () => void;
  aiAudioAssistantTracks: AIAudioTrackOption[];
  selectedAudioTrackId: string | null;
  openMixerDirectly: boolean;
  handleAIAudioMixComplete: (mixedAudioUrl: string, metrics: StoryArcAudioMetrics) => void;
}

export function useStoryArcAudioFlows({
  showAudioEnhancementDialog,
  closeAudioEnhancementDialog,
  pendingAudioFile,
  handleAudioEnhanced,
  handleAudioEnhancementSkip,
  showBatchAudioDialog,
  closeBatchAudioDialog,
  batchAudioFiles,
  handleBatchAudioComplete,
  showAIAudioAssistant,
  closeAIAudioAssistantDialog,
  aiAudioAssistantTracks,
  selectedAudioTrackId,
  openMixerDirectly,
  handleAIAudioMixComplete,
}: UseStoryArcAudioFlowsParams) {
  const audioEnhancementDialogProps = useMemo(
    () => ({
      open: showAudioEnhancementDialog,
      onClose: closeAudioEnhancementDialog,
      audioFile: pendingAudioFile,
      onEnhanced: handleAudioEnhanced,
      onSkip: handleAudioEnhancementSkip,
      preset: 'auto' as const,
    }),
    [
      showAudioEnhancementDialog,
      closeAudioEnhancementDialog,
      pendingAudioFile,
      handleAudioEnhanced,
      handleAudioEnhancementSkip,
    ]
  );

  const batchAudioDialogProps = useMemo(
    () => ({
      open: showBatchAudioDialog,
      onClose: closeBatchAudioDialog,
      audioFiles: batchAudioFiles,
      onBatchComplete: handleBatchAudioComplete,
      defaultPreset: 'auto' as const,
    }),
    [
      showBatchAudioDialog,
      closeBatchAudioDialog,
      batchAudioFiles,
      handleBatchAudioComplete,
    ]
  );

  const aiAudioAssistantDialogProps = useMemo(
    () => ({
      open: showAIAudioAssistant,
      onClose: closeAIAudioAssistantDialog,
      audioTracks: aiAudioAssistantTracks,
      selectedTrackId: selectedAudioTrackId,
      openMixerDirectly,
      onMixComplete: handleAIAudioMixComplete,
    }),
    [
      showAIAudioAssistant,
      closeAIAudioAssistantDialog,
      aiAudioAssistantTracks,
      selectedAudioTrackId,
      openMixerDirectly,
      handleAIAudioMixComplete,
    ]
  );

  return {
    audioEnhancementDialogProps,
    batchAudioDialogProps,
    aiAudioAssistantDialogProps,
  };
}
