/**
 * FormationVideoPanel — video-spiller ved siden av Fabric-stage i FormationView.
 *
 * Wiring (Phase 4):
 *   1. Lytter på `dance:select-clip` CustomEvent fra ClipsSidebar (Phase 3a)
 *      og bytter source til den valgte clip'ens `signedUrl`.
 *   2. På `<video onTimeUpdate>` dispatcher vi `dance:video-time` så
 *      FormationView's eksisterende listener (linje 185-200) auto-velger
 *      formasjonen som matcher tidsrommet.
 *
 * Source-håndtering:
 *   - **HLS** (Cloudflare Stream `*.m3u8`): nativt på Safari/iOS via
 *     `video.canPlayType('application/vnd.apple.mpegurl')`. Chrome/Firefox
 *     bruker dynamisk-imported hls.js. Samme mønster som
 *     `role-room/components/PostVideoPreview.tsx` 144-198.
 *   - **Direct MP4/WebM/MOV**: native `<video src>`.
 *   - **YouTube/Vimeo iframe-URLer**: fallback til VideoRefPlayer uten
 *     time-sync (Phase 5+ wirer postMessage-bridge).
 *
 * Throttle: dispatch `dance:video-time` maks 10× per sekund — Fabric-canvas
 * trenger ikke høyere oppløsning enn det for å føles synkron, og det sparer
 * unødvendige re-renders i FormationView.
 *
 * Tom-state: "Velg en clip fra venstre kolonne" CTA.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  Movie as MovieIcon,
  PlayCircleOutline as PlayIcon,
} from '@mui/icons-material';

import VideoRefPlayer from './VideoRefPlayer';
import { SELECT_CLIP_EVENT, type SelectClipDetail } from './ClipsSidebar';
import { danceFlowColors } from './danceFlowTheme';

const VIDEO_TIME_EVENT = 'dance:video-time' as const;
const VIDEO_SEEK_EVENT = 'dance:video-seek' as const;
const DIRECT_VIDEO_PATTERN = /\.(mp4|webm|mov|m4v)(\?|$)/i;
const HLS_MANIFEST_PATTERN = /\.m3u8(\?|$)/i;
/** Maks 10 events per sekund (100ms throttle) — synkron nok for Fabric-canvas. */
const TIME_DISPATCH_THROTTLE_MS = 100;

type VideoSourceKind = 'hls' | 'direct' | 'embed' | 'unknown';

export interface FormationVideoPanelProps {
  /** Test-id-override. */
  'data-testid'?: string;
  /**
   * Skjul panel-header med "Video"-label + tittel. Brukes i
   * DanceAnnotate-context der videoens tittel allerede vises over rammen
   * og panel-header duplikeres med tids-overlayet vårt.
   */
  hideHeader?: boolean;
}

interface SelectedClip {
  clipId: string;
  signedUrl: string | null;
  title: string;
}

/**
 * HlsAttacher — wrap `<video>` med native HLS-fallback (Safari) eller
 * dynamisk hls.js-import (Chrome/Firefox). Samme mønster som
 * PostVideoPreview.tsx 144-198. For direct video-filer (mp4/webm/mov)
 * faller vi tilbake til å sette `.src` direkte uten hls.js.
 */
const HlsAttacher: React.FC<{
  src: string;
  videoElRef: React.MutableRefObject<HTMLVideoElement | null>;
  onTimeUpdate: () => void;
  testId: string;
}> = ({ src, videoElRef, onTimeUpdate, testId }) => {
  const localRef = React.useRef<HTMLVideoElement | null>(null);
  const [hlsError, setHlsError] = React.useState<string | null>(null);

  // Bind the ref opp til parent så throttle-logikken kan lese currentTime.
  const setRef = React.useCallback(
    (el: HTMLVideoElement | null): void => {
      localRef.current = el;
      videoElRef.current = el;
    },
    [videoElRef],
  );

  React.useEffect(() => {
    const video = localRef.current;
    if (!video) return;

    const isHls = HLS_MANIFEST_PATTERN.test(src) || src.toLowerCase().includes('/manifest/');
    if (!isHls) {
      // Direct file — bare sett src.
      video.src = src;
      return;
    }

    // Safari + iOS: HLS er nativt.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }

    // Chrome/Firefox: dynamisk-import hls.js så vi ikke bloater bundle.
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    void import('hls.js').then((mod) => {
      if (cancelled || !localRef.current) return;
      const Hls = mod.default;
      if (!Hls.isSupported()) {
        setHlsError('Nettleseren støtter ikke HLS-avspilling.');
        return;
      }
      const instance = new Hls();
      instance.loadSource(src);
      instance.attachMedia(localRef.current);
      hls = instance;
    }).catch(() => {
      if (!cancelled) setHlsError('Kunne ikke laste HLS-bibliotek (hls.js).');
    });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  if (hlsError) {
    return (
      <Box
        sx={{
          p: 2,
          color: danceFlowColors.errorPrimary,
          fontSize: '0.8125rem',
          textAlign: 'center',
        }}
        data-testid={`${testId}-error`}
      >
        {hlsError}
      </Box>
    );
  }

  return (
    <video
      ref={setRef}
      preload="metadata"
      onTimeUpdate={onTimeUpdate}
      data-testid={testId}
      // Workflow-audit G7: native controls skjult — vår TransportBar tar over
      // (vises under video-elementet). Vi beholder å rendre native som
      // fallback hvis nettleseren ikke har JS.
      controls={false}
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        display: 'block',
        backgroundColor: '#000',
      }}
    />
  );
};

