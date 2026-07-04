/**
 * ChannelScorecardCard — #3, the cockpit "command center" tile.
 *
 * Shows the deterministic recommended marketing-setup channels (F9) next to
 * MEASURED per-channel performance, plus "surprise winner" platforms that have
 * data but weren't recommended, plus top pillars by measured reach. Project-
 * scoped; degrades gracefully before any KPI data exists.
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import roleRoomAgentService, {
  type MarketingChannelScorecardResponse,
} from '../../services/roleRoomAgentService';

interface ChannelScorecardCardProps {
  projectId: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Pick the most meaningful metric to headline a channel/pillar. */
function primaryMetric(metrics: Record<string, number>): { name: string; value: number } | null {
  const order = ['reach', 'impressions', 'video_views', 'saved', 'engagement', 'likes'];
  for (const m of order) {
    if (typeof metrics[m] === 'number') return { name: m, value: metrics[m] };
  }
  const keys = Object.keys(metrics);
  return keys.length ? { name: keys[0], value: metrics[keys[0]] } : null;
}

const panelSx = {
  p: 1.5,
  borderRadius: 3,
  border: '1px solid rgba(148,163,184,0.16)',
  bgcolor: 'rgba(15,23,42,0.55)',
} as const;

export default function ChannelScorecardCard({ projectId }: ChannelScorecardCardProps) {
  const [data, setData] = useState<MarketingChannelScorecardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    roleRoomAgentService
      .getMarketingScorecard(projectId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <Box sx={{ ...panelSx, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={18} />
        <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.85rem' }}>
          Laster kanal-scorecard…
        </Typography>
      </Box>
    );
  }

  // No setup at all → nothing to ground on yet.
  if (!data || data.channelScorecard.channels.length === 0) {
    return (
      <Box sx={panelSx}>
        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem' }}>
          Kanal-scorecard
        </Typography>
        <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.82rem', mt: 0.5 }}>
          Kjør research for prosjektet for å få et anbefalt kanal-oppsett — så måles faktisk ytelse mot det her.
        </Typography>
      </Box>
    );
  }

  const { channelScorecard: sc, setup, pillarPerformance } = data;
  const topPillars = [...pillarPerformance]
    .map((p) => ({ ...p, headline: primaryMetric(p.avgByMetric) }))
    .filter((p) => p.headline)
    .sort((a, b) => (b.headline?.value ?? 0) - (a.headline?.value ?? 0))
    .slice(0, 4);

  return (
    <Box sx={panelSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem' }}>
          Kanal-scorecard · anbefalt oppsett vs faktisk ytelse
        </Typography>
        {setup ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {setup.businessModel ? <Chip size="small" label={setup.businessModel} sx={chipSx} /> : null}
            {setup.geoScope ? <Chip size="small" label={setup.geoScope} sx={chipSx} /> : null}
            {setup.primaryCta ? <Chip size="small" label={`CTA: ${setup.primaryCta}`} sx={chipSx} /> : null}
          </Stack>
        ) : null}
      </Stack>

      {!sc.hasAnyData ? (
        <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.78rem', mt: 0.75 }}>
          Ingen målte KPI-er ennå — kanalene under er anbefalt oppsett. Tall fylles inn når postene er publisert og målt.
        </Typography>
      ) : (
        <Typography sx={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.78rem', mt: 0.75 }}>
          {sc.recommendedWithData} av {sc.channels.length} anbefalte kanaler har målt data (siste {data.sinceDays} dager).
        </Typography>
      )}

      <Stack spacing={0.75} sx={{ mt: 1 }}>
        {sc.channels.map((c) => {
          const headline = primaryMetric(c.metrics);
          const active = c.status === 'active';
          return (
            <Stack
              key={c.channel}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{
                px: 1,
                py: 0.6,
                borderRadius: 2,
                bgcolor: active ? 'rgba(16,185,129,0.10)' : 'rgba(30,41,59,0.5)',
                border: `1px solid ${active ? 'rgba(16,185,129,0.28)' : 'rgba(148,163,184,0.14)'}`,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: active ? '#34d399' : 'rgba(148,163,184,0.6)', flexShrink: 0 }} />
                <Typography noWrap sx={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>
                  {c.channel}
                </Typography>
                {c.recommendedPriority ? (
                  <Chip size="small" label={c.recommendedPriority} sx={{ ...chipSx, height: 18, fontSize: '0.62rem' }} />
                ) : null}
              </Stack>
              {active && headline ? (
                <Tooltip title={`${c.postCount} poster · ${c.snapshotCount} målinger`}>
                  <Typography sx={{ color: '#a7f3d0', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {fmt(headline.value)} {headline.name}
                  </Typography>
                </Tooltip>
              ) : (
                <Typography sx={{ color: 'rgba(148,163,184,0.75)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                  Ingen data ennå
                </Typography>
              )}
            </Stack>
          );
        })}
      </Stack>

      {sc.unexpected.length > 0 ? (
        <>
          <Divider sx={{ my: 1, borderColor: 'rgba(148,163,184,0.12)' }} />
          <Typography sx={{ color: '#fde68a', fontSize: '0.76rem', fontWeight: 700 }}>
            Uventede vinnere (ytelse uten å være i anbefalt oppsett)
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {sc.unexpected.map((u) => {
              const h = primaryMetric(u.metrics);
              return (
                <Chip
                  key={u.platform}
                  size="small"
                  label={h ? `${u.label}: ${fmt(h.value)} ${h.name}` : u.label}
                  sx={{ ...chipSx, bgcolor: 'rgba(250,204,21,0.14)', color: '#fde68a' }}
                />
              );
            })}
          </Stack>
        </>
      ) : null}

      {topPillars.length > 0 ? (
        <>
          <Divider sx={{ my: 1, borderColor: 'rgba(148,163,184,0.12)' }} />
          <Typography sx={{ color: 'rgba(203,213,225,0.9)', fontSize: '0.76rem', fontWeight: 700 }}>
            Innholdspilarer som presterer
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {topPillars.map((p) => (
              <Chip key={p.key} size="small" label={`${p.label}: ${fmt(p.headline?.value ?? 0)} ${p.headline?.name ?? ''}`} sx={chipSx} />
            ))}
          </Stack>
        </>
      ) : null}
    </Box>
  );
}

const chipSx = {
  height: 20,
  fontSize: '0.68rem',
  bgcolor: 'rgba(148,163,184,0.14)',
  color: 'rgba(226,232,240,0.9)',
} as const;
