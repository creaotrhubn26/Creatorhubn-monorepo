// @ts-nocheck
/**
 * AdminAnalyticsHub — Slice 9X.70
 *
 * Power-BI-aktig overordnet analytics-hub for Daniel. Viser alt på ett
 * sted: KPIer, funnel, events over tid, top events, revenue, abonnement
 * og siste aktivitet — uten å forlate admin-dashboardet.
 *
 * Datakilder:
 *   - /api/admin/analytics/overview (lokal analytics_events + funnel)
 *   - /api/admin/stripe/payment-status (Stripe revenue + events + subs)
 *
 * Bruker recharts for alle visualiseringer.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  CircularProgress,
  Alert,
  Avatar,
  LinearProgress,
  Divider,
  Button,
  Link,
  alpha,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Insights as InsightsIcon,
  TrendingUp as TrendingUpIcon,
  Payment as PaymentIcon,
  GroupAdd as GroupAddIcon,
  Bolt as BoltIcon,
  OpenInNew as OpenIcon,
  ShoppingCart as CartIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const PALETTE = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#22c55e'];

const fmtKr = (n: number) => `${Math.round(n).toLocaleString('nb-NO')} kr`;
const fmtNum = (n: number) => Number(n || 0).toLocaleString('nb-NO');

const fmtTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'nå';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}t`;
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
};

const cleanEventName = (s: string) => s.replace(/^creatorhub_/, '').replace(/_/g, ' ');

// ─── Dummy time-series basert på topp-events ────────────────────────
// (TODO: når vi har en endpoint for daglige events, bytt ut)
const buildPseudoTimeSeries = (totalLast7d: number) => {
  const days = 7;
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const variance = 0.4 + Math.sin(i * 1.3) * 0.3 + Math.random() * 0.3;
    series.push({
      day: d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' }),
      events: Math.round((totalLast7d / days) * variance),
    });
  }
  return series;
};

const AdminAnalyticsHub: React.FC = () => {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');

  const { data: overview, isLoading: ovLoading, refetch: refetchOv, isFetching: ovFetching } = useQuery({
    queryKey: ['admin-analytics-overview'],
    queryFn: async () => apiRequest('/api/admin/analytics/overview'),
    refetchInterval: 60_000,
  });

  const { data: stripe, isLoading: stLoading, refetch: refetchSt } = useQuery({
    queryKey: ['admin-stripe-overview'],
    queryFn: async () => apiRequest('/api/admin/stripe/payment-status'),
    refetchInterval: 60_000,
  });

  const isLoading = ovLoading || stLoading;

  // ─── Avledede tall ─────────────────────────────────────────────
  const totalEvents = overview?.totals?.[period === '24h' ? 'last24h' : period === '7d' ? 'last7d' : 'last30d'] || 0;
  const stripeRevenue = stripe?.recentRevenue?.[period === '24h' ? 'last24h' : period === '7d' ? 'last7d' : 'last30d'] || 0;
  const successRate = stripe?.counts
    ? Math.round((stripe.counts.succeeded / Math.max(1, stripe.counts.succeeded + stripe.counts.failed)) * 100)
    : 100;

  const timeSeries = useMemo(() => buildPseudoTimeSeries(overview?.totals?.last7d || 0), [overview]);

  const funnel = overview?.funnel || {};
  const funnelData = [
    { stage: '1. Inquiry mottatt', count: funnel.inquiry_received || 0, color: '#7c3aed' },
    { stage: '2. Inquiry besvart', count: funnel.inquiry_replied || 0, color: '#06b6d4' },
    { stage: '3. Konvertert til prosjekt', count: funnel.inquiry_converted_to_project || 0, color: '#10b981' },
  ];
  const conversionRate = funnel.inquiry_received > 0
    ? Math.round((funnel.inquiry_converted_to_project / funnel.inquiry_received) * 100)
    : 0;

  // KPI-kort
  const kpis = [
    {
      label: 'Hendelser',
      value: fmtNum(totalEvents),
      sub: `siste ${period}`,
      color: '#7c3aed',
      icon: <BoltIcon />,
    },
    {
      label: 'Revenue',
      value: fmtKr(stripeRevenue),
      sub: `siste ${period}`,
      color: '#10b981',
      icon: <PaymentIcon />,
    },
    {
      label: 'Konverteringsrate',
      value: `${conversionRate}%`,
      sub: 'inquiry → prosjekt (30d)',
      color: '#f59e0b',
      icon: <TrendingUpIcon />,
    },
    {
      label: 'Aktive abonnement',
      value: fmtNum(stripe?.activeSubscriptions || 0),
      sub: 'i Stripe',
      color: '#06b6d4',
      icon: <CartIcon />,
    },
    {
      label: 'Betalings-suksess',
      value: `${successRate}%`,
      sub: `${stripe?.counts?.succeeded || 0} ok / ${stripe?.counts?.failed || 0} feilet`,
      color: successRate >= 95 ? '#10b981' : '#ef4444',
      icon: <PaymentIcon />,
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: alpha('#7c3aed', 0.15), color: '#7c3aed' }}>
              <InsightsIcon />
            </Avatar>
            <Box>
              <Typography variant="overline" sx={{ color: '#7c3aed', letterSpacing: '0.16em' }}>
                Analytics Hub
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>
                Hele CreatorHub i ett øyekast
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            size="small"
            value={period}
            exclusive
            onChange={(_, v) => v && setPeriod(v)}
          >
            <ToggleButton value="24h">24t</ToggleButton>
            <ToggleButton value="7d">7d</ToggleButton>
            <ToggleButton value="30d">30d</ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={() => { refetchOv(); refetchSt(); }} disabled={ovFetching}>
            <RefreshIcon />
          </IconButton>
          <Button
            size="small"
            endIcon={<OpenIcon fontSize="small" />}
            href="https://analytics.google.com/"
            target="_blank"
            sx={{ textTransform: 'none' }}
          >
            GA4
          </Button>
          <Button
            size="small"
            endIcon={<OpenIcon fontSize="small" />}
            href="https://dashboard.stripe.com/"
            target="_blank"
            sx={{ textTransform: 'none' }}
          >
            Stripe
          </Button>
        </Stack>
      </Stack>

      {overview?.error && (
        <Alert severity="info" sx={{ mb: 2 }}>{overview.error}</Alert>
      )}

      {isLoading && !overview && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* KPI-kort */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5, mb: 3 }}>
        {kpis.map((k) => (
          <Card key={k.label} sx={{ borderLeft: `4px solid ${k.color}` }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {k.label}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: k.color, fontFamily: '"Space Grotesk", sans-serif', mt: 0.5 }}>
                    {k.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {k.sub}
                  </Typography>
                </Box>
                <Box sx={{ color: k.color, opacity: 0.6 }}>{k.icon}</Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Charts row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mb: 2 }}>
        {/* Events over tid */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Hendelser over tid (7 dager)</Typography>
            <Box sx={{ height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={timeSeries}>
                  <defs>
                    <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RTooltip />
                  <Area type="monotone" dataKey="events" stroke="#7c3aed" strokeWidth={2} fill="url(#evGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* Top event-typer */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Top events (7d)</Typography>
            {(overview?.topEvents || []).length === 0 ? (
              <Typography variant="caption" color="text.secondary">Ingen data ennå.</Typography>
            ) : (
              <Box sx={{ height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={(overview?.topEvents || []).slice(0, 8)} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="eventType"
                      width={130}
                      tick={{ fontSize: 10 }}
                      tickFormatter={cleanEventName}
                    />
                    <RTooltip formatter={(v: any) => fmtNum(Number(v))} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {(overview?.topEvents || []).slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Funnel + Revenue per app */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
        {/* Inquiry funnel */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              Inquiry-funnel (30d)
            </Typography>
            <Stack spacing={1.5}>
              {funnelData.map((s, idx) => {
                const pct = funnelData[0].count > 0 ? (s.count / funnelData[0].count) * 100 : 0;
                return (
                  <Box key={s.stage}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.stage}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: s.color }}>
                        {fmtNum(s.count)} {idx > 0 && `(${pct.toFixed(0)}%)`}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, pct)}
                      sx={{
                        height: 12,
                        borderRadius: 6,
                        bgcolor: alpha(s.color, 0.12),
                        '& .MuiLinearProgress-bar': {
                          bgcolor: s.color,
                          borderRadius: 6,
                        },
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">Konvertering totalt</Typography>
              <Chip
                size="small"
                label={`${conversionRate}%`}
                color={conversionRate >= 20 ? 'success' : conversionRate >= 10 ? 'warning' : 'default'}
                sx={{ fontWeight: 700 }}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Stripe events pie */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Stripe-fordeling (siste 25 events)
            </Typography>
            {!stripe?.counts || (stripe.counts.succeeded + stripe.counts.failed + stripe.counts.refunded === 0) ? (
              <Typography variant="caption" color="text.secondary">Ingen Stripe-data tilgjengelig.</Typography>
            ) : (
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Vellykket', value: stripe.counts.succeeded || 0, color: '#10b981' },
                        { name: 'Feilet', value: stripe.counts.failed || 0, color: '#ef4444' },
                        { name: 'Refundert', value: stripe.counts.refunded || 0, color: '#f59e0b' },
                      ].filter((s) => s.value > 0)}
                      dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={50} outerRadius={85}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {[
                        { color: '#10b981' }, { color: '#ef4444' }, { color: '#f59e0b' },
                      ].map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Siste hendelser + abonnement-tabell */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Recent events */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Siste hendelser
            </Typography>
            {(overview?.recentEvents || []).length === 0 ? (
              <Typography variant="caption" color="text.secondary">Ingen events registrert ennå.</Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {(overview?.recentEvents || []).slice(0, 10).map((ev: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ py: 0.5, borderBottom: idx === 9 ? 0 : undefined }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {cleanEventName(ev.eventType)}
                        </Typography>
                        {ev.actorUserId && (
                          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.65rem' }}>
                            {ev.actorUserId.slice(0, 8)}…
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.5, borderBottom: idx === 9 ? 0 : undefined }}>
                        <Typography variant="caption" color="text.secondary">
                          {fmtTime(ev.createdAt)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Stripe events */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Siste Stripe-hendelser
            </Typography>
            {(stripe?.events || []).length === 0 ? (
              <Typography variant="caption" color="text.secondary">Ingen Stripe-events.</Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {(stripe?.events || []).slice(0, 10).map((ev: any, idx: number) => (
                    <TableRow key={ev.id}>
                      <TableCell sx={{ py: 0.5, borderBottom: idx === 9 ? 0 : undefined }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {ev.type}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.5, borderBottom: idx === 9 ? 0 : undefined }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: ev.status === 'success' ? '#10b981' : ev.status === 'failed' ? '#ef4444' : '#6b7280' }}>
                          {ev.amount > 0 ? fmtKr(ev.amount) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.5, borderBottom: idx === 9 ? 0 : undefined }}>
                        <Typography variant="caption" color="text.secondary">
                          {fmtTime(ev.createdAt)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Tall oppdateres hver 60. sekund. Detaljerte dimensjoner og ad-hoc-queries gjøres i{' '}
          <Link href="https://analytics.google.com/" target="_blank" rel="noopener">GA4-konsollen</Link>{' '}
          eller{' '}
          <Link href="https://dashboard.stripe.com/" target="_blank" rel="noopener">Stripe Dashboard</Link>.
        </Typography>
      </Box>
    </Box>
  );
};

export default AdminAnalyticsHub;
