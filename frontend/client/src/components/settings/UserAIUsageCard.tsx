// @ts-nocheck
/**
 * UserAIUsageCard — Slice 9X.71
 *
 * Viser brukerens eget AI-forbruk i settings:
 *   - Totalkostnad og tokens siste 24t / 7d / 30d
 *   - Top features
 *   - Daglig trend
 *   - Siste 10 kall
 *
 * Backend: /api/me/ai-usage
 */

import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  ToggleButton, ToggleButtonGroup, IconButton, Avatar,
  CircularProgress, LinearProgress, alpha,
} from '@mui/material';
import {
  AutoAwesome as AIIcon,
  Refresh as RefreshIcon,
  CheckCircle as OkIcon,
  Cancel as FailIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const fmtUsd = (n: number) => `$${Number(n || 0).toFixed(4).replace(/\.?0+$/, '')}`;
const fmtUsdShort = (n: number) =>
  n < 0.01 ? `$${(n * 100).toFixed(2)}¢` : `$${n.toFixed(2)}`;
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

const cleanModel = (m: string) => m.replace(/-\d{8}$/, '').replace(/\[.*\]/g, '');

const UserAIUsageCard: React.FC = () => {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('30d');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['me-ai-usage'],
    queryFn: async () => apiRequest('/api/me/ai-usage'),
    refetchInterval: 120_000,
  });

  const totals = data?.totals?.[period === '24h' ? 'last24h' : period === '7d' ? 'last7d' : 'last30d'] || {};
  const topFeatureCost = (data?.byFeature?.[0]?.costUsd) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: alpha('#7c3aed', 0.15), color: '#7c3aed' }}>
              <AIIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Mitt AI-forbruk</Typography>
              <Typography variant="caption" color="text.secondary">
                Claude-bruk og kostnader for kontoen din
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButtonGroup size="small" value={period} exclusive onChange={(_, v) => v && setPeriod(v)}>
              <ToggleButton value="24h">24t</ToggleButton>
              <ToggleButton value="7d">7d</ToggleButton>
              <ToggleButton value="30d">30d</ToggleButton>
            </ToggleButtonGroup>
            <IconButton size="small" onClick={() => refetch()} disabled={isFetching}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {/* Slice 9X.71 — Faktura-kort: hva brukeren faktisk må betale */}
        {data?.customerBilling && (data.customerBilling.monthlyEstimateNok > 0) && (
          <Box sx={{
            p: 2, mb: 2, borderRadius: 2,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(6,182,212,0.06))',
            border: '1px solid', borderColor: alpha('#7c3aed', 0.32),
          }}>
            <Typography variant="caption" sx={{ color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              Estimert månedlig kost
            </Typography>
            <Stack direction="row" alignItems="baseline" spacing={1.5}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#7c3aed', fontFamily: '"Space Grotesk", sans-serif' }}>
                {Math.round(data.customerBilling.monthlyEstimateNok).toLocaleString('nb-NO')} kr
              </Typography>
              <Typography variant="caption" color="text.secondary">
                basert på de siste 30 dagene
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Dette dekkes av AI-tillegget i abonnementet ditt — du faktureres ikke direkte for det.
            </Typography>
          </Box>
        )}

        {/* Kompakte KPI-tall */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#7c3aed', 0.06), border: '1px solid', borderColor: alpha('#7c3aed', 0.18) }}>
            <Typography variant="caption" color="text.secondary">Faktisk Claude-kost</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#7c3aed', fontFamily: '"Space Grotesk", sans-serif' }}>
              {fmtUsd(totals.costUsd || 0)}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#06b6d4', 0.06), border: '1px solid', borderColor: alpha('#06b6d4', 0.18) }}>
            <Typography variant="caption" color="text.secondary">Kall</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#06b6d4', fontFamily: '"Space Grotesk", sans-serif' }}>
              {fmtNum(totals.calls || 0)}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#10b981', 0.06), border: '1px solid', borderColor: alpha('#10b981', 0.18) }}>
            <Typography variant="caption" color="text.secondary">Tokens</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#10b981', fontFamily: '"Space Grotesk", sans-serif' }}>
              {fmtTokens(totals.tokens || 0)}
            </Typography>
          </Box>
        </Box>

        {/* Daglig trend */}
        {(data?.byDay || []).length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Daglig kostnad (30d)
            </Typography>
            <Box sx={{ height: 150 }}>
              <ResponsiveContainer>
                <AreaChart data={data.byDay}>
                  <defs>
                    <linearGradient id="userCostGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="day" tick={{ fontSize: 10 }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                  <RTooltip
                    formatter={(v: any) => fmtUsd(Number(v))}
                    labelFormatter={(d) => new Date(d).toLocaleDateString('nb-NO')}
                  />
                  <Area type="monotone" dataKey="costUsd" stroke="#7c3aed" strokeWidth={2} fill="url(#userCostGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        )}

        {/* Top features */}
        {(data?.byFeature || []).length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Hva du har brukt mest
            </Typography>
            <Stack spacing={0.5}>
              {(data.byFeature || []).slice(0, 5).map((f: any) => {
                const pct = topFeatureCost > 0 ? (f.costUsd / topFeatureCost) * 100 : 0;
                return (
                  <Box key={f.feature}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>{f.feature}</Typography>
                      <Typography variant="caption" sx={{ color: '#7c3aed', fontWeight: 700 }}>
                        {fmtUsdShort(f.costUsd)} · {fmtTokens(f.tokens)} tokens · {fmtNum(f.calls)} kall
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate" value={Math.min(100, pct)}
                      sx={{
                        height: 5, borderRadius: 3, bgcolor: alpha('#7c3aed', 0.1),
                        '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed', borderRadius: 3 },
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Siste kall */}
        {(data?.recent || []).length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Siste hendelser
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ py: 0.5 }}>Feature</TableCell>
                  <TableCell sx={{ py: 0.5 }}>Modell</TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>Tokens</TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>Kost</TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>Tid</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.recent || []).slice(0, 10).map((ev: any, idx: number) => (
                  <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ py: 0.5 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {ev.success ? (
                          <OkIcon sx={{ fontSize: 12, color: '#10b981' }} />
                        ) : (
                          <FailIcon sx={{ fontSize: 12, color: '#ef4444' }} />
                        )}
                        <Typography variant="caption">{ev.feature}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'text.secondary' }}>
                        {cleanModel(ev.model)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {fmtTokens(ev.inputTokens + ev.outputTokens)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#7c3aed' }}>
                        {fmtUsdShort(ev.costUsd)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {fmtTime(ev.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {(data?.recent || []).length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Ingen AI-forbruk registrert ennå.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default UserAIUsageCard;
