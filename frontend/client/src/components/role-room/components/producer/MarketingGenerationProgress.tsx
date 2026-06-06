/**
 * MarketingGenerationProgress — beskrivende «hva skjer nå»-fremdrift under
 * markedsplan-generering, stylet som ResearchProgressLive for konsistens.
 *
 * Backend-kallene (generateMarketingPlan / generateMarketingPlanPosts) er
 * enkle POST-requests UTEN streaming, så vi kan ikke vise ekte backend-steg.
 * I stedet syklет vi gjennom de stegene genereringen faktisk gjør, på en
 * timer — slik at Stig ser at noe skjer i stedet for en naken spinner.
 * Siste steg holdes «kjører» til generingen er ferdig.
 */
import { useEffect, useState } from 'react';
import { Box, Stack, Typography, CircularProgress, LinearProgress } from '@mui/material';
import { CheckCircle as DoneIcon, RadioButtonUnchecked as PendingIcon } from '@mui/icons-material';

const PLAN_STAGES = [
  'Leser research og kundeinnsikt',
  'Definerer innholdspillarer',
  'Setter kanalstrategi og kadens',
  'Fastsetter KPI-mål',
  'Setter sammen 30-dagers rammeverk',
];

const POSTS_STAGES = [
  'Analyserer innholdspillarene',
  'Genererer 30 dagers innholdsidéer',
  'Skriver hooks og CTA-er',
  'Fordeler på kanaler og format',
  'Ferdigstiller post-kalenderen',
];

const STAGE_INTERVAL_MS = 2200;

export function MarketingGenerationProgress({
  active,
  mode,
}: {
  active: boolean;
  mode: 'plan' | 'posts';
}) {
  const stages = mode === 'plan' ? PLAN_STAGES : POSTS_STAGES;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setActiveIndex(0);
      return;
    }
    // Hold på siste steg (caps) til genereringen er ferdig.
    const id = window.setInterval(() => {
      setActiveIndex((index) => Math.min(index + 1, stages.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, stages.length]);

  if (!active) return null;

  const title = mode === 'plan' ? 'Lager markedsplan…' : 'Genererer post-kalender…';

  return (
    <Box
      sx={{
        p: 1.6,
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(34,211,238,0.3)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <CircularProgress size={16} sx={{ color: '#22d3ee' }} />
        <Typography sx={{ color: '#a5f3fc', fontWeight: 800, fontSize: '0.9rem' }}>
          {title}
        </Typography>
      </Stack>
      <LinearProgress sx={{ height: 2, mb: 1.2, bgcolor: 'rgba(34,211,238,0.12)', '& .MuiLinearProgress-bar': { bgcolor: '#22d3ee' } }} />
      <Stack spacing={0.55}>
        {stages.map((stage, index) => {
          const isDone = index < activeIndex;
          const isRunning = index === activeIndex;
          return (
            <Stack key={stage} direction="row" spacing={0.8} alignItems="center">
              {isDone ? (
                <DoneIcon sx={{ fontSize: '0.95rem', color: '#34d399' }} />
              ) : isRunning ? (
                <CircularProgress size={12} sx={{ color: '#22d3ee' }} />
              ) : (
                <PendingIcon sx={{ fontSize: '0.95rem', color: 'rgba(148,163,184,0.5)' }} />
              )}
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  color: isDone ? 'rgba(148,163,184,0.85)' : isRunning ? '#e2e8f0' : 'rgba(148,163,184,0.55)',
                  fontWeight: isRunning ? 700 : 500,
                }}
              >
                {stage}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
      <Typography sx={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.7rem', mt: 1 }}>
        Dette tar vanligvis 20–40 sekunder.
      </Typography>
    </Box>
  );
}

export default MarketingGenerationProgress;
