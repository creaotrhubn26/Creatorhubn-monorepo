// B2UsageWidget — kompakt dashboard-widget som surface'r status
// fra brukerens egne B2-credentials. Klikkbar — navigerer til
// /photographer/settings#b2 hvor UserB2Panel rendrer.
//
// Vises som "Mitt B2: 234 filer · 8.7 GB · ~4 NOK/mnd · Sist synket 3 t siden".
// Hvis credentials ikke finnes: CTA "Sett opp B2 for å eie originalene dine".
//
// Backend (annen agent leverer):
//   GET /api/user/b2-credentials        → { exists, ... }
//   GET /api/user/b2-credentials/stats  → { totalFiles, totalBytes, estimatedMonthlyCostUsd, lastSyncedAt }

import React from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Storage, Cloud, Sync } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface B2CredentialsStatus {
  exists: boolean;
  bucketName?: string | null;
  lastSyncedAt?: string | null;
}

interface B2Stats {
  totalFiles: number;
  totalBytes: number;
  estimatedMonthlyCostUsd: number;
  lastSyncedAt?: string | null;
}

const USD_TO_NOK = 10.8; // grov peiling — backend leverer kun USD

const PANEL_SX = {
  bgcolor: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(8px)',
  color: '#fff',
  borderRadius: 2,
  p: 2,
  cursor: 'pointer',
  transition: 'background 0.18s, border-color 0.18s',
  '&:hover': {
    bgcolor: 'rgba(255,255,255,0.09)',
    borderColor: 'rgba(96,165,250,0.4)',
  },
} as const;

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  const decimals = value >= 100 || i === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

function formatTimeAgo(iso: string | null | undefined): string {
  if (!iso) return 'aldri';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ukjent';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return 'akkurat nå';
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} min siden`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} t siden`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} dager siden`;
}

export interface B2UsageWidgetProps {
  /** Hvor brukeren navigeres når widgeten klikkes. Default `/photographer/settings#b2`. */
  settingsHref?: string;
}

export default function B2UsageWidget({
  settingsHref = '/photographer/settings#b2',
}: B2UsageWidgetProps) {
  const [, navigate] = useLocation();

  const { data: credentials, isLoading: credentialsLoading } = useQuery<B2CredentialsStatus>({
    queryKey: ['/api/user/b2-credentials'],
    queryFn: () => apiRequest('/api/user/b2-credentials'),
  });

  const credentialsExist = !!credentials?.exists;

  const { data: stats, isLoading: statsLoading } = useQuery<B2Stats>({
    queryKey: ['/api/user/b2-credentials/stats'],
    queryFn: () => apiRequest('/api/user/b2-credentials/stats'),
    enabled: credentialsExist,
  });

  const handleNavigate = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    navigate(settingsHref);
  };

  // Loading state
  if (credentialsLoading) {
    return (
      <Paper sx={PANEL_SX} data-testid="b2-usage-widget-loading">
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Henter B2-status…
          </Typography>
        </Stack>
      </Paper>
    );
  }

  // Ingen credentials — CTA
  if (!credentialsExist) {
    return (
      <Paper
        sx={PANEL_SX}
        onClick={handleNavigate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleNavigate(e);
        }}
        data-testid="b2-usage-widget-empty"
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Cloud sx={{ color: '#60a5fa' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
              Sett opp B2 for å eie originalene dine
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
              Direkte til ditt eget Backblaze-arkiv
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            onClick={handleNavigate}
            sx={{ flexShrink: 0 }}
          >
            Sett opp
          </Button>
        </Stack>
      </Paper>
    );
  }

  // Statisk fallback hvis stats fortsatt laster
  const totalFiles = stats?.totalFiles ?? 0;
  const totalBytes = stats?.totalBytes ?? 0;
  const monthlyUsd = stats?.estimatedMonthlyCostUsd ?? 0;
  const monthlyNok = Math.round(monthlyUsd * USD_TO_NOK);
  const lastSynced = stats?.lastSyncedAt ?? credentials?.lastSyncedAt ?? null;

  return (
    <Paper
      sx={PANEL_SX}
      onClick={handleNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleNavigate(e);
      }}
      aria-label="Åpne mitt B2-arkiv"
      data-testid="b2-usage-widget"
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Storage sx={{ color: '#60a5fa', fontSize: 32 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
            Mitt B2: {totalFiles.toLocaleString('nb-NO')} filer · {formatBytes(totalBytes)}
          </Typography>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ mt: 0.25, flexWrap: 'wrap' }}
          >
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              ~ {monthlyNok} NOK/mnd Backblaze-kostnad
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Sync sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                Sist synket {formatTimeAgo(lastSynced)}
              </Typography>
            </Stack>
            {statsLoading && <CircularProgress size={12} />}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
