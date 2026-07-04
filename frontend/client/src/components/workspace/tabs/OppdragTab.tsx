// @ts-nocheck
/**
 * OppdragTab («Oppdrag») — leverandørens oppdrags-innboks i Team Workspace.
 * Bygget på den EKTE editing_jobs-backenden (samme som EditingVendorWorkspace
 * i dashbordet): /api/editing/vendor/jobs + accept/decline/messages. Bevisst
 * IKKE de gamle /api/vendor-orders/*-flatene — de har ingen backend.
 * Bruker-scopet (som Utstyr/Forespørsler): innboksen er leverandørens, ikke
 * prosjektets — levering med filopplasting skjer i dashbordets oppdragsflate.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Badge } from '@mui/material';
import { useLocation } from 'wouter';
import WorkOutline from '@mui/icons-material/WorkOutline';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import CheckCircle from '@mui/icons-material/CheckCircle';
import LocalShipping from '@mui/icons-material/LocalShipping';
import Payments from '@mui/icons-material/Payments';
import Send from '@mui/icons-material/Send';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag, WsStat, WsPills } from '../ui';

const STATUS: Record<string, [string, string]> = {
  requested: ['Ny forespørsel', 'amber'],
  in_progress: ['Pågår', 'blue'],
  delivered: ['Levert', 'green'],
  approved: ['Godkjent', 'green'],
  delivered_to_client: ['Hos klient', 'green'],
  declined: ['Avslått', 'red'],
  draft: ['Utkast', 'neutral'],
};
const FILTERS = [
  { key: 'alle', label: 'Alle' },
  { key: 'requested', label: 'Nye' },
  { key: 'in_progress', label: 'Pågår' },
  { key: 'delivered', label: 'Levert' },
];

const fmtNok = (cents: any, currency?: string) => {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.round(n / 100).toLocaleString('nb-NO')} ${currency || 'NOK'}`;
};
const fmtDate = (iso: any) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '';
};

const OppdragTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [, navigate] = useLocation();
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('alle');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msgJob, setMsgJob] = useState<any | null>(null);

  const load = () => {
    apiRequest('/api/editing/vendor/jobs')
      .then((r: any) => setJobs(Array.isArray(r?.jobs) ? r.jobs : []))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const list = jobs || [];
  const count = (s: string) => list.filter((j) => j.status === s).length;
  const activeSum = list
    .filter((j) => ['in_progress', 'delivered', 'approved', 'delivered_to_client'].includes(j.status))
    .reduce((sum, j) => sum + (Number(j.amount_cents) || 0), 0);
  const filtered = useMemo(
    () => (filter === 'alle' ? list.filter((j) => j.status !== 'draft') : list.filter((j) => j.status === filter)),
    [list, filter],
  );

  const accept = async (job: any) => {
    if (busyId) return;
    setBusyId(job.id);
    try {
      await apiRequest(`/api/editing/jobs/${encodeURIComponent(job.id)}/accept`, { method: 'POST' });
      load();
    } catch (e: any) {
      const msg = String(e?.message || '');
      window.alert(msg.includes('compliance')
        ? 'Compliance-kravene (NDA m.m.) må fullføres før du kan akseptere — åpne oppdragsflaten i dashbordet.'
        : msg || 'Kunne ikke akseptere oppdraget.');
    } finally { setBusyId(null); }
  };
  const decline = async (job: any) => {
    if (busyId) return;
    const reason = window.prompt('Vil du oppgi en grunn? (valgfritt)') ?? null;
    if (reason === null && !window.confirm('Avslå oppdraget?')) return;
    setBusyId(job.id);
    try {
      await apiRequest(`/api/editing/jobs/${encodeURIComponent(job.id)}/decline`, { method: 'POST', body: { reason: reason || undefined } });
      load();
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke avslå.'); }
    finally { setBusyId(null); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Oppdrag</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Redigerings- og produksjonsoppdrag du har mottatt fra kunder. Aksepter, avslå og hold dialogen her — levering med filopplasting skjer i oppdragsflaten i dashbordet.</Typography>
        </Box>
        <Button variant="outlined" onClick={() => navigate('/dashboard')} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 700 }}>Full oppdragsflate</Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        <WsStat icon={<WorkOutline sx={{ fontSize: 20 }} />} label="Nye forespørsler" value={count('requested')} sub="venter på svar" tone={ws.amberSoft} />
        <WsStat icon={<CheckCircle sx={{ fontSize: 20 }} />} label="Pågår" value={count('in_progress')} sub="aksepterte" tone={ws.blueSoft} />
        <WsStat icon={<LocalShipping sx={{ fontSize: 20 }} />} label="Levert" value={count('delivered') + count('approved') + count('delivered_to_client')} sub="ferdigstilte" tone={ws.greenSoft} />
        <WsStat icon={<Payments sx={{ fontSize: 20 }} />} label="Aktivt honorar" value={fmtNok(activeSum) || '—'} sub="aksepterte + leverte" tone={ws.accentSoft} />
      </Box>

      <WsPills sx={{ mb: 1.5 }} value={filter} onChange={setFilter}
        items={FILTERS.map((f) => ({ key: f.key, label: f.key === 'alle' ? `${f.label} (${list.filter((j) => j.status !== 'draft').length})` : `${f.label} (${count(f.key)})` }))} />

      <WsCard>
        {filtered.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 5 }} spacing={1}>
            <WorkOutline sx={{ fontSize: 36, color: ws.textFaint }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{list.length === 0 ? 'Ingen oppdrag ennå' : 'Ingen oppdrag i dette filteret'}</Typography>
            {list.length === 0 && (
              <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 460 }}>
                Når en kunde sender deg et oppdrag fra sitt prosjekt, dukker det opp her. Sørg for at priskatalogen din er publisert i oppdragsflaten, så kundene finner deg.
              </Typography>
            )}
          </Stack>
        ) : (
          <Stack spacing={1}>
            {filtered.map((j: any) => {
              const st = STATUS[j.status] || [j.status || '—', 'neutral'];
              const services = Array.isArray(j.requested_services) ? j.requested_services : [];
              const amount = fmtNok(j.amount_cents, j.currency);
              return (
                <Box key={j.id} sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${j.status === 'requested' ? ws.accentBorder : ws.borderSoft}` }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    <Box sx={{ width: 42, height: 42, borderRadius: 1.5, bgcolor: ws.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <WorkOutline sx={{ color: ws.accent, fontSize: 22 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>{j.project_title || 'Oppdrag'}</Typography>
                        <WsTag label={st[0]} tone={st[1] as any} />
                        {j.revisions_used > 0 && <WsTag label={`${j.revisions_used}/${j.max_revisions || '∞'} revisjoner`} tone="neutral" />}
                        {j.payout_status === 'paid' && <WsTag label="Utbetalt" tone="green" />}
                      </Stack>
                      <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mt: 0.25 }}>
                        {services.slice(0, 4).join(' · ')}{services.length > 4 ? ' · …' : ''}
                        {amount ? ` · ${amount}` : ''} · mottatt {fmtDate(j.requested_at || j.created_at)}
                      </Typography>
                      {j.brief && <Typography sx={{ fontSize: 12, color: ws.textDim, mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{j.brief}</Typography>}
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                      <Badge badgeContent={j.unread_messages || 0} color="warning" sx={{ '& .MuiBadge-badge': { fontSize: 9.5, minWidth: 16, height: 16 } }}>
                        <Button size="small" variant="outlined" startIcon={<ChatBubbleOutline sx={{ fontSize: 14 }} />} onClick={() => setMsgJob(j)}
                          sx={{ color: ws.textDim, borderColor: ws.border, textTransform: 'none', fontWeight: 600 }}>Dialog</Button>
                      </Badge>
                      {j.status === 'requested' && (
                        <>
                          <Button size="small" variant="contained" disabled={busyId === j.id} onClick={() => accept(j)}
                            sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Aksepter</Button>
                          <Button size="small" variant="outlined" disabled={busyId === j.id} onClick={() => decline(j)}
                            sx={{ color: ws.red, borderColor: 'rgba(248,113,113,0.4)', textTransform: 'none', fontWeight: 600 }}>Avslå</Button>
                        </>
                      )}
                      {j.status === 'in_progress' && (
                        <Button size="small" variant="outlined" onClick={() => navigate('/dashboard')}
                          sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>Lever filer →</Button>
                      )}
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </WsCard>

      <JobMessagesDialog job={msgJob} onClose={() => { setMsgJob(null); load(); }} />
    </Box>
  );
};

const JobMessagesDialog: React.FC<{ job: any | null; onClose: () => void }> = ({ job, onClose }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [canMessage, setCanMessage] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!job) return;
    setMessages([]); setBody('');
    apiRequest(`/api/editing/jobs/${encodeURIComponent(job.id)}/messages`)
      .then((r: any) => { setMessages(Array.isArray(r?.messages) ? r.messages : []); setCanMessage(!!r?.canMessage); })
      .catch(() => {});
  }, [job]);

  const send = async () => {
    const text = body.trim();
    if (!text || busy || !job) return;
    setBusy(true);
    try {
      const r: any = await apiRequest(`/api/editing/jobs/${encodeURIComponent(job.id)}/messages`, { method: 'POST', body: { body: text } });
      if (r?.message) setMessages((p) => [...p, r.message]);
      setBody('');
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke sende.'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!job} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Dialog — {job?.project_title || 'Oppdrag'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1} sx={{ minHeight: 180, maxHeight: 380, overflowY: 'auto' }}>
          {messages.length === 0 && <Typography variant="body2" color="text.secondary">Ingen meldinger ennå.</Typography>}
          {messages.map((m: any) => (
            <Box key={m.id} sx={{ alignSelf: m.sender_role === 'vendor' ? 'flex-end' : 'flex-start', maxWidth: '82%', px: 1.5, py: 0.9, borderRadius: 2, bgcolor: m.sender_role === 'vendor' ? 'rgba(255,140,0,0.14)' : 'rgba(255,255,255,0.06)' }}>
              <Typography sx={{ fontSize: 13 }}>{m.body}</Typography>
              <Typography sx={{ fontSize: 10, opacity: 0.6, mt: 0.25 }}>{m.sender_role === 'vendor' ? 'Deg' : 'Kunde'} · {new Date(m.created_at).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <TextField fullWidth size="small" placeholder={canMessage ? 'Skriv en melding …' : 'Dialogen er stengt for denne statusen'} value={body} disabled={!canMessage || busy}
          onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Button variant="contained" onClick={send} disabled={!canMessage || busy || !body.trim()} startIcon={<Send sx={{ fontSize: 15 }} />}>Send</Button>
      </DialogActions>
    </Dialog>
  );
};

export default OppdragTab;
