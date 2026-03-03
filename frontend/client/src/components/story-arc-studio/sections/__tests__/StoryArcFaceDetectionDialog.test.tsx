import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { FaceDetectionProgress } from '../../../../services/face-detection-worker';
import { StoryArcFaceDetectionDialog } from '../StoryArcFaceDetectionDialog';

type FaceDialogProps = ComponentProps<typeof StoryArcFaceDetectionDialog>;

function buildProps(overrides: Partial<FaceDialogProps> = {}): FaceDialogProps {
  const onClose = vi.fn();
  const onDialogAction = vi.fn();

  const faceDetectionProgress: FaceDetectionProgress = {
    total: 4,
    processed: 2,
    current: 'clip-1',
    results: [],
    errors: [],
  };

  return {
    open: true,
    onClose,
    faceDetectionRunning: true,
    faceDetectionProgress,
    resolveClipName: (clipId) => (clipId === 'clip-1' ? 'Ceremony Intro' : undefined),
    onDialogAction,
    ...overrides,
  };
}

describe('StoryArcFaceDetectionDialog', () => {
  it('renders running status and progress details', () => {
    const props = buildProps();
    render(<StoryArcFaceDetectionDialog {...props} />);

    expect(screen.getByText(/Face Detection Progress/i)).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Processing clips: 2 / 4')).toBeInTheDocument();
    expect(screen.getByText('Analyzing: Ceremony Intro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows summary and complete state when processing has finished', () => {
    const props = buildProps({
      faceDetectionRunning: false,
      faceDetectionProgress: {
        total: 2,
        processed: 2,
        current: null,
        results: [
          {
            clipId: 'clip-1',
            hasFace: true,
            faceCount: 1,
            confidence: 0.9,
            timestamp: 1.2,
            comprehensiveAnalysis: {
              landmarks: {
                count: 12,
                points: [{ x: 10, y: 15 }],
              },
            },
          },
          {
            clipId: 'clip-2',
            hasFace: false,
            faceCount: 0,
            confidence: 0.1,
            timestamp: 1.2,
          },
        ],
        errors: [{ clipId: 'clip-3', error: 'Decode error' }],
      },
      resolveClipName: (clipId) => {
        if (clipId === 'clip-1') {
          return 'Ceremony Intro';
        }
        if (clipId === 'clip-3') {
          return 'B-Roll';
        }
        return undefined;
      },
    });
    render(<StoryArcFaceDetectionDialog {...props} />);

    expect(screen.getByText('1 with faces')).toBeInTheDocument();
    expect(screen.getByText('1 without faces')).toBeInTheDocument();
    expect(screen.getByText('1 errors')).toBeInTheDocument();
    expect(screen.getByText('12 landmarks')).toBeInTheDocument();
    expect(screen.getByText(/Face detection complete!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls dialog action handler from footer button', () => {
    const props = buildProps();
    render(<StoryArcFaceDetectionDialog {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onDialogAction).toHaveBeenCalledTimes(1);
  });
});
