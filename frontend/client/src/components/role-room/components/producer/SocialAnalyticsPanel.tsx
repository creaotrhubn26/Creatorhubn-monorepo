import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon, QueryStats as AnalyticsHeaderIcon } from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import roleRoomAgentService, {
  type RoleRoomAccountMetric,
  type RoleRoomDailyEventEntry,
  type RoleRoomDailySentimentEntry,
  type RoleRoomPublishCountEntry,
  type RoleRoomSentimentBreakdownEntry,
  type RoleRoomSentimentLabel,
  type RoleRoomSocialAnalyticsSummary,
  type RoleRoomTopPostMetric,
} from '../../services/roleRoomAgentService';

const PLATFORM_COLOR: Record<string, string> = {
  instagram: '#ec4899',
  facebook_page: '#3b82f6',
  tiktok: '#22d3ee',
  linkedin: '#0a66c2',
  youtube: '#ef4444',
  x: '#94a3b8',
  threads: '#a855f7',
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook_page: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X',
  threads: 'Threads',
};

const SENTIMENT_COLOR: Record<RoleRoomSentimentLabel, string> = {
  negative: '#f87171',
  neutral: '#94a3b8',
  positive: '#86efac',
  mixed: '#fbbf24',
};

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function KpiCard({
  label,
  value,
  caption,
  accent,
  testId,
}: {
  label: string;
  value: string;
  caption?: string;
  accent?: string;
  testId?: string;
}): React.ReactElement {
  return (
    <Box
      data-testid={testId}
      sx={{
        flex: '1 1 160px',
        minWidth: 160,
        p: 1.4,
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(148,163,184,0.18)',
        borderLeft: `3px solid ${accent ?? '#22d3ee'}`,
      }}
    >
      <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 800, mt: 0.3 }}>
        {value}
      </Typography>
      {caption ? (
        <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.72rem', mt: 0.2 }}>
          {caption}
        </Typography>
      ) : null}
    </Box>
  );
}

interface TimeSeriesPoint {
  day: string;
  [platformOrSentiment: string]: number | string;
}

