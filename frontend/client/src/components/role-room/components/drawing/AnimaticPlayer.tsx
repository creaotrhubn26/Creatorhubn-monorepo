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
  Fullscreen,
  FullscreenExit,
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
  /** Manus-linjer som hører til dette framet (vises som caption under
   *  stagen). Brukes for pacing-test av dialog. */
  caption?: string;
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
  /** Sekunder med cross-fade mellom frames. 0 = hard cut. Default 0.3. */
  transitionDuration?: number;
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
  transitionDuration = 0.3,
}) => {
  const [speed, setSpeed] = React.useState(1);
  const [loop, setLoop] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [audioName, setAudioName] = React.useState<string | null>(null);
  const [audioElement, setAudioElement] = React.useState<HTMLAudioElement | null>(null);
  const audioFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = React.useRef<HTMLDivElement | null>(null);
  const playerRootRef = React.useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [recordingElapsed, setRecordingElapsed] = React.useState(0);
  const recordingStartRef = React.useRef<number | null>(null);

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

  // Tell opptak-tid i sanntid mens recorder er aktiv.
  React.useEffect(() => {
    if (recorder.state !== 'recording') {
      recordingStartRef.current = null;
      setRecordingElapsed(0);
      return;
    }
    recordingStartRef.current = performance.now();
    const interval = setInterval(() => {
      if (recordingStartRef.current === null) return;
      setRecordingElapsed((performance.now() - recordingStartRef.current) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [recorder.state]);

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

  // Keyboard shortcuts: Space=toggle, ←/→=frame-nav, R=record. Aktive
  // bare når player-root har fokus (eller fullscreen), så vi ikke
  // hijacker tastatur når brukeren skriver et annet sted i appen.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Hopp over når et input-element har fokus.
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      // Krev at fokus er på player-root eller fullscreen-stage.
      const root = playerRootRef.current;
      const isOurFocus =
        root && (root.contains(event.target as Node) || document.activeElement === document.body);
      if (!isOurFocus && !isFullscreen) return;

      if (event.code === 'Space') {
        event.preventDefault();
        player.toggle();
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        const next = Math.min(frames.length - 1, player.activeFrameIndex + 1);
        if (next !== player.activeFrameIndex) player.seekToFrame(next);
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        const prev = Math.max(0, player.activeFrameIndex - 1);
        if (prev !== player.activeFrameIndex) player.seekToFrame(prev);
      } else if (event.code === 'KeyR' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        if (recorder.isSupported) handleRecord();
      } else if (event.code === 'KeyF' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player, frames.length, recorder.isSupported, handleRecord, isFullscreen, toggleFullscreen]);

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

  // Preload bilder for de neste 2 frames så switch ikke flimrer.
  React.useEffect(() => {
    if (!hasFrames || player.activeFrameIndex < 0) return;
    const upcoming = [1, 2]
      .map((offset) => frames[player.activeFrameIndex + offset])
      .filter((f) => f && (f.imageUrl || f.thumbnailUrl));
    const preloaders: HTMLImageElement[] = [];
    for (const f of upcoming) {
      const img = new Image();
      img.src = (f.imageUrl || f.thumbnailUrl) as string;
      preloaders.push(img);
    }
    return () => {
      // GC tar seg av img-objektene; bare slipp referansene.
      preloaders.length = 0;
    };
  }, [frames, player.activeFrameIndex, hasFrames]);

  // Fullscreen: lytt på endringer i browser-state.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === stageContainerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = React.useCallback(async () => {
    if (typeof document === 'undefined') return;
    const el = stageContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    } else {
      try { await el.requestFullscreen(); } catch {}
    }
  }, []);

  // Cache av lastede bilder per src, så vi slipper å re-loade ved
  // hver redraw (kritisk når cross-fade trigger redraw på hver
  // RAF-tick).
  const imageCacheRef = React.useRef<Map<string, HTMLImageElement>>(new Map());

  const loadImage = React.useCallback((src: string): HTMLImageElement => {
    const cache = imageCacheRef.current;
    const existing = cache.get(src);
    if (existing) return existing;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    cache.set(src, img);
    return img;
  }, []);

  // Tegn aktivt frame (med valgfri cross-fade fra forrige frame) til
  // canvas. Canvas brukes som rendering-target og er capture-stream-
  // kilde for opptak. Effekten kjører på hver currentTime-tikk så
  // cross-fade går jevnt.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width !== STAGE_CANVAS_WIDTH) canvas.width = STAGE_CANVAS_WIDTH;
    if (canvas.height !== STAGE_CANVAS_HEIGHT) canvas.height = STAGE_CANVAS_HEIGHT;

    // Bakgrunn.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, STAGE_CANVAS_WIDTH, STAGE_CANVAS_HEIGHT);

    const segments = player.timeline.segments;
    const activeIdx = player.activeFrameIndex;
    if (activeIdx < 0 || segments.length === 0) return;
    const activeSeg = segments[activeIdx];
    const activeFrameMeta = frames[activeIdx];

    const drawPlaceholder = (frameMeta) => {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = frameMeta?.shotNumber
        ? `Shot ${frameMeta.shotNumber}`
        : `Frame ${segments.indexOf(activeSeg) + 1}`;
      ctx.fillText(label, STAGE_CANVAS_WIDTH / 2, STAGE_CANVAS_HEIGHT / 2 - 16);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText('Ingen tegning enda', STAGE_CANVAS_WIDTH / 2, STAGE_CANVAS_HEIGHT / 2 + 16);
    };

    const drawFitted = (img: HTMLImageElement, alpha: number) => {
      if (!img.complete || img.naturalWidth === 0) return false;
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
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x, y, drawW, drawH);
      ctx.globalAlpha = 1;
      return true;
    };

    const drawFrameOrPlaceholder = (frameMeta, alpha = 1) => {
      const src = frameMeta?.imageUrl || frameMeta?.thumbnailUrl;
      if (!src) {
        if (alpha === 1) drawPlaceholder(frameMeta);
        return;
      }
      const img = loadImage(src);
      if (img.complete && img.naturalWidth > 0) {
        drawFitted(img, alpha);
      } else {
        // Mens bildet laster: trigg re-render etter load (med en
        // tom dependency så vi ikke setter opp uendelige listeners).
        img.onload = () => {
          // Etter load: be om re-render via dummy state-bump om vi vil,
          // men currentTime endrer seg uansett ofte under playback. For
          // korrekthet ved pause: invalidate via canvas re-clear etter en
          // tick.
          requestAnimationFrame(() => {
            const c = canvasRef.current;
            if (!c) return;
            const cx = c.getContext('2d');
            if (!cx) return;
            // Tving full redraw ved å fyre en synthetisk no-op state
            // — i praksis enklere å bare re-tegne nå hvis frame fortsatt aktivt.
            const segNow = player.timeline.segments[player.activeFrameIndex];
            if (segNow && segNow === activeSeg) {
              drawFitted(img, 1);
            }
          });
        };
        // Placeholder mens den laster.
        if (alpha === 1) drawPlaceholder(frameMeta);
      }
    };

    // Cross-fade-vurdering: ligger vi i transitionDuration etter start
    // på et nytt segment? I så fall blend fra forrige segment.
    const timeInSeg = Math.max(0, player.currentTime - activeSeg.start);
    if (
      transitionDuration > 0 &&
      timeInSeg < transitionDuration &&
      activeIdx > 0
    ) {
      const prevFrameMeta = frames[activeIdx - 1];
      const progress = timeInSeg / transitionDuration; // 0..1
      drawFrameOrPlaceholder(prevFrameMeta, 1 - progress);
      drawFrameOrPlaceholder(activeFrameMeta, progress);
    } else {
      drawFrameOrPlaceholder(activeFrameMeta, 1);
    }
  }, [
    player.currentTime,
    player.activeFrameIndex,
    player.timeline,
    frames,
    transitionDuration,
    loadImage,
  ]);

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
      ref={playerRootRef}
      tabIndex={0}
      sx={{
        p: compact ? 1 : 1.5,
        borderRadius: 1.5,
        bgcolor: 'rgba(15,15,25,0.92)',
        border: '1px solid rgba(255,255,255,0.06)',
        outline: 'none',
        '&:focus-visible': { boxShadow: '0 0 0 2px rgba(165,180,252,0.4)' },
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <Movie sx={{ fontSize: 14, color: '#a5b4fc' }} />
        <Typography variant="overline" sx={{ fontSize: 10, letterSpacing: '0.08em', color: '#a5b4fc', fontWeight: 800 }}>
          Animatic-avspilling
        </Typography>
        {recorder.state === 'recording' && (
          <Stack direction="row" spacing={0.25} alignItems="center" sx={{ ml: 0.5 }} data-testid="animatic-rec-badge">
            <FiberManualRecord sx={{ fontSize: 10, color: '#f87171', animation: 'pulse 1.2s ease-in-out infinite' }} />
            <Typography variant="caption" sx={{ color: '#fca5a5', fontSize: 10, fontWeight: 600, fontFamily: 'monospace' }}>
              REC {formatTime(recordingElapsed)} / {formatTime(player.totalDuration)}
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
        ref={stageContainerRef}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: isFullscreen ? 'none' : stageMaxWidth,
          mx: 'auto',
          aspectRatio: isFullscreen ? 'auto' : String(aspectRatio),
          height: isFullscreen ? '100vh' : 'auto',
          bgcolor: '#000',
          borderRadius: isFullscreen ? 0 : 1,
          border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        data-testid="animatic-stage"
      >
        <canvas
          ref={canvasRef}
          width={STAGE_CANVAS_WIDTH}
          height={STAGE_CANVAS_HEIGHT}
          style={{
            width: isFullscreen ? 'auto' : '100%',
            height: isFullscreen ? '100%' : 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
          }}
          data-testid="animatic-stage-canvas"
        />
        {/* Fullscreen-toggle: synlig på hover av stage. */}
        <Tooltip title={isFullscreen ? 'Lukk fullskjerm (F)' : 'Fullskjerm (F)'}>
          <IconButton
            size="small"
            onClick={toggleFullscreen}
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              color: 'rgba(255,255,255,0.8)',
              bgcolor: 'rgba(0,0,0,0.4)',
              opacity: 0.6,
              '&:hover': { opacity: 1, bgcolor: 'rgba(0,0,0,0.6)' },
            }}
            data-testid="animatic-fullscreen"
          >
            {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Dialog-caption for aktivt frame — viser manuslinje(r) så
          artisten ser om dialog matcher visuelt tempo. */}
      {activeFrame?.caption && (
        <Box
          data-testid="animatic-caption"
          sx={{
            maxWidth: isFullscreen ? '70%' : stageMaxWidth,
            mx: 'auto',
            mb: 0.75,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(165,180,252,0.2)',
            textAlign: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.92)',
              fontSize: isFullscreen ? 14 : 11,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
            }}
          >
            {activeFrame.caption}
          </Typography>
        </Box>
      )}

      {/* Scrubber med frame-grenser som marker */}
      <Box sx={{ px: 1, mb: 0.5 }}>
        <Slider
          size="small"
          min={0}
          max={player.totalDuration}
          step={0.05}
          value={player.currentTime}
          onChange={(_, value) => player.seek(Array.isArray(value) ? value[0] : value)}
          marks={
            // Marks for hver frame-grense (utelater 0 og slutten for å unngå
            // dobbel-rendring med slider-endene).
            player.timeline.segments.slice(1).map((s) => ({ value: s.start }))
          }
          sx={{
            color: '#a5b4fc',
            '& .MuiSlider-mark': {
              height: 8,
              width: 1.5,
              bgcolor: 'rgba(255,255,255,0.35)',
            },
            '& .MuiSlider-markActive': {
              bgcolor: 'rgba(165,180,252,0.7)',
            },
          }}
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
