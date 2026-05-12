/**
 * PhaseHeader — status-header for hver fase i Story Logic (Konsept/Logline/Tema).
 *
 * Viser:
 *   - Fase-nummer + tittel + ikon (energy-aware fargekoder for status)
 *   - Status-chip ("Ikke tydelig ennå" / "La oss spisse dette" / "Klar")
 *   - Optional "Låst"-chip når fasen er låst av brukeren
 *   - Optional next-best-action-chip (vises kun når fasen er åpen og ikke ready)
 *   - Purpose-tekst under tittelen
 *   - Lås/lås-opp-knapp på høyre side (44x44 klikk-target, focus-visible)
 *
 * Ekstraktert fra StoryLogicPanel.tsx for å redusere panel-størrelsen
 * og muliggjøre gjenbruk fra fase-komponenter (ConceptPhase/LoglinePhase/
 * ThemePhase) når split-arbeidet fortsetter.
 */

import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import {
  Psychology as PsychologyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Check as CheckIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { STATUS_LABELS } from '../constants';

export interface PhaseHeaderProps {
  number: number;
  title: string;
  purpose: string;
  icon: React.ReactNode;
  status: 'incomplete' | 'weak' | 'ready';
  locked: boolean;
  onToggleLock: () => void;
  nextBestAction: string | null;
}

const STATUS_COLORS = {
  incomplete: '#9ca3af',
  weak: '#f59e0b',
  ready: '#10b981',
} as const;

export const PhaseHeader: React.FC<PhaseHeaderProps> = ({
  number,
  title,
  purpose,
  icon,
  status,
  locked,
  onToggleLock,
  nextBestAction,
}) => {
  const statusIcons = {
    incomplete: <PsychologyIcon fontSize="small" />,
    weak: <AutoAwesomeIcon fontSize="small" />,
    ready: <CheckIcon fontSize="small" />,
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, width: '100%' }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          background: `linear-gradient(135deg, ${STATUS_COLORS[status]}40, ${STATUS_COLORS[status]}20)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2px solid ${STATUS_COLORS[status]}`,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
            Fase {number}: {title}
          </Typography>
          <Chip
            size="small"
            icon={statusIcons[status]}
            label={STATUS_LABELS[status]}
            sx={{
              bgcolor: `${STATUS_COLORS[status]}15`,
              color: STATUS_COLORS[status],
              '& .MuiChip-icon': { color: STATUS_COLORS[status] },
            }}
          />
          {locked && (
            <Chip
              size="small"
              icon={<LockIcon sx={{ fontSize: 14 }} />}
              label="Låst"
              sx={{
                bgcolor: '#f59e0b20',
                color: '#f59e0b',
                '& .MuiChip-icon': { color: '#f59e0b' },
              }}
            />
          )}
          {nextBestAction && !locked && status !== 'ready' && (
            <Chip
              size="small"
              icon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              label={nextBestAction}
              sx={{
                bgcolor: '#3b82f620',
                color: '#60a5fa',
                '& .MuiChip-icon': { color: '#3b82f6' },
                cursor: 'default',
              }}
            />
          )}
        </Box>
        <Typography variant="body2" sx={{ color: '#9ca3af' }}>
          {purpose}
        </Typography>
      </Box>
      <Tooltip title={locked ? `Lås opp ${title}` : status === 'ready' ? `Lås ${title} (klar)` : `Lås ${title}`}>
        <Box
          component="span"
          role="button"
          tabIndex={0}
          aria-label={locked ? `Lås opp ${title}` : `Lås ${title}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onToggleLock();
            }
          }}
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: locked ? '#f59e0b' : '#6b7280',
            flexShrink: 0,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            '&:focus-visible': { outline: '2px solid #60a5fa', outlineOffset: 2 },
          }}
        >
          {locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
        </Box>
      </Tooltip>
    </Box>
  );
};
