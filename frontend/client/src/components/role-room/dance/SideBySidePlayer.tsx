/**
 * SideBySidePlayer — to klipp synket på felles playhead.
 *
 * Brukes typisk for reference-clip vs rehearsal-capture. Den primære
 * spilleren er master (dens playhead driver), den sekundære følger via
 * et timeupdate-listener som forsiktig nudger currentTime hvis spillerne
 * driftet.
 */

import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { VideoClip } from './danceVideoService';

const SYNC_TOLERANCE_SEC = 0.15;

export interface SideBySidePlayerProps {
  primaryClip: VideoClip;
  secondaryClip: VideoClip;
  primaryRef: React.MutableRefObject<HTMLVideoElement | null>;
  secondaryRef: React.MutableRefObject<HTMLVideoElement | null>;
  playbackRate: number;
  onTimeUpdate: () => void;
  onLoadedMeta: () => void;
}

export const SideBySidePlayer: React.FC<SideBySidePlayerProps> = ({
  primaryClip,
  secondaryClip,
  primaryRef,
  secondaryRef,
  playbackRate,
  onTimeUpdate,
  onLoadedMeta,
}) => {
  // Sync secondary player to primary on every primary tick.
  const handlePrimaryTimeUpdate = (): void => {
    onTimeUpdate();
    const a = primaryRef.current;
    const b = secondaryRef.current;
    if (!a || !b) return;
    if (Math.abs(a.currentTime - b.currentTime) > SYNC_TOLERANCE_SEC) {
      try { b.currentTime = a.currentTime; } catch { /* ignore */ }
    }
    if (a.paused && !b.paused) b.pause();
    if (!a.paused && b.paused) {
      void b.play().catch(() => { /* ignore */ });
    }
  };

  React.useEffect(() => {
    if (primaryRef.current) primaryRef.current.playbackRate = playbackRate;
    if (secondaryRef.current) secondaryRef.current.playbackRate = playbackRate;
  }, [playbackRate, primaryRef, secondaryRef]);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
      <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#000', aspectRatio: 16 / 9 }}>
        <Typography
          sx={{
            position: 'absolute', top: 6, left: 8, zIndex: 2,
            fontSize: 10, letterSpacing: 1, color: '#fff', fontWeight: 700,
            bgcolor: 'rgba(0,0,0,0.55)', px: 1, py: 0.25, borderRadius: 1,
          }}
        >
          {primaryClip.title} · MASTER
        </Typography>
        {primaryClip.signedUrl ? (
          <video
            ref={primaryRef}
            src={primaryClip.signedUrl}
            controls
            preload="metadata"
            onTimeUpdate={handlePrimaryTimeUpdate}
            onLoadedMetadata={onLoadedMeta}
            onPlay={() => { void secondaryRef.current?.play().catch(() => { /* ignore */ }); }}
            onPause={() => secondaryRef.current?.pause()}
            onSeeked={() => {
              const b = secondaryRef.current;
              const a = primaryRef.current;
              if (b && a) try { b.currentTime = a.currentTime; } catch { /* ignore */ }
            }}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ) : null}
      </Box>
      <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#000', aspectRatio: 16 / 9 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{
            position: 'absolute', top: 6, left: 8, zIndex: 2,
            fontSize: 10, color: '#fff', fontWeight: 700,
            bgcolor: 'rgba(0,0,0,0.55)', px: 1, py: 0.25, borderRadius: 1,
          }}
        >
          <Typography sx={{ fontSize: 10, letterSpacing: 1, color: '#fff', fontWeight: 700 }}>
            {secondaryClip.title} · SLAVE
          </Typography>
        </Stack>
        {secondaryClip.signedUrl ? (
          <video
            ref={secondaryRef}
            src={secondaryClip.signedUrl}
            preload="metadata"
            muted
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ) : null}
      </Box>
    </Box>
  );
};

export default SideBySidePlayer;
