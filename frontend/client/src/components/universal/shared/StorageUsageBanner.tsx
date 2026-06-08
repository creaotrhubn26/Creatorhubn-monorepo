/**
 * StorageUsageBanner — viser brukerens lagringsbruk vs plan-grense.
 *
 * Henter fra /api/storage/status hvert minutt (eller på event-trigger).
 * Rendrer:
 *   - Progress-bar med farge basert på usedFraction (grønn → gul → rød)
 *   - Tier-navn + "X GB av Y GB brukt"
 *   - CTA: "Oppgrader" hvis ≥80% og planen er hard-cap (prototype/basic/trial)
 *   - CTA: "Slett filer" hvis ≥95% uansett plan
 *   - Status-melding hvis overage er aktiv på pro/premium/enterprise
 *
 * Brukes som compact-variant i header og expanded-variant i innstillings-tab.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Button,
  Stack,
  Tooltip,
  Chip,
  alpha,
} from '@mui/material';
import {
  CloudQueue as StorageIcon,
  Warning as WarningIcon,
  Upgrade as UpgradeIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface StorageStatusResponse {
  success: boolean;
  tier: string;
  usedBytes: number;
  limitBytes: number;
  freeBytes: number;
  usedFraction: number;
  overageBytes: number;
  overageGB: number;
  allowsOverage: boolean;
  stripeSubscriptionId: string | null;
  meteredItemConfigured: boolean;
}

interface Props {
  variant?: 'compact' | 'expanded';
  pollIntervalMs?: number;
  onUpgradeClick?: () => void;
  onManageFilesClick?: () => void;
}

const GIB = 1024 * 1024 * 1024;
const MIB = 1024 * 1024;

const formatBytes = (bytes: number): string => {
  if (bytes >= GIB) return `${(bytes / GIB).toFixed(bytes < 10 * GIB ? 2 : 1)} GB`;
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(0)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
};

const tierLabel = (tier: string): string => {
  const map: Record<string, string> = {
    prototype: 'Prototype',
    trial: 'Trial',
    basic: 'Basic Creator',
    professional: 'Professional Creator',
    premium: 'Premium Studio',
    enterprise: 'Enterprise',
    unknown: 'Gratis',
  };
  return map[tier] || tier;
};

const progressColor = (
  fraction: number,
): 'success' | 'warning' | 'error' => {
  if (fraction >= 0.95) return 'error';
  if (fraction >= 0.8) return 'warning';
  return 'success';
};

export const StorageUsageBanner: React.FC<Props> = ({
  variant = 'compact',
  pollIntervalMs = 60_000,
  onUpgradeClick,
  onManageFilesClick,
}) => {
  const [status, setStatus] = useState<StorageStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchStatus = async () => {
      try {
        // apiRequest vedlegger session-token automatisk via Authorization-
        // header. Backend leser ikke cookies for auth, så 'credentials:
        // include' hadde ingen effekt + ga 401-spam i konsollen.
        let data: any;
        try {
          data = await apiRequest('/api/storage/status');
        } catch (err: any) {
          const status = typeof err?.status === 'number' ? err.status
            : /401/.test(String(err?.message)) ? 401 : 0;
          if (status === 401) {
            if (interval) { clearInterval(interval); interval = null; }
            if (!cancelled) setError('auth');
            return;
          }
          throw err;
        }
        // For å beholde resten av kode-stien (som forventer res.json()), pakk inn:
        const res = { ok: true, json: async () => data, status: 200 } as any;
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data = (await res.json()) as StorageStatusResponse;
        if (!cancelled) {
          setStatus(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void fetchStatus();
    interval = setInterval(fetchStatus, pollIntervalMs);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [pollIntervalMs]);

  if (error && !status) {
    // Stille — vi vil ikke spamme brukeren hvis endepunktet er nede
    return null;
  }
  if (!status) return null;

  const fraction = Math.min(1.5, Math.max(0, status.usedFraction));
  const color = progressColor(fraction);
  const isHardCapTier =
    status.tier === 'prototype' ||
    status.tier === 'basic' ||
    status.tier === 'trial' ||
    status.tier === 'unknown';
  const isOverage = status.overageBytes > 0;
  const isWarning = fraction >= 0.8;
  const isCritical = fraction >= 0.95;

  const showUpgrade = isWarning && isHardCapTier && !!onUpgradeClick;
  const showManage = isCritical && !!onManageFilesClick;

  if (variant === 'compact') {
    return (
      <Tooltip
        title={
          <Box>
            <Typography variant="caption" sx={{ display: 'block' }}>
              {tierLabel(status.tier)} — {formatBytes(status.usedBytes)} av{' '}
              {formatBytes(status.limitBytes)}
            </Typography>
            {isOverage && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                Overforbruk: {status.overageGB} GB
                {status.allowsOverage
                  ? ' (faktureres via Stripe)'
                  : ' — oppgrader for å fortsette'}
              </Typography>
            )}
          </Box>
        }
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            bgcolor: (theme) =>
              alpha(theme.palette[color].main, 0.12),
            cursor: showUpgrade || showManage ? 'pointer' : 'default',
          }}
          onClick={() => {
            if (showUpgrade) onUpgradeClick?.();
            else if (showManage) onManageFilesClick?.();
          }}
        >
          <StorageIcon
            fontSize="small"
            color={isCritical ? 'error' : isWarning ? 'warning' : 'inherit'}
          />
          <Box sx={{ minWidth: 80 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, fraction * 100)}
              color={color}
              sx={{ height: 6, borderRadius: 3 }}
            />
            <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
              {formatBytes(status.usedBytes)} /{' '}
              {formatBytes(status.limitBytes)}
            </Typography>
          </Box>
        </Stack>
      </Tooltip>
    );
  }

  // expanded variant
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: (theme) =>
          alpha(theme.palette[color].main, 0.3),
        bgcolor: (theme) =>
          alpha(theme.palette[color].main, 0.05),
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <StorageIcon />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Lagring
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tierLabel(status.tier)}
            </Typography>
          </Box>
        </Stack>
        <Chip
          label={`${formatBytes(status.usedBytes)} av ${formatBytes(status.limitBytes)}`}
          color={color}
          size="small"
        />
      </Stack>

      <LinearProgress
        variant="determinate"
        value={Math.min(100, fraction * 100)}
        color={color}
        sx={{ height: 10, borderRadius: 5, mb: 1.5 }}
      />

      {isOverage && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <WarningIcon
            fontSize="small"
            color={status.allowsOverage ? 'warning' : 'error'}
          />
          <Typography
            variant="body2"
            color={status.allowsOverage ? 'warning.main' : 'error.main'}
          >
            Overforbruk: {status.overageGB} GB
            {status.allowsOverage
              ? ` — faktureres automatisk via Stripe${
                  !status.meteredItemConfigured
                    ? ' (metered item ikke konfigurert ennå)'
                    : ''
                }`
              : ' — du har nådd plan-grensen, slett filer eller oppgrader'}
          </Typography>
        </Stack>
      )}

      {!isOverage && isWarning && (
        <Typography
          variant="body2"
          color={isCritical ? 'error.main' : 'warning.main'}
          sx={{ mb: 1.5 }}
        >
          {isCritical
            ? `Mindre enn ${formatBytes(status.freeBytes)} igjen — slett filer eller oppgrader snart.`
            : `${Math.round((1 - fraction) * 100)}% av lagringen er igjen.`}
        </Typography>
      )}

      <Stack direction="row" spacing={1}>
        {showUpgrade && (
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<UpgradeIcon />}
            onClick={onUpgradeClick}
          >
            Oppgrader plan
          </Button>
        )}
        {(showManage || isWarning) && onManageFilesClick && (
          <Button
            variant="outlined"
            size="small"
            onClick={onManageFilesClick}
          >
            Administrer filer
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default StorageUsageBanner;
