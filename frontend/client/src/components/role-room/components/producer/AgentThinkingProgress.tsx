/**
 * AgentThinkingProgress — polert «Agenten arbeider/tenker»-UX under research-
 * og analysefasen. Porter ai-tenker-designet: Agent-merke, pulserende orb,
 * status «Tenker», samlet fremdrift i %, og en liste over ALLE prosessene
 * Agenten kjører (de ekte SSE-stadiene), hver med ikon, detalj og status.
 *
 * Drop-in for ResearchProgressLive — samme props (status, stages, error),
 * koblet til useResearchProgress-stadiene.
 */

import React from 'react';
import { Box, Stack, Typography, CircularProgress, LinearProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LanguageIcon from '@mui/icons-material/Language';
import PlaceIcon from '@mui/icons-material/Place';
import GroupsIcon from '@mui/icons-material/Groups';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import InsightsIcon from '@mui/icons-material/Insights';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalMallIcon from '@mui/icons-material/LocalMall';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import PaletteIcon from '@mui/icons-material/Palette';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { ResearchStage, ResearchStageKey, ResearchProgressStatus } from '../../hooks/useResearchProgress';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

const STAGE_META: Record<ResearchStageKey, { label: string; detail: string; icon: React.ReactElement }> = {
  brreg: { label: 'Henter org.data', detail: 'Brønnøysundregistrene', icon: <AccountBalanceIcon sx={{ fontSize: 17 }} /> },
  website: { label: 'Leser nettsiden', detail: 'Tilbud, tone og budskap', icon: <LanguageIcon sx={{ fontSize: 17 }} /> },
  googlePlacesBusiness: { label: 'Finner bedriften', detail: 'Google Places · profil', icon: <PlaceIcon sx={{ fontSize: 17 }} /> },
  googlePlacesCompetitors: { label: 'Kartlegger konkurrenter', detail: 'Google Places · nærområde', icon: <GroupsIcon sx={{ fontSize: 17 }} /> },
  googlePlacesLocal: { label: 'Lokalt markedsbilde', detail: 'Nabolag og relevans', icon: <LocationCityIcon sx={{ fontSize: 17 }} /> },
  competitorAnalysis: { label: 'Analyserer konkurrenter', detail: 'Posisjonering og vinkler', icon: <InsightsIcon sx={{ fontSize: 17 }} /> },
  localPresence: { label: 'Vurderer synlighet', detail: 'Lokal tilstedeværelse', icon: <StorefrontIcon sx={{ fontSize: 17 }} /> },
  merchSuppliers: { label: 'Finner merch-muligheter', detail: 'Aktuelle leverandører', icon: <LocalMallIcon sx={{ fontSize: 17 }} /> },
  metaPagesEnrichment: { label: 'Henter Meta-data', detail: 'Side, følgere og kategori', icon: <DynamicFeedIcon sx={{ fontSize: 17 }} /> },
  colorExtraction: { label: 'Trekker ut merkefarger', detail: 'Palett fra logoen', icon: <PaletteIcon sx={{ fontSize: 17 }} /> },
  claudeSynthesis: { label: 'Bygger anbefaling', detail: 'Syntese med Claude', icon: <AutoAwesomeIcon sx={{ fontSize: 17 }} /> },
  openaiSynthesis: { label: 'Kryssjekker innsikten', detail: 'Kvalitetssikrer resultatet', icon: <PsychologyIcon sx={{ fontSize: 17 }} /> },
};

interface AgentThinkingProgressProps {
  status: ResearchProgressStatus;
  stages: ResearchStage[];
  error: string | null;
}

function formatMs(ms: number | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

const AgentThinkingProgress: React.FC<AgentThinkingProgressProps> = ({ status, stages, error }) => {
  if (status === 'idle') return null;

  const done = stages.filter((s) => s.status === 'done' || s.status === 'error').length;
  const total = Math.max(stages.length, 1);
  const pct = status === 'done' ? 100 : Math.round((done / total) * 100);
  const running = stages.find((s) => s.status === 'running');

  const statusWord = status === 'done' ? 'Ferdig' : status === 'error' ? 'Stoppet' : 'Tenker';
  const subText = status === 'done'
    ? 'Analysen er klar — bygger anbefalingen din.'
    : status === 'error'
      ? 'Noe gikk galt under analysen.'
      : running
        ? `${STAGE_META[running.key]?.label ?? 'Arbeider'} …`
        : 'Analyserer kontoene dine og bygger en anbefaling …';

  return (
    <Box
      sx={{
        position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.6 }, overflow: 'hidden',
        border: '1px solid rgba(167,139,250,0.2)',
        background:
          'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.20), transparent 55%), radial-gradient(110% 80% at 100% 114%, rgba(217,70,239,0.14), transparent 50%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
        boxShadow: '0 18px 48px rgba(124,58,237,0.26)',
      }}
    >
      {/* Brand */}
      <Stack direction="row" alignItems="center" spacing={1.1} sx={{ mb: 1.8 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
          <AutoAwesomeIcon sx={{ fontSize: 17, color: '#fff' }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: INK, lineHeight: 1.1 }}>The Role Room Agent</Typography>
          <Typography sx={{ fontSize: 11.5, color: MUTED }}>Markedsføring · social · leads · innsikt</Typography>
        </Box>
      </Stack>

      {/* Pulserende orb + status */}
      <Stack alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ position: 'relative', width: 70, height: 70, mb: 1.4, display: 'grid', placeItems: 'center' }}>
          {status === 'streaming' ? [0, 1, 2].map((i) => (
            <Box key={i} sx={{
              position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(168,85,247,0.4)',
              animation: 'agentOrbPulse 1.8s ease-out infinite', animationDelay: `${i * 0.6}s`,
              '@keyframes agentOrbPulse': { '0%': { transform: 'scale(0.7)', opacity: 0.8 }, '100%': { transform: 'scale(1.25)', opacity: 0 } },
            }} />
          )) : null}
          <Box sx={{ width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 10px 28px rgba(168,85,247,0.5)' }}>
            <PsychologyIcon sx={{ fontSize: 27, color: '#fff' }} />
          </Box>
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.8}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: INK }}>Agenten arbeider</Typography>
          <Box sx={{ px: 1, py: 0.3, borderRadius: 999, bgcolor: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.3)' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd' }}>{statusWord}</Typography>
          </Box>
        </Stack>
        <Typography sx={{ fontSize: 12.5, color: MUTED, textAlign: 'center', mt: 0.6, maxWidth: 360, minHeight: 18 }}>{subText}</Typography>
      </Stack>

      {/* Samlet fremdrift */}
      <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate" value={pct}
            sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(148,163,184,0.16)', '& .MuiLinearProgress-bar': { borderRadius: 4, background: GRAD } }}
          />
        </Box>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: INK, minWidth: 42, textAlign: 'right' }}>{pct} %</Typography>
      </Stack>

      {/* Prosess-steg */}
      <Stack spacing={0.8}>
        {stages.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: MUTED, textAlign: 'center', py: 1 }}>Starter analysen …</Typography>
        ) : stages.map((stage) => {
          const meta = STAGE_META[stage.key] ?? { label: stage.key, detail: '', icon: <AutoAwesomeIcon sx={{ fontSize: 17 }} /> };
          const isDone = stage.status === 'done';
          const isRunning = stage.status === 'running';
          const isError = stage.status === 'error';
          const hasFallback = Boolean(stage.fallback);
          return (
            <Stack
              key={stage.key} direction="row" alignItems="center" spacing={1.2}
              sx={{
                p: 1.1, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.5)',
                border: `1px solid ${isRunning ? 'rgba(168,85,247,0.5)' : 'rgba(148,163,184,0.12)'}`,
                opacity: stage.status === 'pending' ? 0.55 : 1,
                animation: isRunning ? 'agentStepPulse 1.5s ease-in-out infinite' : 'none',
                '@keyframes agentStepPulse': { '0%,100%': { borderColor: 'rgba(168,85,247,0.32)' }, '50%': { borderColor: 'rgba(168,85,247,0.8)' } },
              }}
            >
              <Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: 'grid', placeItems: 'center', flexShrink: 0, color: isRunning || isDone ? '#fff' : ACCENT, background: isRunning || isDone ? GRAD : 'rgba(168,85,247,0.12)' }}>
                {meta.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{meta.label}</Typography>
                <Typography sx={{ fontSize: 11.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {hasFallback ? `${meta.detail} · begrenset data` : meta.detail}
                </Typography>
              </Box>
              <Box sx={{ flexShrink: 0, display: 'grid', placeItems: 'center', minWidth: 26 }}>
                {isRunning ? <CircularProgress size={16} sx={{ color: ACCENT }} />
                  : isError ? <ErrorOutlineIcon sx={{ fontSize: 18, color: '#f87171' }} />
                  : hasFallback ? <WarningAmberIcon sx={{ fontSize: 18, color: '#fbbf24' }} />
                  : isDone ? <CheckRoundedIcon sx={{ fontSize: 18, color: '#34d399' }} />
                  : <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(148,163,184,0.4)' }} />}
              </Box>
              {isDone && stage.ms ? (
                <Typography sx={{ fontSize: 10.5, fontFamily: 'monospace', color: 'rgba(226,232,240,0.5)', minWidth: 44, textAlign: 'right', flexShrink: 0 }}>{formatMs(stage.ms)}</Typography>
              ) : null}
            </Stack>
          );
        })}
      </Stack>

      {error ? <Typography sx={{ fontSize: 12.5, color: '#fca5a5', textAlign: 'center', mt: 1.4 }}>{error}</Typography> : null}
    </Box>
  );
};

export default AgentThinkingProgress;
