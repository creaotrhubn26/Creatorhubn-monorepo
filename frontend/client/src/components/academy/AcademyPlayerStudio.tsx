import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, IconButton, Slider, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import {
  Fullscreen,
  FullscreenExit,
  Pause,
  PlayArrow,
  Subtitles,
  SubtitlesOff,
  VolumeOff,
  VolumeUp,
} from '@mui/icons-material';

interface AcademyPlayerStudioProps {
  src: string;
  poster?: string;
  captionTrackSrc?: string;
  captionTrackLang?: string;
  captionTrackLabel?: string;
  videoRef?: React.RefObject<HTMLVideoElement>;
  onLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
  onTimeUpdate?: React.ReactEventHandler<HTMLVideoElement>;
  onPlay?: React.ReactEventHandler<HTMLVideoElement>;
  onPause?: React.ReactEventHandler<HTMLVideoElement>;
  muted?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  controls?: boolean;
  objectFit?: React.CSSProperties['objectFit'];
  objectPosition?: React.CSSProperties['objectPosition'];
  posterZoom?: number;
  containerSx?: SxProps<Theme>;
  videoStyle?: React.CSSProperties;
  studioControls?: boolean;
  controlsExtra?: React.ReactNode;
  onStudioControlAction?: (action: string, payload?: Record<string, unknown>) => void;
  children?: React.ReactNode;
}

const defaultContainerSx: SxProps<Theme> = {
  borderRadius: 1,
  overflow: 'hidden',
  border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.08)',
  position: 'relative',
  aspectRatio: '16 / 9',
  background:
    'radial-gradient(circle at 70% 16%, rgba(248,179,33,0.18), rgba(9,12,18,0) 46%), linear-gradient(145deg, rgba(20,24,35,0.96), rgba(9,12,18,0.96))',
};

const PLAYER_PREFS_KEY = 'academy_player_studio_prefs_v1';
const FRAME_STEP_SECONDS = 1 / 30;

const formatPlayerTime = (seconds: number): string => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const readPlayerPrefs = (): Partial<{
  volume: number;
  muted: boolean;
  playbackRate: number;
  captionsEnabled: boolean;
}> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PLAYER_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      volume: Number(parsed.volume),
      muted: Boolean(parsed.muted),
      playbackRate: Number(parsed.playbackRate),
      captionsEnabled: Boolean(parsed.captionsEnabled),
    };
  } catch {
    return {};
  }
};

const writePlayerPrefs = (prefs: {
  volume: number;
  muted: boolean;
  playbackRate: number;
  captionsEnabled: boolean;
}) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLAYER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore local storage failures
  }
};

