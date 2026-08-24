// @ts-nocheck
/**
 * AvtalerTab — KUNDEPORTAL «Avtaler», dark CreatorHub.
 * Samler prosjektets kunde-/avtale-flate: Kontrakt-status (signering/PDF),
 * CRM-kunde (crm_customers.project_id), og Møter med ekte Google Meet-lenker
 * (crm_meetings + createGoogleMeetLink). project_id-scopet, Role-Room-uavhengig.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, Avatar, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Checkbox, CircularProgress } from '@mui/material';
import Description from '@mui/icons-material/Description';
import VideoCall from '@mui/icons-material/VideoCall';
import Add from '@mui/icons-material/Add';
import Person from '@mui/icons-material/Person';
import Event from '@mui/icons-material/Event';
import Payments from '@mui/icons-material/Payments';
import OpenInNew from '@mui/icons-material/OpenInNew';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { wsIcon } from '../crewIcons';
import { WsCard, WsSectionTitle, WsTag, WsBar, WsPageTitle, wsAlert, wsPrompt } from '../ui';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from '../wsLocale';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab).
const T: WsDict = {
  title: { no: 'Avtaler', en: 'Agreements' },
  subtitle: { no: 'Kontrakt, kunde og møter for prosjektet.', en: 'Contract, client and meetings for the project.' },
  newMeeting: { no: 'Nytt møte', en: 'New meeting' },
  contract: { no: 'Kontrakt', en: 'Contract' },
  signed: { no: 'Signert', en: 'Signed' },
  awaitingSignature: { no: 'Venter på signering', en: 'Awaiting signature' },
  signedWord: { no: 'Signert', en: 'Signed' },
  signedBy: { no: 'av', en: 'by' },
  ipadSignature: { no: 'iPad-signatur', en: 'iPad signature' },
  openPdf: { no: 'Åpne PDF ↗', en: 'Open PDF ↗' },
  sign: { no: 'Signer', en: 'Sign' },
  noContract: { no: 'Ingen kontrakt opprettet for prosjektet ennå.', en: 'No contract created for this project yet.' },
  crmClient: { no: 'Kunde (CRM)', en: 'Client (CRM)' },
  noCrm: { no: 'Ingen CRM-kunde koblet til prosjektet.', en: 'No CRM customer linked to the project.' },
  quotes: { no: 'Tilbud', en: 'Quotes' },
  quote: { no: 'Tilbud', en: 'Quote' },
  validUntil: { no: 'gyldig til', en: 'valid until' },
  priceEconomy: { no: 'Pris & økonomi', en: 'Price & finances' },
  editPrice: { no: 'Rediger pris', en: 'Edit price' },
  priceAdmin: { no: 'Prisadministrasjon', en: 'Price administration' },
  servicePrice: { no: 'Tjenestepris (inkl. MVA)', en: 'Service price (incl. VAT)' },
  net: { no: 'Netto', en: 'Net' },
  vat: { no: 'MVA', en: 'VAT' },
  cost: { no: 'Kostnad', en: 'Cost' },
  tracked: { no: 'Sporet', en: 'Tracked' },
  profit: { no: 'Fortjeneste', en: 'Profit' },
  margin: { no: 'Margin', en: 'Margin' },
  promptPrice: { no: 'Tjenestepris (inkl. MVA, kr):', en: 'Service price (incl. VAT, NOK):' },
  priceFailed: { no: 'Kunne ikke oppdatere pris', en: 'Could not update the price' },
  upcomingMeetings: { no: 'Kommende møter & avtaler', en: 'Upcoming meetings & appointments' },
  noMeetings: { no: 'Ingen møter planlagt. Opprett et med «Nytt møte» (kan generere ekte Google Meet-lenke).', en: 'No meetings scheduled. Create one with "New meeting" (can generate a real Google Meet link).' },
  joinMeet: { no: 'Bli med (Meet)', en: 'Join (Meet)' },
  noMeetLink: { no: 'Ingen Meet-lenke', en: 'No Meet link' },
  dlgTitle: { no: 'Nytt møte', en: 'New meeting' },
  dlgName: { no: 'Tittel', en: 'Title' },
  dlgWhen: { no: 'Tidspunkt', en: 'Time' },
  dlgDuration: { no: 'Varighet (min)', en: 'Duration (min)' },
  dlgGenMeet: { no: 'Generer Google Meet-lenke', en: 'Generate Google Meet link' },
  dlgRequired: { no: 'Tittel og tidspunkt er påkrevd', en: 'Title and time are required' },
  dlgFailed: { no: 'Kunne ikke opprette møte', en: 'Could not create the meeting' },
  dlgCancel: { no: 'Avbryt', en: 'Cancel' },
  dlgCreating: { no: 'Oppretter…', en: 'Creating…' },
  dlgCreate: { no: 'Opprett møte', en: 'Create meeting' },
};
// Tilbuds-statuser: engelske etiketter for vendors; norsk visning uendret (råverdi).
const QUOTE_STATUS_EN: Record<string, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', signed: 'Signed', declined: 'Declined', expired: 'Expired' };

const fmtDate = (s: string, dloc = 'nb-NO') => s ? new Date(s).toLocaleString(dloc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const nok = (n: number) => (n || n === 0) ? `${Math.round(n).toLocaleString('nb-NO')} kr` : '–';

const AvtalerTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  // Utenlandske partner-vendors får engelsk UI — locale fra WsLocaleProvider.
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const dloc = wsDateLocale(locale);
  const isReal = projectId && projectId !== 'sample';
  const [contract, setContract] = useState<any | null>(null);
  const [crm, setCrm] = useState<any | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any | null>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [newOpen, setNewOpen] = useState(false);

  const load = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/contract`).then((r: any) => setContract(r || null)).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/avtaler`).then((r: any) => { setCrm(r?.crmCustomer || null); setMeetings(Array.isArray(r?.meetings) ? r.meetings : []); }).catch(() => {});
    apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}`).then((r: any) => setPricing(r?.project || null)).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/quotes`).then((r: any) => setQuotes(Array.isArray(r?.quotes) ? r.quotes : [])).catch(() => {});
  };
  const QUOTE_TONE: Record<string, string> = { draft: 'neutral', sent: 'amber', accepted: 'green', signed: 'green', declined: 'red', expired: 'red' };

  const editPrice = async () => {
    if (!isReal) return;
    const cur = pricing?.servicePriceGross ?? pricing?.servicePrice ?? 0;
    const val = await wsPrompt(t('promptPrice'), String(cur));
    if (val == null) return;
    const num = Number(val.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(num)) return;
    try { await apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: { servicePrice: num } }); load(); }
    catch (e: any) { wsAlert(e?.message || t('priceFailed')); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  // Demo-fallback
  const dContract = contract || { hasContract: true, isSigned: false, status: 'sent', clientName: 'Sara & Amir' };
  const dCrm = crm || { name: 'Sara & Amir', email: 'sara.amir@email.com', status: 'customer', projectType: 'Bryllup' };
  const dPricing = pricing || { servicePriceGross: 45000, servicePriceNet: 36000, vatRate: 25, vatAmount: 9000, trackedCost: 12000, totalCost: 14000, marginPct: 61, profitAmount: 22000 };
  const dMeetings = (isReal ? meetings : [
    { id: 'd1', title: 'Forhåndssamtale', scheduledAt: '2025-05-10T18:00:00', durationMinutes: 30, meetLink: 'https://meet.google.com/xxx' },
    { id: 'd2', title: 'Gjennomgang av leveranse', scheduledAt: '2025-06-02T17:00:00', durationMinutes: 45, meetLink: null },
  ]);

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <WsPageTitle
        icon={<Event sx={{ fontSize: 21, color: '#fff' }} />}
        title={t('title')}
        sub={t('subtitle')}
        actions={<Button variant="contained" startIcon={<Add sx={{ fontSize: 16 }} />} onClick={() => setNewOpen(true)} disabled={!isReal}
          sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('newMeeting')}</Button>}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
        {/* Kontrakt */}
        <WsCard>
          <WsSectionTitle icon={<Description sx={{ fontSize: 18, color: ws.accent }} />} title={t('contract')} />
          {dContract.hasContract ? (
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{dContract.clientName || t('contract')}</Typography>
                <WsTag label={dContract.isSigned ? t('signed') : t('awaitingSignature')} tone={dContract.isSigned ? 'green' : 'amber'} />
              </Stack>
              {dContract.isSigned && (dContract.signerName || dContract.signedAt) && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: ws.green }}>
                  <Typography sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: 12 }}>{wsIcon('Draw', { fontSize: 14 })}{t('signedWord')}{dContract.signerName ? ` ${t('signedBy')} ${dContract.signerName}` : ''}{dContract.signedAt ? ` · ${new Date(dContract.signedAt).toLocaleDateString(dloc)}` : ''}</Typography>
                  {dContract.hasSignature && <WsTag label={t('ipadSignature')} tone="green" />}
                </Stack>
              )}
              <Stack direction="row" spacing={1}>
                {dContract.contractId && (
                  <Button size="small" onClick={async () => {
                    // /pdf is session-gated; fetch with Bearer and open the blob (plain window.open would 401).
                    const authToken = localStorage.getItem('creatorhub_auth_token') || localStorage.getItem('role_room_auth_token') || localStorage.getItem('token') || '';
                    try {
                      const r = await fetch(`/api/contracts/${dContract.contractId}/pdf`, { headers: { 'Authorization': `Bearer ${authToken}` } });
                      if (!r.ok) return;
                      const u = window.URL.createObjectURL(await r.blob());
                      window.open(u, '_blank');
                      setTimeout(() => window.URL.revokeObjectURL(u), 60000);
                    } catch { /* noop */ }
                  }} sx={{ color: ws.accent, textTransform: 'none', border: `1px solid ${ws.accentBorder}` }}>{t('openPdf')}</Button>
                )}
                {!dContract.isSigned && dContract.contractId && (
                  <Button size="small" onClick={() => window.open(`/contract/${dContract.contractId}`, '_blank')} sx={{ color: ws.text, textTransform: 'none', border: `1px solid ${ws.border}` }}>{t('sign')}</Button>
                )}
              </Stack>
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('noContract')}</Typography>
          )}
        </WsCard>

        {/* CRM-kunde */}
        <WsCard>
          <WsSectionTitle icon={<Person sx={{ fontSize: 18, color: ws.accent }} />} title={t('crmClient')} />
          {dCrm ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ width: 40, height: 40 }}>{(dCrm.name || '?')[0]}</Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 14, fontWeight: 700 }}>{dCrm.name}</Typography>
                <Typography noWrap sx={{ fontSize: 12, color: ws.textDim }}>{dCrm.email}</Typography>
              </Box>
              <Stack spacing={0.5} alignItems="flex-end">
                {dCrm.status && <WsTag label={dCrm.status} tone="blue" />}
                {dCrm.projectType && <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{dCrm.projectType}</Typography>}
              </Stack>
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('noCrm')}</Typography>
          )}
        </WsCard>
      </Box>

      {/* Tilbud */}
      {isReal && quotes.length > 0 && (
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle icon={<Description sx={{ fontSize: 18, color: ws.accent }} />} title={t('quotes')} />
          <Stack spacing={1}>
            {quotes.map((q) => (
              <Stack key={q.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1, borderRadius: 1.5, border: `1px solid ${ws.borderSoft}` }}>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{q.title || q.quoteNumber || t('quote')}</Typography>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{q.quoteNumber}{q.total != null ? ` · ${Math.round(q.total).toLocaleString('nb-NO')} kr` : ''}{q.validUntil ? ` · ${t('validUntil')} ${new Date(q.validUntil).toLocaleDateString(dloc)}` : ''}</Typography>
                </Box>
                <WsTag label={locale === 'en' ? (QUOTE_STATUS_EN[q.status] || q.status || 'Draft') : (q.status || 'utkast')} tone={QUOTE_TONE[q.status] || 'neutral'} />
              </Stack>
            ))}
          </Stack>
        </WsCard>
      )}

      {/* Pris & økonomi */}
      <WsCard sx={{ mb: 2 }}>
        <WsSectionTitle
          icon={<Payments sx={{ fontSize: 18, color: ws.accent }} />}
          title={t('priceEconomy')}
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={editPrice} disabled={!isReal} sx={{ color: ws.text, textTransform: 'none', border: `1px solid ${ws.border}` }}>{t('editPrice')}</Button>
              <Button size="small" startIcon={<OpenInNew sx={{ fontSize: 14 }} />} onClick={() => window.open('/price-administration', '_blank')} sx={{ color: ws.accent, textTransform: 'none' }}>{t('priceAdmin')}</Button>
            </Stack>
          }
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{t('servicePrice')}</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{nok(dPricing.servicePriceGross)}</Typography>
            <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{t('net')} {nok(dPricing.servicePriceNet)} · {t('vat')} {dPricing.vatRate || 25}%</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{t('cost')}</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{nok(dPricing.totalCost)}</Typography>
            <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{t('tracked')} {nok(dPricing.trackedCost)}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{t('profit')}</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: ws.green }}>{nok(dPricing.profitAmount)}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{t('margin')}</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: (dPricing.marginPct ?? 0) >= 40 ? ws.green : ws.amber }}>{dPricing.marginPct != null ? `${Math.round(dPricing.marginPct)}%` : '–'}</Typography>
            <Box sx={{ mt: 0.5 }}><WsBar value={Math.max(0, Math.min(100, dPricing.marginPct || 0))} color={(dPricing.marginPct ?? 0) >= 40 ? ws.green : ws.amber} height={5} /></Box>
          </Box>
        </Box>
      </WsCard>

      {/* Møter */}
      <WsCard>
        <WsSectionTitle icon={<Event sx={{ fontSize: 18, color: ws.accent }} />} title={t('upcomingMeetings')} />
        {dMeetings.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 1 }}>{t('noMeetings')}</Typography>
        ) : (
          <Stack spacing={1}>
            {dMeetings.map((m) => (
              <Box key={m.id} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${ws.borderSoft}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{m.title}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{fmtDate(m.scheduledAt, dloc)}{m.durationMinutes ? ` · ${m.durationMinutes} min` : ''}</Typography>
                  </Box>
                  {m.meetLink ? (
                    <Button size="small" startIcon={<VideoCall sx={{ fontSize: 16 }} />} onClick={() => window.open(m.meetLink, '_blank')}
                      sx={{ color: ws.green, textTransform: 'none', border: `1px solid ${ws.greenSoft}` }}>{t('joinMeet')}</Button>
                  ) : <WsTag label={t('noMeetLink')} tone="neutral" />}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </WsCard>

      <NewMeetingDialog open={newOpen} onClose={() => setNewOpen(false)} projectId={projectId} onCreated={() => { setNewOpen(false); load(); }} />
    </Box>
  );
};

const NewMeetingDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; onCreated: () => void }> = ({ open, onClose, projectId, onCreated }) => {
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState('60');
  const [genMeet, setGenMeet] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !when) { setError(t('dlgRequired')); return; }
    setBusy(true); setError(null);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/meetings`, {
        method: 'POST',
        body: { title: title.trim(), scheduledAt: new Date(when).toISOString(), durationMinutes: Number(duration) || 60, generateMeet: genMeet },
      });
      setTitle(''); setWhen('');
      onCreated();
    } catch (e: any) { setError(e?.message || t('dlgFailed')); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('dlgTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label={t('dlgName')} value={title} onChange={(e) => setTitle(e.target.value)} fullWidth size="small" />
          <TextField label={t('dlgWhen')} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} />
          <TextField label={t('dlgDuration')} type="number" value={duration} onChange={(e) => setDuration(e.target.value)} fullWidth size="small" />
          <FormControlLabel control={<Checkbox checked={genMeet} onChange={(e) => setGenMeet(e.target.checked)} />} label={t('dlgGenMeet')} />
          {error && <Typography sx={{ fontSize: 12.5, color: ws.red }}>{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{t('dlgCancel')}</Button>
        <Button variant="contained" onClick={submit} disabled={busy} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}>{busy ? t('dlgCreating') : t('dlgCreate')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AvtalerTab;
