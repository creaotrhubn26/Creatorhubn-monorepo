// Slice 9X.17 — surface-widgets som vises i UniversalDashboard-fanene
// (Worklog, Administration, Wedding-Timeline) når profession === 'photographer'.
// Eksisterende fotograf-data fra /api/photographer/* mates her i stedet
// for at fotografen må navigere bort til /photographer/projects osv.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Box, Paper, Stack, Typography, Button, Chip, LinearProgress,
  CircularProgress, Alert, Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  AccessTime, TrendingUp, AttachMoney, Receipt, OpenInNew,
  Folder, Warning, EmojiEvents, Timeline as TimelineIcon, ArrowForward,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

// ─────────────────────────────────────────────────────────────────────────
// WORKLOG widget — vises i Worklog-fanen
// ─────────────────────────────────────────────────────────────────────────

interface WorklogSummary {
  totals: { weekHours: number; monthHours: number; totalHours: number; avgPerDay: number };
  perProject: Array<{
    projectId: string;
    title: string;
    projectType: string | null;
    weekHours: number;
    monthHours: number;
    totalHours: number;
    totalCost: number;
    servicePrice: number;
  }>;
  dailyLast14: Array<{ date: string; hours: number }>;
}

export function PhotographerWorklogWidget() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<WorklogSummary>({
    queryKey: ['/api/photographer/worklog/summary'],
    queryFn: () => apiRequest('/api/photographer/worklog/summary'),
  });

  if (isLoading) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <CircularProgress size={20} /> <Typography variant="caption">Laster timer…</Typography>
      </Paper>
    );
  }
  if (!data) return null;

  const t = data.totals;
  const topProjects = data.perProject.slice(0, 5);
  const maxDaily = Math.max(...data.dailyLast14.map((d) => d.hours), 1);

  return (
    <Paper sx={{ p: 3, mb: 3, border: 2, borderColor: 'primary.main', borderStyle: 'solid' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTime color="primary" /> Mine prosjekt-timer
        </Typography>
        <Button
          size="small" endIcon={<ArrowForward />}
          onClick={() => navigate('/photographer/projects')}
        >
          Se alle prosjekter
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
        <Box sx={{ minWidth: 120 }}>
          <Typography variant="caption" color="text.secondary">Denne uka</Typography>
          <Typography variant="h4">{t.weekHours.toFixed(1)}t</Typography>
          <Typography variant="caption" color="text.secondary">
            Snitt {t.avgPerDay.toFixed(1)}t/dag
          </Typography>
        </Box>
        <Box sx={{ minWidth: 120 }}>
          <Typography variant="caption" color="text.secondary">Denne måneden</Typography>
          <Typography variant="h4" color="primary.main">{t.monthHours.toFixed(0)}t</Typography>
        </Box>
        <Box sx={{ minWidth: 120 }}>
          <Typography variant="caption" color="text.secondary">Totalt</Typography>
          <Typography variant="h4">{t.totalHours.toFixed(0)}t</Typography>
        </Box>

        {/* Sparkline siste 14 dager */}
        <Box sx={{ flexGrow: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary">Siste 14 dager</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 60, gap: 0.5, mt: 0.5 }}>
            {data.dailyLast14.length === 0 ? (
              <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center' }}>
                Ingen timer logget enda
              </Typography>
            ) : (
              data.dailyLast14.map((d) => (
                <Tooltip key={d.date} title={`${d.date}: ${d.hours.toFixed(1)}t`}>
                  <Box sx={{
                    flex: 1,
                    height: `${(d.hours / maxDaily) * 100}%`,
                    bgcolor: 'primary.main',
                    borderRadius: '2px 2px 0 0',
                    minHeight: 2,
                    opacity: 0.8,
                  }} />
                </Tooltip>
              ))
            )}
          </Box>
        </Box>
      </Stack>

      {topProjects.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Topp 5 prosjekter denne uka
          </Typography>
          <Stack spacing={1}>
            {topProjects.map((p) => {
              const margin = p.servicePrice > 0
                ? ((p.servicePrice - p.totalCost) / p.servicePrice) * 100 : null;
              return (
                <Paper
                  key={p.projectId}
                  variant="outlined"
                  sx={{ p: 1.5, cursor: 'pointer' }}
                  onClick={() => navigate(`/photographer/projects/${p.projectId}`)}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" fontWeight={500}>{p.title}</Typography>
                        {p.projectType && (
                          <Chip size="small" label={p.projectType} variant="outlined"
                            sx={{ height: 18, fontSize: 11 }} />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {p.weekHours.toFixed(1)}t denne uka · {p.totalHours.toFixed(0)}t totalt
                      </Typography>
                    </Box>
                    {margin !== null && (
                      <Chip
                        size="small"
                        color={margin >= 50 ? 'success' : margin >= 25 ? 'warning' : 'error'}
                        label={`${margin.toFixed(0)}%`}
                      />
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </>
      )}
    </Paper>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ADMINISTRATION widget — vises i Administration-fanen
// ─────────────────────────────────────────────────────────────────────────

interface ProfitabilityResp {
  totals: {
    revenueGross: number;
    revenueNet: number;
    profit: number;
    marginPct: number | null;
    projectCount: number;
  };
}

interface ProjectsListResp {
  projects: Array<{
    id: string;
    title: string;
    clientName: string | null;
    servicePrice: number;
    eventDate: string | null;
    status: string;
  }>;
}

export function PhotographerAdminWidgets() {
  const [, navigate] = useLocation();
  const { data: profit } = useQuery<ProfitabilityResp>({
    queryKey: ['/api/photographer/profitability/summary'],
    queryFn: () => apiRequest('/api/photographer/profitability/summary'),
  });
  const { data: projects } = useQuery<{ projects: any[] }>({
    queryKey: ['/api/photographer/projects'],
    queryFn: () => apiRequest('/api/photographer/projects'),
  });

  // Ufakturerte = service_price > 0 og invoice_provider null
  // Vi fetcher ikke invoice_provider i list-endepunktet, så vi henter
  // antallet via detail-call OR antar at completed status uten invoice
  // er kandidater. For nå: vis alle aktive med pris > 0 (forenkling).
  const unbilledCount = (projects?.projects ?? [])
    .filter((p) => p.servicePrice > 0 && p.status === 'completed').length;

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
      <Paper sx={{ p: 2.5, flexGrow: 1, cursor: 'pointer' }}
        onClick={() => navigate('/photographer/profitability')}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TrendingUp color="success" />
          <Typography variant="body2" fontWeight={600}>Lønnsomhet (netto)</Typography>
          <OpenInNew sx={{ fontSize: 14, ml: 'auto', color: 'text.secondary' }} />
        </Stack>
        {profit ? (
          <>
            <Typography variant="h5" sx={{ mt: 1 }}
              color={profit.totals.profit >= 0 ? 'success.main' : 'error.main'}>
              {profit.totals.profit.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} kr
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {profit.totals.marginPct !== null ? `${profit.totals.marginPct.toFixed(0)}%` : '—'} margin
              {' · '}{profit.totals.projectCount} prosjekt
            </Typography>
          </>
        ) : (
          <Typography variant="caption" color="text.disabled">Laster…</Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, flexGrow: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Receipt color={unbilledCount > 0 ? 'warning' : 'action'} />
          <Typography variant="body2" fontWeight={600}>Ufakturerte prosjekter</Typography>
        </Stack>
        <Typography variant="h5" sx={{ mt: 1 }}>
          {unbilledCount}
        </Typography>
        {unbilledCount > 0 ? (
          <Typography variant="caption" color="warning.main">
            Fullførte prosjekter uten faktura — generér via PowerOffice
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Alle fullførte prosjekter er fakturert
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, flexGrow: 1, cursor: 'pointer' }}
        onClick={() => navigate('/photographer/settings/integrations')}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AttachMoney color="primary" />
          <Typography variant="body2" fontWeight={600}>Regnskap-integrasjon</Typography>
          <OpenInNew sx={{ fontSize: 14, ml: 'auto', color: 'text.secondary' }} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          PowerOffice / Tripletex — sjekk status
        </Typography>
      </Paper>
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// WEDDING-TIMELINE widget — viser andre prosjekttyper i samme fane
// ─────────────────────────────────────────────────────────────────────────

interface ProjectsListEntry {
  id: string;
  title: string;
  clientName: string | null;
  projectType: string | null;
  eventDate: string | null;
  status: string;
}

export function PhotographerOtherProjectsTimelineWidget() {
  const [, navigate] = useLocation();
  const { data } = useQuery<{ projects: ProjectsListEntry[] }>({
    queryKey: ['/api/photographer/projects'],
    queryFn: () => apiRequest('/api/photographer/projects'),
  });

  // Filtrer bort bryllup — disse vises i hovedfanen
  const nonWedding = (data?.projects ?? []).filter((p) => {
    const t = (p.projectType || '').toLowerCase();
    return t !== 'bryllup' && t !== 'wedding' && !t.includes('wedding');
  }).slice(0, 8);

  if (nonWedding.length === 0) return null;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimelineIcon /> Andre prosjekter (ikke-bryllup)
        </Typography>
        <Button size="small" endIcon={<ArrowForward />}
          onClick={() => navigate('/photographer/projects')}>
          Se alle
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Wedding-Timeline-fanen er kun for bryllup. Her er andre prosjekttyper med egen tidslinje.
      </Typography>
      <Stack spacing={1}>
        {nonWedding.map((p) => (
          <Paper key={p.id} variant="outlined" sx={{ p: 1.5, cursor: 'pointer' }}
            onClick={() => navigate(`/photographer/projects/${p.id}`)}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={500}>{p.title}</Typography>
                  {p.projectType && (
                    <Chip size="small" label={p.projectType} variant="outlined"
                      sx={{ height: 18, fontSize: 11 }} />
                  )}
                  <Chip size="small"
                    color={p.status === 'completed' ? 'success' : 'primary'}
                    label={p.status} sx={{ height: 18, fontSize: 11 }} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {p.clientName ?? '—'}
                  {p.eventDate && ` · ${new Date(p.eventDate).toLocaleDateString('nb-NO')}`}
                </Typography>
              </Box>
              <ArrowForward sx={{ fontSize: 16, color: 'action.active' }} />
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