function detectVideoSource(url: string | null): VideoSourceKind {
  if (!url) return 'unknown';
  try {
    const u = new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.href);
    const path = u.pathname.toLowerCase();
    if (HLS_MANIFEST_PATTERN.test(path)) return 'hls';
    // Cloudflare Stream-manifestet bruker ofte path som
    // /<id>/manifest/video.m3u8 — fanges av regex over. Hvis URL-en peker
    // til iframe.videodelivery.net / customer-*.cloudflarestream.com uten
    // .m3u8, er det iframe-embed (ingen onTimeUpdate-tilgang).
    const host = u.hostname.toLowerCase();
    if (host.includes('cloudflarestream.com') || host.includes('videodelivery.net')) {
      // /watch/<id> eller iframe-URL → embed
      return path.includes('manifest') ? 'hls' : 'embed';
    }
    if (DIRECT_VIDEO_PATTERN.test(path)) return 'direct';
    if (host.includes('youtube.com') || host === 'youtu.be' || host.includes('vimeo.com')) {
      return 'embed';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export default function FormationVideoPanel({
  'data-testid': testId = 'formation-video-panel',
  hideHeader = false,
}: FormationVideoPanelProps): React.ReactElement {
  const [selected, setSelected] = React.useState<SelectedClip | null>(null);
  const videoElRef = React.useRef<HTMLVideoElement | null>(null);
  const lastDispatchRef = React.useRef<number>(0);

  // Lytt på 'dance:select-clip' fra ClipsSidebar.
  React.useEffect(() => {
    const onSelect = (e: Event): void => {
      const detail = (e as CustomEvent<SelectClipDetail>).detail;
      if (!detail || typeof detail.clipId !== 'string') return;
      setSelected({
        clipId: detail.clipId,
        signedUrl: detail.signedUrl,
        title: detail.title,
      });
    };
    window.addEventListener(SELECT_CLIP_EVENT, onSelect as EventListener);
    return () => window.removeEventListener(SELECT_CLIP_EVENT, onSelect as EventListener);
  }, []);

  // Phase 5: lytt på 'dance:video-seek' fra FormationTimeline (ruler-klikk).
  // Setter video.currentTime — onTimeUpdate vil deretter dispatche
  // dance:video-time som lukker syklusen og oppdaterer playhead-cursor.
  React.useEffect(() => {
    const onSeek = (e: Event): void => {
      const detail = (e as CustomEvent<{ timeSec?: number }>).detail;
      const video = videoElRef.current;
      if (!video || !detail || typeof detail.timeSec !== 'number') return;
      // Tvinge gjennom seek selv om videoen ikke har metadata ennå.
      try {
        video.currentTime = Math.max(0, detail.timeSec);
      } catch {
        // Noen formater nekter seek før metadata er lastet — ignorer trygt.
      }
    };
    window.addEventListener(VIDEO_SEEK_EVENT, onSeek as EventListener);
    return () => window.removeEventListener(VIDEO_SEEK_EVENT, onSeek as EventListener);
  }, []);

  const handleTimeUpdate = React.useCallback((): void => {
    const el = videoElRef.current;
    if (!el) return;
    const now = Date.now();
    if (now - lastDispatchRef.current < TIME_DISPATCH_THROTTLE_MS) return;
    lastDispatchRef.current = now;
    window.dispatchEvent(
      new CustomEvent(VIDEO_TIME_EVENT, {
        detail: { currentTime: el.currentTime },
      }),
    );
  }, []);

  const sourceKind = detectVideoSource(selected?.signedUrl ?? null);

  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bgcolor: danceFlowColors.bgPanel,
        border: `1px solid ${danceFlowColors.borderStrong}`,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Panel-header — skjules i DanceAnnotate-context (hideHeader=true) */}
      {hideHeader ? null : (
      <Box
        sx={{
          px: 1.25,
          py: 0.5,
          borderBottom: `1px solid ${danceFlowColors.borderStrong}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minHeight: 28,
        }}
      >
        <PlayIcon sx={{ fontSize: 14, color: danceFlowColors.lavender }} />
        <Typography
          variant="overline"
          sx={{
            color: danceFlowColors.textMuted,
            fontWeight: 700,
            letterSpacing: 1,
            lineHeight: 1.5,
          }}
        >
          Video
        </Typography>
        {selected ? (
          <Typography
            variant="caption"
            sx={{
              color: danceFlowColors.textSecondary,
              ml: 'auto',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 240,
            }}
            data-testid={`${testId}-title`}
          >
            {selected.title}
          </Typography>
        ) : null}
      </Box>
      )}

      {/* Body */}
      <Box
        sx={{
          flex: 1,
          minHeight: 200,
          bgcolor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {!selected ? (
          <Stack alignItems="center" spacing={1} sx={{ p: 2 }}>
            <MovieIcon sx={{ fontSize: 32, color: danceFlowColors.textDisabled }} />
            <Typography
              variant="body2"
              sx={{
                color: danceFlowColors.textMuted,
                textAlign: 'center',
                fontSize: '0.8125rem',
              }}
              data-testid={`${testId}-empty`}
            >
              Velg en clip fra venstre kolonne for å spille av.
            </Typography>
          </Stack>
        ) : selected.signedUrl && (sourceKind === 'hls' || sourceKind === 'direct') ? (
          // HLS (Cloudflare Stream m3u8) eller direct mp4/webm/mov → egen
          // <video> så onTimeUpdate dispatcher dance:video-time for sync med
          // Fabric-canvas. HlsAttacher håndterer både Safari-native og
          // dynamisk hls.js-import for Chrome/Firefox.
          <HlsAttacher
            key={selected.clipId} /* reset ved klipp-bytte */
            src={selected.signedUrl}
            videoElRef={videoElRef}
            onTimeUpdate={handleTimeUpdate}
            testId={`${testId}-video`}
          />
        ) : selected.signedUrl && sourceKind === 'embed' ? (
          // YouTube/Vimeo eller Cloudflare Stream iframe-URL — VideoRefPlayer
          // håndterer dette. Ingen time-sync (Phase 5+ wirer postMessage-bridge).
          <Box sx={{ p: 1, width: '100%' }}>
            <VideoRefPlayer url={selected.signedUrl} height={240} />
          </Box>
        ) : (
          <Typography
            variant="caption"
            sx={{ color: danceFlowColors.errorPrimary, p: 2 }}
            data-testid={`${testId}-no-url`}
          >
            Klippet mangler avspilbar URL — last opp på nytt eller sjekk
            backend.
          </Typography>
        )}
      </Box>

      {/* Workflow-audit G7: custom transport-bar. Vises bare når en spillbar
          clip er valgt (HLS/direct). Embed-fallback (YouTube/Vimeo) bruker
          VideoRefPlayer sin egen native controls. */}
      {selected && selected.signedUrl && (sourceKind === 'hls' || sourceKind === 'direct') ? (
        <TransportBar videoElRef={videoElRef} testId={`${testId}-transport`} />
      ) : null}
    </Box>
  );
}

/**
 * Workflow-audit G7: Profesjonell transport-bar matching NLE-konvensjon.
 * Branche-standard keybinds: space (play/pause), J/K/L (rewind/pause/play),
 * comma/period (frame-by-frame), pil-venstre/høyre (±5s), 0-9 (sett speed).
 *
 * Reads/writes til videoElRef direkte — ingen state-duplisering i React.
 * Lokal state holder bare UI-rendring (play-state, currentTime, duration,
 * playbackRate), syncet via 'play'/'pause'/'timeupdate'/'durationchange'/
 * 'ratechange'-events fra video-elementet.
 */
const TRANSPORT_SKIP_SEC = 5;
const TRANSPORT_FRAME_SEC = 1 / 30; // ~33ms — 30fps default
const TRANSPORT_SPEEDS = [0.25, 0.5, 1.0, 1.5, 2.0] as const;

const TransportBar: React.FC<{
  videoElRef: React.MutableRefObject<HTMLVideoElement | null>;
  testId: string;
}> = ({ videoElRef, testId }) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState<number>(0);
  const [playbackRate, setPlaybackRate] = React.useState<number>(1);

  // Sync UI-state med video-element-events.
  React.useEffect(() => {
    const video = videoElRef.current;
    if (!video) return;
    const onPlay = (): void => setIsPlaying(true);
    const onPause = (): void => setIsPlaying(false);
    const onTime = (): void => setCurrentTime(video.currentTime);
    const onDuration = (): void => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onRate = (): void => setPlaybackRate(video.playbackRate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('ratechange', onRate);
    // Initial sync (i tilfelle vi mountes etter at video har lastet)
    setIsPlaying(!video.paused);
    setCurrentTime(video.currentTime);
    if (Number.isFinite(video.duration)) setDuration(video.duration);
    setPlaybackRate(video.playbackRate);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('ratechange', onRate);
    };
  }, [videoElRef]);

  const togglePlay = React.useCallback((): void => {
    const v = videoElRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, [videoElRef]);

  const skip = React.useCallback((deltaSec: number): void => {
    const v = videoElRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min((duration || 0) + 60, v.currentTime + deltaSec));
  }, [videoElRef, duration]);

  const setSpeed = React.useCallback((rate: number): void => {
    const v = videoElRef.current;
    if (!v) return;
    v.playbackRate = rate;
  }, [videoElRef]);

  const handleScrub = React.useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const v = videoElRef.current;
    if (!v) return;
    const next = Number(e.target.value);
    if (!Number.isFinite(next)) return;
    v.currentTime = next;
  }, [videoElRef]);

  // Keyboard bindings — globalt på window, men respekt input-fokus.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      const v = videoElRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (v.paused) void v.play().catch(() => {});
          else v.pause();
          break;
        case 'j':
        case 'J':
          v.currentTime = Math.max(0, v.currentTime - TRANSPORT_SKIP_SEC);
          break;
        case 'k':
        case 'K':
          v.pause();
          break;
        case 'l':
        case 'L':
          if (v.paused) void v.play().catch(() => {});
          else v.playbackRate = Math.min(2.0, v.playbackRate + 0.5);
          break;
        case ',':
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - TRANSPORT_FRAME_SEC);
          break;
        case '.':
          e.preventDefault();
          v.currentTime = v.currentTime + TRANSPORT_FRAME_SEC;
          break;
        case 'ArrowLeft':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            v.currentTime = Math.max(0, v.currentTime - TRANSPORT_SKIP_SEC);
          }
          break;
        case 'ArrowRight':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            v.currentTime = v.currentTime + TRANSPORT_SKIP_SEC;
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoElRef]);

  const fmt = (sec: number): string => {
    const total = Math.max(0, Math.floor(sec));
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    const ff = Math.floor((sec - total) * 30); // 30fps default
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
  };

  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        px: 1.25,
        py: 0.75,
        borderTop: `1px solid ${danceFlowColors.borderStrong}`,
        bgcolor: danceFlowColors.bgPanel,
      }}
    >
      {/* Scrubber */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={TRANSPORT_FRAME_SEC}
          value={currentTime}
          onChange={handleScrub}
          aria-label="Video scrubber"
          data-testid={`${testId}-scrub`}
          style={{ flex: 1, accentColor: '#a78bfa', cursor: 'pointer' }}
        />
      </Box>
      {/* Kontroller */}
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <button
          type="button"
          onClick={() => skip(-TRANSPORT_SKIP_SEC)}
          data-testid={`${testId}-back`}
          title="Back 5s (J / ←)"
          style={{
            background: 'transparent', border: 'none', color: danceFlowColors.textSecondary,
            cursor: 'pointer', fontSize: 14, padding: '2px 4px',
          }}
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={togglePlay}
          data-testid={`${testId}-play`}
          aria-pressed={isPlaying}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          style={{
            background: 'transparent', border: 'none', color: danceFlowColors.lavender,
            cursor: 'pointer', fontSize: 18, padding: '2px 6px', fontWeight: 700,
          }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          onClick={() => skip(TRANSPORT_SKIP_SEC)}
          data-testid={`${testId}-fwd`}
          title="Forward 5s (L / →)"
          style={{
            background: 'transparent', border: 'none', color: danceFlowColors.textSecondary,
            cursor: 'pointer', fontSize: 14, padding: '2px 4px',
          }}
        >
          ⏭
        </button>
        {/* Speed-select */}
        <Box sx={{ ml: 0.5 }}>
          <select
            value={playbackRate}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Playback speed"
            data-testid={`${testId}-speed`}
            style={{
              background: danceFlowColors.bgInset,
              color: danceFlowColors.textSecondary,
              border: `1px solid ${danceFlowColors.borderSoft}`,
              borderRadius: 4, fontSize: 11, padding: '2px 4px',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            {TRANSPORT_SPEEDS.map((s) => (
              <option key={s} value={s}>{s.toFixed(2)}x</option>
            ))}
          </select>
        </Box>
        {/* Tids-display */}
        <Typography
          data-testid={`${testId}-timecode`}
          sx={{
            ml: 'auto', fontSize: 11, fontWeight: 600,
            color: danceFlowColors.textSecondary,
            fontVariantNumeric: 'tabular-nums', letterSpacing: 0.5,
          }}
        >
          {fmt(currentTime)} / {fmt(duration)}
        </Typography>
      </Stack>
    </Box>
  );
};
