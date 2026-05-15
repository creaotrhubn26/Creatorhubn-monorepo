/**
 * VideoFeed.tsx
 *
 * Video-receiver-komponent som spiller live-feed fra kamera. Støtter
 * flere transport-protokoller med fallback-kjede:
 *
 *   1. WebRTC  — laveste latens (<200ms). Krever signaling-server (LiveKit/Mediasoup)
 *                eller direct peer (kamera må støtte WebRTC, sjelden hardware-side)
 *   2. HLS     — moderate latens (2-10s) via hls.js. Krever media-server som
 *                tar SDI/NDI/RTMP fra kamera og transcoder til HLS-segments.
 *                Anbefalt: MediaMTX (open source, takes RTMP+SRT+RTSP→HLS)
 *   3. MJPEG   — fungerer direkte mot Canon CCAPI's /shooting/liveview-endpoint
 *                men er JPEG-frames, ikke ekte video. Lavere kvalitet.
 *   4. Poll    — siste-frame-snapshot fra /api/ccapi/cameras/:ip/contents
 *                + downloadContent. Brukes for "still capture review"-modus.
 *   5. Mock    — placeholder gradient når ingen feed er konfigurert
 *
 * Komponenten velger første tilgjengelige protokoll automatisk, eller
 * brukeren kan tvinge en valgt protokoll via props.
 *
 * For Canon: feed='hls' eller 'mjpeg' fra MediaMTX-instans som mottar
 * kameraets HDMI-output via Decklink/AJA-kort. CCAPI's liveview-endpoint
 * (vises i inventory som /shooting/liveview/flip) gir bare JPEG-frames
 * — bra for thumbnails, dårlig for full-frame preview.
 */

import React from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';

export type VideoFeedTransport = 'webrtc' | 'hls' | 'mjpeg' | 'poll' | 'mock';

export interface VideoFeedSource {
  /** Hvilken protokoll skal brukes. Default: auto-detect i rekkefølgen over. */
  transport?: VideoFeedTransport;
  /** WebRTC: signaling-server URL */
  webrtcUrl?: string;
  /** HLS: .m3u8 manifest URL */
  hlsUrl?: string;
  /** MJPEG: <img>-stream URL */
  mjpegUrl?: string;
  /** Poll: CCAPI camera IP for snapshot-pulling */
  ccapiCameraIp?: string;
  /** Poll: hvor ofte vi spør om ny snapshot (ms) */
  pollIntervalMs?: number;
}

export interface VideoFeedProps {
  source: VideoFeedSource;
  cameraLabel?: string;
  /** Vises som overlay i hjørnet — for "RECORDING"-indikator etc. */
  overlayBadge?: React.ReactNode;
  /** Klikk-handler for overlay (f.eks. bytt PROGRAM-source) */
  onClick?: () => void;
  /** Fullscreen-trigger */
  onFullscreen?: () => void;
}

// ─────────────────────────────────────────────────────────────────────
// HLS-impl (krever hls.js dynamic-imported så det ikke bloater bundle
// for brukere som ikke trenger video)
// ─────────────────────────────────────────────────────────────────────

function useHlsPlayer(videoRef: React.RefObject<HTMLVideoElement | null>, hlsUrl: string | undefined) {
  React.useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;

    // Native HLS-support (Safari/iOS) — bare sett src
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      return () => {
        video.src = '';
      };
    }

    // Chrome/Firefox: bruk hls.js
    let hlsInstance: { destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const HlsModule = await import('hls.js');
        const Hls = HlsModule.default;
        if (cancelled || !Hls.isSupported()) return;
        const hls = new Hls({ lowLatencyMode: true, liveSyncDuration: 1.5 });
        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
        hlsInstance = hls;
      } catch (err) {
        console.warn('[VideoFeed] hls.js not installed — install with: npm i hls.js', err);
      }
    })();

    return () => {
      cancelled = true;
      hlsInstance?.destroy();
      video.src = '';
    };
  }, [hlsUrl, videoRef]);
}

// ─────────────────────────────────────────────────────────────────────
// Poll-impl: hent siste snapshot fra CCAPI hvert N sekund
// ─────────────────────────────────────────────────────────────────────

