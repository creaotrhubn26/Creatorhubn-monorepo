/**
 * ClientConversationView — Meldinger-fanen i Creative Sync Workspace
 * (producer-conversation-mockupen). Samlet klient-samtale: ekte meldinger
 * (role_room_messages) FLETTET med aktivitet (opplastinger, godkjenninger,
 * leveranser, møter) fra role_room_project_notifications — én tidslinje med
 * komposer, status-chips og forespørsel-håndtering. Delt produsent↔klient.
 * Responsiv (stables på mobil/iPad), WCAG, 44px touch.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, TextField, Chip, CircularProgress, Snackbar, ToggleButtonGroup, ToggleButton,
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
} from '@mui/icons-material';
import { listMessages, sendMessage, updateMessage, type RoleRoomMessage } from '../../services/roleRoomMessagesApi';
import { producerWorkflowService, type ProducerProjectNotification } from '../../services/producerWorkflowService';

type FeedItem = {
  id: string;
  ts: number;
  kind: 'message' | 'request' | 'activity';
  title: string;
  body: string | null;
  author: string | null;
  authorRole: string | null;
  status?: string;
  icon: 'message' | 'request' | 'upload' | 'approval' | 'delivery' | 'meeting' | 'activity';
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
      items.push({
        id: `msg-${m.id}`, ts, kind: m.kind === 'request' ? 'request' : 'message',
        title: m.kind === 'request' ? 'Forespørsel' : (m.authorName || (m.authorRole === 'client_reviewer' ? 'Klient' : 'Produsent')),
        body: m.body, author: m.authorName, authorRole: m.authorRole,
        status: m.kind === 'request' ? m.status : undefined,
        icon: m.kind === 'request' ? 'request' : 'message',
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
                {dayItems.map((it) => <FeedRow key={it.id} it={it} onCloseRequest={closeRequest} />)}
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
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSend(); }}
            placeholder={kind === 'request' ? 'Still klienten/produsenten et spørsmål…' : 'Skriv en melding…'}
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
      </Box>

      <Snackbar open={Boolean(toast)} autoHideDuration={3500} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Stack>
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

function FeedRow({ it, onCloseRequest }: { it: FeedItem; onCloseRequest: (id: string) => void }) {
  const Icon = ICON_MAP[it.icon];
  const color = ICON_COLOR[it.icon];
  const isOpenRequest = it.kind === 'request' && it.status === 'open';
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
