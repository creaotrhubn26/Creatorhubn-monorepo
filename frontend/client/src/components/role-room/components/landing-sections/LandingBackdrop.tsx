import { memo, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useReducedMotion } from 'framer-motion';
import { getRoleRoomVideoStillUrl } from '../../utils/roleRoomMedia';
import { ROLE_ROOM_LANDING_CONFIG } from '../../config/landing';

/**
 * Fullbleed video backdrop + dark gradient overlay. Vises bak hele landing-
 * sidens innhold. Faller tilbake til still-bilde mens videoen lastes eller
 * hvis prefers-reduced-motion er aktivert.
 */

function LandingBackdropImpl() {
  const shouldReduceMotion = useReducedMotion();
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const backdropVideoUrl = ROLE_ROOM_LANDING_CONFIG.intro.backdropVideoUrl;
  const backdropStillUrl = getRoleRoomVideoStillUrl(
    backdropVideoUrl,
    '/role-room-assets/landing_backdrop.webp',
  );

  useEffect(() => {
    setVideoReady(false);
    setVideoFailed(false);
  }, [backdropVideoUrl]);

  return (
    <>
      {backdropStillUrl ? (
        <Box
          component="img"
          src={backdropStillUrl}
          alt=""
          aria-hidden="true"
          loading="eager"
          sx={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 30%',
            opacity: 0.22,
            zIndex: 0,
            pointerEvents: 'none',
            filter: 'saturate(0.6) brightness(0.55)',
          }}
        />
      ) : null}
      <Box
        component="video"
        src={backdropVideoUrl}
        autoPlay={!shouldReduceMotion}
        loop
        muted
        playsInline
        preload="auto"
        onLoadedData={() => {
          setVideoReady(true);
          setVideoFailed(false);
        }}
        onCanPlay={() => {
          setVideoReady(true);
          setVideoFailed(false);
        }}
        onError={() => {
          setVideoReady(false);
          setVideoFailed(true);
        }}
        data-testid="role-room-landing-backdrop-video"
        data-media-mode={videoReady && !videoFailed ? 'video' : 'image'}
        sx={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center 30%',
          opacity: videoReady && !videoFailed ? 0.22 : 0,
          zIndex: 0,
          pointerEvents: 'none',
          filter: 'saturate(0.6) brightness(0.55)',
          transition: 'opacity 0.3s ease',
        }}
      />
      {/* dark gradient over video so text is always readable */}
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(10,10,15,0.55) 0%, rgba(10,10,15,0.4) 40%, rgba(10,10,15,0.75) 100%)',
        }}
      />
    </>
  );
}

export const LandingBackdrop = memo(LandingBackdropImpl);
LandingBackdrop.displayName = 'LandingBackdrop';
