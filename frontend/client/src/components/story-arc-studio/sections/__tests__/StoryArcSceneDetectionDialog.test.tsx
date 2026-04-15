// @ts-nocheck
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StoryArcSceneDetectionDialog } from '../StoryArcSceneDetectionDialog';

type SceneDialogProps = ComponentProps<typeof StoryArcSceneDetectionDialog>;

function buildProps(overrides: Partial<SceneDialogProps> = {}): SceneDialogProps {
  return {
    open: true,
    onClose: vi.fn(),
    sceneDetectionJobId: 'scene-job-1',
    sceneDetectionProgress: {
      status: 'processing',
      progress: 30,
    },
    onJumpToSceneStart: vi.fn(),
    ...overrides,
  };
}

describe('StoryArcSceneDetectionDialog', () => {
  it('shows job id and processing status', () => {
    const props = buildProps();
    render(<StoryArcSceneDetectionDialog {...props} />);

    expect(screen.getByText('Scene Detection')).toBeInTheDocument();
    expect(screen.getByText('Job: scene-job-1')).toBeInTheDocument();
    expect(screen.getByText('Detecting scenes...')).toBeInTheDocument();
  });

  it('renders completed scenes and jumps to selected scene', () => {
    const props = buildProps({
      sceneDetectionProgress: {
        status: 'completed',
        progress: 100,
        scenes: [
          { scene_number: 1, start_time: 0, end_time: 4.2, duration: 4.2 },
          { scene_number: 2, start_time: 4.2, end_time: 9, duration: 4.8 },
        ],
      },
    });
    render(<StoryArcSceneDetectionDialog {...props} />);

    expect(screen.getByText('Detected 2 scenes')).toBeInTheDocument();
    expect(screen.getByText('Scene 1')).toBeInTheDocument();
    expect(screen.getByText('0.00s - 4.20s (4.20s)')).toBeInTheDocument();

    const jumpButtons = screen.getAllByRole('button', { name: 'Jump' });
    fireEvent.click(jumpButtons[0]);
    expect(props.onJumpToSceneStart).toHaveBeenCalledWith(0);
  });

  it('shows error state and closes dialog', () => {
    const props = buildProps({
      sceneDetectionProgress: {
        status: 'failed',
        progress: 100,
        error: 'Worker crashed',
      },
    });
    render(<StoryArcSceneDetectionDialog {...props} />);

    expect(screen.getByText('Scene detection failed: Worker crashed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