function AcademyPlayerStudio({
  src,
  poster,
  captionTrackSrc,
  captionTrackLang = 'en',
  captionTrackLabel = 'Captions',
  videoRef,
  onLoadedMetadata,
  onTimeUpdate,
  onPlay,
  onPause,
  muted,
  autoPlay = false,
  loop = false,
  controls = false,
  objectFit = 'cover',
  objectPosition = '50% 50%',
  posterZoom = 100,
  containerSx,
  videoStyle,
  studioControls = true,
  controlsExtra,
  onStudioControlAction,
  children,
}: AcademyPlayerStudioProps) {
  const fallbackVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [posterVisible, setPosterVisible] = useState(Boolean(poster));
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(Boolean(muted));
  const [volume, setVolume] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const resolvedContainerSx: SxProps<Theme> = Array.isArray(containerSx)
    ? ([defaultContainerSx, ...containerSx] as SxProps<Theme>)
    : containerSx
      ? ([defaultContainerSx, containerSx] as SxProps<Theme>)
      : defaultContainerSx;

  useEffect(() => {
    setPosterVisible(Boolean(poster));
  }, [poster]);

  useEffect(() => {
    const prefs = readPlayerPrefs();
    if (Number.isFinite(prefs.volume)) {
      setVolume(Math.max(0, Math.min(100, Number(prefs.volume))));
    }
    if (typeof prefs.muted === 'boolean') {
      setIsMuted(prefs.muted);
    }
    if (Number.isFinite(prefs.playbackRate)) {
      setPlaybackRate(Math.max(0.5, Math.min(2, Number(prefs.playbackRate))));
    }
    if (typeof prefs.captionsEnabled === 'boolean') {
      setCaptionsEnabled(prefs.captionsEnabled);
    }
  }, []);

  useEffect(() => {
    writePlayerPrefs({
      volume: Math.max(0, Math.min(100, volume)),
      muted: isMuted,
      playbackRate: Math.max(0.5, Math.min(2, playbackRate)),
      captionsEnabled,
    });
  }, [captionsEnabled, isMuted, playbackRate, volume]);

  useEffect(() => {
    if (typeof muted !== 'boolean') return;
    setIsMuted(muted);
    const video = videoRef?.current || fallbackVideoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted, videoRef]);

  useEffect(() => {
    const video = videoRef?.current || fallbackVideoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, volume / 100));
    video.muted = isMuted;
  }, [isMuted, videoRef, volume]);

  useEffect(() => {
    const video = videoRef?.current || fallbackVideoRef.current;
    if (!video) return;
    setDuration(Number.isFinite(video.duration) ? Math.max(0, video.duration) : 0);
    setCurrentTime(Math.max(0, video.currentTime || 0));
    setIsPlaying(!video.paused && !video.ended);
    setIsMuted(Boolean(video.muted));
    setVolume(Math.round((video.volume || 0) * 100));
  }, [src, videoRef]);

  useEffect(() => {
    const video = videoRef?.current || fallbackVideoRef.current;
    if (!video) return;
    video.playbackRate = Math.max(0.5, Math.min(2, playbackRate));
  }, [playbackRate, videoRef]);

  useEffect(() => {
    const video = videoRef?.current || fallbackVideoRef.current;
    if (!video) return;
    const tracks = Array.from(video.textTracks || []);
    tracks.forEach((track) => {
      track.mode = captionsEnabled ? 'showing' : 'hidden';
    });
  }, [captionTrackSrc, captionsEnabled, src, videoRef]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement && document.fullscreenElement === containerRef.current));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const emitControlAction = useCallback(
    (action: string, payload?: Record<string, unknown>) => {
      onStudioControlAction?.(action, payload);
    },
    [onStudioControlAction],
  );

  const setPlayerTime = useCallback(
    (nextTime: number) => {
      const video = videoRef?.current || fallbackVideoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(Number.isFinite(duration) ? duration : 0, nextTime));
      video.currentTime = clamped;
      setCurrentTime(clamped);
      emitControlAction('seek', { currentTime: clamped });
    },
    [duration, emitControlAction, videoRef],
  );

  const setPlayerVolume = useCallback(
    (nextVolumePercent: number) => {
      const video = videoRef?.current || fallbackVideoRef.current;
      if (!video) return;
      const clamped = Math.max(0, Math.min(100, nextVolumePercent));
      video.volume = clamped / 100;
      video.muted = clamped === 0;
      setVolume(clamped);
      setIsMuted(video.muted);
      emitControlAction('volume', { volume: clamped, muted: video.muted });
    },
    [emitControlAction],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef?.current || fallbackVideoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => undefined);
      return;
    }
    video.pause();
  }, [videoRef]);

  const handleSeek = useCallback(
    (_event: Event, value: number | number[]) => {
      const nextTime = Array.isArray(value) ? Number(value[0] || 0) : Number(value || 0);
      setPlayerTime(nextTime);
    },
    [setPlayerTime],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef?.current || fallbackVideoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    emitControlAction(video.muted ? 'mute' : 'unmute');
  }, [emitControlAction, videoRef]);

  const handleVolume = useCallback(
    (_event: Event, value: number | number[]) => {
      const nextValue = Array.isArray(value) ? Number(value[0] || 0) : Number(value || 0);
      setPlayerVolume(nextValue);
    },
    [setPlayerVolume],
  );

  const adjustPlaybackRate = useCallback(
    (delta: number) => {
      setPlaybackRate((prev) => {
        const next = Math.max(0.5, Math.min(2, Math.round((prev + delta) * 10) / 10));
        emitControlAction('playback-rate', { playbackRate: next });
        return next;
      });
    },
    [emitControlAction],
  );

  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((prev) => {
      const next = !prev;
      emitControlAction('captions', { enabled: next });
      return next;
    });
  }, [emitControlAction]);

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const video = videoRef?.current || fallbackVideoRef.current;
      if (!video) return;
      const next = Math.max(
        0,
        Math.min(
          Number.isFinite(duration) ? duration : Number.MAX_SAFE_INTEGER,
          (video.currentTime || 0) + direction * FRAME_STEP_SECONDS,
        ),
      );
      video.currentTime = next;
      setCurrentTime(next);
      emitControlAction('frame-step', { direction, currentTime: next });
    },
    [duration, emitControlAction, videoRef],
  );

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container || typeof document === 'undefined') return;

    if (document.fullscreenElement === container) {
      void document.exitFullscreen?.();
      emitControlAction('fullscreen-exit');
      return;
    }
    void container.requestFullscreen?.();
    emitControlAction('fullscreen-enter');
  }, [emitControlAction]);

  const showStudioControls = studioControls && !controls;
  const hotkeysEnabled = showStudioControls && (isFocused || isHovered);

  const handleHotkey = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!hotkeysEnabled) return;
      const target = event.target as HTMLElement | null;
      const tag = String(target?.tagName || '').toLowerCase();
      const isTypingContext =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        Boolean(target?.isContentEditable);
      if (isTypingContext) return;

      const key = event.key.toLowerCase();
      if (key === ' ' || key === 'k') {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (key === 'j') {
        event.preventDefault();
        setPlayerTime(Math.max(0, currentTime - 10));
        return;
      }
      if (key === 'l') {
        event.preventDefault();
        setPlayerTime(Math.min(Math.max(1, duration), currentTime + 10));
        return;
      }
      if (key === 'arrowleft') {
        event.preventDefault();
        setPlayerTime(Math.max(0, currentTime - 5));
        return;
      }
      if (key === 'arrowright') {
        event.preventDefault();
        setPlayerTime(Math.min(Math.max(1, duration), currentTime + 5));
        return;
      }
      if (key === 'arrowup') {
        event.preventDefault();
        setPlayerVolume(Math.min(100, (isMuted ? 0 : volume) + 5));
        return;
      }
      if (key === 'arrowdown') {
        event.preventDefault();
        setPlayerVolume(Math.max(0, (isMuted ? 0 : volume) - 5));
        return;
      }
      if (key === 'm') {
        event.preventDefault();
        toggleMute();
        return;
      }
      if (key === 'f') {
        event.preventDefault();
        toggleFullscreen();
        return;
      }
      if (key === ',') {
        event.preventDefault();
        const video = videoRef?.current || fallbackVideoRef.current;
        if (video && video.paused) {
          stepFrame(-1);
        }
        return;
      }
      if (key === '.') {
        event.preventDefault();
        const video = videoRef?.current || fallbackVideoRef.current;
        if (video && video.paused) {
          stepFrame(1);
        }
        return;
      }
      if (key === '[') {
        event.preventDefault();
        adjustPlaybackRate(-0.1);
        return;
      }
      if (key === ']') {
        event.preventDefault();
        adjustPlaybackRate(0.1);
      }
    },
    [
      adjustPlaybackRate,
      currentTime,
      duration,
      hotkeysEnabled,
      isMuted,
      setPlayerTime,
      setPlayerVolume,
      stepFrame,
      toggleFullscreen,
      toggleMute,
      togglePlay,
      videoRef,
      volume,
    ],
  );

  const resolvedPlaybackLabel = useMemo(
    () => `${Math.max(0.5, Math.min(2, playbackRate)).toFixed(1)}x`,
    [playbackRate],
  );

  return (
    <Box
      ref={containerRef}
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && containerRef.current?.contains(nextTarget)) return;
        setIsFocused(false);
      }}
      onKeyDown={handleHotkey}
      sx={
        Array.isArray(resolvedContainerSx)
          ? [...resolvedContainerSx, { outline: 'none' }]
          : [resolvedContainerSx, { outline: 'none' }]
      }
    >
      {poster && posterVisible && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            backgroundImage: `linear-gradient(180deg, rgba(8,11,18,0.16), rgba(8,11,18,0.44)), url(${poster})`,
            backgroundPosition: `center, ${objectPosition}`,
            backgroundSize: `cover, ${Math.max(100, Math.min(220, posterZoom))}%`,
            backgroundRepeat: 'no-repeat, no-repeat',
            pointerEvents: 'none',
          }}
        />
      )}
      <video
        ref={videoRef || fallbackVideoRef}
        src={src}
        poster={poster}
        muted={Boolean(muted ?? isMuted)}
        autoPlay={autoPlay}
        loop={loop}
        controls={controls}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={(event) => {
          setCurrentTime(Math.max(0, event.currentTarget.currentTime || 0));
          onTimeUpdate?.(event);
        }}
        onPlay={(event) => {
          setPosterVisible(false);
          setIsPlaying(true);
          emitControlAction('play');
          onPlay?.(event);
        }}
        onPause={(event) => {
          if (poster) setPosterVisible(true);
          setIsPlaying(false);
          emitControlAction('pause');
          onPause?.(event);
        }}
        onDurationChange={(event) => {
          setDuration(Math.max(0, Number(event.currentTarget.duration) || 0));
        }}
        style={{
          position: 'relative',
          zIndex: 0,
          width: '100%',
          height: '100%',
          objectFit,
          objectPosition,
          display: 'block',
          transform: 'none',
          ...videoStyle,
        }}
      >
        {captionTrackSrc ? (
          <track
            key={`${captionTrackSrc}:${captionTrackLang}`}
            kind="captions"
            src={captionTrackSrc}
            srcLang={captionTrackLang}
            label={captionTrackLabel}
          />
        ) : null}
      </video>
      {children ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
          }}
        >
          {children}
        </Box>
      ) : null}
      {showStudioControls && (
        <Box
          sx={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 10,
            zIndex: 3,
            pointerEvents: 'none',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={0.8}
            alignItems={{ xs: 'stretch', md: 'center' }}
            sx={{
              borderRadius: 1,
              px: 0.85,
              py: 0.7,
              border: 'var(--academy-hairline-width, 1px) solid rgba(255,255,255,0.2)',
              background:
                'linear-gradient(180deg, rgba(8,13,22,0.58), rgba(6,10,18,0.74))',
              backdropFilter: 'blur(5px)',
              boxShadow: '0 8px 20px rgba(0,0,0,0.32)',
              pointerEvents: 'auto',
            }}
          >
            <Stack direction="row" spacing={0.4} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <IconButton
                size="small"
                onClick={togglePlay}
                sx={{ color: '#edf0f7' }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
              </IconButton>
              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.88)', minWidth: 42 }}>
                {formatPlayerTime(currentTime)}
              </Typography>
              <Slider
                min={0}
                max={Math.max(1, duration)}
                value={Math.min(Math.max(0, currentTime), Math.max(1, duration))}
                onChange={handleSeek}
                sx={{
                  mx: 0.5,
                  color: '#f8b321',
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12,
                  },
                }}
              />
              <Typography sx={{ fontSize: 12, color: 'rgba(237,240,247,0.72)', minWidth: 42, textAlign: 'right' }}>
                {formatPlayerTime(duration)}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.4} alignItems="center">
              {controlsExtra}
              <Button
                size="small"
                variant="outlined"
                onClick={() => adjustPlaybackRate(playbackRate >= 2 ? -1.5 : 0.1)}
                sx={{
                  minWidth: 54,
                  px: 0.75,
                  textTransform: 'none',
                  color: '#edf0f7',
                  borderColor: 'rgba(255,255,255,0.26)',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {resolvedPlaybackLabel}
              </Button>
              <IconButton
                size="small"
                onClick={toggleCaptions}
                sx={{ color: captionsEnabled ? '#f8d675' : 'rgba(237,240,247,0.88)' }}
                aria-label={captionsEnabled ? 'Disable captions' : 'Enable captions'}
              >
                {captionsEnabled ? <Subtitles fontSize="small" /> : <SubtitlesOff fontSize="small" />}
              </IconButton>
              <IconButton
                size="small"
                onClick={toggleMute}
                sx={{ color: 'rgba(237,240,247,0.88)' }}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume <= 0 ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
              </IconButton>
              <Slider
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={handleVolume}
                sx={{
                  width: 90,
                  color: '#8eb8ff',
                  '& .MuiSlider-thumb': {
                    width: 10,
                    height: 10,
                  },
                }}
              />
              <IconButton
                size="small"
                onClick={toggleFullscreen}
                sx={{ color: 'rgba(237,240,247,0.88)' }}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
              </IconButton>
            </Stack>
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export default AcademyPlayerStudio;
