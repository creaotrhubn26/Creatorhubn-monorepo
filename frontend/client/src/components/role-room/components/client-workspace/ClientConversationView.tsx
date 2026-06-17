/**
 * ClientConversationView — Meldinger-fanen i Creative Sync Workspace
 * (producer-conversation-mockupen). Samlet klient-samtale: ekte meldinger
 * (role_room_messages) FLETTET med aktivitet (opplastinger, godkjenninger,
 * leveranser, møter) fra role_room_project_notifications — én tidslinje med
 * komposer, status-chips og forespørsel-håndtering. Delt produsent↔klient.
 * Responsiv (stables på mobil/iPad), WCAG, 44px touch.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, Chip, CircularProgress, Snackbar, ToggleButtonGroup, ToggleButton,
  IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Select, FormControl,
} from '@mui/material';
import {
  SendOutlined as SendIcon,
  HelpOutlineOutlined as RequestIcon,
  CloudUploadOutlined as UploadIcon,
  TaskAltOutlined as ApprovalIcon,
  MovieOutlined as DeliveryIcon,
  VideocamOutlined as MeetingIcon,
  ChatBubbleOutlineOutlined as MessageIcon,
  CampaignOutlined as ActivityIcon,
  MarkChatUnreadOutlined as UnansweredIcon,
  HourglassEmptyOutlined as PendingIcon,
  CheckCircleOutline as DoneIcon,
  AddCircleOutline as ActionIcon,
  EventAvailableOutlined as ScheduleIcon,
  BoltOutlined as InstantMeetIcon,
} from '@mui/icons-material';
import { listMessages, sendMessage, updateMessage, type RoleRoomMessage } from '../../services/roleRoomMessagesApi';
import { producerWorkflowService, type ProducerProjectNotification } from '../../services/producerWorkflowService';
import { createMeeting } from '../../services/roleRoomMeetingsApi';
import { uploadMaterialFile, MATERIAL_CATEGORIES, type MaterialCategory } from '../../services/roleRoomMaterialsApi';

type FeedItem = {
  id: string;
  messageId?: string;
  ts: number;
  kind: 'message' | 'request' | 'activity';
  title: string;
  body: string | null;
  author: string | null;
  authorRole: string | null;
  status?: string;
  icon: 'message' | 'request' | 'upload' | 'approval' | 'delivery' | 'meeting' | 'activity';
  action?: string;
  meta?: Record<string, unknown>;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
};

function activityIcon(eventType: string, inboxType: string): FeedItem['icon'] {
  const e = `${eventType} ${inboxType}`.toLowerCase();
  if (e.includes('material') || e.includes('upload')) return 'upload';
  if (e.includes('approval') || e.includes('review')) return 'approval';
  if (e.includes('deliver')) return 'delivery';
  if (e.includes('meeting')) return 'meeting';
  return 'activity';
}

const ICON_MAP = {
  message: MessageIcon, request: RequestIcon, upload: UploadIcon,
  approval: ApprovalIcon, delivery: DeliveryIcon, meeting: MeetingIcon, activity: ActivityIcon,
} as const;
const ICON_COLOR = {
  message: '#c4b5fd', request: '#fbbf24', upload: '#7dd3fc',
  approval: '#86efac', delivery: '#f0abfc', meeting: '#a5b4fc', activity: 'rgba(226,232,240,0.7)',
} as const;

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtDay(ts: number): string {
  return new Date(ts).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function ClientConversationView({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<RoleRoomMessage[]>([]);
  const [notifications, setNotifications] = useState<ProducerProjectNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [kind, setKind] = useState<'message' | 'request'>('message');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [msgs, notifs] = await Promise.allSettled([
      listMessages(projectId),
      producerWorkflowService.getNotifications(projectId),
    ]);
    if (msgs.status === 'fulfilled') setMessages(msgs.value);
    if (notifs.status === 'fulfilled') setNotifications(notifs.value);
    setLoading(false);
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    for (const m of messages) {
      const ts = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      const action = typeof m.metadata?.action === 'string' ? m.metadata.action : undefined;
      items.push({
        id: `msg-${m.id}`, messageId: m.id, ts, kind: m.kind === 'request' ? 'request' : 'message',
        title: m.kind === 'request' ? 'Forespørsel' : (m.authorName || (m.authorRole === 'client_reviewer' ? 'Klient' : 'Produsent')),
        body: m.body, author: m.authorName, authorRole: m.authorRole,
        status: m.kind === 'request' ? m.status : undefined,
        icon: action === 'request_upload' ? 'upload' : (m.linkedEntityType === 'meeting' || action === 'meeting') ? 'meeting' : m.kind === 'request' ? 'request' : 'message',
        action, meta: m.metadata, linkedEntityType: m.linkedEntityType, linkedEntityId: m.linkedEntityId,
      });
    }
    for (const n of notifications) {
      // Hopp over meldings-speil (de er allerede med som ekte meldinger).
      if (n.event_type?.startsWith('message')) continue;
      if (n.archived_at) continue;
      const ts = n.created_at ? new Date(n.created_at).getTime() : 0;
      items.push({
        id: `act-${n.id}`, ts, kind: 'activity',
        title: n.title, body: n.message ?? null, author: n.client_name ?? null, authorRole: null,
        icon: activityIcon(n.event_type ?? '', n.inbox_type ?? ''),
      });
    }
    return items.sort((a, b) => a.ts - b.ts);
  }, [messages, notifications]);

  // Status-chips (mockup): ubesvarte forespørsler / venter godkjenning / nye opplastinger.
  const stats = useMemo(() => {
    const openRequests = messages.filter((m) => m.kind === 'request' && m.status === 'open').length;
    const pendingApproval = notifications.filter((n) => !n.resolved_at && !n.archived_at && /approval|review/i.test(`${n.event_type} ${n.inbox_type}`)).length;
    const uploads = notifications.filter((n) => !n.archived_at && /material|upload/i.test(`${n.event_type} ${n.inbox_type}`)).length;
    return { openRequests, pendingApproval, uploads };
  }, [messages, notifications]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await sendMessage(projectId, { body, kind });
      setDraft('');
      setToast(kind === 'request' ? 'Forespørsel sendt — motparten varslet.' : 'Melding sendt.');
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Kunne ikke sende.');
    } finally {
      setSending(false);
    }
  }, [projectId, draft, kind, load]);

  const closeRequest = useCallback(async (id: string) => {
    try {
      await updateMessage(projectId, id, { status: 'closed' });
      await load();
    } catch { setToast('Kunne ikke lukke forespørselen.'); }
  }, [projectId, load]);

  // ── Handlinger fra chatten ────────────────────────────────────────────────
  const [actionAnchor, setActionAnchor] = useState<HTMLElement | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeTitle, setProposeTitle] = useState('');
  const [proposeDate, setProposeDate] = useState('');
  const [proposeTime, setProposeTime] = useState('14:00');

  const requestUpload = useCallback(async (category: MaterialCategory) => {
    setBusyAction(true);
    try {
      const label = MATERIAL_CATEGORIES.find((c) => c.key === category)?.label ?? 'fil';
      await sendMessage(projectId, {
        body: `Du kan laste opp ${label.toLowerCase()} her:`,
        metadata: { action: 'request_upload', uploadCategory: category },
      });
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke be om opplasting.'); }
    finally { setBusyAction(false); setActionAnchor(null); }
  }, [projectId, load]);

  const startInstantMeet = useCallback(async () => {
    setBusyAction(true); setActionAnchor(null);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 60000);
      const m = await createMeeting(projectId, {
        title: 'Hurtigmøte', startsAt: now.toISOString(), endsAt: end.toISOString(), generateMeet: true,
      });
      await sendMessage(projectId, {
        body: m.meetLink ? 'Jeg startet et Google Meet — bli med:' : 'Jeg startet et møte (Google Meet kunne ikke kobles — sjekk tilkobling).',
        linkedEntityType: 'meeting', linkedEntityId: m.id,
        metadata: { action: 'meeting', meetLink: m.meetLink, refLabel: 'Hurtigmøte' },
      });
      setToast('Google Meet startet og delt i chatten.');
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke starte møte.'); }
    finally { setBusyAction(false); }
  }, [projectId, load]);

  const bookProposedMeeting = useCallback(async () => {
    if (!proposeDate) { setToast('Velg en dato.'); return; }
    setBusyAction(true);
    try {
      const [h, mm] = proposeTime.split(':');
      const start = new Date(`${proposeDate}T${(h || '14').padStart(2, '0')}:${(mm || '00').padStart(2, '0')}:00`);
      const end = new Date(start.getTime() + 60 * 60000);
      const m = await createMeeting(projectId, {
        title: proposeTitle.trim() || 'Møte', startsAt: start.toISOString(), endsAt: end.toISOString(), generateMeet: true,
      });
      await sendMessage(projectId, {
        body: `Jeg booket møtet «${m.title}» ${start.toLocaleString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.`,
        linkedEntityType: 'meeting', linkedEntityId: m.id,
        metadata: { action: 'meeting', meetLink: m.meetLink, refLabel: m.title },
      });
      setProposeOpen(false); setProposeTitle(''); setProposeDate('');
      setToast('Møte booket, Google Meet generert og delt.');
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke booke møte.'); }
    finally { setBusyAction(false); }
  }, [projectId, proposeTitle, proposeDate, proposeTime, load]);

  // Send til godkjenning → ekte review i Godkjenning-flaten (begge sider) + chat-kort.
  const sendToApproval = useCallback(async () => {
    setBusyAction(true); setActionAnchor(null);
    try {
      const review = await producerWorkflowService.createReview(projectId, {
        reviewType: 'client_approval',
        title: 'Godkjenning forespurt i samtale',
        description: 'Sendt til godkjenning fra Action i chatten.',
      });
      await sendMessage(projectId, {
        body: 'Jeg sendte dette til godkjenning hos klienten.',
        linkedEntityType: 'review', linkedEntityId: review.id,
        metadata: { action: 'approval', refLabel: review.title },
      });
      setToast('Sendt til godkjenning — ligger nå i Godkjenning-flaten.');
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke sende til godkjenning.'); }
    finally { setBusyAction(false); }
  }, [projectId, load]);

  // Action-launcher (skråstrek + spotlight).
  const [actionSpotlight, setActionSpotlight] = useState(false);
  useEffect(() => {
    try { if (!window.localStorage.getItem('rr_action_seen')) setActionSpotlight(true); } catch { /* ignore */ }
  }, []);
  const dismissSpotlight = useCallback(() => {
    setActionSpotlight(false);
    try { window.localStorage.setItem('rr_action_seen', '1'); } catch { /* ignore */ }
  }, []);
  const openActionLauncher = useCallback((anchor: HTMLElement) => { setActionAnchor(anchor); dismissSpotlight(); }, [dismissSpotlight]);

  // Grupper feed per dag.
  const grouped = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    for (const it of feed) {
      const key = it.ts ? fmtDay(it.ts) : 'Uten dato';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [feed]);

  return (
    <Stack spacing={1.75}>
      <Box>
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>Samtale &amp; aktivitet</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'rgba(226,232,240,0.66)', mt: 0.3 }}>
          Alt mellom dere på ett sted — meldinger, forespørsler, opplastinger, godkjenninger og leveranser.
        </Typography>
      </Box>

      {/* Status-chips */}
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        <StatChip icon={<UnansweredIcon sx={{ fontSize: 15 }} />} label={`${stats.openRequests} ubesvart`} tone="#fbbf24" />
        <StatChip icon={<PendingIcon sx={{ fontSize: 15 }} />} label={`${stats.pendingApproval} venter godkjenning`} tone="#f0abfc" />
        <StatChip icon={<UploadIcon sx={{ fontSize: 15 }} />} label={`${stats.uploads} opplastinger`} tone="#7dd3fc" />
      </Stack>

      {/* Tidslinje */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: '#a855f7' }} /></Box>
      ) : feed.length === 0 ? (
        <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.85rem', py: 3, textAlign: 'center' }}>
          Ingen aktivitet ennå. Send den første meldingen nedenfor.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {grouped.map(([day, dayItems]) => (
            <Box key={day}>
              <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize', mb: 0.75, textAlign: 'center' }}>{day}</Typography>
              <Stack spacing={1}>
                {dayItems.map((it) => <FeedRow key={it.id} it={it} projectId={projectId} onCloseRequest={closeRequest} onChanged={load} />)}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* Komposer */}
      <Box sx={{ position: 'sticky', bottom: 0, pt: 1, background: 'linear-gradient(180deg, transparent, rgba(2,6,23,0.6) 30%)' }}>
        <ToggleButtonGroup
          value={kind} exclusive size="small"
          onChange={(_, v) => { if (v) setKind(v); }}
          sx={{ mb: 0.75, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.74rem', color: 'rgba(226,232,240,0.7)', borderColor: 'rgba(148,163,184,0.25)', minHeight: 36, '&.Mui-selected': { color: '#fff', background: 'rgba(168,85,247,0.25)' } } }}
        >
          <ToggleButton value="message">Melding</ToggleButton>
          <ToggleButton value="request">Forespørsel</ToggleButton>
        </ToggleButtonGroup>
        {proposeOpen ? (
          <Box sx={{ mb: 1, p: 1.25, borderRadius: 2, border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(124,58,237,0.06)' }}>
            <Typography sx={{ color: '#f5f3ff', fontWeight: 700, fontSize: '0.84rem', mb: 0.75 }}>Foreslå &amp; book møte</Typography>
            <Stack spacing={0.75}>
              <TextField placeholder="Tittel (f.eks. Konseptgjennomgang)" value={proposeTitle} onChange={(e) => setProposeTitle(e.target.value)} size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': { color: '#f1f5f9', background: 'rgba(15,23,42,0.6)' } }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}>
                <TextField type="date" value={proposeDate} onChange={(e) => setProposeDate(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { color: '#f1f5f9', background: 'rgba(15,23,42,0.6)' } }} />
                <TextField type="time" value={proposeTime} onChange={(e) => setProposeTime(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} sx={{ '& .MuiOutlinedInput-root': { color: '#f1f5f9', background: 'rgba(15,23,42,0.6)' } }} />
              </Stack>
              <Stack direction="row" spacing={0.75}>
                <Button onClick={() => void bookProposedMeeting()} disabled={busyAction} startIcon={busyAction ? <CircularProgress size={14} color="inherit" /> : <ScheduleIcon />} sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)' }}>Book &amp; del Google Meet</Button>
                <Button onClick={() => setProposeOpen(false)} sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, color: 'rgba(226,232,240,0.7)' }}>Avbryt</Button>
              </Stack>
            </Stack>
          </Box>
        ) : null}
        {/* Første-gangs spotlight: «Prøv Action» */}
        {actionSpotlight ? (
          <Box sx={{ mb: 1, p: 1.25, borderRadius: 2, border: '1px solid rgba(168,85,247,0.45)', background: 'linear-gradient(135deg, rgba(124,58,237,0.22), rgba(168,85,247,0.1))', display: 'flex', alignItems: 'center', gap: 1 }}>
            <InstantMeetIcon sx={{ color: '#fcd34d', fontSize: 22 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '0.86rem' }}>Prøv Action</Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.76rem' }}>
                Gjør alt rett fra chatten — book Google Meet, be om opplasting, send til godkjenning. Trykk <strong>+</strong> eller skriv <strong>/</strong>.
              </Typography>
            </Box>
            <Button onClick={dismissSpotlight} size="small" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 36, color: 'rgba(226,232,240,0.8)' }}>Skjønner</Button>
          </Box>
        ) : null}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <IconButton
            aria-label="Åpne Action" onClick={(e) => openActionLauncher(e.currentTarget)} disabled={busyAction}
            sx={{ width: 46, height: 46, color: '#fff', borderRadius: 2, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', boxShadow: actionSpotlight ? '0 0 0 3px rgba(168,85,247,0.4)' : 'none', '&:hover': { background: 'linear-gradient(135deg,#6d28d9,#9333ea)' }, '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 } }}
          >
            {busyAction ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <ActionIcon />}
          </IconButton>
          <TextField
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              // Skriv «/» i tomt felt → åpne Action-launcheren.
              if (v === '/' && !draft) { const el = e.currentTarget.closest('.MuiBox-root') as HTMLElement | null; openActionLauncher((el ?? e.currentTarget) as HTMLElement); return; }
              setDraft(v);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSend(); }}
            placeholder={kind === 'request' ? 'Still et spørsmål … (eller / for Action)' : 'Skriv en melding … eller / for Action'}
            multiline maxRows={5} fullWidth size="small"
            sx={{ '& .MuiOutlinedInput-root': { color: '#f1f5f9', background: 'rgba(15,23,42,0.7)' } }}
          />
          <Button
            onClick={() => void handleSend()} disabled={sending || !draft.trim()}
            sx={{ minWidth: 0, minHeight: 46, px: 2, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' }, '&.Mui-disabled': { opacity: 0.5, color: '#fff' } }}
            aria-label="Send"
          >
            {sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon sx={{ fontSize: 20 }} />}
          </Button>
        </Stack>
        <Menu anchorEl={actionAnchor} open={Boolean(actionAnchor)} onClose={() => setActionAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }} transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          slotProps={{ paper: { sx: { background: '#0c0a18', border: '1px solid rgba(168,85,247,0.3)', minWidth: 280 } } }}>
          <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <InstantMeetIcon sx={{ color: '#fcd34d', fontSize: 18 }} />
            <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '0.82rem' }}>Action</Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem', ml: 'auto' }}>gjør det fra chatten</Typography>
          </Box>
          <MenuItem onClick={() => void startInstantMeet()}>
            <ListItemIcon><InstantMeetIcon sx={{ color: '#86efac' }} /></ListItemIcon>
            <ListItemText primary="Start Google Meet nå" secondary="Instant videomøte + del lenke" />
          </MenuItem>
          <MenuItem onClick={() => { setActionAnchor(null); setProposeOpen(true); }}>
            <ListItemIcon><ScheduleIcon sx={{ color: '#a5b4fc' }} /></ListItemIcon>
            <ListItemText primary="Foreslå & book møte" secondary="Velg tid → Google Meet" />
          </MenuItem>
          <MenuItem onClick={() => void requestUpload('brand_logo')}>
            <ListItemIcon><UploadIcon sx={{ color: '#7dd3fc' }} /></ListItemIcon>
            <ListItemText primary="Be om logo-opplasting" secondary="Lander i Merkevare på begge flater" />
          </MenuItem>
          <MenuItem onClick={() => void requestUpload('other')}>
            <ListItemIcon><UploadIcon sx={{ color: '#7dd3fc' }} /></ListItemIcon>
            <ListItemText primary="Be om fil-opplasting" secondary="Hvilken som helst fil → Materiale" />
          </MenuItem>
          <MenuItem onClick={() => void sendToApproval()}>
            <ListItemIcon><ApprovalIcon sx={{ color: '#f0abfc' }} /></ListItemIcon>
            <ListItemText primary="Send til godkjenning" secondary="Lander i Godkjenning-flaten" />
          </MenuItem>
          <Box sx={{ px: 2, pt: 0.75, pb: 0.25 }}>
            <Typography sx={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.64rem', fontWeight: 700, letterSpacing: 0.4 }}>KOMMER SNART</Typography>
          </Box>
          {[
            'Legg i Content Planner', 'Referer til leveranse/fil', 'Del budsjett med klient', 'Be om brief-svar', 'Send faktura', 'AI-utkast & oppsummering',
          ].map((label) => (
            <MenuItem key={label} disabled>
              <ListItemIcon><ActivityIcon sx={{ color: 'rgba(226,232,240,0.4)' }} /></ListItemIcon>
              <ListItemText primary={label} />
            </MenuItem>
          ))}
        </Menu>
      </Box>

      <Snackbar open={Boolean(toast)} autoHideDuration={3500} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Stack>
  );
}

function InlineUploadCard({ projectId, category, onUploaded }: { projectId: string; category: MaterialCategory; onUploaded: () => void }) {
  const [cat, setCat] = useState<MaterialCategory>(category);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onPick = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true); setPct(0);
    try {
      await uploadMaterialFile(projectId, file, cat, { onProgress: setPct });
      setDone(file.name);
      onUploaded();
    } catch { setDone(null); }
    finally { setBusy(false); }
  }, [projectId, cat, onUploaded]);

  if (done) {
    return (
      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.7, px: 1, py: 0.7, borderRadius: 1.5, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.28)' }}>
        <DoneIcon sx={{ fontSize: 16, color: '#6ee7b7' }} />
        <Typography sx={{ color: '#6ee7b7', fontSize: '0.78rem', fontWeight: 700 }}>{done} lastet opp — produsenten er varslet.</Typography>
      </Stack>
    );
  }
  return (
    <Box sx={{ mt: 0.7, p: 1, borderRadius: 1.5, border: '1px dashed rgba(124,211,252,0.4)', background: 'rgba(56,189,248,0.06)' }}>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" rowGap={0.75}>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <Select value={cat} onChange={(e) => setCat(e.target.value as MaterialCategory)} sx={{ color: '#f1f5f9', fontSize: '0.78rem', background: 'rgba(15,23,42,0.6)', '& .MuiSvgIcon-root': { color: 'rgba(226,232,240,0.6)' } }}>
            {MATERIAL_CATEGORIES.map((c) => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
          </Select>
        </FormControl>
        <Button onClick={() => inputRef.current?.click()} disabled={busy} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <UploadIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 40, color: '#082f49', background: 'linear-gradient(135deg,#7dd3fc,#38bdf8)', '&:hover': { background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)' } }}>
          {busy ? `Laster opp ${pct}%` : 'Last opp her'}
        </Button>
        <input ref={inputRef} type="file" hidden onChange={(e) => { void onPick(e.target.files); e.target.value = ''; }} />
      </Stack>
    </Box>
  );
}

function StatChip({ icon, label, tone }: { icon: React.ReactElement; label: string; tone: string }) {
  return (
    <Chip
      icon={icon} label={label} size="small"
      sx={{ height: 28, fontSize: '0.74rem', fontWeight: 700, color: tone, background: 'rgba(255,255,255,0.04)', border: `1px solid ${tone}40`, '& .MuiChip-icon': { color: `${tone} !important` } }}
    />
  );
}

function FeedRow({ it, projectId, onCloseRequest, onChanged }: { it: FeedItem; projectId: string; onCloseRequest: (id: string) => void; onChanged: () => void }) {
  const Icon = ICON_MAP[it.icon];
  const color = ICON_COLOR[it.icon];
  const isOpenRequest = it.kind === 'request' && it.status === 'open';
  const meetLink = typeof it.meta?.meetLink === 'string' ? it.meta.meetLink : null;
  const isMeeting = it.linkedEntityType === 'meeting' || it.action === 'meeting';
  return (
    <Box sx={{ borderRadius: 2, border: '1px solid rgba(148,163,184,0.14)', background: 'rgba(2,6,23,0.4)', p: 1.1, display: 'flex', gap: 1 }}>
      <Box sx={{ width: 32, height: 32, flexShrink: 0, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}1a` }}>
        <Icon sx={{ fontSize: 17, color }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
          <Typography sx={{ color: '#f1f5f9', fontSize: '0.85rem', fontWeight: 700 }}>{it.title}</Typography>
          {it.authorRole ? (
            <Chip label={it.authorRole === 'client_reviewer' ? 'Klient' : 'Produsent'} size="small" sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, color: 'rgba(226,232,240,0.7)', background: 'rgba(148,163,184,0.14)' }} />
          ) : null}
          {it.ts ? <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.7rem', ml: 'auto' }}>{fmtTime(it.ts)}</Typography> : null}
        </Stack>
        {it.body ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.82rem', mt: 0.3, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{it.body}</Typography>
        ) : null}

        {/* Handlings-kort: opplastings-forespørsel med ekte inline opplasting */}
        {it.action === 'request_upload' ? (
          <InlineUploadCard
            projectId={projectId}
            category={(typeof it.meta?.uploadCategory === 'string' ? it.meta.uploadCategory : 'other') as MaterialCategory}
            onUploaded={onChanged}
          />
        ) : null}

        {/* Handlings-kort: Google Meet «Bli med» */}
        {isMeeting && meetLink ? (
          <Button href={meetLink} target="_blank" rel="noopener" startIcon={<MeetingIcon />} size="small"
            sx={{ mt: 0.7, textTransform: 'none', fontWeight: 800, minHeight: 40, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)', '&:hover': { background: 'linear-gradient(135deg,#9333ea,#c026d3)' } }}>
            Bli med (Google Meet)
          </Button>
        ) : null}

        {it.kind === 'request' ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
            {isOpenRequest ? (
              <>
                <Chip icon={<PendingIcon sx={{ fontSize: 13, color: '#fbbf24 !important' }} />} label="Åpen forespørsel" size="small" sx={{ height: 20, fontSize: '0.64rem', fontWeight: 700, color: '#fbbf24', background: 'rgba(245,158,11,0.12)' }} />
                <Button onClick={() => onCloseRequest(it.id.replace(/^msg-/, ''))} size="small" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', minHeight: 32, color: '#86efac' }}>Marker som løst</Button>
              </>
            ) : (
              <Chip icon={<DoneIcon sx={{ fontSize: 13, color: '#86efac !important' }} />} label="Lukket" size="small" sx={{ height: 20, fontSize: '0.64rem', fontWeight: 700, color: '#86efac', background: 'rgba(16,185,129,0.12)' }} />
            )}
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
