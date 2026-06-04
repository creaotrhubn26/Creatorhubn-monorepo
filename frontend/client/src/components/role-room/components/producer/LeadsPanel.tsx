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
  Select, MenuItem,
} from '@mui/material';
import { ContactPage as LeadsIcon, InstallMobile as FormIcon } from '@mui/icons-material';

type Segment = 'varm' | 'lunken' | 'kald' | 'tapt';
const SEGMENTS: { key: Segment; label: string; hint: string; campaign: string; color: string }[] = [
  { key: 'varm', label: 'Varme', hint: 'Vil kontaktes nå', campaign: 'Book en gratis vurdering denne uken', color: '#ef4444' },
  { key: 'lunken', label: 'Lunkne', hint: 'Trenger mer info', campaign: 'Du spurte om behandling – her er hva som skjer videre', color: '#f59e0b' },
  { key: 'kald', label: 'Kalde', hint: 'Lastet ned guide / viste interesse', campaign: 'Kundeeksempel: slik fikk kunden resultatet sitt', color: '#38bdf8' },
  { key: 'tapt', label: 'Tapte', hint: 'Svarte ikke / kjøpte ikke', campaign: 'Vi er her når du er klar – kort oppfølging', color: '#94a3b8' },
];

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
  fields: Record<string, string>;
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
  const counts = useMemo(() => {
    const c: Record<string, number> = { alle: leads.length };
    for (const s of SEGMENTS) c[s.key] = leads.filter((l) => l.segment === s.key).length;
    return c;
  }, [leads]);
  const visibleLeads = segmentFilter === 'alle' ? leads : leads.filter((l) => l.segment === segmentFilter);
  const activeSegment = SEGMENTS.find((s) => s.key === segmentFilter) || null;

  const exportCsv = () => {
    if (visibleLeads.length === 0) return;
    const rows = [['Navn', 'E-post', 'Telefon', 'Segment', 'Tidspunkt'], ...visibleLeads.map((l) => [l.name ?? '', l.email ?? '', l.phone ?? '', l.segment ?? '', fmt(l.createdTime)])];
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
