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
      controls
      preload="metadata"
      onTimeUpdate={onTimeUpdate}
      data-testid={testId}
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
      {/* Panel-header */}
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
    </Box>
  );
}
