import { memo } from 'react';
import { Box, Button } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import { ROLE_ROOM_LANDING_CONFIG } from '../../config/landing';

interface LandingCTAProps {
  onStartClick: () => void;
  onGuestEnter?: () => void;
}

/**
 * Primær CTA (Start The Role Room) + valgfri sekundær CTA (Gå inn som
 * gjest) når demo-modus er aktivert i config.
 *
 * Microcopy-improvement: primær-CTA-en understreker "kom i gang" mens
 * sekundær er nedtonet for å redusere valg-paralyse.
 */
function LandingCTAImpl({ onStartClick, onGuestEnter }: LandingCTAProps) {
  const shouldReduceMotion = useReducedMotion();
  const demoModeEnabled = ROLE_ROOM_LANDING_CONFIG.demoModeEnabled;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        mb: 6,
      }}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
      >
        <Button
          variant="contained"
          size="large"
          onClick={onStartClick}
          startIcon={<PlayArrowIcon />}
          aria-label="Start The Role Room — åpner innlogging"
          data-testid="role-room-landing-cta-primary"
          sx={{
            px: 5,
            py: 2,
            fontSize: '1.05rem',
            fontWeight: 600,
            borderRadius: 3,
            minHeight: 56,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            boxShadow: '0 8px 32px rgba(139,92,246,0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #9b6cf6 0%, #7376f1 100%)',
              boxShadow: '0 12px 40px rgba(139,92,246,0.55)',
              transform: 'translateY(-2px)',
            },
            '&:focus-visible': {
              outline: '2px solid #fff',
              outlineOffset: 3,
            },
            transition: 'all 0.3s ease',
          }}
        >
          Start The Role Room
        </Button>
      </motion.div>
      {onGuestEnter && demoModeEnabled && (
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.6 }}
        >
          <Button
            onClick={onGuestEnter}
            size="small"
            aria-label="Gå inn uten innlogging — utforsk demoen som gjest"
            data-testid="role-room-landing-cta-guest"
            sx={{
              color: 'rgba(200,185,255,0.5)',
              fontSize: '0.78rem',
              fontWeight: 400,
              textTransform: 'none',
              letterSpacing: '0.02em',
              minHeight: 36,
              '&:hover': {
                color: 'rgba(200,185,255,0.85)',
                bgcolor: 'transparent',
                textDecoration: 'underline',
              },
              '&:focus-visible': {
                outline: '2px solid rgba(200,185,255,0.7)',
                outlineOffset: 2,
              },
            }}
          >
            Gå inn uten innlogging →
          </Button>
        </motion.div>
      )}
    </Box>
  );
}

export const LandingCTA = memo(LandingCTAImpl);
LandingCTA.displayName = 'LandingCTA';
