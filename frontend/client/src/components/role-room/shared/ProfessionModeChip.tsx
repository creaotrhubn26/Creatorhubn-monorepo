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
import type { ProfessionMode } from '../config/professionMode';

interface ProfessionModeChipProps {
  mode: ProfessionMode | string;
  onSwitch?: (mode: ProfessionMode) => void;
  /** Visningstekst hvis mode ikke matcher kjente. */
  fallbackLabel?: string;
}

const MODE_META: Record<string, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  dance_studio: {
    label: 'Studio-modus',
    icon: <StudioIcon />,
    description: 'Dansestudio — klasser, instruktører, rom og påmelding.',
    color: '#F5B82E',
  },
  dance_freelance: {
    label: 'Frilans-modus',
    icon: <FreelanceIcon />,
    description: 'Frilans-danser — koreografi, performances, faktura.',
    color: '#10B981',
  },
  casting: {
    label: 'Casting-modus',
    icon: <ContentIcon />,
    description: 'Casting — talenter, audition og produksjonsteam.',
    color: '#3B82F6',
  },
  education: {
    label: 'Utdannings-modus',
    icon: <EducationIcon />,
    description: 'Utdanningsinstitusjon — studenter, kurs og portfolio.',
    color: '#8B5CF6',
  },
  production: {
    label: 'Produksjons-modus',
    icon: <ProductionIcon />,
    description: 'Produksjon — prosjekter, team og leveranser.',
    color: '#EC4899',
  },
};

export const ProfessionModeChip: React.FC<ProfessionModeChipProps> = ({
  mode,
  onSwitch,
  fallbackLabel,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const meta = MODE_META[mode] ?? {
    label: fallbackLabel ?? String(mode),
    icon: <StudioIcon />,
    description: '',
    color: '#9CA3AF',
  };

  const switchableModes = Object.entries(MODE_META).filter(([k]) => k !== mode);

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
