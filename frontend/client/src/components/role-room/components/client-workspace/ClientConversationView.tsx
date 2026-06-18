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
  Dialog, DialogTitle, DialogContent, Tabs, Tab, ListItemButton,
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
  LinkOutlined as ReferenceIcon,
  DownloadOutlined as DownloadIcon,
  InsertDriveFileOutlined as FileIcon,
  PaidOutlined as BudgetIcon,
  AssignmentOutlined as BriefIcon,
  AutoAwesomeOutlined as AiIcon,
  SummarizeOutlined as SummaryIcon,
  EditCalendarOutlined as ContentPlanActionIcon,
} from '@mui/icons-material';
import { listMessages, sendMessage, updateMessage, aiAssist, type RoleRoomMessage } from '../../services/roleRoomMessagesApi';
import { producerWorkflowService, type ProducerProjectNotification } from '../../services/producerWorkflowService';
import { createMeeting, listMeetings, type RoleRoomMeeting } from '../../services/roleRoomMeetingsApi';
import { createContentPlanItem } from '../../services/roleRoomContentPlanApi';
import { uploadMaterialFile, MATERIAL_CATEGORIES, listMaterials, downloadMaterialFile, type MaterialCategory, type RoleRoomMaterial } from '../../services/roleRoomMaterialsApi';
import { listDeliverables, updateDeliverable, type RoleRoomDeliverable } from '../../services/roleRoomDeliverablesApi';

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
  visibility?: 'shared' | 'internal';
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

