import React from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import AccessTime from '@mui/icons-material/AccessTime';
import Add from '@mui/icons-material/Add';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Stop from '@mui/icons-material/Stop';
import Send from '@mui/icons-material/Send';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Lock from '@mui/icons-material/Lock';
import { apiRequest } from '@/lib/queryClient';
import type { CreatorHubTimeEntry, CreatorHubTimesheetPeriod } from '@shared/creatorhub-enterprise-operations';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle } from '../ui';

type Participant = { id: string; displayName: string; email?: string | null; compensation?: { compensationType?: string } | null };
type PeriodDetail = { period: CreatorHubTimesheetPeriod; entries: CreatorHubTimeEntry[]; access: { canReview: boolean; role: string } };

const minutesLabel = (minutes: number) => `${Math.floor(minutes / 60)} t ${minutes % 60} min`;
const dateValue = (date: Date) => date.toISOString().slice(0, 10);
const statusLabel: Record<string, string> = {
  draft: 'Utkast', submitted: 'Til godkjenning', approved: 'Godkjent', rejected: 'Må korrigeres', locked: 'Låst',
};
const statusColor: Record<string, string> = {
  draft: ws.textDim, submitted: ws.amber, approved: ws.green, rejected: ws.red, locked: ws.blue,
};

export default function TimesheetsTab({ projectId }: { projectId: string }) {
  const [periods, setPeriods] = React.useState<CreatorHubTimesheetPeriod[]>([]);
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<PeriodDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [entryOpen, setEntryOpen] = React.useState(false);
  const timerKey = `creatorhub:timesheet-timer:${projectId}`;
  const [timerStartedAt, setTimerStartedAt] = React.useState<string | null>(() => typeof window === 'undefined' ? null : window.localStorage.getItem(timerKey));
  const [now, setNow] = React.useState(Date.now());

  const loadPeriods = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [timesheets, people] = await Promise.all([
        apiRequest(`/api/projects/${encodeURIComponent(projectId)}/timesheets`),
        apiRequest(`/api/projects/${encodeURIComponent(projectId)}/participants`).catch(() => ({ participants: [] })),
      ]);
      const next = Array.isArray(timesheets?.periods) ? timesheets.periods : [];
      setPeriods(next);
      setParticipants(Array.isArray(people?.participants) ? people.participants : []);
      setSelectedId((current) => current && next.some((period: CreatorHubTimesheetPeriod) => period.id === current) ? current : next[0]?.id || null);
    } catch (cause: any) {
      setError(cause?.message || 'Kunne ikke laste timelister.');
    } finally { setLoading(false); }
  }, [projectId]);

  const loadDetail = React.useCallback(async (periodId: string | null) => {
    if (!periodId) { setDetail(null); return; }
    try {
      setDetail(await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/timesheets/${periodId}`));
    } catch (cause: any) { setError(cause?.message || 'Kunne ikke laste perioden.'); }
  }, [projectId]);

  React.useEffect(() => { void loadPeriods(); }, [loadPeriods]);
  React.useEffect(() => { void loadDetail(selectedId); }, [loadDetail, selectedId]);
  React.useEffect(() => {
    if (!timerStartedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [timerStartedAt]);

  const refresh = async () => { await loadPeriods(); await loadDetail(selectedId); };
  const action = async (name: 'submit' | 'approve' | 'reject' | 'lock') => {
    if (!selectedId) return;
    setError(null);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/timesheets/${selectedId}/${name}`, {
        method: 'POST', body: name === 'reject' ? { note: 'Korriger registreringene og send inn på nytt.' } : {},
      });
      await refresh();
    } catch (cause: any) { setError(cause?.message || 'Handlingen kunne ikke fullføres.'); }
  };
  const startTimer = () => {
    const started = new Date().toISOString(); window.localStorage.setItem(timerKey, started); setTimerStartedAt(started); setNow(Date.now());
  };
  const stopTimer = async () => {
    if (!timerStartedAt || !selectedId) return;
    const endedAt = new Date();
    const durationMinutes = Math.max(1, Math.ceil((endedAt.getTime() - new Date(timerStartedAt).getTime()) / 60_000));
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/timesheets/${selectedId}/entries`, {
        method: 'POST', body: {
          idempotencyKey: globalThis.crypto.randomUUID(), workDate: dateValue(new Date(timerStartedAt)), activity: 'Arbeid',
          startedAt: timerStartedAt, endedAt: endedAt.toISOString(), durationMinutes, breakMinutes: 0, billable: true, source: 'timer',
        },
      });
      window.localStorage.removeItem(timerKey); setTimerStartedAt(null); await refresh();
    } catch (cause: any) { setError(cause?.message || 'Timeren kunne ikke lagres. Den fortsetter lokalt.'); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;
  if (error && periods.length === 0) return <Alert severity="warning" action={<Button onClick={loadPeriods}>Prøv igjen</Button>}>{error}</Alert>;

  const selected = detail?.period || periods.find((period) => period.id === selectedId) || null;
  const elapsedSeconds = timerStartedAt ? Math.max(0, Math.floor((now - new Date(timerStartedAt).getTime()) / 1_000)) : 0;

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 850 }}>Timer & godkjenning</Typography>
          <Typography sx={{ color: ws.textDim, fontSize: 13 }}>Registrer arbeid, send perioden til leder og opprett oppgjørsgrunnlag mot den signerte Split Sheet-avtalen.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {timerStartedAt ? (
            <Button variant="contained" color="error" startIcon={<Stop />} onClick={stopTimer} disabled={!selectedId}>
              Stopp · {String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0')}:{String(Math.floor(elapsedSeconds / 60) % 60).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
            </Button>
          ) : <Button variant="outlined" startIcon={<PlayArrow />} onClick={startTimer} disabled={!selected || selected.status !== 'draft'}>Start timer</Button>}
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)} sx={{ bgcolor: ws.accent, color: ws.accentContrast }}>Ny periode</Button>
        </Stack>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '340px 1fr' }, gap: 2 }}>
        <WsCard>
          <WsSectionTitle icon={<AccessTime sx={{ color: ws.accent }} />} title="Perioder" />
          <Stack spacing={1}>
            {periods.length === 0 && <Typography sx={{ color: ws.textDim, fontSize: 13 }}>Ingen timelister ennå.</Typography>}
            {periods.map((period) => (
              <Box component="button" type="button" key={period.id} onClick={() => setSelectedId(period.id)} sx={{
                p: 1.5, width: '100%', textAlign: 'left', borderRadius: `${ws.radiusSm}px`, cursor: 'pointer', color: ws.text,
                bgcolor: selectedId === period.id ? ws.accentSoft : ws.panelAlt,
                border: `1px solid ${selectedId === period.id ? ws.accentBorder : ws.borderSoft}`,
              }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 750 }}>{period.employeeName || period.employeeEmail || 'Ansatt'}</Typography>
                  <Chip size="small" label={statusLabel[period.status]} sx={{ color: statusColor[period.status], bgcolor: 'rgba(255,255,255,.05)' }} />
                </Stack>
                <Typography sx={{ color: ws.textDim, fontSize: 12 }}>{period.periodStart} – {period.periodEnd}</Typography>
                <Typography sx={{ color: ws.textFaint, fontSize: 11.5 }}>{minutesLabel(period.totalMinutes)} · {period.entryCount} registreringer</Typography>
              </Box>
            ))}
          </Stack>
        </WsCard>
        <WsCard>
          {!selected ? <Typography sx={{ color: ws.textDim }}>Velg eller opprett en periode.</Typography> : <>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{selected.periodStart} – {selected.periodEnd}</Typography>
                <Typography sx={{ color: ws.textDim, fontSize: 12.5 }}>{minutesLabel(selected.totalMinutes)} totalt · {minutesLabel(selected.billableMinutes)} fakturerbart</Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {selected.status === 'draft' && <Button size="small" startIcon={<Add />} onClick={() => setEntryOpen(true)}>Før tid</Button>}
                {selected.status === 'draft' && <Button size="small" variant="contained" startIcon={<Send />} onClick={() => action('submit')} disabled={!selected.entryCount}>Send inn</Button>}
                {selected.status === 'submitted' && detail?.access.canReview && <Button size="small" color="error" onClick={() => action('reject')}>Be om endring</Button>}
                {selected.status === 'submitted' && detail?.access.canReview && <Button size="small" color="success" variant="contained" startIcon={<CheckCircle />} onClick={() => action('approve')}>Godkjenn</Button>}
                {selected.status === 'approved' && detail?.access.canReview && <Button size="small" variant="contained" startIcon={<Lock />} onClick={() => action('lock')}>Lås periode</Button>}
              </Stack>
            </Stack>
            {selected.reviewerNote && <Alert severity={selected.status === 'rejected' ? 'warning' : 'info'} sx={{ mb: 2 }}>{selected.reviewerNote}</Alert>}
            <Stack spacing={1}>
              {(detail?.entries || []).map((entry) => (
                <Stack key={entry.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.25, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}`, borderRadius: `${ws.radiusSm}px` }}>
                  <Box><Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{entry.activity}</Typography><Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{entry.workDate}{entry.description ? ` · ${entry.description}` : ''}</Typography></Box>
                  <Typography sx={{ fontWeight: 750 }}>{minutesLabel(entry.netMinutes)}</Typography>
                </Stack>
              ))}
              {!detail?.entries.length && <Typography sx={{ color: ws.textDim, fontSize: 13 }}>Ingen tidsregistreringer i perioden.</Typography>}
            </Stack>
            {selected.settlement && <Alert severity="success" sx={{ mt: 2 }}>
              Oppgjørsgrunnlag: {selected.settlement.amount.toLocaleString('nb-NO')} {selected.settlement.currency} · {selected.settlement.agreementStatus === 'signed' ? 'signert avtale' : 'venter på signert Split Sheet'}
            </Alert>}
          </>}
        </WsCard>
      </Box>
      <CreatePeriodDialog open={createOpen} onClose={() => setCreateOpen(false)} projectId={projectId} participants={participants} onCreated={async (id) => { setCreateOpen(false); await loadPeriods(); setSelectedId(id); }} />
      {selectedId && <CreateEntryDialog open={entryOpen} onClose={() => setEntryOpen(false)} projectId={projectId} periodId={selectedId} onCreated={async () => { setEntryOpen(false); await refresh(); }} />}
    </Box>
  );
}

