import { useMemo, type ChangeEvent, type SyntheticEvent } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';

interface UseStoryArcMonitorHandlersParams {
  handleSourceMonitorMouseDown: () => void;
  handleSourceMonitorFocus: () => void;
  handleProgramMonitorMouseDown: () => void;
  handleProgramMonitorFocus: () => void;
  handleSourceVideoLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  handleSourceVideoTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => void;
  handleSourceVideoPlay: () => void;
  handleSourceVideoPause: () => void;
  handleSourceVideoError: () => void;
  handleProgramVideoLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  handleProgramVideoError: () => void;
  handleSourcePatchVideoTrackChange: (event: SelectChangeEvent<string>) => void;
  handleSourcePatchAudioTrackChange: (event: SelectChangeEvent<string>) => void;
  handleSourcePatchIncludeAudioChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function useStoryArcMonitorHandlers({
  handleSourceMonitorMouseDown,
  handleSourceMonitorFocus,
  handleProgramMonitorMouseDown,
  handleProgramMonitorFocus,
  handleSourceVideoLoadedMetadata,
  handleSourceVideoTimeUpdate,
  handleSourceVideoPlay,
  handleSourceVideoPause,
  handleSourceVideoError,
  handleProgramVideoLoadedMetadata,
  handleProgramVideoError,
  handleSourcePatchVideoTrackChange,
  handleSourcePatchAudioTrackChange,
  handleSourcePatchIncludeAudioChange,
}: UseStoryArcMonitorHandlersParams) {
  const sourceMonitorPanelHandlers = useMemo(
    () => ({
      onMouseDown: handleSourceMonitorMouseDown,
      onFocus: handleSourceMonitorFocus,
    }),
    [handleSourceMonitorMouseDown, handleSourceMonitorFocus]
  );

  const programMonitorPanelHandlers = useMemo(
    () => ({
      onMouseDown: handleProgramMonitorMouseDown,
      onFocus: handleProgramMonitorFocus,
    }),
    [handleProgramMonitorMouseDown, handleProgramMonitorFocus]
  );

  const sourceVideoHandlers = useMemo(
    () => ({
      onLoadedMetadata: handleSourceVideoLoadedMetadata,
      onTimeUpdate: handleSourceVideoTimeUpdate,
      onPlay: handleSourceVideoPlay,
      onPause: handleSourceVideoPause,
      onError: handleSourceVideoError,
    }),
    [
      handleSourceVideoLoadedMetadata,
      handleSourceVideoTimeUpdate,
      handleSourceVideoPlay,
      handleSourceVideoPause,
      handleSourceVideoError,
    ]
  );

  const programVideoHandlers = useMemo(
    () => ({
      onLoadedMetadata: handleProgramVideoLoadedMetadata,
      onError: handleProgramVideoError,
    }),
    [handleProgramVideoLoadedMetadata, handleProgramVideoError]
  );

  const sourcePatchHandlers = useMemo(
    () => ({
      onVideoTrackChange: handleSourcePatchVideoTrackChange,
      onAudioTrackChange: handleSourcePatchAudioTrackChange,
      onIncludeAudioChange: handleSourcePatchIncludeAudioChange,
    }),
    [
      handleSourcePatchVideoTrackChange,
      handleSourcePatchAudioTrackChange,
      handleSourcePatchIncludeAudioChange,
    ]
  );

  return {
    sourceMonitorPanelHandlers,
    programMonitorPanelHandlers,
    sourceVideoHandlers,
    programVideoHandlers,
    sourcePatchHandlers,
  };
}