function useCcapiPolling(
  ccapiCameraIp: string | undefined,
  intervalMs: number,
  setSnapshotUrl: (url: string | null) => void,
) {
  React.useEffect(() => {
    if (!ccapiCameraIp) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const pollOnce = async () => {
      try {
        // /api/ccapi/cameras/:ip/poll returnerer { polling: { addedcontents: [...] } }
        // Real impl ville pollet, fått siste content-URL, og downloadet via
        // /api/ccapi/cameras/:ip/contents/download?url=...&kind=display
        // For nå: stub. Real wiring kommer når backend støtter content-download.
        if (!cancelled) {
          setSnapshotUrl(null);
        }
      } catch (err) {
        console.warn('[VideoFeed] CCAPI poll failed:', err);
      } finally {
        if (!cancelled) {
          timer = setTimeout(pollOnce, intervalMs);
        }
      }
    };

    void pollOnce();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ccapiCameraIp, intervalMs, setSnapshotUrl]);
}

// ─────────────────────────────────────────────────────────────────────
// VideoFeed-komponent
// ─────────────────────────────────────────────────────────────────────

export const VideoFeed: React.FC<VideoFeedProps> = ({
  source,
  cameraLabel,
  overlayBadge,
  onClick,
  onFullscreen: _onFullscreen,
}) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [snapshotUrl, setSnapshotUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Auto-detect transport hvis ikke spesifisert
  const transport: VideoFeedTransport =
    source.transport ??
    (source.webrtcUrl
      ? 'webrtc'
      : source.hlsUrl
        ? 'hls'
        : source.mjpegUrl
          ? 'mjpeg'
          : source.ccapiCameraIp
            ? 'poll'
            : 'mock');

  useHlsPlayer(videoRef, transport === 'hls' ? source.hlsUrl : undefined);
  useCcapiPolling(
    transport === 'poll' ? source.ccapiCameraIp : undefined,
    source.pollIntervalMs ?? 2000,
    setSnapshotUrl,
  );

  // WebRTC-impl er stub — krever signaling-server. Logger varsel
  React.useEffect(() => {
    if (transport === 'webrtc') {
      setError('WebRTC krever signaling-server (LiveKit/Mediasoup) — ikke wired ennå');
    }
  }, [transport]);

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        bgcolor: '#000',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
      }}
    >
      {/* HLS — bruk <video> direkte */}
      {transport === 'hls' && source.hlsUrl && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* MJPEG — <img>-tag som auto-refresher (HTTP mjpeg-stream-konvensjon) */}
      {transport === 'mjpeg' && source.mjpegUrl && (
        <img
          src={source.mjpegUrl}
          alt={cameraLabel ?? 'Camera feed'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Poll — snapshot fra CCAPI */}
      {transport === 'poll' && snapshotUrl && (
        <img
          src={snapshotUrl}
          alt={cameraLabel ?? 'Camera snapshot'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Mock / fallback */}
      {(transport === 'mock' || transport === 'webrtc' || (transport === 'poll' && !snapshotUrl)) && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(60,40,30,0.6), rgba(20,15,10,0.95))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <VideocamOffIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.2)' }} />
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
            {transport === 'mock' ? 'INGEN VIDEO-FEED KONFIGURERT' : 'KOBLER TIL…'}
          </Typography>
        </Box>
      )}

      {/* Transport-badge */}
      <Chip
        icon={<SignalCellularAltIcon sx={{ fontSize: 12 }} />}
        label={transport.toUpperCase()}
        size="small"
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          height: 18,
          fontSize: 9,
          fontWeight: 700,
          bgcolor: 'rgba(0,0,0,0.6)',
          color: transport === 'mock' ? 'rgba(255,255,255,0.4)' : '#86efac',
          '& .MuiChip-icon': { color: 'inherit' },
        }}
      />

      {/* Cam-label */}
      {cameraLabel && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            bgcolor: 'rgba(0,0,0,0.6)',
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
          }}
        >
          <Typography sx={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
            {cameraLabel}
          </Typography>
        </Box>
      )}

      {/* Overlay-badge (recording etc.) */}
      {overlayBadge && (
        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
          {overlayBadge}
        </Box>
      )}

      {/* Error overlay */}
      {error && (
        <Box sx={{ position: 'absolute', bottom: 32, left: 8, right: 80 }}>
          <Alert
            severity="warning"
            sx={{
              py: 0.25,
              px: 1,
              bgcolor: 'rgba(251,191,36,0.15)',
              color: '#fbbf24',
              fontSize: 9,
              '& .MuiAlert-icon': { fontSize: 14, py: 0 },
              '& .MuiAlert-message': { py: 0.25 },
            }}
          >
            {error}
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default VideoFeed;
