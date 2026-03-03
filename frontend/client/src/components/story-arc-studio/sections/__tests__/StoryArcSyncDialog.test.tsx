import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { BeatClip } from '../../../../services/storyArcDataIntegration';
import type { AudioSyncResult } from '../../../../services/audio-sync-engine';
import {
  StoryArcSyncDialog,
  type StoryArcSyncConfidenceSummary,
  type StoryArcSyncResultRow,
} from '../StoryArcSyncDialog';

type SyncDialogProps = ComponentProps<typeof StoryArcSyncDialog>;

const clipA: BeatClip = {
  id: 'clip-a',
  name: 'Camera A',
  beatName: 'Camera A',
  start: 0,
  duration: 10,
  ev: 0.2,
  synopsis: 'Clip A',
  trackId: 'video-1',
  color: '#FF6B35',
};

const clipB: BeatClip = {
  id: 'clip-b',
  name: 'Camera B',
  beatName: 'Camera B',
  start: 0,
  duration: 12,
  ev: 0.2,
  synopsis: 'Clip B',
  trackId: 'video-1',
  color: '#FF6B35',
};

const detectedSyncResult: AudioSyncResult = {
  offset_seconds: 0.2,
  offset_frames: 6,
  confidence: 0.87,
  method: 'audio_waveform',
};

function buildProps(overrides: Partial<SyncDialogProps> = {}): SyncDialogProps {
  const onClose = vi.fn();
  const onToggleSyncClipSelectionClick = vi.fn();
  const onApplySync = vi.fn();
  const onRunSync = vi.fn();
  const onResetSyncPreview = vi.fn();
  const onManualOffsetSliderChange = vi.fn();
  const onResetManualOffsetClick = vi.fn();
  const onClearManualOffsetClick = vi.fn();
  const onSyncTryReallyHardChange = vi.fn();
  const onSyncPreferTimecodeChange = vi.fn();
  const onSyncEnableDriftCorrectionChange = vi.fn();
  const onSyncAllowClipReorderChange = vi.fn();
  const onSyncUseServerFirstChange = vi.fn();
  const onSyncMaxOffsetWindowChange = vi.fn();

  const syncResultRows: StoryArcSyncResultRow[] = [
    {
      clipId: clipA.id,
      clip: clipA,
      result: detectedSyncResult,
      confidence: detectedSyncResult.confidence,
      confidenceColor: 'success',
      confidencePreviewColor: '#2E7D32',
      manualOffset: detectedSyncResult.offset_seconds,
    },
  ];

  const syncConfidenceSummary: StoryArcSyncConfidenceSummary = {
    avgConfidence: 0.87,
    qualityColor: 'success',
    qualityLabel: 'High',
  };

  return {
    open: true,
    onClose,
    syncJobId: 'sync-job-1',
    syncTryReallyHard: false,
    syncPreferTimecode: true,
    syncEnableDriftCorrection: true,
    syncAllowClipReorder: false,
    syncUseServerFirst: true,
    onSyncTryReallyHardChange,
    onSyncPreferTimecodeChange,
    onSyncEnableDriftCorrectionChange,
    onSyncAllowClipReorderChange,
    onSyncUseServerFirstChange,
    syncMaxOffsetSeconds: 30,
    onSyncMaxOffsetWindowChange,
    clips: [clipA, clipB],
    clipMeta: {
      [clipA.id]: { camera: 'A-Cam', syncGroup: 'Group 1' },
      [clipB.id]: { camera: 'B-Cam', syncGroup: 'Group 1' },
    },
    selectedSyncClips: new Set([clipA.id, clipB.id]),
    onToggleSyncClipSelectionClick,
    syncInProgress: false,
    syncResults: null,
    syncPreviewMode: false,
    syncResultRows,
    syncConfidenceSummary,
    onManualOffsetSliderChange,
    onResetManualOffsetClick,
    onClearManualOffsetClick,
    onResetSyncPreview,
    onApplySync,
    onRunSync,
    ...overrides,
  };
}

describe('StoryArcSyncDialog', () => {
  it('renders clips and forwards clip selection clicks', () => {
    const props = buildProps();
    render(<StoryArcSyncDialog {...props} />);

    expect(screen.getByText('Sync Multi-Angle Clips')).toBeInTheDocument();
    expect(screen.getByText('Camera A')).toBeInTheDocument();
    expect(screen.getByText('Camera B')).toBeInTheDocument();
    expect(screen.getByText('Select Clips to Sync (2 selected)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Camera A'));
    expect(props.onToggleSyncClipSelectionClick).toHaveBeenCalledTimes(1);
  });

  it('disables run sync button when fewer than two clips are selected', () => {
    const props = buildProps({
      selectedSyncClips: new Set([clipA.id]),
    });
    render(<StoryArcSyncDialog {...props} />);

    const runButton = screen.getByTestId('sync-run-button');
    expect(runButton).toBeDisabled();
  });

  it('shows preview controls and triggers preview actions', () => {
    const props = buildProps({
      syncPreviewMode: true,
      syncResults: {
        [clipA.id]: detectedSyncResult,
      },
      syncResultRows: [
        {
          clipId: clipA.id,
          clip: clipA,
          result: detectedSyncResult,
          confidence: detectedSyncResult.confidence,
          confidenceColor: 'success',
          confidencePreviewColor: '#2E7D32',
          manualOffset: 0.35,
        },
      ],
    });
    render(<StoryArcSyncDialog {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to Edit' }));
    fireEvent.click(screen.getByTestId('sync-apply-button'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(props.onResetSyncPreview).toHaveBeenCalledTimes(1);
    expect(props.onApplySync).toHaveBeenCalledTimes(1);
    expect(props.onResetManualOffsetClick).toHaveBeenCalledTimes(1);
    expect(props.onClearManualOffsetClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Overall Sync Quality: High/i)).toBeInTheDocument();
  });
});
