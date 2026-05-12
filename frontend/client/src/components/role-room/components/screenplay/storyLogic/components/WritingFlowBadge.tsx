/**
 * WritingFlowBadge — mikro-indikator som viser brukerens skrive-rytme.
 *
 * Vises i panel-headeren ved siden av auto-save-statusen. Holder seg
 * stille når brukeren ikke skriver, "puster" når brukeren akkurat har
 * begynt, og pulserer rolig grønt når de er i flyt.
 *
 * Designprinsipper:
 *   - Aldri kritisk/rødt — kun positive eller nøytrale toner
 *   - Synlig nok til å belønne flyt, ikke så fremtredende at det
 *     distraherer fra skrivingen
 *   - 'idle'-state er minimal (gråt prikk-ikon) for ikke å rote til UI
 *
 * Bruker `useWritingFlow`-hook for state. Forelderen ringer onActivity
 * fra TextField-onChange-handlere for å mate hooken med signal.
 */

import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import {
  AutoAwesome as FlowIcon,
  Edit as EditIcon,
  CoffeeOutlined as PauseIcon,
  CircleOutlined as IdleIcon,
} from '@mui/icons-material';
import type { WritingFlowState } from '../hooks/useWritingFlow';

export interface WritingFlowBadgeProps {
  state: WritingFlowState;
  secondsInFlow: number;
}

const PALETTE: Record<WritingFlowState, { bg: string; fg: string; iconColor: string }> = {
  idle: {
    bg: 'rgba(156,163,175,0.10)',
    fg: '#9ca3af',
    iconColor: '#6b7280',
  },
  starting: {
    bg: 'rgba(96,165,250,0.12)',
    fg: '#93c5fd',
    iconColor: '#60a5fa',
  },
  flowing: {
    bg: 'rgba(16,185,129,0.14)',
    fg: '#6ee7b7',
    iconColor: '#10b981',
  },
  paused: {
    bg: 'rgba(168,85,247,0.10)',
    fg: '#c4b5fd',
    iconColor: '#a78bfa',
  },
};

function formatLabel(state: WritingFlowState, secondsInFlow: number): string {
  switch (state) {
    case 'idle':
      return 'Klar til å skrive';
    case 'starting':
      return 'På vei inn i flyt';
    case 'flowing': {
      if (secondsInFlow >= 300) return `I dyp flyt · ${Math.floor(secondsInFlow / 60)}m`;
      if (secondsInFlow >= 60) return `I flyt · ${Math.floor(secondsInFlow / 60)}m`;
      return 'I flyt';
    }
    case 'paused':
      return 'Lite pust';
  }
}

function getIcon(state: WritingFlowState): React.ReactElement {
  switch (state) {
    case 'idle':
      return <IdleIcon sx={{ fontSize: 14 }} />;
    case 'starting':
      return <EditIcon sx={{ fontSize: 14 }} />;
    case 'flowing':
      return <FlowIcon sx={{ fontSize: 14 }} />;
    case 'paused':
      return <PauseIcon sx={{ fontSize: 14 }} />;
  }
}

function getTooltip(state: WritingFlowState, secondsInFlow: number): string {
  switch (state) {
    case 'idle':
      return 'Start å skrive for å komme i flyt';
    case 'starting':
      return 'Fortsett å skrive — du kommer i flyt om noen sekunder';
    case 'flowing':
      return `Du har vært i flyt i ${secondsInFlow} sekunder. Hold rytmen.`;
    case 'paused':
      return 'Tok en liten pause. Klar til å fortsette.';
  }
}

export const WritingFlowBadge: React.FC<WritingFlowBadgeProps> = ({ state, secondsInFlow }) => {
  const palette = PALETTE[state];
  const isFlowing = state === 'flowing';

  return (
    <Tooltip title={getTooltip(state, secondsInFlow)} arrow>
      <Box
        sx={{
          display: 'inline-flex',
          position: 'relative',
          '&::before': isFlowing
            ? {
                content: '""',
                position: 'absolute',
                inset: -3,
                borderRadius: 999,
                background: `radial-gradient(circle, ${palette.iconColor}33 0%, transparent 70%)`,
                animation: 'storylogic-flow-pulse 2.4s ease-in-out infinite',
                pointerEvents: 'none',
              }
            : undefined,
          '@keyframes storylogic-flow-pulse': {
            '0%, 100%': { opacity: 0.45, transform: 'scale(1)' },
            '50%': { opacity: 0.95, transform: 'scale(1.04)' },
          },
        }}
      >
        <Chip
          size="small"
          icon={getIcon(state)}
          label={formatLabel(state, secondsInFlow)}
          sx={{
            position: 'relative',
            bgcolor: palette.bg,
            color: palette.fg,
            fontWeight: 500,
            transition: 'all 240ms ease-out',
            '& .MuiChip-icon': { color: palette.iconColor },
          }}
        />
      </Box>
    </Tooltip>
  );
};
