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
import { WsCard, WsSectionTitle, WsTag, WsBar } from '../ui';

const fmtDate = (s: string) => s ? new Date(s).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const nok = (n: number) => (n || n === 0) ? `${Math.round(n).toLocaleString('nb-NO')} kr` : '–';

const AvtalerTab: React.FC<{ projectId: string }> = ({ projectId }) => {
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
    const val = window.prompt('Tjenestepris (inkl. MVA, kr):', String(cur));
    if (val == null) return;
    const num = Number(val.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(num)) return;
    try { await apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}`, { method: 'PATCH', body: { servicePrice: num } }); load(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke oppdatere pris'); }
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
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Avtaler</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Kontrakt, kunde og møter for prosjektet.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add sx={{ fontSize: 16 }} />} onClick={() => setNewOpen(true)} disabled={!isReal}
          sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Nytt møte</Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
        {/* Kontrakt */}
        <WsCard>
          <WsSectionTitle icon={<Description sx={{ fontSize: 18, color: ws.accent }} />} title="Kontrakt" />
          {dContract.hasContract ? (
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{dContract.clientName || 'Kontrakt'}</Typography>
                <WsTag label={dContract.isSigned ? 'Signert' : 'Venter på signering'} tone={dContract.isSigned ? 'green' : 'amber'} />
              </Stack>
              {dContract.isSigned && (dContract.signerName || dContract.signedAt) && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: ws.green }}>
                  <Typography sx={{ fontSize: 12 }}>✍️ Signert{dContract.signerName ? ` av ${dContract.signerName}` : ''}{dContract.signedAt ? ` · ${new Date(dContract.signedAt).toLocaleDateString('nb-NO')}` : ''}</Typography>
                  {dContract.hasSignature && <WsTag label="iPad-signatur" tone="green" />}
                </Stack>
              )}
              <Stack direction="row" spacing={1}>
                {dContract.contractId && (
                  <Button size="small" onClick={() => window.open(`/api/contracts/${dContract.contractId}/pdf`, '_blank')} sx={{ color: ws.accent, textTransform: 'none', border: `1px solid ${ws.accentBorder}` }}>Åpne PDF ↗</Button>
                )}
                {!dContract.isSigned && dContract.contractId && (
                  <Button size="small" onClick={() => window.open(`/contract/${dContract.contractId}`, '_blank')} sx={{ color: ws.text, textTransform: 'none', border: `1px solid ${ws.border}` }}>Signer</Button>
                )}
              </Stack>
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Ingen kontrakt opprettet for prosjektet ennå.</Typography>
          )}
        </WsCard>

        {/* CRM-kunde */}
        <WsCard>
          <WsSectionTitle icon={<Person sx={{ fontSize: 18, color: ws.accent }} />} title="Kunde (CRM)" />
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
            <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Ingen CRM-kunde koblet til prosjektet.</Typography>
          )}
        </WsCard>
      </Box>

      {/* Tilbud */}
      {isReal && quotes.length > 0 && (
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle icon={<Description sx={{ fontSize: 18, color: ws.accent }} />} title="Tilbud" />
          <Stack spacing={1}>
            {quotes.map((q) => (
              <Stack key={q.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1, borderRadius: 1.5, border: `1px solid ${ws.borderSoft}` }}>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{q.title || q.quoteNumber || 'Tilbud'}</Typography>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{q.quoteNumber}{q.total != null ? ` · ${Math.round(q.total).toLocaleString('nb-NO')} kr` : ''}{q.validUntil ? ` · gyldig til ${new Date(q.validUntil).toLocaleDateString('nb-NO')}` : ''}</Typography>
                </Box>
                <WsTag label={q.status || 'utkast'} tone={QUOTE_TONE[q.status] || 'neutral'} />
              </Stack>
            ))}
          </Stack>
        </WsCard>
      )}

      {/* Pris & økonomi */}
      <WsCard sx={{ mb: 2 }}>
        <WsSectionTitle
          icon={<Payments sx={{ fontSize: 18, color: ws.accent }} />}
          title="Pris & økonomi"
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={editPrice} disabled={!isReal} sx={{ color: ws.text, textTransform: 'none', border: `1px solid ${ws.border}` }}>Rediger pris</Button>
              <Button size="small" startIcon={<OpenInNew sx={{ fontSize: 14 }} />} onClick={() => window.open('/price-administration', '_blank')} sx={{ color: ws.accent, textTransform: 'none' }}>Prisadministrasjon</Button>
            </Stack>
          }
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>Tjenestepris (inkl. MVA)</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{nok(dPricing.servicePriceGross)}</Typography>
            <Typography sx={{ fontSize: 11, color: ws.textFaint }}>Netto {nok(dPricing.servicePriceNet)} · MVA {dPricing.vatRate || 25}%</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>Kostnad</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{nok(dPricing.totalCost)}</Typography>
            <Typography sx={{ fontSize: 11, color: ws.textFaint }}>Sporet {nok(dPricing.trackedCost)}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>Fortjeneste</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: ws.green }}>{nok(dPricing.profitAmount)}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>Margin</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: (dPricing.marginPct ?? 0) >= 40 ? ws.green : ws.amber }}>{dPricing.marginPct != null ? `${Math.round(dPricing.marginPct)}%` : '–'}</Typography>
            <Box sx={{ mt: 0.5 }}><WsBar value={Math.max(0, Math.min(100, dPricing.marginPct || 0))} color={(dPricing.marginPct ?? 0) >= 40 ? ws.green : ws.amber} height={5} /></Box>
          </Box>
        </Box>
      </WsCard>

      {/* Møter */}
      <WsCard>
        <WsSectionTitle icon={<Event sx={{ fontSize: 18, color: ws.accent }} />} title="Kommende møter & avtaler" />
        {dMeetings.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 1 }}>Ingen møter planlagt. Opprett et med «Nytt møte» (kan generere ekte Google Meet-lenke).</Typography>
        ) : (
          <Stack spacing={1}>
            {dMeetings.map((m) => (
              <Box key={m.id} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${ws.borderSoft}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{m.title}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{fmtDate(m.scheduledAt)}{m.durationMinutes ? ` · ${m.durationMinutes} min` : ''}</Typography>
                  </Box>
                  {m.meetLink ? (
                    <Button size="small" startIcon={<VideoCall sx={{ fontSize: 16 }} />} onClick={() => window.open(m.meetLink, '_blank')}
                      sx={{ color: ws.green, textTransform: 'none', border: `1px solid ${ws.greenSoft}` }}>Bli med (Meet)</Button>
                  ) : <WsTag label="Ingen Meet-lenke" tone="neutral" />}
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
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState('60');
  const [genMeet, setGenMeet] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !when) { setError('Tittel og tidspunkt er påkrevd'); return; }
    setBusy(true); setError(null);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/meetings`, {
        method: 'POST',
        body: { title: title.trim(), scheduledAt: new Date(when).toISOString(), durationMinutes: Number(duration) || 60, generateMeet: genMeet },
      });
      setTitle(''); setWhen('');
      onCreated();
    } catch (e: any) { setError(e?.message || 'Kunne ikke opprette møte'); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Nytt møte</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label="Tittel" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth size="small" />
          <TextField label="Tidspunkt" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} />
          <TextField label="Varighet (min)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} fullWidth size="small" />
          <FormControlLabel control={<Checkbox checked={genMeet} onChange={(e) => setGenMeet(e.target.checked)} />} label="Generer Google Meet-lenke" />
          {error && <Typography sx={{ fontSize: 12.5, color: ws.red }}>{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Avbryt</Button>
        <Button variant="contained" onClick={submit} disabled={busy} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}>{busy ? 'Oppretter…' : 'Opprett møte'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AvtalerTab;
