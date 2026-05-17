// @ts-nocheck
/**
 * AnimaticTransportBar — bunn-raden i AnimaticPlayer: play/pause,
 * restart, loop-toggle, scene-track-upload, record/stop, download,
 * tids-teller og fart-velger.
 *
 * Holder seg til presentasjon. AnimaticPlayer eier state og handlers;
 * denne komponenten dispatches dem ved bruker-interaksjon.
 */

import React from 'react';
import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Replay,
  Loop,
  MicNone,
  FiberManualRecord,
  Stop as StopIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface AnimaticTransportBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeekToStart: () => void;
  loop: boolean;
  onToggleLoop: () => void;
  audioUrl: string | null;
  onOpenAudioPicker: () => void;
  recorderState: 'idle' | 'preparing' | 'recording' | 'finalizing';
  recorderIsSupported: boolean;
  recorderHasLastBlob: boolean;
  onRecord: () => void;
  onDownloadLastBlob: () => void;
  currentTime: number;
  totalDuration: number;
  speed: number;
  speeds: number[];
  onSpeedChange: (s: number) => void;
  /** JSX-children rendres etter knappene men før time/speed —
   *  brukes for å holde hidden audio-elementer + file-inputs i samme
   *  Stack uten å eksponere alle refs over component-grensen. */
  children?: React.ReactNode;
}

export const AnimaticTransportBar: React.FC<AnimaticTransportBarProps> = ({
  isPlaying,
  onTogglePlay,
  onSeekToStart,
  loop,
  onToggleLoop,
  audioUrl,
  onOpenAudioPicker,
  recorderState,
  recorderIsSupported,
  recorderHasLastBlob,
  onRecord,
  onDownloadLastBlob,
  currentTime,
  totalDuration,
  speed,
  speeds,
  onSpeedChange,
  children,
}) => {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 0.5 }}>
      <Tooltip title={isPlaying ? 'Pause' : 'Spill av'}>
        <IconButton
          size="small"
          onClick={onTogglePlay}
          sx={{ color: '#a5b4fc' }}
          data-testid="animatic-toggle"
        >
          {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Tooltip title="Start på nytt">
        <IconButton
          size="small"
          onClick={onSeekToStart}
          sx={{ color: 'rgba(255,255,255,0.7)' }}
          data-testid="animatic-restart"
        >
          <Replay fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={loop ? 'Loop på' : 'Loop av'}>
        <ToggleButton
          size="small"
          value="loop"
          selected={loop}
          onChange={onToggleLoop}
          sx={{
            color: loop ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
            border: 'none',
            p: 0.5,
            '&.Mui-selected': { bgcolor: 'rgba(165,180,252,0.15)' },
          }}
        >
          <Loop fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title={audioUrl ? 'Bytt lydspor' : 'Legg til voiceover / midlertidig musikk'}>
        <IconButton
          size="small"
          onClick={onOpenAudioPicker}
          sx={{ color: audioUrl ? '#86efac' : 'rgba(255,255,255,0.7)' }}
          data-testid="animatic-audio-upload"
        >
          <MicNone fontSize="small" />
        </IconButton>
      </Tooltip>
      {recorderIsSupported && (
        <Tooltip
          title={
            recorderState === 'recording'
              ? 'Stopp opptak'
              : `Spill inn animatic til WebM${audioUrl ? ' (med lyd)' : ''}`
          }
        >
          <IconButton
            size="small"
            onClick={onRecord}
            sx={{ color: recorderState === 'recording' ? '#fca5a5' : 'rgba(255,255,255,0.7)' }}
            data-testid="animatic-record"
          >
            {recorderState === 'recording'
              ? <StopIcon fontSize="small" />
              : <FiberManualRecord fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
      {recorderHasLastBlob && recorderState === 'idle' && (
        <Tooltip title="Last ned siste opptak (.webm)">
          <IconButton
            size="small"
            onClick={onDownloadLastBlob}
            sx={{ color: '#86efac' }}
            data-testid="animatic-download"
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {children}

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, ml: 0.5, fontFamily: 'monospace' }}>
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </Typography>

      <Box sx={{ flex: 1 }} />

      <Select
        size="small"
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        variant="standard"
        disableUnderline
        sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.5)' } }}
        data-testid="animatic-speed"
      >
        {speeds.map((s) => (
          <MenuItem key={s} value={s} sx={{ fontSize: 12 }}>
            {s}×
          </MenuItem>
        ))}
      </Select>
    </Stack>
  );
};