function CreatePeriodDialog({ open, onClose, projectId, participants, onCreated }: { open: boolean; onClose: () => void; projectId: string; participants: Participant[]; onCreated: (id: string) => void }) {
  const today = new Date(); const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const [participantId, setParticipantId] = React.useState('');
  const [start, setStart] = React.useState(dateValue(monday)); const [end, setEnd] = React.useState(dateValue(sunday));
  const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState('');
  const submit = async () => { setBusy(true); setError(''); try { const result = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/timesheets`, { method: 'POST', body: { participantId, periodStart: start, periodEnd: end } }); onCreated(result.period.id); } catch (cause: any) { setError(cause?.message || 'Kunne ikke opprette perioden.'); } finally { setBusy(false); } };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"><DialogTitle>Ny timelisteperiode</DialogTitle><DialogContent dividers><Stack spacing={2} sx={{ pt: 1 }}>
    <TextField select label="Deltaker / ansattavtale" value={participantId} onChange={(e) => setParticipantId(e.target.value)} required>{participants.map((person) => <MenuItem key={person.id} value={person.id}>{person.displayName}{person.email ? ` · ${person.email}` : ''}</MenuItem>)}</TextField>
    <TextField type="date" label="Fra" value={start} onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }} /><TextField type="date" label="Til" value={end} onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }} />{error && <Alert severity="error">{error}</Alert>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Avbryt</Button><Button variant="contained" disabled={busy || !participantId || !start || !end} onClick={submit}>{busy ? 'Oppretter…' : 'Opprett'}</Button></DialogActions></Dialog>;
}

function CreateEntryDialog({ open, onClose, projectId, periodId, onCreated }: { open: boolean; onClose: () => void; projectId: string; periodId: string; onCreated: () => void }) {
  const [workDate, setWorkDate] = React.useState(dateValue(new Date())); const [activity, setActivity] = React.useState('Arbeid'); const [description, setDescription] = React.useState('');
  const [duration, setDuration] = React.useState(60); const [breaks, setBreaks] = React.useState(0); const [billable, setBillable] = React.useState(true); const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState('');
  const submit = async () => { setBusy(true); setError(''); try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/timesheets/${periodId}/entries`, { method: 'POST', body: { idempotencyKey: globalThis.crypto.randomUUID(), workDate, activity, description: description || null, durationMinutes: duration, breakMinutes: breaks, billable, source: 'manual' } }); onCreated(); } catch (cause: any) { setError(cause?.message || 'Kunne ikke lagre tiden.'); } finally { setBusy(false); } };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"><DialogTitle>Før arbeidstid</DialogTitle><DialogContent dividers><Stack spacing={2} sx={{ pt: 1 }}>
    <TextField type="date" label="Dato" value={workDate} onChange={(e) => setWorkDate(e.target.value)} InputLabelProps={{ shrink: true }} /><TextField label="Aktivitet" value={activity} onChange={(e) => setActivity(e.target.value)} /><TextField label="Beskrivelse" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} /><Stack direction="row" spacing={1}><TextField type="number" label="Minutter" value={duration} onChange={(e) => setDuration(Number(e.target.value))} inputProps={{ min: 1, max: 1440 }} /><TextField type="number" label="Pause" value={breaks} onChange={(e) => setBreaks(Number(e.target.value))} inputProps={{ min: 0 }} /></Stack><FormControlLabel control={<Switch checked={billable} onChange={(e) => setBillable(e.target.checked)} />} label="Fakturerbar tid" />{error && <Alert severity="error">{error}</Alert>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Avbryt</Button><Button variant="contained" onClick={submit} disabled={busy || !activity || duration <= breaks}>{busy ? 'Lagrer…' : 'Lagre'}</Button></DialogActions></Dialog>;
}