function pivotDailyEvents(rows: RoleRoomDailyEventEntry[]): TimeSeriesPoint[] {
  const byDay = new Map<string, TimeSeriesPoint>();
  for (const r of rows) {
    let entry = byDay.get(r.day);
    if (!entry) {
      entry = { day: r.day };
      byDay.set(r.day, entry);
    }
    entry[r.platform] = (entry[r.platform] as number | undefined ?? 0) + r.count;
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

function pivotDailySentiment(rows: RoleRoomDailySentimentEntry[]): TimeSeriesPoint[] {
  const byDay = new Map<string, TimeSeriesPoint>();
  for (const r of rows) {
    let entry = byDay.get(r.day);
    if (!entry) {
      entry = { day: r.day };
      byDay.set(r.day, entry);
    }
    entry[r.sentiment] = (entry[r.sentiment] as number | undefined ?? 0) + r.count;
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

export default function SocialAnalyticsPanel(): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RoleRoomSocialAnalyticsSummary | null>(null);
  const [sentimentBreakdown, setSentimentBreakdown] = useState<RoleRoomSentimentBreakdownEntry[]>([]);
  const [dailyEvents, setDailyEvents] = useState<RoleRoomDailyEventEntry[]>([]);
  const [dailySentiment, setDailySentiment] = useState<RoleRoomDailySentimentEntry[]>([]);
  const [accountMetrics, setAccountMetrics] = useState<RoleRoomAccountMetric[]>([]);
  const [topPosts, setTopPosts] = useState<RoleRoomTopPostMetric[]>([]);
  const [publishesPerPlatform, setPublishesPerPlatform] = useState<RoleRoomPublishCountEntry[]>([]);

  // Drop stale/out-of-order responses (rapid refresh clicks) and post-unmount
  // updates — only the latest request's result is applied.
  const reqSeqRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const refresh = useCallback(async () => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    setError(null);
    const result = await roleRoomAgentService.fetchSocialAnalytics();
    if (seq !== reqSeqRef.current || !mountedRef.current) return;
    if (result.error) setError(result.error);
    setSummary(result.summary ?? null);
    setSentimentBreakdown(result.sentimentBreakdown ?? []);
    setDailyEvents(result.dailyEvents ?? []);
    setDailySentiment(result.dailySentiment ?? []);
    setAccountMetrics(result.accountMetrics ?? []);
    setTopPosts(result.topPosts ?? []);
    setPublishesPerPlatform(result.publishesPerPlatform ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dailyEventsSeries = useMemo(() => pivotDailyEvents(dailyEvents), [dailyEvents]);
  const dailySentimentSeries = useMemo(() => pivotDailySentiment(dailySentiment), [dailySentiment]);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const e of dailyEvents) set.add(e.platform);
    return Array.from(set);
  }, [dailyEvents]);

  const sentimentTotals = useMemo(() => {
    const map = new Map<RoleRoomSentimentLabel, number>();
    for (const r of sentimentBreakdown) {
      map.set(r.sentiment, (map.get(r.sentiment) ?? 0) + r.count);
    }
    return Array.from(map.entries()).map(([sentiment, count]) => ({
      name: sentiment,
      value: count,
      fill: SENTIMENT_COLOR[sentiment],
    }));
  }, [sentimentBreakdown]);

  const followerSnapshots = useMemo(
    () =>
      accountMetrics.filter(
        (m) => m.metricName === 'followers_count' || m.metricName === 'page_fans',
      ),
    [accountMetrics],
  );

  return (
    <Stack spacing={2} data-testid="social-analytics-panel">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center">
          <AnalyticsHeaderIcon sx={{ color: '#22d3ee' }} />
          <Box>
            <Typography sx={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 800 }}>Analyse</Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.84rem' }}>
              Måler resultatene av strategien — henvendelser, stemning og rekkevidde.
            </Typography>
          </Box>
        </Stack>
        <Tooltip title="Oppdater">
          <IconButton size="small" aria-label="Oppdater analyse" onClick={() => void refresh()} disabled={loading}>
            <RefreshIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#fecaca' }}>
          {error}
        </Alert>
      ) : null}

      {loading && !summary ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={20} />
        </Stack>
      ) : (
        <>
          {/* KPI cards */}
          <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
            <KpiCard
              label="Events 7d"
              value={formatNumber(summary?.last7d.totalEvents ?? 0)}
              caption={`${summary?.last7d.totalUnread ?? 0} ulest`}
              accent="#22d3ee"
              testId="kpi-events-7d"
            />
            <KpiCard
              label="Events 30d"
              value={formatNumber(summary?.last30d.totalEvents ?? 0)}
              caption="totalt"
              accent="#86efac"
              testId="kpi-events-30d"
            />
            {sentimentTotals.map((s) => (
              <KpiCard
                key={s.name}
                label={`${s.name} 30d`}
                value={formatNumber(s.value)}
                accent={s.fill}
                testId={`kpi-sentiment-${s.name}`}
              />
            ))}
          </Stack>

          {/* Daily events line chart */}
          {dailyEventsSeries.length > 0 ? (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 700, mb: 1 }}>
                Daglige events siste 30 dager — per plattform
              </Typography>
              <Box sx={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <LineChart data={dailyEventsSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                    <XAxis dataKey="day" stroke="rgba(226,232,240,0.5)" fontSize={11} />
                    <YAxis stroke="rgba(226,232,240,0.5)" fontSize={11} allowDecimals={false} />
                    <ChartTooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid rgba(148,163,184,0.3)',
                        color: '#e2e8f0',
                      }}
                    />
                    <Legend />
                    {platforms.map((p) => (
                      <Line
                        key={p}
                        type="monotone"
                        dataKey={p}
                        stroke={PLATFORM_COLOR[p] ?? '#94a3b8'}
                        strokeWidth={2}
                        name={PLATFORM_LABEL[p] ?? p}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          ) : null}

          {/* Sentiment + daily sentiment side by side */}
          {sentimentTotals.length > 0 || dailySentimentSeries.length > 0 ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {sentimentTotals.length > 0 ? (
                <Box
                  sx={{
                    flex: '1 1 0',
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(15,23,42,0.55)',
                    border: '1px solid rgba(148,163,184,0.18)',
                  }}
                >
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 700, mb: 1 }}>
                    Sentiment-fordeling siste 30 dager
                  </Typography>
                  <Box sx={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={sentimentTotals}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          label
                        >
                          {sentimentTotals.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip
                          contentStyle={{
                            background: '#0f172a',
                            border: '1px solid rgba(148,163,184,0.3)',
                            color: '#e2e8f0',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              ) : null}

              {dailySentimentSeries.length > 0 ? (
                <Box
                  sx={{
                    flex: '1 1 0',
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(15,23,42,0.55)',
                    border: '1px solid rgba(148,163,184,0.18)',
                  }}
                >
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 700, mb: 1 }}>
                    Sentiment-trend siste 30 dager
                  </Typography>
                  <Box sx={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart data={dailySentimentSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                        <XAxis dataKey="day" stroke="rgba(226,232,240,0.5)" fontSize={11} />
                        <YAxis stroke="rgba(226,232,240,0.5)" fontSize={11} allowDecimals={false} />
                        <ChartTooltip
                          contentStyle={{
                            background: '#0f172a',
                            border: '1px solid rgba(148,163,184,0.3)',
                            color: '#e2e8f0',
                          }}
                        />
                        <Bar
                          dataKey="negative"
                          stackId="s"
                          fill={SENTIMENT_COLOR.negative}
                          name="Negativ"
                        />
                        <Bar
                          dataKey="neutral"
                          stackId="s"
                          fill={SENTIMENT_COLOR.neutral}
                          name="Nøytral"
                        />
                        <Bar
                          dataKey="positive"
                          stackId="s"
                          fill={SENTIMENT_COLOR.positive}
                          name="Positiv"
                        />
                        <Bar
                          dataKey="mixed"
                          stackId="s"
                          fill={SENTIMENT_COLOR.mixed}
                          name="Blandet"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              ) : null}
            </Stack>
          ) : null}

          {/* Publish-rytme per plattform */}
          {publishesPerPlatform.length > 0 ? (
            <Box
              data-testid="publishes-per-platform"
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 700, mb: 1 }}>
                Publish-rytme siste 30 dager
              </Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {publishesPerPlatform.map((p) => {
                  const total = p.published + p.scheduled;
                  return (
                    <Box
                      key={p.platform}
                      sx={{
                        flex: '1 1 160px',
                        minWidth: 160,
                        p: 1.2,
                        borderRadius: 1.4,
                        bgcolor: 'rgba(15,23,42,0.5)',
                        border: '1px solid rgba(148,163,184,0.18)',
                        borderLeft: `3px solid ${PLATFORM_COLOR[p.platform] ?? '#94a3b8'}`,
                      }}
                    >
                      <Typography
                        sx={{
                          color: 'rgba(226,232,240,0.55)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {PLATFORM_LABEL[p.platform] ?? p.platform}
                      </Typography>
                      <Typography
                        sx={{ color: '#e2e8f0', fontSize: '1.4rem', fontWeight: 800, mt: 0.3 }}
                      >
                        {formatNumber(total)}
                      </Typography>
                      <Stack direction="row" spacing={0.6} sx={{ mt: 0.4 }}>
                        {p.published > 0 ? (
                          <Typography sx={{ color: '#86efac', fontSize: '0.7rem', fontWeight: 600 }}>
                            {formatNumber(p.published)} publisert
                          </Typography>
                        ) : null}
                        {p.scheduled > 0 ? (
                          <Typography sx={{ color: '#7dd3fc', fontSize: '0.7rem', fontWeight: 600 }}>
                            {formatNumber(p.scheduled)} planlagt
                          </Typography>
                        ) : null}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ) : null}

          {/* Account-level snapshots (followers, page fans, etc) */}
          {followerSnapshots.length > 0 ? (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 700, mb: 1 }}>
                Følger-tall (siste snapshot per konto)
              </Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {followerSnapshots.map((m) => (
                  <Box
                    key={`${m.platform}-${m.accountId}-${m.metricName}`}
                    sx={{
                      flex: '1 1 180px',
                      p: 1.2,
                      borderRadius: 1.4,
                      bgcolor: 'rgba(15,23,42,0.5)',
                      border: '1px solid rgba(148,163,184,0.18)',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.4 }}>
                      <Chip
                        size="small"
                        label={PLATFORM_LABEL[m.platform] ?? m.platform}
                        sx={{
                          height: 18,
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          bgcolor: PLATFORM_COLOR[m.platform] + '33',
                          color: PLATFORM_COLOR[m.platform],
                          '& .MuiChip-label': { px: 0.7 },
                        }}
                      />
                      <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>
                        {m.accountId.slice(0, 14)}…
                      </Typography>
                    </Stack>
                    <Typography sx={{ color: '#e2e8f0', fontSize: '1.3rem', fontWeight: 800 }}>
                      {formatNumber(m.metricValue)}
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>
                      {m.metricName}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : null}

          {/* Top posts */}
          {topPosts.length > 0 ? (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 700, mb: 1 }}>
                Top posts siste 30 dager
              </Typography>
              <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(148,163,184,0.12)' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem' }}>Plattform</TableCell>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem' }}>Post-ID</TableCell>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem' }}>Metric</TableCell>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.7rem' }} align="right">
                      Verdi
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topPosts
                    .sort((a, b) => b.metricValue - a.metricValue)
                    .slice(0, 10)
                    .map((p) => (
                      <TableRow key={`${p.platform}-${p.externalPostId}-${p.metricName}`}>
                        <TableCell>
                          <Chip
                            size="small"
                            label={PLATFORM_LABEL[p.platform] ?? p.platform}
                            sx={{
                              height: 18,
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              bgcolor: PLATFORM_COLOR[p.platform] + '33',
                              color: PLATFORM_COLOR[p.platform],
                              '& .MuiChip-label': { px: 0.7 },
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                          {p.externalPostId.slice(0, 18)}…
                        </TableCell>
                        <TableCell sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.78rem' }}>
                          {p.metricName}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                          {formatNumber(p.metricValue)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Box>
          ) : null}

          {/* Empty state when truly nothing */}
          {(summary?.last30d.totalEvents ?? 0) === 0 && topPosts.length === 0 ? (
            <Box
              sx={{
                p: 3,
                textAlign: 'center',
                color: 'rgba(226,232,240,0.6)',
                bgcolor: 'rgba(15,23,42,0.4)',
                borderRadius: 2,
                border: '1px dashed rgba(148,163,184,0.25)',
              }}
            >
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, mb: 0.5 }}>
                Ingen data å analysere ennå
              </Typography>
              <Typography sx={{ fontSize: '0.78rem' }}>
                Når du publiserer poster og mottar comments/mentions, vil tall, sentiment-trender og top-posts
                dukke opp her. Inbound webhook-events går automatisk til Inbox-fanen, og insights-snapshots tas
                via <code>POST /api/role-room/social/metrics/snapshot</code>.
              </Typography>
            </Box>
          ) : null}

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />
          <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.7rem', textAlign: 'center' }}>
            Data fra <code>social_events</code> + <code>social_metrics</code> · Auto-refresh er av — klikk Oppdater for ferske tall
          </Typography>
        </>
      )}
    </Stack>
  );
}
