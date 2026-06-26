/**
 * AgencyAcquisitionDashboard.tsx
 *
 * J — Admin Room "Byrå-akkvisisjon"-dashboard.
 *
 * Funnel-viz + konverteringsrater + tid-i-steg + pipeline-verdi
 * for agency_leads-tabellen. Bygger på eksisterende:
 *   - Migrasjon 241 (agency_leads + funnel + UTM-felter)
 *   - GET /api/admin-room/agency-acquisition/dashboard (denne PR-en)
 *   - PATCH /api/admin-room/agency-leads/:id (denne PR-en)
 *   - B2BAcquisitionPanel (eksisterende — vi viser dashboard OVER den)
 *
 * UX-prinsipper:
 *   - Funnel-viz: 5 trinn (new → contacted → demo → trial → customer)
 *     med konverteringsrate vist mellom hvert steg
 *   - Hovedtall: total customers + pipeline-verdi som ett bilde
 *   - Hot leads-liste med ett-klikks status-progresjon
 *   - Velocity-mini-chart (siste 8 uker)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  IconButton, LinearProgress, Menu, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

interface DashboardData {
  funnel: Record<string, number>;
  funnelTotals: {
    total: number; new: number; contacted: number;
    demo: number; trial: number; customer: number; disqualified: number;
  };
  conversionRates: {
    new_to_contacted: number;
    contacted_to_demo: number;
    demo_to_trial: number;
    trial_to_customer: number;
    overall: number;
  };
  avgDaysInStage: {
    new_to_contacted: number | null;
    contacted_to_trial: number | null;
    trial_to_customer: number | null;
  };
  velocityByWeek: Array<{ week: string; n: number; customers: number }>;
  pipelineValueNok: {
    annual_trial: number;
    annual_customer: number;
    weighted_pipeline: number;
  };
  arpuMonthlyNok: number;
  topSources: Array<{ source_key: string; n: number; customers: number }>;
  hotLeads: Array<{
    id: string; agency_name: string; contact_name: string; email: string;
    status: string; segment: string; roster_size: string | null;
    conversion_persona?: string | null;
    created_at: string; days_old: number;
  }>;
  generatedAt: string;
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'Ny', color: '#c084fc' },
  contacted: { label: 'Kontaktet', color: '#60a5fa' },
  demo: { label: 'Demo booket', color: '#fbbf24' },
  trial: { label: 'Prøveperiode', color: '#fb923c' },
  customer: { label: 'Kunde', color: '#34d399' },
};

const STATUS_NEXT: Record<string, string> = {
  new: 'contacted',
  contacted: 'demo_booked',
  demo_booked: 'trial',
  trial: 'customer',
};

function formatNok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: '2-digit', month: 'short',
  });
}

export default function AgencyAcquisitionDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arpu, setArpu] = useState(4900);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(
        `/api/admin-room/agency-acquisition/dashboard?arpuMonthlyNok=${arpu}`,
        { credentials: 'include' },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [arpu]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const advanceLead = async (leadId: string, currentStatus: string) => {
    const nextStatus = STATUS_NEXT[currentStatus];
    if (!nextStatus) return;
    setUpdating(leadId);
    try {
      const r = await fetch(`/api/admin-room/agency-leads/${leadId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (r.ok) await fetchDashboard();
    } finally {
      setUpdating(null);
    }
  };

  // Konverter til kunde — sender kontakten den persona-forhåndsutfylte
  // selvbetjente onboarding-/checkout-lenken. Webhook flipper til 'customer'
  // når betalingen fullføres.
  const [convertMenu, setConvertMenu] = useState<{ anchor: HTMLElement; leadId: string } | null>(null);
  const [convertResult, setConvertResult] = useState<{ leadId: string; url: string } | null>(null);

  const convertLead = async (leadId: string, persona: 'production_team' | 'content_producer') => {
    setConvertMenu(null);
    setUpdating(leadId);
    try {
      const r = await fetch(`/api/admin-room/agency-leads/${leadId}/convert-to-customer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        if (d?.onboardingUrl) setConvertResult({ leadId, url: d.onboardingUrl });
        await fetchDashboard();
      }
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <Card sx={{ bgcolor: '#150b2e', border: '1px solid rgba(168,85,247,0.18)' }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#c084fc' }} />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card sx={{ bgcolor: '#150b2e', border: '1px solid rgba(168,85,247,0.18)' }}>
        <CardContent>
          <Alert severity="error">{error ?? 'Ingen data'}</Alert>
        </CardContent>
      </Card>
    );
  }

  const t = data.funnelTotals;
  const maxStage = Math.max(t.new, t.contacted, t.demo, t.trial, t.customer, 1);
  const hotLeads = Array.isArray(data.hotLeads) ? data.hotLeads : [];
  const velocityByWeek = Array.isArray(data.velocityByWeek) ? data.velocityByWeek : [];
  const topSources = Array.isArray(data.topSources) ? data.topSources : [];

  return (
    <Card sx={{
      bgcolor: '#150b2e', border: '1px solid rgba(168,85,247,0.18)',
      borderRadius: 2,
    }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.4,
              bgcolor: 'rgba(168,85,247,0.12)',
              border: '1px solid rgba(168,85,247,0.32)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUpOutlinedIcon sx={{ color: '#c084fc', fontSize: 24 }} />
            </Box>
            <Stack>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#f5f3ff' }}>
                Byrå-akkvisisjon
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#c4b5fd' }}>
                Funnel · konvertering · pipeline-verdi
              </Typography>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <TextField
              size="small" label="ARPU/mnd (NOK)" type="number"
              value={arpu}
              onChange={(e) => setArpu(Number(e.target.value) || 0)}
              sx={{ width: 140, '& input': { color: '#f5f3ff' }, '& label': { color: '#8b7ec4' } }}
            />
            <Tooltip title="Oppdater">
              <IconButton onClick={fetchDashboard} sx={{ color: '#c4b5fd' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Hovedtall */}
        <Stack direction="row" spacing={1.4} sx={{ mb: 3 }}>
          {[
            {
              label: 'Total leads', value: t.total, color: '#c084fc',
              hint: `${t.disqualified} disqualified`,
            },
            {
              label: 'Aktive kunder', value: t.customer, color: '#34d399',
              hint: `${data.conversionRates.overall}% av kvalifiserte`,
            },
            {
              label: 'Pipeline (annual)', value: `${formatNok(data.pipelineValueNok.weighted_pipeline)} kr`,
              color: '#fbbf24', hint: `${t.trial + t.demo} i pipeline`,
            },
            {
              label: 'Hot leads', value: hotLeads.length, color: '#fb923c',
              hint: 'siste 14 dager',
            },
          ].map((k) => (
            <Box key={k.label} sx={{
              flex: 1, p: 1.8, borderRadius: 1.6,
              bgcolor: 'rgba(168,85,247,0.04)',
              border: '1px solid rgba(168,85,247,0.18)',
            }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#8b7ec4', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {k.label}
              </Typography>
              <Typography sx={{ fontSize: '1.7rem', fontWeight: 800, color: k.color, lineHeight: 1.1, my: 0.4 }}>
                {k.value}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#8b7ec4' }}>
                {k.hint}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Funnel-viz med konvertering-pile */}
        <Box sx={{ mb: 3, p: 2, borderRadius: 1.6, bgcolor: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.18)' }}>
          <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#f5f3ff', mb: 1.4 }}>
            Trakt
          </Typography>
          <Stack direction="row" spacing={0.4} alignItems="flex-end">
            {[
              { key: 'new', count: t.new },
              { key: 'contacted', count: t.contacted, rate: data.conversionRates.new_to_contacted, daysFrom: data.avgDaysInStage.new_to_contacted },
              { key: 'demo', count: t.demo, rate: data.conversionRates.contacted_to_demo },
              { key: 'trial', count: t.trial, rate: data.conversionRates.demo_to_trial, daysFrom: data.avgDaysInStage.contacted_to_trial },
              { key: 'customer', count: t.customer, rate: data.conversionRates.trial_to_customer, daysFrom: data.avgDaysInStage.trial_to_customer },
            ].map((stage, idx) => {
              const meta = STAGE_LABELS[stage.key];
              const widthPct = (stage.count / maxStage) * 100;
              return (
                <Stack key={stage.key} direction="row" alignItems="flex-end" sx={{ flex: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    {idx > 0 && (
                      <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.4} sx={{ mb: 0.4, height: 24 }}>
                        <ArrowForwardOutlinedIcon sx={{ fontSize: 12, color: '#8b7ec4' }} />
                        <Typography sx={{ fontSize: '0.68rem', color: '#c4b5fd', fontWeight: 700 }}>
                          {stage.rate}%
                        </Typography>
                        {stage.daysFrom !== null && stage.daysFrom !== undefined && (
                          <Tooltip title={`Snitt-tid: ${stage.daysFrom} dager`}>
                            <AccessTimeOutlinedIcon sx={{ fontSize: 10, color: '#8b7ec4' }} />
                          </Tooltip>
                        )}
                      </Stack>
                    )}
                    <Box sx={{
                      bgcolor: meta.color,
                      height: Math.max(40, widthPct * 1.4),
                      borderRadius: 1,
                      transition: 'height 240ms ease',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      p: 0.6,
                    }}>
                      <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#160a24', lineHeight: 1 }}>
                        {stage.count}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#160a24', mt: 0.2 }}>
                        {meta.label}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.4 }}>
            <Typography sx={{ fontSize: '0.72rem', color: '#8b7ec4' }}>
              Total-konvertering (kvalifiserte → kunde): <strong style={{ color: '#34d399' }}>{data.conversionRates.overall}%</strong>
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#8b7ec4' }}>
              ARPU: {arpu.toLocaleString('nb-NO')} kr/mnd
            </Typography>
          </Stack>
        </Box>

        {/* Pipeline + velocity side ved side */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} sx={{ mb: 3 }}>
          {/* Pipeline-verdi */}
          <Box sx={{ flex: 1, p: 2, borderRadius: 1.6, bgcolor: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.18)' }}>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 1.4 }}>
              <PaidOutlinedIcon sx={{ color: '#fbbf24', fontSize: 18 }} />
              <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#f5f3ff' }}>
                Pipeline-verdi (annual NOK)
              </Typography>
            </Stack>
            <Stack spacing={0.8}>
              {[
                { label: 'Eksisterende kunder', value: data.pipelineValueNok.annual_customer, weight: 100, color: '#34d399' },
                { label: 'I prøveperiode', value: data.pipelineValueNok.annual_trial, weight: 50, color: '#fb923c' },
                { label: 'Vektet pipeline (alle stadier)', value: data.pipelineValueNok.weighted_pipeline, weight: 100, color: '#c084fc' },
              ].map((p) => (
                <Box key={p.label}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.2 }}>
                    <Typography sx={{ fontSize: '0.78rem', color: '#c4b5fd' }}>{p.label}</Typography>
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: p.color }}>
                      {p.value.toLocaleString('nb-NO')} kr
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>

          {/* Velocity */}
          <Box sx={{ flex: 1, p: 2, borderRadius: 1.6, bgcolor: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.18)' }}>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 1.4 }}>
              <TrendingUpOutlinedIcon sx={{ color: '#c084fc', fontSize: 18 }} />
              <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#f5f3ff' }}>
                Velocity (siste 8 uker)
              </Typography>
            </Stack>
            {velocityByWeek.length === 0 ? (
              <Typography sx={{ fontSize: '0.78rem', color: '#8b7ec4', fontStyle: 'italic' }}>
                Ingen leads ennå
              </Typography>
            ) : (
              <Stack spacing={0.4}>
                {velocityByWeek.slice().reverse().map((w) => {
                  const maxN = Math.max(...velocityByWeek.map((x) => x.n), 1);
                  return (
                    <Stack key={w.week} direction="row" alignItems="center" spacing={0.8}>
                      <Typography sx={{ fontSize: '0.7rem', color: '#8b7ec4', minWidth: 60 }}>
                        {formatDate(w.week)}
                      </Typography>
                      <Box sx={{ flex: 1, position: 'relative', height: 14 }}>
                        <Box sx={{
                          height: '100%', borderRadius: 0.6,
                          bgcolor: '#c084fc',
                          width: `${(w.n / maxN) * 100}%`,
                          transition: 'width 240ms ease',
                        }} />
                        {w.customers > 0 && (
                          <Box sx={{
                            position: 'absolute', top: 0, left: 0,
                            height: '100%', borderRadius: 0.6,
                            bgcolor: '#34d399',
                            width: `${(w.customers / maxN) * 100}%`,
                          }} />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: '0.74rem', color: '#f5f3ff', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>
                        {w.n}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Stack>

        {/* Hot leads */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 1.4 }}>
            <LocalFireDepartmentOutlinedIcon sx={{ color: '#fb923c', fontSize: 20 }} />
            <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#f5f3ff' }}>
              Hot leads
            </Typography>
            <Chip
              size="small" label={`${hotLeads.length}`}
              sx={{ bgcolor: 'rgba(251,146,60,0.18)', color: '#fb923c', fontWeight: 700, height: 18 }}
            />
          </Stack>

          {hotLeads.length === 0 ? (
            <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
              Ingen nye leads siste 14 dager. Dobbeltsjekk landing-trafikk + UTM-tagging.
            </Alert>
          ) : (
            <Stack spacing={0.8}>
              {hotLeads.map((lead) => {
                const stageMeta = STAGE_LABELS[lead.status === 'demo_booked' ? 'demo' : lead.status] ?? STAGE_LABELS.new;
                const nextStatus = STATUS_NEXT[lead.status];
                return (
                  <Box key={lead.id} sx={{
                    p: 1.4, borderRadius: 1.2,
                    bgcolor: 'rgba(168,85,247,0.04)',
                    border: '1px solid rgba(168,85,247,0.18)',
                    display: 'flex', alignItems: 'center', gap: 1.4,
                  }}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: 1,
                      bgcolor: stageMeta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <GroupsOutlinedIcon sx={{ color: '#160a24', fontSize: 18 }} />
                    </Box>
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.8}>
                        <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#f5f3ff' }}>
                          {lead.agency_name}
                        </Typography>
                        <Chip
                          size="small" label={stageMeta.label}
                          sx={{ bgcolor: `${stageMeta.color}33`, color: stageMeta.color, fontWeight: 700, height: 18, fontSize: '0.66rem' }}
                        />
                        {lead.roster_size && (
                          <Chip
                            size="small" label={lead.roster_size}
                            sx={{ bgcolor: 'rgba(139,126,196,0.18)', color: '#c4b5fd', fontWeight: 600, height: 18, fontSize: '0.66rem' }}
                          />
                        )}
                      </Stack>
                      <Typography sx={{ fontSize: '0.74rem', color: '#8b7ec4' }}>
                        {lead.contact_name} · {lead.email} · {Math.round(lead.days_old)} dager
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      {(lead.status === 'demo_booked' || lead.status === 'trial') && (
                        <Button
                          size="small" variant="outlined"
                          onClick={(e) => setConvertMenu({ anchor: e.currentTarget, leadId: lead.id })}
                          disabled={updating === lead.id}
                          startIcon={updating === lead.id ? <CircularProgress size={12} /> : <PersonAddAltOutlinedIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            color: '#34d399', borderColor: 'rgba(52,211,153,0.5)',
                            fontWeight: 700, fontSize: '0.72rem', textTransform: 'none',
                            '&:hover': { borderColor: '#34d399', bgcolor: 'rgba(52,211,153,0.08)' },
                          }}
                        >
                          Konverter
                        </Button>
                      )}
                      {nextStatus && (
                        <Button
                          size="small" variant="contained"
                          onClick={() => advanceLead(lead.id, lead.status)}
                          disabled={updating === lead.id}
                          startIcon={updating === lead.id ? <CircularProgress size={12} /> : <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                          sx={{
                            bgcolor: stageMeta.color, color: '#160a24',
                            fontWeight: 700, fontSize: '0.72rem',
                            '&:hover': { bgcolor: stageMeta.color, filter: 'brightness(0.9)' },
                          }}
                        >
                          → {STAGE_LABELS[nextStatus === 'demo_booked' ? 'demo' : nextStatus]?.label ?? nextStatus}
                        </Button>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}

          {convertResult && (
            <Alert
              severity="success"
              onClose={() => setConvertResult(null)}
              sx={{ mt: 1.4, bgcolor: 'rgba(52,211,153,0.1)', color: '#86efac', border: '1px solid rgba(52,211,153,0.3)' }}
            >
              Onboarding-lenke sendt til kontakten på e-post. Direktelenke:{' '}
              <Box
                component="a"
                href={convertResult.url}
                target="_blank"
                rel="noreferrer"
                sx={{ color: '#34d399', wordBreak: 'break-all' }}
              >
                {convertResult.url}
              </Box>
            </Alert>
          )}
        </Box>

        <Menu
          anchorEl={convertMenu?.anchor ?? null}
          open={Boolean(convertMenu)}
          onClose={() => setConvertMenu(null)}
          PaperProps={{ sx: { bgcolor: '#1a0f3a', color: '#f5f3ff', border: '1px solid rgba(168,85,247,0.3)' } }}
        >
          <Typography sx={{ px: 2, py: 0.8, fontSize: '0.7rem', color: '#8b7ec4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Send onboarding-lenke som…
          </Typography>
          <MenuItem
            onClick={() => convertMenu && convertLead(convertMenu.leadId, 'content_producer')}
            sx={{ fontSize: '0.84rem' }}
          >
            Innholdsprodusent · fra 495 kr/sete
          </MenuItem>
          <MenuItem
            onClick={() => convertMenu && convertLead(convertMenu.leadId, 'production_team')}
            sx={{ fontSize: '0.84rem' }}
          >
            Produksjonsteam · fra 795 kr/sete (min. 3)
          </MenuItem>
        </Menu>

        {/* Top sources */}
        <Box sx={{ p: 2, borderRadius: 1.6, bgcolor: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.18)' }}>
          <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#f5f3ff', mb: 1.4 }}>
            Topp-kilder
          </Typography>
          {topSources.length === 0 ? (
            <Typography sx={{ fontSize: '0.78rem', color: '#8b7ec4', fontStyle: 'italic' }}>
              Ingen leads ennå
            </Typography>
          ) : (
            <Stack spacing={0.6}>
              {topSources.slice(0, 6).map((s) => {
                const maxN = Math.max(...topSources.map((x) => x.n), 1);
                const cvr = s.n > 0 ? Math.round((s.customers / s.n) * 100) : 0;
                return (
                  <Stack key={s.source_key} direction="row" alignItems="center" spacing={1}>
                    <Typography sx={{ fontSize: '0.78rem', color: '#f5f3ff', fontWeight: 600, minWidth: 120 }}>
                      {s.source_key}
                    </Typography>
                    <Box sx={{ flex: 1, position: 'relative' }}>
                      <LinearProgress
                        variant="determinate"
                        value={(s.n / maxN) * 100}
                        sx={{
                          height: 6, borderRadius: 3,
                          bgcolor: 'rgba(168,85,247,0.10)',
                          '& .MuiLinearProgress-bar': { bgcolor: '#c084fc' },
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.78rem', color: '#c4b5fd', fontWeight: 700, minWidth: 30, textAlign: 'right' }}>
                      {s.n}
                    </Typography>
                    {s.customers > 0 && (
                      <Chip
                        size="small" label={`${cvr}% won`}
                        sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 700, height: 18, fontSize: '0.66rem' }}
                      />
                    )}
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>

        {/* Footer */}
        <Typography sx={{ fontSize: '0.7rem', color: '#8b7ec4', mt: 2, textAlign: 'right' }}>
          Oppdatert {new Date(data.generatedAt).toLocaleTimeString('nb-NO')}
        </Typography>
      </CardContent>
    </Card>
  );
}
