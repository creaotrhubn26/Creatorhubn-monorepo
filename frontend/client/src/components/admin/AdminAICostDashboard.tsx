// @ts-nocheck
/**
 * AdminAICostDashboard — Slice 9X.71
 *
 * Power-BI-aktig oversikt over Claude AI-bruk og kostnader i CreatorHub.
 * Daniel ser i ett bilde:
 *   - Totalkostnad (24t / 7d / 30d) i USD
 *   - Top features etter kost
 *   - Modell-fordeling
 *   - Daglig trend (kostnad + kall)
 *   - Per-bruker tabell (hvem bruker mest)
 *   - Cache-besparelser
 *   - Error rate
 *
 * Backend: /api/admin/ai-usage/{overview,by-user,recent}
 */

import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Chip, Avatar,
  Table, TableHead, TableRow, TableCell, TableBody,
  ToggleButton, ToggleButtonGroup, IconButton,
  CircularProgress, Alert, LinearProgress, Divider, alpha,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  Speed as SpeedIcon,
  Savings as SavingsIcon,
  Error as ErrorIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AdminCard, AdminLoading, AdminError, AdminTableContainer } from './design-system';

const PALETTE = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#22c55e'];

const fmtUsd = (n: number) => `$${Number(n || 0).toFixed(2)}`;
const fmtUsdCents = (n: number) => n < 0.01 ? `$${(n * 1000).toFixed(2)}m` : `$${n.toFixed(2)}`;
const fmtNum = (n: number) => Number(n || 0).toLocaleString('nb-NO');
const fmtTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};
const fmtTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 60) return `${diffMin}m siden`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}t siden`;
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' });
};

const AdminAICostDashboard: React.FC = () => {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('30d');

  const { data: overview, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-ai-overview'],
    queryFn: async () => apiRequest('/api/admin/ai-usage/overview'),
    refetchInterval: 60_000,
  });

  const { data: byUserResp } = useQuery({
    queryKey: ['admin-ai-by-user'],
    queryFn: async () => apiRequest('/api/admin/ai-usage/by-user'),
    refetchInterval: 120_000,
  });

  const byUser = Array.isArray(byUserResp?.data) ? byUserResp.data : [];
  const byDay = Array.isArray(overview?.byDay) ? overview.byDay : [];
  const byModel = Array.isArray(overview?.byModel) ? overview.byModel : [];
  const byFeature = Array.isArray(overview?.byFeature) ? overview.byFeature : [];
  const totalRow = overview?.totals?.[period === '24h' ? 'last24h' : period === '7d' ? 'last7d' : 'last30d'] || {};

  // ─── KPI-kort ──────────────────────────────────────────────────
  const kpis = [
    {
      label: 'Totalkostnad',
      value: fmtUsd(totalRow.costUsd || 0),
      sub: `${fmtNum(totalRow.calls || 0)} kall siste ${period}`,
      color: '#c084fc',
      icon: <MoneyIcon />,
    },
    {
      label: 'Tokens forbrukt',
      value: fmtTokens(totalRow.tokens || 0),
      sub: `siste ${period}`,
      color: '#06b6d4',
      icon: <SpeedIcon />,
    },
    {
      label: 'Cache-besparelser',
      value: fmtUsd(overview?.cacheStats?.savingsUsd || 0),
      sub: `${fmtTokens(overview?.cacheStats?.readTokens || 0)} cache-lesninger (30d)`,
      color: '#10b981',
      icon: <SavingsIcon />,
    },
    {
      label: 'Error rate',
      value: `${((overview?.errorRate || 0) * 100).toFixed(1)}%`,
      sub: 'siste 7 dager',
      color: (overview?.errorRate || 0) > 0.05 ? '#ef4444' : '#10b981',
      icon: <ErrorIcon />,
    },
  ];

  if (overview?.error) {
    return (
      <Box>
        <AdminError message={overview.error} onRetry={() => refetch()} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: alpha('#7c3aed', 0.15), color: '#c084fc' }}>
            <AIIcon />
          </Avatar>
          <Box>
            <Typography variant="overline" sx={{ color: '#c084fc', letterSpacing: '0.14em' }}>
              AI cost-dashboard
            </Typography>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif' }}>
              Claude-bruk og kostnader
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <ToggleButtonGroup size="small" value={period} exclusive onChange={(_, v) => v && setPeriod(v)}>
            <ToggleButton value="24h">24t</ToggleButton>
            <ToggleButton value="7d">7d</ToggleButton>
            <ToggleButton value="30d">30d</ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={() => refetch()} disabled={isFetching} aria-label="Oppdater data">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Stack>

      {isLoading && !overview && <AdminLoading />}

      {/* KPI-kort */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5, mb: 3 }}>
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

      {/* Daglig trend + modell-fordeling */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mb: 2 }}>
        <AdminCard title="Daglig kostnad (30d)">
            {byDay.length === 0 ? (
              <Typography variant="caption" color="text.secondary">Ingen data ennå.</Typography>
            ) : (
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={byDay}>
                    <defs>
                      <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d) => new Date(d).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <RTooltip
                      formatter={(v: any, name: string) =>
                        name === 'costUsd' ? fmtUsd(Number(v)) : fmtNum(Number(v))
                      }
                      labelFormatter={(d) => new Date(d).toLocaleDateString('nb-NO')}
                    />
                    <Area
                      type="monotone" dataKey="costUsd" name="Kostnad (USD)"
                      stroke="#7c3aed" strokeWidth={2} fill="url(#costGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            )}
        </AdminCard>

        <AdminCard title="Modell-fordeling (30d)">
            {byModel.length === 0 ? (
              <Typography variant="caption" color="text.secondary">Ingen data ennå.</Typography>
            ) : (
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={byModel}
                      dataKey="costUsd" nameKey="model"
                      cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                      label={({ model, costUsd }) => `${model.split('-').slice(1, 3).join('-')}: ${fmtUsdCents(costUsd)}`}
                    >
                      {byModel.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v: any) => fmtUsd(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
        </AdminCard>
      </Box>

      {/* Top features + per-bruker */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Top features etter kost */}
        <AdminCard title="Top features etter kostnad (30d)">
            {byFeature.length === 0 ? (
              <Typography variant="caption" color="text.secondary">Ingen data ennå.</Typography>
            ) : (
              <Box sx={{ height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={byFeature.slice(0, 8)} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                    <YAxis type="category" dataKey="feature" width={130} tick={{ fontSize: 10 }} />
                    <RTooltip formatter={(v: any) => fmtUsd(Number(v))} />
                    <Bar dataKey="costUsd" name="Kostnad (USD)" radius={[0, 4, 4, 0]}>
                      {byFeature.slice(0, 8).map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
        </AdminCard>

        {/* Detalj-tabell per feature */}
        <AdminCard title="Detaljer per feature">
            {byFeature.length === 0 ? (
              <Typography variant="caption" color="text.secondary">Ingen data ennå.</Typography>
            ) : (
              <AdminTableContainer ariaLabel="Detaljer per feature">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Feature</TableCell>
                    <TableCell align="right">Kall</TableCell>
                    <TableCell align="right">Tokens</TableCell>
                    <TableCell align="right">Kost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {byFeature.slice(0, 12).map((f: any, idx: number) => (
                    <TableRow key={f.feature} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ py: 0.75 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PALETTE[idx % PALETTE.length] }} />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>{f.feature}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.75 }}>
                        <Typography variant="caption">{fmtNum(f.calls)}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">{fmtTokens(f.tokens)}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.75 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#c084fc' }}>
                          {fmtUsdCents(f.costUsd)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </AdminTableContainer>
            )}
        </AdminCard>
      </Box>

      {/* Per-bruker — som user-card */}
      <AdminCard
        title="Hvem bruker mest Claude (30d)"
        sx={{ mt: 2 }}
      >
          {byUser.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              Ingen brukere registrert ennå. (AI-kall uten user_id telles ikke her.)
            </Typography>
          ) : (
            <AdminTableContainer ariaLabel="Hvem bruker mest Claude">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Bruker</TableCell>
                  <TableCell align="right">Kall</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                  <TableCell align="right">Features</TableCell>
                  <TableCell align="right">Kostnad</TableCell>
                  <TableCell align="right">Sist brukt</TableCell>
                  <TableCell>Andel av total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {byUser.slice(0, 25).map((u: any, idx: number) => {
                  const totalCost = byUser.reduce((s: number, x: any) => s + x.costUsd, 0);
                  const pct = totalCost > 0 ? (u.costUsd / totalCost) * 100 : 0;
                  const color = PALETTE[idx % PALETTE.length];
                  return (
                    <TableRow key={u.userId}>
                      <TableCell sx={{ py: 0.75 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar sx={{ width: 24, height: 24, bgcolor: alpha(color, 0.2), color, fontSize: 11, fontWeight: 700 }}>
                            {String(u.userId).slice(0, 2).toUpperCase()}
                          </Avatar>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                            {String(u.userId).slice(0, 14)}…
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.75 }}>
                        <Typography variant="caption">{fmtNum(u.calls)}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">{fmtTokens(u.tokens)}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.75 }}>
                        <Chip size="small" label={u.featuresUsed} sx={{ height: 18, fontSize: '0.65rem' }} />
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.75 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color }}>
                          {fmtUsd(u.costUsd)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 0.75 }}>
                        <Typography variant="caption" color="text.secondary">
                          {fmtTime(u.lastCallAt)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.75, minWidth: 120 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, pct)}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: alpha(color, 0.12),
                            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          {pct.toFixed(1)}%
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </AdminTableContainer>
          )}
      </AdminCard>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Tall oppdateres hver 60. sekund. Kostnader er beregnet fra Anthropic-priser per modell —
          se <code>backend/server/ai-usage-tracker.ts</code> for pricing-tabell.
          Hver call-site må kalle <code>logAIUsage(response, &#123;feature&#125;)</code> for å vises her.
        </Typography>
      </Box>
    </Box>
  );
};

export default AdminAICostDashboard;
