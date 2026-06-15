/**
 * SessionsDialog — produsentens økt-kalender: book opptak/review/prøve, inviter
 * band/vokalist (e-post + .ics), og se RSVP-status per deltaker.
 */
import React from 'react';
import {
  Box, Stack, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, CircularProgress, IconButton, Divider,
} from '@mui/material';
import { EventOutlined, DeleteOutline, CheckCircle, Cancel, HelpOutline, LocalFireDepartmentOutlined, SyncOutlined, LinkOutlined } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

const PANEL = '#131316', BORDER = 'rgba(255,255,255,0.08)', TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', FAINT = 'rgba(245,242,234,0.38)', ACCENT = '#FF6B35', GREEN = '#5fb88a';
const fieldSx = { '& .MuiInputBase-input': { color: TEXT }, '& .MuiInputLabel-root': { color: MUTED }, '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER } };
const KINDS: [string, string][] = [['opptak', 'Opptak'], ['review', 'Review'], ['prove', 'Prøve'], ['mix', 'Mix']];
const TARGETS: [string, string][] = [['all', 'Alle'], ['vocalist', 'Vokalist'], ['instrument', 'Instrument']];
const fmtWhen = (s: string) => new Date(s).toLocaleString('no-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const statusChip = (st: string) => st === 'confirmed' ? { label: 'Bekreftet', c: GREEN, i: <CheckCircle sx={{ fontSize: '12px !important' }} /> } : st === 'declined' ? { label: 'Avslått', c: '#e0606a', i: <Cancel sx={{ fontSize: '12px !important' }} /> } : st === 'tentative' ? { label: 'Kanskje', c: '#e0a955', i: <HelpOutline sx={{ fontSize: '12px !important' }} /> } : { label: 'Invitert', c: MUTED, i: <HelpOutline sx={{ fontSize: '12px !important' }} /> };

const SessionsDialog: React.FC<{ open: boolean; projectId: string; onClose: () => void }> = ({ open, projectId, onClose }) => {
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState<any>({ title: '', kind: 'opptak', startAt: '', endAt: '', location: '', target: 'all', notes: '' });
  const set = (k: string) => (e: any) => setF((p: any) => ({ ...p, [k]: e.target.value }));

  const [gcalStatus, setGcalStatus] = React.useState<{ connected: boolean; calendarScope: boolean; email?: string | null } | null>(null);
  const load = React.useCallback(() => apiRequest(`/api/audio-showcases/${projectId}/sessions`).then((d: any) => setSessions(d.sessions || [])).catch(() => setSessions([])).finally(() => setLoading(false)), [projectId]);
  const loadGcalStatus = React.useCallback(() => apiRequest(`/api/audio-showcase/google-calendar/status`).then((d: any) => setGcalStatus(d)).catch(() => setGcalStatus(null)), []);
  React.useEffect(() => { if (open) { setLoading(true); load(); loadGcalStatus(); } }, [open, load, loadGcalStatus]);

  // Koble til (på nytt) med Calendar-tilgang — sender til Googles samtykke-skjerm.
  const [connecting, setConnecting] = React.useState(false);
  const connectGoogle = async () => {
    setConnecting(true);
    try {
      const r = await apiRequest('/api/creatorhub/google/oauth/start', { method: 'POST', body: {
        mode: 'link', returnPath: window.location.pathname + window.location.search, browserOrigin: window.location.origin,
      } });
      if (r?.authorizationUrl) window.location.href = r.authorizationUrl;
      else setConnecting(false);
    } catch { setConnecting(false); }
  };

  const create = async () => {
    if (!f.title.trim() || !f.startAt) return; setBusy(true);
    try {
      await apiRequest(`/api/audio-showcases/${projectId}/sessions`, { method: 'POST', body: {
        title: f.title.trim(), kind: f.kind, startAt: new Date(f.startAt).toISOString(), endAt: f.endAt ? new Date(f.endAt).toISOString() : undefined,
        location: f.location.trim() || undefined, target: f.target, notes: f.notes.trim() || undefined,
      } });
      setF({ title: '', kind: 'opptak', startAt: '', endAt: '', location: '', target: 'all', notes: '' }); await load();
    } catch { /* */ } finally { setBusy(false); }
  };
  const del = async (id: string) => { await apiRequest(`/api/sessions/${id}`, { method: 'DELETE' }); await load(); };
  const [gcalMsg, setGcalMsg] = React.useState<Record<string, string>>({});
  const pushGcal = async (id: string) => {
    setGcalMsg((m) => ({ ...m, [id]: '…' }));
    try {
      const r = await apiRequest(`/api/sessions/${id}/gcal`, { method: 'POST', body: {} });
      setGcalMsg((m) => ({ ...m, [id]: r?.updated ? 'Oppdatert i Google Calendar' : 'Lagt i Google Calendar' }));
      await load();
    } catch (e: any) {
      const msg = String(e?.message || '');
      setGcalMsg((m) => ({ ...m, [id]: msg.includes('409') ? 'Koble Google m/ Calendar-tilgang først' : 'Kunne ikke legge til' }));
      loadGcalStatus();
    }
  };
  const pullGcal = async (id: string) => {
    setGcalMsg((m) => ({ ...m, [id]: 'Henter…' }));
    try {
      const r = await apiRequest(`/api/sessions/${id}/gcal/pull`, { method: 'POST', body: {} });
      setGcalMsg((m) => ({ ...m, [id]: r?.deleted ? 'Slettet i Google — koblingen nullstilt' : r?.changed ? 'Oppdatert fra Google' : 'Ingen endringer' }));
      await load();
    } catch (e: any) {
      const msg = String(e?.message || '');
      setGcalMsg((m) => ({ ...m, [id]: msg.includes('409') ? 'Push økta til Google først' : 'Kunne ikke hente' }));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}><EventOutlined sx={{ color: ACCENT }} /> Økter & booking</DialogTitle>
      <DialogContent>
        {/* Google Calendar-tilkobling: tilbyr «koble til» når scope mangler. */}
        {gcalStatus && !gcalStatus.calendarScope && (
          <Box sx={{ mb: 1.5, p: 1.25, borderRadius: '10px', bgcolor: 'rgba(63,167,214,0.10)', border: '1px solid rgba(63,167,214,0.25)' }}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <EventOutlined sx={{ color: '#3fa7d6', fontSize: 20 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.74rem', fontWeight: 700 }}>{gcalStatus.connected ? 'Google er koblet, men mangler kalender-tilgang' : 'Koble til Google Calendar'}</Typography>
                <Typography sx={{ fontSize: '0.64rem', color: MUTED }}>Koble til (på nytt) med Calendar-tilgang for å legge økter rett i Google og hente endringer tilbake.</Typography>
              </Box>
              <Button onClick={connectGoogle} disabled={connecting} startIcon={<LinkOutlined sx={{ fontSize: '15px !important' }} />} size="small" variant="outlined" sx={{ color: '#3fa7d6', borderColor: 'rgba(63,167,214,0.5)', textTransform: 'none', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>{connecting ? 'Åpner…' : 'Koble til'}</Button>
            </Stack>
          </Box>
        )}
        {gcalStatus?.calendarScope && (
          <Typography sx={{ mb: 1, fontSize: '0.64rem', color: GREEN, display: 'flex', alignItems: 'center', gap: 0.5 }}><CheckCircle sx={{ fontSize: 13 }} /> Google Calendar koblet{gcalStatus.email ? ` (${gcalStatus.email})` : ''} — toveis synk aktiv.</Typography>
        )}
        {loading ? <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box> : (
          <Stack direction="row" spacing={2}>
            {/* Ny økt */}
            <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: MUTED }}>Ny økt</Typography>
              <TextField label="Tittel" value={f.title} onChange={set('title')} size="small" sx={fieldSx} />
              <Stack direction="row" spacing={1}>
                <TextField select SelectProps={{ native: true }} label="Type" value={f.kind} onChange={set('kind')} size="small" sx={{ width: 120, ...fieldSx }}>{KINDS.map(([v, l]) => <option key={v} value={v} style={{ background: PANEL }}>{l}</option>)}</TextField>
                <TextField select SelectProps={{ native: true }} label="Hvem" value={f.target} onChange={set('target')} size="small" sx={{ flex: 1, ...fieldSx }}>{TARGETS.map(([v, l]) => <option key={v} value={v} style={{ background: PANEL }}>{l}</option>)}</TextField>
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField type="datetime-local" label="Start" InputLabelProps={{ shrink: true }} value={f.startAt} onChange={set('startAt')} size="small" sx={{ flex: 1, ...fieldSx }} />
                <TextField type="datetime-local" label="Slutt" InputLabelProps={{ shrink: true }} value={f.endAt} onChange={set('endAt')} size="small" sx={{ flex: 1, ...fieldSx }} />
              </Stack>
              <TextField label="Sted / online-lenke" value={f.location} onChange={set('location')} size="small" sx={fieldSx} />
              <TextField label="Notat (valgfri)" value={f.notes} onChange={set('notes')} size="small" multiline minRows={2} sx={fieldSx} />
              <Button onClick={create} disabled={busy || !f.title.trim() || !f.startAt} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>{busy ? 'Sender…' : 'Opprett & inviter'}</Button>
              <Typography sx={{ fontSize: '0.64rem', color: FAINT }}>Deltakerne får e-post med svar-lenke + kalenderfil (.ics).</Typography>
            </Stack>
            <Divider orientation="vertical" flexItem sx={{ borderColor: BORDER }} />
            {/* Kommende økter */}
            <Stack spacing={1} sx={{ width: 300 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: MUTED }}>Økter</Typography>
              {sessions.length === 0 && <Typography sx={{ fontSize: '0.74rem', color: FAINT }}>Ingen økter ennå.</Typography>}
              {sessions.map((sx2) => (
                <Box key={sx2.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', p: 1.25 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, flex: 1 }} noWrap>{sx2.title}</Typography>
                    <Chip label={KINDS.find((k) => k[0] === sx2.kind)?.[1] || sx2.kind} size="small" sx={{ height: 18, fontSize: '0.58rem', bgcolor: 'rgba(255,107,53,0.14)', color: ACCENT }} />
                    <IconButton size="small" onClick={() => del(sx2.id)} sx={{ color: FAINT, p: 0.25 }}><DeleteOutline sx={{ fontSize: 15 }} /></IconButton>
                  </Stack>
                  <Typography sx={{ fontSize: '0.68rem', color: MUTED }}>{fmtWhen(sx2.start_at)}{sx2.location ? ` · ${sx2.location}` : ''}</Typography>
                  <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.5 }}>
                    {(sx2.invitees || []).map((iv: any) => { const c = statusChip(iv.status); return <Chip key={iv.name} icon={iv.warmedUp ? <LocalFireDepartmentOutlined sx={{ fontSize: '12px !important' }} /> : c.i} label={iv.warmedUp ? `${iv.name} · klar` : iv.name} size="small" sx={{ height: 18, fontSize: '0.58rem', bgcolor: iv.warmedUp ? 'rgba(95,184,138,0.14)' : 'rgba(255,255,255,0.06)', color: iv.warmedUp ? GREEN : c.c, '& .MuiChip-icon': { color: iv.warmedUp ? GREEN : c.c } }} />; })}
                  </Stack>
                  <Stack direction="row" alignItems="center" flexWrap="wrap" spacing={1} sx={{ mt: 0.5 }}>
                    <Button onClick={() => pushGcal(sx2.id)} startIcon={<EventOutlined sx={{ fontSize: '14px !important' }} />} size="small" sx={{ color: '#3fa7d6', textTransform: 'none', fontSize: '0.66rem', minWidth: 0 }}>{sx2.gcal_event_id ? 'Oppdater i Google' : 'Google Calendar'}</Button>
                    {sx2.gcal_event_id && <Button onClick={() => pullGcal(sx2.id)} startIcon={<SyncOutlined sx={{ fontSize: '14px !important' }} />} size="small" sx={{ color: MUTED, textTransform: 'none', fontSize: '0.66rem', minWidth: 0 }}>Hent endringer</Button>}
                    {sx2.gcal_html_link && <Button href={sx2.gcal_html_link} target="_blank" size="small" sx={{ color: FAINT, textTransform: 'none', fontSize: '0.66rem', minWidth: 0 }}>Åpne</Button>}
                  </Stack>
                  {gcalMsg[sx2.id] && <Typography sx={{ fontSize: '0.62rem', color: MUTED, mt: 0.25 }}>{gcalMsg[sx2.id]}</Typography>}
                </Box>
              ))}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose} sx={{ color: MUTED, textTransform: 'none' }}>Lukk</Button></DialogActions>
    </Dialog>
  );
};

export default SessionsDialog;
