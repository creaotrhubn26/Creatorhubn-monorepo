import { memo, useEffect, useState } from 'react';
import { Box, Button, Slide } from '@mui/material';
import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { useReducedMotion } from 'framer-motion';

interface LandingStickyCTAProps {
  onStartClick: () => void;
  visible: boolean;
}

/**
 * Sticky CTA-knapp som dukker opp når bruker har scrollet 600px nedover og
 * den primære CTA-en er ute av syne. Slides inn fra bunnen med subtle
 * shadow. Skjules hvis bruker er øverst, hvis intro vises, eller hvis
 * login-dialog er åpen.
 */
function LandingStickyCTAImpl({ onStartClick, visible }: LandingStickyCTAProps) {
  const shouldReduceMotion = useReducedMotion();
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      setScrolledPast(window.scrollY > 600);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const show = visible && scrolledPast;

  return (
    <Slide direction="up" in={show} mountOnEnter unmountOnExit timeout={shouldReduceMotion ? 0 : 300}>
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 16, md: 28 },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'auto',
        }}
      >
        <Button
          variant="contained"
          size="large"
          onClick={onStartClick}
          startIcon={<PlayArrowIcon />}
          aria-label="Start The Role Room — sticky CTA"
          data-testid="role-room-landing-cta-sticky"
          sx={{
            px: 4,
            py: 1.5,
            fontSize: '0.96rem',
            fontWeight: 700,
            borderRadius: 999,
            minHeight: 52,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            boxShadow: '0 14px 40px rgba(139,92,246,0.55), 0 4px 12px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
            '&:hover': {
              background: 'linear-gradient(135deg, #9b6cf6 0%, #7376f1 100%)',
              boxShadow: '0 18px 52px rgba(139,92,246,0.65), 0 6px 16px rgba(0,0,0,0.4)',
              transform: 'translateY(-2px)',
            },
            '&:focus-visible': {
              outline: '2px solid #fff',
              outlineOffset: 3,
            },
            transition: 'all 0.25s ease',
          }}
        >
          Kom i gang
        </Button>
      </Box>
    </Slide>
  );
}

export const LandingStickyCTA = memo(LandingStickyCTAImpl);
LandingStickyCTA.displayName = 'LandingStickyCTA';
