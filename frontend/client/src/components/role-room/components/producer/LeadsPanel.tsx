// Leads — the producer pulls the CLIENT's Meta Lead Ads leads (from connected
// Page) so they can deliver them to the customer. Real-product surface on top
// of the leads_retrieval capability. Live data needs App Review approval; until
// then the panel explains the pending state.
import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Stack, Typography, Chip, Button, List, ListItemButton, ListItemText,
  CircularProgress, Alert, Divider, Table, TableBody, TableCell, TableHead, TableRow,
  Select, MenuItem, TextField, InputAdornment, Collapse,
} from '@mui/material';
import {
  ContactPage as LeadsIcon, InstallMobile as FormIcon, BoltOutlined as FollowupIcon,
  CheckCircle as DoneIcon, Send as SendIcon,
} from '@mui/icons-material';

type Segment = 'varm' | 'lunken' | 'kald' | 'tapt';
const SEGMENTS: { key: Segment; label: string; hint: string; campaign: string; color: string }[] = [
  { key: 'varm', label: 'Varme', hint: 'Vil kontaktes nå', campaign: 'Book en gratis vurdering denne uken', color: '#ef4444' },
  { key: 'lunken', label: 'Lunkne', hint: 'Trenger mer info', campaign: 'Du spurte om behandling – her er hva som skjer videre', color: '#f59e0b' },
  { key: 'kald', label: 'Kalde', hint: 'Lastet ned guide / viste interesse', campaign: 'Kundeeksempel: slik fikk kunden resultatet sitt', color: '#38bdf8' },
  { key: 'tapt', label: 'Tapte', hint: 'Svarte ikke / kjøpte ikke', campaign: 'Vi er her når du er klar – kort oppfølging', color: '#94a3b8' },
];

// Conversion stage for the ROI funnel: answered → booked → became customer → lost.
type Stage = 'svart' | 'booket' | 'kunde' | 'tapt';
const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: 'svart', label: 'Svarte', color: '#38bdf8' },
  { key: 'booket', label: 'Booket møte', color: '#a78bfa' },
  { key: 'kunde', label: 'Ble kunde', color: '#22c55e' },
  { key: 'tapt', label: 'Tapt', color: '#94a3b8' },
];

interface RoiSummary {
  success: boolean;
  spendKr: number;
  totalLeads: number;
  answered: number;
  booked: number;
  customers: number;
  lost: number;
  revenueKr: number;
  costPerLeadKr: number;
  costPerCustomerKr: number;
  roi: number;
}

function kr(n: number): string {
  return `${Math.round(n).toLocaleString('nb-NO')} kr`;
}

interface IgConnection {
  id: string;
  igUsername: string | null;
  facebookPageName: string | null;
}
interface LeadForm {
  id: string;
  name: string;
  status: string | null;
  leadsCount: number | null;
  createdTime: string | null;
}
interface Lead {
  id: string;
  createdTime: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  segment: Segment | null;
  stage: Stage | null;
  valueKr: number;
  followedUpAt: string | null;
  fields: Record<string, string>;
}

interface FollowupConfig {
  smsBody: string;
  emailSubject: string;
  emailBody: string;
  replyTo: string;
  notifyPhone: string;
  notifyEmail: string;
}

function fmt(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
}

