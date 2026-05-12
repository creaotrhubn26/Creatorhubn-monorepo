/**
 * AutoSaveBadge — erstatter den enkle Lagret/Lagrer/Ulagret-chippen med
 * en polert mikro-indikator som:
 *
 *   - Pulserer i 600ms grønt ved overgang 'saving' → 'saved' (subtil
 *     "lagret nå"-feiring uten å være pågående)
 *   - Roterer sync-ikonet jevnt mens lagring pågår
 *   - Viser "Lagret · 3s siden" relativ tid som oppdateres hvert 5s
 *   - Energy-aware fargekoder, ingen rød alarm — kun nøytral grå +
 *     soft amber for "ulagret" og rød for 'offline'
 *
 * Hensikt: trygghet om at arbeidet aldri går tapt + en liten belønning
 * når du ser "lagret" tikke i bakgrunnen.
 */

import React, { useEffect, useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import {
  Check as CheckIcon,
  Sync as SyncIcon,
  CloudOff as CloudOffIcon,
  EditNote as EditIcon,
} from '@mui/icons-material';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offline';

export interface AutoSaveBadgeProps {
  status: SaveStatus;
  /** ISO-tidsstempel for siste vellykkede lagring, hvis tilgjengelig. */
  lastSavedAt?: string | null;
  /** Optional click-handler, f.eks. for manuell lagring ved 'unsaved'. */
  onClick?: () => void;
}

function formatRelative(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 5) return 'akkurat nå';
  if (seconds < 60) return `${seconds}s siden`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m siden`;
  const hours = Math.floor(minutes / 60);
  return `${hours}t siden`;
}

const PALETTE: Record<SaveStatus, { bg: string; fg: string; icon: string }> = {
  saved: {
    bg: 'rgba(16,185,129,0.12)',
    fg: '#6ee7b7',
    icon: '#10b981',
  },
  saving: {
    bg: 'rgba(96,165,250,0.14)',
    fg: '#93c5fd',
    icon: '#60a5fa',
  },
  unsaved: {
    bg: 'rgba(245,158,11,0.12)',
    fg: '#fcd34d',
    icon: '#f59e0b',
  },
  offline: {
    bg: 'rgba(239,68,68,0.12)',
    fg: '#fca5a5',
    icon: '#ef4444',
  },
};

export const AutoSaveBadge: React.FC<AutoSaveBadgeProps> = ({ status, lastSavedAt, onClick }) => {
  const [now, setNow] = useState(Date.now());
  const [justSaved, setJustSaved] = useState(false);
  const [prevStatus, setPrevStatus] = useState<SaveStatus>(status);

  useEffect(() => {
    if (prevStatus === 'saving' && status === 'saved') {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 700);
      setPrevStatus(status);
      return () => clearTimeout(t);
    }
    setPrevStatus(status);
  }, [status, prevStatus]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(interval);
  }, []);

  const palette = PALETTE[status];
  const relative = status === 'saved' ? formatRelative(lastSavedAt, now) : '';

  const label =
    status === 'saving'
      ? 'Lagrer …'
      : status === 'unsaved'
        ? 'Endringer venter'
        : status === 'offline'
          ? 'Frakoblet'
          : relative
            ? `Lagret · ${relative}`
            : 'Lagret';

  const tooltip =
    status === 'saving'
      ? 'Synkroniserer endringene dine til server'
      : status === 'unsaved'
        ? 'Endringer venter på neste auto-save (~ 2s)'
        : status === 'offline'
          ? 'Fikk ikke kontakt med server — endringer venter lokalt'
          : 'Alt er trygt lagret';

  const icon =
    status === 'saving' ? (
      <SyncIcon sx={{ fontSize: 13, animation: 'storylogic-save-spin 1.2s linear infinite' }} />
    ) : status === 'unsaved' ? (
      <EditIcon sx={{ fontSize: 13 }} />
    ) : status === 'offline' ? (
      <CloudOffIcon sx={{ fontSize: 13 }} />
    ) : (
      <CheckIcon sx={{ fontSize: 13 }} />
    );

  return (
    <Tooltip title={tooltip} arrow>
      <Box
        component={onClick ? 'button' : 'span'}
        onClick={onClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          height: 22,
          borderRadius: 999,
          bgcolor: palette.bg,
          color: palette.fg,
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: 0.3,
          border: 'none',
          cursor: onClick ? 'pointer' : 'default',
          fontFamily: 'inherit',
          transition: 'background-color 200ms ease-out, transform 200ms ease-out',
          transform: justSaved ? 'scale(1.04)' : 'scale(1)',
          boxShadow: justSaved ? `0 0 0 4px ${palette.icon}22` : 'none',
          '& svg': { color: palette.icon },
          '@keyframes storylogic-save-spin': {
            from: { transform: 'rotate(0deg)' },
            to: { transform: 'rotate(360deg)' },
          },
        }}
      >
        {icon}
        {label}
      </Box>
    </Tooltip>
  );
};
