// @ts-nocheck
/**
 * WorkspaceChatPanel — Team Chat (høyre panel), dark CreatorHub.
 *
 * GJENBRUKER den eksisterende kanal-chatten i communication-routes.ts:
 *   - kanal-id = `project-<projectId>` (communication_channels.id tar vilkårlig streng)
 *   - GET  /api/communication/messages/project-<id>  → { messages: [{ id, senderId, senderName, content, timestamp, attachments, tag }] }
 *   - POST /api/chat/messages { conversationId, content, senderId, senderName, metadata:{senderName,tag}, attachments }
 * senderName + tag lagres i metadata (kolonnen har ikke egne felter) og eksponeres av GET.
 * Vedlegg lastes opp via /api/upload/image (same-origin B2). Lett poll (15s, pauset når skjult).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, Typography, Avatar, IconButton, TextField, CircularProgress, Chip, Popover, Menu, MenuItem, Tooltip, InputAdornment } from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import { wsConfirm, wsPrompt, WsModal } from './ui';

// Guidene lastes kun når modal åpnes (samme innhold som /guide/chat og
// /guide/actions — sidene finnes fortsatt for dyplenking).
const ChatGuideLazy = React.lazy(() => import('@/pages/chat-guide'));
const ActionsGuideLazy = React.lazy(() => import('@/pages/chat-actions-guide'));
import Search from '@mui/icons-material/Search';
import PeopleAlt from '@mui/icons-material/PeopleAlt';
import MoreVert from '@mui/icons-material/MoreVert';
import PushPin from '@mui/icons-material/PushPin';
import Send from '@mui/icons-material/Send';
import AttachFile from '@mui/icons-material/AttachFile';
import AlternateEmail from '@mui/icons-material/AlternateEmail';
import EmojiEmotions from '@mui/icons-material/EmojiEmotions';
import TipsAndUpdates from '@mui/icons-material/TipsAndUpdates';
import HelpOutline from '@mui/icons-material/HelpOutline';
import PriorityHigh from '@mui/icons-material/PriorityHigh';
import Close from '@mui/icons-material/Close';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Refresh from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import PlaylistAddCheck from '@mui/icons-material/PlaylistAddCheck';
import LinkIcon from '@mui/icons-material/Link';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Summarize from '@mui/icons-material/Summarize';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import MusicNote from '@mui/icons-material/MusicNote';
import MovieOutlined from '@mui/icons-material/MovieOutlined';
import EventOutlined from '@mui/icons-material/EventOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import WorkOutline from '@mui/icons-material/WorkOutline';
import OpenInNew from '@mui/icons-material/OpenInNew';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import CloudDone from '@mui/icons-material/CloudDone';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent, Tabs, Tab, ListItemButton, Snackbar, Button, FormControl, Select, Checkbox, FormControlLabel, ToggleButtonGroup, ToggleButton } from '@mui/material';
import Lock from '@mui/icons-material/Lock';
import Public from '@mui/icons-material/Public';
import { useLocation } from 'wouter';
import { apiRequest, getAuthHeader, buildApiUrl } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { ws } from './workspaceTheme';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from './wsLocale';
import { useWorkspaceUpdate } from './WorkspaceContext';

// Lokal no/en-ordbok for panelet (samme mønster som OppdragTab).
const T: WsDict = {
  channelProduction: { no: '# Produksjon', en: '# Production' },
  emptyChat: { no: 'Ingen meldinger ennå. Skriv den første for å samkjøre teamet 👋', en: 'No messages yet. Write the first one to get the team in sync 👋' },
  sendFailed: { no: 'Kunne ikke sende meldingen. Prøv igjen.', en: 'Could not send the message. Try again.' },
  uploadFailed: { no: 'Kunne ikke laste opp vedlegget.', en: 'Could not upload the attachment.' },
  composerPlaceholder: { no: 'Skriv melding til teamet…', en: 'Write a message to the team…' },
  chipUpdate: { no: 'Oppdatering', en: 'Update' },
  chipQuestion: { no: 'Spørsmål', en: 'Question' },
  chipImportant: { no: 'Viktig', en: 'Important' },
  search: { no: 'Søk i meldinger', en: 'Search messages' },
  searchPlaceholder: { no: 'Søk…', en: 'Search…' },
  noMatches: { no: 'Ingen meldinger matcher søket.', en: 'No messages match your search.' },
  members: { no: 'Deltakere', en: 'Participants' },
  emoji: { no: 'Sett inn emoji', en: 'Insert emoji' },
  mention: { no: 'Nevn noen', en: 'Mention someone' },
  attach: { no: 'Legg ved bilde', en: 'Attach image' },
  moreActions: { no: 'Flere valg', en: 'More options' },
  jumpToLatest: { no: 'Hopp til nyeste', en: 'Jump to latest' },
  refresh: { no: 'Oppdater', en: 'Refresh' },
  guide: { no: 'Hjelp / guide', en: 'Help / guide' },
  actionsGuide: { no: 'Om handlinger', en: 'About actions' },
  pinFilterOn: { no: 'Vis kun viktige', en: 'Show important only' },
  pinFilterOff: { no: 'Vis alle meldinger', en: 'Show all messages' },
  send: { no: 'Send melding', en: 'Send message' },
  removeAttachment: { no: 'Fjern vedlegg', en: 'Remove attachment' },
  clearTag: { no: 'Fjern merkelapp', en: 'Clear tag' },
  errForbidden: { no: 'Du har ikke tilgang til denne kanalen.', en: 'You do not have access to this channel.' },
  errAuth: { no: 'Økten er utløpt — logg inn på nytt.', en: 'Session expired — sign in again.' },
  errGeneric: { no: 'Kunne ikke sende meldingen.', en: 'Could not send the message.' },
  retry: { no: 'Prøv igjen', en: 'Retry' },
  loadOlder: { no: 'Last eldre meldinger', en: 'Load older messages' },
  today: { no: 'I dag', en: 'Today' },
  yesterday: { no: 'I går', en: 'Yesterday' },
  typing: { no: 'skriver …', en: 'is typing …' },
  edited: { no: 'redigert', en: 'edited' },
  editMsg: { no: 'Rediger melding', en: 'Edit message' },
  deleteMsg: { no: 'Slett melding', en: 'Delete message' },
  deleteConfirm: { no: 'Slette meldingen?', en: 'Delete this message?' },
  newSinceLabel: { no: 'nye', en: 'new' },
  clearSearch: { no: 'Tøm søket', en: 'Clear search' },
  you: { no: 'Deg', en: 'You' },
  title: { no: 'Team Chat', en: 'Team Chat' },
  attachmentFallback: { no: 'vedlegg', en: 'attachment' },
  emojiPrefix: { no: 'Emoji', en: 'Emoji' },
  messagesRegion: { no: 'Meldinger', en: 'Messages' },
  // Action-launcher
  action: { no: 'Handling', en: 'Action' },
  actionOpen: { no: 'Åpne handlinger (Ctrl+K)', en: 'Open actions (Ctrl+K)' },
  actionSearch: { no: 'Søk handling …', en: 'Search action …' },
  actionHint: { no: 'gjør det fra chatten', en: 'do it from chat' },
  aNewTask: { no: 'Ny oppgave på board', en: 'New task on board' },
  aNewTaskSub: { no: 'Lag en crew-oppgave fra chatten', en: 'Create a crew task from chat' },
  aReference: { no: 'Referer til …', en: 'Reference …' },
  aReferenceSub: { no: 'Låt, leveranse eller økt → klikkbart kort', en: 'Song, deliverable or session → card' },
  aRequestUpload: { no: 'Be om opplasting', en: 'Request an upload' },
  aRequestUploadMusic: { no: 'Be om lydfil', en: 'Request an audio file' },
  aRequestUploadVisual: { no: 'Be om RAW/utvalg', en: 'Request RAW / selects' },
  aRequestUploadVendor: { no: 'Be om kildefiler', en: 'Request source files' },
  aRequestUploadSub: { no: 'Motparten laster opp rett i tråden', en: 'They upload right in the thread' },
  aAiSummary: { no: 'AI: oppsummer samtalen', en: 'AI: summarize the chat' },
  aAiSummarySub: { no: 'Hva er status / hva venter', en: 'Status / what is pending' },
  aAiDraft: { no: 'AI: foreslå melding', en: 'AI: draft a message' },
  aAiDraftSub: { no: 'Claude skriver et utkast i feltet', en: 'Claude drafts in the field' },
  aMeeting: { no: 'Planlegg møte', en: 'Schedule a meeting' },
  aMeetingVisual: { no: 'Planlegg opptaksdag', en: 'Schedule a shoot day' },
  aMeetingService: { no: 'Nytt møte', en: 'New meeting' },
  aMeetingSub: { no: 'Book tid + generer Google Meet → kort i tråden', en: 'Book time + generate Google Meet → card' },
  meetTitleField: { no: 'Tittel', en: 'Title' },
  genMeet: { no: 'Generer Google Meet-lenke', en: 'Generate Google Meet link' },
  meetCreate: { no: 'Book & del', en: 'Book & share' },
  joinMeet: { no: 'Bli med (Google Meet)', en: 'Join (Google Meet)' },
  aApproval: { no: 'Send til kundegodkjenning', en: 'Send for client approval' },
  aApprovalSub: { no: 'Velg en leveranse → godkjenn-kort i tråden', en: 'Pick a deliverable → approve card' },
  approvalPick: { no: 'Send til godkjenning', en: 'Send for approval' },
  approve: { no: 'Godkjenn', en: 'Approve' },
  approved: { no: 'Godkjent', en: 'Approved' },
  awaitingApproval: { no: 'Venter godkjenning', en: 'Awaiting approval' },
  // Forespørsel
  openRequest: { no: 'Åpen forespørsel', en: 'Open request' },
  resolved: { no: 'Løst', en: 'Resolved' },
  markResolved: { no: 'Marker som løst', en: 'Mark as resolved' },
  unanswered: { no: 'ubesvart', en: 'unanswered' },
  // Kort/dialoger
  refPick: { no: 'Referer til …', en: 'Reference …' },
  refSongs: { no: 'Låter', en: 'Songs' },
  refMedia: { no: 'Media', en: 'Media' },
  refJobs: { no: 'Oppdrag', en: 'Jobs' },
  refDeliverables: { no: 'Leveranser', en: 'Deliverables' },
  refSessions: { no: 'Økter', en: 'Sessions' },
  roomTeam: { no: 'Team', en: 'Team' },
  roomShared: { no: 'Delt', en: 'Shared' },
  sharedBanner: { no: 'Delt-rom — dette er synlig for klienten.', en: 'Shared room — visible to the client.' },
  emptyShared: { no: 'Ingen delte meldinger ennå. Det du sender her er synlig for klienten.', en: 'No shared messages yet. What you send here is visible to the client.' },
  actNew: { no: 'Ny', en: 'New' },
  actDeliverable: { no: 'leveranse', en: 'deliverable' },
  actTask: { no: 'oppgave', en: 'task' },
  actTrack: { no: 'låt oppdatert', en: 'song updated' },
  actMeeting: { no: 'møte planlagt', en: 'meeting scheduled' },
  actJob: { no: 'oppdrag', en: 'job' },
  refEmpty: { no: 'Ingenting her ennå.', en: 'Nothing here yet.' },
  taskTitle: { no: 'Ny oppgave', en: 'New task' },
  taskName: { no: 'Hva skal gjøres?', en: 'What needs doing?' },
  taskCreate: { no: 'Legg til på board', en: 'Add to board' },
  cancel: { no: 'Avbryt', en: 'Cancel' },
  uploadHere: { no: 'Last opp her', en: 'Upload here' },
  openIn: { no: 'Åpne', en: 'Open' },
  aiInserted: { no: 'AI-forslag lagt i feltet — rediger og send.', en: 'AI suggestion added — edit and send.' },
  taskAdded: { no: 'Oppgave lagt på board.', en: 'Task added to board.' },
  uploadRequested: { no: 'Du kan laste opp her:', en: 'You can upload here:' },
};

// Trygg å rendre som <img>/<a href>? Tillat kun same-origin relativ sti (våre
// opplastinger → /api/showcase-media/…) og inline data:image (ingen nettverk/
// skript). Blokker eksterne http(s) (sporing), javascript:/vbscript: (XSS) og
// data:text/html. Alt annet vises som ren tekst.
const isSafeMediaUrl = (u) => {
  if (typeof u !== 'string' || !u) return false;
  if (/^\s*(javascript|vbscript):/i.test(u)) return false;
  if (/^data:image\//i.test(u)) return true;
  if (/^\s*data:/i.test(u)) return false;
  return /^\/[^/]/.test(u) && !/[\s<>"'\\]/.test(u);
};
// Maskér e-post i visningsnavn-fallback (viser ikke kollegers adresse i klartekst).
const maskId = (s) => { const v = String(s || ''); const at = v.indexOf('@'); return at > 0 ? `${v.slice(0, at)}` : v; };

const EMOJIS = ['👍', '🙌', '🎧', '🎤', '🔥', '✅', '❤️', '😄', '🎸', '🥁', '🎹', '🎶', '👏', '🙏', '💡', '⏱️', '📌', '⚡'];

const initials = (s) => String(s || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

const TAG_META = {
  update: { icon: <TipsAndUpdates sx={{ fontSize: 14 }} />, dictKey: 'chipUpdate', color: ws.accent, soft: ws.accentSoft, border: ws.accentBorder },
  question: { icon: <HelpOutline sx={{ fontSize: 14 }} />, dictKey: 'chipQuestion', color: ws.green, soft: ws.greenSoft, border: 'rgba(52,211,153,0.42)' },
  important: { icon: <PriorityHigh sx={{ fontSize: 14 }} />, dictKey: 'chipImportant', color: ws.red, soft: ws.redSoft, border: 'rgba(248,113,113,0.42)' },
};

const WorkspaceChatPanel: React.FC<{ projectId: string; category?: string }> = ({ projectId, category = 'music' }) => {
  const { user } = useAuth();
  // Utenlandske partner-vendors får engelsk UI — locale fra WsLocaleProvider.
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const channelId = `project-${projectId}`;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [guideOpen, setGuideOpen] = useState<null | 'chat' | 'actions'>(null);
  const [retryFn, setRetryFn] = useState<null | (() => void)>(null);
  const humanErr = (e: any) => {
    const m = String(e?.message || e || '');
    if (/403|forbidden/i.test(m)) return t('errForbidden');
    if (/401|unauthorized/i.test(m)) return t('errAuth');
    return t('errGeneric');
  };
  const endRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const myId = user?.email || user?.id || 'me';
  const myName = user?.firstName || user?.name || myId;

  // Interaktiv tilstand for de utbygde knappene.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [room, setRoom] = useState('team'); // 'team' (internt) | 'shared' (delt m/ klient)
  const [activity, setActivity] = useState([]); // prosjekt-hendelser flettet inn i tidslinjen
  const [tag, setTag] = useState(null); // merkelapp for neste melding
  const [pending, setPending] = useState([]); // vedlegg som venter på å sendes
  const [uploading, setUploading] = useState(false);
  const [membersAnchor, setMembersAnchor] = useState(null);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [mentionMode, setMentionMode] = useState(false); // members-popover brukes til @mention
  // Action-launcher + kort
  const [, navigate] = useLocation();
  const [toast, setToast] = useState('');
  const [actionAnchor, setActionAnchor] = useState(null);
  const [actionQuery, setActionQuery] = useState('');
  const [busyAction, setBusyAction] = useState(false);
  const actionBtnRef = useRef(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [taskRole, setTaskRole] = useState('begge');
  const [refOpen, setRefOpen] = useState(false);
  const [refTab, setRefTab] = useState(0);
  const [refLoading, setRefLoading] = useState(false);
  const [refSources, setRefSources] = useState([]); // [{key,label,icon,kind,route,items}]
  const [meetOpen, setMeetOpen] = useState(false);
  const [meetTitle, setMeetTitle] = useState('');
  const [meetDate, setMeetDate] = useState('');
  const [meetTime, setMeetTime] = useState('14:00');
  const [genMeet, setGenMeet] = useState(true);
  const [apprOpen, setApprOpen] = useState(false);
  const [apprLoading, setApprLoading] = useState(false);
  const [apprItems, setApprItems] = useState([]);
  // Team-flagg for auto-huk av shot-listen (delt m/ Capture-appen via
  // projects.settings.shotListAutoCheck). null = ukjent enda.
  const [shotAutoCheck, setShotAutoCheck] = useState(null);
  const [autoCheckBusy, setAutoCheckBusy] = useState(false);
  const captureRelevant = ['foto', 'photo', 'photography', 'film', 'video', 'commercial'].includes(String(category));

  // Respekter prefers-reduced-motion (CSS dekker ikke JS-drevet smooth-scroll).
  const scrollDown = () => requestAnimationFrame(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });
  // Er brukeren allerede nederst? Da (og bare da) auto-scroller vi ved nye
  // meldinger — ellers stjeler pollet leseposisjonen når man leser historikk.
  const atBottom = () => { const el = listRef.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 80; };

  const load = async (initial = false) => {
    try {
      const r = await apiRequest(`/api/communication/messages/${encodeURIComponent(channelId)}?limit=100`);
      const next = Array.isArray(r?.messages) ? r.messages : [];
      const wasAtBottom = atBottom();
      const lastId = next.length ? next[next.length - 1].id : null;
      setMessages((prev) => {
        const prevLast = prev.length ? prev[prev.length - 1].id : null;
        // Ny melding = siste id endret seg (robust selv når kanalen står på taket).
        if (initial || (lastId !== prevLast && wasAtBottom)) scrollDown();
        return next;
      });
    } catch { /* sekundær */ } finally { if (initial) setLoading(false); }
  };
  // Delt/Team-bytte og vindu-fokus henter ferskt — 15s-pollen alene lot
  // Delt-fanen stå tom til neste tick når meldinger kom inn fra andre
  // flater (kunde-svar via galleriet, API, andre faner).
  useEffect(() => {
    if (!loading) load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);
  useEffect(() => {
    const onFocus = () => load(false);
    const onVis = () => { if (!document.hidden) load(false); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Uleste: lagre «sist lest» per kanal (leses også av shell-badgen).
  const markRead = (msgs: any[]) => {
    try {
      const last = msgs.length ? msgs[msgs.length - 1].timestamp : null;
      if (last && !document.hidden) localStorage.setItem('chat-lastread-' + channelId, String(last));
    } catch { /* */ }
  };
  const [olderBusy, setOlderBusy] = useState(false);
  const loadOlder = async () => {
    if (olderBusy || messages.length === 0) return;
    setOlderBusy(true);
    try {
      const before = messages[0]?.timestamp;
      const r = await apiRequest(`/api/communication/messages/${encodeURIComponent(channelId)}?limit=100&before=${encodeURIComponent(before)}`);
      const older = Array.isArray(r?.messages) ? r.messages : [];
      if (older.length) setMessages((prev) => [...older, ...prev]);
      setHasOlder(older.length >= 100);
    } catch { /* */ } finally { setOlderBusy(false); }
  };
  const [hasOlder, setHasOlder] = useState(false);
  useEffect(() => { setHasOlder(messages.length >= 100); markRead(messages); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [messages]);

  // «X skriver …» + live-refetch via bruker-events-WS (chat.message/chat.typing).
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimer = useRef<any>(null);
  const realtimeDebounce = useRef<any>(null);
  const lastTypingSent = useRef(0);
  const sendTyping = () => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    apiRequest('/api/chat/typing', { method: 'POST', body: { conversationId: channelId } }).catch(() => {});
  };
  useWorkspaceUpdate(projectId, ['chat.message', 'chat.typing'], (event: any) => {
    if (!event || event.channelId !== channelId) return;
    if (event.kind === 'chat.message') {
      clearTimeout(realtimeDebounce.current);
      realtimeDebounce.current = setTimeout(() => load(false), 200);
    }
    if (event.kind === 'chat.typing') {
      setTypingName(event.name || null);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingName(null), 3500);
    }
  });
  useEffect(() => () => {
    clearTimeout(realtimeDebounce.current);
    clearTimeout(typingTimer.current);
  }, [channelId]);

  const reactToMsg = (id: string, emoji: string) => {
    apiRequest(`/api/chat/messages/${encodeURIComponent(id)}/reactions`, { method: 'POST', body: { emoji } })
      .then(() => load(false)).catch(() => {});
  };
  const editMsg = async (m: any) => {
    const next = await wsPrompt(t('editMsg'), m.content || '');
    if (next == null || !next.trim() || next === m.content) return;
    try { await apiRequest(`/api/chat/messages/${encodeURIComponent(m.id)}`, { method: 'PATCH', body: { content: next.trim() } }); load(false); }
    catch (e) { setErr(humanErr(e)); setRetryFn(null); }
  };
  const deleteMsg = async (m: any) => {
    if (!(await wsConfirm(t('deleteConfirm')))) return;
    try { await apiRequest(`/api/chat/messages/${encodeURIComponent(m.id)}`, { method: 'DELETE' }); load(false); }
    catch (e) { setErr(humanErr(e)); setRetryFn(null); }
  };

  // Prosjekt-hendelser (leveranser, oppgaver, møter, låter, oppdrag) flettes
  // inn i tidslinjen så chatten blir prosjektets puls.
  const loadActivity = React.useCallback(() => apiRequest(`/api/projects/${projectId}/activity`).then((d) => setActivity(Array.isArray(d?.activity) ? d.activity : [])).catch(() => setActivity([])), [projectId]);

  // Hent team-flagget for shot-list auto-huk (kun for foto/film-prosjekter).
  useEffect(() => {
    if (!captureRelevant) return;
    apiRequest(`/api/projects/${projectId}/capture-settings`)
      .then((d) => setShotAutoCheck(d?.shotListAutoCheck !== false))
      .catch(() => { /* degraderer stille — menyvalget skjules */ });
  }, [projectId, captureRelevant]);

  useEffect(() => {
    load(true); loadActivity();
    const iv = setInterval(() => { if (!document.hidden) { load(false); loadActivity(); } }, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Deltakere utledes fra avsenderne i kanalen (ingen egen tabell nødvendig).
  // Profilbilder: e-post/navn → avatar-URL fra team/members (lettvekts-rute;
  // meldinger bærer bare senderId/senderName, aldri bildet selv).
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  useEffect(() => {
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team/members`)
      .then((r: any) => {
        const map: Record<string, string> = {};
        const put = (key?: string | null, url?: string | null) => { if (key && url) map[String(key).toLowerCase()] = url; };
        if (r?.owner) { put(r.owner.email, r.owner.avatarUrl); put(r.owner.name, r.owner.avatarUrl); }
        for (const m of (Array.isArray(r?.members) ? r.members : [])) { put(m.email, m.avatarUrl); put(m.name, m.avatarUrl); }
        setAvatarMap(map);
      })
      .catch(() => {});
  }, [projectId]);
  const avatarFor = (senderId?: string | null, senderName?: string | null) =>
    avatarMap[String(senderId || '').toLowerCase()] || avatarMap[String(senderName || '').toLowerCase()] || undefined;

  const participants = useMemo(() => {
    const seen = new Map();
    for (const m of messages) {
      const id = String(m.senderId || '');
      if (!id || seen.has(id)) continue;
      seen.set(id, { id, name: m.senderName || maskId(id), mine: id.toLowerCase() === String(myId).toLowerCase() });
    }
    if (!seen.has(String(myId))) seen.set(String(myId), { id: String(myId), name: myName, mine: true });
    return [...seen.values()];
  }, [messages, myId, myName]);

  // Tidslinje: meldinger (rom-filtrert) + prosjekt-aktivitet, sortert på tid.
  // Rom: Team viser internt (+ default), Delt viser kun shared-meldinger.
  // Aktivitet vises i Team-rommet (arbeidskontekst), skjult ved søk/pin.
  const visFor = (m) => m.metadata?.visibility || 'internal';
  const feed = useMemo(() => {
    const q = query.trim().toLowerCase();
    const msgs = messages.filter((m) => {
      if (room === 'shared' ? visFor(m) !== 'shared' : visFor(m) === 'shared') return false;
      if (pinnedOnly && m.tag !== 'important') return false;
      if (q) { const hay = `${m.content || ''} ${m.senderName || m.senderId || ''}`.toLowerCase(); if (!hay.includes(q)) return false; }
      return true;
    }).map((m) => ({ _t: 'msg', ts: m.timestamp ? new Date(m.timestamp).getTime() : 0, m }));
    const acts = (room === 'team' && !q && !pinnedOnly)
      ? activity.map((a) => ({ _t: 'act', ts: a.ts ? new Date(a.ts).getTime() : 0, a })).filter((x) => x.ts)
      : [];
    return [...msgs, ...acts].sort((a, b) => a.ts - b.ts);
  }, [messages, activity, query, pinnedOnly, room]);

  const insertAtCursor = (snippet) => {
    const el = inputRef.current;
    setText((prev) => {
      if (!el || el.selectionStart == null) return prev + snippet;
      const s = el.selectionStart, e = el.selectionEnd;
      const nextVal = prev.slice(0, s) + snippet + prev.slice(e);
      requestAnimationFrame(() => { try { el.focus(); const pos = s + snippet.length; el.setSelectionRange(pos, pos); } catch { /* */ } });
      return nextVal;
    });
  };

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true); setErr('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const headers = await getAuthHeader(); delete headers['Content-Type'];
      const isImage = String(file.type || '').startsWith('image/');
      const res = await fetch(buildApiUrl(isImage ? '/api/upload/image' : '/api/upload/file'), { method: 'POST', headers, body: fd });
      if (!res.ok) { setErr(t('uploadFailed')); return; }
      const { url } = await res.json();
      if (!url) { setErr(t('uploadFailed')); return; }
      setPending((p) => [...p, { filename: file.name.slice(0, 120) || 'fil', downloadUrl: url, mimeType: file.type || 'application/octet-stream', fileSize: file.size || 1 }]);
    } catch { setErr(t('uploadFailed')); } finally { setUploading(false); }
  };

  const send = async () => {
    const content = text.trim();
    // Ikke send mens en opplasting pågår — ellers ryker vedlegget (pending er
    // fortsatt tomt, og bildet havner på neste melding).
    if ((!content && pending.length === 0) || sending || uploading) return;
    setSending(true); setErr('');
    try {
      await apiRequest('/api/chat/messages', {
        method: 'POST',
        body: {
          conversationId: channelId, content, senderId: myId, senderName: myName,
          metadata: { senderName: myName, ...(tag ? { tag } : {}), ...(room === 'shared' ? { visibility: 'shared' } : {}) },
          ...(pending.length ? { attachments: pending } : {}),
        },
      });
      setText(''); setTag(null); setPending([]);
      await load(false); scrollDown();
    } catch (e) { setErr(humanErr(e)); setRetryFn(() => send); } finally { setSending(false); }
  };

  // ── Handlinger fra chatten («Action») ────────────────────────────────────
  // Poster en melding med strukturert metadata.action som rendres som et kort.
  const postAction = async (content, meta) => {
    await apiRequest('/api/chat/messages', { method: 'POST', body: {
      conversationId: channelId, content, senderId: myId, senderName: myName,
      metadata: { senderName: myName, ...meta },
    } });
    await load(false); scrollDown();
  };
  const resolveRequest = async (id) => {
    try { await apiRequest(`/api/communication/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'resolved' } }); await load(false); }
    catch { setToast(t('sendFailed')); }
  };
  // Eier/lead slår auto-huk av shot-listen på/av for teamet. Capture-appen
  // leser samme flagg → iPad-en slutter/gjenopptar å hake av shots automatisk.
  // PUT-en er eier-gated i backend (403 → vis melding). Poster et systemvarsel
  // så teamet ser endringen i chatten.
  const toggleShotAutoCheck = async () => {
    const next = !shotAutoCheck;
    setAutoCheckBusy(true);
    try {
      await apiRequest(`/api/projects/${projectId}/capture-settings`, { method: 'PUT', body: { shotListAutoCheck: next, updatedBy: myName } });
      setShotAutoCheck(next);
      await postAction(next ? `✅ ${myName} slo på auto-huk av shot-listen` : `⏸️ ${myName} slo av auto-huk av shot-listen`, { action: 'system', system: true });
    } catch (e) {
      const msg = String(e?.message || '');
      setToast(/403|not_owner/.test(msg) ? 'Kun prosjekteier kan endre auto-huk' : (e?.message || t('sendFailed')));
    } finally { setAutoCheckBusy(false); setMoreAnchor(null); }
  };
  const runAi = async (mode) => {
    setActionAnchor(null); setBusyAction(true);
    try {
      const r = await apiRequest(`/api/communication/${encodeURIComponent(channelId)}/ai`, { method: 'POST', body: { mode } });
      if (r?.text) { setText(mode === 'summary' ? `${r.text}` : r.text); setToast(t('aiInserted')); requestAnimationFrame(() => inputRef.current?.focus()); }
    } catch (e) { setToast(e?.message || t('sendFailed')); } finally { setBusyAction(false); }
  };
  const createTask = async () => {
    const title = taskName.trim(); if (!title) return;
    setBusyAction(true);
    try {
      const task = await apiRequest(`/api/projects/${projectId}/board-tasks`, { method: 'POST', body: { title, crewRole: taskRole } });
      await postAction(`📋 ${title}`, { action: 'task', refKind: 'oppgaver', refLabel: title, linkedEntityId: task?.id });
      setTaskOpen(false); setTaskName(''); setToast(t('taskAdded'));
    } catch (e) { setToast(e?.message || t('sendFailed')); } finally { setBusyAction(false); }
  };
  // Referanse-kilder er KATEGORI-bevisste: musikk viser Låter, visual viser
  // Media, alle viser Leveranser + Økter. Hver kilde normaliseres til
  // {id, primary, secondary} så pickeren rendrer uniformt.
  const REF_CATALOG = {
    track: { key: 'track', label: t('refSongs'), icon: <MusicNote sx={{ fontSize: 17, color: ws.accent }} />, kind: 'track', ep: `/api/projects/${projectId}/easeverse-tracks`, map: (r) => (r?.tracks || []).map((x) => ({ id: x.id, primary: x.title, secondary: [x.artist, x.status].filter(Boolean).join(' · ') })) },
    media: { key: 'media', label: t('refMedia'), icon: <PhotoLibraryOutlined sx={{ fontSize: 17, color: '#7dd3fc' }} />, kind: 'media', ep: `/api/projects/${projectId}/media`, map: (r) => (r?.assets || []).slice(0, 60).map((x) => ({ id: x.id, primary: x.filename || 'fil', secondary: x.state || '' })) },
    deliverable: { key: 'deliverable', label: t('refDeliverables'), icon: <MovieOutlined sx={{ fontSize: 17, color: '#f0abfc' }} />, kind: 'deliverable', ep: `/api/projects/${projectId}/deliverables`, map: (r) => (r?.deliverables || []).map((x) => ({ id: x.id, primary: x.title, secondary: [x.type, x.status].filter(Boolean).join(' · ') })) },
    session: { key: 'session', label: t('refSessions'), icon: <EventOutlined sx={{ fontSize: 17, color: '#a5b4fc' }} />, kind: 'session', ep: `/api/projects/${projectId}/avtaler`, map: (r) => (r?.meetings || []).map((x) => ({ id: x.id, primary: x.title || 'Økt', secondary: x.scheduledAt ? new Date(x.scheduledAt).toLocaleString(wsDateLocale(locale)) : '' })) },
    oppdrag: { key: 'oppdrag', label: t('refJobs'), icon: <WorkOutline sx={{ fontSize: 17, color: '#fbbf24' }} />, kind: 'oppdrag', ep: `/api/projects/${projectId}/editing-jobs`, map: (r) => (r?.jobs || []).map((x) => ({ id: x.id, primary: x.vendorName || (x.services || [])[0] || 'Oppdrag', secondary: [(x.services || []).join(', '), x.status].filter(Boolean).join(' · ') })) },
  };
  const REF_KEYS_BY_CAT = { music: ['track', 'deliverable', 'session'], visual: ['media', 'deliverable', 'session'], service: ['deliverable', 'session'], vendor: ['oppdrag', 'deliverable', 'session'] };
  const openRefPicker = async () => {
    setActionAnchor(null); setRefOpen(true); setRefLoading(true); setRefTab(0);
    const keys = REF_KEYS_BY_CAT[category] || ['deliverable', 'session'];
    const sources = keys.map((k) => REF_CATALOG[k]);
    const loaded = await Promise.allSettled(sources.map((s) => apiRequest(s.ep)));
    setRefSources(sources.map((s, i) => ({ ...s, items: loaded[i].status === 'fulfilled' ? s.map(loaded[i].value) : [] })));
    setRefLoading(false);
  };
  const pickReference = async (refKind, id, label) => {
    setRefOpen(false); setBusyAction(true);
    try { await postAction(`🔗 ${label}`, { action: 'reference', refKind, refLabel: label, linkedEntityId: id }); }
    catch { setToast(t('sendFailed')); } finally { setBusyAction(false); }
  };
  const requestUpload = async () => {
    setActionAnchor(null); setBusyAction(true);
    try { await postAction(t('uploadRequested'), { action: 'request_upload' }); }
    catch { setToast(t('sendFailed')); } finally { setBusyAction(false); }
  };
  const createMeeting = async () => {
    if (!meetDate) { setToast(t('sendFailed')); return; }
    setBusyAction(true);
    try {
      const [h, mm] = (meetTime || '14:00').split(':');
      const start = new Date(`${meetDate}T${(h || '14').padStart(2, '0')}:${(mm || '00').padStart(2, '0')}:00`);
      const mt = await apiRequest(`/api/projects/${projectId}/meetings`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: { title: meetTitle.trim() || t('aMeeting'), scheduledAt: start.toISOString(), durationMinutes: 60, generateMeet: genMeet } });
      const when = start.toLocaleString(wsDateLocale(locale), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      await postAction(`📅 ${mt?.title || meetTitle.trim()} · ${when}`, { action: 'meeting', refKind: 'meeting', refLabel: mt?.title || meetTitle.trim(), linkedEntityId: mt?.id, meetLink: mt?.meetLink || null });
      setMeetOpen(false); setMeetTitle(''); setMeetDate('');
    } catch (e) { setToast(e?.message || t('sendFailed')); } finally { setBusyAction(false); }
  };
  // Send til kundegodkjenning: velg leveranse → godkjenn-kort. «Godkjenn»
  // markerer leveransen som levert (ekte status) og lukker godkjenn-kortet.
  const openApprovalPicker = async () => {
    setActionAnchor(null); setApprOpen(true); setApprLoading(true);
    try { const r = await apiRequest(`/api/projects/${projectId}/deliverables`); setApprItems((r?.deliverables || []).filter((d) => !['delivered', 'completed', 'archived'].includes(d.status))); }
    catch { setApprItems([]); } finally { setApprLoading(false); }
  };
  const sendForApproval = async (id, title) => {
    setApprOpen(false); setBusyAction(true);
    try { await postAction(`✅ ${title}`, { action: 'approval', refKind: 'deliverable', refLabel: title, linkedEntityId: id, status: 'pending' }); }
    catch { setToast(t('sendFailed')); } finally { setBusyAction(false); }
  };
  const approveDeliverable = async (m) => {
    const id = m.metadata?.linkedEntityId; if (!id) return;
    setBusyAction(true);
    try {
      await apiRequest(`/api/projects/${projectId}/deliverables/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'delivered' } });
      await apiRequest(`/api/communication/messages/${encodeURIComponent(m.id)}`, { method: 'PATCH', body: { status: 'resolved' } });
      await load(false);
    } catch { setToast(t('sendFailed')); } finally { setBusyAction(false); }
  };
  // Cmd/Ctrl+K åpner Action.
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); if (actionBtnRef.current) { setActionAnchor(actionBtnRef.current); setActionQuery(''); } } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Referanse-/oppgave-kort → naviger til riktig fane.
  const REF_ROUTE = { track: 'laater', song: 'laater', media: 'media', deliverable: 'leveranser', oppgaver: 'oppgaver', oppdrag: 'oppdrag' };
  // Møter/økter havner i Sesjoner for musikk, ellers i Avtaler (crm_meetings).
  const gotoRef = (refKind) => {
    const seg = (refKind === 'session' || refKind === 'meeting') ? (category === 'music' ? 'sesjoner' : 'avtaler') : (REF_ROUTE[refKind] || 'oversikt');
    navigate(`/workspace/${projectId}/${seg}`);
  };

  // Åpne forespørsler (tag=Spørsmål, ikke løst) — «X ubesvart».
  const openRequests = useMemo(() => messages.filter((m) => m.tag === 'question' && m.metadata?.status !== 'resolved').length, [messages]);

  const tagBtn = (key) => {
    const meta = TAG_META[key]; const active = tag === key;
    return (
      <Chip key={key} size="small" icon={meta.icon} label={t(meta.dictKey)} onClick={() => setTag(active ? null : key)}
        variant={active ? 'filled' : 'outlined'} aria-pressed={active}
        sx={{ cursor: 'pointer', flexShrink: 0, color: active ? meta.color : ws.textDim, bgcolor: active ? meta.soft : 'transparent', borderColor: active ? meta.border : ws.border, '& .MuiChip-icon': { color: active ? meta.color : ws.textDim } }} />
    );
  };

  const renderAttachments = (atts) => (atts || []).filter((a) => a?.downloadUrl).map((a, i) => {
    const name = a.filename || t('attachmentFallback');
    // Kun same-origin opplastinger rendres som bilde/lenke — eksterne og
    // farlige URL-er (javascript:/data:/tracking-piksler) vises som ren tekst.
    const safe = isSafeMediaUrl(a.downloadUrl);
    const isImg = /^image\//.test(a.mimeType || '') || /\.(png|jpe?g|gif|webp|avif)$/i.test(a.filename || '');
    if (!safe) {
      return <Typography key={i} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontSize: 12, color: ws.textDim }}><AttachFile sx={{ fontSize: 14 }} /> {name}</Typography>;
    }
    return isImg ? (
      <Box key={i} component="a" href={a.downloadUrl} target="_blank" rel="noopener" sx={{ display: 'block', mt: 0.5 }}>
        <Box component="img" src={a.downloadUrl} alt={name} loading="lazy" sx={{ maxWidth: 220, maxHeight: 180, borderRadius: 1.5, border: `1px solid ${ws.border}` }} />
      </Box>
    ) : (
      <Box key={i} component="a" href={a.downloadUrl} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontSize: 12, color: ws.accent }}>
        <AttachFile sx={{ fontSize: 14 }} /> {name}
      </Box>
    );
  });

  const REF_ICON = { track: <MusicNote sx={{ fontSize: 15 }} />, song: <MusicNote sx={{ fontSize: 15 }} />, media: <PhotoLibraryOutlined sx={{ fontSize: 15 }} />, deliverable: <MovieOutlined sx={{ fontSize: 15 }} />, session: <EventOutlined sx={{ fontSize: 15 }} />, oppgaver: <PlaylistAddCheck sx={{ fontSize: 15 }} />, oppdrag: <WorkOutline sx={{ fontSize: 15 }} /> };
  // Aktivitets-rad: prosjekt-hendelser flettet inn i tidslinjen (leveranse,
  // oppgave, låt, møte, oppdrag). Kompakt, dempet, klikkbar → riktig fane.
  const ACT_META = {
    deliverable: { icon: <MovieOutlined sx={{ fontSize: 14 }} />, color: '#f0abfc', kind: 'deliverable', verb: t('actDeliverable') },
    task: { icon: <PlaylistAddCheck sx={{ fontSize: 14 }} />, color: ws.green, kind: 'oppgaver', verb: t('actTask') },
    track: { icon: <MusicNote sx={{ fontSize: 14 }} />, color: ws.accent, kind: 'track', verb: t('actTrack') },
    meeting: { icon: <EventOutlined sx={{ fontSize: 14 }} />, color: '#a5b4fc', kind: 'meeting', verb: t('actMeeting') },
    job: { icon: <WorkOutline sx={{ fontSize: 14 }} />, color: '#fbbf24', kind: 'oppdrag', verb: t('actJob') },
  };
  const renderActivity = (a) => {
    const meta = ACT_META[a.type] || ACT_META.task;
    return (
      <Box key={a.id} onClick={() => gotoRef(meta.kind)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gotoRef(meta.kind); } }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.6, borderRadius: 2, cursor: 'pointer', border: `1px dashed ${ws.border}`, bgcolor: 'rgba(255,255,255,0.02)', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
        <Box sx={{ color: meta.color, display: 'flex' }}>{meta.icon}</Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 11.5, color: ws.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Box component="span" sx={{ color: ws.textDim, fontWeight: 500 }}>{t('actNew')} {meta.verb}: </Box>{a.title}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 10, color: ws.textFaint, flexShrink: 0 }}>{a.ts ? new Date(a.ts).toLocaleTimeString(wsDateLocale(locale), { hour: '2-digit', minute: '2-digit' }) : ''}</Typography>
      </Box>
    );
  };
  // Interaktivt kort utledet av metadata.action.
  const renderCard = (m) => {
    const meta = m.metadata || {};
    const act = meta.action;
    if (act === 'reference' || act === 'task') {
      return (
        <Box onClick={() => gotoRef(meta.refKind)} sx={{ mt: 0.5, px: 1, py: 0.75, borderRadius: 2, cursor: 'pointer', bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}`, display: 'inline-flex', alignItems: 'center', gap: 0.75, maxWidth: '100%' }}>
          <Box sx={{ color: ws.accent, display: 'flex' }}>{REF_ICON[meta.refKind] || <LinkIcon sx={{ fontSize: 15 }} />}</Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ws.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.refLabel || t('openIn')}</Typography>
          <OpenInNew sx={{ fontSize: 13, color: ws.textDim }} />
        </Box>
      );
    }
    if (act === 'request_upload') {
      return (
        <Button onClick={() => fileRef.current?.click()} startIcon={<AttachFile sx={{ fontSize: 16 }} />} size="small"
          sx={{ mt: 0.5, textTransform: 'none', fontWeight: 700, color: ws.accentContrast, bgcolor: ws.accent, '&:hover': { bgcolor: ws.accentHover }, borderRadius: 2 }}>{t('uploadHere')}</Button>
      );
    }
    if (act === 'approval') {
      const done = meta.status === 'resolved';
      return (
        <Box sx={{ mt: 0.5, px: 1, py: 0.75, borderRadius: 2, bgcolor: done ? ws.greenSoft : 'rgba(240,171,252,0.1)', border: `1px solid ${done ? ws.greenSoft : 'rgba(240,171,252,0.32)'}`, display: 'inline-flex', alignItems: 'center', gap: 0.75, maxWidth: '100%' }}>
          <MovieOutlined sx={{ fontSize: 15, color: done ? ws.green : '#f0abfc' }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ws.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.refLabel}</Typography>
          {done ? (
            <Chip size="small" icon={<CheckCircleOutline sx={{ fontSize: 13, color: `${ws.green} !important` }} />} label={t('approved')} sx={{ height: 20, fontSize: 10.5, fontWeight: 700, color: ws.green, bgcolor: 'transparent' }} />
          ) : (
            <Button onClick={() => approveDeliverable(m)} disabled={busyAction} startIcon={<CheckCircleOutline sx={{ fontSize: 15 }} />} size="small"
              sx={{ ml: 0.5, textTransform: 'none', fontWeight: 700, fontSize: 11.5, minHeight: 26, color: ws.accentContrast, bgcolor: ws.green, '&:hover': { bgcolor: '#2bb673' }, borderRadius: 1.5 }}>{t('approve')}</Button>
          )}
        </Box>
      );
    }
    if (act === 'meeting') {
      return (
        <Stack spacing={0.5} sx={{ mt: 0.5 }} alignItems="flex-start">
          <Box onClick={() => gotoRef('meeting')} sx={{ px: 1, py: 0.75, borderRadius: 2, cursor: 'pointer', bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}`, display: 'inline-flex', alignItems: 'center', gap: 0.75, maxWidth: '100%' }}>
            <EventOutlined sx={{ fontSize: 15, color: ws.accent }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ws.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta.refLabel}</Typography>
            <OpenInNew sx={{ fontSize: 13, color: ws.textDim }} />
          </Box>
          {typeof meta.meetLink === 'string' && /^https:\/\/(meet\.google\.com|[\w-]+\.meet\.google\.com)\//i.test(meta.meetLink) && (
            <Button component="a" href={meta.meetLink} target="_blank" rel="noopener" startIcon={<EventOutlined sx={{ fontSize: 15 }} />} size="small"
              sx={{ textTransform: 'none', fontWeight: 700, color: ws.accentContrast, bgcolor: ws.green, '&:hover': { bgcolor: '#2bb673' }, borderRadius: 2 }}>{t('joinMeet')}</Button>
          )}
        </Stack>
      );
    }
    return null;
  };
  // ── Shot-oppdaterings-kort (auto-huk fra Capture-appen) ──
  // Leser strukturert metadata.shotUpdate (fra iPad-en) med fallback til å
  // parse «📸 Ole tok: A, B · Neste: X»-teksten. Kortet oppdateres in-place
  // fordi iPad-en re-poster samme melding-id mens flere bilder tas.
  const parseShotUpdate = (m) => {
    const su = m?.metadata?.shotUpdate;
    if (su && Array.isArray(su.scenes) && su.scenes.length) {
      return {
        who: su.who || m.senderName || 'Fotograf',
        scenes: su.scenes,
        next: Array.isArray(su.next) ? su.next : [],
        count: su.count || su.scenes.length,
        backup: typeof su.backup === 'number' ? su.backup : 1,
        thumbs: Array.isArray(su.thumbs) ? su.thumbs : [],
      };
    }
    const c = m?.content || '';
    if (!c.startsWith('📸 ')) return null;
    let body = c.slice(2).trim();
    let next = [];
    const ni = body.indexOf(' · Neste: ');
    if (ni >= 0) { next = body.slice(ni + ' · Neste: '.length).split(',').map((s) => s.trim()).filter(Boolean); body = body.slice(0, ni); }
    const ti = body.indexOf(' tok: ');
    if (ti < 0) return null;
    const who = body.slice(0, ti).trim();
    const scenes = body.slice(ti + ' tok: '.length).split(',').map((s) => s.trim()).filter(Boolean);
    if (!who || !scenes.length) return null;
    return { who, scenes, next, count: scenes.length, backup: 1 };
  };
  const renderShotCard = (m) => {
    const su = parseShotUpdate(m);
    if (!su) return null;
    // Ekte thumbnails: stabile /assets/:id/preview-URL-er fra metadata (fra
    // Capture-appen), med fallback til bilde-vedlegg.
    const imgs = (su.thumbs && su.thumbs.length)
      ? su.thumbs.map((tb) => ({ downloadUrl: tb.url, filename: tb.caption || '' }))
      : (m.attachments || []).filter((a) => String(a.mimeType || '').startsWith('image'));
    const secured = su.backup >= 1;
    const pct = Math.round((su.backup || 0) * 100);
    return (
      <Box sx={{ mt: 0.5, p: 1.25, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.04)', border: `1px solid ${ws.greenSoft}`, width: '100%', maxWidth: 340 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: ws.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PhotoCamera sx={{ fontSize: 16, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: ws.text }}>{su.who} tok {su.count} {su.count === 1 ? 'bilde' : 'bilder'}</Typography>
            <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>Auto-huket på shot-listen</Typography>
          </Box>
          {secured ? (
            <Chip size="small" icon={<CloudDone sx={{ fontSize: 13, color: `${ws.green} !important` }} />} label="Sikret" sx={{ height: 22, fontSize: 10.5, fontWeight: 700, color: ws.green, bgcolor: ws.greenSoft }} />
          ) : (
            <Chip size="small" label={`${pct}%`} sx={{ height: 22, fontSize: 10.5, fontWeight: 800, color: ws.accent, bgcolor: ws.accentSoft }} />
          )}
        </Stack>
        {imgs.length > 0 && (
          <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
            {imgs.slice(0, 4).map((a, i) => (
              <Box key={i} component="img" src={a.downloadUrl} alt={a.filename || ''} sx={{ width: 60, height: 60, borderRadius: 1.5, objectFit: 'cover', border: `1px solid ${ws.border}` }} />
            ))}
          </Stack>
        )}
        <Stack spacing={0.4} sx={{ mt: 1 }}>
          {su.scenes.map((s, i) => (
            <Stack key={i} direction="row" spacing={0.75} alignItems="center">
              <CheckCircleOutline sx={{ fontSize: 15, color: ws.green }} />
              <Typography sx={{ fontSize: 12.5, color: ws.text }}>{s}</Typography>
            </Stack>
          ))}
        </Stack>
        {su.next.length > 0 && (
          <Box sx={{ mt: 1, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}`, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ArrowForwardIcon sx={{ fontSize: 14, color: ws.accent }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Neste: {su.next.join(', ')}</Typography>
          </Box>
        )}
      </Box>
    );
  };
  // Forespørsel-status (tag=Spørsmål): åpen med «Marker som løst», eller «Løst».
  const renderRequest = (m) => {
    if (m.tag !== 'question') return null;
    const done = m.metadata?.status === 'resolved';
    return (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
        {done ? (
          <Chip size="small" icon={<CheckCircleOutline sx={{ fontSize: 13, color: `${ws.green} !important` }} />} label={t('resolved')} sx={{ height: 20, fontSize: 10.5, fontWeight: 700, color: ws.green, bgcolor: ws.greenSoft }} />
        ) : (
          <>
            <Chip size="small" label={t('openRequest')} sx={{ height: 20, fontSize: 10.5, fontWeight: 700, color: ws.green, bgcolor: ws.greenSoft }} />
            <Button onClick={() => resolveRequest(m.id)} size="small" sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, minHeight: 28, color: ws.green }}>{t('markResolved')}</Button>
          </>
        )}
      </Stack>
    );
  };

  const uploadLabel = category === 'music' ? t('aRequestUploadMusic') : category === 'visual' ? t('aRequestUploadVisual') : category === 'vendor' ? t('aRequestUploadVendor') : t('aRequestUpload');
  const meetingLabel = category === 'visual' ? t('aMeetingVisual') : category === 'service' ? t('aMeetingService') : t('aMeeting');
  const ACTIONS = [
    { q: 'oppgave board task crew', icon: <PlaylistAddCheck sx={{ color: ws.green }} />, primary: t('aNewTask'), secondary: t('aNewTaskSub'), run: () => { setActionAnchor(null); setTaskOpen(true); } },
    { q: 'mote booking opptaksdag avtale meet kalender', icon: <EventOutlined sx={{ color: '#a5b4fc' }} />, primary: meetingLabel, secondary: t('aMeetingSub'), run: () => { setActionAnchor(null); setMeetOpen(true); } },
    { q: 'referer lat media leveranse okt link', icon: <LinkIcon sx={{ color: ws.accent }} />, primary: t('aReference'), secondary: t('aReferenceSub'), run: () => void openRefPicker() },
    // Kundegodkjenning er mest relevant for klient-vendte kategorier.
    ...((category === 'visual' || category === 'service') ? [{ q: 'godkjenning kunde approval leveranse send', icon: <CheckCircleOutline sx={{ color: '#f0abfc' }} />, primary: t('aApproval'), secondary: t('aApprovalSub'), run: () => void openApprovalPicker() }] : []),
    { q: 'opplasting fil vedlegg upload raw kildefil lyd', icon: <AttachFile sx={{ color: '#7dd3fc' }} />, primary: uploadLabel, secondary: t('aRequestUploadSub'), run: () => void requestUpload() },
    { q: 'ai oppsummer sammendrag summary', icon: <Summarize sx={{ color: '#22d3ee' }} />, primary: t('aAiSummary'), secondary: t('aAiSummarySub'), run: () => void runAi('summary') },
    { q: 'ai foreslag utkast draft', icon: <AutoAwesome sx={{ color: '#22d3ee' }} />, primary: t('aAiDraft'), secondary: t('aAiDraftSub'), run: () => void runAi('draft') },
  ];

  return (
    <Box sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`, overflow: 'hidden',
    }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.75, py: 1.5, borderBottom: `1px solid ${ws.border}` }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ws.green }} />
          <Typography component="h2" sx={{ fontSize: 14, fontWeight: 700 }}>{t('title')}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.25}>
          <Tooltip title={t('search')}><IconButton size="small" aria-label={t('search')} aria-pressed={searchOpen} onClick={() => { setSearchOpen((v) => { if (v) setQuery(''); return !v; }); }} sx={{ color: searchOpen ? ws.accent : ws.textDim }}><Search fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('members')}><IconButton size="small" aria-label={t('members')} onClick={(e) => { setMentionMode(false); setMembersAnchor(e.currentTarget); }} sx={{ color: ws.textDim }}><PeopleAlt fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('moreActions')}><IconButton size="small" aria-label={t('moreActions')} onClick={(e) => setMoreAnchor(e.currentTarget)} sx={{ color: ws.textDim }}><MoreVert fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Stack>

      {/* Søkefelt (utfellbart) */}
      {searchOpen && (
        <Box sx={{ px: 1.75, pt: 1 }}>
          <TextField autoFocus fullWidth size="small" placeholder={t('searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)}
            inputProps={{ 'aria-label': t('search') }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 16, color: ws.textFaint }} /></InputAdornment>,
              endAdornment: query ? <InputAdornment position="end"><IconButton size="small" aria-label={t('clearSearch')} onClick={() => setQuery('')} sx={{ color: ws.textDim }}><Close sx={{ fontSize: 15 }} /></IconButton></InputAdornment> : null }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
        </Box>
      )}

      {/* Kanal-velger + rom-skille (Team / Delt) */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.75, py: 1 }}>
        <ToggleButtonGroup size="small" exclusive value={room} onChange={(_e, v) => { if (v) setRoom(v); }} aria-label={t('title')}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontSize: 12, fontWeight: 700, py: 0.25, px: 1, color: ws.textDim, borderColor: ws.border }, '& .Mui-selected': { color: `${ws.accent} !important`, bgcolor: `${ws.accentSoft} !important` } }}>
          <ToggleButton value="team" aria-label={t('roomTeam')}><Lock sx={{ fontSize: 13, mr: 0.5 }} /> {t('roomTeam')}</ToggleButton>
          <ToggleButton value="shared" aria-label={t('roomShared')}><Public sx={{ fontSize: 13, mr: 0.5 }} /> {t('roomShared')}</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {room === 'team' && openRequests > 0 && <Chip size="small" label={`${openRequests} ${t('unanswered')}`} sx={{ height: 22, fontSize: 11, fontWeight: 700, color: ws.green, bgcolor: ws.greenSoft }} />}
          <Tooltip title={pinnedOnly ? t('pinFilterOff') : t('pinFilterOn')}>
            <IconButton size="small" aria-label={pinnedOnly ? t('pinFilterOff') : t('pinFilterOn')} aria-pressed={pinnedOnly} onClick={() => setPinnedOnly((v) => !v)} sx={{ color: pinnedOnly ? ws.red : ws.textDim }}><PushPin sx={{ fontSize: 16 }} /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      {/* Delt-rom-banner: alt her er synlig for klienten */}
      {room === 'shared' && (
        <Box sx={{ mx: 1.75, mb: 0.5, px: 1.25, py: 0.6, borderRadius: 1.5, bgcolor: 'rgba(240,171,252,0.1)', border: '1px solid rgba(240,171,252,0.32)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Public sx={{ fontSize: 14, color: '#f0abfc' }} />
          <Typography sx={{ fontSize: 11.5, color: ws.text, fontWeight: 600 }}>{t('sharedBanner')}</Typography>
        </Box>
      )}

      {/* Meldinger — role=log + aria-live så skjermlesere fanger innkommende */}
      <Box ref={listRef} role="log" aria-live="polite" aria-relevant="additions" aria-label={t('messagesRegion')} sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={20} /></Box>
        ) : feed.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: ws.textDim, textAlign: 'center', py: 4 }}>
            {(query || pinnedOnly) ? t('noMatches') : room === 'shared' ? t('emptyShared') : t('emptyChat')}
          </Typography>
        ) : (<>
        {hasOlder && (
          <Button size="small" onClick={loadOlder} disabled={olderBusy} sx={{ alignSelf: 'center', color: ws.textDim, textTransform: 'none', fontSize: 12 }}>
            {olderBusy ? <CircularProgress size={14} /> : t('loadOlder')}
          </Button>
        )}
        {feed.map((it, idx) => {
          // Dag-separator når datoen skifter i tidslinjen.
          const ts = it._t === 'act' ? it.a?.ts : it.m?.timestamp;
          const prevIt = idx > 0 ? feed[idx - 1] : null;
          const prevTs = prevIt ? (prevIt._t === 'act' ? prevIt.a?.ts : prevIt.m?.timestamp) : null;
          const dayLabel = (() => {
            if (!ts) return null;
            const d = new Date(ts); const p = prevTs ? new Date(prevTs) : null;
            if (p && d.toDateString() === p.toDateString()) return null;
            const now = new Date(); const yd = new Date(now.getTime() - 86400000);
            if (d.toDateString() === now.toDateString()) return t('today');
            if (d.toDateString() === yd.toDateString()) return t('yesterday');
            return d.toLocaleDateString(wsDateLocale(locale), { day: 'numeric', month: 'short' });
          })();
          const sep = dayLabel ? (
            <Stack key={`sep-${idx}`} direction="row" alignItems="center" spacing={1} sx={{ my: 0.5 }}>
              <Box sx={{ flex: 1, height: 1, bgcolor: ws.borderSoft }} />
              <Typography sx={{ fontSize: 10.5, color: ws.textFaint, fontWeight: 700 }}>{dayLabel}</Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: ws.borderSoft }} />
            </Stack>
          ) : null;
          if (it._t === 'act') return <React.Fragment key={`f-${idx}`}>{sep}{renderActivity(it.a)}</React.Fragment>;
          const m = it.m;
          // Systemmeldinger (Samkjøringsboard m.fl.) — kompakt senterlinje, ikke boble.
          if (String(m.senderId || '').startsWith('system:')) {
            return (
              <React.Fragment key={m.id}>{sep}
                <Typography sx={{ textAlign: 'center', fontSize: 11.5, color: ws.textDim, py: 0.25 }}>{m.content}</Typography>
              </React.Fragment>
            );
          }
          const mine = String(m.senderId || '').toLowerCase() === String(myId).toLowerCase();
          const tagMeta = m.tag && TAG_META[m.tag];
          const reactions = (m.metadata?.reactions && typeof m.metadata.reactions === 'object') ? m.metadata.reactions : {};
          return (<React.Fragment key={m.id}>{sep}
            <Stack direction="row" spacing={1} className="ws-msg-row" sx={{ alignItems: 'flex-start', flexDirection: mine ? 'row-reverse' : 'row', '&:hover .ws-msg-actions': { opacity: 1 } }}>
              <Avatar src={avatarFor(m.senderId, m.senderName)} sx={{ width: 30, height: 30, fontSize: 12, bgcolor: mine ? ws.accent : 'rgba(255,255,255,0.12)', color: mine ? ws.accentContrast : ws.text }}>
                {initials(m.senderName || maskId(m.senderId))}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexDirection: mine ? 'row-reverse' : 'row' }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{mine ? t('you') : (m.senderName || maskId(m.senderId))}</Typography>
                  <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>
                    {m.timestamp ? new Date(m.timestamp).toLocaleTimeString(wsDateLocale(locale), { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Typography>
                </Stack>
                {tagMeta && (
                  <Chip size="small" icon={tagMeta.icon} label={t(tagMeta.dictKey)} sx={{ mt: 0.4, height: 18, fontSize: 10, color: tagMeta.color, bgcolor: tagMeta.soft, '& .MuiChip-icon': { color: tagMeta.color } }} />
                )}
                {m.content && !['reference', 'task', 'meeting', 'approval'].includes(m.metadata?.action) && !parseShotUpdate(m) && (
                  <Box sx={{ mt: 0.25, px: 1.25, py: 0.75, borderRadius: 2, bgcolor: mine ? ws.accentSoft : 'rgba(255,255,255,0.05)', border: mine ? `1px solid ${ws.accentBorder}` : 'none', display: 'inline-block', maxWidth: '100%' }}>
                    <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {String(m.content).split(/(@[\wæøåÆØÅ.-]+(?: [A-ZÆØÅ][\wæøå.-]+)?)/g).map((part, pi) =>
                        part.startsWith('@')
                          ? <Box key={pi} component="span" sx={{ color: ws.accent, fontWeight: 700 }}>{part}</Box>
                          : part)}
                      {m.metadata?.editedAt && <Box component="span" sx={{ fontSize: 10, color: ws.textFaint, ml: 0.5 }}>({t('edited')})</Box>}
                    </Typography>
                  </Box>
                )}
                {renderShotCard(m)}
                {!parseShotUpdate(m) && renderAttachments(m.attachments)}
                {renderCard(m)}
                {renderRequest(m)}
                {Object.keys(reactions).length > 0 && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.4, flexWrap: 'wrap' }}>
                    {Object.entries(reactions).map(([emo, who]: any) => (
                      <Chip key={emo} size="small" label={`${emo} ${who.length}`} onClick={() => reactToMsg(m.id, emo)}
                        sx={{ height: 20, fontSize: 11, cursor: 'pointer', bgcolor: who.map((w: string) => w.toLowerCase()).includes(String(myId).toLowerCase()) ? ws.accentSoft : 'rgba(255,255,255,0.05)', color: ws.text, border: `1px solid ${ws.borderSoft}` }} />
                    ))}
                  </Stack>
                )}
                <Stack direction="row" spacing={0.25} className="ws-msg-actions" sx={{ mt: 0.25, opacity: 0, transition: 'opacity .15s' }}>
                  {['👍', '❤️', '✅'].map((emo) => (
                    <IconButton key={emo} size="small" onClick={() => reactToMsg(m.id, emo)} sx={{ p: 0.25, fontSize: 13 }}>{emo}</IconButton>
                  ))}
                  {mine && (
                    <>
                      <Tooltip title={t('editMsg')}><IconButton size="small" onClick={() => editMsg(m)} sx={{ p: 0.25, color: ws.textDim }}><Edit sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                      <Tooltip title={t('deleteMsg')}><IconButton size="small" onClick={() => deleteMsg(m)} sx={{ p: 0.25, color: ws.textDim }}><DeleteOutline sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                    </>
                  )}
                </Stack>
              </Box>
            </Stack>
          </React.Fragment>);
        })}
        </>)}
        <div ref={endRef} />
      </Box>

      {/* Komponist */}
      <Box sx={{ px: 1.5, py: 1.25, borderTop: `1px solid ${ws.border}` }}>
        {typingName && <Typography sx={{ fontSize: 11, color: ws.textDim, mb: 0.5, fontStyle: 'italic' }}>{typingName} {t('typing')}</Typography>}
        {err && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
            <Typography role="alert" sx={{ fontSize: 12, color: ws.red }}>{err}</Typography>
            {retryFn && <Button size="small" onClick={() => { setErr(''); retryFn(); }} sx={{ color: ws.accent, textTransform: 'none', fontSize: 11, minWidth: 0, p: 0.25 }}>{t('retry')}</Button>}
          </Stack>
        )}
        {/* Ventende vedlegg */}
        {pending.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
            {pending.map((a, i) => (
              <Box key={i} sx={{ position: 'relative' }}>
                {String(a.mimeType || '').startsWith('image/') ? (
                  <Box component="img" src={a.downloadUrl} alt={a.filename} sx={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 1.5, border: `1px solid ${ws.border}` }} />
                ) : (
                  <Box sx={{ width: 100, height: 52, borderRadius: 1.5, border: `1px solid ${ws.border}`, display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, overflow: 'hidden' }}>
                    <AttachFile sx={{ fontSize: 16, color: ws.textDim }} />
                    <Typography sx={{ fontSize: 10, color: ws.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{a.filename}</Typography>
                  </Box>
                )}
                <IconButton size="small" aria-label={t('removeAttachment')} onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                  sx={{ position: 'absolute', top: -8, right: -8, bgcolor: ws.panelSolid, color: ws.text, p: 0.25, '&:hover': { bgcolor: ws.panelAlt } }}><Close sx={{ fontSize: 14 }} /></IconButton>
              </Box>
            ))}
          </Stack>
        )}
        {/* Valgt merkelapp for neste melding */}
        {tag && TAG_META[tag] && (
          <Stack direction="row" alignItems="center" sx={{ mb: 0.75 }}>
            <Chip size="small" icon={TAG_META[tag].icon} label={t(TAG_META[tag].dictKey)} onDelete={() => setTag(null)} deleteIcon={<Close sx={{ fontSize: 14 }} />}
              sx={{ color: TAG_META[tag].color, bgcolor: TAG_META[tag].soft, '& .MuiChip-icon': { color: TAG_META[tag].color }, '& .MuiChip-deleteIcon': { color: TAG_META[tag].color } }} />
          </Stack>
        )}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <Tooltip title={t('actionOpen')}>
            <IconButton ref={actionBtnRef} onClick={(e) => { setActionAnchor(e.currentTarget); setActionQuery(''); }} disabled={busyAction} aria-label={t('actionOpen')}
              sx={{ color: '#fff', bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}`, '&:hover': { bgcolor: 'rgba(255,140,0,0.24)' } }}>
              {busyAction ? <CircularProgress size={18} /> : <AddCircleOutline sx={{ fontSize: 20, color: ws.accent }} />}
            </IconButton>
          </Tooltip>
          <TextField
            inputRef={inputRef}
            fullWidth size="small" multiline maxRows={4} placeholder={t('composerPlaceholder')}
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              // «/» i tomt felt → åpne Action-launcheren.
              if (v === '/' && !text) { if (actionBtnRef.current) { setActionAnchor(actionBtnRef.current); setActionQuery(''); } return; }
              setText(v);
              sendTyping();
            }}
            inputProps={{ 'aria-label': t('composerPlaceholder') }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) { e.preventDefault(); send(); } }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }}
          />
          <IconButton onClick={send} disabled={sending || uploading || (!text.trim() && pending.length === 0)} aria-label={t('send')}
            sx={{ bgcolor: ws.accent, color: ws.accentContrast, '&:hover': { bgcolor: ws.accentHover }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
            {sending ? <CircularProgress size={18} /> : <Send fontSize="small" />}
          </IconButton>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} justifyContent="space-between">
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,audio/*,video/*" hidden onChange={(e) => { void uploadImage(e.target.files?.[0]); e.target.value = ''; }} />
            <Tooltip title={t('attach')}><span><IconButton size="small" aria-label={t('attach')} disabled={uploading} onClick={() => fileRef.current?.click()} sx={{ color: ws.textDim }}>{uploading ? <CircularProgress size={16} /> : <AttachFile sx={{ fontSize: 17 }} />}</IconButton></span></Tooltip>
            <Tooltip title={t('mention')}><IconButton size="small" aria-label={t('mention')} onClick={(e) => { setMentionMode(true); setMembersAnchor(e.currentTarget); }} sx={{ color: ws.textDim }}><AlternateEmail sx={{ fontSize: 17 }} /></IconButton></Tooltip>
            <Tooltip title={t('emoji')}><IconButton size="small" aria-label={t('emoji')} onClick={(e) => setEmojiAnchor(e.currentTarget)} sx={{ color: ws.textDim }}><EmojiEmotions sx={{ fontSize: 17 }} /></IconButton></Tooltip>
          </Stack>
          {/* Merkelappene må alltid kunne nås — i smale paneler klippes raden,
              så den er horisontalt skrollbar med tynn scrollbar. */}
          <Stack direction="row" spacing={0.5} sx={{ minWidth: 0, overflowX: 'auto', pb: 0.25, '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 2 }, scrollbarWidth: 'thin' }}>
            {['update', 'question', 'important'].map(tagBtn)}
          </Stack>
        </Stack>
      </Box>

      {/* Guide-modal (chat / handlinger) */}
      <WsModal open={!!guideOpen} onClose={() => setGuideOpen(null)} title={guideOpen === 'actions' ? t('actionsGuide') : t('guide')} maxWidth="md">
        <React.Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={22} /></Box>}>
          {guideOpen === 'chat' && <ChatGuideLazy embedded />}
          {guideOpen === 'actions' && <ActionsGuideLazy embedded />}
        </React.Suspense>
      </WsModal>

      {/* Deltakere / mention-plukker */}
      <Popover open={!!membersAnchor} anchorEl={membersAnchor} onClose={() => setMembersAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}`, minWidth: 200 } }}>
        <Typography sx={{ px: 1.5, pt: 1, pb: 0.5, fontSize: 11, color: ws.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('members')} · {participants.length}</Typography>
        <Box role="menu" aria-label={t('members')}>
        {participants.map((p) => (
          <MenuItem key={p.id} role="menuitem" onClick={() => { if (mentionMode) insertAtCursor(`@${p.name} `); setMembersAnchor(null); }} sx={{ gap: 1, fontSize: 13 }}>
            <Avatar src={avatarFor(p.id, p.name)} sx={{ width: 24, height: 24, fontSize: 11, bgcolor: p.mine ? ws.accent : 'rgba(255,255,255,0.12)', color: p.mine ? ws.accentContrast : ws.text }}>{initials(p.name)}</Avatar>
            {p.name}{p.mine ? ` (${t('you')})` : ''}
          </MenuItem>
        ))}
        </Box>
      </Popover>

      {/* Emoji-plukker */}
      <Popover open={!!emojiAnchor} anchorEl={emojiAnchor} onClose={() => setEmojiAnchor(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{ sx: { bgcolor: ws.panelSolid, border: `1px solid ${ws.border}`, p: 1 } }}>
        <Box role="group" aria-label={t('emoji')} sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.25, maxWidth: 220 }}>
          {EMOJIS.map((e) => (
            <IconButton key={e} size="small" aria-label={`${t('emojiPrefix')} ${e}`} onClick={() => { insertAtCursor(e); setEmojiAnchor(null); }} sx={{ fontSize: 18 }}>{e}</IconButton>
          ))}
        </Box>
      </Popover>

      {/* «Flere valg»-meny */}
      <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)} PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}>
        <MenuItem onClick={() => { setMoreAnchor(null); scrollDown(); }} sx={{ gap: 1, fontSize: 13 }}><KeyboardArrowDown sx={{ fontSize: 18 }} /> {t('jumpToLatest')}</MenuItem>
        <MenuItem onClick={() => { setMoreAnchor(null); load(false); }} sx={{ gap: 1, fontSize: 13 }}><Refresh sx={{ fontSize: 18 }} /> {t('refresh')}</MenuItem>
        <MenuItem onClick={() => { setMoreAnchor(null); setGuideOpen('chat'); }} sx={{ gap: 1, fontSize: 13 }}><HelpOutlineIcon sx={{ fontSize: 18 }} /> {t('guide')}</MenuItem>
        <MenuItem onClick={() => { setMoreAnchor(null); setGuideOpen('actions'); }} sx={{ gap: 1, fontSize: 13 }}><AutoAwesome sx={{ fontSize: 18 }} /> {t('actionsGuide')}</MenuItem>
        {captureRelevant && shotAutoCheck !== null && (
          <MenuItem onClick={toggleShotAutoCheck} disabled={autoCheckBusy} sx={{ gap: 1, fontSize: 13 }}>
            <PlaylistAddCheck sx={{ fontSize: 18, color: shotAutoCheck ? ws.accent : ws.textDim }} />
            {shotAutoCheck ? 'Slå av auto-huk (shot-liste)' : 'Slå på auto-huk (shot-liste)'}
          </MenuItem>
        )}
      </Menu>

      {/* Action-launcher */}
      <Menu anchorEl={actionAnchor} open={!!actionAnchor} onClose={() => setActionAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }} transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.accentBorder}`, minWidth: 288 } }}>
        <Box sx={{ px: 1.75, py: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <AutoAwesome sx={{ color: ws.accent, fontSize: 17 }} />
          <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{t('action')}</Typography>
          <Typography sx={{ color: ws.textFaint, fontSize: 11, ml: 'auto' }}>⌘K · {t('actionHint')}</Typography>
        </Box>
        <Box sx={{ px: 1.25, pb: 0.75 }}>
          <TextField autoFocus value={actionQuery} onChange={(e) => setActionQuery(e.target.value)} placeholder={t('actionSearch')} size="small" fullWidth
            inputProps={{ 'aria-label': t('actionSearch') }}
            sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
        </Box>
        {ACTIONS.filter((a) => !actionQuery || `${a.primary} ${a.q}`.toLowerCase().includes(actionQuery.toLowerCase())).map((a) => (
          <MenuItem key={a.primary} onClick={a.run} sx={{ py: 0.75 }}>
            <ListItemIcon sx={{ minWidth: 34 }}>{a.icon}</ListItemIcon>
            <ListItemText primary={a.primary} secondary={a.secondary}
              primaryTypographyProps={{ sx: { fontSize: 13, fontWeight: 600, color: ws.text } }}
              secondaryTypographyProps={{ sx: { fontSize: 11, color: ws.textDim } }} />
          </MenuItem>
        ))}
      </Menu>

      {/* Ny oppgave-dialog */}
      <Dialog open={taskOpen} onClose={() => setTaskOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 15 }}>{t('taskTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <TextField autoFocus value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder={t('taskName')} size="small" fullWidth
              inputProps={{ 'aria-label': t('taskName') }} onKeyDown={(e) => { if (e.key === 'Enter') void createTask(); }}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
            <FormControl size="small" fullWidth>
              <Select value={taskRole} onChange={(e) => setTaskRole(e.target.value)} aria-label="Crew-rolle" sx={{ bgcolor: ws.panelInput, fontSize: 13, color: ws.text, '& .MuiSvgIcon-root': { color: ws.textDim } }}>
                {[['begge', 'Alle'], ['produsent', 'Produsent'], ['vokal', 'Vokal'], ['musikere', 'Musikere'], ['miks', 'Miks'], ['foto', 'Foto'], ['video', 'Video'], ['redigering', 'Redigering']].map(([v, l]) => <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>{l}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setTaskOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('cancel')}</Button>
              <Button onClick={() => void createTask()} disabled={busyAction || !taskName.trim()} startIcon={busyAction ? <CircularProgress size={14} /> : <PlaylistAddCheck sx={{ fontSize: 16 }} />}
                variant="contained" sx={{ bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: ws.accentHover } }}>{t('taskCreate')}</Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Referanse-picker */}
      <Dialog open={refOpen} onClose={() => setRefOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 15 }}>{t('refPick')}</DialogTitle>
        <DialogContent>
          <Tabs value={refTab} onChange={(_, v) => setRefTab(v)} variant="fullWidth" sx={{ mb: 1, minHeight: 36, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: 12, minHeight: 36, color: ws.textDim }, '& .Mui-selected': { color: `${ws.accent} !important` }, '& .MuiTabs-indicator': { bgcolor: ws.accent } }}>
            {refSources.map((s) => <Tab key={s.key} label={`${s.label} (${s.items.length})`} />)}
          </Tabs>
          {refLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} sx={{ color: ws.accent }} /></Box>
          ) : (
            <Stack spacing={0.25} sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {(refSources[refTab]?.items || []).map((it) => (
                <ListItemButton key={it.id} onClick={() => void pickReference(refSources[refTab].kind, it.id, it.primary)} sx={{ borderRadius: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>{refSources[refTab].icon}</ListItemIcon>
                  <ListItemText primary={it.primary} secondary={it.secondary} primaryTypographyProps={{ sx: { fontSize: 13, color: ws.text } }} secondaryTypographyProps={{ sx: { fontSize: 11, color: ws.textDim } }} />
                </ListItemButton>
              ))}
              {refSources[refTab] && refSources[refTab].items.length === 0 && (
                <Typography sx={{ color: ws.textDim, fontSize: 12.5, py: 2, textAlign: 'center' }}>{t('refEmpty')}</Typography>
              )}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Planlegg møte / booking */}
      <Dialog open={meetOpen} onClose={() => setMeetOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 15 }}>{meetingLabel}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ pt: 0.5 }}>
            <TextField autoFocus value={meetTitle} onChange={(e) => setMeetTitle(e.target.value)} placeholder={t('meetTitleField')} size="small" fullWidth
              inputProps={{ 'aria-label': t('meetTitleField') }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
            <Stack direction="row" spacing={1}>
              <TextField type="date" value={meetDate} onChange={(e) => setMeetDate(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} inputProps={{ 'aria-label': 'Dato' }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13, color: ws.text } }} />
              <TextField type="time" value={meetTime} onChange={(e) => setMeetTime(e.target.value)} size="small" fullWidth InputLabelProps={{ shrink: true }} inputProps={{ 'aria-label': 'Tid' }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13, color: ws.text } }} />
            </Stack>
            <FormControlLabel control={<Checkbox checked={genMeet} onChange={(e) => setGenMeet(e.target.checked)} size="small" sx={{ color: ws.textDim, '&.Mui-checked': { color: ws.accent } }} />} label={<Typography sx={{ fontSize: 12.5, color: ws.text }}>{t('genMeet')}</Typography>} />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setMeetOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('cancel')}</Button>
              <Button onClick={() => void createMeeting()} disabled={busyAction || !meetDate} startIcon={busyAction ? <CircularProgress size={14} /> : <EventOutlined sx={{ fontSize: 16 }} />}
                variant="contained" sx={{ bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: ws.accentHover } }}>{t('meetCreate')}</Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Send til kundegodkjenning — velg leveranse */}
      <Dialog open={apprOpen} onClose={() => setApprOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: ws.panelSolid, color: ws.text, border: `1px solid ${ws.border}` } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 15 }}>{t('approvalPick')}</DialogTitle>
        <DialogContent>
          {apprLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} sx={{ color: ws.accent }} /></Box>
          ) : (
            <Stack spacing={0.25} sx={{ maxHeight: 300, overflowY: 'auto' }}>
              {apprItems.map((d) => (
                <ListItemButton key={d.id} onClick={() => void sendForApproval(d.id, d.title)} sx={{ borderRadius: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><MovieOutlined sx={{ fontSize: 17, color: '#f0abfc' }} /></ListItemIcon>
                  <ListItemText primary={d.title} secondary={[d.type, d.status].filter(Boolean).join(' · ')} primaryTypographyProps={{ sx: { fontSize: 13, color: ws.text } }} secondaryTypographyProps={{ sx: { fontSize: 11, color: ws.textDim } }} />
                </ListItemButton>
              ))}
              {apprItems.length === 0 && <Typography sx={{ color: ws.textDim, fontSize: 12.5, py: 2, textAlign: 'center' }}>{t('refEmpty')}</Typography>}
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast('')} message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
};

export default WorkspaceChatPanel;