export default function LeadsPanel() {
  const [connectionId, setConnectionId] = useState('');
  const [formId, setFormId] = useState('');

  const { data: connData, isLoading: connLoading } = useQuery<{ connections: IgConnection[] }>({
    queryKey: ['leads-connections'],
    queryFn: () => apiRequest('/api/role-room/instagram/messaging/connections'),
  });
  const connections = connData?.connections || [];
  useEffect(() => {
    if (!connectionId && connections.length > 0) setConnectionId(connections[0].id);
  }, [connectionId, connections]);

  const { data: formsData, isLoading: formsLoading } = useQuery<{
    forms: LeadForm[]; pageName: string | null; success: boolean; error: string | null;
  }>({
    queryKey: ['leads-forms', connectionId],
    enabled: !!connectionId,
    queryFn: () => apiRequest(`/api/role-room/leads/producer/forms?connectionId=${encodeURIComponent(connectionId)}`),
  });
  const forms = formsData?.forms || [];

  const { data: leadsData, isLoading: leadsLoading } = useQuery<{
    leads: Lead[]; success: boolean; error: string | null;
  }>({
    queryKey: ['leads-list', connectionId, formId],
    enabled: !!connectionId && !!formId,
    queryFn: () => apiRequest(`/api/role-room/leads/producer/leads?connectionId=${encodeURIComponent(connectionId)}&formId=${encodeURIComponent(formId)}`),
  });
  const leads = leadsData?.leads || [];

  const queryClient = useQueryClient();
  const [segmentFilter, setSegmentFilter] = useState<Segment | 'alle'>('alle');
  const setSegment = useMutation({
    mutationFn: async (vars: { leadId: string; segment: Segment | null }) =>
      apiRequest('/api/role-room/leads/producer/segment', {
        method: 'POST',
        body: JSON.stringify({ connectionId, leadId: vars.leadId, segment: vars.segment }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads-list', connectionId, formId] }),
  });

  // ── ROI: conversion stage + value per lead, spend per form, funnel summary ──
  const { data: summary } = useQuery<RoiSummary>({
    queryKey: ['leads-summary', connectionId, formId],
    enabled: !!connectionId && !!formId,
    queryFn: () => apiRequest(`/api/role-room/leads/producer/summary?connectionId=${encodeURIComponent(connectionId)}&formId=${encodeURIComponent(formId)}`),
  });
  const invalidateRoi = () => {
    queryClient.invalidateQueries({ queryKey: ['leads-list', connectionId, formId] });
    queryClient.invalidateQueries({ queryKey: ['leads-summary', connectionId, formId] });
  };
  const setOutcome = useMutation({
    mutationFn: async (vars: { leadId: string; stage: Stage | null; valueKr?: number }) =>
      apiRequest('/api/role-room/leads/producer/outcome', {
        method: 'POST',
        body: JSON.stringify({ connectionId, formId, leadId: vars.leadId, stage: vars.stage, valueKr: vars.valueKr ?? 0 }),
      }),
    onSuccess: invalidateRoi,
  });
  const setSpend = useMutation({
    mutationFn: async (spendKr: number) =>
      apiRequest('/api/role-room/leads/producer/spend', {
        method: 'POST',
        body: JSON.stringify({ connectionId, formId, spendKr }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads-summary', connectionId, formId] }),
  });
  // Local spend input, seeded from the saved summary; saved on blur.
  const [spendInput, setSpendInput] = useState('');
  useEffect(() => { setSpendInput(summary?.spendKr ? String(summary.spendKr) : ''); }, [summary?.spendKr, formId]);

  // ── Fast follow-up: templates + seller notification + per-lead send ──────
  const [showFollowup, setShowFollowup] = useState(false);
  const { data: followupData } = useQuery<{
    config: FollowupConfig; smsConfigured: boolean; emailConfigured: boolean; success: boolean;
  }>({
    queryKey: ['leads-followup-config', connectionId],
    enabled: !!connectionId,
    queryFn: () => apiRequest(`/api/role-room/leads/producer/followup-config?connectionId=${encodeURIComponent(connectionId)}`),
  });
  const [cfg, setCfg] = useState<FollowupConfig | null>(null);
  useEffect(() => { if (followupData?.config) setCfg(followupData.config); }, [followupData?.config]);
  const saveFollowupConfig = useMutation({
    mutationFn: async (c: FollowupConfig) =>
      apiRequest('/api/role-room/leads/producer/followup-config', {
        method: 'POST', body: JSON.stringify({ connectionId, ...c }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads-followup-config', connectionId] }),
  });
  const sendFollowup = useMutation({
    mutationFn: async (lead: Lead) =>
      apiRequest('/api/role-room/leads/producer/followup', {
        method: 'POST',
        body: JSON.stringify({ connectionId, formId, leadId: lead.id, name: lead.name, email: lead.email, phone: lead.phone }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads-list', connectionId, formId] }),
  });
  const channelsReady = (followupData?.smsConfigured || followupData?.emailConfigured) ?? false;
  const counts = useMemo(() => {
    const c: Record<string, number> = { alle: leads.length };
    for (const s of SEGMENTS) c[s.key] = leads.filter((l) => l.segment === s.key).length;
    return c;
  }, [leads]);
  const visibleLeads = segmentFilter === 'alle' ? leads : leads.filter((l) => l.segment === segmentFilter);
  const activeSegment = SEGMENTS.find((s) => s.key === segmentFilter) || null;

  const exportCsv = () => {
    if (visibleLeads.length === 0) return;
    const stageLabel = (k: Stage | null) => STAGES.find((s) => s.key === k)?.label ?? '';
    const rows = [
      ['Navn', 'E-post', 'Telefon', 'Segment', 'Status', 'Verdi (kr)', 'Tidspunkt'],
      ...visibleLeads.map((l) => [l.name ?? '', l.email ?? '', l.phone ?? '', l.segment ?? '', stageLabel(l.stage), l.valueKr ? String(l.valueKr) : '', fmt(l.createdTime)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const selectedForm = useMemo(() => forms.find((f) => f.id === formId) || null, [forms, formId]);
  const graphError = formsData && formsData.success === false ? formsData.error : (leadsData && leadsData.success === false ? leadsData.error : null);

  return (
    <Stack spacing={1.6} sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <LeadsIcon sx={{ color: '#22d3ee' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.05rem' }}>Leads til kunden</Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.84rem' }}>
            Skjema-svar fra kundens Meta-annonser (Lead Ads). Hent dem inn her og lever til kunden.
          </Typography>
        </Box>
        {connections.length > 1 ? (
          <select
            value={connectionId}
            onChange={(e) => { setConnectionId(e.target.value); setFormId(''); }}
            style={{ background: '#0f1729', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: 8 }}
          >
            {connections.map((c) => <option key={c.id} value={c.id}>{c.facebookPageName || `@${c.igUsername}`}</option>)}
          </select>
        ) : null}
      </Stack>

      {connLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : connections.length === 0 ? (
        <Alert severity="info">Koble til kundens Facebook-side først (under Feed-planner) for å hente leads.</Alert>
      ) : (
        <>
          {graphError ? (
            <Alert severity="info">
              Leads-henting er ikke aktiv ennå (venter på godkjenning av <code>leads_retrieval</code> fra Meta).
              Når det er godkjent dukker kundens skjema-leads opp her automatisk.
            </Alert>
          ) : null}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px 1fr' }, gap: 2 }}>
            {/* Forms */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
              <Typography sx={{ px: 1.4, py: 1, fontWeight: 700, fontSize: '0.8rem', color: 'rgba(226,232,240,0.7)', borderBottom: '1px solid', borderColor: 'divider' }}>
                Lead-skjemaer
              </Typography>
              {formsLoading ? (
                <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>
              ) : forms.length === 0 ? (
                <Typography sx={{ p: 2, color: 'rgba(226,232,240,0.5)', fontSize: '0.82rem' }}>
                  Ingen lead-skjemaer funnet på kundens side ennå.
                </Typography>
              ) : (
                <List disablePadding>
                  {forms.map((f) => (
                    <ListItemButton key={f.id} selected={f.id === formId} onClick={() => setFormId(f.id)}>
                      <FormIcon fontSize="small" sx={{ mr: 1, color: 'rgba(226,232,240,0.55)' }} />
                      <ListItemText
                        primary={f.name}
                        secondary={`${f.leadsCount != null ? `${f.leadsCount} leads` : f.status ?? ''}`}
                        primaryTypographyProps={{ noWrap: true, fontSize: '0.86rem' }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>

            {/* Leads table */}
            <Box sx={{ minWidth: 0 }}>
              {!formId ? (
                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">Velg et lead-skjema til venstre for å se leads.</Typography>
                </Box>
              ) : leadsLoading ? (
                <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={22} /></Box>
              ) : (
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontWeight: 700, color: '#e2e8f0' }}>
                      {selectedForm?.name} · {visibleLeads.length}{segmentFilter !== 'alle' ? ` ${activeSegment?.label.toLowerCase()}` : ''} leads
                    </Typography>
                    <Button size="small" variant="outlined" onClick={exportCsv} disabled={visibleLeads.length === 0}>
                      Eksporter CSV{segmentFilter !== 'alle' ? ` (${activeSegment?.label})` : ''}
                    </Button>
                  </Stack>

                  {/* Segment filter for retargeting */}
                  <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small" label={`Alle (${counts.alle})`} clickable
                      onClick={() => setSegmentFilter('alle')}
                      variant={segmentFilter === 'alle' ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 700, bgcolor: segmentFilter === 'alle' ? 'rgba(34,211,238,0.18)' : 'transparent', color: segmentFilter === 'alle' ? '#22d3ee' : 'rgba(226,232,240,0.7)' }}
                    />
                    {SEGMENTS.map((s) => (
                      <Chip
                        key={s.key} size="small" clickable
                        label={`${s.label} (${counts[s.key] ?? 0})`}
                        onClick={() => setSegmentFilter(s.key)}
                        variant={segmentFilter === s.key ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 700, bgcolor: segmentFilter === s.key ? `${s.color}26` : 'transparent', color: s.color, borderColor: `${s.color}66` }}
                      />
                    ))}
                  </Stack>

                  {/* Retargeting campaign suggestion for the active segment */}
                  {activeSegment ? (
                    <Alert
                      severity="info"
                      sx={{ bgcolor: `${activeSegment.color}14`, color: '#e2e8f0', border: `1px solid ${activeSegment.color}40`, '& .MuiAlert-icon': { color: activeSegment.color } }}
                    >
                      <strong>{activeSegment.label}</strong> — {activeSegment.hint}. Forslag til kampanje: «{activeSegment.campaign}». Eksporter gruppen og kjør en retargeting-kampanje mot den.
                    </Alert>
                  ) : null}

                  {/* ROI / resultater for kunden */}
                  <Box sx={{ border: '1px solid rgba(34,197,94,0.35)', bgcolor: 'rgba(34,197,94,0.07)', borderRadius: 2, p: 1.6 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                      <Typography sx={{ fontWeight: 800, color: '#f8fafc' }}>Resultater å vise kunden</Typography>
                      <TextField
                        size="small" type="number" label="Annonsekostnad"
                        value={spendInput}
                        onChange={(e) => setSpendInput(e.target.value)}
                        onBlur={() => { const v = Number(spendInput) || 0; if (v !== (summary?.spendKr ?? 0)) setSpend.mutate(v); }}
                        InputProps={{ endAdornment: <InputAdornment position="end">kr</InputAdornment> }}
                        sx={{ width: 180, '& input': { color: '#f8fafc' } }}
                      />
                    </Stack>
                    {/* Funnel: spend → leads → cost/lead → answered → booked → customers → revenue */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)', md: 'repeat(7,1fr)' }, gap: 1 }}>
                      {[
                        { label: 'Brukt på annonser', value: kr(summary?.spendKr ?? 0), color: '#e2e8f0' },
                        { label: 'Leads inn', value: String(summary?.totalLeads ?? 0), color: '#22d3ee' },
                        { label: 'Pris per lead', value: kr(summary?.costPerLeadKr ?? 0), color: '#e2e8f0' },
                        { label: 'Svarte', value: String(summary?.answered ?? 0), color: '#38bdf8' },
                        { label: 'Booket møte', value: String(summary?.booked ?? 0), color: '#a78bfa' },
                        { label: 'Ble kunder', value: String(summary?.customers ?? 0), color: '#22c55e' },
                        { label: 'Omsetning', value: kr(summary?.revenueKr ?? 0), color: '#22c55e' },
                      ].map((cell) => (
                        <Box key={cell.label} sx={{ textAlign: 'center', py: 0.5 }}>
                          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: cell.color }}>{cell.value}</Typography>
                          <Typography sx={{ fontSize: '0.68rem', color: 'rgba(226,232,240,0.6)' }}>{cell.label}</Typography>
                        </Box>
                      ))}
                    </Box>
                    {summary && summary.spendKr > 0 ? (
                      <Typography sx={{ mt: 1, fontSize: '0.84rem', color: '#86efac', fontWeight: 600 }}>
                        {summary.revenueKr > 0
                          ? `For hver krone brukt på annonser fikk kunden ${summary.roi.toFixed(1).replace('.', ',')} kr tilbake${summary.customers > 0 ? ` · ${kr(summary.costPerCustomerKr)} per ny kunde` : ''}.`
                          : 'Fyll inn omsetning på kundene under («Ble kunde» + verdi) for å vise verdien i kroner.'}
                      </Typography>
                    ) : (
                      <Typography sx={{ mt: 1, fontSize: '0.8rem', color: 'rgba(226,232,240,0.6)' }}>
                        Skriv inn annonsekostnaden over, og merk hver lead med status under, så regner vi ut pris per lead og avkastning automatisk.
                      </Typography>
                    )}
                  </Box>

                  {/* Rask oppfølging — templates + seller notification */}
                  <Box sx={{ border: '1px solid rgba(56,189,248,0.3)', bgcolor: 'rgba(56,189,248,0.06)', borderRadius: 2 }}>
                    <Stack
                      direction="row" alignItems="center" spacing={1}
                      sx={{ p: 1.4, cursor: 'pointer' }}
                      onClick={() => setShowFollowup((v) => !v)}
                    >
                      <FollowupIcon sx={{ color: '#38bdf8' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 800, color: '#f8fafc' }}>Rask oppfølging</Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.6)' }}>
                          Send automatisk SMS + e-post til nye leads, og varsle kunden. Trykk «Følg opp» på en lead under.
                        </Typography>
                      </Box>
                      <Typography sx={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700 }}>
                        {showFollowup ? 'Skjul' : 'Tilpass meldinger'}
                      </Typography>
                    </Stack>
                    <Collapse in={showFollowup}>
                      <Box sx={{ px: 1.4, pb: 1.6 }}>
                        {!channelsReady ? (
                          <Alert severity="info" sx={{ mb: 1.5 }}>
                            SMS/e-post er ikke koblet på ennå. Meldingene under lagres, og sendes automatisk så snart utsending er aktivert.
                          </Alert>
                        ) : null}
                        {cfg ? (
                          <Stack spacing={1.4}>
                            <TextField
                              label="SMS til kunden (leadet)" size="small" fullWidth multiline
                              value={cfg.smsBody}
                              onChange={(e) => setCfg({ ...cfg, smsBody: e.target.value })}
                              helperText="Bruk {navn} for fornavnet og {bedrift} for bedriftsnavnet."
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
                              <TextField
                                label="E-post emne" size="small" fullWidth
                                value={cfg.emailSubject}
                                onChange={(e) => setCfg({ ...cfg, emailSubject: e.target.value })}
                              />
                            </Stack>
                            <TextField
                              label="E-post tekst" size="small" fullWidth multiline minRows={3}
                              value={cfg.emailBody}
                              onChange={(e) => setCfg({ ...cfg, emailBody: e.target.value })}
                            />
                            <TextField
                              label="Kundens svar-adresse" size="small" fullWidth
                              value={cfg.replyTo}
                              onChange={(e) => setCfg({ ...cfg, replyTo: e.target.value })}
                              placeholder="kontakt@bedrift.no"
                              helperText="E-posten vises med bedriftsnavnet som avsender. Når leadet svarer, går svaret til denne adressen (kundens innboks)."
                            />
                            <Divider><Typography sx={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.5)' }}>Varsle kunden om nye leads</Typography></Divider>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4}>
                              <TextField
                                label="Kundens mobilnummer (SMS-varsel)" size="small" fullWidth
                                value={cfg.notifyPhone}
                                onChange={(e) => setCfg({ ...cfg, notifyPhone: e.target.value })}
                                placeholder="+47 …"
                              />
                              <TextField
                                label="Kundens e-post (varsel)" size="small" fullWidth
                                value={cfg.notifyEmail}
                                onChange={(e) => setCfg({ ...cfg, notifyEmail: e.target.value })}
                                placeholder="kunde@bedrift.no"
                              />
                            </Stack>
                            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                              {saveFollowupConfig.isSuccess ? (
                                <Typography sx={{ fontSize: '0.78rem', color: '#86efac' }}>Lagret</Typography>
                              ) : null}
                              <Button
                                size="small" variant="contained"
                                onClick={() => saveFollowupConfig.mutate(cfg)}
                                disabled={saveFollowupConfig.isPending}
                              >
                                Lagre meldinger
                              </Button>
                            </Stack>
                          </Stack>
                        ) : <CircularProgress size={18} />}
                      </Box>
                    </Collapse>
                  </Box>

                  <Divider />
                  {visibleLeads.length === 0 ? (
                    <Typography sx={{ p: 2, color: 'rgba(226,232,240,0.5)', fontSize: '0.84rem' }}>
                      {leads.length === 0 ? 'Ingen leads i dette skjemaet ennå.' : 'Ingen leads i denne gruppen ennå.'}
                    </Typography>
                  ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Navn</TableCell>
                            <TableCell>E-post</TableCell>
                            <TableCell>Telefon</TableCell>
                            <TableCell>Segment</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Verdi (kr)</TableCell>
                            <TableCell>Oppfølging</TableCell>
                            <TableCell>Tidspunkt</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleLeads.map((l) => (
                            <TableRow key={l.id}>
                              <TableCell>{l.name ?? '—'}</TableCell>
                              <TableCell>{l.email ?? '—'}</TableCell>
                              <TableCell>{l.phone ?? '—'}</TableCell>
                              <TableCell sx={{ minWidth: 120 }}>
                                <Select
                                  size="small" variant="standard"
                                  value={l.segment ?? ''}
                                  displayEmpty
                                  onChange={(e) => setSegment.mutate({ leadId: l.id, segment: (e.target.value || null) as Segment | null })}
                                  sx={{ fontSize: '0.8rem', minWidth: 100 }}
                                >
                                  <MenuItem value=""><em>Ikke satt</em></MenuItem>
                                  {SEGMENTS.map((s) => (
                                    <MenuItem key={s.key} value={s.key} sx={{ color: s.color }}>{s.label.replace(/r$|e$/, '')}</MenuItem>
                                  ))}
                                </Select>
                              </TableCell>
                              <TableCell sx={{ minWidth: 130 }}>
                                <Select
                                  size="small" variant="standard"
                                  value={l.stage ?? ''}
                                  displayEmpty
                                  onChange={(e) => setOutcome.mutate({ leadId: l.id, stage: (e.target.value || null) as Stage | null, valueKr: l.valueKr })}
                                  sx={{ fontSize: '0.8rem', minWidth: 110 }}
                                >
                                  <MenuItem value=""><em>Ny</em></MenuItem>
                                  {STAGES.map((s) => (
                                    <MenuItem key={s.key} value={s.key} sx={{ color: s.color }}>{s.label}</MenuItem>
                                  ))}
                                </Select>
                              </TableCell>
                              <TableCell sx={{ minWidth: 110 }}>
                                {l.stage === 'kunde' ? (
                                  <TextField
                                    size="small" variant="standard" type="number"
                                    defaultValue={l.valueKr || ''}
                                    placeholder="0"
                                    onBlur={(e) => {
                                      const v = Number(e.target.value) || 0;
                                      if (v !== l.valueKr) setOutcome.mutate({ leadId: l.id, stage: 'kunde', valueKr: v });
                                    }}
                                    sx={{ width: 90, '& input': { fontSize: '0.8rem' } }}
                                  />
                                ) : (
                                  <Typography sx={{ fontSize: '0.8rem', color: 'rgba(226,232,240,0.4)' }}>—</Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ minWidth: 120 }}>
                                {l.followedUpAt ? (
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <DoneIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                                    <Typography sx={{ fontSize: '0.74rem', color: '#86efac' }}>Fulgt opp</Typography>
                                  </Stack>
                                ) : (
                                  <Button
                                    size="small" variant="outlined" startIcon={<SendIcon sx={{ fontSize: 15 }} />}
                                    disabled={(!l.phone && !l.email) || (sendFollowup.isPending && sendFollowup.variables?.id === l.id)}
                                    onClick={() => sendFollowup.mutate(l)}
                                    sx={{ fontSize: '0.72rem', py: 0.2 }}
                                  >
                                    Følg opp
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell>{fmt(l.createdTime)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          </Box>
        </>
      )}
    </Stack>
  );
}
