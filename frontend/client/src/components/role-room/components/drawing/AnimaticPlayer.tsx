// @ts-nocheck
/**
 * AnimaticPlayer — spiller storyboard-frames i sekvens basert på
 * `frame.duration`. Lar artisten teste pacing uten å produsere video.
 *
 * Funksjoner (MVP-runde 1):
 *   - Play / pause / restart
 *   - Scrubber (slider) for å hoppe i tidslinjen
 *   - Tids- og frame-teller
 *   - Hastighetsvelger (0.5x, 1x, 2x)
 *   - Loop-toggle
 *
 * Audio og dialog-sync kommer i runde 2.
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Slider,
  ToggleButton,
  Tooltip,
  Select,
  MenuItem,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Replay,
  Loop,
  Movie,
} from '@mui/icons-material';
import { useAnimaticPlayback } from './useAnimaticPlayback';

export interface AnimaticFrameMeta {
  id: string;
  duration?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  shotNumber?: string;
  description?: string;
}

export interface AnimaticPlayerProps {
  frames: AnimaticFrameMeta[];
  /** Standard sett av hastigheter. */
  speeds?: number[];
  /** Aspect ratio for stage-området (default 16:9). */
  aspectRatio?: number;
  compact?: boolean;
  /** Kalles når aktiv frame endrer seg (for sync med annen UI). */
  onActiveFrameChange?: (frameId: string, index: number) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const AnimaticPlayer: React.FC<AnimaticPlayerProps> = ({
  frames,
  speeds = [0.5, 1, 1.5, 2],
  aspectRatio = 16 / 9,
  compact = false,
  onActiveFrameChange,
}) => {
  const [speed, setSpeed] = React.useState(1);
  const [loop, setLoop] = React.useState(false);

  const handleActiveFrameChange = React.useCallback(
    (segment) => {
      onActiveFrameChange?.(segment.frameId, segment.frameIndex);
    },
    [onActiveFrameChange],
  );

  const player = useAnimaticPlayback({
    frames,
    playbackSpeed: speed,
    loop,
    onActiveFrameChange: handleActiveFrameChange,
  });

  const activeFrame = player.activeFrameIndex >= 0 ? frames[player.activeFrameIndex] : null;
  const hasFrames = frames.length > 0 && player.totalDuration > 0;

  if (!hasFrames) {
    return (
      <Box
        data-testid="animatic-player-empty"
        sx={{
          p: compact ? 1 : 1.5,
          borderRadius: 1.5,
          bgcolor: 'rgba(15,15,25,0.92)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Movie sx={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Legg til frames med varighet for å spille animatic.
          </Typography>
        </Stack>
      </Box>
    );
  }

  const imageSrc = activeFrame?.imageUrl || activeFrame?.thumbnailUrl;
  const stageMaxWidth = compact ? 280 : 420;

  return (
    <Box
      data-testid="animatic-player"
      sx={{
        p: compact ? 1 : 1.5,
        borderRadius: 1.5,
        bgcolor: 'rgba(15,15,25,0.92)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <Movie sx={{ fontSize: 14, color: '#a5b4fc' }} />
        <Typography variant="overline" sx={{ fontSize: 10, letterSpacing: '0.08em', color: '#a5b4fc', fontWeight: 800 }}>
          Animatic-avspilling
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>
          Frame {player.activeFrameIndex + 1} / {frames.length}
        </Typography>
      </Stack>

      {/* Stage: aktivt bilde */}
      <Box
        sx={{
          width: '100%',
          maxWidth: stageMaxWidth,
          mx: 'auto',
          aspectRatio: String(aspectRatio),
          bgcolor: 'rgba(0,0,0,0.5)',
          borderRadius: 1,
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1,
        }}
        data-testid="animatic-stage"
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={activeFrame?.description || `Frame ${player.activeFrameIndex + 1}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Stack alignItems="center" spacing={0.5} sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <Typography variant="caption" sx={{ fontSize: 11 }}>
              {activeFrame?.shotNumber ? `Shot ${activeFrame.shotNumber}` : `Frame ${player.activeFrameIndex + 1}`}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 10 }}>
              Ingen tegning enda
            </Typography>
          </Stack>
        )}
      </Box>

      {/* Scrubber */}
      <Box sx={{ px: 1, mb: 0.5 }}>
        <Slider
          size="small"
          min={0}
          max={player.totalDuration}
          step={0.05}
          value={player.currentTime}
          onChange={(_, value) => player.seek(Array.isArray(value) ? value[0] : value)}
          sx={{ color: '#a5b4fc' }}
          data-testid="animatic-scrubber"
        />
      </Box>

      {/* Transport-kontroller */}
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 0.5 }}>
        <Tooltip title={player.isPlaying ? 'Pause' : 'Spill av'}>
          <IconButton
            size="small"
            onClick={player.toggle}
            sx={{ color: '#a5b4fc' }}
            data-testid="animatic-toggle"
          >
            {player.isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Start på nytt">
          <IconButton
            size="small"
            onClick={() => player.seek(0)}
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
            onChange={() => setLoop((l) => !l)}
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

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, ml: 0.5, fontFamily: 'monospace' }}>
          {formatTime(player.currentTime)} / {formatTime(player.totalDuration)}
        </Typography>

        <Box sx={{ flex: 1 }} />

        <Select
          size="small"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
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
    </Box>
  );
};

export default AnimaticPlayer;
