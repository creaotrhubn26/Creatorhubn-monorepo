/**
 * PlanUsageBar.tsx
 *
 * Persistent progress-bar for innloggede brukere, viser:
 *  - Hvilken plan org'en er på
 *  - Hvor mye av månedens kvote som er brukt (auto-onboards, customers)
 *  - Banner i grace-perioden m/ countdown
 *  - "Oppgrader"-CTA hvis nær grensen eller på Free
 *
 * Forventer at parent gir `orgId` (eller er omsluttet i en context som
 * gir det). Henter fra /api/leadgrid/plan/summary.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Stack, Typography, LinearProgress, Button, Tooltip, Chip,
  CircularProgress,
} from '@mui/material';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface PlanSummary {
  plan_key: string;
  display_name: string;
  in_grace: boolean;
  grace_expires_at?: string;
  limits: {
    max_active_customers: number | null;
    max_auto_onboards_per_month: number | null;
    price_monthly_nok: number;
  };
  usage: {
    customers_active: number;
    auto_onboards_this_month: number;
  };
  pct: {
    customers: number;
    auto_onboards: number;
  };
}

interface Props {
  orgId: string;
  /** Vis kun progress-bar (kompakt for header), eller full m/ KPI */
  variant?: 'compact' | 'full';
  /** Callback når brukeren klikker oppgrader */
  onUpgradeClick?: () => void;
}

export function PlanUsageBar({ orgId, variant = 'compact', onUpgradeClick }: Props) {
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/leadgrid/plan/summary?orgId=${orgId}`, {
        credentials: 'include',
      });
      if (r.ok) setSummary(await r.json());
    } catch { /* swallow */ }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
    // Re-load hvert 60. sekund så bar oppdateres etter auto-onboard
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !summary) {
    return variant === 'compact' ? null : (
      <Box sx={{ p: 2 }}><CircularProgress size={20} /></Box>
    );
  }

  const isFree = summary.plan_key === 'solo_free';
  // Vis upgrade-CTA hvis: på Free + >50% brukt, eller hvilken som helst plan >80% brukt
  const showUpgrade = isFree
    ? summary.pct.auto_onboards > 50 || summary.pct.customers > 50
    : summary.pct.auto_onboards > 80 || summary.pct.customers > 80;

  // Compact: vises i top-nav. Liten progress + kort tekst.
  if (variant === 'compact') {
    const highestPct = Math.max(summary.pct.auto_onboards, summary.pct.customers);
    if (highestPct === 0 && !summary.in_grace) return null;
    const color = highestPct >= 90 ? '#ff6b6b'
                : highestPct >= 70 ? '#ffb86b'
                : '#a78bfa';
    return (
      <Tooltip title={
        <Box>
          <Typography variant="caption" display="block">
            {summary.display_name}
          </Typography>
          <Typography variant="caption" display="block">
            Auto-onboards: {summary.usage.auto_onboards_this_month}/{summary.limits.max_auto_onboards_per_month ?? '∞'}
          </Typography>
          <Typography variant="caption" display="block">
            Kunder: {summary.usage.customers_active}/{summary.limits.max_active_customers ?? '∞'}
          </Typography>
        </Box>
      }>
        <Stack
          direction="row" alignItems="center" spacing={1}
          sx={{
            px: 1.5, py: 0.5, borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.04)',
            cursor: showUpgrade ? 'pointer' : 'default',
          }}
          onClick={() => showUpgrade && onUpgradeClick?.()}
        >
          {summary.in_grace && (
            <WarningAmberIcon sx={{ color: '#ffb86b', fontSize: 18 }} />
          )}
          <Box sx={{ width: 80 }}>
            <LinearProgress
              variant="determinate" value={highestPct}
              sx={{
                height: 4, borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 },
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {summary.display_name}
          </Typography>
          {showUpgrade && (
            <Chip
              size="small" label="Oppgrader" icon={<UpgradeIcon sx={{ fontSize: 14 }} />}
              sx={{ bgcolor: '#a78bfa', color: '#1a0535', fontWeight: 700, height: 22 }}
            />
          )}
        </Stack>
      </Tooltip>
    );
  }

  // Full variant — for in-app sidepanel/dashboard
  return (
    <Box sx={{
      p: 3, borderRadius: 2, bgcolor: 'rgba(167,139,250,0.06)',
      border: '1px solid rgba(167,139,250,0.18)',
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Plan
          </Typography>
          <Typography variant="h6">{summary.display_name}</Typography>
        </Box>
        {showUpgrade && (
          <Button
            variant="contained" size="small" startIcon={<UpgradeIcon />}
            onClick={() => onUpgradeClick?.()}
            sx={{ bgcolor: '#a78bfa', color: '#1a0535', fontWeight: 700 }}
          >
            Oppgrader
          </Button>
        )}
      </Stack>

      {summary.in_grace && summary.grace_expires_at && (
        <Box sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'rgba(255,184,107,0.10)',
                   border: '1px solid rgba(255,184,107,0.30)' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <WarningAmberIcon sx={{ color: '#ffb86b' }} />
            <Typography variant="caption" sx={{ color: '#ffb86b' }}>
              Grace-periode utløper {new Date(summary.grace_expires_at).toLocaleDateString('no-NO')}
            </Typography>
          </Stack>
        </Box>
      )}

      <Stack spacing={2}>
        <UsageMeter
          label="Auto-onboards denne måneden"
          used={summary.usage.auto_onboards_this_month}
          max={summary.limits.max_auto_onboards_per_month}
          pct={summary.pct.auto_onboards}
        />
        <UsageMeter
          label="Aktive kunder"
          used={summary.usage.customers_active}
          max={summary.limits.max_active_customers}
          pct={summary.pct.customers}
        />
      </Stack>
    </Box>
  );
}

function UsageMeter({ label, used, max, pct }: { label: string; used: number; max: number | null; pct: number }) {
  const color = pct >= 90 ? '#ff6b6b' : pct >= 70 ? '#ffb86b' : '#a78bfa';
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={0.5}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>{label}</Typography>
        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
          {used} / {max ?? '∞'}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate" value={max == null ? 0 : pct}
        sx={{
          height: 6, borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.08)',
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
        }}
      />
    </Box>
  );
}
