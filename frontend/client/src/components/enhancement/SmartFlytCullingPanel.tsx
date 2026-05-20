// @ts-nocheck
/**
 * SmartFlytCullingPanel — Slice 9X.79
 *
 * Lite panel som vises i PhotoEnhancementSuite med siste auto-culling-
 * resultat fra SmartFlyt. Stine ser umiddelbart: "X bilder analysert,
 * Y avvist, Z keepers" — uten å måtte åpne SmartFlyt-historikk.
 *
 * Returnerer null hvis ingen auto-culling-run finnes.
 */

import React from 'react';
import { Box, Stack, Typography, Chip, Button, Tooltip } from '@mui/material';
import { AutoAwesome as AutoIcon, OpenInNew as OpenIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Props {
  userId: string;
}

const fmtTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'akkurat nå';
  if (diffMin < 60) return `${diffMin} min siden`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)} t siden`;
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
};

const SmartFlytCullingPanel: React.FC<Props> = ({ userId }) => {
  const { data } = useQuery({
    queryKey: ['smartflyt-latest-culling', userId],
    queryFn: async () => apiRequest(`/api/orchestration/workflows/${userId}/latest-culling`),
    enabled: !!userId && userId !== 'anonymous',
    refetchInterval: 30_000,
  });

  const result = data?.data;
  if (!result || !result.counts) return null;

  const { counts, totalAssets, sessionsProcessed, sessionsWithoutAi, completedAt, workflowName } = result;

  return (
    <Box
      sx={{
        mt: 2, mb: 2, p: 2, borderRadius: 2,
        background: 'linear-gradient(135deg, rgba(155,135,245,0.10) 0%, rgba(155,135,245,0.02) 100%)',
        border: '1px solid rgba(155,135,245,0.32)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
        <AutoIcon sx={{ color: '#9b87f5', fontSize: 20 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff5e8' }}>
            SmartFlyt-culling — siste kjøring
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(246,242,234,0.6)' }}>
            {workflowName || 'auto-culling'} · {fmtTime(completedAt)} · {sessionsProcessed} sessions · {totalAssets} bilder
          </Typography>
        </Box>
        <Tooltip title="Se full kjøre-historikk i SmartFlyt">
          <Button
            size="small"
            endIcon={<OpenIcon sx={{ fontSize: '0.85rem !important' }} />}
            onClick={() => {
              const el = document.getElementById('smart-flyt-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            sx={{
              textTransform: 'none',
              color: '#9b87f5',
              fontSize: '0.72rem',
              '&:hover': { bgcolor: 'rgba(155,135,245,0.08)' },
            }}
          >
            Historikk
          </Button>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        <Chip size="small" label={`${counts.hero} hero`}
          sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(16,185,129,0.18)', color: '#10b981' }} />
        <Chip size="small" label={`${counts.keep} keep`}
          sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(76,201,240,0.18)', color: '#4cc9f0' }} />
        <Chip size="small" label={`${counts.weak} weak`}
          sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.18)', color: '#f59e0b' }} />
        <Chip size="small" label={`${counts.reject} reject`}
          sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, bgcolor: 'rgba(239,68,68,0.18)', color: '#ef4444' }} />
      </Stack>

      {sessionsWithoutAi > 0 && (
        <Typography variant="caption" sx={{ display: 'block', color: '#f59e0b', mt: 1 }}>
          ⚠ {sessionsWithoutAi} sessions mangler Vision-signaler — kjør via Capture-appen for sterkere bucketing
        </Typography>
      )}
    </Box>
  );
};

export default SmartFlytCullingPanel;
