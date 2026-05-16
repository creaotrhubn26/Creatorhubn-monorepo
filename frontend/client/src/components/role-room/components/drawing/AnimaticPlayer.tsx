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
  MicNone,
  Close as CloseIcon,
  FiberManualRecord,
  Stop as StopIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useAnimaticPlayback } from './useAnimaticPlayback';
import { useAnimaticAudio } from './useAnimaticAudio';
import { useAnimaticRecorder } from './useAnimaticRecorder';

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

const STAGE_CANVAS_WIDTH = 1280;
const STAGE_CANVAS_HEIGHT = 720;

export const AnimaticPlayer: React.FC<AnimaticPlayerProps> = ({
  frames,
  speeds = [0.5, 1, 1.5, 2],
  aspectRatio = 16 / 9,
  compact = false,
  onActiveFrameChange,
}) => {
  const [speed, setSpeed] = React.useState(1);
  const [loop, setLoop] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioName, setAudioName] = React.useState<string | null>(null);
  const [audioElement, setAudioElement] = React.useState<HTMLAudioElement | null>(null);
  const audioFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

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

  // Synk audio med playback-state.
  useAnimaticAudio({
    audioElement,
    isPlaying: player.isPlaying,
    currentTime: player.currentTime,
    playbackSpeed: speed,
  });

  // Opptak-controller — kobler canvas (video) + audio (valgfritt) til
  // en MediaRecorder som dumper til WebM.
  const recorder = useAnimaticRecorder({
    canvas: canvasRef.current,
    audioElement,
  });

  // Når opptak er aktivt og playback når slutt: stopp opptaket.
  // Vi spotter dette via player.isPlaying som blir false ved slutt.
  const wasRecordingRef = React.useRef(false);
  React.useEffect(() => {
    if (recorder.state === 'recording' && !player.isPlaying && wasRecordingRef.current) {
      recorder.stop();
    }
    wasRecordingRef.current = recorder.state === 'recording';
  }, [recorder, player.isPlaying]);

  const handleRecord = React.useCallback(() => {
    if (recorder.state === 'recording') {
      recorder.stop();
      player.pause();
      return;
    }
    // Start fra null + start opptak først, så playback.
    player.seek(0);
    const started = recorder.start();
    if (started) {
      // Liten timeout slik at recorderen rekker å gå til 'recording' før vi spiller.
      setTimeout(() => player.play(), 50);
    }
  }, [recorder, player]);

  const handleAudioPick = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('audio/')) return;
    // Revoker forrige object-URL hvis den finnes — vi vil ikke lekke.
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioName(file.name);
  }, [audioUrl]);

  const clearAudio = React.useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioName(null);
    setAudioElement(null);
  }, [audioUrl]);

  // Cleanup object-URL ved unmount.
  React.useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const activeFrame = player.activeFrameIndex >= 0 ? frames[player.activeFrameIndex] : null;
  const hasFrames = frames.length > 0 && player.totalDuration > 0;

  // Tegn aktivt frame til canvas. Canvas brukes som rendering-target
  // (kan capture-streames for opptak), og <img> trengs ikke i DOM.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sørg for canvas-størrelse er satt (i piksler, ikke CSS-piksler).
    if (canvas.width !== STAGE_CANVAS_WIDTH) canvas.width = STAGE_CANVAS_WIDTH;
    if (canvas.height !== STAGE_CANVAS_HEIGHT) canvas.height = STAGE_CANVAS_HEIGHT;

    // Bakgrunn.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, STAGE_CANVAS_WIDTH, STAGE_CANVAS_HEIGHT);

    const drawPlaceholder = () => {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = activeFrame?.shotNumber
        ? `Shot ${activeFrame.shotNumber}`
        : `Frame ${player.activeFrameIndex + 1}`;
      ctx.fillText(label, STAGE_CANVAS_WIDTH / 2, STAGE_CANVAS_HEIGHT / 2 - 16);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Ingen tegning enda', STAGE_CANVAS_WIDTH / 2, STAGE_CANVAS_HEIGHT / 2 + 16);
    };

    const src = activeFrame?.imageUrl || activeFrame?.thumbnailUrl;
    if (!src) {
      drawPlaceholder();
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      // Contain-fit: ikke beskjær, behold aspect.
      const imgRatio = img.width / img.height;
      const canvasRatio = STAGE_CANVAS_WIDTH / STAGE_CANVAS_HEIGHT;
      let drawW: number;
      let drawH: number;
      if (imgRatio > canvasRatio) {
        drawW = STAGE_CANVAS_WIDTH;
        drawH = drawW / imgRatio;
      } else {
        drawH = STAGE_CANVAS_HEIGHT;
        drawW = drawH * imgRatio;
      }
      const x = (STAGE_CANVAS_WIDTH - drawW) / 2;
      const y = (STAGE_CANVAS_HEIGHT - drawH) / 2;
      ctx.drawImage(img, x, y, drawW, drawH);
    };
    img.onerror = () => {
      if (cancelled) return;
      drawPlaceholder();
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [activeFrame, player.activeFrameIndex]);

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
        {recorder.state === 'recording' && (
          <Stack direction="row" spacing={0.25} alignItems="center" sx={{ ml: 0.5 }}>
            <FiberManualRecord sx={{ fontSize: 10, color: '#f87171', animation: 'pulse 1.2s ease-in-out infinite' }} />
            <Typography variant="caption" sx={{ color: '#fca5a5', fontSize: 10, fontWeight: 600 }}>
              REC
            </Typography>
          </Stack>
        )}
        <Box sx={{ flex: 1 }} />
        {audioName && (
          <Stack direction="row" spacing={0.25} alignItems="center">
            <MicNone sx={{ fontSize: 12, color: '#86efac' }} />
            <Typography variant="caption" sx={{ color: '#86efac', fontSize: 10, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {audioName}
            </Typography>
            <Tooltip title="Fjern lyd">
              <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)', p: 0.25 }} onClick={clearAudio} data-testid="animatic-audio-clear">
                <CloseIcon sx={{ fontSize: 12 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, ml: audioName ? 1 : 0 }}>
          Frame {player.activeFrameIndex + 1} / {frames.length}
        </Typography>
      </Stack>

      {/* Stage: canvas — tegner aktivt frame og er capture-stream-kilde for opptak. */}
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
          mb: 1,
        }}
        data-testid="animatic-stage"
      >
        <canvas
          ref={canvasRef}
          width={STAGE_CANVAS_WIDTH}
          height={STAGE_CANVAS_HEIGHT}
          style={{ width: '100%', height: '100%', display: 'block' }}
          data-testid="animatic-stage-canvas"
        />
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
        <Tooltip title={audioUrl ? 'Bytt lydspor' : 'Legg til voiceover / midlertidig musikk'}>
          <IconButton
            size="small"
            onClick={() => audioFileInputRef.current?.click()}
            sx={{ color: audioUrl ? '#86efac' : 'rgba(255,255,255,0.7)' }}
            data-testid="animatic-audio-upload"
          >
            <MicNone fontSize="small" />
          </IconButton>
        </Tooltip>
        {recorder.isSupported && (
          <Tooltip
            title={
              recorder.state === 'recording'
                ? 'Stopp opptak'
                : `Spill inn animatic til WebM${audioUrl ? ' (med lyd)' : ''}`
            }
          >
            <IconButton
              size="small"
              onClick={handleRecord}
              sx={{ color: recorder.state === 'recording' ? '#fca5a5' : 'rgba(255,255,255,0.7)' }}
              data-testid="animatic-record"
            >
              {recorder.state === 'recording'
                ? <StopIcon fontSize="small" />
                : <FiberManualRecord fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        {recorder.lastBlob && recorder.state === 'idle' && (
          <Tooltip title="Last ned siste opptak (.webm)">
            <IconButton
              size="small"
              onClick={() => recorder.downloadLastBlob()}
              sx={{ color: '#86efac' }}
              data-testid="animatic-download"
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <input
          ref={audioFileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleAudioPick}
          style={{ display: 'none' }}
          data-testid="animatic-audio-input"
        />
        {audioUrl && (
          <audio
            ref={setAudioElement}
            src={audioUrl}
            preload="auto"
            style={{ display: 'none' }}
            data-testid="animatic-audio-element"
          />
        )}

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
