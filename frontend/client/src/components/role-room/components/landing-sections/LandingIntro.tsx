import { memo, useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { ROLE_ROOM_LANDING_CONFIG } from '../../config/landing';
import { getRoleRoomVideoPosterUrl } from '../../utils/roleRoomMedia';

interface LandingIntroProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Intro-video-splash som vises før hovedsiden. Dismisses ved video-end,
 * skip-knapp, eller 20 sek timeout. Faller tilbake til still-bilde hvis
 * video ikke laster. Beholder skip-knapp synlig hele tiden (a11y).
 */
function LandingIntroImpl({ visible, onDismiss }: LandingIntroProps) {
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const introVideoUrl = ROLE_ROOM_LANDING_CONFIG.intro.videoUrl;
  const introSkipLabel = ROLE_ROOM_LANDING_CONFIG.intro.skipLabel;
  const introStillUrl = getRoleRoomVideoPosterUrl(
    introVideoUrl,
    '/role-room-assets/landing_backdrop_with_logo.webp',
  );

  useEffect(() => {
    setVideoReady(false);
    setVideoFailed(false);
  }, [introVideoUrl]);

  // Safety fallback — dismiss intro if video never fires onEnded
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => onDismiss(), 20_000);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: '#000',
          }}
        >
          {introStillUrl ? (
            <Box
              component="img"
              src={introStillUrl}
              alt=""
              aria-hidden="true"
              loading="eager"
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: videoReady && !videoFailed ? 0.12 : 1,
                transition: 'opacity 0.3s ease',
              }}
            />
          ) : null}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: { xs: 0, sm: 2.5, md: 4 },
              py: { xs: 0, sm: 2.5, md: 4 },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: {
                  xs: '100%',
                  sm: 'min(calc(100vw - 32px), calc(100vh - 32px), 820px)',
                  md: 'min(calc(100vw - 64px), calc(100vh - 64px), 920px)',
                  xl: 'min(calc(100vw - 96px), calc(100vh - 80px), 1080px)',
                },
                height: {
                  xs: '100%',
                  sm: 'min(calc(100vw - 32px), calc(100vh - 32px), 820px)',
                  md: 'min(calc(100vw - 64px), calc(100vh - 64px), 920px)',
                  xl: 'min(calc(100vw - 96px), calc(100vh - 80px), 1080px)',
                },
                borderRadius: { xs: 0, sm: '28px', md: '34px' },
                overflow: 'hidden',
                border: { xs: 'none', sm: '1px solid rgba(255,255,255,0.08)' },
                boxShadow: {
                  xs: 'none',
                  sm: '0 32px 120px rgba(0,0,0,0.42)',
                  md: '0 36px 140px rgba(0,0,0,0.5)',
                },
                background: '#000',
              }}
            >
              <Box
                component="video"
                src={introVideoUrl}
                autoPlay
                muted
                playsInline
                preload="auto"
                onEnded={onDismiss}
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
                data-testid="role-room-landing-intro-video"
                data-media-mode={videoReady && !videoFailed ? 'video' : 'image'}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                  opacity: videoReady && !videoFailed ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background: {
                    xs: 'linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.12) 100%)',
                    sm: 'radial-gradient(circle at center, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.16) 72%, rgba(0,0,0,0.34) 100%)',
                  },
                }}
              />
            </Box>
          </Box>
          {/* Skip button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            style={{ position: 'absolute', zIndex: 10 }}
          >
            <Button
              onClick={onDismiss}
              aria-label="Hopp over intro-video"
              data-testid="role-room-landing-intro-skip"
              sx={{
                position: 'fixed',
                right: { xs: 14, sm: 24, md: 40 },
                bottom: { xs: 14, sm: 24, md: 40 },
                color: 'rgba(255,255,255,0.56)',
                fontSize: { xs: '0.78rem', sm: '0.85rem' },
                px: { xs: 1.1, sm: 1.35 },
                py: 0.45,
                minHeight: 44,
                minWidth: 44,
                borderRadius: 999,
                backdropFilter: 'blur(10px)',
                bgcolor: 'rgba(8,10,18,0.34)',
                '&:hover': {
                  color: 'rgba(255,255,255,0.88)',
                  bgcolor: 'rgba(8,10,18,0.5)',
                },
                '&:focus-visible': {
                  outline: '2px solid rgba(255,255,255,0.7)',
                  outlineOffset: 2,
                },
              }}
            >
              {introSkipLabel}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const LandingIntro = memo(LandingIntroImpl);
LandingIntro.displayName = 'LandingIntro';
