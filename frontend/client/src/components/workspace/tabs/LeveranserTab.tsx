// @ts-nocheck
/**
 * LeveranserTab — design #7 (Deliveries), dark CreatorHub.
 * Leveranse-liste + leveranse-detalj (video/preview opplastbar + progress-stepper
 * + sjekkliste) + Delivery progress / Client feedback / Activity.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, Avatar, IconButton, TextField, Menu, MenuItem, Divider } from '@mui/material';
import Add from '@mui/icons-material/Add';
import CheckCircle from '@mui/icons-material/CheckCircle';
import LocalShipping from '@mui/icons-material/LocalShipping';
import Cached from '@mui/icons-material/Cached';
import ImageIcon from '@mui/icons-material/Image';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsRing, WsPills, WsTag, WsImageGrid, WsModal, WsErrorState, WsPageTitle } from '../ui';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from '../wsLocale';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab).
const T: WsDict = {
  newBtn: { no: 'Ny', en: 'New' },
  emptyList: { no: 'Ingen leveranser ennå. Trykk «Ny» for å legge til.', en: 'No deliverables yet. Click "New" to add one.' },
  due: { no: 'Frist', en: 'Due' },
  markDone: { no: 'Marker som ferdig', en: 'Mark as done' },
  uploadVersion: { no: 'Last opp versjon (video/preview)', en: 'Upload version (video/preview)' },
  selections: { no: 'valg', en: 'selections' },
  comments: { no: 'kommentarer', en: 'comments' },
  markApproved: { no: 'Marker godkjent', en: 'Mark approved' },
  stepDone: { no: 'Ferdig', en: 'Done' },
  clientGallery: { no: 'Klient-galleri (Showcase)', en: 'Client gallery (Showcase)' },
  noGallery: { no: 'Ingen galleri publisert ennå. Opprett et klient-galleri for å dele leveransen som showcase.', en: 'No gallery published yet. Create a client gallery to share the delivery as a showcase.' },
  ready: { no: 'klar', en: 'ready' },
  shareWithClient: { no: 'Del med klient ↗', en: 'Share with client ↗' },
  editingVendor: { no: 'Redigerings-vendor', en: 'Editing vendor' },
  editing: { no: 'Redigering', en: 'Editing' },
  sent: { no: 'sendt', en: 'sent' },
  revisionsTitle: { no: 'Revisjoner', en: 'Revisions' },
  openCount: { no: 'åpne', en: 'open' },
  image: { no: 'Bilde', en: 'Image' },
  resolved: { no: 'Løst', en: 'Resolved' },
  openTag: { no: 'Åpen', en: 'Open' },
  ofCompleted: { no: 'av 5 fullført', en: 'of 5 completed' },
  seeAll: { no: 'Se alle', en: 'See all' },
  noFeedback: { no: 'Ingen klient-tilbakemeldinger ennå.', en: 'No client feedback yet.' },
  client: { no: 'Klient', en: 'Client' },
  act1: { no: 'lastet opp versjon 1', en: 'uploaded version 1' },
  act2: { no: 'la til et notat', en: 'added a note' },
  act3: { no: 'markerte task som ferdig', en: 'marked a task as done' },
  allFeedback: { no: 'All klient-feedback', en: 'All client feedback' },
  noGalleryApprove: { no: 'Ingen klient-galleri å markere som godkjent ennå.', en: 'No client gallery to mark as approved yet.' },
  approveConfirm: { no: 'Marker leveransen som godkjent (fullfør galleriet)?', en: 'Mark the delivery as approved (complete the gallery)?' },
  couldNotMark: { no: 'Kunne ikke markere', en: 'Could not mark' },
  promptTitle: { no: 'Ny leveranse (tittel):', en: 'New deliverable (title):' },
  promptType: { no: 'Type (f.eks. Video / Online gallery):', en: 'Type (e.g. Video / Online gallery):' },
  couldNotAdd: { no: 'Kunne ikke legge til', en: 'Could not add' },
  noOpenDeliverables: { no: 'Ingen åpne leveranser å markere som ferdig.', en: 'No open deliverables to mark as done.' },
  deliverConfirm: { no: 'Marker «{title}» som levert?', en: 'Mark "{title}" as delivered?' },
  loadError: { no: 'Kunne ikke laste leveranser. Sjekk tilkoblingen og prøv igjen.', en: 'Could not load deliverables. Check your connection and try again.' },
  cancelBtn: { no: 'Avbryt', en: 'Cancel' },
  addBtn: { no: 'Legg til', en: 'Add' },
  newTitle: { no: 'Tittel', en: 'Title' },
  newType: { no: 'Type (f.eks. Video / Online gallery)', en: 'Type (e.g. Video / Online gallery)' },
  filterPlanned: { no: 'Planlagte', en: 'Planned' },
  filterProgress: { no: 'Pågår', en: 'In progress' },
  filterDelivered: { no: 'Levert', en: 'Delivered' },
  checklistTitle: { no: 'Leveransesjekkliste', en: 'Delivery checklist' },
  stepInProgress: { no: 'Pågår', en: 'In progress' },
  stepPending: { no: 'Venter', en: 'Pending' },
  progressWord: { no: 'Fremdrift', en: 'Progress' },
  deliveryProgress: { no: 'Leveranse-fremdrift', en: 'Delivery progress' },
  clientFeedback: { no: 'Klient-tilbakemeldinger', en: 'Client feedback' },
  activityWord: { no: 'Aktivitet', en: 'Activity' },
  editHandoff: { no: 'Editor-jobber', en: 'Editor handoff' },
  fbComment: { no: 'Kommentar', en: 'Comment' },
  fbPraise: { no: 'Ros', en: 'Praise' },
  fbQuestion: { no: 'Spørsmål', en: 'Question' },
  fbChange: { no: 'Endring', en: 'Change' },
  fbPicks: { no: 'sendte inn {n} utvalgte bilder', en: 'submitted {n} selected images' },
  fbLeft: { no: 'la igjen en kommentar', en: 'left a comment' },
  notStarted: { no: 'Ikke startet', en: 'Not started' },
  overdue: { no: 'På overtid', en: 'Overdue' },
  act4: { no: 'sendte inn 12 utvalgte bilder', en: 'submitted 12 selected images' },
  deliveredOf: { no: 'av', en: 'of' },
  approvedDone: { no: 'Godkjent av klient', en: 'Approved by client' },
  chkReady: { no: 'Klar for levering — alt på plass ✓', en: 'Ready for delivery — all done ✓' },
  chkEmpty: { no: 'Ingen sjekklistepunkter ennå — legg til nedenfor.', en: 'No checklist items yet — add below.' },
  chkAdd: { no: 'Legg til punkt…', en: 'Add item…' },
  filesWord: { no: 'Filer', en: 'Files' },
  attachFromMedia: { no: 'Vedlegg fra Media', en: 'Attach from Media' },
  noFiles: { no: 'Ingen filer vedlagt ennå — legg til fra Media-tab.', en: 'No files attached yet — add from the Media tab.' },
  removeFile: { no: 'Fjern fil', en: 'Remove file' },
  pickTitle: { no: 'Velg media-filer', en: 'Pick media files' },
  noMediaAssets: { no: 'Ingen media å velge fra ennå.', en: 'No media to pick from yet.' },
  addPicked: { no: 'Legg til valgte', en: 'Attach selected' },
  pickedCount: { no: 'valgt', en: 'selected' },
  pickSearch: { no: 'Søk i filnavn…', en: 'Search filenames…' },
  previewLarge: { no: 'Åpne i stor visning', en: 'Open large preview' },
  zoomOneToOne: { no: '1:1-zoom', en: 'Zoom 1:1' },
  copyLink: { no: 'Kopier lenke', en: 'Copy link' },
  moveBack: { no: 'Flytt bakover', en: 'Move back' },
  moveForward: { no: 'Flytt fremover', en: 'Move forward' },
  couldNotAttach: { no: 'Kunne ikke lagre filer', en: 'Could not save files' },
};

const STATUS_LABEL: Record<string, [string, string]> = {
  not_started: ['Ikke startet', 'neutral'], in_progress: ['Pågår', 'amber'],
  completed: ['Fullført', 'green'], delivered: ['Levert', 'green'], archived: ['Arkivert', 'neutral'],
};

/** Relativ tid: «i dag HH:MM», «i går», «dd.mm HH:MM». */
const relTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dayDiff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (dayDiff === 0) return `i dag ${hm}`;
  if (dayDiff === 1) return 'i går';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
};
const fbLabel = (type?: string, fallback = 'Kommentar') => {
  const m: Record<string, string> = { praise: 'Ros', question: 'Spørsmål', change: 'Endring', kommentar: 'Kommentar' };
  return m[String(type || '').toLowerCase()] || type || fallback;
};

