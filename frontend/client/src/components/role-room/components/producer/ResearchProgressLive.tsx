/**
 * ResearchProgressLive — item #2. Renders the SSE-streamed pipeline
 * stages with a live "tikker av" effect while bootstrap is running.
 *
 * Each stage starts as a grey pending row, flips to a blinking blue
 * "running" row while in flight, then resolves green (done) or yellow
 * (done-with-fallback) or red (error). The bar widths reflect the
 * proportional time once a stage finishes.
 */

import React from 'react';
import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  ErrorOutline as ErrorOutlineIcon,
  HourglassEmpty as HourglassIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import type { ResearchStage, ResearchStageKey, ResearchProgressStatus } from '../../hooks/useResearchProgress';

const STAGE_LABELS: Record<ResearchStageKey, string> = {
  brreg: 'Brønnøysundregistrene',
  website: 'Nettsidescraping',
  googlePlacesBusiness: 'Google Places (bedrift)',
  googlePlacesCompetitors: 'Google Places (konkurrenter)',
  googlePlacesLocal: 'Google Places (nærområde)',
  competitorAnalysis: 'Konkurrentanalyse',
  localPresence: 'Lokal tilstedeværelse',
  merchSuppliers: 'Merch-leverandører',
  metaPagesEnrichment: 'Meta Pages-berikelse',
  colorExtraction: 'Logo-paletten',
  claudeSynthesis: 'CI-syntese',
  openaiSynthesis: 'OpenAI-syntese',
};

interface ResearchProgressLiveProps {
  status: ResearchProgressStatus;
  stages: ResearchStage[];
  error: string | null;
}

function formatMs(ms: number | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

const ResearchProgressLive: React.FC<ResearchProgressLiveProps> = ({ status, stages, error }) => {
  if (status === 'idle') return null;
  const totalDone = stages.filter((s) => s.status === 'done').length;
  const totalRunning = stages.filter((s) => s.status === 'running').length;
  const totalError = stages.filter((s) => s.status === 'error').length;
  const maxMs = Math.max(1, ...stages.filter((s) => s.ms).map((s) => s.ms ?? 0));

  return (
    <Box
      sx={{
        p: 1.6,
        borderRadius: 3,
        border: '1px solid rgba(99,102,241,0.32)',
        bgcolor: 'rgba(30,27,75,0.45)',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
        <Stack spacing={0.2}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800 }}>
            {status === 'streaming' ? 'Research kjører…' : status === 'done' ? 'Research fullført' : 'Research feilet'}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.65)', fontSize: '0.78rem' }}>
            {totalDone} fullført{totalRunning > 0 ? ` · ${totalRunning} pågår` : ''}
            {totalError > 0 ? ` · ${totalError} feil` : ''}
          </Typography>
        </Stack>
        {status === 'streaming' ? (
          <Box sx={{ minWidth: 120 }}>
            <LinearProgress sx={{ height: 6, borderRadius: 3 }} />
          </Box>
        ) : null}
      </Stack>

      <Stack spacing={0.5}>
        {stages.length === 0 ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.82rem' }}>
            Venter på første stage…
          </Typography>
        ) : (
          stages.map((stage) => {
            const label = STAGE_LABELS[stage.key] ?? stage.key;
            const isDone = stage.status === 'done';
            const isRunning = stage.status === 'running';
            const isError = stage.status === 'error';
            const hasFallback = Boolean(stage.fallback);
            const barColor = isError
              ? 'rgba(239,68,68,0.32)'
              : hasFallback
                ? 'rgba(251,191,36,0.28)'
                : 'rgba(52,211,153,0.28)';
            const width = stage.ms ? Math.min(100, (stage.ms / maxMs) * 100) : isRunning ? 100 : 0;
            const Icon = isError ? ErrorOutlineIcon : hasFallback ? WarningAmberIcon : isDone ? CheckCircleIcon : HourglassIcon;
            const iconColor = isError ? '#f87171' : hasFallback ? '#fbbf24' : isDone ? '#34d399' : '#a5b4fc';
            return (
              <Box
                key={stage.key}
                sx={{
                  position: 'relative',
                  p: 0.7,
                  borderRadius: 1.4,
                  border: `1px solid ${isRunning ? 'rgba(99,102,241,0.48)' : 'rgba(148,163,184,0.14)'}`,
                  bgcolor: 'rgba(15,23,42,0.5)',
                  overflow: 'hidden',
                  animation: isRunning ? 'researchPulse 1.4s ease-in-out infinite' : 'none',
                  '@keyframes researchPulse': {
                    '0%, 100%': { borderColor: 'rgba(99,102,241,0.32)' },
                    '50%': { borderColor: 'rgba(99,102,241,0.78)' },
                  },
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${width}%`,
                    bgcolor: isRunning ? 'rgba(99,102,241,0.18)' : barColor,
                    transition: 'width 0.4s ease-out',
                    zIndex: 0,
                  }}
                />
                <Stack direction="row" alignItems="center" spacing={1} sx={{ position: 'relative', zIndex: 1 }}>
                  <Icon sx={{ color: iconColor, fontSize: 16 }} />
                  <Typography sx={{ color: '#f8fafc', fontSize: '0.84rem', fontWeight: 600, flex: 1 }}>
                    {label}
                  </Typography>
                  {hasFallback ? (
                    <Chip
                      size="small"
                      label={stage.fallback}
                      sx={{
                        bgcolor: 'rgba(251,191,36,0.18)',
                        color: '#fde68a',
                        fontFamily: 'monospace',
                        fontSize: '0.66rem',
                        height: 18,
                      }}
                    />
                  ) : null}
                  <Typography
                    sx={{
                      color: 'rgba(226,232,240,0.72)',
                      fontSize: '0.74rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      minWidth: 56,
                      textAlign: 'right',
                    }}
                  >
                    {isRunning ? '…' : formatMs(stage.ms)}
                  </Typography>
                </Stack>
              </Box>
            );
          })
        )}
      </Stack>

      {error ? (
        <Typography sx={{ color: '#fca5a5', fontSize: '0.82rem', mt: 1.2 }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
};

export default ResearchProgressLive;
