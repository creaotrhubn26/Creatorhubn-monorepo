/**
 * PostVideoPreview — viser preview-videoen for en marketing-plan-post.
 *
 * To pipelines:
 *  - Cloudflare Stream: bruker HLS-manifest. På Safari spilles HLS
 *    nativt; på Chrome/Firefox lastes hls.js dynamisk hvis nødvendig.
 *  - R2 fallback: vanlig mp4 i `<video>`-tag.
 *
 * Når Stream-videoen ikke er ready ennå (transcoding pågår), viser vi
 * posterframe + "behandles" badge. Ingen polling her — klienten kan
 * refresh-e siden hvis han ser badge-en.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  streamPlaybackUrl?: string | null;
  streamThumbnailUrl?: string | null;
  streamReady?: boolean;
  r2VideoUrl?: string | null;
  durationSec?: number | null;
  className?: string;
  /** Rapporterer currentTime hvert ~250ms — for tidskode-kommentarer. */
  onCurrentTime?: (sec: number) => void;
  /** Settes med video-elementet når det monteres — for å kunne seek(). */
  onVideoEl?: (el: HTMLVideoElement | null) => void;
  /** Markører som rendres på timeline (én pr timestamp-kommentar). */
  timestampMarkers?: Array<{ sec: number; label?: string }>;
}

export function PostVideoPreview({
  streamPlaybackUrl, streamThumbnailUrl, streamReady,
  r2VideoUrl, durationSec, className,
  onCurrentTime, onVideoEl, timestampMarkers,
}: Props) {
  // Ingen video tilgjengelig — vis ingenting (PostRow viser
  // bare tekst-content).
  if (!streamPlaybackUrl && !r2VideoUrl) return null;

  // Stream som transcodes — vis posterframe + status, ikke video-tag.
  if (streamPlaybackUrl && streamReady === false) {
    return (
      <div className={className} style={wrapperSx}>
        <div style={{
          ...posterSx,
          backgroundImage: streamThumbnailUrl
            ? `url(${streamThumbnailUrl})` : undefined,
        }}>
          <div style={badgeOverlaySx}>Behandler video …</div>
        </div>
      </div>
    );
  }

  const useStream = !!streamPlaybackUrl;

  return (
    <div className={className} style={wrapperSx}>
      {useStream ? (
        <HlsPlayer
          src={streamPlaybackUrl!}
          poster={streamThumbnailUrl ?? undefined}
          onCurrentTime={onCurrentTime}
          onVideoEl={onVideoEl}
        />
      ) : (
        <Mp4Player
          src={r2VideoUrl!}
          onCurrentTime={onCurrentTime}
          onVideoEl={onVideoEl}
        />
      )}
      {durationSec && timestampMarkers && timestampMarkers.length > 0 && (
        <TimestampMarkers
          markers={timestampMarkers}
          durationSec={durationSec}
          onSeek={(sec) => {
            // Vi har ikke direkte tilgang til video-el her, men onVideoEl-
            // parent kan håndtere seek via sin ref. La parent gjøre det.
            // Forenklet: parent kan også seek-e via onVideoEl-ref.
            onCurrentTime?.(sec);
          }}
        />
      )}
      {durationSec && (
        <div style={metaSx}>{formatDuration(durationSec)}</div>
      )}
    </div>
  );
}

function Mp4Player({ src, onCurrentTime, onVideoEl }: {
  src: string;
  onCurrentTime?: (sec: number) => void;
  onVideoEl?: (el: HTMLVideoElement | null) => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    onVideoEl?.(ref.current);
    return () => onVideoEl?.(null);
  }, [onVideoEl]);
  return (
    <video ref={ref} controls preload="metadata"
           style={videoSx}
           src={src}
           onTimeUpdate={(e) => onCurrentTime?.(e.currentTarget.currentTime)} />
  );
}

function TimestampMarkers({ markers, durationSec, onSeek }: {
  markers: Array<{ sec: number; label?: string }>;
  durationSec: number;
  onSeek: (sec: number) => void;
}) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 32,
      height: 8, pointerEvents: 'none',
    }}>
      {markers.map((m, i) => {
        const pct = Math.max(0, Math.min(100, (m.sec / durationSec) * 100));
        return (
          <button key={i}
                  onClick={() => onSeek(m.sec)}
                  title={m.label ?? `${formatDuration(m.sec)}`}
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    transform: 'translateX(-50%)',
                    width: 10, height: 10,
                    borderRadius: 5,
                    background: '#a030c0',
                    border: '2px solid #fff',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    padding: 0,
                  }} />
        );
      })}
    </div>
  );
}

function HlsPlayer({ src, poster, onCurrentTime, onVideoEl }: {
  src: string; poster?: string;
  onCurrentTime?: (sec: number) => void;
  onVideoEl?: (el: HTMLVideoElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hlsLoadError, setHlsLoadError] = useState(false);

  useEffect(() => {
    onVideoEl?.(videoRef.current);
    return () => onVideoEl?.(null);
  }, [onVideoEl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari + iOS — HLS er nativt
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return;
    }

    // Andre — last hls.js dynamisk så vi ikke drar inn 200KB
    // for klienter som bruker Safari (vanlig på iPhone).
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    void import('hls.js').then((mod) => {
      if (cancelled || !videoRef.current) return;
      const Hls = mod.default;
      if (!Hls.isSupported()) {
        setHlsLoadError(true);
        return;
      }
      const instance = new Hls();
      instance.loadSource(src);
      instance.attachMedia(videoRef.current);
      hls = instance;
    }).catch(() => {
      if (!cancelled) setHlsLoadError(true);
    });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [src]);

  if (hlsLoadError) {
    return (
      <div style={{ ...posterSx, backgroundImage: poster ? `url(${poster})` : undefined }}>
        <div style={badgeOverlaySx}>Kan ikke spille — last siden på nytt</div>
      </div>
    );
  }

  return (
    <video ref={videoRef}
           controls
           preload="metadata"
           poster={poster}
           onTimeUpdate={(e) => onCurrentTime?.(e.currentTarget.currentTime)}
           style={videoSx} />
  );
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const wrapperSx: React.CSSProperties = {
  position: 'relative',
  marginTop: 8,
  borderRadius: 6,
  overflow: 'hidden',
  background: '#000',
  border: '1px solid rgba(160,48,192,0.20)',
};

const videoSx: React.CSSProperties = {
  width: '100%',
  display: 'block',
  maxHeight: 480,
  background: '#000',
};

const posterSx: React.CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 9',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  background: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(232,224,240,0.85)',
};

const badgeOverlaySx: React.CSSProperties = {
  background: 'rgba(20,12,40,0.78)',
  padding: '6px 12px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
  border: '1px solid rgba(160,48,192,0.35)',
};

const metaSx: React.CSSProperties = {
  position: 'absolute',
  bottom: 6,
  right: 6,
  background: 'rgba(0,0,0,0.72)',
  color: '#fff',
  padding: '2px 8px',
  borderRadius: 3,
  fontSize: 11,
  fontWeight: 600,
};

export default PostVideoPreview;
