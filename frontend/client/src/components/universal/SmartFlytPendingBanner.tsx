// @ts-nocheck
/**
 * SmartFlytPendingBanner — Slice 9X.79
 *
 * Persistent banner øverst i dashbordet som varsler om SmartFlyt-runs
 * som venter på manuell bekreftelse fra brukeren. Renderer ingenting
 * hvis det ikke er noen pågående awaiting_manual-steg.
 *
 * Click → routes til SmartFlyt-tab (custom-navigation event).
 */

import React from 'react';
import { Box, Stack, Typography, Button, IconButton, Chip } from '@mui/material';
import {
  NotificationsActive as BellIcon,
  Close as CloseIcon,
  PanTool as HandIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Props {
  userId: string;
}

const SmartFlytPendingBanner: React.FC<Props> = ({ userId }) => {
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ['workflow-recent-runs', userId],
    queryFn: async () => apiRequest(`/api/orchestration/workflows/${userId}/runs?limit=50`),
    enabled: !!userId && userId !== 'anonymous',
    refetchInterval: 15_000,
  });

  // Filtrer runs med awaiting_manual som ikke er dismissed
  const pendingRuns = React.useMemo(() => {
    const rows = data?.data || [];
    return rows.filter(
      (r: any) =>
        (r.status === 'partial' || r.status === 'running') &&
        Number(r.awaiting_count) > 0 &&
        !dismissed.has(r.id),
    );
  }, [data, dismissed]);

  if (pendingRuns.length === 0) return null;

  const totalAwaiting = pendingRuns.reduce(
    (sum: number, r: any) => sum + Number(r.awaiting_count),
    0,
  );

  const goToSmartFlyt = () => {
    const el = document.getElementById('smart-flyt-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <Box
      sx={{
        mt: 2,
        mb: 2,
        borderRadius: 2,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.16) 0%, rgba(59,130,246,0.04) 100%)',
        border: '1px solid rgba(59,130,246,0.32)',
        boxShadow: '0 4px 16px rgba(59,130,246,0.10)',
        p: 2,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: 'rgba(59,130,246,0.20)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <HandIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff5e8' }}>
              SmartFlyt venter på deg
            </Typography>
            <Chip
              size="small"
              label={`${totalAwaiting} steg`}
              sx={{
                height: 18,
                fontSize: '0.65rem',
                fontWeight: 700,
                bgcolor: 'rgba(59,130,246,0.20)',
                color: '#3b82f6',
              }}
            />
          </Stack>
          <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.72)' }} noWrap>
            {pendingRuns.length === 1
              ? `"${pendingRuns[0].workflow_name}" trenger manuell bekreftelse`
              : `${pendingRuns.length} workflows trenger manuell bekreftelse`}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          endIcon={<ArrowIcon />}
          onClick={goToSmartFlyt}
          sx={{
            bgcolor: '#3b82f6',
            color: '#fff',
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: '999px',
            px: 2,
            '&:hover': { bgcolor: '#2563eb' },
          }}
        >
          Åpne
        </Button>
        <IconButton
          size="small"
          onClick={() => {
            setDismissed((prev) => {
              const next = new Set(prev);
              pendingRuns.forEach((r: any) => next.add(r.id));
              return next;
            });
          }}
          sx={{ color: 'rgba(246,242,234,0.5)' }}
          aria-label="Lukk varsel"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
};

export default SmartFlytPendingBanner;
