// @ts-nocheck
/**
 * MediaTab — design #6 (Media library), dark CreatorHub.
 * Bibliotek-sidebar (typer/mapper) + opplastbart asset-rutenett + asset-detaljer.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, TextField, IconButton, Menu, MenuItem } from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import Search from '@mui/icons-material/Search';
import Star from '@mui/icons-material/Star';
import CreateNewFolder from '@mui/icons-material/CreateNewFolder';
import AutoAwesomeMotion from '@mui/icons-material/AutoAwesomeMotion';
import Close from '@mui/icons-material/Close';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { wsIcon } from '../crewIcons';
import { WsCard, WsTag, WsImageGrid, WsModal, WsErrorState, WsPageTitle } from '../ui';
import PhotoLibrary from '@mui/icons-material/PhotoLibrary';
import Sort from '@mui/icons-material/Sort';
import Image from '@mui/icons-material/Image';
import Videocam from '@mui/icons-material/Videocam';
import GraphicEq from '@mui/icons-material/GraphicEq';
import Description from '@mui/icons-material/Description';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Layers from '@mui/icons-material/Layers';
import GridView from '@mui/icons-material/GridView';
import Edit from '@mui/icons-material/Edit';
import Collections from '@mui/icons-material/Collections';
import Cached from '@mui/icons-material/Cached';
import AiBuyCreditsModal from '../AiBuyCreditsModal';
import { useProjectImages } from '../useProjectImages';
import { useCaptureRealtime } from '../useCaptureRealtime';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from '../wsLocale';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab). Selv-nøklede
// oppslag (LIB-kategorier) beholder norsk som stabil nøkkel/state-verdi.
const T: WsDict = {
  'Alle medier': { no: 'Alle medier', en: 'All media' },
  'Bilder': { no: 'Bilder', en: 'Photos' },
  'Videoer': { no: 'Videoer', en: 'Videos' },
  'Lyd': { no: 'Lyd', en: 'Audio' },
  'Dokumenter': { no: 'Dokumenter', en: 'Documents' },
  folderPrompt: { no: 'Mappenavn:', en: 'Folder name:' },
  folderCreateFailed: { no: 'Kunne ikke opprette mappe', en: 'Could not create folder' },
  templateFailed: { no: 'Kunne ikke bruke mal', en: 'Could not apply template' },
  mediaLibrary: { no: 'MEDIA-BIBLIOTEK', en: 'MEDIA LIBRARY' },
  foldersHeading: { no: 'MAPPER', en: 'FOLDERS' },
  useTemplate: { no: 'Bruk mal', en: 'Use template' },
  newFolder: { no: 'Ny mappe', en: 'New folder' },
  noFolders: { no: 'Ingen mapper. Bruk en mal eller lag egne.', en: 'No folders. Use a template or create your own.' },
  live: { no: 'SANNTID', en: 'LIVE' },
  imagesWord: { no: 'bilder', en: 'images' },
  selectedWord: { no: 'valgt', en: 'selected' },
  searchMedia: { no: 'Søk navn / nøkkelord…', en: 'Search name / keywords…' },
  keywords: { no: 'Nøkkelord', en: 'Keywords' },
  keywordsHint: { no: 'Ingen nøkkelord — trykk ✨ AI for å generere, eller legg til manuelt.', en: 'No keywords — press ✨ AI to generate, or add manually.' },
  addKeyword: { no: 'Legg til nøkkelord…', en: 'Add keyword…' },
  bulkKwHint: { no: 'Fyll inn nøkkelord (kommaseparert) som legges til alle valgte bilder:', en: 'Enter keywords (comma separated) to add to all selected images:' },
  collections: { no: 'Samlinger', en: 'Collections' },
  collection: { no: 'Samling', en: 'Collection' },
  noCollections: { no: 'Ikke i noen samling ennå', en: 'Not in any collection yet' },
  newCollection: { no: 'Ny samling', en: 'New collection' },
  cloneCollection: { no: 'Dupliser samling', en: 'Duplicate collection' },
  cloneHint: { no: 'Kopierer kun referanser — master-filene blir aldri lastet ned/opp igjen. Gi den nye samlingen et navn:', en: 'Copies references only — master files are never downloaded/re-uploaded. Name the new collection:' },
  duplicate: { no: 'Dupliser', en: 'Duplicate' },
  uploadedBy: { no: 'Lastet opp av', en: 'Uploaded by' },
  saveToPhotos: { no: 'Lagre til bilder', en: 'Save to Photos' },
  openOriginal: { no: 'Åpne original', en: 'Open original' },
  downloading: { no: 'Laster ned…', en: 'Downloading…' },
  saved: { no: 'Lagret', en: 'Saved' },
  dlFailed: { no: 'Kunne ikke laste ned — sjekk tilkoblingen.', en: 'Could not download — check your connection.' },
  cullLive: { no: 'Culler live', en: 'Culling live' },
  noEnhanceJobs: { no: 'Ingen AI-forbedring ennå — marker bilder for klient eller send fra bulk.', en: 'No AI enhancement yet — flag images for client or send from bulk.' },
  folderNumberHint: { no: 'Nummer-prefikset sørger for struktur — neste nummer er foreslått automatisk. Mellomrom gjøres om til «_».', en: 'The number prefix keeps structure — next number is suggested automatically. Spaces become underscores.' },
  folderSuggest: { no: 'Forslag fra mal', en: 'Template suggestions' },
  upload: { no: 'Last opp', en: 'Upload' },
  uploadMedia: { no: 'Last opp media', en: 'Upload media' },
  filterAll: { no: 'Alle', en: 'All' },
  filterUnrated: { no: 'Uten rating', en: 'Unrated' },
  filterFavorites: { no: 'Favoritter', en: 'Favorites' },
  filterHighlights: { no: 'Highlights (klient)', en: 'Highlights (client)' },
  filterRejected: { no: 'Forkastet', en: 'Rejected' },
  rejectedWord: { no: 'Forkastet', en: 'Rejected' },
  rejectAction: { no: 'Forkast', en: 'Reject' },
  undoReject: { no: 'Angre forkast', en: 'Undo reject' },
  emptyMedia: { no: 'Ingen media ennå — last opp et bilde eller koble til en capture-økt.', en: 'No media yet — upload an image or connect a capture session.' },
  emptyFiltered: { no: 'Ingen bilder i denne visningen.', en: 'No images in this view.' },
  clickDetails: { no: 'Klikk et bilde for å se detaljer.', en: 'Click an image to see details.' },
  image: { no: 'Bilde', en: 'Image' },
  fileType: { no: 'Filtype', en: 'File type' },
  size: { no: 'Størrelse', en: 'Size' },
  openDownload: { no: 'Åpne / last ned', en: 'Open / download' },
  sending: { no: 'Sender…', en: 'Sending…' },
  sendToEnhance: { no: 'Send til AI-forbedring', en: 'Send to AI enhancement' },
  aiCullTitle: { no: 'AI-cull-forslag', en: 'AI cull suggestions' },
  keep: { no: 'Behold', en: 'Keep' },
  weak: { no: 'Svak', en: 'Weak' },
  reject: { no: 'Forkast', en: 'Reject' },
  dupOne: { no: 'duplikat-klynge oppdaget', en: 'duplicate cluster detected' },
  dupMany: { no: 'duplikat-klynger oppdaget', en: 'duplicate clusters detected' },
  suggestedRejects: { no: 'FORESLÅTT FORKASTET', en: 'SUGGESTED REJECTS' },
  aiEnhanceTitle: { no: 'AI-forbedring', en: 'AI enhancement' },
  doneWord: { no: 'ferdig', en: 'done' },
  enhanceAll: { no: '✨ Forbedre alle klient-markerte', en: '✨ Enhance all client picks' },
  enhancingNow: { no: 'forbedres nå…', en: 'enhancing now…' },
  failedWord: { no: 'feilet', en: 'failed' },
  statusDone: { no: 'Ferdig', en: 'Done' },
  statusFailed: { no: 'Feilet', en: 'Failed' },
  statusRunning: { no: 'Kjører', en: 'Running' },
  beforeAfterShort: { no: 'Før/Etter', en: 'Before/After' },
  voiceNotesTitle: { no: 'Talenotater', en: 'Voice notes' },
  fromPhotographer: { no: 'fra fotograf', en: 'from photographer' },
  voiceNoteWord: { no: 'talenotat', en: 'voice note' },
  beforeAfterTitle: { no: 'Før / Etter', en: 'Before / After' },
  beforeWord: { no: 'Før', en: 'Before' },
  afterWord: { no: 'Etter', en: 'After' },
  beforeUpper: { no: 'FØR', en: 'BEFORE' },
  afterUpper: { no: 'ETTER', en: 'AFTER' },
  downloadEnhanced: { no: 'Last ned forbedret', en: 'Download enhanced' },
  enhanceSent: { no: 'Sendte {n} bilde(r) til AI-forbedring.', en: 'Sent {n} image(s) for AI enhancement.' },
  enhanceFailed: { no: 'Kunne ikke sende til AI-forbedring', en: 'Could not send to AI enhancement' },
  creditsAdded: { no: 'Kreditter lagt til ✓', en: 'Credits added ✓' },
  error: { no: 'Feil', en: 'Error' },
  loadError: { no: 'Kunne ikke laste media. Sjekk tilkoblingen og prøv igjen.', en: 'Could not load media. Check your connection and try again.' },
  bulkMode: { no: 'Velg flere', en: 'Select multiple' },
  cancel2: { no: 'Avslutt', en: 'Done' },
  ratingWord: { no: 'Rating', en: 'Rating' },
  audioFile: { no: 'Lydfil', en: 'Audio file' },
  save: { no: 'Lagre', en: 'Save' },
  rejectAll: { no: 'Forkast foreslåtte', en: 'Reject suggested' },
  showAll: { no: 'Vis alle', en: 'Show all' },
};

const LIB = [['Alle medier', 2487], ['Bilder', 1732], ['Videoer', 624], ['Lyd', 98], ['Dokumenter', 33]];
// Bibliotek-type → filter (norsk nøkkel = stabil state-verdi)
const LIB_TYPE: Record<string, string | null> = { 'Alle medier': null, 'Bilder': 'image', 'Videoer': 'video', 'Lyd': 'audio', 'Dokumenter': 'doc' };
const LIB_ICON: Record<string, any> = { 'Alle medier': PhotoLibrary, 'Bilder': Image, 'Videoer': Videocam, 'Lyd': GraphicEq, 'Dokumenter': Description };
const assetType = (mime?: string): string => !mime ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : /image\//i.test(mime) ? 'image' : 'doc';
/** Neste strukturnummer (01_..99_) fra eksisterende mapper. */
const nextFolderNumber = (names: string[]): string => {
  let mx = 0;
  for (const n of names || []) { const m = /^(\d+)/.exec(n || ''); if (m) mx = Math.max(mx, parseInt(m[1], 10)); }
  return String(mx + 1).padStart(2, '0');
};
/** Normaliserer mappenavn: mellomrom → _, filtre eller tegn, auto-prefiks nummer. */
const normalizeFolderName = (name: string, names: string[]): string => {
  let n = (name || '').trim().replace(/[\s_]+/g, '_').replace(/[^\p{L}\p{N}_\-]/gu, '').replace(/_+/g, '_');
  if (!/^\d/.test(n)) n = `${nextFolderNumber(names)}_${n}`;
  return n.slice(0, 60);
};
/** Tidspunkt «HH:MM» i dag, ellers «dd.mm HH:MM». */
const fmtShort = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === new Date().toDateString() ? hm : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
};
// Filtype → korrekt filendelse ved nedlasting (enkeltfiler, aldri ZIP).
const EXT_OF: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'audio/m4a': 'm4a', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'application/pdf': 'pdf' };
const extOf = (mime?: string, filename?: string) => {
  if (filename && /\.[a-z0-9]{2,5}$/i.test(filename)) return filename;
  const ext = (mime ? EXT_OF[mime] : null) || (mime?.startsWith('image/') ? 'jpg' : mime?.startsWith('video/') ? 'mp4' : mime?.startsWith('audio/') ? 'm4a' : 'bin');
  return filename ? `${filename.replace(/\.[a-z0-9]{2,5}$/i, '')}.${ext}` : `media.${ext}`;
};
const blobCache = new Map<string, string>();
// Fargekoder fra iPad-culling → hex.
const COLOR_HEX: Record<string, string> = { green: '#34d399', amber: '#fbbf24', red: '#f87171', blue: '#60a5fa', purple: '#a78bfa', pink: '#f472b6', gray: '#94a3b8' };
const FOLDERS = [['01_Brief', 12], ['02_Shotlists', 8], ['03_Photo_RAW', 1732], ['04_Video_A_Cam', 214], ['05_Video_B_Cam', 186], ['06_Drone', 67], ['07_Audio', 98], ['08_Selects', 156], ['09_Client_Review', 23], ['10_Final_Delivery', 0]];
const QUICK = [['Unrated', 1205], ['Favoritter', 156], ['For Edit', 312], ['Client Review', 23], ['Highlights', 48], ['Forkastet', 12]];

const MediaTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  // Utenlandske partner-vendors får engelsk — locale fra WsLocaleProvider.
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const [lib, setLib] = useState('Alle medier');
  const [assets, setAssets] = useState<any[]>([]);
  const [cull, setCull] = useState<any>({});
  const [loadErr, setLoadErr] = useState(false);
  const [filter, setFilter] = useState('alle');
  const [q, setQ] = useState('');
  const web = useProjectImages(projectId, 'media');
  const isReal = projectId && projectId !== 'sample';
  const [selAsset, setSelAsset] = useState<any | null>(null);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplMenu, setTplMenu] = useState<any>(null);
  // Sample-mapper: lokale (demo fungerer identisk uten backend).
  const [sampleFolders, setSampleFolders] = useState<{ id: string; name: string }[]>(() => FOLDERS.map(([n], i) => ({ id: `s${i}`, name: n })));

  const loadFolders = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders`)
      .then((r: any) => { setFolders(Array.isArray(r?.folders) ? r.folders : []); setTemplates(Array.isArray(r?.templates) ? r.templates : []); })
      .catch(() => {});
  };
  useEffect(() => { loadFolders(); /* eslint-disable-next-line */ }, [projectId, isReal]);

  const applyTemplate = async (key: string) => {
    setTplMenu(null);
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders/apply-template`, { method: 'POST', body: { template: key } }); setFolders(Array.isArray(r?.folders) ? r.folders : []); }
    catch (e: any) { window.alert(e?.message || t('templateFailed')); }
  };
  const delFolder = async (id: string) => {
    if (!isReal) { setSampleFolders((p) => p.filter((f) => f.id !== id)); return; }
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders/${id}`, { method: 'DELETE' }); loadFolders(); } catch { /* */ }
  };
  const folderList = isReal ? folders.map((f) => [f.name, f.id]) : sampleFolders.map((f) => [f.name, f.id]);

  // Primær-last (media-assets). Stabil ref så feil-state kan re-fetche via onRetry.
  const reloadMedia = () => {
    if (!isReal) return;
    setMediaLoading(true);
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media`)
      .then((r: any) => {
        setAssets(Array.isArray(r?.assets) ? r.assets : []); setCull(r?.cullStats || {}); setSessions(Array.isArray(r?.sessions) ? r.sessions : []);
        setFolderCounts((prev) => { const m: Record<string, number> = {}; for (const f of Array.isArray(r?.folderCounts) ? r.folderCounts : []) m[f.folderId] = f.n; return m; });
        setLoadErr(false); setLastSync(new Date());
      })
      .catch(() => setLoadErr(true))
      .finally(() => setMediaLoading(false));
  };
  // Flytt asset til mappe (PATCH lærer mønsteret server-side).
  const moveAssetFolder = async (id: string, folderId: string | null) => {
    if (!isReal) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/assets/${encodeURIComponent(id)}/folder`, { method: 'PATCH', body: { folderId } }); reloadMedia(); setFolderGuess((g) => (g && g.folderId !== folderId ? g : null)); }
    catch (e: any) { window.alert(e?.message || t('error')); }
  };
  const moveBulkFolder = async (folderId: string | null) => {
    const ids = [...selIds]; endBulk();
    for (const id of ids) { try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/assets/${encodeURIComponent(id)}/folder`, { method: 'PATCH', body: { folderId } }); } catch { /* */ } }
    reloadMedia();
  };
  // ML-gjett: foreslå mappe for assets (filnavn + EXIF → folder_learn).
  const guessFolderFor = async (assetId: string) => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/folders/guess`, { method: 'POST', body: { assetId } })
      .then((r: any) => setFolderGuess(r && typeof r.folderId === 'string' ? r : { folderId: null, folderName: null, confidence: 0 }))
      .catch(() => {});
  };
  useEffect(() => {
    if (!isReal) return;
    const fetchMedia = () => { if (document.hidden) return; reloadMedia(); };
    fetchMedia();
    const t = setInterval(fetchMedia, 25000); // poll-fallback
    return () => clearInterval(t);
  }, [projectId, isReal]);

  // Talenotater — fotografens innspilte voice-memos på bilder (capture_reviews).
  const [voiceNotes, setVoiceNotes] = useState<any[]>([]);
  const loadVoice = () => { if (!isReal) return; apiRequest(`/api/projects/${encodeURIComponent(projectId)}/voice-notes`).then((r: any) => setVoiceNotes(Array.isArray(r?.notes) ? r.notes : [])).catch(() => {}); };
  useEffect(() => { loadVoice(); /* eslint-disable-next-line */ }, [projectId, isReal]);

  // AI-forbedring (photo_enhancement_jobs) + AI-cull-forslag (classifySession).
  const [enhance, setEnhance] = useState<any | null>(null);
  const [cullAi, setCullAi] = useState<any | null>(null);
  const [cullTab, setCullTab] = useState<'reject' | 'weak'>('reject');
  const [cullStrict, setCullStrict] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [enhanceAll, setEnhanceAll] = useState(false);
  const [beforeAfter, setBeforeAfter] = useState<any | null>(null); // valgt enhance-jobb → Før/Etter-modal
  const [baPos, setBaPos] = useState(50); // slider-posisjon 0–100
  const loadAi = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/enhance-status`).then((r: any) => setEnhance(r || null)).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/cull-suggestions?strictness=${cullStrict}`).then((r: any) => setCullAi(r || null)).catch(() => {});
  };
  useEffect(() => { loadAi(); /* eslint-disable-next-line */ }, [projectId, isReal, cullStrict]);
  const [enhancing, setEnhancing] = useState(false);
  // Kreditt (for «Send til AI-forbedring»)
  const [credits, setCredits] = useState<any | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  // Media-studio: bulk, rating, sortering
  const [bulkMode, setBulkMode] = useState(false);
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const [rateMenu, setRateMenu] = useState<HTMLElement | null>(null);
  const [sortBy, setSortBy] = useState<'new' | 'rating'>('new');
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [lastUp, setLastUp] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [zoneMode, setZoneMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const lastSelRef = React.useRef<number | null>(null);
  // Mappe-dialog + EXIF-cache + cull-handlinger
  const [folderDlg, setFolderDlg] = useState<null | { mode: 'new' } | { mode: 'rename'; id: string; name: string }>(null);
  const [folderName, setFolderName] = useState('');
  const [exifCache, setExifCache] = useState<Record<string, any>>({});
  const [showRejects, setShowRejects] = useState(false);
  const [folderSel, setFolderSel] = useState<string | null>(null);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [folderGuess, setFolderGuess] = useState<{ folderId: string | null; folderName: string | null; confidence: number } | null>(null);
  const [assetFolderMenu, setAssetFolderMenu] = useState<HTMLElement | null>(null);
  const [bulkFolderMenu, setBulkFolderMenu] = useState<HTMLElement | null>(null);
  const folderNameOf = (id: string) => (folders.find((f: any) => f.id === id) || {}).name || '—';
  // Nøkkelord: AI + manuelle korrigeringer.
  const [kwBusy, setKwBusy] = useState(false);
  const [kwDraft, setKwDraft] = useState('');
  const [kwBulkOpen, setKwBulkOpen] = useState(false);
  // Samlinger (ett master, mange refs)
  const [refs, setRefs] = useState<any[]>([]);
  const [refSel, setRefSel] = useState<string | null>(null);
  const [refMenu, setRefMenu] = useState<HTMLElement | null>(null);
  const [refNewName, setRefNewName] = useState('');
  const [cloneDlg, setCloneDlg] = useState<string | null>(null); // kilde-samlingsnavn
  const [cloneName, setCloneName] = useState('');
  const loadRefs = () => { if (!isReal) return; apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/refs`).then((r: any) => setRefs(Array.isArray(r?.refs) ? r.refs : [])).catch(() => {}); };
  useEffect(() => { loadRefs(); /* eslint-disable-next-line */ }, [projectId, isReal]);
  const refCols = Object.entries(refs.reduce((m: any, x: any) => { m[x.collection] = (m[x.collection] || 0) + 1; return m; }, {})) as [string, number][];
  const refIdOf = (masterId: string, collection: string) => refs.find((x) => x.masterId === masterId && x.collection === collection)?.id;
  const addRef = async (collection: string) => {
    if (!selAsset?.id || !collection.trim()) return;
    setRefMenu(null);
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/refs`, { method: 'POST', body: { masterId: selAsset.id, collection: collection.trim() } }); loadRefs(); reloadMedia(); }
    catch (e: any) { window.alert(e?.message || t('error')); }
  };
  const removeRef = (masterId: string, collection: string) => {
    const id = refIdOf(masterId, collection);
    if (!id) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/refs/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => { loadRefs(); reloadMedia(); }).catch(() => {});
  };
  const cloneRef = async () => {
    if (!cloneDlg || !cloneName.trim()) return;
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/refs/clone`, { method: 'POST', body: { from: cloneDlg, to: cloneName.trim() } });
      setCloneDlg(null); setCloneName('');
      loadRefs(); reloadMedia();
      if (r?.copied === 0) window.alert('Ingen nye referanser — samlingsnavnet finnes kanskje allerede.');
    } catch (e: any) { window.alert(e?.message || t('error')); }
  };
  const [kwBulkText, setKwBulkText] = useState('');
  const runKeywords = async () => {
    if (!isReal || !selAsset?.id || kwBusy) return;
    setKwBusy(true);
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/assets/${encodeURIComponent(selAsset.id)}/keywords`, { method: 'POST', body: {} });
      reloadMedia(); setLastSync(new Date());
      if (r?.ai === false) { /* heuristisk fallback brukt — ingen varsel */ }
    } catch (e: any) { window.alert(e?.message || t('error')); }
    finally { setKwBusy(false); }
  };
  const saveTags = async (id: string, tags: string[]) => {
    if (!isReal) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/assets/${encodeURIComponent(id)}/tags`, { method: 'PATCH', body: { tags } }); reloadMedia(); }
    catch (e: any) { window.alert(e?.message || t('error')); }
  };
  const applyBulkKeywords = async () => {
    const words = kwBulkText.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (!words.length) return;
    const ids = [...selIds];
    setKwBulkOpen(false); setKwBulkText('');
    for (const id of ids) {
      const asset = assets.find((a: any) => a.id === id);
      const cur: string[] = Array.isArray(asset?.tags) ? asset.tags : [];
      await saveTags(id, [...cur, ...words.filter((w) => !cur.includes(w))].slice(0, 40));
    }
    // saveTags reloader per asset — gjør én reload til slutt for synk-linje
    setLastSync(new Date());
  };
  const folderNames = () => (isReal ? folders : sampleFolders).map((f: any) => f.name);
  const openFolderDlg = (m: 'new' | 'rename', id?: string, name?: string) => {
    setFolderName(m === 'new' ? `${nextFolderNumber(folderNames())}_` : (name || ''));
    setFolderDlg(m === 'new' ? { mode: 'new' } : { mode: 'rename', id: id as string, name: name as string });
  };
  const saveFolder = async () => {
    if (!folderName.trim() || !folderDlg) return;
    const name = normalizeFolderName(folderName, folderNames());
    if (!isReal) {
      setSampleFolders((p) => folderDlg.mode === 'new' ? [...p, { id: `s${Date.now()}`, name }] : p.map((f) => (f.id === (folderDlg as any).id ? { ...f, name } : f)));
      setFolderDlg(null);
      return;
    }
    try {
      if (folderDlg.mode === 'new') await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders`, { method: 'POST', body: { name } });
      else await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders/${(folderDlg as any).id}`, { method: 'PATCH', body: { name } });
      setFolderDlg(null); loadFolders();
    } catch (e: any) { window.alert(e?.message || t('folderCreateFailed')); }
  };
  // Ett-klikks-forslag fra mal (mappenavn som ikke finnes ennå, sortert på nummer).
  const tplSuggest = templates.flatMap((x: any) => (Array.isArray(x.names) ? x.names : [])).filter((n: string) => !folderNames().includes(n)).sort();
  // Opplasting (flere typer) med «opplastet ✓»-feedback.
  const doUpload = (f: File) => web.onUpload(f).then((s: any) => { if (s?.id) { setLastUp(s.id); window.setTimeout(() => setLastUp((v) => (v === s.id ? null : v)), 2500); } return s; });
  const loadCredits = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits`).then((r: any) => setCredits(r || null)).catch(() => {}); };
  const buyPack = async (id: string) => { try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/checkout`, { method: 'POST', body: { packId: id } }); if (r?.url) window.location.href = r.url; } catch (e: any) { window.alert(e?.message || t('error')); } };
  useEffect(() => {
    if (!isReal) return;
    loadCredits();
    try { const p = new URLSearchParams(window.location.search); if (p.get('ai_credits') === 'ok' && p.get('cs')) { apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/confirm`, { method: 'POST', body: { sessionId: p.get('cs') } }).then(() => { loadCredits(); window.alert(t('creditsAdded')); }).catch(() => {}).finally(() => { const u = new URL(window.location.href); u.searchParams.delete('ai_credits'); u.searchParams.delete('cs'); window.history.replaceState({}, '', u.toString()); }); } } catch { /* */ }
    // eslint-disable-next-line
  }, [projectId]);
  const triggerEnhance = async (assetIds?: string[]) => {
    if (!isReal || enhancing) return;
    setEnhancing(true);
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/enhance-picks`, { method: 'POST', body: assetIds?.length ? { assetIds } : {} });
      window.alert(`${t('enhanceSent').replace('{n}', String(r?.queued ?? 0))}${r?.failures?.length ? ` (${r.failures.length} ${t('failedWord')})` : ''}`);
      loadAi(); loadCredits();
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('kreditt') || msg.includes('insufficient')) setBuyOpen(true);
      else window.alert(e?.message || t('enhanceFailed'));
    }
    finally { setEnhancing(false); }
  };

  // PATCH capture-asset (rating/stjerne/slett-markering) → re-fetch + WS-broadcast til iPads.
  const patchAsset = async (id: string, body: any) => {
    if (!isReal) return;
    try { await apiRequest(`/api/capture/assets/${encodeURIComponent(id)}`, { method: 'PATCH', body }); reloadMedia(); }
    catch (e: any) { window.alert(e?.message || t('error')); }
  };
  const bulkToggle = (id: string, e?: React.MouseEvent) => {
    const i = gridImages.findIndex((x: any) => x.id === id);
    if (e?.shiftKey && lastSelRef.current != null && i !== -1) {
      const from = Math.min(lastSelRef.current, i), to = Math.max(lastSelRef.current, i);
      setSelIds((p) => { const n = new Set(p); for (let k = from; k <= to; k++) n.add(gridImages[k].id); return n; });
    } else {
      setSelIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
      lastSelRef.current = i;
    }
  };
  const endBulk = () => { setBulkMode(false); setSelIds(new Set()); };
  const bulkRate = (r: number | null) => { for (const id of selIds) patchAsset(id, { rating: r }); endBulk(); };
  const bulkFlag = (f: boolean) => { for (const id of selIds) patchAsset(id, { flaggedForClient: f }); endBulk(); };
  const bulkEnhance = () => { const ids = [...selIds]; endBulk(); if (ids.length) triggerEnhance(ids); };

  // Sanntid: refetch media INSTANT når iPad skyter/culler (WS).
  // Live-culling: WS-event fra iPad (labels/nye assets) → refetch + synlig flash-ticker.
  const [cullFlash, setCullFlash] = useState<{ t: number; n: number } | null>(null);
  const flashTimer = React.useRef<any>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  const { live: capLive } = useCaptureRealtime(projectId, (payload: any) => {
    const kind = payload?.event?.kind || payload?.type;
    if (kind && (kind.startsWith('asset.') || kind === 'shot.completion-toggled' || kind === 'shot.captured')) {
      setCullFlash((p) => ({ t: Date.now(), n: (p && Date.now() - p.t < 4000 ? p.n : 0) + 1 }));
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setCullFlash(null), 4000);
    }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media`).then((r: any) => {
      setAssets(Array.isArray(r?.assets) ? r.assets : []); setCull(r?.cullStats || {}); setSessions(Array.isArray(r?.sessions) ? r.sessions : []);
      setFolderCounts((prev) => { const m: Record<string, number> = {}; for (const f of Array.isArray(r?.folderCounts) ? r.folderCounts : []) m[f.folderId] = f.n; return m; });
      setLastSync(new Date());
    }).catch(() => {});
    loadVoice();
    loadAi();
  });
  const sessionName = (id: string) => sessions.find((s) => s.id === id)?.name || 'Sesjon';

  // Cull-aware items: rating + pick (flagged_for_client) fra iPad-culling.
  const matchFilter = (a: any) => {
    if (filter === 'forkastet') return !!a.rejected;
    if (a.rejected) return false; // forkastede skjules ellers
    if (filter?.startsWith('color:')) return a.colorLabel === filter.slice(6);
    if (filter === 'unrated') return !a.rating;
    if (filter === 'favoritter') return (a.rating || 0) >= 4;
    if (filter === 'highlights') return !!a.flaggedForClient;
    return true;
  };
  const captureItems = assets.filter((a) => a.previewUrl && matchFilter(a)).map((a) => ({ id: a.id, url: a.previewUrl, label: a.filename, rating: a.rating || 0, flag: !!a.flaggedForClient, createdAt: a.createdAt || null, state: a.state, type: assetType(a.mime), folderId: a.folderId || null, colorLabel: a.colorLabel || null, tags: Array.isArray(a.tags) ? a.tags : [], refs: Array.isArray(a.refs) ? a.refs : [], uploadedBy: a.uploadedBy || null }));
  const typedWeb = web.images.map((im: any) => ({ ...im, type: assetType(im.contentType || im.mime || '') }));
  let gridImages = (isReal ? [...captureItems, ...(filter === 'alle' && !folderSel ? typedWeb : [])] : [])
    .filter((im: any) => LIB_TYPE[lib] == null || im.type === LIB_TYPE[lib])
    .filter((im: any) => !folderSel || im.folderId === folderSel)
    .filter((im: any) => !refSel || (im.refs || []).includes(refSel))
    .filter((im: any) => !q || String(im.label || '').toLowerCase().includes(q.toLowerCase()) || (im.tags || []).some((t: string) => t.includes(q)));
  if (sortBy === 'rating') gridImages = [...gridImages].sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
  // Fargekode-chips (unike colorLabels fra iPad-culling).
  const colorCounts = assets.reduce((m: any, a: any) => { if (a.colorLabel) m[a.colorLabel] = (m[a.colorLabel] || 0) + 1; return m; }, {});
  // Ekte bibliotek-tellinger fra assets (mime-type).
  const libStats = assets.reduce((m: any, a: any) => { m[assetType(a.mime)] = (m[assetType(a.mime)] || 0) + 1; return m; }, { image: 0, video: 0, audio: 0, doc: 0 });
  const libCountAll = libStats.image + libStats.video + libStats.audio + libStats.doc;

  // Navigasjon i detalj-panelet: ←/→ bytter asset, Esc lukker (definert etter gridImages).
  const openAssetAt = (i: number) => {
    if (!gridImages[i]) return;
    setSelIdx(i);
    const im = gridImages[i];
    setSelAsset(assets.find((a) => a.id === im.id) || { id: im.id, filename: im.label, previewUrl: im.url, rating: im.rating, flaggedForClient: im.flag, createdAt: im.createdAt });
  };
  useEffect(() => {
    if (selIdx == null || gridImages.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setSelIdx((i) => (i == null ? i : (e.key === 'ArrowRight' ? (i + 1) % gridImages.length : (i - 1 + gridImages.length) % gridImages.length))); }
      else if (e.key === 'Escape') { setSelIdx(null); setSelAsset(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selIdx, gridImages.length]);
  useEffect(() => { if (selIdx != null && gridImages[selIdx]) { const im = gridImages[selIdx]; setSelAsset(assets.find((a) => a.id === im.id) || { id: im.id, filename: im.label, previewUrl: im.url, rating: im.rating, flaggedForClient: im.flag, createdAt: im.createdAt }); } }, [selIdx, assets, gridImages.length]);
  // EXIF-logg per asset (capture_assets.exif), cachet.
  useEffect(() => {
    if (!isReal || !selAsset?.id || exifCache[selAsset.id]) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media/assets/${encodeURIComponent(selAsset.id)}/exif`)
      .then((r: any) => { if (r?.exif) setExifCache((p) => ({ ...p, [selAsset.id as string]: r.exif })); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selAsset?.id, isReal, projectId]);
  // ML-mappe-gjett ved bytte av valgt asset.
  useEffect(() => {
    setFolderGuess(null);
    if (selAsset?.id) guessFolderFor(selAsset.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selAsset?.id]);
  // Nedlasting: enkeltfiler, iOS-optimalt («Lagre til bilder» via Web Share → share-ark),
  // bakgrunns-henting (blob-cache) — aldri ZIP.
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const [dlOk, setDlOk] = useState<string | null>(null);
  const fetchBlob = async (url: string): Promise<Blob | null> => {
    try { const res = await fetch(url); if (!res.ok) return null; return await res.blob(); } catch { return null; }
  };
  const downloadOne = async (im: any, mime?: string) => {
    if (!im?.url || dlBusy) return;
    setDlBusy(im.id);
    try {
      const blob = await fetchBlob(im.url);
      if (!blob) { window.alert(t('dlFailed')); return; }
      const file = new File([blob], extOf(mime || blob.type, im.label || im.filename), { type: blob.type || mime || 'application/octet-stream' });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file] }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      }
      setDlOk(im.id); window.setTimeout(() => setDlOk((v) => (v === im.id ? null : v)), 2500);
    } finally { setDlBusy(null); }
  };
  const downloadSelected = async () => {
    const ids = [...selIds]; endBulk();
    setDlBusy('bulk');
    try {
      const files: File[] = [];
      for (const id of ids) {
        const a = assets.find((x: any) => x.id === id);
        if (!a?.previewUrl) continue;
        const blob = await fetchBlob(a.previewUrl);
        if (blob) files.push(new File([blob], extOf(a.mime, a.original_filename), { type: blob.type || a.mime || 'application/octet-stream' }));
        if (files.length >= 8) break; // share-ark tåler ikke ubegrenset
      }
      const nav = navigator as any;
      if (files.length && nav.canShare && nav.canShare({ files })) {
        await nav.share({ files }).catch(() => {});
      } else {
        for (const f of files) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(f);
          a.download = f.name;
          document.body.appendChild(a); a.click(); a.remove();
        }
      }
    } finally { setDlBusy(null); }
  };

  // Hurtigfiltre med EKTE tall fra cull-stats.
  const QUICK_REAL = [
    { key: 'alle', label: t('filterAll'), n: cull.total ?? 0 },
    { key: 'unrated', label: t('filterUnrated'), n: cull.unrated ?? 0 },
    { key: 'favoritter', label: t('filterFavorites'), n: cull.favorites ?? 0 },
    { key: 'highlights', label: t('filterHighlights'), n: cull.highlights ?? 0 },
    { key: 'forkastet', label: t('filterRejected'), n: cull.rejected ?? 0 },
  ];

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
      {/* Bibliotek-sidebar (kollapsbar) */}
      <Box sx={{ width: { xs: '100%', lg: sideCollapsed ? 54 : 220 }, flexShrink: 0, transition: 'width .2s ease' }}>
        <WsCard pad={1.25}>
          {sideCollapsed ? (
            <>
              <Stack spacing={0.5} alignItems="center" sx={{ mb: 1 }}>
                {LIB.map(([n]) => {
                  const Icon = LIB_ICON[n];
                  return (
                    <Box key={n} title={t(n)} onClick={() => setLib(n)} sx={{ width: 34, height: 34, borderRadius: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: lib === n ? ws.accentSoft : 'transparent', color: lib === n ? ws.accent : ws.textFaint, '&:hover': { bgcolor: ws.accentSoft } }}><Icon sx={{ fontSize: 17 }} /></Box>
                  );
                })}
              </Stack>
              <Stack spacing={0.5} alignItems="center">
                {isReal && <IconButton size="small" title={t('useTemplate')} onClick={(e) => setTplMenu(e.currentTarget)} sx={{ color: ws.textDim, p: 0.5 }}><AutoAwesomeMotion sx={{ fontSize: 16 }} /></IconButton>}
                <IconButton size="small" title={t('newFolder')} onClick={() => openFolderDlg('new')} sx={{ color: ws.textDim, p: 0.5 }}><CreateNewFolder sx={{ fontSize: 17 }} /></IconButton>
              </Stack>
              <IconButton size="small" onClick={() => setSideCollapsed(false)} sx={{ mt: 2, color: ws.textFaint }}><ChevronRight fontSize="small" /></IconButton>
            </>
          ) : (
            <>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint }}>{t('mediaLibrary')}</Typography>
                <IconButton size="small" onClick={() => setSideCollapsed(true)} sx={{ color: ws.textFaint, p: 0.25 }}><ChevronLeft fontSize="small" /></IconButton>
              </Stack>
              <Stack spacing={0.25} sx={{ mb: 1.5 }}>
                {LIB.map(([n, c]) => {
                  const Icon = LIB_ICON[n];
                  const cnt = isReal ? (LIB_TYPE[n] == null ? libCountAll : libStats[LIB_TYPE[n]] ?? 0) : c;
                  return (
                    <Stack key={n} direction="row" onClick={() => { setLib(n); setFolderSel(null); }} sx={{ px: 1, py: 0.75, borderRadius: 1.5, cursor: 'pointer', alignItems: 'center', gap: 0.75, bgcolor: lib === n ? ws.accentSoft : 'transparent', '&:hover': { bgcolor: lib === n ? ws.accentSoft : 'rgba(255,255,255,0.04)' } }}>
                      <Icon sx={{ fontSize: 15, color: lib === n ? ws.accent : ws.textFaint }} />
                      <Typography sx={{ fontSize: 13, flex: 1, color: lib === n ? ws.accent : ws.text, fontWeight: lib === n ? 700 : 500 }}>{t(n)}</Typography>
                      <Typography sx={{ fontSize: 11, color: lib === n ? ws.accent : ws.textFaint, fontWeight: lib === n ? 700 : 400 }}>{cnt}</Typography>
                    </Stack>
                  );
                })}
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint }}>{t('foldersHeading')}</Typography>
                <Stack direction="row" spacing={0.25}>
                  {isReal && <IconButton size="small" title={t('useTemplate')} onClick={(e) => setTplMenu(e.currentTarget)} sx={{ color: ws.textDim, p: 0.25 }}><AutoAwesomeMotion sx={{ fontSize: 15 }} /></IconButton>}
                  <IconButton size="small" title={t('newFolder')} onClick={() => openFolderDlg('new')} sx={{ color: ws.textDim, p: 0.25 }}><CreateNewFolder sx={{ fontSize: 16 }} /></IconButton>
                </Stack>
              </Stack>
              {isReal && folders.length === 0 && (
                <Box sx={{ px: 1, py: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mb: 0.75 }}>{t('noFolders')}</Typography>
                  <Button size="small" startIcon={<AutoAwesomeMotion sx={{ fontSize: 14 }} />} onClick={(e) => setTplMenu(e.currentTarget)} sx={{ color: ws.accent, textTransform: 'none', fontSize: 12 }}>{t('useTemplate')}</Button>
                </Box>
              )}
              <Stack spacing={0.25}>
                {folderList.map(([n, id]) => (
                  <Stack key={id || n} direction="row" alignItems="center" onClick={() => id && setFolderSel((s) => (s === id ? null : id))} sx={{ px: 1, py: 0.5, borderRadius: 1, cursor: id ? 'pointer' : 'default', bgcolor: folderSel === id ? ws.accentSoft : 'transparent', '&:hover .delf': { opacity: 1 } }}>
                    <Typography sx={{ fontSize: 12.5, flex: 1, color: folderSel === id ? ws.accent : ws.textDim, fontWeight: folderSel === id ? 700 : 400, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>{wsIcon('Folder', { fontSize: 14 })}{n}</Typography>
                    {id && <Typography sx={{ fontSize: 10.5, color: folderCounts[id] ? ws.textFaint : 'rgba(255,255,255,0.25)' }}>{folderCounts[id] ?? 0}</Typography>}
                    {id && (
                      <Stack direction="row" spacing={0} className="delf" sx={{ opacity: 0 }}>
                        <IconButton size="small" title="Gi nytt navn" onClick={() => openFolderDlg('rename', id, n)} sx={{ color: ws.textFaint, p: 0.1 }}><Edit sx={{ fontSize: 13 }} /></IconButton>
                        <IconButton size="small" title="Slett mappe" onClick={() => delFolder(id)} sx={{ color: ws.textFaint, p: 0.1 }}><Close sx={{ fontSize: 13 }} /></IconButton>
                      </Stack>
                    )}
                  </Stack>
                ))}
              </Stack>
              {isReal && refCols.length > 0 && (
                <>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, mt: 1.5, mb: 0.75 }}>{t('collections')}</Typography>
                  <Stack spacing={0.25}>
                    {refCols.map(([name, n]) => (
                      <Stack key={name} direction="row" alignItems="center" onClick={() => setRefSel((s) => (s === name ? null : name))} sx={{ px: 1, py: 0.5, borderRadius: 1, cursor: 'pointer', bgcolor: refSel === name ? ws.accentSoft : 'transparent', '&:hover .delf': { opacity: 1 } }}>
                        <Typography sx={{ fontSize: 12.5, flex: 1, color: refSel === name ? ws.accent : ws.textDim, fontWeight: refSel === name ? 700 : 400, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><Collections sx={{ fontSize: 14 }} />{name}</Typography>
                        <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{n}</Typography>
                        <Stack direction="row" spacing={0} className="delf" sx={{ opacity: 0 }}>
                          <IconButton size="small" title="Dupliser samling (kopierer kun referanser)" onClick={() => { setCloneDlg(name); setCloneName(`${name} kopi`); }} sx={{ color: ws.textFaint, p: 0.1 }}><Edit sx={{ fontSize: 13 }} /></IconButton>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </>
              )}
            </>
          )}
          <Menu open={!!tplMenu} anchorEl={tplMenu} onClose={() => setTplMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, py: 0.5 } }}>
            {templates.map((t) => <MenuItem key={t.key} onClick={() => applyTemplate(t.key)} sx={{ fontSize: 13 }}>{t.label} <Typography component="span" sx={{ ml: 1, fontSize: 11, color: ws.textFaint }}>({t.count})</Typography></MenuItem>)}
          </Menu>
        </WsCard>
      </Box>

      {/* Bulk-nøkkelord-dialog */}
      <WsModal open={kwBulkOpen} onClose={() => { setKwBulkOpen(false); setKwBulkText(''); }} title={`${t('keywords')} — ${selIds.size} ${t('selectedWord')}`} maxWidth="xs">
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: 12, color: ws.textDim }}>{t('bulkKwHint')}</Typography>
          <TextField autoFocus size="small" placeholder="vielse, motlys, ringer…" value={kwBulkText} onChange={(e) => setKwBulkText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyBulkKeywords(); }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput } }} />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => setKwBulkOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('cancel2')}</Button>
            <Button size="small" variant="contained" disabled={!kwBulkText.trim()} onClick={applyBulkKeywords} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('save')}</Button>
          </Stack>
        </Stack>
      </WsModal>

      {/* Dupliser samling — kopierer kun referanser, aldri bytes */}
      <WsModal open={!!cloneDlg} onClose={() => setCloneDlg(null)} title={cloneDlg ? `${t('cloneCollection')}: «${cloneDlg}»` : ''} maxWidth="xs">
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: 12, color: ws.textDim }}>{t('cloneHint')}</Typography>
          <TextField autoFocus size="small" label={t('newCollection')} value={cloneName} onChange={(e) => setCloneName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') cloneRef(); }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput } }} />
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => setCloneDlg(null)} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('cancel2')}</Button>
            <Button size="small" variant="contained" disabled={!cloneName.trim()} onClick={cloneRef} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('duplicate')}</Button>
          </Stack>
        </Stack>
      </WsModal>

      {/* Mappe-dialog (ny / gi nytt navn) */}
      <WsModal open={!!folderDlg} onClose={() => setFolderDlg(null)} title={folderDlg?.mode === 'new' ? t('newFolder') : 'Gi mappen nytt navn'} maxWidth="xs">
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{t('folderNumberHint')}</Typography>
          <TextField autoFocus size="small" label={t('folderPrompt')} value={folderName} onChange={(e) => setFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveFolder(); }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput } }} />
          {folderDlg?.mode === 'new' && tplSuggest.length > 0 && (
            <>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('folderSuggest')}</Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {tplSuggest.map((s: string) => (
                  <Box key={s} onClick={() => { setFolderName(s); }} title="Klikk for å fylle inn" sx={{ fontSize: 11, fontWeight: 700, color: ws.accent, cursor: 'pointer', border: `1px solid ${ws.accentBorder}`, borderRadius: 999, px: 0.75, py: 0.3, '&:hover': { bgcolor: ws.accentSoft } }}>{s} +</Box>
                ))}
              </Stack>
            </>
          )}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => setFolderDlg(null)} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('cancel2')}</Button>
            <Button size="small" variant="contained" disabled={!folderName.trim()} onClick={saveFolder} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('save')}</Button>
          </Stack>
        </Stack>
      </WsModal>

      {/* Asset-grid */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <style>{`
          @keyframes wsLivePulse2 { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); } 70% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
          @keyframes wsShimmer { 0%,100% { opacity: .45; } 50% { opacity: .9; } }
          @keyframes wsAmberBlink { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
          .ws-live-dot { width: 7px; height: 7px; border-radius: 999px; background: #22c55e; animation: wsLivePulse2 1.8s ease-out infinite; display: inline-block; }
          .ws-amber-dot { width: 7px; height: 7px; border-radius: 999px; background: #fbbf24; animation: wsAmberBlink .9s ease-in-out infinite; display: inline-block; }
          .ws-shimmer { animation: wsShimmer 1.4s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .ws-live-dot, .ws-amber-dot, .ws-shimmer { animation: none; } }
        `}</style>
        <WsPageTitle
          icon={<PhotoLibrary sx={{ fontSize: 21, color: '#fff' }} />}
          title={t(lib)}
          sub={isReal ? `${cull.total ?? 0} ${t('imagesWord')} · ${cull.favorites ?? 0} ${t('selectedWord')} · ${cull.highlights ?? 0} highlights${lastSync ? ` · synkronisert ${lastSync.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}` : '2 487 elementer'}
          children={<>
            {capLive && <Stack direction="row" spacing={0.5} alignItems="center"><Box className="ws-live-dot" /><Typography sx={{ fontSize: 10.5, color: '#22c55e', fontWeight: 700 }}>{t('live')}</Typography></Stack>}
            {cullFlash && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ px: 1, py: 0.25, borderRadius: 999, bgcolor: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.35)' }}>
                <Box className="ws-amber-dot" />
                <Typography sx={{ fontSize: 10.5, color: ws.amber, fontWeight: 800 }}>{t('cullLive')} · {cullFlash.n}</Typography>
              </Stack>
            )}
          </>}
          actions={<>
            <TextField size="small" placeholder={t('searchMedia')} value={q} onChange={(e) => setQ(e.target.value)} InputProps={{ startAdornment: <Search sx={{ fontSize: 16, color: ws.textFaint, mr: 0.5 }} /> }} sx={{ width: 190, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
            <Button component="label" size="small" variant="contained" startIcon={<CloudUpload sx={{ fontSize: 16 }} />} disabled={!isReal} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
              {t('upload')}
              <input type="file" accept="image/*,video/*,audio/*,.pdf,.zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f); e.target.value = ''; }} />
            </Button>
          </>}
        />

        <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.75 }} alignItems="center">
          {isReal
            ? QUICK_REAL.map((q) => (
                <Box key={q.key} onClick={() => setFilter(q.key)} sx={{
                  px: 1.25, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: filter === q.key ? 700 : 500,
                  color: filter === q.key ? ws.accent : ws.textDim, bgcolor: filter === q.key ? ws.accentSoft : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${filter === q.key ? ws.accentBorder : 'transparent'}`,
                }}>{q.label} {q.n}</Box>
              ))
            : QUICK.map(([n, c]) => <WsTag key={n} label={`${n} ${c}`} tone="neutral" />)}
          {isReal && Object.keys(colorCounts).length > 0 && Object.entries(colorCounts).map(([cl, n]) => (
            <Box key={cl} onClick={() => setFilter((f) => (f === `color:${cl}` ? 'alle' : `color:${cl}`))} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.15, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: filter === `color:${cl}` ? 700 : 500, color: filter === `color:${cl}` ? ws.accent : ws.textDim, bgcolor: filter === `color:${cl}` ? ws.accentSoft : 'rgba(255,255,255,0.04)', border: `1px solid ${filter === `color:${cl}` ? ws.accentBorder : 'transparent'}` }}>
              <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: COLOR_HEX[cl] || '#94a3b8' }} />{cl} {n}
            </Box>
          ))}
          <Box sx={{ flex: 1 }} />
          {isReal && (
            <Box onClick={() => setZoneMode((v) => !v)} title="Sesjon-soner" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: zoneMode ? ws.accent : ws.textDim, border: `1px solid ${zoneMode ? ws.accentBorder : ws.border}`, bgcolor: zoneMode ? ws.accentSoft : 'transparent' }}>{zoneMode ? <GridView sx={{ fontSize: 14 }} /> : <Layers sx={{ fontSize: 14 }} />}{zoneMode ? 'Flatt' : 'Soner'}</Box>
          )}
          <Box onClick={() => setSortBy((s) => (s === 'new' ? 'rating' : 'new'))} title="Sortering" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: ws.textDim, border: `1px solid ${ws.border}`, '&:hover': { color: ws.accent } }}><Sort sx={{ fontSize: 14 }} />{sortBy === 'new' ? 'Nyeste' : 'Beste rating'}</Box>
          <Box onClick={() => { if (isReal) setBulkMode((v) => { if (!v) setSelIds(new Set()); return !v; }); }} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: bulkMode ? ws.accent : ws.textDim, border: `1px solid ${bulkMode ? ws.accentBorder : ws.border}`, bgcolor: bulkMode ? ws.accentSoft : 'transparent' }}>{t('bulkMode')}</Box>
        </Stack>

        {/* Bulk-handlingsrad */}
        {bulkMode && (
          <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, px: 1, py: 0.75, borderRadius: 1.5, bgcolor: ws.accentSoft }} alignItems="center" flexWrap="wrap">
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: ws.accent }}>{selIds.size} {t('selectedWord')}</Typography>
            <Button size="small" onClick={(e) => setRateMenu(e.currentTarget)} sx={{ color: ws.text, textTransform: 'none', fontWeight: 700 }}>Rating ★</Button>
            <Button size="small" onClick={() => bulkFlag(true)} sx={{ color: ws.amber, textTransform: 'none', fontWeight: 700 }}>{t('filterHighlights')}</Button>
            <Button size="small" onClick={() => bulkFlag(false)} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 700 }}>Fjern stjerne</Button>
            <Button size="small" disabled={enhancing} onClick={bulkEnhance} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700 }}>✨ {t('sendToEnhance')}</Button>
            <Button size="small" disabled={dlBusy != null} onClick={downloadSelected} sx={{ color: ws.text, textTransform: 'none', fontWeight: 700 }}>{dlBusy === 'bulk' ? t('downloading') : `${t('download')} (${selIds.size})`}</Button>
            <Button size="small" onClick={() => setKwBulkOpen(true)} sx={{ color: ws.text, textTransform: 'none', fontWeight: 700 }}>{t('keywords')}</Button>
            <Button size="small" onClick={(e) => setBulkFolderMenu(e.currentTarget)} sx={{ color: ws.text, textTransform: 'none', fontWeight: 700 }}>Mappe ▾</Button>
            <Button size="small" onClick={endBulk} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 700, ml: 'auto' }}>{t('cancel2')}</Button>
            <Menu anchorEl={bulkFolderMenu || null} open={!!bulkFolderMenu} onClose={() => setBulkFolderMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, py: 0.5 } }}>
              {folders.map((f: any) => <MenuItem key={f.id} onClick={() => { setBulkFolderMenu(null); moveBulkFolder(f.id); }} sx={{ fontSize: 13 }}>{f.name}</MenuItem>)}
              <MenuItem onClick={() => { setBulkFolderMenu(null); moveBulkFolder(null); }} sx={{ fontSize: 13, color: ws.textDim }}>Ingen mappe</MenuItem>
            </Menu>
            <Menu anchorEl={rateMenu || null} open={!!rateMenu} onClose={() => setRateMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}` } }}>
              {[1, 2, 3, 4, 5].map((r) => <MenuItem key={r} onClick={() => { setRateMenu(null); bulkRate(r); }} sx={{ fontSize: 13 }}>{'★'.repeat(r)}</MenuItem>)}
              <MenuItem onClick={() => { setRateMenu(null); bulkRate(null); }} sx={{ fontSize: 13, color: ws.textDim }}>Ingen rating</MenuItem>
            </Menu>
          </Stack>
        )}

        {isReal && loadErr && assets.length === 0 ? (
          <WsErrorState message={t('loadError')} onRetry={reloadMedia} />
        ) : (
          <>
            {mediaLoading && assets.length === 0 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 1 }}>
                {Array.from({ length: 8 }).map((_, i) => <Box key={i} className="ws-shimmer" sx={{ aspectRatio: '1/1', borderRadius: `${ws.radiusSm}px`, bgcolor: 'rgba(255,255,255,0.05)' }} />)}
              </Box>
            )}
            {!mediaLoading && !loadErr && gridImages.length === 0 && (
              <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 3, mb: 1, textAlign: 'center', border: `1px dashed ${ws.border}`, borderRadius: 2 }}>{isReal ? t('emptyMedia') : t('emptyFiltered')}</Typography>
            )}
            {/* Drag-and-drop-sone + grid (flat eller sesjon-soner) */}
            <Box sx={{ position: 'relative' }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const fs = Array.from(e.dataTransfer?.files || []); if (fs.length && isReal) fs.forEach((f: File) => doUpload(f)); }}>
              {dragging && (
                <Box sx={{ position: 'absolute', inset: 0, zIndex: 10, borderRadius: 2, border: '2px dashed #6366f1', bgcolor: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <Box sx={{ px: 1.5, py: 0.75, borderRadius: 2, bgcolor: 'rgba(13,13,22,.9)' }}><Typography sx={{ fontSize: 14, fontWeight: 800, color: ws.accent }}>Slipp for å laste opp media</Typography></Box>
                </Box>
              )}
              {zoneMode && isReal ? (
                <Stack spacing={1.5}>
                  {(() => {
                    const map = new Map<string, any[]>();
                    for (const im of gridImages) { const k = im.sessionId || 'uploads'; if (!map.has(k)) map.set(k, []); map.get(k)!.push(im); }
                    const order = [...map.keys()].sort((a, b) => (a === 'uploads' ? 1 : b === 'uploads' ? -1 : ((map.get(b)?.length || 0) - (map.get(a)?.length || 0))));
                    return order.map((k) => (
                      <Box key={k}>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: ws.textDim }}>{k === 'uploads' ? 'Opplastinger' : sessionName(k)} · {map.get(k)!.length}</Typography>
                        </Stack>
                        <WsImageGrid columns={4} images={map.get(k)!}
                          bulk={bulkMode ? { sel: selIds, onToggle: bulkToggle } : undefined}
                          colorStrip={(im: any) => (im.colorLabel ? COLOR_HEX[im.colorLabel] || null : null)}
                          actions={(im: any) => (
                            <>
                              {lastUp === im.id && <Box sx={{ px: 0.6, py: 0.15, borderRadius: 1, bgcolor: 'rgba(34,197,94,.95)', color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</Box>}
                              {im.type && im.type !== 'image' && (
                                <Box sx={{ px: 0.6, py: 0.15, borderRadius: 1, bgcolor: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.35 }}>
                                  {im.type === 'video' ? <Videocam sx={{ fontSize: 11 }} /> : im.type === 'audio' ? <GraphicEq sx={{ fontSize: 11 }} /> : <Description sx={{ fontSize: 11 }} />}
                                  {im.type}
                                </Box>
                              )}
                              {im.createdAt && Date.now() - new Date(im.createdAt).getTime() < 86400000 && <Box sx={{ px: 0.6, py: 0.15, borderRadius: 1, bgcolor: 'rgba(34,197,94,.9)', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>NY</Box>}
                            </>
                          )}
                          onSelect={(im) => { const i = gridImages.findIndex((x: any) => x.id === im.id); openAssetAt(i === -1 ? 0 : i); }} />
                      </Box>
                    ));
                  })()}
                </Stack>
              ) : (
                <WsImageGrid columns={4} addLabel={t('uploadMedia')} images={gridImages} onUpload={doUpload}
                  accept="image/*,video/*,audio/*,.pdf,.zip"
                  bulk={bulkMode ? { sel: selIds, onToggle: bulkToggle } : undefined}
                  colorStrip={(im: any) => (im.colorLabel ? COLOR_HEX[im.colorLabel] || null : null)}
                  actions={(im: any) => (
                    <>
                      {lastUp === im.id && <Box sx={{ px: 0.6, py: 0.15, borderRadius: 1, bgcolor: 'rgba(34,197,94,.95)', color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</Box>}
                      {im.type && im.type !== 'image' && (
                        <Box sx={{ px: 0.6, py: 0.15, borderRadius: 1, bgcolor: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.35 }}>
                          {im.type === 'video' ? <Videocam sx={{ fontSize: 11 }} /> : im.type === 'audio' ? <GraphicEq sx={{ fontSize: 11 }} /> : <Description sx={{ fontSize: 11 }} />}
                          {im.type}
                        </Box>
                      )}
                      {im.createdAt && Date.now() - new Date(im.createdAt).getTime() < 86400000 && <Box sx={{ px: 0.6, py: 0.15, borderRadius: 1, bgcolor: 'rgba(34,197,94,.9)', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>NY</Box>}
                    </>
                  )}
                  onSelect={(im) => { const i = gridImages.findIndex((x: any) => x.id === im.id); openAssetAt(i === -1 ? 0 : i); }} />
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Asset-detaljer */}
      <Box sx={{ width: { xs: '100%', lg: 280 }, flexShrink: 0 }}>
        {(() => {
          const det = selAsset || (isReal ? null : { filename: 'A7IV_1234.CR3', flaggedForClient: true });
          if (!det) return (
            <WsCard><Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 3, textAlign: 'center' }}>{t('clickDetails')}</Typography></WsCard>
          );
          const detType = assetType(det.mime);
          const meta = isReal
            ? [
                [t('fileType'), det.mime || '—'],
                [t('size'), det.sizeBytes ? `${Math.round(det.sizeBytes / 1024 / 1024)} MB` : '—'],
                ['Status', det.state || '—'],
                ...(det.uploadedBy?.name ? [[t('uploadedBy'), det.uploadedBy.name]] : []),
                ...(det.sessionId ? [['Sesjon', sessionName(det.sessionId)]] : []),
              ]
            : [['Filtype', 'RAW Image'], ['Kamera', 'Sony A7IV'], ['Objektiv', '85mm f/1.4 GM'], ['Størrelse', '45 MB'], ['ISO', '800']];
          return (
            <WsCard>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 700 }}>{det.filename || t('image')}</Typography>
                {det.flaggedForClient && <Star sx={{ fontSize: 16, color: ws.amber }} />}
              </Stack>
              {det.previewUrl && detType === 'video' ? (
                <video controls preload="metadata" src={det.previewUrl} style={{ width: '100%', aspectRatio: '16/9', borderRadius: ws.radiusSm, background: '#000', display: 'block', border: `1px solid ${ws.borderSoft}` }} />
              ) : det.previewUrl && detType === 'audio' ? (
                <Box sx={{ p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                    <GraphicEq sx={{ fontSize: 20, color: ws.accent }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textDim }}>{t('audioFile')}</Typography>
                  </Stack>
                  <audio controls preload="none" src={det.previewUrl} style={{ width: '100%', height: 36 }} />
                </Box>
              ) : det.previewUrl ? (
                <Box sx={{ position: 'relative' }}>
                  <Box sx={{ aspectRatio: '4 / 3', borderRadius: `${ws.radiusSm}px`, background: `center/cover no-repeat url(${det.previewUrl})`, border: det.rejected ? '1.5px solid #f87171' : `1px solid ${ws.borderSoft}` }} />
                  {isReal && gridImages.length > 1 && selIdx != null && (
                    <>
                      <IconButton size="small" onClick={() => setSelIdx((selIdx + gridImages.length - 1) % gridImages.length)} sx={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', color: '#fff', bgcolor: 'rgba(0,0,0,0.45)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }, p: 0.5 }}>‹</IconButton>
                      <IconButton size="small" onClick={() => setSelIdx((selIdx + 1) % gridImages.length)} sx={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', color: '#fff', bgcolor: 'rgba(0,0,0,0.45)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }, p: 0.5 }}>›</IconButton>
                    </>
                  )}
                  {det.rejected && <Box sx={{ position: 'absolute', top: 6, left: 6, px: 0.7, py: 0.2, borderRadius: 1, bgcolor: 'rgba(248,113,113,.9)', color: '#fff', fontSize: 10, fontWeight: 800 }}>{t('rejectedWord')}</Box>}
                  {selIdx != null && <Typography sx={{ position: 'absolute', bottom: 6, right: 8, fontSize: 10.5, color: 'rgba(255,255,255,.85)', textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{selIdx + 1} / {gridImages.length}</Typography>}
                </Box>
              ) : <WsImageGrid columns={1} ratio="4 / 3" allowAdd={false} />}
              <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                {meta.map(([k, v]) => <Stack key={k} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12, color: ws.textDim }}>{k}</Typography><Typography sx={{ fontSize: 12, fontWeight: 600 }}>{v}</Typography></Stack>)}
                {isReal && det.id && exifCache[det.id] ? (() => {
                  const x = exifCache[det.id];
                  const rows: [string, string][] = [];
                  const make = x.Make || x.cameraMake || x.make;
                  const model = x.Model || x.cameraModel || x.model;
                  if (make || model) rows.push(['Kamera', [make, model].filter(Boolean).join(' ')]);
                  const lens = x.LensModel || x.Lens || x.lensModel; if (lens) rows.push(['Objektiv', lens]);
                  const fl = x.FocalLength35mm || x.FocalLength || x.focalLength; if (fl) rows.push(['Brennvidde', `${String(Number(fl).toFixed(0))}mm`]);
                  if (x.ISO != null && x.ISO !== 0) rows.push(['ISO', String(x.ISO)]);
                  if (x.FNumber || x.fNumber) rows.push(['Blender', `f/${x.FNumber || x.fNumber}`]);
                  if (x.ExposureTime || x.exposureTime) { const s = Number(x.ExposureTime || x.exposureTime); rows.push(['Lukker', s > 0 && s < 1 ? `1/${Math.round(1 / s)}s` : `${s}s`]); }
                  return rows.length ? (<>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, mt: 1.25, mb: 0.5 }}>EXIF</Typography>
                    <Stack spacing={0.75}>
                      {rows.map(([k, v]) => <Stack key={k} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12, color: ws.textDim }}>{k}</Typography><Typography sx={{ fontSize: 12, fontWeight: 600 }}>{v}</Typography></Stack>)}
                    </Stack>
                  </>) : null;
                })() : null}
                {isReal && det.id && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                    <Typography sx={{ fontSize: 12, color: ws.textDim }}>Mappe</Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      {folderGuess && folderGuess.confidence > 0 && folderGuess.folderId !== det.folderId && (
                        <Box onClick={() => moveAssetFolder(det.id, folderGuess.folderId)} title="ML-forslag — klikk for å flytte" sx={{ fontSize: 10.5, fontWeight: 800, color: ws.accent, cursor: 'pointer', border: `1px solid ${ws.accentBorder}`, borderRadius: 999, px: 0.65, py: 0.15, bgcolor: ws.accentSoft, whiteSpace: 'nowrap' }}>Foreslått: {folderGuess.folderName} · {folderGuess.confidence}% ≈</Box>
                      )}
                      <Box onClick={(e) => setAssetFolderMenu(e.currentTarget)} sx={{ fontSize: 11, fontWeight: 700, color: det.folderId ? ws.text : ws.textFaint, cursor: 'pointer', border: `1px dashed ${ws.border}`, borderRadius: 999, px: 0.65, py: 0.15 }}>{det.folderId ? folderNameOf(det.folderId) : 'Ingen mappe'} ▾</Box>
                    </Stack>
                  </Stack>
                )}
                <Menu anchorEl={assetFolderMenu || null} open={!!assetFolderMenu} onClose={() => setAssetFolderMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, py: 0.5 } }}>
                  {folders.map((f: any) => <MenuItem key={f.id} onClick={() => { setAssetFolderMenu(null); if (det.id) moveAssetFolder(det.id, f.id); }} sx={{ fontSize: 13 }}>{f.name}</MenuItem>)}
                  <MenuItem onClick={() => { setAssetFolderMenu(null); if (det.id) moveAssetFolder(det.id, null); }} sx={{ fontSize: 13, color: ws.textDim }}>Ingen mappe</MenuItem>
                </Menu>
                {isReal && det.id && (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 12, color: ws.textDim }}>{t('ratingWord')}</Typography>
                    <Stack direction="row" spacing={0.25} alignItems="center">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <Box key={r} onClick={() => patchAsset(det.id, { rating: (det.rating || 0) === r ? null : r })} sx={{ color: r <= (det.rating || 0) ? '#f59e0b' : ws.textFaint, cursor: 'pointer', fontSize: 16, lineHeight: 1, '&:hover': { transform: 'scale(1.25)' }, transition: 'transform .12s' }}>★</Box>
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Stack>
              {isReal && det.id && (
                <>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, mt: 1.25, mb: 0.5 }}>{t('keywords')}</Typography>
                  {(det.tags || []).length === 0 ? (
                    <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mb: 0.75 }}>{t('keywordsHint')}</Typography>
                  ) : (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}>
                      {(det.tags || []).map((tg: string) => (
                        <Box key={tg} onClick={() => saveTags(det.id, (det.tags || []).filter((x: string) => x !== tg))} title="Fjern nøkkelord" sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textDim, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}`, borderRadius: 999, px: 0.65, py: 0.15, cursor: 'pointer', '&:hover': { color: '#f87171', borderColor: 'rgba(248,113,113,.5)' } }}>{tg} ×</Box>
                      ))}
                    </Stack>
                  )}
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <TextField size="small" placeholder={t('addKeyword')} value={kwDraft} onChange={(e) => setKwDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && kwDraft.trim()) { saveTags(det.id, [...new Set([...(det.tags || []), kwDraft.trim().toLowerCase()])].slice(0, 40)); setKwDraft(''); } }} sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 12 } }} />
                    <Button size="small" disabled={kwBusy} onClick={runKeywords} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, fontSize: 11, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5, px: 1, minWidth: 44 }}>{kwBusy ? '…' : '✨ AI'}</Button>
                  </Stack>
                </>
              )}
              {isReal && det.id && (
                <>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, mt: 1.25, mb: 0.5 }}>{t('collections')}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 0.5 }} alignItems="center">
                    {(det.refs || []).map((cl: string) => (
                      <Box key={cl} onClick={() => removeRef(det.id, cl)} title="Fjern fra samling" sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textDim, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}`, borderRadius: 999, px: 0.65, py: 0.15, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.4, '&:hover': { color: '#f87171', borderColor: 'rgba(248,113,113,.5)' } }}><Collections sx={{ fontSize: 11 }} />{cl} ×</Box>
                    ))}
                    {(det.refs || []).length === 0 && <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{t('noCollections')}</Typography>}
                    <Box onClick={(e) => setRefMenu(e.currentTarget)} title="Legg til i samling" sx={{ fontSize: 11, fontWeight: 800, color: ws.accent, cursor: 'pointer', border: `1px dashed ${ws.accentBorder}`, borderRadius: 999, px: 0.65, py: 0.15 }}>+</Box>
                  </Stack>
                  <Menu anchorEl={refMenu || null} open={!!refMenu} onClose={() => setRefMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, py: 0.5 } }}>
                    {refCols.map(([name]) => <MenuItem key={name} disabled={(det.refs || []).includes(name)} onClick={() => addRef(name)} sx={{ fontSize: 13 }}>{name}</MenuItem>)}
                    <Box sx={{ px: 1.25, py: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TextField size="small" value={refNewName} onChange={(e) => setRefNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { addRef(refNewName); setRefNewName(''); } }} placeholder={`${t('newCollection')}…`} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 12 } }} />
                      <Button size="small" onClick={() => { addRef(refNewName); setRefNewName(''); }} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, minWidth: 0 }}>+</Button>
                    </Box>
                  </Menu>
                </>
              )}
              {det.flaggedForClient && <><Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mt: 1.5, mb: 0.5 }}>LABELS</Typography><Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}><WsTag label="Highlights" tone="amber" /></Stack></>}
              {det.previewUrl && (
                <>
                  <Button fullWidth size="small" variant="contained" disabled={dlBusy != null} onClick={() => downloadOne(det, det.mime)} sx={{ mt: 1.5, bgcolor: dlOk === det.id ? ws.green : ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
                    {dlBusy === det.id ? t('downloading') : dlOk === det.id ? `✓ ${t('saved')}` : t('saveToPhotos')}
                  </Button>
                  <Button fullWidth size="small" component="a" href={det.previewUrl} target="_blank" rel="noreferrer" sx={{ mt: 0.75, color: ws.textDim, textTransform: 'none', fontWeight: 600, border: `1px solid ${ws.border}` }}>{t('openOriginal')}</Button>
                </>
              )}
              {isReal && det.id && <Button fullWidth size="small" variant="outlined" disabled={enhancing} onClick={() => triggerEnhance([det.id])} startIcon={wsIcon('AutoAwesome', { fontSize: 15 })} sx={{ mt: 1, color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600, '&:hover': { borderColor: ws.accent, bgcolor: ws.accentSoft } }}>{enhancing ? t('sending') : t('sendToEnhance')}</Button>}
              {isReal && det.id && (
                <Button fullWidth size="small" onClick={() => patchAsset(det.id, { rejected: !det.rejected })} sx={{ mt: 0.75, color: det.rejected ? ws.textDim : '#f87171', textTransform: 'none', fontWeight: 600, border: `1px solid ${det.rejected ? ws.border : 'rgba(248,113,113,.4)'}` }}>{det.rejected ? t('undoReject') : `${t('rejectAction')} ${t('rejectedWord').toLowerCase()}`}</Button>
              )}
            </WsCard>
          );
        })()}

        {/* AI-cull-forslag — samme cull-motor som iPad (classifySession) */}
        {(isReal ? cullAi?.hasAssets : true) && (() => {
          const c = isReal ? (cullAi?.counts || {}) : { hero: 18, keep: 96, weak: 31, reject: 12, duplicates: 4 };
          const tot = isReal ? (cullAi?.total || 0) : 157;
          const rej = isReal ? (cullAi?.reject || []) : [
            { assetId: 'r1', score: 82, reasons: ['soft focus', 'eyes closed'], filename: 'A7IV_1090.CR3', thumbUrl: null },
            { assetId: 'r2', score: 76, reasons: ['duplicate', 'blurry'], filename: 'A7IV_1095.CR3', thumbUrl: null },
            { assetId: 'r3', score: 71, reasons: ['heavily clipped'], filename: 'A7IV_1101.CR3', thumbUrl: null },
            { assetId: 'r4', score: 68, reasons: ['background distraction'], filename: 'A7IV_1103.CR3', thumbUrl: null },
          ];
          const wk = isReal ? (cullAi?.weak || []) : [
            { assetId: 'w1', score: 58, reasons: ['minor motion blur'], filename: 'A7IV_1120.CR3', thumbUrl: null },
            { assetId: 'w2', score: 54, reasons: ['slight overexposure'], filename: 'A7IV_1124.CR3', thumbUrl: null },
            { assetId: 'w3', score: 51, reasons: ['busy background'], filename: 'A7IV_1130.CR3', thumbUrl: null },
            { assetId: 'w4', score: 48, reasons: ['tight crop needed'], filename: 'A7IV_1135.CR3', thumbUrl: null },
          ];
          const list = cullTab === 'reject' ? rej : wk;
          const shown = list.slice(0, showRejects ? list.length : 3);
          const segs = [
            { label: 'Hero', n: c.hero || 0, col: ws.amber },
            { label: t('keep'), n: c.keep || 0, col: ws.green },
            { label: t('weak'), n: c.weak || 0, col: ws.textDim },
            { label: t('reject'), n: c.reject || 0, col: ws.red },
          ];
          return (
            <WsCard sx={{ mt: 2 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                {wsIcon('SmartToy', { fontSize: 15, color: ws.textDim })}
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('aiCullTitle')}</Typography>
                <Box sx={{ flex: 1 }} />
                {isReal && (
                  <Stack direction="row" spacing={0.25} sx={{ bgcolor: ws.panelAlt, borderRadius: 999, p: 0.25 }}>
                    {(['conservative', 'balanced', 'aggressive'] as const).map((s) => (
                      <Box key={s} onClick={() => setCullStrict(s)} sx={{ px: 0.8, py: 0.2, borderRadius: 999, fontSize: 10, fontWeight: s === cullStrict ? 800 : 500, cursor: 'pointer', color: s === cullStrict ? ws.accentContrast : ws.textDim, bgcolor: s === cullStrict ? ws.accent : 'transparent' }}>{s === 'conservative' ? 'Kons.' : s === 'balanced' ? 'Balansert' : 'Aggressiv'}</Box>
                    ))}
                  </Stack>
                )}
                {isReal && rej.length > 0 && (
                  <Button size="small" onClick={() => { for (const s of rej) apiRequest(`/api/capture/assets/${encodeURIComponent(s.assetId)}`, { method: 'PATCH', body: { rejected: true } }).catch(() => {}); loadAi(); reloadMedia(); }} sx={{ color: '#f87171', textTransform: 'none', fontWeight: 700, fontSize: 11, border: `1px solid rgba(248,113,113,.4)`, borderRadius: 1.5, px: 1 }}>{t('rejectAll')} ({rej.length})</Button>
                )}
                <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{tot} {t('imagesWord')}</Typography>
              </Stack>

              {/* Fordeling: stablet 100 %-bar */}
              {tot > 0 && (
                <Box sx={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', bgcolor: ws.panelAlt, mb: 0.75 }}>
                  {segs.map((s) => s.n > 0 && <Box key={s.label} sx={{ width: `${(s.n / tot) * 100}%`, bgcolor: s.col, transition: 'width .4s ease' }} title={`${s.label}: ${s.n}`} />)}
                </Box>
              )}
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                {segs.map((s) => (
                  <Typography key={s.label} sx={{ fontSize: 10, color: ws.textFaint, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: s.col }} />{s.label} {s.n}
                  </Typography>
                ))}
                {(c.duplicates || 0) > 0 && <Typography sx={{ fontSize: 10, color: ws.textFaint, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.panelAlt, border: `1px solid ${ws.border}` }} />{c.duplicates} {(c.duplicates || 0) > 1 ? t('dupMany') : t('dupOne')}</Typography>}
              </Stack>

              {/* Faner: Forkast / Svak */}
              <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
                <Box onClick={() => setCullTab('reject')} sx={{ px: 1, py: 0.35, borderRadius: 999, fontSize: 11, fontWeight: cullTab === 'reject' ? 800 : 500, cursor: 'pointer', color: cullTab === 'reject' ? '#f87171' : ws.textDim, bgcolor: cullTab === 'reject' ? 'rgba(248,113,113,.12)' : 'transparent', border: `1px solid ${cullTab === 'reject' ? 'rgba(248,113,113,.4)' : 'transparent'}` }}>{t('reject')} ({rej.length})</Box>
                <Box onClick={() => setCullTab('weak')} sx={{ px: 1, py: 0.35, borderRadius: 999, fontSize: 11, fontWeight: cullTab === 'weak' ? 800 : 500, cursor: 'pointer', color: cullTab === 'weak' ? ws.amber : ws.textDim, bgcolor: cullTab === 'weak' ? 'rgba(251,191,36,.12)' : 'transparent', border: `1px solid ${cullTab === 'weak' ? 'rgba(251,191,36,.4)' : 'transparent'}` }}>{t('weak')} ({wk.length})</Box>
              </Stack>

              {list.length > 0 ? (
                <>
                  <Stack spacing={0.5}>
                    {shown.map((s: any) => (
                      <Stack key={s.assetId} direction="row" spacing={1} alignItems="center" onClick={() => { const i = gridImages.findIndex((x: any) => x.id === s.assetId); if (i !== -1) openAssetAt(i); }} sx={{ cursor: 'pointer', px: 0.5, py: 0.35, borderRadius: 1, '&:hover': { bgcolor: ws.panelAlt } }}>
                        {s.thumbUrl
                          ? <Box sx={{ width: 26, height: 26, borderRadius: 0.75, background: `center/cover no-repeat url(${s.thumbUrl})`, flexShrink: 0 }} />
                          : <Box sx={{ width: 26, height: 26, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography noWrap sx={{ fontSize: 11, fontWeight: 600 }}>{s.filename || s.assetId}</Typography>
                          <Stack direction="row" spacing={0.4} sx={{ mt: 0.25, flexWrap: 'wrap', gap: 0.4 }}>
                            {(s.reasons || []).slice(0, 2).map((r: string) => (
                              <Box key={r} sx={{ fontSize: 9, fontWeight: 700, color: cullTab === 'reject' ? ws.red : ws.amber, bgcolor: cullTab === 'reject' ? 'rgba(248,113,113,.1)' : 'rgba(251,191,36,.1)', borderRadius: 999, px: 0.5, py: 0.1 }}>{r}</Box>
                            ))}
                          </Stack>
                          <Box sx={{ height: 3, borderRadius: 999, bgcolor: ws.panelInput, mt: 0.4, overflow: 'hidden' }}>
                            <Box sx={{ width: `${Math.min(100, (s.score || 0))}%`, height: '100%', bgcolor: (s.score || 0) >= 70 ? '#f87171' : (s.score || 0) >= 50 ? '#fbbf24' : ws.textDim, transition: 'width .4s ease' }} />
                          </Box>
                        </Box>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: (s.score || 0) >= 70 ? ws.red : (s.score || 0) >= 50 ? ws.amber : ws.textFaint, flexShrink: 0 }}>{s.score ?? ''}{s.score != null ? '%' : ''}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  {list.length > 3 && (
                    <Button size="small" onClick={() => setShowRejects((v) => !v)} sx={{ mt: 0.5, color: ws.textDim, textTransform: 'none', fontSize: 11 }}>{showRejects ? t('cancel2') : `${t('showAll')} (${list.length}) ▾`}</Button>
                  )}
                </>
              ) : (
                <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{cullTab === 'reject' ? 'Ingen forkast-forslag – bra skutt! ✓' : 'Ingen svake forslag – skarpt parti!'}</Typography>
              )}
            </WsCard>
          );
        })()}

        {/* AI-forbedring — photo_enhancement_jobs (GFPGAN/Real-ESRGAN) */}
        {(isReal ? enhance?.hasJobs : true) && (() => {
          const s = isReal ? (enhance?.summary || {}) : { total: 12, done: 9, running: 2, failed: 1 };
          const jobs = isReal ? (enhance?.jobs || []) : [
            { id: 'e1', photoId: 'A7IV_1188.CR3', model: 'gfpgan', status: 'completed', progress: 100, originalUrl: null, enhancedUrl: null, thumbUrl: null, processingMs: 3200, createdAt: new Date().toISOString() },
            { id: 'e2', photoId: 'A7IV_1192.CR3', model: 'real-esrgan', status: 'completed', progress: 100, originalUrl: null, enhancedUrl: null, thumbUrl: null, processingMs: 5100 },
            { id: 'e3', photoId: 'A7IV_1218.CR3', model: 'ai-enhance', status: 'processing', progress: 62, originalUrl: null, enhancedUrl: null, thumbUrl: null },
            { id: 'e4', photoId: 'A7IV_1223.CR3', model: 'ai-enhance', status: 'processing', progress: 18, originalUrl: null, enhancedUrl: null, thumbUrl: null },
            { id: 'e5', photoId: 'A7IV_1090.CR3', model: 'gfpgan', status: 'failed', progress: 0, error: 'Unexpected vision failure', originalUrl: null, enhancedUrl: null, thumbUrl: null },
            { id: 'e6', photoId: 'A7IV_1255.CR3', model: 'real-esrgan', status: 'completed', progress: 100, originalUrl: null, enhancedUrl: null, thumbUrl: null, processingMs: 2600 },
          ];
          const st = (x: any) => (x === 'completed' || x === 'done' ? 'done' : x === 'failed' || x === 'error' ? 'failed' : 'running');
          const shown = enhanceAll ? jobs : jobs.slice(0, 6);
          return (
            <WsCard sx={{ mt: 2 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                {wsIcon('AutoAwesome', { fontSize: 15, color: ws.accent })}
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('aiEnhanceTitle')}</Typography>
                <Box sx={{ flex: 1 }} />
                {isReal && <IconButton size="small" title="Friske opp" onClick={loadAi} sx={{ color: ws.textFaint, p: 0.25 }}><Cached sx={{ fontSize: 15 }} /></IconButton>}
                <Typography sx={{ fontSize: 10.5, color: ws.green, fontWeight: 700 }}>{s.done || 0}/{s.total || 0} {t('doneWord')}</Typography>
              </Stack>
              {s.total > 0 && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Box sx={{ flex: 1, height: 6, borderRadius: 999, bgcolor: ws.panelInput, overflow: 'hidden', display: 'flex' }}>
                    <Box sx={{ width: `${((s.done || 0) / s.total) * 100}%`, bgcolor: ws.green, borderRadius: 999, transition: 'width .4s ease' }} />
                    {(s.running || 0) > 0 && <Box sx={{ width: `${((s.running || 0) / s.total) * 100}%`, bgcolor: ws.amber, opacity: .7 }} className="ws-shimmer" />}
                  </Box>
                  <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{Math.round(((s.done || 0) / s.total) * 100)}%</Typography>
                </Stack>
              )}
              {(s.running || 0) > 0 && <Typography sx={{ fontSize: 10.5, color: ws.amber, mb: 0.75, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}><Box className="ws-amber-dot" />{s.running} {t('enhancingNow')}{(s.failed || 0) > 0 ? ` · ${s.failed} ${t('failedWord')}` : ''}</Typography>}
              {isReal && <Button fullWidth size="small" variant="outlined" disabled={enhancing} onClick={() => triggerEnhance()} sx={{ mb: 1, color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600, fontSize: 11.5, '&:hover': { borderColor: ws.accent, bgcolor: ws.accentSoft } }}>{enhancing ? t('sending') : t('enhanceAll')}</Button>}
              <Stack spacing={0.5}>
                {shown.map((j: any) => {
                  const k = st(j.status);
                  const canCompare = !!(j.originalUrl && j.enhancedUrl);
                  return (
                    <Stack key={j.id} direction="row" spacing={1} alignItems="center" onClick={() => { if (canCompare) { setBaPos(50); setBeforeAfter(j); } }} sx={{ p: 0.65, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, cursor: canCompare ? 'pointer' : 'default', '&:hover': canCompare ? { bgcolor: 'rgba(255,255,255,0.06)' } : undefined }}>
                      {k === 'done' && canCompare ? (
                        <Stack direction="row" spacing={0.25} alignItems="center" flexShrink={0}>
                          <Box sx={{ width: 26, height: 26, borderRadius: 0.75, background: `center/cover no-repeat url(${j.originalUrl})`, flexShrink: 0, border: `1px solid ${ws.borderSoft}` }} />
                          <Typography sx={{ fontSize: 9, fontWeight: 800, color: ws.accent }}>→</Typography>
                          <Box sx={{ width: 26, height: 26, borderRadius: 0.75, background: `center/cover no-repeat url(${j.enhancedUrl})`, flexShrink: 0, border: `1px solid ${ws.accentBorder}` }} />
                        </Stack>
                      ) : (j.thumbUrl || j.enhancedUrl) ? (
                        <Box sx={{ width: 26, height: 26, borderRadius: 0.75, background: `center/cover no-repeat url(${j.thumbUrl || j.enhancedUrl})`, flexShrink: 0 }} />
                      ) : (
                        <Box sx={{ width: 26, height: 26, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ws.accent }}>{wsIcon('AutoAwesome', { fontSize: 15 })}</Box>
                      )}
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ fontSize: 11, fontWeight: 600 }}>{j.photoId || j.id}{canCompare && <Typography component="span" sx={{ fontSize: 9.5, color: ws.accent, ml: 0.5 }}>{t('beforeAfterShort')} ›</Typography>}</Typography>
                        <Typography noWrap sx={{ fontSize: 10, color: ws.textFaint }}>{(j.model || 'AI')}{j.type && j.type !== 'ai-enhance' ? ` · ${j.type}` : ''}{j.processingMs ? ` · ${(j.processingMs / 1000).toFixed(1)}s` : ''}{j.completedAt ? ` · ${fmtShort(j.completedAt)}` : ''}</Typography>
                        {k === 'running' && <Box sx={{ height: 3, borderRadius: 999, bgcolor: ws.panelInput, mt: 0.4, overflow: 'hidden' }}><Box className="ws-shimmer" sx={{ width: `${Math.max(8, j.progress ?? 35)}%`, height: '100%', bgcolor: ws.amber, borderRadius: 999 }} /></Box>}
                        {k === 'failed' && j.error && <Typography noWrap sx={{ fontSize: 10, color: ws.red, mt: 0.2 }}>{j.error}</Typography>}
                      </Box>
                      <WsTag label={k === 'done' ? t('statusDone') : k === 'failed' ? t('statusFailed') : t('statusRunning')} tone={k === 'done' ? 'green' : k === 'failed' ? 'red' : 'amber'} />
                    </Stack>
                  );
                })}
              </Stack>
              {jobs.length > 6 && (
                <Button size="small" onClick={() => setEnhanceAll((v) => !v)} sx={{ mt: 0.5, color: ws.textDim, textTransform: 'none', fontSize: 11 }}>{enhanceAll ? t('cancel2') : `${t('showAll')} (${jobs.length}) ▾`}</Button>
              )}
              {jobs.length === 0 && isReal && <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{t('noEnhanceJobs')}</Typography>}
            </WsCard>
          );
        })()}

        {/* Talenotater — fotografens innspilte voice-memos (Capture-appen) */}
        {(isReal ? voiceNotes.length > 0 : true) && (
          <WsCard sx={{ mt: 2 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
              {wsIcon('SettingsVoice', { fontSize: 15, color: ws.textDim })}
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('voiceNotesTitle')}</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{isReal ? voiceNotes.length : 2} {t('fromPhotographer')}</Typography>
            </Stack>
            <Stack spacing={1}>
              {(isReal ? voiceNotes : [
                { id: 's1', filename: 'A7IV_1188.CR3', comment: 'Hero-bilde — prioriter denne i redigering', durationSeconds: 8, thumbUrl: null },
                { id: 's2', filename: 'A7IV_1241.CR3', comment: 'Fiks refleksen i vinduet bak', durationSeconds: 5, thumbUrl: null },
              ]).map((n: any) => (
                <Box key={n.id} onClick={() => { const i = gridImages.findIndex((x: any) => x.id === n.assetId); if (i !== -1) openAssetAt(i); }} title={n.assetId ? 'Åpne bildet' : undefined} sx={{ p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}`, cursor: n.assetId ? 'pointer' : 'default', '&:hover': n.assetId ? { borderColor: ws.accentBorder } : undefined }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    {n.thumbUrl
                      ? <Box sx={{ width: 28, height: 28, borderRadius: 1, background: `center/cover no-repeat url(${n.thumbUrl})`, flexShrink: 0 }} />
                      : <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ws.textDim }}>{wsIcon('Image', { fontSize: 15 })}</Box>}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600 }}>{n.filename || t('image')}</Typography>
                      <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{n.reviewBy ? `${n.reviewBy} · ` : ''}{n.durationSeconds ? `${n.durationSeconds}s` : ''} {t('voiceNoteWord')}</Typography>
                    </Box>
                  </Stack>
                  {n.comment && <Typography sx={{ fontSize: 11.5, color: ws.textDim, mb: n.audioUrl ? 0.5 : 0 }}>«{n.comment}»</Typography>}
                  {n.audioUrl && <audio controls preload="none" src={n.audioUrl} style={{ width: '100%', height: 32 }} />}
                </Box>
              ))}
            </Stack>
          </WsCard>
        )}
      </Box>

      {/* Før/Etter — interaktiv AI-forbedring-sammenligning */}
      <WsModal open={!!beforeAfter} onClose={() => setBeforeAfter(null)} title={`${t('beforeAfterTitle')} — ${beforeAfter?.photoId || t('aiEnhanceTitle')}`} maxWidth="md">
        {beforeAfter && (
          <Box>
            <Box sx={{ position: 'relative', width: '100%', aspectRatio: '3 / 2', borderRadius: `${ws.radiusSm}px`, overflow: 'hidden', userSelect: 'none', bgcolor: '#000' }}>
              {/* Etter (full, under) */}
              <Box component="img" src={beforeAfter.enhancedUrl} alt={t('afterWord')} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              {/* Før (klippet av slider-posisjon, over) */}
              <Box sx={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - baPos}% 0 0)` }}>
                <Box component="img" src={beforeAfter.originalUrl} alt={t('beforeWord')} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
              {/* Skille-linje */}
              <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${baPos}%`, width: '2px', bgcolor: ws.accent, boxShadow: '0 0 8px rgba(0,0,0,0.6)', transform: 'translateX(-1px)' }} />
              {/* Etiketter */}
              <Box sx={{ position: 'absolute', top: 8, left: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.6)', fontSize: 11, fontWeight: 700, color: '#fff' }}>{t('beforeUpper')}</Box>
              <Box sx={{ position: 'absolute', top: 8, right: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255,140,0,0.85)', fontSize: 11, fontWeight: 700, color: ws.accentContrast }}>{t('afterUpper')}</Box>
            </Box>
            <Box sx={{ px: 1, mt: 2 }}>
              <input type="range" min={0} max={100} value={baPos} onChange={(e) => setBaPos(Number(e.target.value))} style={{ width: '100%', accentColor: ws.accent }} />
            </Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5, px: 0.5 }}>
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>
                {beforeAfter.model || 'AI'}{beforeAfter.type ? ` · ${beforeAfter.type}` : ''}{beforeAfter.processingMs ? ` · ${(beforeAfter.processingMs / 1000).toFixed(1)}s` : ''}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => window.open(beforeAfter.originalUrl, '_blank')} sx={{ color: ws.textDim, textTransform: 'none' }}>Original</Button>
                <Button size="small" variant="contained" onClick={() => window.open(beforeAfter.enhancedUrl, '_blank')} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('downloadEnhanced')}</Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </WsModal>
      <AiBuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} credits={credits} onBuy={buyPack} />
    </Stack>
  );
};

export default MediaTab;
