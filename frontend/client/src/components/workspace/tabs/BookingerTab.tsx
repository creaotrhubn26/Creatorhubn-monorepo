// @ts-nocheck
/**
 * BookingerTab («Bookinger») — service-kategoriens ekvivalent til
 * Produksjonskart/Sesjoner. For booking-baserte profesjoner (frisør,
 * hundefrisør, yoga, tatovør …): kommende avtaler gruppert per dag, ny
 * booking med tid/varighet/sted (+ valgfri Google Meet for konsultasjoner),
 * og kundekortet fra prosjektets CRM-kobling. Gjenbruker de eksisterende
 * avtale-endepunktene (GET /api/projects/:id/avtaler + POST .../meetings)
 * — null ny backend, samme mønster som Sesjoner-fanens studio-økter.
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Checkbox, FormControlLabel, Alert } from '@mui/material';
import { useLocation } from 'wouter';
import EventAvailable from '@mui/icons-material/EventAvailable';
import Event from '@mui/icons-material/Event';
import Person from '@mui/icons-material/Person';
import Schedule from '@mui/icons-material/Schedule';
import Videocam from '@mui/icons-material/Videocam';
import Add from '@mui/icons-material/Add';
import Place from '@mui/icons-material/Place';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag, WsStat, WsSectionTitle } from '../ui';

const fmtTime = (iso: any) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : '';
};
const dayLabel = (iso: any) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 864e5);
  if (diff === 0) return 'I dag';
  if (diff === 1) return 'I morgen';
  return d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
};
const dayKey = (iso: any) => { const d = new Date(iso); d.setHours(0, 0, 0, 0); return d.getTime(); };

const BookingerTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [, navigate] = useLocation();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const load = () => {
    if (!isReal) { setLoading(false); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/avtaler`)
      .then((r: any) => {
        setMeetings(Array.isArray(r?.meetings) ? r.meetings : []);
        setCustomer(r?.crmCustomer || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId, isReal]);

  const now = Date.now();
  const upcoming = meetings
    .filter((m) => m.scheduledAt && new Date(m.scheduledAt).getTime() >= now - 36e5)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const weekEnd = now + 7 * 864e5;
  const thisWeek = upcoming.filter((m) => new Date(m.scheduledAt).getTime() <= weekEnd);
  const next = upcoming[0] || null;

  // Grupper per dag for liste-visningen.
  const byDay: [number, any[]][] = [];
  for (const m of upcoming) {
    const k = dayKey(m.scheduledAt);
    const bucket = byDay.find(([d]) => d === k);
    if (bucket) bucket[1].push(m); else byDay.push([k, [m]]);
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Bookinger</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Avtalene i dette prosjektet — planlegg nye bookinger med tid, varighet og sted. Alt synkroniseres med Avtaler-fanen og kundens kalender.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add sx={{ fontSize: 16 }} />} onClick={() => setNewOpen(true)} disabled={!isReal}
          sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
          Ny booking
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        <WsStat icon={<EventAvailable sx={{ fontSize: 20 }} />} label="Kommende" value={upcoming.length} sub="bookinger" tone={ws.accentSoft} />
        <WsStat icon={<Schedule sx={{ fontSize: 20 }} />} label="Denne uken" value={thisWeek.length} sub="neste 7 dager" tone={ws.blueSoft} />
        <WsStat icon={<Event sx={{ fontSize: 20 }} />} label="Neste booking" value={next ? fmtTime(next.scheduledAt) : '—'} sub={next ? dayLabel(next.scheduledAt).toLowerCase() : 'ingen planlagt'} tone={ws.amberSoft} />
        <WsStat icon={<Person sx={{ fontSize: 20 }} />} label="Kunde" value={customer?.name ? customer.name.split(' ')[0] : '—'} sub={customer?.status || 'ikke koblet'} tone={ws.greenSoft} />
      </Box>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
        {/* Booking-liste gruppert per dag */}
        <WsCard sx={{ flex: 1, minWidth: 0 }}>
          <WsSectionTitle icon={<EventAvailable sx={{ fontSize: 18, color: ws.textDim }} />} title="Kommende bookinger" />
          {upcoming.length === 0 ? (
            <Stack alignItems="center" sx={{ py: 5 }} spacing={1}>
              <EventAvailable sx={{ fontSize: 36, color: ws.textFaint }} />
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Ingen bookinger ennå</Typography>
              <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 420 }}>
                Planlegg første booking med tid, varighet og sted — den dukker også opp under Avtaler. Innkommende henvendelser finner du i Forespørsler-fanen.
              </Typography>
              <Button variant="contained" onClick={() => setNewOpen(true)} disabled={!isReal}
                sx={{ mt: 1, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
                Ny booking
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {byDay.map(([day, items]) => (
                <Box key={day}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: ws.accent, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.75 }}>
                    {dayLabel(items[0].scheduledAt)}
                  </Typography>
                  <Stack spacing={0.75}>
                    {items.map((m: any) => (
                      <Stack key={m.id} direction="row" spacing={1.25} alignItems="center"
                        sx={{ p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                        <Box sx={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 800, color: ws.accent, lineHeight: 1.1 }}>{fmtTime(m.scheduledAt)}</Typography>
                          {m.durationMinutes ? <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{m.durationMinutes} min</Typography> : null}
                        </Box>
                        <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 2, bgcolor: ws.accentSoft, flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} noWrap>{m.title || 'Booking'}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {m.location && (
                              <Stack direction="row" spacing={0.35} alignItems="center">
                                <Place sx={{ fontSize: 12, color: ws.textFaint }} />
                                <Typography sx={{ fontSize: 11.5, color: ws.textFaint }} noWrap>{m.location}</Typography>
                              </Stack>
                            )}
                            {m.description && <Typography sx={{ fontSize: 11.5, color: ws.textFaint }} noWrap>{m.description}</Typography>}
                          </Stack>
                        </Box>
                        {m.meetLink && (
                          <Button size="small" variant="outlined" startIcon={<Videocam sx={{ fontSize: 15 }} />} href={m.meetLink} target="_blank" rel="noreferrer"
                            sx={{ color: ws.blue, borderColor: 'rgba(96,165,250,0.4)', textTransform: 'none', fontWeight: 600, flexShrink: 0 }}>
                            Meet
                          </Button>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </WsCard>

        {/* Kunde-kort */}
        <WsCard sx={{ width: { xs: '100%', lg: 300 }, flexShrink: 0 }}>
          <WsSectionTitle icon={<Person sx={{ fontSize: 18, color: ws.textDim }} />} title="Kunde" />
          {customer ? (
            <Stack spacing={1}>
              <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{customer.name}</Typography>
              {customer.email && <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{customer.email}</Typography>}
              <Stack direction="row" spacing={0.75}>
                {customer.status && <WsTag label={customer.status} tone="accent" />}
                {customer.projectType && <WsTag label={customer.projectType} tone="neutral" />}
              </Stack>
              <Button fullWidth size="small" variant="outlined" onClick={() => navigate(`/workspace/${projectId}/avtaler`)}
                sx={{ mt: 0.5, color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>
                Avtaler & kontrakt
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1}>
              <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Ingen kunde koblet til prosjektet ennå. Konverter en henvendelse fra Forespørsler, eller legg til kunden under Avtaler.</Typography>
              <Button fullWidth size="small" variant="outlined" onClick={() => navigate(`/workspace/${projectId}/foresporsler`)}
                sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>
                Åpne Forespørsler
              </Button>
            </Stack>
          )}
        </WsCard>
      </Stack>

      <NewBookingDialog open={newOpen} onClose={() => setNewOpen(false)} projectId={projectId} onCreated={() => { setNewOpen(false); load(); }} />
    </Box>
  );
};

const NewBookingDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; onCreated: () => void }> = ({ open, onClose, projectId, onCreated }) => {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [withMeet, setWithMeet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!when) { setError('Velg dato og tid'); return; }
    setBusy(true); setError(null);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/meetings`, {
        method: 'POST',
        body: {
          title: title.trim() || 'Booking',
          scheduledAt: new Date(when).toISOString(),
          durationMinutes: duration,
          location: location.trim() || null,
          description: notes.trim() || null,
          generateMeet: withMeet,
        },
      });
      setTitle(''); setWhen(''); setLocation(''); setNotes(''); setWithMeet(false);
      onCreated();
    } catch (e: any) { setError(e?.message || 'Kunne ikke opprette bookingen'); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Ny booking</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label="Hva gjelder det?" placeholder="F.eks. Klipp og farge / Konsultasjon" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth size="small" />
          <TextField label="Dato og tid" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} required />
          <TextField select label="Varighet" value={duration} onChange={(e) => setDuration(Number(e.target.value))} fullWidth size="small">
            {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => <MenuItem key={m} value={m}>{m >= 60 ? `${m / 60} t` : `${m} min`}</MenuItem>)}
          </TextField>
          <TextField label="Sted" placeholder="F.eks. Salongen, Storgata 1" value={location} onChange={(e) => setLocation(e.target.value)} fullWidth size="small" />
          <TextField label="Notat" placeholder="Valgfritt — forberedelser, ønsker …" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth size="small" multiline minRows={2} />
          <FormControlLabel control={<Checkbox checked={withMeet} onChange={(e) => setWithMeet(e.target.checked)} size="small" />} label="Lag Google Meet-lenke (videokonsultasjon)" />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Avbryt</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !when} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}>{busy ? 'Oppretter…' : 'Opprett booking'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default BookingerTab;
