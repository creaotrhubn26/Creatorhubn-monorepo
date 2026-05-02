import { useEffect, useState } from 'react';
import { Alert, Box, Chip, Collapse, IconButton, Stack, Typography } from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  WarningAmber as WarningAmberIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomAgentFeedbackInsights,
} from '../../services/roleRoomAgentService';

/**
 * Sømløs insights-banner for Plan-fasen. Vises kun hvis det finnes noe
 * meningsfullt å rapportere (events > 0 eller flags > 0). Stille når
 * det ikke er noe — ingen "no data"-støy i en arbeidsflyt.
 */
export default function RoleRoomAgentInsightsBanner(): React.ReactElement | null {
  const [insights, setInsights] = useState<RoleRoomAgentFeedbackInsights | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await roleRoomAgentService.fetchAgentFeedbackInsights();
      if (cancelled) return;
      setInsights(result.insights);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!insights) return null;
  const hasData = insights.totalEvents30d > 0 || insights.flags.length > 0;
  if (!hasData) return null;

  const { netSentiment30d, sentimentDistribution, reachTrend, flags, totalEvents30d } = insights;

  // Hovedlinje: én setning som oppsummerer.
  const sentimentEmoji = netSentiment30d > 0.2 ? '↑' : netSentiment30d < -0.2 ? '↓' : '→';
  const positivePct = Math.round(sentimentDistribution.positive * 100);
  const negativePct = Math.round(sentimentDistribution.negative * 100);
  const reachDelta = reachTrend.deltaPct;

  return (
    <Box
      data-testid="agent-insights-banner"
      sx={{
        mb: 1.5,
        p: 1.4,
        borderRadius: 2,
        bgcolor: flags.length > 0 ? 'rgba(251,191,36,0.06)' : 'rgba(34,211,238,0.06)',
        border: `1px solid ${flags.length > 0 ? 'rgba(251,191,36,0.3)' : 'rgba(34,211,238,0.25)'}`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        {flags.length > 0 ? (
          <WarningAmberIcon sx={{ color: '#fbbf24', fontSize: '1.2rem' }} />
        ) : reachDelta != null && reachDelta > 0 ? (
          <TrendingUpIcon sx={{ color: '#86efac', fontSize: '1.2rem' }} />
        ) : reachDelta != null && reachDelta < 0 ? (
          <TrendingDownIcon sx={{ color: '#fca5a5', fontSize: '1.2rem' }} />
        ) : (
          <TrendingUpIcon sx={{ color: '#22d3ee', fontSize: '1.2rem' }} />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.84rem' }}>
            Insights fra siste 30 dager
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.74rem' }}>
            {totalEvents30d} events {sentimentEmoji} {positivePct}% positive
            {negativePct > 0 ? ` · ${negativePct}% negative` : ''}
            {reachDelta != null
              ? ` · reach ${reachDelta >= 0 ? '+' : ''}${reachDelta.toFixed(0)}%`
              : ''}
            {flags.length > 0 ? ` · ${flags.length} flagg å sjekke` : ''}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => setExpanded((v) => !v)}
          sx={{
            color: 'rgba(226,232,240,0.7)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s ease',
          }}
          data-testid="agent-insights-toggle"
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Collapse in={expanded}>
        <Stack spacing={1} sx={{ mt: 1.4 }}>
          {flags.length > 0 ? (
            <Stack spacing={0.6}>
              {flags.map((flag, i) => (
                <Alert
                  key={i}
                  severity="warning"
                  sx={{
                    bgcolor: 'rgba(251,191,36,0.08)',
                    color: '#fde68a',
                    fontSize: '0.78rem',
                    py: 0.4,
                    '& .MuiAlert-icon': { color: '#fbbf24' },
                  }}
                >
                  {flag}
                </Alert>
              ))}
            </Stack>
          ) : null}

          {insights.topPlatforms.length > 0 ? (
            <Box>
              <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, mb: 0.4 }}>
                Top plattformer
              </Typography>
              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                {insights.topPlatforms.map((p) => (
                  <Chip
                    key={p.platform}
                    size="small"
                    label={`${p.platform}: ${p.events} events`}
                    sx={{
                      fontSize: '0.7rem',
                      bgcolor: 'rgba(148,163,184,0.15)',
                      color: '#cbd5e1',
                    }}
                  />
                ))}
              </Stack>
            </Box>
          ) : null}

          <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.68rem', fontStyle: 'italic' }}>
            Insights brukes også i agent-prompt ved neste strategi-iterasjon — så den lærer av hva som virker
            for kontoene dine.
          </Typography>
        </Stack>
      </Collapse>
    </Box>
  );
}
