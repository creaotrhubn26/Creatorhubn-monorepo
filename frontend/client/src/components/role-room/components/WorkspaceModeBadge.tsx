/**
 * WorkspaceModeBadge — tydelig indikator for hvilken modus brukeren er i
 * (Innholdsprodusent, Produksjonsteam, Klient-anmelder, Dans). Reduserer
 * mode-kaoset fra UX-auditen: brukeren ser øyeblikkelig hvem etiketter,
 * tabs og workflow er tilpasset for.
 */

import { Box, Chip, Tooltip } from '@mui/material';
import {
  MovieFilter as ProducerIcon,
  Theaters as ProductionIcon,
  Visibility as ClientIcon,
  MusicNote as DanceIcon,
  HelpOutline as UnknownIcon,
} from '@mui/icons-material';
import type { ComponentType } from 'react';

export type WorkspaceMode =
  | 'content_producer'
  | 'production_team'
  | 'client_reviewer'
  | 'dance'
  | 'admin';

interface WorkspaceModeBadgeProps {
  mode: WorkspaceMode;
  /** Vises i tooltip når man hover. */
  tooltip?: string;
  /** Klikkhandler — vanligvis "bytt modus". */
  onClick?: () => void;
}

interface ModeConfig {
  label: string;
  shortLabel: string;
  icon: ComponentType<{ sx?: object }>;
  bg: string;
  color: string;
  border: string;
}

const MODE_CONFIGS: Record<WorkspaceMode, ModeConfig> = {
  content_producer: {
    label: 'Innholdsprodusent',
    shortLabel: 'Producer',
    icon: ProducerIcon,
    bg: 'rgba(184,107,255,0.18)',
    color: '#e9d5ff',
    border: '1px solid rgba(184,107,255,0.42)',
  },
  production_team: {
    label: 'Produksjonsteam',
    shortLabel: 'Prod-team',
    icon: ProductionIcon,
    bg: 'rgba(255,184,0,0.16)',
    color: '#fde68a',
    border: '1px solid rgba(255,184,0,0.4)',
  },
  client_reviewer: {
    label: 'Klient',
    shortLabel: 'Klient',
    icon: ClientIcon,
    bg: 'rgba(59,130,246,0.18)',
    color: '#bfdbfe',
    border: '1px solid rgba(96,165,250,0.4)',
  },
  dance: {
    label: 'Dansestudio',
    shortLabel: 'Dans',
    icon: DanceIcon,
    bg: 'rgba(236,72,153,0.18)',
    color: '#fce7f3',
    border: '1px solid rgba(236,72,153,0.42)',
  },
  admin: {
    label: 'Administrator',
    shortLabel: 'Admin',
    icon: UnknownIcon,
    bg: 'rgba(148,163,184,0.18)',
    color: '#e2e8f0',
    border: '1px solid rgba(148,163,184,0.42)',
  },
};

export const WorkspaceModeBadge = ({ mode, tooltip, onClick }: WorkspaceModeBadgeProps) => {
  const config = MODE_CONFIGS[mode];
  const Icon = config.icon;
  const isInteractive = Boolean(onClick);

  const badge = (
    <Chip
      size="small"
      icon={<Icon sx={{ fontSize: 16, color: config.color }} />}
      label={(
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Modus:
          </Box>
          <Box component="span" sx={{ fontWeight: 800 }}>{config.label}</Box>
        </Box>
      )}
      onClick={onClick}
      clickable={isInteractive}
      sx={{
        height: 28,
        bgcolor: config.bg,
        color: config.color,
        border: config.border,
        fontSize: '0.78rem',
        fontWeight: 700,
        '& .MuiChip-icon': { color: config.color, marginLeft: '6px' },
        '& .MuiChip-label': { px: 1 },
        cursor: isInteractive ? 'pointer' : 'default',
        '&:hover': isInteractive ? {
          filter: 'brightness(1.08)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        } : undefined,
        transition: 'all 0.16s',
      }}
    />
  );

  if (tooltip) {
    return <Tooltip title={tooltip} arrow placement="bottom">{badge}</Tooltip>;
  }
  return badge;
};

export default WorkspaceModeBadge;
