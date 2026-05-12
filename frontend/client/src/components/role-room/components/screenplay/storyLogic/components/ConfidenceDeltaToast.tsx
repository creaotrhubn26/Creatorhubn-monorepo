/**
 * ConfidenceDeltaToast — flytende "+N"-badge som vises kortvarig når
 * brukerens konfidens-score øker med MIN_VISIBLE_DELTA (≥3 poeng).
 *
 * Plasseres absolutt over en relativ container (typisk progress-baren
 * eller fase-headeren). Bruker key-prop fra `useConfidenceDelta` for å
 * re-spawne fra start ved hver delta-event — det gir en frisk
 * fade-in/up-animasjon per event uten å kreve animation-libraries.
 *
 * Designprinsipper:
 *   - Liten, ikke-blokkerende, fader til transparent
 *   - Grønn (#10b981) for å forsterke "ferdig"-følelsen
 *   - Bevegelse oppover for å signalisere fremgang
 *   - aria-live="polite" så skjermlesere annonserer endringen for synshemmede
 */

import React from 'react';
import { Box } from '@mui/material';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import type { ConfidenceDeltaEvent } from '../hooks/useConfidenceDelta';

export interface ConfidenceDeltaToastProps {
  event: ConfidenceDeltaEvent;
  /** Top-offset i piksler (negativ = over container). Default -28. */
  topOffset?: number;
  /** Høyre offset i piksler. Default 12. */
  rightOffset?: number;
}

export const ConfidenceDeltaToast: React.FC<ConfidenceDeltaToastProps> = ({
  event,
  topOffset = -28,
  rightOffset = 12,
}) => {
  if (event.delta <= 0) return null;

  return (
    <Box
      key={event.key}
      role="status"
      aria-live="polite"
      sx={{
        position: 'absolute',
        top: topOffset,
        right: rightOffset,
        zIndex: 5,
        pointerEvents: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 999,
        bgcolor: 'rgba(16,185,129,0.18)',
        border: '1px solid rgba(16,185,129,0.45)',
        color: '#6ee7b7',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: 0.5,
        animation: 'storylogic-delta-rise 2400ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
        '@keyframes storylogic-delta-rise': {
          '0%': { opacity: 0, transform: 'translateY(8px) scale(0.85)' },
          '15%': { opacity: 1, transform: 'translateY(0) scale(1)' },
          '70%': { opacity: 1, transform: 'translateY(-6px) scale(1)' },
          '100%': { opacity: 0, transform: 'translateY(-14px) scale(0.95)' },
        },
      }}
    >
      <TrendingUpIcon sx={{ fontSize: 13 }} />
      +{event.delta}
    </Box>
  );
};
