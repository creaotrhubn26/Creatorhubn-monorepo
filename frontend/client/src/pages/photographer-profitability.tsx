// Slice 9X.9.A — lønnsomhets-dashboard for fotograf.
// Aggregerer alle prosjekter til total revenue, total kostnad, og margin.
// Per tjenestetype (bryllup vs portrett vs kommersiell) ser fotografen
// hvilke tjenester som faktisk gir best yield per time, og topp/bunn
// prosjekter for å forstå hva som drar ned eller opp gjennomsnittet.

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Box, Typography, Paper, Stack, CircularProgress, Chip, Grid2, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, Divider,
} from '@mui/material';
import {
  TrendingUp, TrendingDown, AttachMoney, AccessTime, Folder,
  EmojiEvents, Warning,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface ServiceTypeSummary {
  projectType: string;
  projects: number;
  revenue: number;          // brutto (bakoverkompat)
  revenueGross: number;
  revenueNet: number;
  vatAmount: number;
  cost: number;
  profit: number;
  hours: number;
  marginPct: number | null;
  avgHourlyYield: number | null;
}

interface ProjectSummary {
  id: string;
  title: string;
  projectType: string;
  clientName: string;
  eventDate: string | null;
  status: string;
  revenue: number;          // brutto (bakoverkompat)
  revenueGross: number;
  revenueNet: number;
  vatRate: number;
  vatAmount: number;
  trackedHours: number;
  trackedCost: number;
  overhead: number;
  totalCost: number;
  profit: number;
  marginPct: number | null;
}

interface SummaryResponse {
  totals: {
    revenue: number;        // brutto (bakoverkompat)
    revenueGross: number;
    revenueNet: number;
    vatAmount: number;
    totalCost: number;
    profit: number;
    trackedHours: number;
    marginPct: number | null;
    projectCount: number;
  };
  serviceTypes: ServiceTypeSummary[];
  topProjects: ProjectSummary[];
  bottomProjects: ProjectSummary[];
  projects: ProjectSummary[];
}

function marginColor(pct: number | null): 'success' | 'warning' | 'error' | 'default' {
  if (pct === null) return 'default';
  if (pct >= 50) return 'success';
  if (pct >= 25) return 'warning';
  return 'error';
}

function marginSx(pct: number | null) {
  if (pct === null) return { color: 'text.primary' };
  if (pct >= 50) return { color: 'success.main' };
  if (pct >= 25) return { color: 'warning.main' };
  return { color: 'error.main' };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('nb-NO', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PhotographerProfitability() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useQuery<SummaryResponse>({
    queryKey: ['/api/photographer/profitability/summary'],
    queryFn: () => apiRequest('/api/photographer/profitability/summary'),
  });

  const insights = useMemo(() => {
    if (!data) return [];
    const out: { severity: 'success' | 'warning' | 'info' | 'error'; text: string }[] = [];
    const t = data.totals;
    if (t.projectCount === 0) {
      out.push({ severity: 'info', text: 'Ingen prosjekter ennå — opprett ditt første for å se lønnsomhet.' });
      return out;
    }
    if (t.marginPct !== null) {
      if (t.marginPct < 25) {
        out.push({
          severity: 'error',
          text: `Total margin ${t.marginPct.toFixed(0)}% er under sunn frelans-terskel (50%). Vurder prisøkning eller redusér timebruk.`,
        });
      } else if (t.marginPct >= 50) {
        out.push({
          severity: 'success',
          text: `Sterk total margin ${t.marginPct.toFixed(0)}% — du har rom for å skalere eller investere i utstyr.`,
        });
      } else {
        out.push({
          severity: 'warning',
          text: `Margin ${t.marginPct.toFixed(0)}% er ok, men under 50%-målet. Identifiser hvilke tjenester som drar ned.`,
        });
      }
    }
    const worst = data.serviceTypes
      .filter((s) => s.marginPct !== null && s.projects >= 1)
      .sort((a, b) => (a.marginPct ?? Infinity) - (b.marginPct ?? Infinity))[0];
    if (worst && worst.marginPct !== null && worst.marginPct < 30) {
      out.push({
        severity: 'warning',
        text: `${worst.projectType} har lavest margin (${worst.marginPct.toFixed(0)}%). Vurder å øke prisen eller slutte å tilby denne tjenesten.`,
      });
    }
    const best = data.serviceTypes
      .filter((s) => s.avgHourlyYield !== null)
      .sort((a, b) => (b.avgHourlyYield ?? 0) - (a.avgHourlyYield ?? 0))[0];
    if (best && best.avgHourlyYield !== null && best.avgHourlyYield > 0) {
      out.push({
        severity: 'info',
        text: `${best.projectType} gir best timeyield (${Math.round(best.avgHourlyYield)} kr/t fortjeneste). Fokuser markedsføring her.`,
      });
    }
    return out;
  }, [data]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">Kunne ikke laste lønnsomhets-data.</Alert>
      </Box>
    );
  }

  const t = data.totals;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <TrendingUp fontSize="large" /> Lønnsomhet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Sann fortjeneste etter trackede timer × din timepris og faste kostnader.
        Sammenlign tjenestetyper og finn dine mest profitable kunder.
      </Typography>

      <Grid2 container spacing={2} sx={{ mb: 3 }}>
        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <AttachMoney color="primary" />
              <Typography variant="caption" color="text.secondary">Inntekt (netto eks. MVA)</Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {t.revenueNet.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Brutto {t.revenueGross.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr · {t.projectCount} prosjekt(er)
            </Typography>
          </Paper>
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TrendingDown color="action" />
              <Typography variant="caption" color="text.secondary">Kostnad + MVA-skyld</Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {t.totalCost.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t.trackedHours.toFixed(0)}t · MVA-skyld {t.vatAmount.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr
            </Typography>
          </Paper>
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TrendingUp color="success" />
              <Typography variant="caption" color="text.secondary">Fortjeneste</Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 1, ...marginSx(t.marginPct) }}>
              {t.profit.toLocaleString('nb-NO')} kr
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Etter timer + faste kostnader
            </Typography>
          </Paper>
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <EmojiEvents color="warning" />
              <Typography variant="caption" color="text.secondary">Total margin</Typography>
            </Stack>
            <Typography variant="h4" sx={{ mt: 1, ...marginSx(t.marginPct) }}>
              {t.marginPct !== null ? `${t.marginPct.toFixed(0)}%` : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Mål: 50%+
            </Typography>
          </Paper>
        </Grid2>
      </Grid2>

      {insights.length > 0 && (
        <Stack spacing={1} sx={{ mb: 3 }}>
          {insights.map((i, idx) => (
            <Alert key={idx} severity={i.severity}>{i.text}</Alert>
          ))}
        </Stack>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Folder /> Per tjenestetype
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tjeneste</TableCell>
                <TableCell align="right">Antall</TableCell>
                <TableCell align="right">Brutto</TableCell>
                <TableCell align="right">Netto</TableCell>
                <TableCell align="right">MVA</TableCell>
                <TableCell align="right">Kostnad</TableCell>
                <TableCell align="right">Fortjeneste</TableCell>
                <TableCell align="right">Kr/t</TableCell>
                <TableCell align="right">Margin (netto)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.serviceTypes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Ingen prosjekter ennå.
                  </TableCell>
                </TableRow>
              )}
              {data.serviceTypes.map((s) => (
                <TableRow key={s.projectType}>
                  <TableCell><Chip size="small" label={s.projectType} variant="outlined" /></TableCell>
                  <TableCell align="right">{s.projects}</TableCell>
                  <TableCell align="right">{s.revenueGross.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr</TableCell>
                  <TableCell align="right">{s.revenueNet.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary' }}>
                    {s.vatAmount.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr
                  </TableCell>
                  <TableCell align="right">{s.cost.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr</TableCell>
                  <TableCell align="right" sx={marginSx(s.marginPct)}>
                    {s.profit.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr
                  </TableCell>
                  <TableCell align="right">
                    {s.avgHourlyYield !== null ? `${Math.round(s.avgHourlyYield)} kr` : '—'}
                  </TableCell>
                  <TableCell align="right">
                    {s.marginPct !== null
                      ? <Chip size="small" color={marginColor(s.marginPct)} label={`${s.marginPct.toFixed(0)}%`} />
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
              <EmojiEvents /> Topp 5 mest profitable
            </Typography>
            {data.topProjects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Ingen prosjekter med inntekt ennå.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {data.topProjects.map((p) => (
                  <Paper
                    key={p.id} variant="outlined"
                    sx={{ p: 1.5, cursor: 'pointer' }}
                    onClick={() => navigate(`/photographer/projects/${p.id}`)}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{p.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.clientName} · {formatDate(p.eventDate)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip
                          size="small"
                          color={marginColor(p.marginPct)}
                          label={p.marginPct !== null ? `${p.marginPct.toFixed(0)}%` : '—'}
                        />
                        <Typography variant="caption" display="block" color="text.secondary">
                          {p.profit.toLocaleString('nb-NO')} kr
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid2>

        <Grid2 size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
              <Warning /> Bunn 5 — vurder pris-økning
            </Typography>
            {data.bottomProjects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Ingen prosjekter med inntekt ennå.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {data.bottomProjects.map((p) => (
                  <Paper
                    key={p.id} variant="outlined"
                    sx={{ p: 1.5, cursor: 'pointer' }}
                    onClick={() => navigate(`/photographer/projects/${p.id}`)}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{p.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.clientName} · {formatDate(p.eventDate)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip
                          size="small"
                          color={marginColor(p.marginPct)}
                          label={p.marginPct !== null ? `${p.marginPct.toFixed(0)}%` : '—'}
                        />
                        <Typography variant="caption" display="block" color="text.secondary">
                          {p.profit.toLocaleString('nb-NO')} kr
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid2>
      </Grid2>
    </Box>
  );
}
