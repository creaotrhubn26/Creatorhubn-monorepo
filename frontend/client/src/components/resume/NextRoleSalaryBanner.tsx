/**
 * NextRoleSalaryBanner — SSB-basert lønnsestimat-nudge.
 *
 * Henter median månedslønn fra /api/marketplace/next-role/salary-estimate
 * basert på brukerens jobbtittel og viser et lite informasjonsbanner:
 *
 *   "Folk med stillingen 'Senior Content Manager' tjener i snitt
 *    62 400 kr/mnd (748 800 kr/år). Kilde: SSB 2024"
 *
 * Brukes både som motivasjon ("se hvor mye andre tjener") og
 * forhandlingshjelp ("er du underbetalt?"). Skjules pent hvis SSB ikke
 * har data eller jobbtittelen ikke matcher noen STYRK-kode.
 */

import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Stack, Paper, IconButton, Chip, Tooltip, Skeleton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Close as CloseIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

function trackGA4(eventName: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') w.gtag('event', eventName, params);
  } catch {
    /* noop */
  }
}

interface Props {
  jobTitle: string | null | undefined;
  /** Lagre dismiss-tilstand på CV-id-nivå så den ikke vises igjen for samme CV. */
  dismissKey?: string;
}

interface Estimate {
  matched: boolean;
  styrkLabel?: string;
  matchScore?: number;
  medianMonthly?: number | null;
  p25Monthly?: number | null;
  p75Monthly?: number | null;
  medianAnnual?: number | null;
  year?: number | null;
  source?: string;
  error?: string;
}

const DISMISS_PREFIX = 'nextrole:salary-banner-dismissed:';

function formatNok(amount: number): string {
  return amount.toLocaleString('no-NO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export const NextRoleSalaryBanner: React.FC<Props> = ({ jobTitle, dismissKey }) => {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !dismissKey) return false;
    return window.localStorage.getItem(DISMISS_PREFIX + dismissKey) === '1';
  });

  useEffect(() => {
    if (!jobTitle || jobTitle.trim().length < 3) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = (await apiRequest(
          `/api/marketplace/next-role/salary-estimate?jobTitle=${encodeURIComponent(jobTitle.trim())}`,
        )) as Estimate;
        if (cancelled) return;
        setEstimate(data);
        if (data.matched && data.medianMonthly) {
          trackGA4('nextrole_salary_estimate_viewed', {
            styrk_code: (data as { styrkCode?: string }).styrkCode ?? null,
            median_monthly: data.medianMonthly,
            match_score: data.matchScore ?? null,
          });
        }
      } catch (err) {
        // Stille feil — vi har ikke et banner å vise hvis APIet feiler.
        console.warn('Salary estimate fetch failed', err);
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobTitle]);

  const handleDismiss = () => {
    setDismissed(true);
    if (dismissKey && typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_PREFIX + dismissKey, '1');
    }
    trackGA4('nextrole_salary_banner_dismissed', { job_title: jobTitle });
  };

  if (dismissed) return null;
  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: '#F9FAFB' }}>
        <Skeleton variant="text" width="60%" />
      </Paper>
    );
  }
  if (!estimate || !estimate.matched || !estimate.medianMonthly) return null;

  const median = estimate.medianMonthly;
  const annual = estimate.medianAnnual ?? median * 12;
  const year = estimate.year ?? null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        background: 'linear-gradient(90deg, #FFF8E1 0%, #FAFAFA 100%)',
        borderColor: '#F5B82E',
        borderLeftWidth: 4,
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <TrendingUpIcon sx={{ color: '#F5B82E', mt: 0.3 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: '#1F2937', mb: 0.4 }}>
            <Box component="span" sx={{ fontWeight: 700 }}>
              Folk i din stilling tjener i snitt{' '}
            </Box>
            <Box component="span" sx={{ fontWeight: 800, color: '#7A5A0B' }}>
              {formatNok(median)} kr/mnd
            </Box>
            {annual && (
              <>
                {' '}
                <Box component="span" sx={{ color: '#6B7280' }}>
                  ({formatNok(annual)} kr/år)
                </Box>
              </>
            )}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary">
              {estimate.styrkLabel}
            </Typography>
            {estimate.p25Monthly && estimate.p75Monthly && (
              <Chip
                label={`Spennvidde: ${formatNok(estimate.p25Monthly)} – ${formatNok(estimate.p75Monthly)} kr`}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 11 }}
              />
            )}
            <Tooltip
              title={estimate.source ?? 'SSB statistikkbank'}
              placement="top"
              arrow
            >
              <Chip
                icon={<InfoIcon sx={{ fontSize: 14 }} />}
                label={`SSB${year ? ` ${year}` : ''}`}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 11 }}
              />
            </Tooltip>
          </Stack>
        </Box>
        <IconButton onClick={handleDismiss} size="small" title="Skjul">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
};

export default NextRoleSalaryBanner;
