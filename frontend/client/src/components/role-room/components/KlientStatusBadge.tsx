/**
 * KlientStatusBadge — kompakt pille som viser klient-godkjenningsstatus
 * på tab-labels og andre kompakte UI-områder.
 */

import { Box } from '@mui/material';

export type KlientStatus = 'planning' | 'awaiting_client' | 'changes_requested' | 'approved';

interface KlientStatusBadgeProps {
  status: KlientStatus | null | undefined;
  size?: 'xs' | 'sm';
}

const STATUS_CONFIG: Record<KlientStatus, { label: string; bg: string; color: string; border: string }> = {
  planning: {
    label: 'Planlegging',
    bg: 'rgba(148,163,184,0.18)',
    color: '#cbd5e1',
    border: '1px solid rgba(148,163,184,0.32)',
  },
  awaiting_client: {
    label: 'Venter klient',
    bg: 'rgba(59,130,246,0.2)',
    color: '#bfdbfe',
    border: '1px solid rgba(96,165,250,0.4)',
  },
  changes_requested: {
    label: 'Endringer',
    bg: 'rgba(251,146,60,0.2)',
    color: '#fed7aa',
    border: '1px solid rgba(251,146,60,0.4)',
  },
  approved: {
    label: 'Godkjent',
    bg: 'rgba(34,197,94,0.2)',
    color: '#bbf7d0',
    border: '1px solid rgba(34,197,94,0.4)',
  },
};

export const KlientStatusBadge = ({ status, size = 'xs' }: KlientStatusBadgeProps) => {
  if (!status) return null;
  const config = STATUS_CONFIG[status];

  const isXs = size === 'xs';

  return (
    <Box
      component="span"
      role="status"
      aria-label={`Klient-status: ${config.label}`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: isXs ? 0.65 : 0.85,
        py: isXs ? 0.1 : 0.25,
        fontSize: isXs ? '0.6rem' : '0.7rem',
        fontWeight: 700,
        letterSpacing: 0.3,
        borderRadius: 0.75,
        bgcolor: config.bg,
        color: config.color,
        border: config.border,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </Box>
  );
};

export default KlientStatusBadge;
