/**
 * PostAgentCrewWelcomeBanner — first-sign-in nudge for crew members who
 * have just been granted a Post Agent team-seat. Shown at the top of the
 * Role Room dashboard, dismissible per-seat-set (when the seat-set changes,
 * the dismiss-flag resets so a new grant triggers a fresh banner).
 *
 * Hidden for the project lead (who already sees the PostAgentReadyCard
 * inside the selected project's panel — different UX context).
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  AutoFixHigh as PostAgentIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { apiRequest } from '../../../lib/queryClient';

interface Seat {
  projectId: string;
  projectName: string;
  projectType?: string;
  grantedAt?: string;
}

const ACCENT = '#a030c0';
const DISMISS_KEY_PREFIX = 'trrpa_crew_welcome_seen_';

function useMySeats() {
  return useQuery<{ seats: Seat[] }>({
    queryKey: ['post-agent-my-seats'],
    queryFn: async () => {
      const res = await apiRequest('/api/post-agent/team/my-seats').catch(() => null);
      const data = (res as any)?.json ? await (res as any).json() : res;
      return { seats: Array.isArray(data?.seats) ? data.seats : [] };
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export const PostAgentCrewWelcomeBanner: React.FC = () => {
  const { data } = useMySeats();
  const seats = data?.seats ?? [];

  // Key includes the sorted seat IDs so a *new* grant re-triggers the banner
  // even after the user dismissed an earlier version.
  const dismissKey = useMemo(() => {
    if (seats.length === 0) return null;
    const ids = seats.map((s) => s.projectId).sort().join(',');
    return DISMISS_KEY_PREFIX + ids;
  }, [seats]);

  const initialDismissed = useMemo(() => {
    if (!dismissKey || typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(dismissKey) === '1';
    } catch {
      return false;
    }
  }, [dismissKey]);

  const [dismissed, setDismissed] = useState(initialDismissed);

  if (seats.length === 0 || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    if (dismissKey && typeof window !== 'undefined') {
      try { window.localStorage.setItem(dismissKey, '1'); } catch { /* ignore */ }
    }
  };

  const productionNames = seats.map((s) => s.projectName).filter(Boolean);
  const productionList =
    productionNames.length === 1
      ? productionNames[0]
      : productionNames.length === 2
        ? productionNames.join(' og ')
        : productionNames.slice(0, -1).join(', ') + ' og ' + productionNames[productionNames.length - 1];

  return (
    <Alert
      icon={false}
      severity="info"
      sx={{
        mb: 2,
        background: `linear-gradient(135deg, rgba(160, 48, 192, 0.10) 0%, rgba(110, 63, 199, 0.05) 100%)`,
        border: `1px solid ${ACCENT}40`,
        color: 'text.primary',
        '& .MuiAlert-message': { width: '100%', p: 0 },
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: '50%',
            bgcolor: ACCENT, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PostAgentIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
            Velkommen — du har Post Agent-tilgang
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Du er crew på{' '}
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {productionList}
            </Box>
            . Last ned desktop-appen for å bruke AI-cull, scene-detection og beat-sync
            direkte mot DaVinci Resolve.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<OpenInNewIcon fontSize="small" />}
              href="/link"
              target="_blank"
              sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: '#b94dd6' } }}
            >
              Last ned Post Agent
            </Button>
            <Button size="small" onClick={dismiss} sx={{ color: 'text.secondary' }}>
              Forstått
            </Button>
          </Stack>
        </Box>
        <IconButton size="small" onClick={dismiss} sx={{ color: 'text.secondary' }} aria-label="Lukk">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Alert>
  );
};

export default PostAgentCrewWelcomeBanner;
