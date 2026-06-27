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
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsTag } from '../ui';

const fmtDate = (s: string) => s ? new Date(s).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

const AvtalerTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [contract, setContract] = useState<any | null>(null);
  const [crm, setCrm] = useState<any | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [newOpen, setNewOpen] = useState(false);

  const load = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/contract/status`).then((r: any) => setContract(r || null)).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/avtaler`).then((r: any) => { setCrm(r?.crmCustomer || null); setMeetings(Array.isArray(r?.meetings) ? r.meetings : []); }).catch(() => {});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  // Demo-fallback
  const dContract = contract || { hasContract: true, isSigned: false, status: 'sent', clientName: 'Sara & Amir' };
  const dCrm = crm || { name: 'Sara & Amir', email: 'sara.amir@email.com', status: 'customer', projectType: 'Bryllup' };
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
