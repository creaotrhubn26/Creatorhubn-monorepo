/**
 * ProfessionModeChip — permanent indikator i headeren som viser
 * hvilken profession-mode bruker er i, med dropdown for å bytte.
 *
 * Plasseres ved siden av tab-baren slik at brukeren ALLTID vet om
 * de er i "Studio-modus", "Frilans-modus", etc. Tidligere måtte
 * bruker huske dette + det var skjult i innstillinger.
 */

import React, { useState } from 'react';
import {
  Box, Chip, Menu, MenuItem, Stack, Typography, Tooltip,
} from '@mui/material';
import {
  Business as StudioIcon,
  Person as FreelanceIcon,
  School as EducationIcon,
  Movie as ProductionIcon,
  Mic as ContentIcon,
  ExpandMore as ExpandIcon,
} from '@mui/icons-material';
import {
  ALL_PROFESSION_MODES,
  PROFESSION_MODE_META,
  isProfessionMode,
  type ProfessionMode,
} from '../config/professionMode';

interface ProfessionModeChipProps {
  mode: ProfessionMode | string;
  onSwitch?: (mode: ProfessionMode) => void;
  /** Visningstekst hvis mode ikke matcher kjente. */
  fallbackLabel?: string;
}

// Ikon og farge per modus. Navn, beskrivelse og hvorvidt en modus kan velges
// bor i config/professionMode.ts sammen med selve typen — denne filen skal
// ikke kunne vise en modus som ikke finnes, slik «Casting-modus» gjorde.
const MODE_STYLE: Record<ProfessionMode, { icon: React.ReactNode; color: string }> = {
  production: { icon: <ProductionIcon />, color: '#EC4899' },
  photographer: { icon: <ContentIcon />, color: '#0EA5E9' },
  content_producer: { icon: <ContentIcon />, color: '#3B82F6' },
  content_creator: { icon: <ContentIcon />, color: '#6366F1' },
  dance_studio: { icon: <StudioIcon />, color: '#F5B82E' },
  dance_freelance: { icon: <FreelanceIcon />, color: '#10B981' },
  education: { icon: <EducationIcon />, color: '#8B5CF6' },
  student: { icon: <EducationIcon />, color: '#A78BFA' },
};

export const ProfessionModeChip: React.FC<ProfessionModeChipProps> = ({
  mode,
  onSwitch,
  fallbackLabel,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const known = isProfessionMode(mode) ? (mode as ProfessionMode) : null;
  const meta = known
    ? { ...PROFESSION_MODE_META[known], ...MODE_STYLE[known] }
    : {
        // Ukjent lagret verdi: vis den som den er i stedet for å late som
        // den er en modus vi støtter.
        label: fallbackLabel ?? String(mode),
        icon: <StudioIcon />,
        description: '',
        color: '#9CA3AF',
      };

  // Bygges av den kanoniske listen, ikke av en egen kopi.
  const switchableModes = ALL_PROFESSION_MODES
    .filter((candidate) => candidate !== known && PROFESSION_MODE_META[candidate].switchable)
    .map((candidate) => [
      candidate,
      { ...PROFESSION_MODE_META[candidate], ...MODE_STYLE[candidate] },
    ] as const);

  return (
    <>
      <Tooltip title={meta.description} placement="bottom" arrow>
        <Chip
          icon={
            <Box sx={{ color: meta.color, display: 'flex', '& > svg': { fontSize: 16 } }}>
              {meta.icon}
            </Box>
          }
          label={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {meta.label}
              </Typography>
              {onSwitch && <ExpandIcon sx={{ fontSize: 14, opacity: 0.6 }} />}
            </Stack>
          }
          onClick={onSwitch ? (e) => setAnchorEl(e.currentTarget) : undefined}
          sx={{
            bgcolor: meta.color + '22',
            color: meta.color,
            border: `1px solid ${meta.color}44`,
            fontWeight: 700,
            cursor: onSwitch ? 'pointer' : 'default',
            '&:hover': onSwitch ? { bgcolor: meta.color + '33' } : {},
          }}
        />
      </Tooltip>
      {onSwitch && (
        <Menu
          anchorEl={anchorEl}
          open={!!anchorEl}
          onClose={() => setAnchorEl(null)}
          PaperProps={{ sx: { bgcolor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' } }}
        >
          <MenuItem disabled sx={{ fontSize: 11, opacity: 0.6 }}>
            BYTT TIL EN ANNEN MODUS
          </MenuItem>
          {switchableModes.map(([key, m]) => (
            <MenuItem
              key={key}
              onClick={() => {
                onSwitch(key as ProfessionMode);
                setAnchorEl(null);
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="flex-start">
                <Box sx={{ color: m.color, display: 'flex', mt: 0.3 }}>{m.icon}</Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {m.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {m.description}
                  </Typography>
                </Box>
              </Stack>
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  );
};

export default ProfessionModeChip;
