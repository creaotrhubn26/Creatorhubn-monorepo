/**
 * StripeConnectCard.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Fotografens Stripe Connect-kobling. Vises i Universal Dashboard sitt
 * settings-panel OG som første steg i onboardingen — slik at en skaper kan
 * koble sin egen Stripe-konto med én gang de entrer CreatorHub. Bildekjøp
 * betales da til fotografens egen konto (ikke CreatorHub).
 *
 * Backend: GET /api/photographer/stripe/status, POST /api/photographer/stripe/connect
 * (se photographer-stripe-connect-routes.ts).
 */

import React from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import {
  AccountBalance,
  CheckCircle,
  OpenInNew,
  ErrorOutline,
  HourglassEmpty,
} from '@mui/icons-material';

interface StripeStatus {
  connected: boolean;
  accountId?: string;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
  onboardingStatus?: string; // not_started | pending | complete
  stripeConfigured?: boolean;
}

// Warm cinematic tokens (matcher showcaseCinematic.ts uten å koble settings-
// panelet til showcase-modulen).
const SURFACE = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT = '#F5F2EA';
const TEXT_MUTED = 'rgba(245,242,234,0.64)';
const ACCENT = '#FF6B35';
const SUCCESS = '#5fb88a';
const WARN = '#e0a955';

interface Props {
  /** Kompakt variant for onboarding-steget (mindre luft). */
  compact?: boolean;
  /** Kalles når statusen er ferdig lastet — onboarding kan låse opp «neste». */
  onStatusLoaded?: (status: StripeStatus) => void;
}

export default function StripeConnectCard({ compact = false, onStatusLoaded }: Props) {
  const [status, setStatus] = React.useState<StripeStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await apiRequest('/api/photographer/stripe/status')) as StripeStatus;
      setStatus(data);
      onStatusLoaded?.(data);
    } catch (e) {
      // Kan ikke hente status (f.eks. ikke innlogget) → vis «koble til»-CTA.
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [onStatusLoaded]);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleConnect = React.useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const data = (await apiRequest('/api/photographer/stripe/connect', {
        method: 'POST',
        body: { country: 'NO' },
      })) as { onboardingUrl?: string };
      if (!data?.onboardingUrl) throw new Error('Mangler onboarding-lenke.');
      // Redirect til Stripe-onboarding; brukeren kommer tilbake til /dashboard.
      window.location.href = data.onboardingUrl;
    } catch (e: any) {
      setError(
        e?.status === 401
          ? 'Du må være innlogget for å koble til Stripe.'
          : (e?.message || 'Kunne ikke starte Stripe-kobling.'),
      );
      setConnecting(false);
    }
  }, []);

  const isComplete = status?.connected && status?.payoutsEnabled;
  const isPending = status?.connected && !status?.payoutsEnabled;

  const statusChip = (() => {
    if (loading) return null;
    if (isComplete) {
      return <Chip icon={<CheckCircle />} label="Tilkoblet · utbetalinger aktive" size="small"
        sx={{ bgcolor: 'rgba(95,184,138,0.16)', color: SUCCESS, '& .MuiChip-icon': { color: SUCCESS } }} />;
    }
    if (isPending) {
      return <Chip icon={<HourglassEmpty />} label="Påbegynt · fullfør verifisering" size="small"
        sx={{ bgcolor: 'rgba(224,169,85,0.16)', color: WARN, '& .MuiChip-icon': { color: WARN } }} />;
    }
    return <Chip icon={<ErrorOutline />} label="Ikke tilkoblet" size="small"
      sx={{ bgcolor: 'rgba(245,242,234,0.08)', color: TEXT_MUTED, '& .MuiChip-icon': { color: TEXT_MUTED } }} />;
  })();

  return (
    <Box
      sx={{
        bgcolor: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: '14px',
        p: compact ? 2.5 : 3,
        color: TEXT,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '10px', flexShrink: 0,
          bgcolor: 'rgba(255,107,53,0.14)', color: ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AccountBalance />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: TEXT }}>
            Utbetalinger (Stripe)
          </Typography>
          <Typography sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>
            Bildekjøp betales direkte til din egen Stripe-konto.
          </Typography>
        </Box>
        {statusChip}
      </Stack>

      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1.5, color: TEXT_MUTED }}>
          <CircularProgress size={16} sx={{ color: ACCENT }} />
          <Typography sx={{ fontSize: '0.85rem' }}>Henter status…</Typography>
        </Stack>
      ) : (
        <>
          <Typography sx={{ color: TEXT_MUTED, fontSize: '0.85rem', mb: 2, lineHeight: 1.55 }}>
            {isComplete
              ? 'Kontoen din er klar. Kunder kan kjøpe ekstra bilder, og pengene går rett til deg (CreatorHub håndterer ikke pengene dine).'
              : isPending
                ? 'Du har startet koblingen, men Stripe mangler litt informasjon før utbetalinger kan aktiveres. Fullfør verifiseringen.'
                : 'Koble til Stripe for å kunne ta betalt for bildekjøp. Det tar et par minutter, og du beholder full kontroll over egen konto.'}
          </Typography>

          {error && (
            <Typography sx={{ color: '#e0606a', fontSize: '0.8rem', mb: 1.5 }}>{error}</Typography>
          )}

          <Button
            variant="contained"
            onClick={handleConnect}
            disabled={connecting}
            startIcon={connecting ? <CircularProgress size={16} sx={{ color: '#150d05' }} /> : <OpenInNew />}
            sx={{
              bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none',
              borderRadius: '999px', px: 3, py: 1.1,
              '&:hover': { bgcolor: '#ff855a' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,107,53,0.4)', color: 'rgba(21,13,5,0.6)' },
            }}
          >
            {isComplete ? 'Administrer i Stripe' : isPending ? 'Fullfør verifisering' : 'Koble til Stripe'}
          </Button>
        </>
      )}
    </Box>
  );
}
