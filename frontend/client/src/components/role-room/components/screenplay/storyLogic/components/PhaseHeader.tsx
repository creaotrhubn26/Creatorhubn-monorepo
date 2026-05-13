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

import React, { useEffect, useRef, useState } from 'react';
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
  /** Vises som hint-chip når status er 'ready' (typisk siste fase eller eksplisitt deaktivert) */
  showAdvanceShortcutHint?: boolean;
}

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const SHORTCUT_LABEL = IS_MAC ? '⌘ ↵' : 'Ctrl ↵';

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
  showAdvanceShortcutHint = true,
}) => {
  const statusIcons = {
    incomplete: <PsychologyIcon fontSize="small" />,
    weak: <AutoAwesomeIcon fontSize="small" />,
    ready: <CheckIcon fontSize="small" />,
  };

  // Feiringsanimasjon ved overgang til 'ready' — mikro-belønning for å
  // ha gjort fasen ferdig. Aktiveres kun ved transitionen (ikke vedvarende
  // mens status er ready).
  const prevStatus = useRef<typeof status>(status);
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (prevStatus.current !== 'ready' && status === 'ready') {
      setCelebrating(true);
      const t = setTimeout(() => setCelebrating(false), 1_400);
      prevStatus.current = status;
      return () => clearTimeout(t);
    }
    prevStatus.current = status;
  }, [status]);

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
              transition: 'transform 240ms ease-out, box-shadow 240ms ease-out',
              transform: celebrating ? 'scale(1.08)' : 'scale(1)',
              boxShadow: celebrating ? `0 0 0 6px ${STATUS_COLORS[status]}22, 0 4px 12px ${STATUS_COLORS[status]}44` : 'none',
              animation: celebrating ? 'storylogic-phase-ready-pulse 1.4s ease-out' : 'none',
              '& .MuiChip-icon': { color: STATUS_COLORS[status] },
              '@keyframes storylogic-phase-ready-pulse': {
                '0%': { boxShadow: `0 0 0 0 ${STATUS_COLORS[status]}66` },
                '60%': { boxShadow: `0 0 0 12px ${STATUS_COLORS[status]}00` },
                '100%': { boxShadow: `0 0 0 0 ${STATUS_COLORS[status]}00` },
              },
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
          {status === 'ready' && !locked && showAdvanceShortcutHint && (
            <Tooltip title="Gå videre til neste fase" arrow>
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 999,
                  bgcolor: 'rgba(16,185,129,0.10)',
                  color: '#6ee7b7',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  border: '1px solid rgba(16,185,129,0.25)',
                  fontFamily: 'inherit',
                }}
              >
                <Box component="kbd" sx={{ fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700 }}>
                  {SHORTCUT_LABEL}
                </Box>
                neste
              </Box>
            </Tooltip>
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
