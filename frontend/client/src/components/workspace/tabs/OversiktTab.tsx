// @ts-nocheck
/**
 * OversiktTab — workspace-forsiden (design #1), dark CreatorHub.
 * Dagens tidslinje + Samkjøringsboard + Team Sync / Sjekkliste / Referanser
 * + Team Chat (høyre). Ekte prosjekter viser ekte data (milestones, timeline,
 * board-tasks, checklist, team-sync, capture/DIT); /workspace/sample viser demo.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Avatar, IconButton, Button, Chip } from '@mui/material';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import AccessTime from '@mui/icons-material/AccessTime';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import ViewKanban from '@mui/icons-material/ViewKanban';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import Warning from '@mui/icons-material/Warning';
import Add from '@mui/icons-material/Add';
import { ws } from '../workspaceTheme';
import { useWorkspaceCategory } from '../useWorkspaceCategory';
import { WsCard, WsSectionTitle, WsRing, WsBar, WsImageGrid } from '../ui';
import { crewIcon, wsIcon } from '../crewIcons';
import WorkspaceChatPanel from '../WorkspaceChatPanel';
import GettingStartedChecklist from '../../onboarding/GettingStartedChecklist';
import { useProjectImages } from '../useProjectImages';
import { useCaptureRealtime } from '../useCaptureRealtime';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from '../wsLocale';
import { CATEGORY_DEFAULT_CREW, crewRoleDef } from '@shared/crew-roles';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab). Demo-konstantene
// (PHASES/BOARD/SYNC_ITEMS/CHECKLIST) er sample-data og forblir norske.
const T: WsDict = {
  // Capture-aktivitet (activityMeta)
  actAssetAdded: { no: 'Nytt bilde lastet opp', en: 'New photo uploaded' },
  actRating: { no: 'Rating endret', en: 'Rating changed' },
  actCulling: { no: 'Culling', en: 'Culling' },
  actFlagged: { no: 'Markert for klient', en: 'Flagged for client' },
  actHandoff: { no: 'Sendt til editor', en: 'Sent to editor' },
  actDelivered: { no: 'Levert', en: 'Delivered' },
  actBackedUp: { no: 'Sikkerhetskopiert', en: 'Backed up' },
  actSessionStart: { no: 'Capture-session startet', en: 'Capture session started' },
  actEnhance: { no: 'AI-forbedring', en: 'AI enhancement' },
  actVoice: { no: 'Talenotat lagt til', en: 'Voice memo added' },
  actComment: { no: 'Tilbakemelding', en: 'Feedback' },
  eventWord: { no: 'Hendelse', en: 'Event' },
  // timeAgo
  justNow: { no: 'nå nettopp', en: 'just now' },
  minAgo: { no: 'min siden', en: 'min ago' },
  hoursAgo: { no: 't siden', en: 'h ago' },
  daysAgo: { no: 'd siden', en: 'd ago' },
  // prompts/alerts
  newCheckPrompt: { no: 'Nytt sjekkpunkt:', en: 'New checklist item:' },
  newTaskPrompt: { no: 'Ny oppgave:', en: 'New task:' },
  addFailed: { no: 'Kunne ikke legge til', en: 'Could not add' },
  // fremdrift
  progressLabel: { no: 'Fremdrift', en: 'Progress' },
  ofWord: { no: 'av', en: 'of' },
  tasksDone: { no: 'oppgaver fullført', en: 'tasks completed' },
  noMilestones: { no: 'Ingen milepæler ennå', en: 'No milestones yet' },
  // Capture & backup-kort
  shootingNow: { no: 'SKYTER NÅ', en: 'SHOOTING NOW' },
  captureSession: { no: 'Capture-session', en: 'Capture session' },
  photosWord: { no: 'bilder', en: 'photos' },
  securedB2: { no: 'Sikret i B2 (One Desk)', en: 'Secured in B2 (One Desk)' },
  originalsVerified: { no: 'originaler verifisert', en: 'originals verified' },
  oneDeskMirror: { no: 'One Desk-speiling', en: 'One Desk mirroring' },
  backupHelper: { no: 'Backup-helper', en: 'Backup helper' },
  destination: { no: 'Destinasjon', en: 'Destination' },
  hashVerified: { no: 'hash-verifisert', en: 'hash-verified' },
  copyingWord: { no: 'kopierer…', en: 'copying…' },
  failedWord: { no: 'feilet', en: 'failed' },
  jobsWord: { no: 'jobber', en: 'jobs' },
  fullyVerified: { no: 'fullt verifisert', en: 'fully verified' },
  // tidslinje
  todayTimeline: { no: 'Dagens tidslinje', en: 'Today’s timeline' },
  today: { no: 'I dag', en: 'Today' },
  // samkjøringsboard
  syncBoard: { no: 'Samkjøringsboard', en: 'Coordination board' },
  addTaskBtn: { no: 'Legg til oppgave', en: 'Add task' },
  // Team Sync
  teamSyncTitle: { no: 'Samkjøring (Team Sync)', en: 'Team Sync' },
  ready: { no: 'Klar', en: 'Ready' },
  noSyncData: { no: 'Ingen samkjøringsdata ennå — legg til oppgaver og sjekkpunkter.', en: 'No sync data yet — add tasks and checklist items.' },
  seeDetails: { no: 'Se detaljer', en: 'View details' },
  // sjekkliste
  checklistTitle: { no: 'Sjekkliste', en: 'Checklist' },
  addCheckBtn: { no: '+ Legg til sjekkpunkt', en: '+ Add checklist item' },
  seeAll: { no: 'Se alle', en: 'View all' },
  // referanser
  refsTitle: { no: 'Referanser & shots', en: 'References & shots' },
  refsTitleMusic: { no: 'Referanser', en: 'References' },
  // Studio-kort (musikk-kategorien — erstatter Capture & backup)
  studioTitle: { no: 'Studio', en: 'Studio' },
  latestBounces: { no: 'Siste bounces', en: 'Latest bounces' },
  noBounces: { no: 'Ingen bounces ennå — de dukker opp her når Pro Tools Companion eksporterer.', en: 'No bounces yet — they appear here when Pro Tools Companion exports.' },
  markersWord: { no: 'markører', en: 'markers' },
  bouncesWord: { no: 'bounces', en: 'bounces' },
  toVersion: { no: '→ versjon', en: '→ version' },
  openSoundRoomBtn: { no: 'Åpne Sound Room', en: 'Open Sound Room' },
  readyForRecording: { no: 'klar til opptak', en: 'ready to record' },
  moodCheckins: { no: 'form-innsjekk', en: 'mood check-ins' },
  addReference: { no: 'Legg til referanse', en: 'Add reference' },
  // aktivitet
  captureActivity: { no: 'Capture-aktivitet', en: 'Capture activity' },
};

const PHASES = [
  { icon: 'Favorite', label: 'Forberedelser', time: '08:00 – 10:00', color: ws.textDim },
  { icon: 'Favorite', label: 'First look', time: '10:30 – 11:00', color: ws.red },
  { icon: 'Church', label: 'Vielse', time: '11:30 – 12:30', color: ws.accent, active: true },
  { icon: 'WbTwilight', label: 'Golden hour', time: '16:30 – 17:30', color: ws.amber },
  { icon: 'Mic', label: 'Taler', time: '19:00 – 20:00', color: ws.blue },
  { icon: 'Celebration', label: 'Fest', time: '20:30 – 00:00', color: ws.green },
];

const BOARD = [
  { role: 'Fotograf (Daniel)', icon: 'PhotoCamera', tasks: [
    { t: 'Detaljer: ringer & tilbehør', time: '07:30 – 08:00', done: true },
    { t: 'Forberedelser – candids', time: '08:00 – 10:00', done: true },
    { t: 'Portretter av brud & brudgom', time: '10:00 – 10:30', done: false },
    { t: 'Close-ups av ringer', time: '11:20 – 11:30', done: false },
  ]},
  { role: 'Videograf (Emma)', icon: 'Videocam', tasks: [
    { t: 'Etableringsbilder + lydsjekk', time: '07:30 – 08:30', done: true },
    { t: 'Forberedelser – video', time: '08:00 – 10:00', done: true },
    { t: 'First look – video', time: '10:30 – 11:00', done: false },
    { t: 'Vielse – flere vinkler', time: '11:30 – 12:30', done: false },
  ]},
  { role: 'Begge', icon: 'Groups', tasks: [
    { t: 'First look – reaksjoner', time: '10:30 – 11:00', done: true },
    { t: 'Vielse: inngang & første kyss', time: '11:30 – 12:30', done: false },
    { t: 'Gruppebilder familie', time: '13:00 – 13:45', done: false },
    { t: 'Golden hour – parbilder', time: '16:30 – 17:30', done: false },
  ]},
  { role: 'Editor (Lukas)', icon: 'Movie', tasks: [
    { t: 'Råmateriale backup', time: 'Løpende', done: true },
    { t: 'Marker sterke øyeblikk', time: 'Løpende', done: false },
    { t: 'Highlight-klipp (2–3 min)', time: 'Etter festen', done: false },
    { t: 'Langfilm (20–30 min)', time: 'Levering', done: false },
  ]},
];

const SYNC_ITEMS = ['Brief lest', 'Lydplan', 'Backup plan', 'Kundeønsker gjennomgått'];
const CHECKLIST = [
  { t: 'Utstyr sjekket', ok: true },
  { t: 'Batterier & minnekort', ok: true },
  { t: 'Værmelding', ok: false },
  { t: 'Transport & parkering', ok: true },
  { t: 'Backup lokasjon', ok: false },
];

const RULER = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

function eventIcon(title: string): string {
  const t = (title || '').toLowerCase();
  if (t.includes('first look')) return 'Favorite';
  if (t.includes('viel') || t.includes('seremoni')) return 'Church';
  if (t.includes('golden')) return 'WbTwilight';
  if (t.includes('tale') || t.includes('toast')) return 'Mic';
  if (t.includes('fest') || t.includes('dans')) return 'Celebration';
  if (t.includes('forbered') || t.includes('getting ready')) return 'Favorite';
  return 'AccessTime';
}
// Humaniser en capture_events.event_type (fri tekst fra iPad/One Desk) til ikon + tekst.
function activityMeta(type: string, t: (k: string) => string): { icon: string; label: string } {
  const ty = (type || '').toLowerCase();
  if (ty.includes('asset') && (ty.includes('add') || ty.includes('upload') || ty.includes('captur'))) return { icon: 'PhotoCamera', label: t('actAssetAdded') };
  if (ty.includes('rating') || ty.includes('rated')) return { icon: 'Star', label: t('actRating') };
  if (ty.includes('cull') || ty.includes('reject')) return { icon: 'DeleteOutline', label: t('actCulling') };
  if (ty.includes('flag') || ty.includes('pick') || ty.includes('highlight')) return { icon: 'FlagOutlined', label: t('actFlagged') };
  if (ty.includes('handoff')) return { icon: 'Movie', label: t('actHandoff') };
  if (ty.includes('deliver')) return { icon: 'Inventory2', label: t('actDelivered') };
  if (ty.includes('backup') || ty.includes('secured') || ty.includes('mirror')) return { icon: 'CloudDone', label: t('actBackedUp') };
  if (ty.includes('session') && ty.includes('start')) return { icon: 'PlayArrow', label: t('actSessionStart') };
  if (ty.includes('enhance')) return { icon: 'AutoAwesome', label: t('actEnhance') };
  if (ty.includes('voice') || ty.includes('memo') || ty.includes('audio')) return { icon: 'SettingsVoice', label: t('actVoice') };
  if (ty.includes('comment') || ty.includes('review')) return { icon: 'ChatBubbleOutline', label: t('actComment') };
  return { icon: 'Bolt', label: (type || t('eventWord')).replace(/_/g, ' ') };
}
function timeAgo(iso: string, t: (k: string) => string): string {
  if (!iso) return '';
  const d = new Date(iso).getTime(); if (!Number.isFinite(d)) return '';
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return t('justNow');
  if (s < 3600) return `${Math.floor(s / 60)} ${t('minAgo')}`;
  if (s < 86400) return `${Math.floor(s / 3600)} ${t('hoursAgo')}`;
  return `${Math.floor(s / 86400)} ${t('daysAgo')}`;
}
function addMinutes(hhmm: string, mins: number): string {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h * 60 + m + (mins || 0)) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const OversiktTab: React.FC<{ projectId: string; profession?: string }> = ({ projectId, profession }) => {
  const [, navigate] = useLocation();
  // Utenlandske partner-vendors får engelsk UI — locale fra WsLocaleProvider.
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const go = (key: string) => navigate(`/workspace/${projectId}/${key}`);
  const [progress, setProgress] = useState<{ pct: number; done: number; total: number } | null>(null);
  const [events, setEvents] = useState<any[] | null>(null);
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [checks, setChecks] = useState<any[] | null>(null);

  const isReal = projectId && projectId !== 'sample';

  const loadTasks = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks`)
      .then((r: any) => { setTasks(Array.isArray(r?.tasks) ? r.tasks : []); })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}/milestones`)
      .then((r: any) => { if (r) setProgress({ pct: Math.round(r.totalProgress || 0), done: r.completedCount || 0, total: (r.milestones || []).length }); })
      .catch(() => {});
    apiRequest(`/api/wedding/timeline/project/${encodeURIComponent(projectId)}`)
      .then((r: any) => { const evs = Array.isArray(r?.events) ? r.events : []; if (evs.length) setEvents(evs); })
      .catch(() => {});
    loadTasks();
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist`)
      .then((r: any) => { setChecks(Array.isArray(r?.items) ? r.items : []); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const toggleCheck = async (id: string, checked: boolean) => {
    if (!isReal) return;
    setChecks((p) => (p || []).map((c) => (c.id === id ? { ...c, checked: !checked } : c)));
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist/${id}`, { method: 'PATCH', body: { checked: !checked } }).catch(() => {});
  };
  const addCheck = async () => {
    if (!isReal) return;
    const label = window.prompt(t('newCheckPrompt')); if (!label) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist`, { method: 'POST', body: { label: label.trim() } }); apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist`).then((r: any) => setChecks(r?.items || [])); }
    catch (e: any) { window.alert(e?.message || t('addFailed')); }
  };
  const checkItems = isReal ? (checks || []).map((c) => ({ id: c.id, t: c.label, ok: c.checked, real: true })) : CHECKLIST;
  const refs = useProjectImages(projectId, 'references');
  const [teamSync, setTeamSync] = useState<any | null>(null);
  // Signatur på antall + fullført-antall i stedet for array-REFERANSENE, ellers
  // re-fetches team-sync på hvert render/poll (nye array-refs med samme innhold)
  // — inkl. hvert checkbox-klikk. Nå kun ved reell endring.
  const doneSig = [...tasks, ...checks].reduce((n: number, x: any) => n + (x?.done || x?.completed || x?.checked || x?.status === 'done' ? 1 : 0), 0);
  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team-sync`).then((r: any) => setTeamSync(r || null)).catch(() => {});
  }, [projectId, isReal, tasks.length, checks.length, doneSig]);
  // Ekte prosjekter: kun ekte team-sync (0 %/tom-tilstand til data finnes); demo-tall kun på sample.
  const syncPct = isReal ? (teamSync?.pct ?? 0) : 82;
  const syncItems = (teamSync && Array.isArray(teamSync.readiness) && teamSync.readiness.length)
    ? teamSync.readiness.map((x: any) => ({ t: `${x.label} (${x.value})`, ok: x.done }))
    : isReal ? [] : SYNC_ITEMS.map((s) => ({ t: s, ok: true }));

  // Capture & backup — live-status fra iPad CaptureApp + One Desk (poll 20s).
  const [capture, setCapture] = useState<any | null>(null);
  useEffect(() => {
    if (!isReal) return;
    const fetchCap = () => {
      if (document.hidden) return;
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/capture-status`).then((r: any) => setCapture(r || null)).catch(() => {});
    };
    fetchCap();
    const t = setInterval(fetchCap, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  // One Desk DIT-backup — RAID/B2-speiling + hash-verifiserte kopier (poll 30s).
  const [dit, setDit] = useState<any | null>(null);
  const loadDit = () => { if (!isReal) return; apiRequest(`/api/projects/${encodeURIComponent(projectId)}/dit-status`).then((r: any) => setDit(r || null)).catch(() => {}); };
  useEffect(() => {
    if (!isReal) return;
    loadDit();
    const t = setInterval(() => { if (!document.hidden) loadDit(); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  // Capture-aktivitet — live hendelseslogg fra iPad + One Desk (backfill + WS).
  const [activity, setActivity] = useState<any[]>([]);
  const loadActivity = () => { if (!isReal) return; apiRequest(`/api/projects/${encodeURIComponent(projectId)}/capture-activity`).then((r: any) => setActivity(Array.isArray(r?.events) ? r.events : [])).catch(() => {}); };
  useEffect(() => { loadActivity(); /* eslint-disable-next-line */ }, [projectId]);

  // Sanntid: oppdater Capture & backup INSTANT når iPad skyter/culler (WS).
  const { live: capLive } = useCaptureRealtime(projectId, (payload: any) => {
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/capture-status`).then((r: any) => setCapture(r || null)).catch(() => {});
    loadDit();
    // Append innkommende hendelse øverst i strømmen (rad-form fra broadcastCaptureEvent).
    if (payload?.id && payload?.event_type) {
      setActivity((p) => [{ id: payload.id, type: payload.event_type, assetId: payload.asset_id || null, filename: null, actorName: null, metadata: payload.metadata || null, createdAt: payload.created_at || new Date().toISOString() }, ...p.filter((x) => x.id !== payload.id)].slice(0, 40));
    } else { loadActivity(); }
  });
  const cap = isReal ? capture : { hasSession: true, shootingNow: true, session: { name: 'EOS R5 — Vielse' }, assets: { total: 842, securedToB2: 842, securedPct: 100, lastCaptureAt: new Date().toISOString() } };

  const toggleTask = async (id: string, status: string) => {
    if (!isReal) return;
    setTasks((p) => (p || []).map((t) => (t.id === id ? { ...t, status: status === 'done' ? 'todo' : 'done' } : t)));
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks/${id}`, { method: 'PATCH', body: { status: status === 'done' ? 'todo' : 'done' } }).catch(loadTasks);
  };
  const addTask = async (crewRole: string) => {
    if (!isReal) return;
    const title = window.prompt(t('newTaskPrompt')); if (!title) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks`, { method: 'POST', body: { title: title.trim(), crewRole } }); loadTasks(); }
    catch (e: any) { window.alert(e?.message || t('addFailed')); }
  };

  // Rolle-kolonnene er DATA: GET /crew-roles gir eier-kategoriens default-sett
  // ∪ roller teamet/boardet faktisk bruker — blandede team (foto + musikk på
  // samme event) får dermed egne kolonner. Kategori-defaults fra den delte
  // katalogen som fallback før svaret/på sample.
  const wsCategory = useWorkspaceCategory(profession);
  const [crewData, setCrewData] = useState<{ roles: any[]; fallbackKey: string } | null>(null);
  useEffect(() => {
    if (!isReal) { setCrewData(null); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/crew-roles`)
      .then((r: any) => { if (Array.isArray(r?.roles) && r.roles.length) setCrewData({ roles: r.roles, fallbackKey: r.fallbackKey || 'begge' }); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isReal]);
  // Studio-kort for musikk: siste sesjoner m/ playhead + bounces (erstatter
  // det foto-spesifikke Capture & backup-kortet).
  const [studioSessions, setStudioSessions] = useState<any[] | null>(null);
  // Readiness (EaseVerse oppvarming + Bandets form) — eier-gatet; feil → skjult.
  const [studioReadiness, setStudioReadiness] = useState<{ warmed: number; band: number; moods: number } | null>(null);
  useEffect(() => {
    if (!isReal || wsCategory !== 'music') { setStudioSessions(null); setStudioReadiness(null); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/recording-sessions?include=details`)
      .then(async (r: any) => {
        setStudioSessions(Array.isArray(r?.sessions) ? r.sessions : []);
        if (!r?.audioRoomId) return;
        try {
          const [w, m, mem] = await Promise.all([
            apiRequest(`/api/audio-showcases/${encodeURIComponent(r.audioRoomId)}/warmups`).catch(() => null),
            apiRequest(`/api/audio-showcases/${encodeURIComponent(r.audioRoomId)}/mood`).catch(() => null),
            apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room/members`).catch(() => null),
          ]);
          const routines = Array.isArray(w?.routines) ? w.routines : null;
          if (!routines) return; // ikke eier → skjul
          const warmed = new Set(routines.flatMap((x: any) => (x.completions || []).map((c: any) => c.name))).size;
          setStudioReadiness({ warmed, band: Array.isArray(mem?.members) ? mem.members.length : 0, moods: Array.isArray(m?.moods) ? m.moods.length : 0 });
        } catch { /* stille */ }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isReal, wsCategory]);
  const latestBounces = (studioSessions || [])
    .flatMap((s: any) => (Array.isArray(s.bounces) ? s.bounces.map((b: any) => ({ ...b, sessionName: s.name })) : []))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const liveStudio = (studioSessions || []).find((s: any) => s.playhead?.timecode) || (studioSessions || [])[0] || null;

  const catDefaults = CATEGORY_DEFAULT_CREW[wsCategory] || CATEGORY_DEFAULT_CREW.visual;
  const roleDefs = crewData ? crewData.roles : catDefaults.keys.map(crewRoleDef);
  const crewFallbackKey = crewData?.fallbackKey || catDefaults.fallbackKey;
  const COLS = roleDefs.map((r: any) => ({ role: locale === 'en' ? (r.labelEn || r.label) : r.label, icon: r.icon || 'Person', crew: r.key }));
  const realBoard = tasks && tasks.length > 0
    ? COLS.map((c) => ({ ...c, tasks: tasks.filter((t) => (t.crewRole || crewFallbackKey) === c.crew).map((t) => ({ id: t.id, t: t.title, time: t.timeLabel || '', done: t.status === 'done', real: true })) }))
    : null;
  const boardCols = isReal ? (realBoard || COLS.map((c) => ({ role: c.role || c.label || c.crew, icon: c.icon || 'Groups', crew: c.crew, tasks: [] }))) : BOARD.map((c, i) => ({ role: c.role, icon: c.icon, crew: COLS[i]?.crew || 'begge', tasks: c.tasks }));

  // Ekte prosjekter: ekte fremdrift (0 til milestones finnes); demo-tall kun på sample.
  const fremdriftPct = progress ? progress.pct : isReal ? 0 : 68;
  const fremdriftText = progress
    ? `${progress.done} ${t('ofWord')} ${progress.total} ${t('tasksDone')}`
    : isReal ? t('noMilestones') : `14 ${t('ofWord')} 21 ${t('tasksDone')}`;
  const phaseItems = isReal
    ? (events || []).map((e: any) => ({ icon: eventIcon(e.title), label: e.title || t('eventWord'), time: e.time ? `${e.time}${e.durationMinutes ? ' – ' + addMinutes(e.time, e.durationMinutes) : ''}` : '', active: e.status === 'in_progress' || e.status === 'current' }))
    : PHASES;

  // Now-markør: ekte klokke mot 08:00–22:00-linjalen (oppdateres hvert minutt,
  // skjules utenfor vinduet). Sample beholder demo-tidspunktet 12:15.
  const [nowMin, setNowMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => {
    const t = setInterval(() => { const d = new Date(); setNowMin(d.getHours() * 60 + d.getMinutes()); }, 60000);
    return () => clearInterval(t);
  }, []);
  const nowPct = isReal ? ((nowMin - 8 * 60) / (14 * 60)) * 100 : 30.4;
  const nowLabel = isReal ? `${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}` : '12:15';
  const nowVisible = nowPct >= 0 && nowPct <= 100;

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} sx={{ alignItems: 'stretch' }}>
      {/* ───────── Hovedkolonne ───────── */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* «Kom i gang»-sjekkliste: gjør brukeren workspace-klar (profil, prosjekt,
            team, verktøy). Leser ekte tilstand, lukkbar, skjuler seg selv når alt
            er ferdig. projectId gjør team-sjekk/-lenke prosjekt-bevisst. */}
        <GettingStartedChecklist projectId={projectId} profession={profession} />
        {/* Fremdrift */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, color: ws.textDim }}>{t('progressLabel')}</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: ws.accent }}>{fremdriftPct} %</Typography>
          <Box sx={{ flex: 1, maxWidth: 360 }}><WsBar value={fremdriftPct} /></Box>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{fremdriftText}</Typography>
        </Stack>

        {/* Capture & backup — live fra iPad CaptureApp + One Desk */}
        {wsCategory === 'music' && isReal && studioSessions && studioSessions.length > 0 && (
          <WsCard sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" gap={1.5}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 180 }}>
                {wsIcon('Tune', { fontSize: 18, color: ws.accent })}
                <Box>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{t('studioTitle')}</Typography>
                    {liveStudio?.playhead?.timecode && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.green }} />
                        <Typography sx={{ fontSize: 10.5, color: ws.green, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>{wsIcon('PlayArrow', { fontSize: 12 })}{liveStudio.playhead.timecode}</Typography>
                      </Box>
                    )}
                  </Stack>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint }} noWrap>{liveStudio?.name || 'Pro Tools'}</Typography>
                </Box>
              </Stack>
              <Box sx={{ textAlign: 'center', px: 1 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{(studioSessions || []).reduce((s: number, x: any) => s + (Number(x.marker_count) || 0), 0)}</Typography>
                <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>{t('markersWord')}</Typography>
              </Box>
              <Box sx={{ textAlign: 'center', px: 1 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{(studioSessions || []).reduce((s: number, x: any) => s + (Number(x.bounce_count) || 0), 0)}</Typography>
                <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>{t('bouncesWord')}</Typography>
              </Box>
              {studioReadiness && (studioReadiness.warmed > 0 || studioReadiness.moods > 0) && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 1 }}>
                  {wsIcon('SelfImprovement', { fontSize: 15, color: ws.textDim })}
                  <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>
                    {studioReadiness.warmed}{studioReadiness.band ? `/${studioReadiness.band}` : ''} {t('readyForRecording')}{studioReadiness.moods > 0 ? ` · ${studioReadiness.moods} ${t('moodCheckins')}` : ''}
                  </Typography>
                </Stack>
              )}
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="outlined" onClick={() => go('sound-room')} sx={{ color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600 }}>{t('openSoundRoomBtn')}</Button>
            </Stack>
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${ws.borderSoft}` }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>{t('latestBounces').toUpperCase()}</Typography>
              {latestBounces.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: ws.textFaint }}>{t('noBounces')}</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {latestBounces.map((b: any) => (
                    <Stack key={b.id} direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 0.55, borderRadius: 1, bgcolor: ws.panelInput }}>
                      {wsIcon('Headphones', { fontSize: 14, color: ws.textDim })}
                      <Typography sx={{ fontSize: 12, color: ws.text, flex: 1, minWidth: 0 }} noWrap>{b.fileName || 'Bounce'}</Typography>
                      {b.sessionName && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }} noWrap>{b.sessionName}</Typography>}
                      {b.reviewVersionId && <Typography sx={{ fontSize: 10.5, color: ws.green, fontWeight: 700 }}>{t('toVersion')}</Typography>}
                      <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{timeAgo(b.createdAt, t)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          </WsCard>
        )}
        {wsCategory !== 'music' && cap?.hasSession && (
          <WsCard sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" gap={1.5}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 180 }}>
                {wsIcon('PhotoCamera', { fontSize: 18, color: ws.accent })}
                <Box>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Capture & backup</Typography>
                    {cap.shootingNow && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.red }} /><Typography sx={{ fontSize: 10.5, color: ws.red, fontWeight: 700 }}>{t('shootingNow')}</Typography></Box>}
                  </Stack>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{cap.session?.name || t('captureSession')}</Typography>
                </Box>
              </Stack>
              <Box sx={{ textAlign: 'center', px: 1 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{cap.assets?.total ?? 0}</Typography>
                <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>{t('photosWord')}</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 160 }}>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11.5, color: ws.textDim, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>{wsIcon('CloudDone', { fontSize: 13 })}{t('securedB2')}</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 700, color: (cap.assets?.securedPct ?? 0) >= 100 ? ws.green : ws.amber }}>{cap.assets?.securedPct ?? 0}%</Typography></Stack>
                <WsBar value={cap.assets?.securedPct ?? 0} color={(cap.assets?.securedPct ?? 0) >= 100 ? ws.green : ws.amber} height={5} />
                <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 0.25 }}>{cap.assets?.securedToB2 ?? 0} {t('ofWord')} {cap.assets?.total ?? 0} {t('originalsVerified')}</Typography>
              </Box>
            </Stack>

            {/* One Desk DIT — speilings-destinasjoner + hash-verifiserte kopier */}
            {dit?.hasBackup && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${ws.borderSoft}` }}>
                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" gap={1}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 150 }}>
                    {wsIcon('Computer', { fontSize: 15, color: ws.textDim })}
                    <Box>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{t('oneDeskMirror')}</Typography>
                      <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{dit.oneDeskHosts?.length ? dit.oneDeskHosts.join(', ') : t('backupHelper')}</Typography>
                    </Box>
                  </Stack>
                  {(dit.destinations || []).map((d: any) => {
                    const ok = d.status === 'online' || d.status === 'connected' || d.status === 'ok' || d.status === 'active';
                    const ic = d.type === 'cloud' || d.storage === 'cloud' || d.cloud ? 'CloudDone' : d.type === 'raid' || d.storage === 'raid' ? 'Storage' : 'Save';
                    return (
                      <Stack key={d.id} direction="row" spacing={0.5} alignItems="center" sx={{ px: 1, py: 0.4, borderRadius: 1, bgcolor: ws.panelAlt }}>
                        {wsIcon(ic, { fontSize: 13, color: ws.textDim })}
                        <Typography sx={{ fontSize: 11, color: ws.text }}>{d.label || d.type || t('destination')}</Typography>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ok ? ws.green : ws.textFaint }} />
                      </Stack>
                    );
                  })}
                  <Box sx={{ flex: 1 }} />
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: dit.jobs?.failed ? ws.amber : ws.green }}>
                      {dit.jobs?.verified ?? 0} {t('hashVerified')}{dit.jobs?.copying ? ` · ${dit.jobs.copying} ${t('copyingWord')}` : ''}{dit.jobs?.failed ? ` · ${dit.jobs.failed} ${t('failedWord')}` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{dit.jobs?.completed ?? 0} {t('ofWord')} {dit.jobs?.total ?? 0} {t('jobsWord')} · xxHash64</Typography>
                  </Box>
                </Stack>

                {/* Per-take-rollup — hver take speilet+verifisert til N destinasjoner */}
                {Array.isArray(dit.takes) && dit.takes.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography sx={{ fontSize: 10, color: ws.textFaint, mb: 0.5 }}>
                      {dit.takes.length} take{dit.takes.length > 1 ? 's' : ''} · {dit.takes.filter((x: any) => x.fullyVerified).length} {t('fullyVerified')}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {dit.takes.slice(0, 12).map((t: any) => (
                        <Stack key={t.takeId} direction="row" spacing={0.4} alignItems="center" sx={{ px: 0.75, py: 0.25, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: t.failed ? ws.red : t.fullyVerified ? ws.green : t.copying ? ws.amber : ws.textFaint }} />
                          <Typography sx={{ fontSize: 10, color: ws.textDim, maxWidth: 90 }} noWrap>{t.takeId}</Typography>
                          <Typography sx={{ fontSize: 9.5, color: ws.textFaint }}>{t.verified}/{t.total}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}
          </WsCard>
        )}

        {/* Dagens tidslinje */}
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle
            icon={<AccessTime sx={{ fontSize: 18, color: ws.textDim }} />}
            title={t('todayTimeline')}
            action={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button size="small" onClick={() => go('produksjonskart')} sx={{ color: ws.text, textTransform: 'none', minWidth: 0 }}>{t('today')}</Button>
              </Stack>
            }
          />
          {/* Ruler */}
          <Box sx={{ position: 'relative', mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ px: 0.5 }}>
              {RULER.map((t) => <Typography key={t} sx={{ fontSize: 11, color: ws.textFaint }}>{t}</Typography>)}
            </Stack>
            <Box sx={{ position: 'relative', height: 1, bgcolor: ws.border, mt: 0.5 }}>
              {nowVisible && (
                // «Nå»-markør: etikett over linjalen + kort tick. Kort tick (ikke
                // en 60px-linje) så den ikke vasker over fase-kortenes tekst under.
                <Box sx={{ position: 'absolute', left: `${nowPct}%`, top: -18, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Chip size="small" label={nowLabel} sx={{ height: 18, bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 800, fontSize: 11 }} />
                  <Box sx={{ width: 1, height: 12, bgcolor: ws.accent, mt: 0.5, opacity: 0.7 }} />
                </Box>
              )}
            </Box>
          </Box>
          {/* Faser */}
          <Stack direction="row" spacing={1.25} sx={{ overflowX: 'auto', pb: 0.5 }}>
            {phaseItems.map((p) => (
              <Box key={p.label} sx={{
                minWidth: 150, p: 1.25, borderRadius: `${ws.radiusSm}px`,
                bgcolor: p.active ? ws.accentSoft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${p.active ? ws.accentBorder : ws.borderSoft}`,
              }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  {wsIcon(p.icon, { fontSize: 17, color: p.color })}
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{p.label}</Typography>
                </Stack>
                <Typography sx={{ fontSize: 11.5, color: ws.textDim, mt: 0.5 }}>{p.time}</Typography>
              </Box>
            ))}
          </Stack>
        </WsCard>

        {/* Samkjøringsboard */}
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle icon={<ViewKanban sx={{ fontSize: 18, color: ws.textDim }} />} title={t('syncBoard')} />
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto' }}>
            {boardCols.map((col) => (
              <Box key={col.role} sx={{ minWidth: 220, flex: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                  {crewIcon(col.icon, { fontSize: 15, color: ws.textDim })}
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ws.textDim }}>{col.role}</Typography>
                </Stack>
                <Stack spacing={1}>
                  {col.tasks.map((task, i) => (
                    <Box key={task.id || i} sx={{
                      p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${ws.borderSoft}`,
                    }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: ws.text }}>{task.t}</Typography>
                          {task.time && <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.25 }}>{task.time}</Typography>}
                        </Box>
                        <Box onClick={() => task.real && toggleTask(task.id, task.done ? 'done' : 'todo')} sx={{ cursor: task.real ? 'pointer' : 'default', display: 'flex' }}>
                          {task.done
                            ? <CheckCircle sx={{ fontSize: 18, color: ws.green }} />
                            : <RadioButtonUnchecked sx={{ fontSize: 18, color: ws.textFaint }} />}
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                  <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={() => addTask(col.crew)} disabled={!isReal} sx={{ color: ws.textDim, textTransform: 'none', justifyContent: 'flex-start' }}>
                    {t('addTaskBtn')}
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </WsCard>

        {/* Bunn-rad: Team Sync / Sjekkliste / Referanser */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>{t('teamSyncTitle')}</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <WsRing value={syncPct} size={104} label={`${syncPct}%`} sub={t('ready')} color={syncPct >= 80 ? ws.green : ws.amber} />
              <Stack spacing={0.75} sx={{ flex: 1 }}>
                {syncItems.length === 0 && (
                  <Typography sx={{ fontSize: 12, color: ws.textFaint }}>{t('noSyncData')}</Typography>
                )}
                {syncItems.map((s, i) => (
                  <Stack key={i} direction="row" spacing={0.75} alignItems="center">
                    {s.ok ? <CheckCircle sx={{ fontSize: 16, color: ws.green }} /> : <RadioButtonUnchecked sx={{ fontSize: 16, color: ws.textFaint }} />}
                    <Typography sx={{ fontSize: 12.5, color: ws.text }}>{s.t}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
            <Button fullWidth size="small" onClick={() => go('prosjektplan')} sx={{ mt: 1.5, color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.border}` }}>{t('seeDetails')}</Button>
          </WsCard>

          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>{t('checklistTitle')}</Typography>
            <Stack spacing={1}>
              {checkItems.map((c, i) => (
                <Stack key={c.id || i} direction="row" spacing={0.75} alignItems="center" onClick={() => c.real && toggleCheck(c.id, c.ok)} sx={{ cursor: c.real ? 'pointer' : 'default' }}>
                  {c.ok ? <CheckCircle sx={{ fontSize: 17, color: ws.green }} /> : <Warning sx={{ fontSize: 17, color: ws.amber }} />}
                  <Typography sx={{ fontSize: 12.5, color: ws.text }}>{c.t}</Typography>
                </Stack>
              ))}
            </Stack>
            <Button fullWidth size="small" onClick={addCheck} disabled={!isReal} sx={{ mt: 1.5, color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.border}` }}>{isReal ? t('addCheckBtn') : t('seeAll')}</Button>
          </WsCard>

          <WsCard>
            <WsSectionTitle title={wsCategory === 'music' ? t('refsTitleMusic') : t('refsTitle')} action={<Button size="small" onClick={() => go(wsCategory === 'music' ? 'moodboard' : 'shotlist')} sx={{ color: ws.accent, textTransform: 'none' }}>{t('seeAll')}</Button>} />
            <WsImageGrid columns={3} addLabel={t('addReference')} images={refs.images} onUpload={refs.onUpload} />
          </WsCard>
        </Box>
      </Box>

      {/* ───────── Capture-aktivitet + Team Chat (høyre) ───────── */}
      <Box sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
        {(isReal ? activity.length > 0 : true) && (
          <WsCard sx={{ mb: 2 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25 }}>
              {wsIcon('Bolt', { fontSize: 15, color: ws.textDim })}
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('captureActivity')}</Typography>
              {capLive && <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.green }} /><Typography sx={{ fontSize: 10, color: ws.green, fontWeight: 700 }}>LIVE</Typography></Stack>}
            </Stack>
            <Stack spacing={0.25} sx={{ maxHeight: 280, overflowY: 'auto' }}>
              {(isReal ? activity : [
                { id: 'd1', type: 'asset_added', filename: 'A7IV_1188.CR3', createdAt: new Date(Date.now() - 30000).toISOString() },
                { id: 'd2', type: 'flagged_for_client', filename: 'A7IV_1184.CR3', createdAt: new Date(Date.now() - 180000).toISOString() },
                { id: 'd3', type: 'handoff_triggered', filename: null, createdAt: new Date(Date.now() - 900000).toISOString() },
              ]).map((ev: any) => {
                const m = activityMeta(ev.type, t);
                return (
                  <Stack key={ev.id} direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.65, px: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    {wsIcon(m.icon, { fontSize: 15, color: ws.textDim })}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 12, color: ws.text, lineHeight: 1.35 }}>
                        {m.label}{ev.filename ? <Typography component="span" sx={{ color: ws.textDim }}> · {ev.filename}</Typography> : null}
                      </Typography>
                      <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{ev.actorName ? `${ev.actorName} · ` : ''}{timeAgo(ev.createdAt, t)}</Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </WsCard>
        )}
        <WorkspaceChatPanel projectId={projectId} category={wsCategory} />
      </Box>
    </Stack>
  );
};

export default OversiktTab;
