/**
 * NextRoleTrialBanner
 *
 * Vises øverst i editor når brukeren er i 14-dagers trial. Countdown
 * + tydelig CTA for å oppgradere til Standard. Lukke-knapp persisterer
 * dismiss i localStorage, men auto-revises dagen etter (siden trialen
 * forsvinner snart må brukeren tas på alvor).
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Stack, IconButton, LinearProgress } from '@mui/material';
import { Close as CloseIcon, Bolt as BoltIcon } from '@mui/icons-material';
import { useLocation } from 'wouter';
import { useNextRoleEntitlements } from '@/hooks/useNextRoleEntitlements';

const DISMISS_KEY = 'nextrole:trial-banner-dismissed-date';

function isDismissedToday(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(DISMISS_KEY);
  if (!stored) return false;
  return stored === new Date().toISOString().slice(0, 10);
}

export const NextRoleTrialBanner: React.FC = () => {
  const ent = useNextRoleEntitlements();
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(isDismissedToday);

  useEffect(() => {
    if (dismissed && typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10));
    }
  }, [dismissed]);

  // Vis kun for trial-brukere
  if (!ent.isTrial || dismissed) return null;
  const daysLeft = ent.trialDaysLeft ?? 14;
  const trialTotal = ent.pricing.trialDays;
  const usedDays = Math.max(0, trialTotal - daysLeft);
  const progressPct = Math.min(100, (usedDays / trialTotal) * 100);
  const urgency = daysLeft <= 3 ? 'high' : daysLeft <= 7 ? 'medium' : 'low';
  const bgGradient =
    urgency === 'high'
      ? 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)'
      : urgency === 'medium'
      ? 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)'
      : 'linear-gradient(135deg, rgba(245, 184, 46,0.10) 0%, rgba(99, 102, 241, 0.06) 100%)';
  const accentColor =
    urgency === 'high' ? '#DC2626' : urgency === 'medium' ? '#D97706' : '#F5B82E';

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        background: bgGradient,
        border: '1px solid',
        borderColor: urgency === 'high' ? 'rgba(220, 38, 38, 0.3)' : 'rgba(245, 184, 46,0.25)',
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={2}>
        <BoltIcon sx={{ color: accentColor, fontSize: 28 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0F172A' }}>
            {daysLeft === 0
              ? 'Trial utløper i dag — oppgrader nå for å beholde alt'
              : daysLeft === 1
              ? 'Bare 1 dag igjen av trial'
              : `${daysLeft} dager igjen av prøveperioden`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
            {urgency === 'high'
              ? 'Mister du Pro-features mister du tilgangen til AI-søknadsbrev, intervjuprep, oversettelse, versjon-historikk og ubegrensede CV-er.'
              : urgency === 'medium'
              ? 'Etter trialen koster Standard kun 49 kr/mnd. Oppgrader nå og lås inn kampanjepris.'
              : 'Du har full Pro-tilgang ut prøveperioden. Etter det: Standard 49 kr/mnd eller Pro 99 kr/mnd.'}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{
              mt: 1,
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(0,0,0,0.08)',
              '& .MuiLinearProgress-bar': { bgcolor: accentColor },
            }}
          />
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button
            variant="contained"
            size="small"
            sx={{
              bgcolor: accentColor,
              fontWeight: 700,
              px: 2,
              '&:hover': { bgcolor: accentColor, filter: 'brightness(0.92)' },
            }}
            onClick={() => setLocation('/nextrole')}
          >
            {daysLeft <= 3 ? 'Oppgrader nå' : 'Se priser'}
          </Button>
          <IconButton size="small" onClick={() => setDismissed(true)} title="Skjul i dag">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Box>
  );
};

export default NextRoleTrialBanner;