/** Lokal type-gjett (fallback for demo / når serveren ikke svarer). */
const DL_TYPE_RULES: [string, string[]][] = [
  ['Video', ['teaser', 'trailer', 'film', 'reel', 'klipp', 'video', 'highlight', 'dokumentar']],
  ['Foto', ['galleri', 'album', 'foto', 'bilder', 'photos', 'portrett']],
  ['Lyd', ['lyd', 'audio', 'miks', 'podcast', 'master']],
  ['Dokument', ['dokument', 'pdf', 'kontrakt', 'rapport']],
  ['Digital', ['download', 'sosiale', 'reels', 'story']],
  ['Fysisk', ['usb', 'minne', 'print', 'kort']],
];
const dlTypeGuessLocal = (title: string) => {
  const l = title.toLowerCase();
  for (const [t, words] of DL_TYPE_RULES) if (words.some((w) => l.includes(w))) return { type: t, confidence: 85 };
  return null;
};
/** Canned sjekkliste-forslag pr. type (demo når det ikke finnes lærte data). */
const DL_SUG_FALLBACK: Record<string, string[]> = {
  Video: ['Endelig eksport i riktig format', 'Lydnivåer kontrollert', 'Fargegradering OK'],
  Foto: ['Filer levert i full størrelse', 'Fargejustering OK', 'Tittel/nummerering'],
  Lyd: ['Master i riktig format', 'Loudness-sjekk', 'Metadata'],
  Dokument: ['PDF-klar', 'Spell sjekket'],
};

const DELIVERABLES = [
  ['Teaser Trailer (60s)', 'Video', 'In progress', 'amber', '18. sep'],
  ['Highlight Film (6-8 min)', 'Video', 'In progress', 'amber', '28. sep', true],
  ['Full Wedding Film (45-60 min)', 'Video', 'Not started', 'neutral', '02. nov'],
  ['Photo Gallery', 'Online gallery', 'Completed', 'green', '20. sep'],
  ['Edited Photos (400)', 'Digital download', 'Not started', 'neutral', '25. sep'],
  ['Social Media Reels (3x)', 'Video', 'Not started', 'neutral', '18. sep'],
  ['USB Drive', 'Physical', 'Not started', 'neutral', '05. nov'],
];
const STEPS = ['Redigering', 'Intern gjennomgang', 'Kundegjennomgang', 'Revisjoner', 'Godkjent'];
const CHECKLIST = [['Grovklipp ferdig', true], ['Lydmiks ferdig', true], ['Fargekorrigering', false], ['Titler & grafikk', false], ['Endelig eksport', false], ['QC & levering', false]];
// Demo-vedlegg kun på /workspace/sample — ekte prosjekter leser d.raw.files.
const DEMO_FILES: Record<string, { refId: string; name: string; url: string | null }[]> = {
  'Teaser Trailer (60s)': [{ refId: 'demo-1', name: 'capture_0412.jpg', url: null }, { refId: 'demo-2', name: 'capture_0440.jpg', url: null }],
  'Highlight Film (6-8 min)': [{ refId: 'demo-3', name: 'highlight_v2_final.mov', url: null }],
  'Photo Gallery': [{ refId: 'demo-4', name: 'galleri_web.zip', url: null }],
};

const LeveranserTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [filter, setFilter] = useState('planned');
  const [real, setReal] = useState<any[] | null>(null);
  const isReal = projectId && projectId !== 'sample';
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const dl = wsDateLocale(locale);

  const [galleries, setGalleries] = useState<any[]>([]);
  const [selIdx, setSelIdx] = useState(0);
  const [dlg, setDlg] = useState<{ title: string; type: string } | null>(null);
  const [typeGuess, setTypeGuess] = useState<{ type: string; confidence: number } | null>(null);
  const [chkSug, setChkSug] = useState<string[]>([]);
  // Per-leveranse sjekkliste (persistert i deliverables.checklist for ekte prosjekter).
  const [chk, setChk] = useState<{ id: string; label: string; done: boolean }[]>([]);
  const [chkText, setChkText] = useState('');
  const persistChk = (next: { id: string; label: string; done: boolean }[]) => {
    setChk(next);
    if (!isReal || !sel?.id) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(sel.id)}`, { method: 'PATCH', body: { checklist: next.map((c) => ({ id: c.id, label: c.label, done: c.done })) } }).then(() => load()).catch(() => {});
  };
  const toggleChk = (i: number) => persistChk(chk.map((c, j) => (j === i ? { ...c, done: !c.done } : c)));
  const addChk = (labelArg?: string) => {
    const label = (labelArg ?? chkText).trim(); if (!label) return;
    persistChk([...chk, { id: crypto.randomUUID(), label, done: false }]);
    if (!labelArg) setChkText('');
  };
  const delChk = (i: number) => persistChk(chk.filter((_, j) => j !== i));
  const chkDone = chk.filter((c) => c.done).length;
  const chkReady = chk.length > 0 && chkDone === chk.length;
  // Vedlagte filer (persistert i deliverables.files — egen kolonne lagt til backend).
  const [dlFiles, setDlFiles] = useState<any[]>([]);
  const [filePicker, setFilePicker] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [pickSel, setPickSel] = useState<Set<string>>(new Set());
  const [pickQ, setPickQ] = useState(''); // søkefelt i pickeren
  const [viewFile, setViewFile] = useState<number | null>(null); // åpen fil i lightbox
  const [lbZoom, setLbZoom] = useState(false); // 1:1-visning i lightbox
  const [fileCtx, setFileCtx] = useState<{ x: number; y: number; i: number } | null>(null); // høyreklikk-meny på vedlegg
  const attachedIds = new Set(dlFiles.map((f) => String(f.refId)));
  const patchFiles = (next: any[]) => {
    setDlFiles(next);
    if (!isReal || !sel?.id) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(sel.id)}`, { method: 'PATCH', body: { files: next } })
      .catch((e: any) => { window.alert(e?.message || t('couldNotAttach')); setDlFiles(dlFiles); });
  };
  const detachFile = (i: number) => patchFiles(dlFiles.filter((_, j) => j !== i));
  const moveFile = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= dlFiles.length) return;
    const n = [...dlFiles];
    [n[i], n[j]] = [n[j], n[i]];
    patchFiles(n);
  };
  const openFilePicker = () => {
    setFilePicker(true); setPickSel(new Set()); setPickQ('');
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media`)
      .then((r: any) => setMediaAssets(Array.isArray(r?.assets) ? r.assets : []))
      .catch(() => setMediaAssets([]));
  };
  const togglePick = (id: string) => setPickSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const attachPicked = async () => {
    if (!isReal || !sel?.id) return;
    const added = mediaAssets
      .filter((a) => pickSel.has(a.id) && !attachedIds.has(String(a.id)))
      .map((a: any) => ({ kind: 'media', refId: a.id, name: a.filename || 'Fil', url: a.previewUrl || null, at: new Date().toISOString() }));
    if (added.length === 0) return;
    const next = [...dlFiles, ...added];
    setDlFiles(next); setFilePicker(false);
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(sel.id)}`, { method: 'PATCH', body: { files: next } }); loadDeliverables(); }
    catch (e: any) { setDlFiles(dlFiles); window.alert(e?.message || t('couldNotAttach')); }
  };
  const stepFile = (v: number, dir: -1 | 1) => {
    const n = v + dir;
    setLbZoom(false);
    setViewFile(n >= 0 && n < dlFiles.length ? n : v);
  };
  // Tastatur i lightbox (Esc håndteres av WsModal):
  //   ←/→       blar vedlagte filer
  //   + / −      1:1-zoom inn / ut
  //   Delete     fjerner gjeldende fil og lukker
  //   Home/End   hopper til første / siste fil
  useEffect(() => {
    if (viewFile == null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') stepFile(viewFile, -1);
      else if (e.key === 'ArrowRight') stepFile(viewFile, 1);
      else if (e.key === '+' || e.key === '=') setLbZoom(true);
      else if (e.key === '-' || e.key === '_') setLbZoom(false);
      else if (e.key === 'Delete' || e.key === 'Backspace') { detachFile(viewFile); setViewFile(null); }
      else if (e.key === 'Home') { setLbZoom(false); setViewFile(0); }
      else if (e.key === 'End') { setLbZoom(false); setViewFile(dlFiles.length - 1); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewFile, dlFiles.length]);
  const [delivery, setDelivery] = useState<{ phase: number; signals: any } | null>(null);
  const [editingJobs, setEditingJobs] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [fbModal, setFbModal] = useState(false);
  const [loadErr, setLoadErr] = useState(false); // feil ved primær-lasting (leveranser)
  // Primær-fetch: leveranseliste. Egen fn så onRetry kan kjøre den på nytt.
  const loadDeliverables = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables`)
      .then((r: any) => { setReal(Array.isArray(r?.deliverables) ? r.deliverables : []); setLoadErr(false); })
      .catch(() => setLoadErr(true));
  };
  const load = () => {
    if (!isReal) return;
    loadDeliverables();
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/galleries`)
      .then((r: any) => setGalleries(Array.isArray(r?.galleries) ? r.galleries : []))
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/delivery-status`)
      .then((r: any) => { if (r && typeof r.phase === 'number') setDelivery({ phase: r.phase, signals: r.signals || {} }); })
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/editing-jobs`)
      .then((r: any) => setEditingJobs(Array.isArray(r?.jobs) ? r.jobs : []))
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/revision-requests`)
      .then((r: any) => setRevisions(Array.isArray(r?.requests) ? r.requests : []))
      .catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/client-feedback`)
      .then((r: any) => { setFeedback(Array.isArray(r?.feedback) ? r.feedback : []); setActivity(Array.isArray(r?.activity) ? r.activity : []); })
      .catch(() => {});
  };
  const EJ_TONE: Record<string, string> = { requested: 'amber', pending: 'amber', accepted: 'blue', in_progress: 'blue', delivered: 'green', completed: 'green', paid: 'green' };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  // Aktiv fase: ekte (utledet fra showcase) eller demo = 1.
  const activePhase = delivery ? delivery.phase : 1;
  const sig = delivery?.signals || {};

  const markApproved = async () => {
    const g = galleries[0];
    if (!g?.id) { window.alert(t('noGalleryApprove')); return; }
    if (!window.confirm(t('approveConfirm'))) return;
    try { await apiRequest(`/api/photographer/galleries/${g.id}/mark-complete`, { method: 'POST' }); load(); }
    catch (e: any) { window.alert(e?.message || t('couldNotMark')); }
  };

  const shareGallery = (sharePath: string) => {
    if (!sharePath) return;
    const url = `${window.location.origin}${sharePath}`;
    try { navigator.clipboard?.writeText(url); } catch { /* ignore */ }
    window.open(url, '_blank');
  };

  const saveDeliverable = async () => {
    if (!isReal || !dlg) return;
    const title = dlg.title.trim(); if (!title) { setDlg(null); return; }
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables`, { method: 'POST', body: { title, type: dlg.type.trim() || null } }); setDlg(null); load(); }
    catch (e: any) { window.alert(e?.message || t('couldNotAdd')); }
  };

  const markDeliverableDone = async () => {
    if (!isReal) return;
    const id = sel?.id;
    if (!id || ['delivered', 'done', 'completed'].includes(sel?.statusKey)) { window.alert(t('noOpenDeliverables')); return; }
    if (!window.confirm(t('deliverConfirm').replace('{title}', sel?.title || '?'))) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables/${id}`, { method: 'PATCH', body: { status: 'delivered' } }); load(); }
    catch (e: any) { window.alert(e?.message || t('couldNotMark')); }
  };

  // Ekte prosjekt → ekte data (tomt = tom-tilstand). Mock kun på /workspace/sample.
  const SAMPLE_TO_KEY = { 'In progress': 'in_progress', 'Not started': 'not_started', 'Completed': 'completed', 'Delivered': 'delivered' } as Record<string, string>;
  const base = isReal
    ? (real || []).map((d: any) => {
        const dueDays = d.dueDate ? Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / 86400000) : null;
        const deliveredish = ['delivered', 'done', 'completed', 'archived'].includes(d.status);
        return { id: d.id, raw: d, title: d.title, type: d.type || '', statusKey: d.status, label: (STATUS_LABEL[d.status] || ['—', 'neutral'])[0], tone: (STATUS_LABEL[d.status] || ['—', 'neutral'])[1], due: d.dueDate ? new Date(d.dueDate).toLocaleDateString(dl, { day: 'numeric', month: 'short' }) : '—', overdue: !!d.dueDate && !deliveredish && dueDays != null && dueDays < 0, soon: !!d.dueDate && !deliveredish && dueDays != null && dueDays >= 0 && dueDays <= 5 };
      })
    : DELIVERABLES.map((d) => ({ id: null, raw: null, title: d[0], type: d[1], statusKey: SAMPLE_TO_KEY[d[2]] || 'not_started', label: d[2], tone: d[3], due: d[4], overdue: false }));
  const pillCounts = {
    planned: base.filter((x) => x.statusKey === 'not_started').length,
    progress: base.filter((x) => x.statusKey === 'in_progress').length,
    delivered: base.filter((x) => ['delivered', 'completed', 'archived'].includes(x.statusKey)).length,
  };
  const shown = base.filter((x) => (filter === 'planned' ? x.statusKey === 'not_started' : filter === 'progress' ? x.statusKey === 'in_progress' : ['delivered', 'completed', 'archived'].includes(x.statusKey)));
  const sel = shown[Math.min(selIdx, Math.max(0, shown.length - 1))] || shown[0] || null;
  // Fremdrift fra leveransene selv (ekte tall i demo og real).
  const delDone = base.filter((x) => ['delivered', 'completed', 'archived'].includes(x.statusKey)).length;
  const delProg = base.filter((x) => x.statusKey === 'in_progress').length;
  const delPlanned = base.filter((x) => x.statusKey === 'not_started').length;
  const delOverdue = isReal
    ? base.filter((x) => x.raw?.dueDate && new Date(x.raw.dueDate).getTime() < Date.now() && !['delivered', 'completed', 'archived'].includes(x.statusKey)).length
    : 0;
  const delPct = base.length ? Math.round((delDone / base.length) * 100) : 0;
  const revisionsOpen = revisions.filter((r) => r.status !== 'resolved' && r.status !== 'done').length;
  // Sjekkliste + vedlagte filer per sel (når leveransen endres, hent dens punkter).
  useEffect(() => {
    const own = sel?.raw?.checklist;
    setChk(Array.isArray(own) && own.length ? own.map((c: any) => ({ id: c.id || c.label || String(Math.random()), label: c.label || c, done: !!c.done })) : (isReal ? [] : CHECKLIST.map(([t, ok], i) => ({ id: `w${i}`, label: t, done: !!ok }))));
    setDlFiles(isReal ? (Array.isArray(sel?.raw?.files) ? sel.raw.files : []) : (DEMO_FILES[sel?.title || ''] || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);
  // Sjekkliste-forslag pr. type (lært server-side; fallback-demo lokalt).
  useEffect(() => {
    setChkSug([]);
    const type = sel?.type || '';
    if (isReal) {
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables/suggest-checklist`, { method: 'POST', body: { type } })
        .then((r: any) => setChkSug(Array.isArray(r?.labels) ? r.labels : []))
        .catch(() => setChkSug(DL_SUG_FALLBACK[type] || []));
    } else {
      setChkSug(DL_SUG_FALLBACK[type] || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);
  // Type-gjett mens man skriver tittel i Ny-dialog (debounced, ML + regel-fallback).
  useEffect(() => {
    if (!dlg?.title?.trim()) { setTypeGuess(null); return; }
    const t = window.setTimeout(() => {
      if (isReal) {
        apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables/guess-type`, { method: 'POST', body: { title: dlg!.title } })
          .then((r: any) => setTypeGuess(r && r.type ? r : null))
          .catch(() => setTypeGuess(dlTypeGuessLocal(dlg!.title)));
      } else {
        setTypeGuess(dlTypeGuessLocal(dlg!.title));
      }
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlg?.title]);

  return (
    <Stack direction="column" spacing={2}>
      <style>{`
        @keyframes wsStepPop { 0% { transform: scale(.55); opacity: 0; } 60% { transform: scale(1.18); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes wsStepPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,.45); } 50% { box-shadow: 0 0 0 7px rgba(99,102,241,0); } }
        @keyframes wsLineShine { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
        @keyframes wsCheckPop { 0% { transform: scale(.5); opacity: .3; } 60% { transform: scale(1.3); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes wsReadyShine { 0% { transform: translateX(-130%); } 100% { transform: translateX(400%); } }
        .ws-step-pop { animation: wsStepPop .35s cubic-bezier(.22,1,.36,1) both; }
        .ws-step-active { animation: wsStepPulse 2s ease-out infinite; }
        .ws-line-shine { position: absolute; top: 0; bottom: 0; width: 40%; background: linear-gradient(105deg, transparent, rgba(255,255,255,.5), transparent); animation: wsLineShine 1.6s ease-in-out infinite; }
        .ws-check-pop { transform-origin: center; animation: wsCheckPop .3s cubic-bezier(.22,1,.36,1); }
        .ws-ready-box { position: relative; overflow: hidden; }
        .ws-ready-box::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 45%; background: linear-gradient(105deg, transparent, rgba(52,211,153,.25), transparent); animation: wsReadyShine 2.8s ease-in-out infinite; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .ws-step-pop, .ws-step-active, .ws-line-shine, .ws-check-pop, .ws-ready-box::after { animation: none; } }
      `}</style>
      <Box sx={{ width: '100%' }}>
        <WsPageTitle
          icon={<LocalShipping sx={{ fontSize: 21, color: '#fff' }} />}
          title="Leveranser"
          sub={`${base.length} leveranser · ${pillCounts.planned + pillCounts.progress} åpne · ${pillCounts.delivered} levert`}
          actions={<>
            <IconButton size="small" title="Frisk opp" onClick={load} sx={{ color: ws.textDim }}><Cached sx={{ fontSize: 17 }} /></IconButton>
            <Button size="small" variant="contained" onClick={() => setDlg({ title: '', type: 'Video' })} disabled={!isReal} startIcon={<Add sx={{ fontSize: 15 }} />} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('newBtn')}</Button>
          </>}
        />
      </Box>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
      {/* Liste */}
      <Box sx={{ width: { xs: '100%', lg: 300 }, flexShrink: 0 }}>
        <WsCard>
          <Box sx={{ mb: 1.5 }}><WsPills items={[
            { key: 'planned', label: `${t('filterPlanned')} ${pillCounts.planned}` },
            { key: 'progress', label: `${t('filterProgress')} ${pillCounts.progress}` },
            { key: 'delivered', label: `${t('filterDelivered')} ${pillCounts.delivered}` },
          ]} value={filter} onChange={setFilter} /></Box>
          <Stack spacing={0.75}>
            {shown.length === 0 && (isReal && loadErr
              ? <WsErrorState message={t('loadError')} onRetry={loadDeliverables} />
              : <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 2, textAlign: 'center' }}>{t('emptyList')}</Typography>)}
            {shown.map((x, i) => (
              <Box key={x.id || x.title} onClick={() => setSelIdx(i)} sx={{ p: 1.25, borderRadius: 2, cursor: 'pointer', border: `1px solid ${i === selIdx ? ws.accentBorder : ws.borderSoft}`, bgcolor: i === selIdx ? ws.accentSoft : 'transparent', '&:hover': { borderColor: ws.accentBorder } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box><Typography sx={{ fontSize: 13, fontWeight: 700, color: i === selIdx ? ws.accent : ws.text }}>{x.title}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{x.type}</Typography></Box>
                  <WsTag label={x.label} tone={x.tone} />
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography sx={{ fontSize: 11, color: ws.textDim }}>{t('due')} {x.due}</Typography>
                  {x.soon ? <Typography sx={{ fontSize: 10, fontWeight: 800, color: ws.amber }}>{t('daysLeft').replace('{n}', String(Math.max(1, Math.ceil((new Date(x.raw.dueDate).getTime() - Date.now()) / 86400000))))}</Typography> : null}
                  {x.overdue ? <Typography sx={{ fontSize: 10, fontWeight: 800, color: ws.red }}>{t('overdue')}!</Typography> : null}
                </Stack>
                <Box sx={{ mt: 0.75, height: 3, borderRadius: 999, bgcolor: ws.panelInput, overflow: 'hidden' }}>
                  <Box sx={{ width: x.statusKey === 'delivered' || x.statusKey === 'completed' || x.statusKey === 'archived' ? '100%' : x.statusKey === 'in_progress' ? '66%' : '33%', height: '100%', borderRadius: 999, bgcolor: x.statusKey === 'delivered' || x.statusKey === 'completed' || x.statusKey === 'archived' ? ws.green : x.statusKey === 'in_progress' ? ws.amber : ws.textFaint, transition: 'width .4s ease' }} />
                </Box>
              </Box>
            ))}
          </Stack>
        </WsCard>
      </Box>

      {/* Detalj */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center"><Typography sx={{ fontSize: 18, fontWeight: 800 }}>{sel?.title || 'Velg en leveranse'}</Typography>{sel && <WsTag label={sel.label} tone={sel.tone} />}</Stack>
          <Button size="small" startIcon={<CheckCircle sx={{ fontSize: 16 }} />} onClick={markDeliverableDone} disabled={!isReal || !sel} sx={{ color: ws.green, textTransform: 'none', border: `1px solid ${ws.greenSoft}` }}>{t('markDone')}</Button>
        </Stack>

        <WsCard sx={{ mb: 2 }}>
          <WsImageGrid columns={1} ratio="16 / 9" addLabel={t('uploadVersion')} />
        </WsCard>

        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t('filesWord')} ({dlFiles.length})</Typography>
            <Button size="small" startIcon={<ImageIcon sx={{ fontSize: 15 }} />} onClick={openFilePicker} disabled={!isReal || !sel} sx={{ color: ws.accent, textTransform: 'none', border: `1px solid ${ws.accentBorder}` }}>{t('attachFromMedia')}</Button>
          </Stack>
          {dlFiles.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: ws.textDim }}>{t('noFiles')}</Typography>
          ) : (
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }} alignItems="center">
              {dlFiles.map((f, i) => (
                <Box key={f.refId || i} onClick={() => setViewFile(i)} onContextMenu={(e) => { e.preventDefault(); setFileCtx({ x: e.clientX, y: e.clientY, i }); }} title={f.name || 'Fil'} sx={{ position: 'relative', width: 40, height: 40, borderRadius: 1, border: `1px solid ${ws.borderSoft}`, bgcolor: ws.panelInput, overflow: 'hidden', cursor: 'zoom-in', '&:hover': { borderColor: ws.accentBorder, '& .de-ctrls': { opacity: 1 } } }}>
                  {f.url
                    ? <Box component="img" src={f.url} alt={f.name || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Stack sx={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <ImageIcon sx={{ fontSize: 16, color: ws.textFaint }} />
                      </Stack>}
                  <Box className="de-ctrls" component="span" onClick={(e) => e.stopPropagation()} sx={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', px: 0.6, pt: 0.4, opacity: 0, transition: 'opacity .15s', lineHeight: 1 }}>
                    <Box component="span" onClick={() => moveFile(i, -1)} title="Flytt bakover" sx={{ width: 15, height: 15, borderRadius: '50%', bgcolor: 'rgba(17,18,24,.82)', color: ws.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer' }}>‹</Box>
                    <Box component="span" onClick={() => moveFile(i, 1)} title="Flytt fremover" sx={{ width: 15, height: 15, borderRadius: '50%', bgcolor: 'rgba(17,18,24,.82)', color: ws.textDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer' }}>›</Box>
                  </Box>
                  <Box className="de-rm" component="span" onClick={(e) => { e.stopPropagation(); detachFile(i); }} title={t('removeFile')} sx={{ position: 'absolute', bottom: 2, right: 3, color: '#f87171', bgcolor: 'rgba(17,18,24,.78)', borderRadius: '50%', width: 13, height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, lineHeight: 1 }}>✕</Box>
                </Box>
              ))}
            </Stack>
          )}
        </WsCard>

        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t('progressWord')}</Typography>
            {isReal && (
              <Stack direction="row" spacing={1} alignItems="center">
                {sig.hasGallery && <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{sig.selections || 0} {t('selections')} · {sig.comments || 0} {t('comments')}</Typography>}
                {activePhase < 5 && <Button size="small" onClick={markApproved} sx={{ color: ws.green, textTransform: 'none', border: `1px solid ${ws.greenSoft}` }}>{t('markApproved')}</Button>}
              </Stack>
            )}
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: 14, left: 16, right: 16, height: 2, bgcolor: ws.border }} />
            <Box sx={{ position: 'absolute', top: 14, left: 16, height: 2, bgcolor: ws.accent, width: `${Math.max(0, (activePhase - 1) / (STEPS.length - 1)) * 100}%`, maxWidth: 'calc(100% - 32px)', overflow: 'hidden' }}>
              {activePhase < STEPS.length && <Box className="ws-line-shine" />}
            </Box>
            {STEPS.map((s, i) => {
              const step = i + 1;
              const done = step < activePhase;
              const active = step === activePhase;
              let statusTxt: string;
              if (active) {
                if (step === 3) statusTxt = sig.hasGallery ? `${sig.selections || 0} ${t('selections')} · ${sig.comments || 0} ${t('comments')}` : t('noGallery');
                else if (step === 4) statusTxt = `${revisionsOpen} ${t('openCount')} ${t('revisionsTitle').toLowerCase()}`;
                else if (step === 5) statusTxt = `✓ ${t('approvedDone')}`;
                else statusTxt = t('stepInProgress');
              } else {
                statusTxt = done ? t('stepDone') : t('stepPending');
              }
              return (
                <Stack key={`${s}-${done ? 1 : 0}-${active ? 1 : 0}`} alignItems="center" spacing={0.75} sx={{ zIndex: 1, flex: 1 }}>
                  <Box className={`ws-step-pop${active ? ' ws-step-active' : ''}`} sx={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
                    bgcolor: active ? ws.accent : done ? ws.greenSoft : ws.panelSolid, color: active ? ws.accentContrast : done ? ws.green : ws.textDim,
                    border: `2px solid ${active ? ws.accent : done ? ws.green : ws.border}` }}>{done ? '✓' : step}</Box>
                  <Typography sx={{ fontSize: 11, color: active ? ws.accent : ws.textDim, fontWeight: active ? 700 : 500, textAlign: 'center' }}>{s}</Typography>
                  <Typography sx={{ fontSize: 9.5, color: active ? ws.accent : ws.textFaint, fontWeight: active ? 700 : 400, textAlign: 'center' }}>{statusTxt}</Typography>
                </Stack>
              );
            })}
          </Stack>
        </WsCard>

        <WsCard>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{sel ? `${t('checklistTitle')} — ${sel.title}` : t('checklistTitle')}</Typography>
            {chk.length > 0 && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{chkDone}/{chk.length} {t('stepDone').toLowerCase()}</Typography>}
          </Stack>
          {chkReady && (
            <Box className="ws-ready-box" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, bgcolor: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.4)', borderRadius: 1.5, px: 1.25, py: 0.75, mb: 1 }}>
              <CheckCircle sx={{ fontSize: 15, color: ws.green, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: ws.green }}>{t('chkReady')}</Typography>
            </Box>
          )}
          {chk.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: ws.textDim, mb: 1 }}>{t('chkEmpty')}</Typography>
          ) : (
            <Stack spacing={0.25} sx={{ mb: 1 }}>
              {chk.map((c, i) => (
                <Stack key={c.id} direction="row" spacing={0.75} alignItems="center" onClick={() => toggleChk(i)} sx={{ cursor: 'pointer', px: 0.5, py: 0.35, borderRadius: 1, '&:hover .delf': { opacity: 1 } }}>
                  <CheckCircle className={c.done ? 'ws-check-pop' : undefined} sx={{ fontSize: 16, color: c.done ? ws.green : ws.textFaint, transition: 'color .2s' }} />
                  <Typography sx={{ fontSize: 12.5, flex: 1, minWidth: 0, textDecoration: c.done ? 'line-through' : 'none', color: c.done ? ws.textFaint : ws.text }}>{c.label}</Typography>
                  <Box className="delf" component="span" onClick={(e) => { e.stopPropagation(); delChk(i); }} sx={{ opacity: 0, color: ws.textFaint, fontSize: 12, cursor: 'pointer', '&:hover': { color: '#f87171' } }}>✕</Box>
                </Stack>
              ))}
            </Stack>
          )}
          {chkSug.filter((s) => !chk.some((c) => c.label === s)).length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }} alignItems="center">
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('sugWord')}</Typography>
              {chkSug.filter((s) => !chk.some((c) => c.label === s)).map((s) => (
                <Box key={s} onClick={() => addChk(s)} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: 10.5, fontWeight: 700, cursor: 'pointer', color: ws.accent, border: `1px solid ${ws.accentBorder}`, borderRadius: 999, px: 0.7, py: 0.2, '&:hover': { bgcolor: ws.accentSoft } }}><Add sx={{ fontSize: 12 }} />{s}</Box>
              ))}
            </Stack>
          )}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <TextField fullWidth size="small" placeholder={t('chkAdd')} value={chkText} onChange={(e) => setChkText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addChk(); }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 12.5 } }} />
            <Button size="small" onClick={addChk} disabled={!chkText.trim()} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5, px: 1 }}>{t('addBtn')}</Button>
          </Stack>
        </WsCard>
      </Box>

      {/* Høyre */}
      <Box sx={{ width: { xs: '100%', lg: 280 }, flexShrink: 0 }}>
        {isReal && (
          <WsCard sx={{ mb: 2 }}>
            <WsSectionTitle title={t('clientGallery')} />
            {galleries.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>{t('noGallery')}</Typography>
            ) : (
              <Stack spacing={1}>
                {galleries.map((g) => (
                  <Box key={g.id} sx={{ p: 1, borderRadius: 1.5, border: `1px solid ${ws.borderSoft}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700 }}>{g.title}</Typography>
                        <Typography noWrap sx={{ fontSize: 11, color: ws.textFaint }}>{g.clientName || g.clientEmail || ''}</Typography>
                      </Box>
                      <WsTag label={g.status || t('ready')} tone={g.status === 'completed' ? 'green' : 'blue'} />
                    </Stack>
                    {g.sharePath && (
                      <Button fullWidth size="small" onClick={() => shareGallery(g.sharePath)} sx={{ mt: 0.75, color: ws.accent, textTransform: 'none', border: `1px solid ${ws.accentBorder}` }}>
                        {t('shareWithClient')}
                      </Button>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </WsCard>
        )}
        {isReal && editingJobs.length > 0 && (
          <WsCard sx={{ mb: 2 }}>
            <WsSectionTitle title={t('editHandoff')} />
            <Stack spacing={1}>
              {editingJobs.map((j) => (
                <Box key={j.id} sx={{ p: 1, borderRadius: 1.5, border: `1px solid ${ws.borderSoft}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700 }}>{j.vendorName || t('editingVendor')}</Typography>
                      <Typography noWrap sx={{ fontSize: 11, color: ws.textFaint }}>{(j.services || []).join(', ') || t('editing')}{j.amount != null ? ` · ${Math.round(j.amount).toLocaleString('nb-NO')} ${j.currency || 'kr'}` : ''}</Typography>
                    </Box>
                    <WsTag label={j.status || t('sent')} tone={EJ_TONE[j.status] || 'neutral'} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </WsCard>
        )}
        {isReal && revisions.length > 0 && (
          <WsCard sx={{ mb: 2 }}>
            <WsSectionTitle title={`${t('revisionsTitle')} (${revisions.filter((r) => r.status !== 'resolved' && r.status !== 'done').length} ${t('openCount')})`} />
            <Stack spacing={1}>
              {revisions.slice(0, 6).map((r) => (
                <Box key={r.id} sx={{ p: 1, borderRadius: 1.5, border: `1px solid ${ws.borderSoft}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600 }}>{r.filename || t('image')}</Typography>
                      <Typography sx={{ fontSize: 11, color: ws.textDim }}>{r.note}</Typography>
                      <Typography noWrap sx={{ fontSize: 10.5, color: ws.textFaint }}>{r.clientEmail || ''}</Typography>
                    </Box>
                    <WsTag label={r.status === 'resolved' || r.status === 'done' ? t('resolved') : t('openTag')} tone={r.status === 'resolved' || r.status === 'done' ? 'green' : 'amber'} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </WsCard>
        )}
        <WsCard sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>{t('deliveryProgress')}</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <WsRing value={delPct} size={84} color={delPct === 100 ? ws.green : ws.accent} label={`${delPct}%`} />
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>{delDone} {t('deliveredOf')} {base.length}</Typography>
              {[[t('filterProgress'), delProg, ws.amber], [t('notStarted'), delPlanned, ws.textFaint], [t('overdue'), delOverdue, ws.red]].map(([l, n, c]) => <Stack key={l} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} /><Typography sx={{ fontSize: 11.5, flex: 1 }}>{l}</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{n}</Typography></Stack>)}
            </Stack>
          </Stack>
        </WsCard>
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle title={t('clientFeedback')} action={<Button size="small" onClick={() => setFbModal(true)} sx={{ color: ws.accent, textTransform: 'none' }}>{t('seeAll')}</Button>} />
          {(isReal ? feedback : [{ id: 'x1', clientName: 'Sara', comment: 'Herlig arbeid — vi elsker stemningen! 😍', type: 'praise', at: '2024-09-16T18:05:00Z' }, { id: 'x2', clientName: 'Sara', comment: 'Kan vi få første dans i kopi hele?', type: 'question', at: '2024-09-17T09:12:00Z' }]).length === 0 ? (
            <Typography sx={{ fontSize: 12, color: ws.textDim }}>{t('noFeedback')}</Typography>
          ) : (isReal ? feedback : [{ id: 'x1', clientName: 'Sara', comment: 'Herlig arbeid — vi elsker stemningen! 😍', type: 'praise', at: '2024-09-16T18:05:00Z' }, { id: 'x2', clientName: 'Sara', comment: 'Kan vi få første dans i kopi hele?', type: 'question', at: '2024-09-17T09:12:00Z' }]).slice(0, 4).map((f, i) => (
            <Box key={f.id || i} sx={{ mt: i ? 1 : 0, p: 1.25, borderRadius: 2, bgcolor: ws.panelInput }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: ws.accentSoft, color: ws.accent, fontWeight: 800 }}>{(f.clientName || 'K')[0]}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{f.clientName || t('client')}</Typography>
                    {f.type && <WsTag label={fbLabel(f.type)} tone={f.type === 'praise' ? 'green' : f.type === 'question' ? 'blue' : f.type === 'change' ? 'amber' : 'neutral'} />}
                    <Typography sx={{ fontSize: 10, color: ws.textFaint, ml: 'auto' }}>{relTime(f.at)}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 12.5, color: ws.text, lineHeight: 1.5 }}>{f.comment}</Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </WsCard>
        <WsCard>
          <WsSectionTitle title={t('activityWord')} />
          <Stack spacing={1.25}>
            {(isReal && activity.length
              ? activity.map((a) => ({ who: a.who, what: a.what, at: a.at, isPicks: String(a.what || '').includes('inn') }))
              : [
                  { who: 'Julie', what: t('act1'), at: '16. sep 2024 10:15', isPicks: false },
                  { who: 'Thomas', what: t('act2'), at: '15. sep 2024 14:40', isPicks: false },
                  { who: 'Klient', what: t('act4'), at: '14. sep 2024 09:05', isPicks: true },
                ]).map((a, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: a.isPicks ? ws.greenSoft : ws.panelAlt, color: a.isPicks ? ws.green : ws.textDim }}>{(a.who || '?')[0]}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12, color: ws.text }}><Box component="span" sx={{ fontWeight: 800, color: a.isPicks ? ws.green : ws.text }}>{a.who}</Box> {a.what}</Typography>
                  <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{relTime(a.at)}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </WsCard>
      </Box>

      {/* Ny leveranse */}
      <WsModal open={!!dlg} onClose={() => setDlg(null)} title={t('newBtn')} maxWidth="xs">
        <Stack spacing={1.5}>
          <TextField autoFocus size="small" label={t('newTitle')} value={dlg?.title || ''} onChange={(e) => setDlg((p) => (p ? { ...p, title: e.target.value } : p))} onKeyDown={(e) => { if (e.key === 'Enter') saveDeliverable(); }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput } }} />
          <TextField size="small" label={t('newType')} value={dlg?.type || ''} onChange={(e) => setDlg((p) => (p ? { ...p, type: e.target.value } : p))} onKeyDown={(e) => { if (e.key === 'Enter') saveDeliverable(); }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput } }} />
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }} alignItems="center">
            {DL_TYPE_RULES.map(([t, ,] ) => (
              <Box key={t} onClick={() => setDlg((p) => (p ? { ...p, type: t } : p))} sx={{ px: 0.8, py: 0.25, borderRadius: 999, fontSize: 11, fontWeight: dlg?.type === t ? 800 : 500, cursor: 'pointer', color: dlg?.type === t ? ws.accentContrast : ws.textDim, bgcolor: dlg?.type === t ? ws.accent : 'transparent', border: `1px solid ${dlg?.type === t ? ws.accent : ws.border}` }}>{t}</Box>
            ))}
            {typeGuess && typeGuess.type && typeGuess.type !== dlg?.type && (
              <Box onClick={() => setDlg((p) => (p ? { ...p, type: typeGuess.type as string } : p))} title="ML-forslag — klikk for å bruke" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, px: 0.8, py: 0.25, borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer', color: ws.accent, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
                ✨ Foreslått: {typeGuess.type} · {typeGuess.confidence}%
              </Box>
            )}
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => setDlg(null)} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('cancelBtn')}</Button>
            <Button size="small" variant="contained" disabled={!dlg?.title?.trim()} onClick={saveDeliverable} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('addBtn')}</Button>
          </Stack>
        </Stack>
      </WsModal>

      <WsModal open={fbModal} onClose={() => setFbModal(false)} title={t('allFeedback')} maxWidth="sm">
        {feedback.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: ws.textDim }}>{t('noFeedback')}</Typography>
        ) : (
          <Stack spacing={1.25}>
            {feedback.map((f, i) => (
              <Box key={f.id || i} sx={{ p: 1.5, borderRadius: 2, bgcolor: ws.panelInput }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{f.clientName || t('client')}</Typography>
                  {f.type && <WsTag label={fbLabel(f.type)} tone={f.type === 'praise' ? 'green' : f.type === 'question' ? 'blue' : f.type === 'change' ? 'amber' : 'neutral'} />}
                  <Typography sx={{ fontSize: 10.5, color: ws.textFaint, ml: 'auto' }}>{relTime(f.at)}</Typography>
                </Stack>
                <Typography sx={{ fontSize: 13, color: ws.text }}>{f.comment}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </WsModal>

      <WsModal open={filePicker} onClose={() => setFilePicker(false)} title={t('pickTitle')} maxWidth="sm">
        <Stack spacing={1.5}>
          {mediaAssets.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: ws.textDim }}>{t('noMediaAssets')}</Typography>
          ) : (
            <>
              <TextField size="small" placeholder={t('pickSearch')} value={pickQ} onChange={(e) => setPickQ(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 12.5 } }} />
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }} alignItems="center">
                {mediaAssets
                  .filter((a) => !pickQ || (a.filename || '').toLowerCase().includes(pickQ.toLowerCase()))
                  .slice(0, 48)
                  .map((a) => {
                    const picked = pickSel.has(a.id);
                    const attached = attachedIds.has(String(a.id));
                    return (
                      <Box key={a.id} onClick={() => togglePick(a.id)} title={a.filename || a.id} sx={{ position: 'relative', width: 72, height: 72, borderRadius: 1.5, overflow: 'hidden', cursor: 'pointer', opacity: attached ? 0.45 : 1, border: `2px solid ${picked ? ws.accent : ws.borderSoft}`, '&:hover': { borderColor: ws.accentBorder } }}>
                        <Box component="img" src={a.previewUrl} alt={a.filename || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {picked && <CheckCircle sx={{ position: 'absolute', top: 4, right: 4, fontSize: 16, color: ws.accent, bgcolor: 'rgba(17,18,24,.65)', borderRadius: '50%' }} />}
                        {attached && <Box sx={{ position: 'absolute', bottom: 3, left: 4, px: 0.5, py: 0.15, borderRadius: 1, bgcolor: 'rgba(52,211,153,.92)', color: '#052e16', fontSize: 8.5, fontWeight: 800 }}>VEDLAGT</Box>}
                      </Box>
                    );
                  })}
              </Stack>
              {pickSel.size > 0 && <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{pickSel.size} {t('pickedCount')}</Typography>}
            </>
          )}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => setFilePicker(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('cancelBtn')}</Button>
            <Button size="small" variant="contained" disabled={pickSel.size === 0 || mediaAssets.length === 0} onClick={attachPicked} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('addPicked')}</Button>
          </Stack>
        </Stack>
      </WsModal>

      {/* Høyreklikk-meny på vedlagte filer */}
      <Menu
        anchorReference="anchorPosition"
        anchorPosition={fileCtx ? { top: fileCtx.y, left: fileCtx.x } : undefined}
        open={!!fileCtx}
        onClose={() => setFileCtx(null)}
        PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, py: 0.5, minWidth: 200 } }}
      >
        <MenuItem onClick={() => { setViewFile(fileCtx?.i ?? 0); setFileCtx(null); }} sx={{ fontSize: 13 }}>{t('previewLarge')}</MenuItem>
        <MenuItem onClick={() => { setViewFile(fileCtx?.i ?? 0); setLbZoom(true); setFileCtx(null); }} sx={{ fontSize: 13 }}>{t('zoomOneToOne')}</MenuItem>
        {fileCtx && dlFiles[fileCtx.i]?.url && (
          <MenuItem onClick={() => { navigator.clipboard?.writeText(dlFiles[fileCtx.i].url); setFileCtx(null); }} sx={{ fontSize: 13 }}>{t('copyLink')}</MenuItem>
        )}
        <Divider sx={{ my: 0.5 }} variant="middle" />
        <MenuItem onClick={() => { if (fileCtx) moveFile(fileCtx.i, -1); setFileCtx(null); }} disabled={!fileCtx || fileCtx.i === 0} sx={{ fontSize: 13 }}>{t('moveBack')}</MenuItem>
        <MenuItem onClick={() => { if (fileCtx) moveFile(fileCtx.i, 1); setFileCtx(null); }} disabled={!fileCtx || fileCtx.i >= dlFiles.length - 1} sx={{ fontSize: 13 }}>{t('moveForward')}</MenuItem>
        <MenuItem onClick={() => { if (fileCtx) detachFile(fileCtx.i); setFileCtx(null); }} sx={{ fontSize: 13, color: '#f87171' }}>{t('removeFile')}</MenuItem>
      </Menu>

      {/* Lightbox — store visning av vedlagt fil. Klikk bildet for 1:1-zoom (pan via rull). */}
      <WsModal open={viewFile != null} onClose={() => setViewFile(null)} title={(viewFile != null && dlFiles[viewFile]?.name) || 'Fil'}>
        <Stack alignItems="center" spacing={1}>
          {viewFile != null && dlFiles[viewFile]?.url ? (
            lbZoom ? (
              <Box onClick={() => setLbZoom(false)} title="Klikk for å zoome ut" sx={{ maxWidth: '100%', width: '100%', maxHeight: '62vh', overflow: 'auto', cursor: 'zoom-out' }}>
                <Box component="img" src={dlFiles[viewFile].url} alt={dlFiles[viewFile]?.name || ''} sx={{ display: 'block', minWidth: '100%', width: 'auto', maxWidth: 'none', height: 'auto', borderRadius: 1.5 }} />
              </Box>
            ) : (
              <Box onClick={() => setLbZoom(true)} title="Klikk for 1:1-zoom" sx={{ maxWidth: '100%', maxHeight: '62vh', overflow: 'hidden', cursor: 'zoom-in' }}>
                <Box component="img" src={dlFiles[viewFile].url} alt={dlFiles[viewFile]?.name || ''} sx={{ display: 'block', maxWidth: '100%', maxHeight: '62vh', objectFit: 'contain', borderRadius: 1.5 }} />
              </Box>
            )
          ) : (
            viewFile != null && (
              <Stack alignItems="center" spacing={0.75} sx={{ px: 2 }}>
                <ImageIcon sx={{ fontSize: 44, color: ws.textFaint }} />
                <Typography sx={{ fontSize: 13, color: ws.text, wordBreak: 'break-all', textAlign: 'center' }}>{dlFiles[viewFile]?.name || 'Fil'}</Typography>
              </Stack>
            )
          )}
          {viewFile != null && (
            <>
              {dlFiles[viewFile]?.url && (
                <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{lbZoom ? 'Zoom: 100% — rull for å panorere' : 'Klikk bildet for 1:1-zoom'}</Typography>
              )}
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => stepFile(viewFile, -1)} disabled={viewFile === 0} sx={{ color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.borderSoft}` }}>‹</Button>
                <Button size="small" onClick={() => stepFile(viewFile, 1)} disabled={viewFile === dlFiles.length - 1} sx={{ color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.borderSoft}` }}>›</Button>
              </Stack>
            </>
          )}
        </Stack>
      </WsModal>
      </Stack>
    </Stack>
  );
};

export default LeveranserTab;