export default function ClientConversationView({ projectId, canUseInternal = false }: { projectId: string; canUseInternal?: boolean }) {
  const [messages, setMessages] = useState<RoleRoomMessage[]>([]);
  const [notifications, setNotifications] = useState<ProducerProjectNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<'shared' | 'internal'>('shared');
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
      // Rom-filter: vis meldinger som hører til valgt rom (delt vs internt).
      const mv = m.visibility === 'internal' ? 'internal' : 'shared';
      if (mv !== room) continue;
      const ts = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      const action = typeof m.metadata?.action === 'string' ? m.metadata.action : undefined;
      items.push({
        id: `msg-${m.id}`, messageId: m.id, ts, kind: m.kind === 'request' ? 'request' : 'message',
        title: m.kind === 'request' ? 'Forespørsel' : (m.authorName || (m.authorRole === 'client_reviewer' ? 'Klient' : 'Produsent')),
        body: m.body, author: m.authorName, authorRole: m.authorRole,
        status: m.kind === 'request' ? m.status : undefined,
        icon: action === 'request_upload' ? 'upload' : (m.linkedEntityType === 'meeting' || action === 'meeting') ? 'meeting' : m.kind === 'request' ? 'request' : 'message',
        action, meta: m.metadata, linkedEntityType: m.linkedEntityType, linkedEntityId: m.linkedEntityId,
        visibility: mv,
      });
    }
    // Aktivitet (opplastinger/godkjenninger osv.) hører til det delte rommet.
    if (room === 'shared') for (const n of notifications) {
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
  }, [messages, notifications, room]);

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
      await sendMessage(projectId, { body, kind, visibility: room });
      setDraft('');
      setToast(room === 'internal' ? 'Intern melding sendt (klienten ser den ikke).' : kind === 'request' ? 'Forespørsel sendt — motparten varslet.' : 'Melding sendt.');
      await load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Kunne ikke sende.');
    } finally {
      setSending(false);
    }
  }, [projectId, draft, kind, room, load]);

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

  // Del budsjett: publiser alle upubliserte budsjettlinjer til klienten (bygger
  // på publiser-synken) + post melding. Produsent-only.
  const shareBudget = useCallback(async () => {
    setBusyAction(true); setActionAnchor(null);
    try {
      const items = await producerWorkflowService.getEconomyItems(projectId);
      const drafts = items.filter((i) => !i.published_at);
      let ok = 0;
      for (const d of drafts) {
        try { await producerWorkflowService.publishEconomyItem(projectId, d.id, true); ok += 1; } catch { /* fortsett */ }
      }
      await sendMessage(projectId, {
        body: ok > 0 ? `Jeg delte budsjettet med deg (${ok} ${ok === 1 ? 'linje' : 'linjer'} publisert).` : 'Budsjettet er delt med deg.',
        metadata: { action: 'budget_shared' },
      });
      setToast(ok > 0 ? `Publiserte ${ok} budsjettlinje${ok === 1 ? '' : 'r'} til klienten.` : 'Budsjettet er allerede delt.');
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke dele budsjett.'); }
    finally { setBusyAction(false); }
  }, [projectId, load]);

  // Be om brief-svar: forespørsel-melding som peker klienten til Brief-fanen.
  const requestBriefInput = useCallback(async () => {
    setBusyAction(true); setActionAnchor(null);
    try {
      await sendMessage(projectId, {
        body: 'Kan du fylle ut / svare på prosjektbriefen? Du finner den under «Brief».',
        kind: 'request',
        linkedEntityType: 'client_intake',
        metadata: { action: 'brief_request', refKind: 'brief', refLabel: 'Brief' },
      });
      setToast('Brief-forespørsel sendt til klienten.');
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke be om brief-svar.'); }
    finally { setBusyAction(false); }
  }, [projectId, load]);

  // Legg i Content Planner: gjør samtale-tekst/idé til en planlagt post.
  const addToContentPlanner = useCallback(async () => {
    setBusyAction(true); setActionAnchor(null);
    try {
      const title = draft.trim() || 'Post fra samtale';
      const item = await createContentPlanItem(projectId, { title, source: 'chat' });
      await sendMessage(projectId, {
        body: `La «${title}» i Content Planner.`,
        linkedEntityType: 'content_plan', linkedEntityId: item.id,
        metadata: { action: 'content_plan', refLabel: title },
      });
      setDraft('');
      setToast('Lagt i Content Planner — sett dato/plattform der.');
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke legge i Content Planner.'); }
    finally { setBusyAction(false); }
  }, [projectId, draft, load]);

  // AI-utkast / oppsummering → fyller komposeren (ingenting sendes auto).
  const runAiAssist = useCallback(async (mode: 'draft' | 'summary') => {
    setBusyAction(true); setActionAnchor(null);
    try {
      const text = await aiAssist(projectId, mode);
      setDraft(mode === 'summary' ? `Oppsummering:\n${text}` : text);
      setToast('AI-forslag lagt i meldingsfeltet — rediger og send.');
    } catch (e) { setToast(e instanceof Error ? e.message : 'AI er ikke tilgjengelig akkurat nå.'); }
    finally { setBusyAction(false); }
  }, [projectId]);

  // Referer til hva som helst (leveranse/fil/møte) → referanse-kort i tråden.
  const [refOpen, setRefOpen] = useState(false);
  const [refTab, setRefTab] = useState(0);
  const [refLoading, setRefLoading] = useState(false);
  const [refDeliverables, setRefDeliverables] = useState<RoleRoomDeliverable[]>([]);
  const [refMaterials, setRefMaterials] = useState<RoleRoomMaterial[]>([]);
  const [refMeetings, setRefMeetings] = useState<RoleRoomMeeting[]>([]);

  const openReferencePicker = useCallback(async () => {
    setActionAnchor(null); setRefOpen(true); setRefLoading(true);
    const [d, m, mt] = await Promise.allSettled([
      listDeliverables(projectId), listMaterials(projectId), listMeetings(projectId),
    ]);
    if (d.status === 'fulfilled') setRefDeliverables(d.value);
    if (m.status === 'fulfilled') setRefMaterials(m.value);
    if (mt.status === 'fulfilled') setRefMeetings(mt.value);
    setRefLoading(false);
  }, [projectId]);

  const pickReference = useCallback(async (
    entityType: 'deliverable' | 'material' | 'meeting', entityId: string, label: string, extra?: Record<string, unknown>,
  ) => {
    setRefOpen(false); setBusyAction(true);
    try {
      await sendMessage(projectId, {
        body: `Referer til: ${label}`,
        linkedEntityType: entityType, linkedEntityId: entityId,
        metadata: { action: 'reference', refKind: entityType, refLabel: label, ...(extra ?? {}) },
      });
      await load();
    } catch (e) { setToast(e instanceof Error ? e.message : 'Kunne ikke referere.'); }
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
  const openActionLauncher = useCallback((anchor: HTMLElement) => { setActionAnchor(anchor); dismissSpotlight(); setActionQuery(''); }, [dismissSpotlight]);

  // Cmd/Ctrl+K åpner Action hvor som helst i samtalen.
  const actionBtnRef = useRef<HTMLButtonElement | null>(null);
  const [actionQuery, setActionQuery] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (actionBtnRef.current) { setActionAnchor(actionBtnRef.current); setActionQuery(''); dismissSpotlight(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissSpotlight]);

  // Intent-deteksjon: foreslå «book møte» når brukeren snakker om møte.
  const meetingIntent = useMemo(() => /\bmøte\b|\bmøtes\b|\bta en prat\b|\bvideo\b|\bringe?\b|\bcall\b/i.test(draft) && draft.trim().length > 6, [draft]);

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

      {/* Rom-velger (kun produsent): Med klient vs Internt team */}
      {canUseInternal ? (
        <ToggleButtonGroup
          value={room} exclusive size="small"
          onChange={(_, v) => { if (v) setRoom(v); }}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', minHeight: 38, px: 1.5, color: 'rgba(226,232,240,0.7)', borderColor: 'rgba(148,163,184,0.25)' },
            '& .MuiToggleButton-root.Mui-selected': { color: '#fff' },
            '& [value=shared].Mui-selected': { background: 'rgba(16,185,129,0.22)' },
            '& [value=internal].Mui-selected': { background: 'rgba(245,158,11,0.22)' } }}
        >
          <ToggleButton value="shared"><ApprovalIcon sx={{ fontSize: 15, mr: 0.5 }} />Med klient</ToggleButton>
          <ToggleButton value="internal"><PendingIcon sx={{ fontSize: 15, mr: 0.5 }} />Internt team</ToggleButton>
        </ToggleButtonGroup>
      ) : null}

      {/* Internt-banner — umiskjennelig at klienten ikke ser dette */}
      {canUseInternal && room === 'internal' ? (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 1.25, py: 0.9, borderRadius: 1.5, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)' }}>
          <PendingIcon sx={{ fontSize: 17, color: '#fbbf24' }} />
          <Typography sx={{ color: '#fcd34d', fontSize: '0.8rem', fontWeight: 700 }}>Internt team — klienten ser ikke dette rommet.</Typography>
        </Stack>
      ) : null}

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
        <Stack spacing={1.5} alignItems="center" sx={{ py: 3 }}>
          <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.85rem', textAlign: 'center' }}>
            Ingen aktivitet ennå. Skriv en melding, eller prøv en <strong style={{ color: '#c4b5fd' }}>Action</strong>:
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
            <Chip clickable onClick={() => { setProposeOpen(true); }} icon={<ScheduleIcon sx={{ fontSize: 15, color: '#a5b4fc !important' }} />} label="Book møte" sx={{ height: 32, fontWeight: 700, color: '#e2e8f0', background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(168,85,247,0.35)' }} />
            <Chip clickable onClick={() => void requestUpload('brand_logo')} icon={<UploadIcon sx={{ fontSize: 15, color: '#7dd3fc !important' }} />} label="Be om logo" sx={{ height: 32, fontWeight: 700, color: '#e2e8f0', background: 'rgba(56,189,248,0.14)', border: '1px solid rgba(56,189,248,0.32)' }} />
            <Chip clickable onClick={() => void sendToApproval()} icon={<ApprovalIcon sx={{ fontSize: 15, color: '#f0abfc !important' }} />} label="Send til godkjenning" sx={{ height: 32, fontWeight: 700, color: '#e2e8f0', background: 'rgba(240,171,252,0.14)', border: '1px solid rgba(240,171,252,0.32)' }} />
          </Stack>
        </Stack>
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
        {meetingIntent && !proposeOpen ? (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            <Chip
              clickable onClick={() => setProposeOpen(true)}
              icon={<InstantMeetIcon sx={{ fontSize: 15, color: '#fcd34d !important' }} />}
              label="Book møte?"
              sx={{ height: 30, fontWeight: 700, color: '#fcd34d', background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.4)' }}
            />
            <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.72rem' }}>Action foreslår: planlegg et Google Meet</Typography>
          </Stack>
        ) : null}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <IconButton
            ref={actionBtnRef}
            aria-label="Åpne Action (Cmd+K)" onClick={(e) => openActionLauncher(e.currentTarget)} disabled={busyAction}
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
            <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem', ml: 'auto' }}>⌘K · gjør det fra chatten</Typography>
          </Box>
          <Box sx={{ px: 1.5, pb: 0.75 }}>
            <TextField
              autoFocus value={actionQuery} onChange={(e) => setActionQuery(e.target.value)}
              placeholder="Søk handling …" size="small" fullWidth
              sx={{ '& .MuiOutlinedInput-root': { color: '#f1f5f9', background: 'rgba(15,23,42,0.6)', fontSize: '0.82rem' } }}
            />
          </Box>
          {[
            { q: 'start google meet nå instant video', icon: <InstantMeetIcon sx={{ color: '#86efac' }} />, primary: 'Start Google Meet nå', secondary: 'Instant videomøte + del lenke', run: () => void startInstantMeet() },
            { q: 'foreslå book møte tid kalender', icon: <ScheduleIcon sx={{ color: '#a5b4fc' }} />, primary: 'Foreslå & book møte', secondary: 'Velg tid → Google Meet', run: () => { setActionAnchor(null); setProposeOpen(true); } },
            { q: 'be om logo opplasting merkevare', icon: <UploadIcon sx={{ color: '#7dd3fc' }} />, primary: 'Be om logo-opplasting', secondary: 'Lander i Merkevare på begge flater', run: () => void requestUpload('brand_logo') },
            { q: 'be om fil opplasting materiale', icon: <UploadIcon sx={{ color: '#7dd3fc' }} />, primary: 'Be om fil-opplasting', secondary: 'Hvilken som helst fil → Materiale', run: () => void requestUpload('other') },
            { q: 'send til godkjenning approval review', icon: <ApprovalIcon sx={{ color: '#f0abfc' }} />, primary: 'Send til godkjenning', secondary: 'Lander i Godkjenning-flaten', run: () => void sendToApproval() },
            { q: 'referer til leveranse fil møte video godkjenn', icon: <ReferenceIcon sx={{ color: '#fcd34d' }} />, primary: 'Referer til …', secondary: 'Leveranse, fil eller møte → klikkbart kort', run: () => void openReferencePicker() },
            // Produsent-only handlinger (vises kun når canUseInternal).
            { q: 'ai utkast svar forslag claude', icon: <AiIcon sx={{ color: '#22d3ee' }} />, primary: 'AI: foreslå svar', secondary: 'Claude skriver et utkast i feltet', run: () => void runAiAssist('draft') },
            { q: 'ai oppsummer sammendrag hva venter', icon: <SummaryIcon sx={{ color: '#22d3ee' }} />, primary: 'AI: oppsummer samtalen', secondary: 'Hva er status / hva venter på meg', run: () => void runAiAssist('summary') },
            // Produsent-only handlinger (vises kun når canUseInternal).
            ...(canUseInternal ? [
              { q: 'del budsjett økonomi publiser klient', icon: <BudgetIcon sx={{ color: '#86efac' }} />, primary: 'Del budsjett med klient', secondary: 'Publiser budsjettlinjer → klientens Økonomi', run: () => void shareBudget() },
              { q: 'be om brief svar intake', icon: <BriefIcon sx={{ color: '#a5b4fc' }} />, primary: 'Be om brief-svar', secondary: 'Forespørsel → klientens Brief-fane', run: () => void requestBriefInput() },
              { q: 'legg i content planner post planlegg publiser', icon: <ContentPlanActionIcon sx={{ color: '#f0abfc' }} />, primary: 'Legg i Content Planner', secondary: 'Gjør idé → planlagt post (sett dato der)', run: () => void addToContentPlanner() },
            ] : []),
          ].filter((a) => !actionQuery || `${a.primary} ${a.q}`.toLowerCase().includes(actionQuery.toLowerCase())).map((a) => (
            <MenuItem key={a.primary} onClick={a.run}>
              <ListItemIcon>{a.icon}</ListItemIcon>
              <ListItemText primary={a.primary} secondary={a.secondary} />
            </MenuItem>
          ))}
          <Box sx={{ px: 2, pt: 0.75, pb: 0.25 }}>
            <Typography sx={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.64rem', fontWeight: 700, letterSpacing: 0.4 }}>KOMMER SNART</Typography>
          </Box>
          {[
            'Send faktura',
          ].map((label) => (
            <MenuItem key={label} disabled>
              <ListItemIcon><ActivityIcon sx={{ color: 'rgba(226,232,240,0.4)' }} /></ListItemIcon>
              <ListItemText primary={label} />
            </MenuItem>
          ))}
        </Menu>
      </Box>

      {/* Referanse-picker */}
      <Dialog open={refOpen} onClose={() => setRefOpen(false)} fullWidth maxWidth="sm"
        slotProps={{ paper: { sx: { background: '#0c0a18', border: '1px solid rgba(168,85,247,0.3)', color: '#e2e8f0' } } }}>
        <DialogTitle sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '1rem' }}>Referer til …</DialogTitle>
        <DialogContent>
          <Tabs value={refTab} onChange={(_, v) => setRefTab(v)} variant="fullWidth"
            sx={{ mb: 1, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, color: 'rgba(226,232,240,0.6)' }, '& .Mui-selected': { color: '#c4b5fd !important' }, '& .MuiTabs-indicator': { background: '#a855f7' } }}>
            <Tab label={`Leveranser (${refDeliverables.length})`} />
            <Tab label={`Filer (${refMaterials.length})`} />
            <Tab label={`Møter (${refMeetings.length})`} />
          </Tabs>
          {refLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} sx={{ color: '#a855f7' }} /></Box>
          ) : (
            <Stack spacing={0.5} sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {refTab === 0 && refDeliverables.map((d) => (
                <ListItemButton key={d.id} onClick={() => void pickReference('deliverable', d.id, d.title, { status: d.status })} sx={{ borderRadius: 1.5 }}>
                  <ListItemIcon><DeliveryIcon sx={{ color: '#f0abfc' }} /></ListItemIcon>
                  <ListItemText primary={d.title} secondary={d.format ?? d.status} />
                </ListItemButton>
              ))}
              {refTab === 1 && refMaterials.map((m) => (
                <ListItemButton key={m.id} onClick={() => void pickReference('material', m.id, m.originalName ?? m.title, { originalName: m.originalName })} sx={{ borderRadius: 1.5 }}>
                  <ListItemIcon><FileIcon sx={{ color: '#7dd3fc' }} /></ListItemIcon>
                  <ListItemText primary={m.originalName ?? m.title} secondary={m.entryType} />
                </ListItemButton>
              ))}
              {refTab === 2 && refMeetings.map((mt) => (
                <ListItemButton key={mt.id} onClick={() => void pickReference('meeting', mt.id, mt.title, { meetLink: mt.meetLink })} sx={{ borderRadius: 1.5 }}>
                  <ListItemIcon><MeetingIcon sx={{ color: '#a5b4fc' }} /></ListItemIcon>
                  <ListItemText primary={mt.title} secondary={mt.startsAt ? new Date(mt.startsAt).toLocaleString('nb-NO') : 'Ikke planlagt'} />
                </ListItemButton>
              ))}
              {((refTab === 0 && refDeliverables.length === 0) || (refTab === 1 && refMaterials.length === 0) || (refTab === 2 && refMeetings.length === 0)) ? (
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.82rem', py: 2, textAlign: 'center' }}>Ingenting her ennå.</Typography>
              ) : null}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={3500} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Stack>
  );
}

function ReferenceDeliverableCard({ projectId, id, label, onChanged }: { projectId: string; id: string; label: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const approve = useCallback(async () => {
    setBusy(true);
    try { await updateDeliverable(projectId, id, { status: 'delivered' }); setApproved(true); onChanged(); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }, [projectId, id, onChanged]);
  return (
    <Box sx={{ mt: 0.7, p: 1, borderRadius: 1.5, border: '1px solid rgba(240,171,252,0.3)', background: 'rgba(240,171,252,0.06)', display: 'flex', alignItems: 'center', gap: 1 }}>
      <DeliveryIcon sx={{ fontSize: 18, color: '#f0abfc', flexShrink: 0 }} />
      <Typography sx={{ color: '#f1f5f9', fontSize: '0.82rem', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Typography>
      {approved ? (
        <Stack direction="row" spacing={0.4} alignItems="center"><DoneIcon sx={{ fontSize: 15, color: '#6ee7b7' }} /><Typography sx={{ color: '#6ee7b7', fontSize: '0.74rem', fontWeight: 700 }}>Godkjent</Typography></Stack>
      ) : (
        <Button onClick={() => void approve()} disabled={busy} startIcon={busy ? <CircularProgress size={13} color="inherit" /> : <ApprovalIcon sx={{ fontSize: 16 }} />} size="small"
          sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, fontSize: '0.76rem', minHeight: 38, color: '#fff', background: 'linear-gradient(135deg,#a855f7,#d946ef)' }}>
          Godkjenn
        </Button>
      )}
    </Box>
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

        {/* Referanse-kort: leveranse → Godkjenn, fil → Last ned */}
        {it.linkedEntityType === 'deliverable' && it.linkedEntityId ? (
          <ReferenceDeliverableCard projectId={projectId} id={it.linkedEntityId} label={String(it.meta?.refLabel ?? 'Leveranse')} onChanged={onChanged} />
        ) : null}
        {it.linkedEntityType === 'material' && it.linkedEntityId ? (
          <Button
            onClick={() => void downloadMaterialFile({ id: it.linkedEntityId, projectId, originalName: String(it.meta?.originalName ?? it.meta?.refLabel ?? 'fil'), title: String(it.meta?.refLabel ?? 'fil') } as RoleRoomMaterial)}
            startIcon={<DownloadIcon />} size="small"
            sx={{ mt: 0.7, textTransform: 'none', fontWeight: 700, minHeight: 40, color: '#082f49', background: 'linear-gradient(135deg,#7dd3fc,#38bdf8)' }}>
            Last ned fil
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
