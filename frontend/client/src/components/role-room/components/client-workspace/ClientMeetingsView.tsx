/**
 * ClientMeetingsView — Møter-flaten i Creative Sync Workspace (mot mockupen).
 * Planlegg møte (tittel/dato/tid/deltakere) → Google Meet-lenke genereres
 * automatisk → kommende møter med «Bli med» + «Legg i kalender» + møtenotat.
 * Delt produsent↔klient; backend varsler motparten. Responsiv (stables på mobil).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, IconButton, CircularProgress, Chip, Snackbar, Divider,
} from '@mui/material';
import {
  VideocamOutlined as MeetIcon,
  EventOutlined as CalendarIcon,
  ContentCopy as CopyIcon,
  PersonAddAlt1Outlined as AddPersonIcon,
  DeleteOutline as RemoveIcon,
  CheckCircleOutline as DoneIcon,
  ScheduleOutlined as UpcomingIcon,
  DescriptionOutlined as NotesIcon,
  AddCircleOutline as PlanIcon,
} from '@mui/icons-material';
import {
  listMeetings, createMeeting, type RoleRoomMeeting, type MeetingParticipant,
} from '../../services/roleRoomMeetingsApi';

function pad(n: number): string { return String(n).padStart(2, '0'); }
function toIso(date: string, time: string): string | null {
  if (!date) return null;
  const [h, m] = (time || '09:00').split(':');
  const d = new Date(`${date}T${pad(Number(h) || 9)}:${pad(Number(m) || 0)}:00`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function fmtDate(iso: string | null): string {
  if (!iso) return 'Dato ikke satt';
  const d = new Date(iso);
  return d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fmtTime(startIso: string | null, endIso: string | null): string {
  if (!startIso) return '';
  const s = new Date(startIso);
  const t = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return endIso ? `${t(s)} – ${t(new Date(endIso))}` : t(s);
}
function googleCalendarUrl(m: RoleRoomMeeting): string {
  const fmt = (iso: string | null) => (iso ? new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '') : '');
  const dates = m.startsAt ? `${fmt(m.startsAt)}/${fmt(m.endsAt ?? m.startsAt)}` : '';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: m.title,
    details: m.meetLink ? `Google Meet: ${m.meetLink}` : '',
  });
  if (dates) params.set('dates', dates);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function ClientMeetingsView({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<RoleRoomMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('15:00');
  const [participants, setParticipants] = useState<MeetingParticipant[]>([{ name: '', email: '', role: 'Klient' }]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listMeetings(projectId)); } catch { /* tom */ } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: RoleRoomMeeting[] = []; const pa: RoleRoomMeeting[] = [];
    for (const m of items) {
      const t = m.startsAt ? new Date(m.startsAt).getTime() : 0;
      (m.status === 'completed' || (t && t < now) ? pa : up).push(m);
    }
    return { upcoming: up, past: pa };
  }, [items]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) { setToast('Gi møtet en tittel.'); return; }
    setCreating(true);
    try {
      await createMeeting(projectId, {
        title: title.trim(),
        startsAt: toIso(date, startTime),
        endsAt: toIso(date, endTime),
        participants: participants.filter((p) => p.name?.trim() || p.email?.trim()),
        generateMeet: true,
      });
      setToast('Møte opprettet — Google Meet-lenke generert, motparten varslet.');
      setTitle(''); setDate('');
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Kunne ikke opprette møte.');
    } finally {
      setCreating(false);
    }
  }, [projectId, title, date, startTime, endTime, participants, load]);

  const fieldSx = {
    '& .MuiOutlinedInput-root': { color: '#f1f5f9', background: 'rgba(15,23,42,0.55)' },
    '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' },
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>Møte &amp; Google Meet</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(226,232,240,0.66)', mt: 0.3 }}>
          Planlegg møter med produksjonsteamet. Videomøte genereres automatisk i invitasjonen.
        </Typography>
      </Box>

      {/* Planlegg møte */}
      <Box sx={{ borderRadius: 2.5, border: '1px solid rgba(168,85,247,0.24)', background: 'rgba(124,58,237,0.05)', p: { xs: 1.5, md: 2 } }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
          <PlanIcon sx={{ color: '#c4b5fd', fontSize: 20 }} />
          <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '1rem' }}>Planlegg møte</Typography>
        </Stack>
        <Stack spacing={1.25}>
          <TextField label="Tittel" value={title} onChange={(e) => setTitle(e.target.value)} size="small" fullWidth sx={fieldSx} placeholder="F.eks. Oppstartsmøte · Vårkampanje 2026" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField label="Dato" type="date" value={date} onChange={(e) => setDate(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={fieldSx} />
            <TextField label="Fra" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={fieldSx} />
            <TextField label="Til" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={fieldSx} />
          </Stack>

          <Box>
            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.78rem', fontWeight: 700, mb: 0.6 }}>Deltakere</Typography>
            <Stack spacing={0.75}>
              {participants.map((p, i) => (
                <Stack key={i} direction="row" spacing={0.75} alignItems="center">
                  <TextField placeholder="Navn" value={p.name ?? ''} onChange={(e) => setParticipants((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} size="small" sx={{ ...fieldSx, flex: 1 }} />
                  <TextField placeholder="E-post" value={p.email ?? ''} onChange={(e) => setParticipants((prev) => prev.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} size="small" sx={{ ...fieldSx, flex: 1.3 }} />
                  <IconButton aria-label="Fjern deltaker" onClick={() => setParticipants((prev) => prev.filter((_, j) => j !== i))} sx={{ width: 40, height: 40, color: 'rgba(226,232,240,0.6)' }}>
                    <RemoveIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Button onClick={() => setParticipants((prev) => [...prev, { name: '', email: '', role: 'Klient' }])} startIcon={<AddPersonIcon />} size="small" sx={{ mt: 0.75, textTransform: 'none', fontWeight: 700, color: '#c4b5fd', minHeight: 40 }}>
              Legg til deltaker
            </Button>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, py: 1, borderRadius: '10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.24)' }}>
            <MeetIcon sx={{ color: '#6ee7b7', fontSize: 18 }} />
            <Typography sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.8rem' }}>
              Google Meet-lenke genereres automatisk for invitasjonen.
            </Typography>
          </Stack>

          <Button
            onClick={() => void handleCreate()} disabled={creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <MeetIcon />}
            sx={{ textTransform: 'none', fontWeight: 800, minHeight: 46, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' } }}
          >
            {creating ? 'Oppretter …' : 'Opprett møte & generer Google Meet'}
          </Button>
        </Stack>
      </Box>

      {/* Kommende møter */}
      <Box>
        <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.82rem', fontWeight: 800, mb: 1 }}>
          Kommende møter {loading ? '' : `· ${upcoming.length}`}
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} sx={{ color: '#a855f7' }} /></Box>
        ) : upcoming.length === 0 ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.82rem', py: 2, textAlign: 'center' }}>Ingen kommende møter ennå.</Typography>
        ) : (
          <Stack spacing={1.25}>{upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}</Stack>
        )}

        {past.length > 0 ? (
          <>
            <Divider sx={{ my: 1.5, borderColor: 'rgba(148,163,184,0.16)' }} />
            <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.78rem', fontWeight: 700, mb: 1 }}>Tidligere møter · {past.length}</Typography>
            <Stack spacing={1}>{past.map((m) => <MeetingCard key={m.id} m={m} past />)}</Stack>
          </>
        ) : null}
      </Box>

      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Stack>
  );
}

function MeetingCard({ m, past = false }: { m: RoleRoomMeeting; past?: boolean }) {
  const [copied, setCopied] = useState(false);
  const notesReady = m.notesStatus === 'ready' && Boolean(m.notes);
  return (
    <Box sx={{ borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(2,6,23,0.4)', p: { xs: 1.25, md: 1.5 }, opacity: past ? 0.85 : 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: '#f1f5f9', fontWeight: 800, fontSize: '0.95rem' }}>{m.title}</Typography>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.4, color: 'rgba(226,232,240,0.7)' }}>
            <CalendarIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: '0.78rem' }}>{fmtDate(m.startsAt)}{m.startsAt ? ` · ${fmtTime(m.startsAt, m.endsAt)} (${m.timeZone === 'Europe/Oslo' ? 'CET/CEST' : m.timeZone})` : ''}</Typography>
          </Stack>
        </Box>
        <Chip
          size="small"
          icon={past ? <DoneIcon sx={{ fontSize: 14, color: '#6ee7b7 !important' }} /> : <UpcomingIcon sx={{ fontSize: 14, color: '#fcd34d !important' }} />}
          label={past ? 'Fullført' : 'Kommende'}
          sx={{ height: 22, fontSize: '0.66rem', fontWeight: 800, color: past ? '#6ee7b7' : '#fcd34d', background: past ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)' }}
        />
      </Stack>

      {m.participants.length > 0 ? (
        <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.74rem', mt: 0.5 }}>
          {m.participants.map((p) => p.name || p.email).filter(Boolean).join(' & ')}
        </Typography>
      ) : null}

      {m.meetLink ? (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.6 }}>
          <MeetIcon sx={{ fontSize: 14, color: '#86efac' }} />
          <Typography sx={{ color: 'rgba(134,239,172,0.95)', fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.meetLink.replace(/^https?:\/\//, '')}
          </Typography>
          <IconButton aria-label="Kopier Meet-lenke" onClick={() => { void navigator.clipboard?.writeText(m.meetLink ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); }} sx={{ width: 32, height: 32, color: 'rgba(226,232,240,0.6)' }}>
            <CopyIcon sx={{ fontSize: 14 }} />
          </IconButton>
          {copied ? <Typography sx={{ color: '#6ee7b7', fontSize: '0.7rem' }}>Kopiert</Typography> : null}
        </Stack>
      ) : null}

      <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.75 }}>
        {m.meetLink && !past ? (
          <Button href={m.meetLink} target="_blank" rel="noopener" startIcon={<MeetIcon />} size="small"
            sx={{ textTransform: 'none', fontWeight: 800, minHeight: 40, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' } }}>
            Bli med (Google Meet)
          </Button>
        ) : null}
        <Button href={googleCalendarUrl(m)} target="_blank" rel="noopener" startIcon={<CalendarIcon />} size="small" variant="outlined"
          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40, color: 'rgba(226,232,240,0.85)', borderColor: 'rgba(148,163,184,0.3)' }}>
          Legg i kalender
        </Button>
      </Stack>

      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.8, pt: 0.8, borderTop: '1px dashed rgba(148,163,184,0.16)' }}>
        <NotesIcon sx={{ fontSize: 14, color: notesReady ? '#86efac' : 'rgba(226,232,240,0.55)' }} />
        <Typography sx={{ color: notesReady ? 'rgba(134,239,172,0.95)' : 'rgba(226,232,240,0.55)', fontSize: '0.74rem' }}>
          {notesReady ? 'Møtenotat klart' : 'Møtenotat kobles automatisk etter møtet'}
        </Typography>
      </Stack>
    </Box>
  );
}
