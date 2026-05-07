/**
 * BusinessIntelligenceHub — Power BI-stil dashboard som leser fra det
 * unified analytics_events-laget i backend.
 *
 * Filosofi: én datakilde (/api/analytics/events) → flere visualiseringer
 * av samme data. Ingen forening av siloer per query, ingen
 * inkonsistente tall mellom dashboards.
 *
 * Tre seksjoner:
 *   1. KPI-rad — store tall (gallery created/completed, payments,
 *      project transitions) i siste 7d/30d
 *   2. Aktivitets-tidslinje — område-graf av events per dag, stacked
 *      etter type. Avslører trender og korrelasjoner.
 *   3. Type-fordeling — donut + tabell over event-typer i valgt periode
 *
 * Periode-velger styrer alle tre i sync. Refresh hver 30s for å føle
 * "live". Selv-inneholdt fetch så komponenten kan brukes andre steder
 * uten parent-state-avhengigheter.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AnalyticsEvent {
  id: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

type Period = '7d' | '30d' | '90d';

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90 };

const EVENT_COLORS: Record<string, string> = {
  'gallery.created': '#0288d1',
  'gallery.completed': '#43a047',
  'project.status_changed': '#fb8c00',
  'payment.succeeded': '#ff9800',
  'payment.failed': '#e53935',
  'comment.created': '#7b1fa2',
  'selection.submitted': '#43a047',
};

function colorFor(eventType: string): string {
  return EVENT_COLORS[eventType] ?? '#90a4ae';
}

function humanLabel(eventType: string): string {
  switch (eventType) {
    case 'gallery.created': return 'Galleri opprettet';
    case 'gallery.completed': return 'Galleri levert';
    case 'project.status_changed': return 'Prosjekt-status endret';
    case 'payment.succeeded': return 'Betaling mottatt';
    case 'payment.failed': return 'Betaling feilet';
    case 'comment.created': return 'Kommentar';
    case 'selection.submitted': return 'Klient-valg';
    default: return eventType;
  }
}

export function BusinessIntelligenceHub() {
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>('30d');

  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - PERIOD_DAYS[period]);
    return d.toISOString();
  }, [period]);

  const { data, isLoading } = useQuery<{ events: AnalyticsEvent[] }>({
    queryKey: ['/api/analytics/events', period],
    queryFn: () =>
      apiRequest(`/api/analytics/events?since=${encodeURIComponent(sinceISO)}&limit=1000`),
    refetchInterval: 30_000,
  });
  const events = data?.events ?? [];

  // KPI-aggregasjon — telle events per type for hele perioden + dager
  // (for daily-breakdown). Gjøres én gang i useMemo for å unngå re-walks.
  const stats = useMemo(() => {
    const byType = new Map<string, number>();
    const byDay = new Map<string, Map<string, number>>(); // dayISO → type → count
    let revenue = 0;
    for (const e of events) {
      byType.set(e.eventType, (byType.get(e.eventType) ?? 0) + 1);
      const day = e.createdAt.slice(0, 10);
      const dayMap = byDay.get(day) ?? new Map<string, number>();
      dayMap.set(e.eventType, (dayMap.get(e.eventType) ?? 0) + 1);
      byDay.set(day, dayMap);
      if (e.eventType === 'payment.succeeded') {
        const amount = Number((e.metadata as Record<string, unknown>).amount ?? 0);
        // Stripe stores amounts in minor units (øre); konverter til NOK.
        if (Number.isFinite(amount) && amount > 0) revenue += amount / 100;
      }
    }
    // Build daily timeseries (sorted)
    const days = Array.from(byDay.keys()).sort();
    const types = Array.from(byType.keys()).sort();
    const series = days.map((day) => {
      const dayMap = byDay.get(day)!;
      const row: Record<string, number | string> = { day };
      for (const t of types) row[t] = dayMap.get(t) ?? 0;
      return row;
    });
    return {
      byType,
      types,
      revenue,
      series,
      totalEvents: events.length,
    };
  }, [events]);

  // Headline-KPIer
  const kpis = useMemo(
    () => [
      {
        label: 'Totalt events',
        value: stats.totalEvents,
        color: theme.palette.primary.main,
        format: (v: number) => v.toLocaleString('nb-NO'),
      },
      {
        label: 'Galleri opprettet',
        value: stats.byType.get('gallery.created') ?? 0,
        color: EVENT_COLORS['gallery.created'],
        format: (v: number) => v.toLocaleString('nb-NO'),
      },
      {
        label: 'Galleri levert',
        value: stats.byType.get('gallery.completed') ?? 0,
        color: EVENT_COLORS['gallery.completed'],
        format: (v: number) => v.toLocaleString('nb-NO'),
      },
      {
        label: 'Inntekt',
        value: stats.revenue,
        color: EVENT_COLORS['payment.succeeded'],
        format: (v: number) => `${v.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr`,
      },
    ],
    [stats, theme.palette.primary.main],
  );

  return (
    <Box>
      {/* Header med periode-velger */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Business Intelligence
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Aktivitet på tvers av Galleri, Prosjekt, Betaling og Klient-events.
            Live-feed fra <code>analytics_events</code>.
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={period}
          onChange={(_, v) => v && setPeriod(v as Period)}
        >
          <ToggleButton value="7d">7d</ToggleButton>
          <ToggleButton value="30d">30d</ToggleButton>
          <ToggleButton value="90d">90d</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* KPI-rad */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        {kpis.map((kpi) => (
          <Paper
            key={kpi.label}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: `1px solid ${alpha(kpi.color, 0.18)}`,
              background: `linear-gradient(135deg, ${alpha(kpi.color, 0.06)} 0%, ${alpha(kpi.color, 0.02)} 100%)`,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: 'text.secondary',
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 700,
                mb: 1,
              }}
            >
              {kpi.label}
            </Typography>
            <Typography variant="h3" sx={{ color: kpi.color, fontWeight: 700, lineHeight: 1 }}>
              {isLoading ? '—' : kpi.format(kpi.value)}
            </Typography>
          </Paper>
        ))}
      </Box>

      {/* Tidslinje + Type-fordeling */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' },
          gap: 2,
        }}
      >
        {/* Tidslinje */}
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Aktivitet siste {period}
          </Typography>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : stats.series.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Ingen aktivitet i valgt periode ennå.
            </Typography>
          ) : (
            <SimpleStackedBars series={stats.series} types={stats.types} />
          )}
        </Paper>

        {/* Type-fordeling */}
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Event-typer
          </Typography>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : stats.types.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Ingen events i perioden.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {stats.types
                .slice()
                .sort((a, b) => (stats.byType.get(b) ?? 0) - (stats.byType.get(a) ?? 0))
                .map((t) => {
                  const count = stats.byType.get(t) ?? 0;
                  const pct = stats.totalEvents > 0 ? (count / stats.totalEvents) * 100 : 0;
                  return (
                    <Box key={t}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {humanLabel(t)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {count.toLocaleString('nb-NO')} ({pct.toFixed(0)}%)
                        </Typography>
                      </Stack>
                      <Box
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: alpha(colorFor(t), 0.15),
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${pct}%`,
                            height: '100%',
                            bgcolor: colorFor(t),
                            transition: 'width 360ms ease',
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
            </Stack>
          )}
        </Paper>
      </Box>

      {/* Footer-kobling tilbake til datakilde */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
        Data hentet fra <code>/api/analytics/events</code> — refreshes hver 30s. Total
        events synlig: {stats.totalEvents.toLocaleString('nb-NO')}.
      </Typography>
    </Box>
  );
}

/**
 * SimpleStackedBars — bar-graf bygget med rene divs i stedet for å
 * dra inn recharts/visx. Dekker basis-bruksaket (BI Trinn 2 MVP);
 * Trinn 3 vil bytte til visx for interaktivitet.
 */
function SimpleStackedBars({
  series,
  types,
}: {
  series: Array<Record<string, number | string>>;
  types: string[];
}) {
  // Find max total per dag for scaling
  const maxTotal = useMemo(
    () =>
      series.reduce((m, row) => {
        let total = 0;
        for (const t of types) total += Number(row[t] ?? 0);
        return Math.max(m, total);
      }, 0),
    [series, types],
  );
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0.5,
          height: 220,
          px: 0.5,
        }}
      >
        {series.map((row) => {
          const day = String(row.day);
          let total = 0;
          for (const t of types) total += Number(row[t] ?? 0);
          const heightPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
          return (
            <Box
              key={day}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column-reverse',
                height: `${heightPct}%`,
                minHeight: total > 0 ? 4 : 0,
                borderRadius: '4px 4px 0 0',
                overflow: 'hidden',
                position: 'relative',
                cursor: 'default',
                title: `${day}: ${total} events`,
              }}
              title={`${day}: ${total} events`}
            >
              {types.map((t) => {
                const v = Number(row[t] ?? 0);
                if (v === 0) return null;
                const segPct = total > 0 ? (v / total) * 100 : 0;
                return (
                  <Box
                    key={t}
                    sx={{
                      height: `${segPct}%`,
                      bgcolor: colorFor(t),
                      borderTop: '1px solid rgba(255,255,255,0.4)',
                    }}
                  />
                );
              })}
            </Box>
          );
        })}
      </Box>
      {/* Legend */}
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
        {types.map((t) => (
          <Chip
            key={t}
            size="small"
            label={humanLabel(t)}
            sx={{
              bgcolor: alpha(colorFor(t), 0.12),
              color: colorFor(t),
              fontWeight: 600,
              border: `1px solid ${alpha(colorFor(t), 0.3)}`,
            }}
          />
        ))}
      </Stack>
    </>
  );
}

export default BusinessIntelligenceHub;
