// @ts-nocheck
/**
 * MoodboardTab — design #5, dark CreatorHub.
 * Stats + kategori-pills + opplastbart moodboard-rutenett + Mood details (høyre)
 * + Fargepalett / Stilnotater / Må fanges / Referanser delt med teamet.
 * Alle bilde-flater bruker WsImageGrid (legg til / last opp).
 */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Stack, Typography, Button, TextField, Avatar, IconButton, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Menu, MenuItem } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import Edit from '@mui/icons-material/Edit';
import Close from '@mui/icons-material/Close';
import Add from '@mui/icons-material/Add';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import { apiRequest } from '@/lib/queryClient';
import Image from '@mui/icons-material/Image';
import Star from '@mui/icons-material/Star';
import Palette from '@mui/icons-material/Palette';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Search from '@mui/icons-material/Search';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import ImageSearch from '@mui/icons-material/ImageSearch';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import Print from '@mui/icons-material/Print';
import Layers from '@mui/icons-material/Layers';
import GridView from '@mui/icons-material/GridView';
import AspectRatio from '@mui/icons-material/AspectRatio';
import Sort from '@mui/icons-material/Sort';
import WbSunny from '@mui/icons-material/WbSunny';
import CameraAlt from '@mui/icons-material/CameraAlt';
import Build from '@mui/icons-material/Build';
import Groups from '@mui/icons-material/Groups';
import EditNote from '@mui/icons-material/EditNote';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsStat, WsPills, WsTag, WsImageGrid, WsModal, WsPageTitle } from '../ui';
import AiBuyCreditsModal from '../AiBuyCreditsModal';
import { useProjectImages } from '../useProjectImages';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from '../wsLocale';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab).
const T: WsDict = {
  generateConcept: { no: 'Generer konsept', en: 'Generate concept' },
  edit: { no: 'Rediger', en: 'Edit' },
  refCount: { no: 'Antall referanser', en: 'References' },
  inMoodboard: { no: 'i moodboardet', en: 'in the moodboard' },
  styleDirection: { no: 'Stil retning', en: 'Style direction' },
  styleSub: { no: 'Mykt, varmt, tidløst', en: 'Soft, warm, timeless' },
  palette: { no: 'Fargepalett', en: 'Color palette' },
  colors: { no: 'farger', en: 'colors' },
  sample: { no: 'eksempel', en: 'sample' },
  clientApproved: { no: 'Godkjent av kunde', en: 'Client approved' },
  partial: { no: 'Delvis', en: 'Partial' },
  lastUpdated: { no: 'Sist oppdatert 23. mai', en: 'Last updated 23 May' },
  searchPlaceholder: { no: 'Søk i moodboardet…', en: 'Search the moodboard…' },
  taggedAs: { no: 'Nye opplastinger her merkes', en: 'New uploads here are tagged' },
  uploadImage: { no: 'Last opp bilde', en: 'Upload image' },
  autoFromRefs: { no: 'Auto fra referanser', en: 'Auto from references' },
  extracting: { no: 'Trekker ut…', en: 'Extracting…' },
  samplePaletteHint: { no: 'Eksempel-palett — trykk «Auto fra referanser» for å trekke ut ekte farger.', en: 'Sample palette — click "Auto from references" to extract real colors.' },
  styleNotes: { no: 'Stilnotater', en: 'Style notes' },
  aiFromRefs: { no: 'AI fra referanser', en: 'AI from references' },
  analyzing: { no: 'Analyserer…', en: 'Analyzing…' },
  sampleNotesHint: { no: 'Eksempel — trykk «AI fra referanser» for å generere fra bildene.', en: 'Sample — click "AI from references" to generate from the images.' },
  mustCapture: { no: 'Må fanges', en: 'Must capture' },
  sharedRefs: { no: 'Referanser delt med teamet', en: 'References shared with the team' },
  seeAll: { no: 'Se alle', en: 'See all' },
  shareImage: { no: 'Del bilde', en: 'Share image' },
  uploadMain: { no: 'Last opp hovedbilde', en: 'Upload main image' },
  tagPortraits: { no: 'Portretter', en: 'Portraits' },
  tagCritical: { no: 'Kritisk stil', en: 'Critical style' },
  moodDesc: { no: 'Ønsker varme toner, mykt motlys og rolig, emosjonell komposisjon. Fokus på naturlige bevegelser og nærhet.', en: 'Wants warm tones, soft backlight and calm, emotional composition. Focus on natural movement and closeness.' },
  notesHeader: { no: 'NOTATER', en: 'NOTES' },
  note1: { no: 'Bruk lengre brennvidde (85mm+)', en: 'Use longer focal lengths (85mm+)' },
  note2: { no: 'Mykt motlys – unngå hardt sollys', en: 'Soft backlight – avoid harsh sunlight' },
  note3: { no: 'Naturlige interaksjoner', en: 'Natural interactions' },
  note4: { no: 'Ton ned farger i etterarbeid', en: 'Tone down colors in post' },
  responsible: { no: 'ANSVARLIGE', en: 'RESPONSIBLE' },
  person1: { no: 'Daniel (Foto)', en: 'Daniel (Photo)' },
  person2: { no: 'Emma (Video)', en: 'Emma (Video)' },
  conceptTitle: { no: 'Generer konsept-bilde (AI)', en: 'Generate concept image (AI)' },
  conceptDesc: { no: 'Beskriv stemningen/scenen, så genererer Nano Banana 2 et referansebilde rett inn i moodboardet.', en: 'Describe the mood/scene and Nano Banana 2 will generate a reference image straight into the moodboard.' },
  conceptPlaceholder: { no: 'f.eks. romantisk editorial bryllup, varmt motlys, myke filmtoner', en: 'e.g. romantic editorial wedding, warm backlight, soft film tones' },
  chip1: { no: 'Varmt golden hour-motlys', en: 'Warm golden hour backlight' },
  chip2: { no: 'Editorial fine-art, dempede toner', en: 'Editorial fine art, muted tones' },
  chip3: { no: 'Moody og filmatisk', en: 'Moody and cinematic' },
  chip4: { no: 'Lyst og luftig, naturlig', en: 'Bright and airy, natural' },
  perImage: { no: '~$0,06/bilde', en: '~$0.06/image' },
  balance: { no: 'saldo', en: 'balance' },
  buy: { no: 'Kjøp', en: 'Buy' },
  close: { no: 'Lukk', en: 'Close' },
  generating: { no: 'Genererer…', en: 'Generating…' },
  generate: { no: 'Generer', en: 'Generate' },
  error: { no: 'Feil', en: 'Error' },
  creditsAdded: { no: 'Kreditter lagt til ✓', en: 'Credits added ✓' },
  couldNotStart: { no: 'Kunne ikke starte', en: 'Could not start' },
  addedToMoodboard: { no: '✓ Lagt i moodboardet', en: '✓ Added to the moodboard' },
  failed: { no: 'Feilet', en: 'Failed' },
  conceptFailed: { no: 'Konsept-generering feilet', en: 'Concept generation failed' },
  notesFailed: { no: 'Kunne ikke generere notater — last opp referansebilder først.', en: 'Could not generate notes — upload reference images first.' },
  paletteFailed: { no: 'Kunne ikke trekke ut farger — last opp referansebilder først.', en: 'Could not extract colors — upload reference images first.' },
  allCat: { no: 'Alle', en: 'All' },
  editMoodboard: { no: 'Rediger moodboard', en: 'Edit moodboard' },
  stylePlaceholder: { no: 'f.eks. Romantisk / Editorial', en: 'e.g. Romantic / Editorial' },
  notesPerLine: { no: 'Stilnotater (én per linje)', en: 'Style notes (one per line)' },
  mustPerLine: { no: 'Må fanges (én per linje)', en: 'Must capture (one per line)' },
  namePlaceholder: { no: 'Navn', en: 'Name' },
  addColor: { no: 'Legg til farge', en: 'Add color' },
  cancel: { no: 'Avbryt', en: 'Cancel' },
  saving: { no: 'Lagrer…', en: 'Saving…' },
  save: { no: 'Lagre', en: 'Save' },
  couldNotSave: { no: 'Kunne ikke lagre', en: 'Could not save' },
  compact: { no: 'Kompakt', en: 'Compact' },
  selectImageHint: { no: 'Klikk på et bilde i moodboardet for å se det her', en: 'Click an image in the moodboard to view it here' },
  copied: { no: 'Kopiert!', en: 'Copied!' },
  matchCount: { no: 'treff', en: 'matches' },
  detailsCount: { no: 'av', en: 'of' },
  sources: { no: 'kilder', en: 'sources' },
  whereFrom: { no: 'Hvor fargene er hentet fra', en: 'Where the colors come from' },
  fromImages: { no: 'Hentet fra {n} bilde{r}', en: 'Extracted from {n} image{r}' },
  noSources: { no: 'Manuelt lagt til — ingen bildekilder', en: 'Manually added — no image sources' },
  hexPlaceholder: { no: '#Hex', en: '#Hex' },
  fromAISample: { no: 'Eksempel — sett refs for ekte kilder', en: 'Sample — add references for real sources' },
  bulkMode: { no: 'Velg flere', en: 'Select multiple' },
  zoneView: { no: 'Soner', en: 'Zones' },
  flatView: { no: 'Flatt', en: 'Flat' },
  overlay: { no: 'Format', en: 'Format' },
  bestFit: { no: 'Beste farge-match', en: 'Best color match' },
  fitScore: { no: 'fargematch', en: 'color match' },
  delete: { no: 'Slett', en: 'Delete' },
  star: { no: 'Stjernemerk', en: 'Flag' },
  unstar: { no: 'Fjern stjerne', en: 'Unflag' },
  setCategory: { no: 'Sett kategori', en: 'Set category' },
  cancel2: { no: 'Avslutt', en: 'Done' },
  missingRefs: { no: 'mangler refs', en: 'missing refs' },
  noShotsData: { no: 'Ingen shotliste — malen dekker kategoriene', en: 'No shot list — template covers the categories' },
  commentsHeader: { no: 'KOMMENTARER', en: 'COMMENTS' },
  commentPlaceholder: { no: 'Kommenter bildet…', en: 'Comment on the image…' },
  addShotSugg: { no: 'Lag shot-forslag', en: 'Add as shot suggestion' },
  shotAdded: { no: '✓ Lagt til i shotlisten', en: '✓ Added to the shot list' },
  approved: { no: 'Godkjent', en: 'Approved' },
  clickToApprove: { no: 'Klikk for å godkjenne', en: 'Click to approve' },
  printMood: { no: 'Skriv ut / last ned', en: 'Print / download' },
  coverage: { no: 'Ref-dekning mot shotliste', en: 'Reference coverage vs shot list' },
  samplesTip: { no: 'Farge-match vises etter «Auto fra referanser».', en: 'Color match appears after "Auto from references".' },
  paletteUse: { no: 'Fargebruk på shoot', en: 'Color use on shoot' },
  attachUse: { no: 'Tilknytt', en: 'Assign' },
  noUse: { no: 'Ikke tilknyttet', en: 'Unassigned' },
  useLabels: {
    no: { bakgrunn: 'Bakgrunn / kulisse', lys: 'Belysning / tone', brudekjole: 'Brudekjole', dress: 'Dress / mann', brudepiker: 'Brudepiker', blomster: 'Blomster / dekor', detaljer: 'Detaljer / props', post: 'Etterarbeid / gradering' },
    en: { bakgrunn: 'Background / set', lys: 'Lighting / tone', brudekjole: 'Wedding dress', dress: 'Suit / groom', brudepiker: 'Bridesmaids', blomster: 'Florals / decor', detaljer: 'Details / props', post: 'Post / grade' },
  } as any,
  addNote: { no: 'Legg til notat…', en: 'Add note…' },
  notesEmpty: { no: 'Ingen notater ennå — skriv egne eller la AI analysere referansene.', en: 'No notes yet — write your own or let AI analyze the references.' },
  noteCats: {
    no: { lys: 'Lys', komposisjon: 'Komposisjon', farge: 'Farge', teknikk: 'Teknikk', interaksjon: 'Interaksjon' },
    en: { lys: 'Light', komposisjon: 'Composition', farge: 'Color', teknikk: 'Technique', interaksjon: 'Interaction' },
  } as any,
  openOriginal: { no: 'Åpne original', en: 'Open original' },
  detailsSummary: { no: 'Oversikt', en: 'Overview' },
};
// Kategori-etiketter for pills på ekte prosjekter (nøklene/verdiene er uendret).
const CAT_I18N: Record<string, { no: string; en: string }> = {
  forb: { no: 'Forberedelser', en: 'Preparations' }, vielse: { no: 'Vielse', en: 'Ceremony' }, portrett: { no: 'Portretter', en: 'Portraits' }, golden: { no: 'Golden hour', en: 'Golden hour' }, detaljer: { no: 'Detaljer', en: 'Details' }, fest: { no: 'Fest', en: 'Reception' },
};

const CATS = [{ key: 'alle', label: 'Alle 86' }, { key: 'forb', label: 'Forberedelser 12' }, { key: 'vielse', label: 'Vielse 14' }, { key: 'portrett', label: 'Portretter 16' }, { key: 'golden', label: 'Golden hour 10' }, { key: 'detaljer', label: 'Detaljer 12' }, { key: 'fest', label: 'Fest 14' }];
const PALETTE = [['Elfenben', '#F6F2EB'], ['Champagne', '#EAD9C1'], ['Salvie', '#A6B49A'], ['Sand', '#DCC9B1'], ['Mørk grønn', '#2E4A3B'], ['Gull', '#D4A017']];
const STYLE_NOTES = ['Mykt naturlig lys', 'Varme hudtoner', 'Romantisk og tidløst', 'Dokumentarisk + editorial miks', 'Fokus på følelser og nærhet'];
// Bruker-events-WS (presence-fanout, samme kanal som iPad/web ellers).
const PRESENCE_WS_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BASE)
  ? import.meta.env.VITE_WS_BASE
  : 'wss://creatorhub-backend-rtbl.onrender.com';
const ini = (n: string) => (n || '?').slice(0, 1).toUpperCase();
/** Shoot-elementer en farge kan tilknyttes (label hentes fra i18n t('useLabels')). */
const PAL_USES = ['bakgrunn', 'lys', 'brudekjole', 'dress', 'brudepiker', 'blomster', 'detaljer', 'post'];
/** Kategorier for stilnotater (fargekodet + ikon). */
const NOTE_CATS: Record<string, { color: string; icon: any }> = {
  lys: { color: '#fbbf24', icon: WbSunny },
  komposisjon: { color: '#60a5fa', icon: CameraAlt },
  farge: { color: '#c084fc', icon: Palette },
  teknikk: { color: '#34d399', icon: Build },
  interaksjon: { color: '#f472b6', icon: Groups },
};
const guessNoteCat = (s: string): string => {
  const t = (s || '').toLowerCase();
  if (/(lys|motlys|sollys|golden|backlight|skygge|hardt|vinduslys|belysning)/.test(t)) return 'lys';
  if (/(komposisjon|brennvidde|85mm|50mm|vinkel|ramme|utsnitt|close|detalj)/.test(t)) return 'komposisjon';
  if (/(farge|tone|gradering|post|svart|hvit|hudtone|mettet|uned)/.test(t)) return 'farge';
  if (/(teknikk|kamera|iso|blender|lukker|gimbal|stativ|skarphet|4k|fps)/.test(t)) return 'teknikk';
  if (/(interaksjon|bevegelse|følelser|nærhet|gjester|naturlig|autentisk)/.test(t)) return 'interaksjon';
  return 'komposisjon';
};

// Sample-bilder (SVG-gradient data-URI) så kilder-visningen viser noe i demo.
const SAMPLE_MOOD_IMGS = [
  { id: 'sm1', b2Key: 'sm1', url: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f6f2eb"/><stop offset="100%" stop-color="#d4a017"/></linearGradient></defs><rect width="600" height="450" fill="url(#g)"/></svg>`), label: 'Golden hour motlys', category: 'golden' },
  { id: 'sm2', b2Key: 'sm1', url: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ead9c1"/><stop offset="100%" stop-color="#a6b49a"/></linearGradient></defs><rect width="600" height="450" fill="url(#g)"/></svg>`), label: 'Mykt morgenlys hage', category: 'vielse' },
  { id: 'sm3', b2Key: 'sm1', url: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2e4a3b"/><stop offset="100%" stop-color="#dcc9b1"/></linearGradient></defs><rect width="600" height="450" fill="url(#g)"/></svg>`), label: 'Festsal, dempet belysning', category: 'fest' },
];

const MoodboardTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [cat, setCat] = useState('alle');
  const mood = useProjectImages(projectId, 'moodboard');
  const shared = useProjectImages(projectId, 'moodboard-shared');
  const isReal = projectId && projectId !== 'sample';
  const [meta, setMeta] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [search, setSearch] = useState('');
  const [genNotes, setGenNotes] = useState(false);
  const [selMood, setSelMood] = useState<number | null>(null); // valgt bilde i grid → Mood details
  const [copied, setCopied] = useState<string | null>(null);
  const [sharedBig, setSharedBig] = useState(false);
  const [subTab, setSubTab] = useState<'canvas' | 'shared'>('canvas');
  const [selColor, setSelColor] = useState<number | null>(null); // «hvor kommer fargen fra»-visning
  const { user } = useAuth();
  // Studio-verktøy
  const [bulkMode, setBulkMode] = useState(false);
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const [zoneMode, setZoneMode] = useState(false);
  const [overlay, setOverlay] = useState<'none' | '9x16' | '4x5' | '1x1'>('none');
  const [fitSort, setFitSort] = useState(false);
  const [fullShots, setFullShots] = useState<any[] | null>(null);
  const [shotOk, setShotOk] = useState(false);
  const [imgComment, setImgComment] = useState('');
  const [bulkCatMenu, setBulkCatMenu] = useState<HTMLElement | null>(null);
  const [palUseMenu, setPalUseMenu] = useState<null | { anchor: HTMLElement; idx: number }>(null);
  const [selCatMenu, setSelCatMenu] = useState<HTMLElement | null>(null);
  // Stilnotater: kategorisert + inline-redigering (strings i meta, kategori utledes).
  const [notesEdit, setNotesEdit] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [noteText, setNoteText] = useState('');
  const notesTimer = useRef<any>(null);
  const saveNotesAll = (next: string[], noteCatsExtra?: Record<string, string>) => {
    setMeta((m: any) => ({ ...(m || {}), notes: next, ...(noteCatsExtra ? { noteCats: noteCatsExtra } : {}) }));
    if (!isReal) return;
    const body = {
      style: meta?.style || '', notes: next,
      mustCapture: meta?.mustCapture || [],
      palette: (meta?.palette || []).map((p: any) => ({ name: p.name ?? p[0] ?? '', hex: p.hex ?? p[1] ?? '', ...(p.from?.length ? { from: p.from } : {}), ...(p.use ? { use: p.use } : {}) })),
      noteCats: noteCatsExtra || meta?.noteCats || {},
    };
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => { apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`, { method: 'PUT', body }).catch((e: any) => { window.alert(e?.message || t('couldNotSave')); loadMeta(); }); }, 500);
  };
  const commitNoteEdit = () => {
    if (notesEdit == null) return;
    const body = notesDraft.trim();
    saveNotesAll(notes.map((n, i) => (i === notesEdit ? (body || t('note1')) : n)));
    setNotesEdit(null);
  };
  const addNote = () => {
    const body = noteText.trim();
    if (!body) return;
    saveNotesAll([...notes, body]);
    setNoteText('');
    // Kontekstuell læring: notatet trener kategori-modellen
    if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta/notes/learn`, { method: 'POST', body: { label: body, category: guessNoteCat(body) } }).catch(() => {});
  };
  // Kontekstuell notat-kategorisering: bruker-overstyringer (noteCats) + ML-gjett fallback.
  const noteHash = (s: string) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return String(Math.abs(h)); };
  const noteCatOf = (n: string) => (meta?.noteCats && meta.noteCats[noteHash(n)]) || guessNoteCat(n);
  const [noteCatMenu, setNoteCatMenu] = useState<null | { anchor: HTMLElement; idx: number; guess: string; conf: number }>(null);
  const setNoteCat = async (idx: number, cat: string) => {
    const n = notes[idx];
    if (!n && n !== '') return;
    const over = { ...(meta?.noteCats || {}), [noteHash(n)]: cat };
    setMeta((m: any) => ({ ...(m || {}), noteCats: over }));
    saveNotesAll(notes, over);
    if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta/notes/learn`, { method: 'POST', body: { label: n, category: cat } }).catch(() => {});
  };
  const openNoteCatMenu = (e: React.MouseEvent, idx: number) => {
    const n = notes[idx];
    if (!n) return;
    setNoteCatMenu({ anchor: e.currentTarget as HTMLElement, idx, guess: noteCatOf(n), conf: 0 });
    if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta/notes/guess`, { method: 'POST', body: { label: n } })
      .then((r: any) => setNoteCatMenu((m) => (m && m.idx === idx ? { ...m, guess: r?.category || m.guess, conf: r?.confidence || 0 } : m)))
      .catch(() => {});
  };
  // Live tilstedeværelse: hvem ser på moodboardet akkurat nå.
  const myPresName = user?.name || 'Meg';
  const [viewers, setViewers] = useState<{ userId: string; name: string | null }[]>([]);
  // WS-lytter: moodboard.presence for dette prosjektet → oppdater avatarraden live.
  useEffect(() => {
    if (!isReal || !projectId) return;
    const token = localStorage.getItem('creatorhub_auth_token') || localStorage.getItem('token') || localStorage.getItem('role_room_auth_token');
    if (!token) return;
    let alive = true;
    let ws: WebSocket | null = null;
    let retry: any = null;
    const connect = () => {
      if (!alive) return;
      clearTimeout(retry);
      try { ws = new WebSocket(`${PRESENCE_WS_BASE}/api/ipad/ws/events?token=${encodeURIComponent(token)}`); }
      catch { retry = setTimeout(connect, 8000); return; }
      ws.onclose = () => { if (alive) retry = setTimeout(connect, 8000); };
      ws.onerror = () => { try { ws && ws.close(); } catch { /* */ } };
      ws.onmessage = (ev) => {
        let p: any = null;
        try { p = JSON.parse(ev.data); } catch { /* */ }
        const e = p?.event;
        if (!e || e.kind !== 'moodboard.presence' || e.projectId !== projectId) return;
        if (e.joined && e.actorName) {
          setViewers((prev) => (prev.some((v) => v.userId === e.actorUserId) ? prev : [...prev, { userId: e.actorUserId, name: e.actorName }]));
        } else {
          setViewers((prev) => prev.filter((v) => v.userId !== e.actorUserId));
        }
      };
    };
    connect();
    return () => { alive = false; clearTimeout(retry); try { ws && ws.close(); } catch { /* */ } };
  }, [projectId, isReal]);
  // Join + hjertebank (20 s) + avmelding ved avmontering.
  useEffect(() => {
    if (!isReal || !projectId) return;
    const beat = () => {
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard/presence`, { method: 'POST', body: { name: myPresName } })
        .then((r: any) => { if (Array.isArray(r?.viewers)) setViewers(r.viewers); })
        .catch(() => {});
    };
    beat();
    const t = window.setInterval(beat, 20000);
    return () => {
      window.clearInterval(t);
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard/presence`, { method: 'DELETE' }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isReal]);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  // Utenlandske partner-vendors får engelsk UI (WsLocaleProvider i TeamWorkspacePage).
  const locale = useWsLocale();
  const t = makeT(T, locale);
  // AI konsept-generering (tekst→bilde) + kreditt
  const [aiCfg, setAiCfg] = useState<any | null>(null);
  const [credits, setCredits] = useState<any | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [conceptOpen, setConceptOpen] = useState(false);
  const [conceptPrompt, setConceptPrompt] = useState('');
  const [conceptBusy, setConceptBusy] = useState(false);
  const [conceptStatus, setConceptStatus] = useState('');
  const loadCredits = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits`).then((r: any) => setCredits(r || null)).catch(() => {}); };
  const buyPack = async (id: string) => { try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/checkout`, { method: 'POST', body: { packId: id } }); if (r?.url) window.location.href = r.url; } catch (e: any) { window.alert(e?.message || t('error')); } };
  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/config`).then((r: any) => setAiCfg(r || null)).catch(() => {});
    loadCredits();
    try { const p = new URLSearchParams(window.location.search); if (p.get('ai_credits') === 'ok' && p.get('cs')) { apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/confirm`, { method: 'POST', body: { sessionId: p.get('cs') } }).then(() => { loadCredits(); window.alert(t('creditsAdded')); }).catch(() => {}).finally(() => { const u = new URL(window.location.href); u.searchParams.delete('ai_credits'); u.searchParams.delete('cs'); window.history.replaceState({}, '', u.toString()); }); } } catch { /* */ }
    // eslint-disable-next-line
  }, [projectId]);
  const generateConcept = async () => {
    if (!conceptPrompt.trim() || conceptBusy) return;
    setConceptBusy(true); setConceptStatus(t('generating'));
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/concept-image`, { method: 'POST', body: { prompt: conceptPrompt.trim() } });
      if (!r?.jobId) throw new Error(t('couldNotStart'));
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 2500));
        if (!mountedRef.current) return; // avmontert mens vi pollet — ikke sett state
        const s: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${r.jobId}`);
        if (!mountedRef.current) return;
        if (s.status === 'completed') { setConceptStatus(t('addedToMoodboard')); mood.reload && mood.reload(); loadCredits(); break; }
        if (s.status === 'failed') { setConceptStatus(t('failed')); break; }
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('kreditt') || msg.includes('insufficient')) { setConceptOpen(false); setBuyOpen(true); }
      else window.alert(e?.message || t('conceptFailed'));
      setConceptStatus('');
    } finally { if (mountedRef.current) setConceptBusy(false); }
  };
  const loadMeta = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`).then((r: any) => setMeta(r?.meta || null)).catch(() => {}); };
  const generateNotes = async () => {
    if (!isReal || genNotes) return;
    setGenNotes(true);
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta/generate-notes`, { method: 'POST', body: {} }); setMeta((m: any) => ({ ...(m || {}), style: r.styleDirection, notes: r.notes, mustCapture: r.mustCapture })); }
    catch (e: any) { window.alert(e?.message || t('notesFailed')); }
    finally { setGenNotes(false); }
  };
  const extractPalette = async () => {
    if (!isReal || extracting) return;
    setExtracting(true);
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta/extract-palette`, { method: 'POST', body: {} });
      setMeta((m: any) => ({ ...(m || {}), palette: r.palette }));
      // Live-visning: åpner første farges kilder med en gang
      if (Array.isArray(r.palette) && r.palette.length) setSelColor(0);
    }
    catch (e: any) { window.alert(e?.message || t('paletteFailed')); }
    finally { setExtracting(false); }
  };
  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`).then((r: any) => setMeta(r?.meta || null)).catch(() => {});
  }, [projectId, isReal]);
  // Ekte prosjekt → ekte meta (tomt = tom-tilstand). Mock kun på /workspace/sample.
  const pal = isReal
    ? (meta?.palette || []).map((p: any) => ({ name: p.name || p[0] || '', hex: p.hex || p[1] || p, from: Array.isArray(p.from) ? p.from : p.srcs ? p.srcs : [], use: p.use || '' }))
    : PALETTE.map((p, i) => ({ name: p[0], hex: p[1], from: [SAMPLE_MOOD_IMGS[i % 3].b2Key], use: ['lys', 'bakgrunn', 'brudekjole', 'post', 'blomster', 'detaljer'][i] }));
  const notes = isReal ? (meta?.notes || []) : STYLE_NOTES;
  const refCount = isReal ? mood.images.length : 86;
  const styleDir = isReal ? (meta?.style || '—') : 'Romantisk / Editorial';
  // Kategori-tellere + filtrering + søk (ekte data).
  const catCount = (mood.images || []).reduce((m: any, im: any) => { if (im.category) m[im.category] = (m[im.category] || 0) + 1; return m; }, {});
  const realCats = isReal
    ? [{ key: 'alle', label: `${t('allCat')} ${mood.images.length}` }, ...CATS.filter((c) => c.key !== 'alle').map((c) => ({ key: c.key, label: `${CAT_I18N[c.key]?.[locale] || c.label.replace(/\s*\d+$/, '')} ${catCount[c.key] || 0}` }))]
    : CATS;
  const q = search.trim().toLowerCase();
  const gridImages = isReal
    ? mood.images.filter((im: any) => (cat === 'alle' || im.category === cat) && (!q || (im.label || '').toLowerCase().includes(q)))
    : [...SAMPLE_MOOD_IMGS, ...mood.images];
  // Kildelookup: b2Key → bildeobjekt (for «hvor fargen kommer fra»-visning).
  const keyToImg = (k: string) => mood.images.find((im: any) => im.b2Key === k) || SAMPLE_MOOD_IMGS.find((im) => im.b2Key === k) || null;
  const copyHex = (hex: string) => {
    try { navigator.clipboard?.writeText(hex).then(() => { setCopied(hex); window.setTimeout(() => setCopied(null), 1200); }).catch(() => {}); } catch { /* */ }
  };
  // Inline fargeredigering: optimistisk + debounced meta-PUT (400 ms). Fra-kilder bevares.
  const palSaveTimer = useRef<any>(null);
  const savePalette = (next: any[]) => {
    const bodyBase = { style: meta?.style || '', notes: meta?.notes || [], mustCapture: meta?.mustCapture || [] };
    setMeta((m: any) => ({ ...(m || {}), palette: next }));
    if (!isReal) return;
    if (palSaveTimer.current) clearTimeout(palSaveTimer.current);
    palSaveTimer.current = setTimeout(() => {
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`, {
        method: 'PUT',
        body: { ...bodyBase, palette: next.map((p) => ({ name: p.name, hex: p.hex, ...(p.from && p.from.length ? { from: p.from } : {}), ...(p.use ? { use: p.use } : {}) })) },
      }).catch((e: any) => { window.alert(e?.message || t('couldNotSave')); loadMeta(); });
    }, 400);
  };
  const setPalAt = (i: number, patch: any) => savePalette(pal.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const addPalColor = () => savePalette([...pal, { name: t('namePlaceholder'), hex: '#cccccc', from: [] }]);
  const selIm = selMood != null ? gridImages[selMood] : null;
  const stepSel = (d: number) => { if (gridImages.length) setSelMood((selMood + d + gridImages.length) % gridImages.length); };
  // Tastatur-navigasjon i Mood details: ←/→ bytter bilde, Esc lukker.
  useEffect(() => {
    if (selMood == null || gridImages.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setSelMood((m) => (m == null ? m : (e.key === 'ArrowRight' ? (m + 1) % gridImages.length : (m - 1 + gridImages.length) % gridImages.length))); }
      else if (e.key === 'Escape') setSelMood(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selMood, gridImages.length]);
  // Kategori + stjerne på valgt bilde (PATCH images/:id).
  const setSelCat = (k: string | null) => {
    setSelCatMenu(null);
    if (!selIm || !isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(selIm.id)}`, { method: 'PATCH', body: { category: k } })
      .then(() => mood.reload()).catch((e: any) => window.alert(e?.message || t('couldNotSave')));
  };
  const toggleSelFlag = () => {
    if (!selIm || !isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(selIm.id)}`, { method: 'PATCH', body: { flag: !selIm.flag } })
      .then(() => mood.reload()).catch((e: any) => window.alert(e?.message || t('couldNotSave')));
  };

  // Ref-dekning mot shotlisten: shots pr. kategori vs. refs (bilder) pr. kategori.
  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/shot-list`).then((r: any) => setFullShots(Array.isArray(r?.shots) ? r.shots : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  const covByCat = (cat: string) => {
    if (!fullShots) return null;
    const shots = fullShots.filter((s: any) => (s.category || s.kategori || s.phase || s.scene || '—') === cat).length;
    return { shots, refs: catCount[cat] || 0, missing: Math.max(0, shots - (catCount[cat] || 0)) };
  };

  const bulkToggle = (id: string) => setSelIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const endBulk = () => { setBulkMode(false); setSelIds(new Set()); };
  const patchSel = (body: any) => { for (const id of selIds) { apiRequest(`/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(id)}`, { method: 'PATCH', body }).catch(() => {}); } mood.reload(); endBulk(); };
  const delSel = () => { for (const id of selIds) { apiRequest(`/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {}); } mood.reload(); endBulk(); };

  // Kommentar på bilde (anker-disktusjon) — PATCH comments på raden.
  const addImgComment = async () => {
    const body = imgComment.trim();
    if (!body || !selIm) return;
    const now = new Date();
    const c = { id: crypto.randomUUID(), who: user?.name || 'Meg', t: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, ts: now.toISOString(), msg: body };
    const next = [...(Array.isArray(selIm.comments) ? selIm.comments : []), c];
    setImgComment('');
    if (isReal) { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(selIm.id)}`, { method: 'PATCH', body: { comments: next } }).catch((e: any) => window.alert(e?.message || t('couldNotSave'))); mood.reload(); }
    else { /* sample: lokalt — ingen lagring */ }
  };
  // Ref → shot-forslag (POST full shotliste, samme som ShotlistTab).
  const refToShot = async () => {
    if (!selIm || !isReal) return;
    const shot = { id: crypto.randomUUID(), scene: selIm.category || 'Annet', name: selIm.label || 'Moodboard-forslag', priority: 'normal', locationName: '', isCompleted: false, status: 'planlagt' };
    const next = [...(fullShots || []), shot];
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/shot-list`, { method: 'POST', body: { shots: next } }); setFullShots(next); setShotOk(true); window.setTimeout(() => setShotOk(false), 2000); }
    catch (e: any) { window.alert(e?.message || t('couldNotSave')); }
  };
  // Kunde-godkjenning: klikk på stat → veksle approved/partial.
  const toggleApproval = async () => {
    const next = (meta?.clientApproved || 'partial') === 'approved' ? 'partial' : 'approved';
    setMeta((m: any) => ({ ...(m || {}), clientApproved: next }));
    if (isReal) {
      const cur = meta || {};
      try {
        await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`, {
          method: 'PUT',
          body: { style: cur.style || '', notes: cur.notes || [], mustCapture: meta?.mustCapture || [], palette: (cur.palette || []).map((p: any) => ({ name: p.name ?? p[0] ?? '', hex: p.hex ?? p[1] ?? '' })), clientApproved: next },
        });
      } catch (e: any) { loadMeta(); }
    }
  };
  // Skriv ut / last ned: premium editorial-utskrift (ivory-papir, serif, gull).
  const openPrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const today = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
    const approv = (meta?.clientApproved || 'partial') === 'approved';
    const idx = (i: number) => String(i + 1).padStart(2, '0');
    const swatches = pal.map((p, i) => `
      <div class="sw" style="--c:${esc(p.hex)}">
        <span class="sw-idx">${idx(i)}</span>
        <div class="sw-swatch"></div>
        <div class="sw-meta">
          <div class="sw-name">${esc(p.name)}</div>
          <div class="sw-hex">${esc(p.hex)}${p.use ? ` · ${esc(t('useLabels')[p.use])}` : ''}${p.from.length ? ` · ${p.from.length} ${p.from.length === 1 ? 'kilde' : 'kilder'}` : ''}</div>
        </div>
      </div>`).join('');
    const notesHtml = notes.map((n) => `<p><span class="ncat">${esc(t('noteCats')[noteCatOf(n)])}</span>${esc(n)}</p>`).join('');
    const imgs = shownImgs.slice(0, 42).map((im: any, i: number) => `
      <figure class="card">
        <div class="thumb"><img src="${esc(im.url)}" alt="" loading="lazy">${typeof im.fit === 'number' ? `<span class="fit">${im.fit}%</span>` : ''}${im.flag ? '<span class="star">★</span>' : ''}<span class="img-idx">${idx(i)}</span></div>
        <figcaption>
          <span class="lbl">${esc(im.label || 'Uten tittel')}</span>
          ${im.category ? `<span class="tag">${esc(im.category)}</span>` : ''}
        </figcaption>
      </figure>`).join('');
    w.document.write(`<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>Moodboard — ${esc(projectId)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; }
      @page { margin: 16mm 15mm 18mm; }
      body { font-family: 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif; color: #211d19; background: #faf8f3; padding: 10px 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; counter-reset: page; }
      .sheet { max-width: 210mm; margin: 0 auto; }
      /* ── Hode ── */
      .head { display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 1.5px solid #211d19; padding-bottom: 16px; margin-bottom: 10px; }
      .head h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; font-size: 40px; letter-spacing: -0.4px; line-height: 1; }
      .head .sub { font-size: 10.5px; text-transform: uppercase; letter-spacing: 2.6px; color: #9a8a6c; margin-top: 6px; }
      .seal { position: relative; width: 74px; height: 74px; border-radius: 50%; flex-shrink: 0; }
      .seal.approved { border: 2px solid #3f7d5c; color: #3f7d5c; transform: rotate(-8deg); }
      .seal.partial { border: 1.5px solid #b9a878; color: #b9a878; transform: rotate(-8deg); }
      .seal span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600; letter-spacing: 1.6px; text-align: center; line-height: 1.35; }
      .meta { display: flex; gap: 22px; flex-wrap: wrap; font-size: 11px; color: #6b6357; letter-spacing: .3px; margin: 12px 0 4px; }
      .meta b { color: #211d19; font-weight: 600; }
      .meta .sp { color: #c8bda8; }
      /* ── Seksjoner ── */
      .sec { margin-top: 26px; }
      .sec-head { display: flex; align-items: baseline; gap: 12px; border-bottom: 1px solid #d8d0c0; padding-bottom: 7px; margin-bottom: 14px; }
      .sec-num { font-family: 'Cormorant Garamond', serif; font-size: 15px; color: #a58a5a; font-style: italic; }
      .sec-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 3px; color: #211d19; }
      .sec-hint { margin-left: auto; font-size: 10px; color: #a29a8a; letter-spacing: .6px; text-transform: uppercase; }
      /* ── Palett ── */
      .pal-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1px solid #ddd3c1; }
      .sw { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-bottom: 1px solid #e7dfcf; background: #fffdf9; position: relative; }
      .sw:nth-child(n+4) { border-bottom: 0; }
      .sw:not(:nth-child(3n)) { border-right: 1px solid #e7dfcf; }
      .sw-idx { position: absolute; top: 6px; right: 9px; font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 10.5px; color: #c8bda8; }
      .sw-swatch { width: 34px; height: 34px; border-radius: 50%; background: var(--c); border: 1px solid rgba(0,0,0,.12); box-shadow: inset 0 -3px 6px rgba(0,0,0,.12); }
      .sw-name { font-family: 'Cormorant Garamond', serif; font-size: 15.5px; font-weight: 600; }
      .sw-hex { font-size: 9.5px; letter-spacing: 1.1px; color: #a29a8a; text-transform: uppercase; margin-top: 1px; }
      /* ── Notater ── */
      blockquote { font-family: 'Cormorant Garamond', serif; font-size: 16.5px; line-height: 1.75; color: #211d19; columns: 2; column-gap: 40px; }
      blockquote p { margin: 0 0 8px; }
      blockquote .ncat { font-family: 'Inter', sans-serif; font-size: 8.5px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; color: #a58a5a; margin-right: 8px; }
      /* ── Bilder ── */
      .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 9px; }
      figure.card { margin: 0; page-break-inside: avoid; }
      .thumb { position: relative; aspect-ratio: 1/1; overflow: hidden; background: #efe9dc; border: 1px solid #ddd3c1; }
      .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .fit { position: absolute; right: 5px; bottom: 5px; background: rgba(33,29,25,.78); color: #f3ead9; font-size: 8.5px; font-weight: 600; letter-spacing: .5px; border-radius: 3px; padding: 1.5px 5px; }
      .star { position: absolute; top: 4px; left: 5px; color: #c9a227; font-size: 12px; }
      .img-idx { position: absolute; top: 4px; right: 5px; font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 9.5px; color: rgba(255,255,255,.85); text-shadow: 0 1px 2px rgba(0,0,0,.4); }
      figcaption { padding: 6px 2px 0; }
      figcaption .lbl { font-family: 'Cormorant Garamond', serif; font-size: 12.5px; font-weight: 600; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      figcaption .tag { display: inline-block; font-size: 8.5px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; color: #a58a5a; margin-top: 2px; }
      /* ── Fot ── */
      footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #d8d0c0; display: flex; justify-content: space-between; font-size: 9.5px; letter-spacing: 1.2px; text-transform: uppercase; color: #a29a8a; }
      footer .brand { color: #211d19; font-weight: 600; }
      .foot-note { font-style: italic; font-family: 'Cormorant Garamond', serif; font-size: 12px; text-transform: none; letter-spacing: .2px; color: #a58a5a; }
      @media print { body { background: #fff; padding: 0; } }
    </style></head><body>
    <div class="sheet">
      <div class="head">
        <div>
          <h1>Moodboard</h1>
          <div class="sub">CreatorHub · Moodboard Studio</div>
        </div>
        <div class="seal ${approv ? 'approved' : 'partial'}"><span>${approv ? 'GODKJENT AV KUNDE' : 'DELVIS GODKJENT'}</span></div>
      </div>
      <div class="meta">
        <span><b>${today}</b></span><span class="sp">·</span>
        <span>Prosjekt <b>${esc(projectId)}</b></span><span class="sp">·</span>
        <span><b>${shownImgs.length}</b> bilder</span><span class="sp">·</span>
        <span><b>${pal.length}</b> farger</span><span class="sp">·</span>
        <span><b>${notes.length}</b> notater</span>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-num">01</span><span class="sec-title">Fargepalett</span><span class="sec-hint">${esc(styleDir)}</span></div>
        <div class="pal-row">${swatches}</div>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-num">02</span><span class="sec-title">Stilnotater</span><span class="sec-hint">Retning</span></div>
        <blockquote>${notesHtml || '<p>—</p>'}</blockquote>
      </div>

      <div class="sec">
        <div class="sec-head"><span class="sec-num">03</span><span class="sec-title">Referansebilder</span><span class="sec-hint">${shownImgs.length} utvalgte</span></div>
        <div class="grid">${imgs}</div>
      </div>

      <footer>
        <span class="brand">CreatorHub</span>
        <span class="foot-note">«${esc(styleDir)}»</span>
        <span>Generert ${today}</span>
      </footer>
    </div>
    <script>window.onload = () => setTimeout(() => window.print(), 700);</script>
    </body></html>`);
    w.document.close();
  };

  // Zone-visning: grupperst grid pr. kategori (kun ekte prosjekter).
  const shownImgs = fitSort ? [...gridImages].sort((a: any, b: any) => (b.fit ?? -1) - (a.fit ?? -1)) : gridImages;
  const groups: Record<string, any[]> = {};
  if (zoneMode) for (const im of shownImgs) { const k = im.category || 'Annet'; (groups[k] = groups[k] || []).push(im); }
  const gridProps = {
    bulk: bulkMode ? { sel: selIds, onToggle: bulkToggle } : undefined,
    showFit: true,
    overlay: overlay === 'none' ? undefined : overlay,
    search: q || undefined,
    addLabel: t('uploadImage'),
    onUpload: (f: any) => mood.onUpload(f, cat === 'alle' ? undefined : cat),
    onSelect: (im: any) => { const i = shownImgs.findIndex((x: any) => x.id === im.id); if (i !== -1) setSelMood(i); },
  } as any;
  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <style>{`
          @keyframes wsFadeUp2 { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
          @keyframes wsPresPulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); } 70% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
          .ws-fade-up2 { animation: wsFadeUp2 .4s cubic-bezier(.22,1,.36,1) both; }
          .ws-pres-ok { animation: wsPresPulse 2s ease-out infinite; }
          @media (prefers-reduced-motion: reduce) { .ws-fade-up2, .ws-pres-ok { animation: none; } }
        `}</style>
        <WsPageTitle
          icon={<Image sx={{ fontSize: 21, color: '#fff' }} />}
          title="Moodboard"
          sub={`${refCount} ${t('refCount').toLowerCase()} · ${pal.length} ${t('colors').toLowerCase()}`}
          children={<>
            {/* Live tilstedeværelse: hvem ser på akkurat nå */}
            <Stack direction="row" spacing={-0.5} alignItems="center">
              {(isReal ? viewers : [{ userId: 's1', name: 'Daniel' }, { userId: 's2', name: 'Emma' }]).map((v) => (
                <Box key={v.userId} title={v.name || 'Ser på'} sx={{ position: 'relative' }}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: 10, border: `2px solid ${ws.panelSolid}`, bgcolor: ws.panelAlt, color: ws.accent, fontWeight: 800 }}>{ini(v.name || '?')}</Avatar>
                  <Box className="ws-pres-ok" sx={{ position: 'absolute', right: -1, bottom: -1, width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c55e', border: '1px solid #0d0d16' }} />
                </Box>
              ))}
              {isReal && viewers.length > 0 && <Typography sx={{ fontSize: 10.5, color: ws.textFaint, ml: 1, fontWeight: 700 }}>{viewers.length}</Typography>}
            </Stack>
          </>}
          actions={<>
            {isReal && aiCfg?.enabled && aiCfg?.whitelisted && <Button size="small" startIcon={<AutoAwesome sx={{ fontSize: 15 }} />} onClick={() => { setConceptPrompt(''); setConceptStatus(''); setConceptOpen(true); }} sx={{ color: ws.accentContrast, bgcolor: ws.accent, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('generateConcept')}</Button>}
            {isReal && <Button size="small" startIcon={<Edit sx={{ fontSize: 15 }} />} onClick={() => setEditOpen(true)} sx={{ color: ws.text, textTransform: 'none', border: `1px solid ${ws.border}` }}>{t('edit')}</Button>}
          </>}
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <Box className="ws-fade-up2"><WsStat icon={<Image sx={{ fontSize: 20 }} />} label={t('refCount')} value={refCount} sub={isReal ? t('inMoodboard') : '+12 denne uken'} /></Box>
          <Box className="ws-fade-up2" sx={{ animationDelay: '60ms' }}><WsStat icon={<Star sx={{ fontSize: 20 }} />} label={t('styleDirection')} value={<Typography sx={{ fontSize: 15, fontWeight: 800 }}>{styleDir}</Typography>} sub={t('styleSub')} /></Box>
          <Box className="ws-fade-up2" sx={{ animationDelay: '120ms' }}>
            <WsCard pad={1.75}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Palette sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 12, color: ws.textDim }}>{t('palette')}</Typography></Stack>
              <Stack direction="row" spacing={0.5}>
                {pal.map((p) => (
                  <Box key={`${p.name}${p.hex}`} title={`${p.name} · ${p.hex} — klikk for å kopiere`} onClick={() => copyHex(p.hex)} sx={{ width: 22, height: 22, borderRadius: 1, bgcolor: p.hex, border: copied === p.hex ? '2px solid #fff' : `1px solid ${ws.borderSoft}`, cursor: 'pointer', transition: 'transform .12s, border-color .12s', '&:hover': { transform: 'scale(1.15)' } }}>
                    {copied === p.hex && <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>✓</Box>}
                  </Box>
                ))}
              </Stack>
              <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.75 }}>{pal.length} {t('colors')}{(!meta?.palette || !meta.palette.length) && isReal ? ` · ${t('sample')}` : ''}</Typography>
            </WsCard>
          </Box>
          <Box className="ws-fade-up2" sx={{ animationDelay: '180ms', cursor: 'pointer', borderRadius: 2, transition: 'box-shadow .2s', '&:hover': { boxShadow: '0 0 0 1px rgba(52,211,153,.35)' } }} onClick={toggleApproval} title={t('clickToApprove')}>
            <WsStat icon={<CheckCircle sx={{ fontSize: 20 }} />} label={t('clientApproved')} value={<Typography sx={{ fontSize: 15, fontWeight: 800, color: (meta?.clientApproved || 'partial') === 'approved' ? ws.green : ws.amber }}>{(meta?.clientApproved || 'partial') === 'approved' ? t('approved') : t('partial')}</Typography>} sub={isReal ? t('clickToApprove') : t('lastUpdated')} tone={((meta?.clientApproved || 'partial') === 'approved') ? ws.greenSoft : ws.amberSoft} />
          </Box>
        </Box>

        <WsCard sx={{ mb: 2 }}>
          {/* Fane-kontroll: Moodboard / Delt med teamet */}
          <Stack direction="row" spacing={0.5} sx={{ mb: 1.5 }} alignItems="center">
            {(['canvas', 'shared'] as const).map((st) => (
              <Box key={st} onClick={() => setSubTab(st)} sx={{ px: 1.1, py: 0.45, borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'background .15s, color .15s', color: subTab === st ? ws.accentContrast : ws.textDim, bgcolor: subTab === st ? ws.accent : 'transparent', border: `1px solid ${subTab === st ? ws.accent : ws.border}` }}>{st === 'canvas' ? 'Moodboard' : t('sharedRefs')}</Box>
            ))}
          </Stack>
          {subTab === 'canvas' && (<>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <WsPills items={realCats} value={cat} onChange={setCat} />
          </Stack>
          <TextField fullWidth size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')} InputProps={{ startAdornment: <Search sx={{ fontSize: 18, color: ws.textFaint, mr: 1 }} /> }} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
          {isReal && cat !== 'alle' && <Typography sx={{ fontSize: 11, color: ws.textFaint, mb: 1 }}>{t('taggedAs')} «{cat}».</Typography>}
          {q && <Typography sx={{ fontSize: 11, color: ws.textFaint, mb: 1 }}>{gridImages.length} {t('matchCount')} — klikk på et bilde for detaljer.</Typography>}

          {/* Studio-verktøylinje */}
          <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.5 }} alignItems="center">
            <Button size="small" startIcon={bulkMode ? <GridView sx={{ fontSize: 14 }} /> : <Layers sx={{ fontSize: 14 }} />} onClick={endBulk} sx={{ color: bulkMode ? ws.accent : ws.textDim, textTransform: 'none', fontWeight: 700, border: `1px solid ${bulkMode ? ws.accentBorder : ws.border}`, borderRadius: 1.5, px: 1 }}>{t('bulkMode')}</Button>
            {isReal && <Button size="small" startIcon={zoneMode ? <GridView sx={{ fontSize: 14 }} /> : <Layers sx={{ fontSize: 14 }} />} onClick={() => setZoneMode((v) => !v)} sx={{ color: zoneMode ? ws.accent : ws.textDim, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.border}`, borderRadius: 1.5, px: 1 }}>{zoneMode ? t('flatView') : t('zoneView')}</Button>}
            <Button size="small" startIcon={<AspectRatio sx={{ fontSize: 14 }} />} onClick={() => setOverlay((o) => (o === 'none' ? '9x16' : o === '9x16' ? '4x5' : o === '4x5' ? '1x1' : 'none'))} sx={{ color: overlay !== 'none' ? ws.accent : ws.textDim, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.border}`, borderRadius: 1.5, px: 1 }}>{t('overlay')}{overlay !== 'none' ? `: ${overlay}` : ''}</Button>
            <Button size="small" startIcon={<Sort sx={{ fontSize: 14 }} />} onClick={() => setFitSort((v) => !v)} sx={{ color: fitSort ? ws.accent : ws.textDim, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.border}`, borderRadius: 1.5, px: 1 }}>{t('bestFit')}</Button>
            <Button size="small" startIcon={<Print sx={{ fontSize: 14 }} />} onClick={openPrint} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.border}`, borderRadius: 1.5, px: 1 }}>{t('printMood')}</Button>
            {!isReal && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t('samplesTip')}</Typography>}
          </Stack>

          {/* Bulk-handlingsrad */}
          {bulkMode && (
            <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, px: 1, py: 0.75, borderRadius: 1.5, bgcolor: ws.accentSoft }} alignItems="center" flexWrap="wrap" >
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: ws.accent }}>{selIds.size} valgt</Typography>
              <Button size="small" startIcon={<DeleteOutline sx={{ fontSize: 14 }} />} onClick={delSel} sx={{ color: '#f87171', textTransform: 'none', fontWeight: 700 }}>{t('delete')}</Button>
              <Button size="small" startIcon={<Star sx={{ fontSize: 14 }} />} onClick={() => patchSel({ flag: true })} sx={{ color: ws.text, textTransform: 'none', fontWeight: 700 }}>{t('star')}</Button>
              <Button size="small" onClick={() => patchSel({ flag: false })} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 700 }}>{t('unstar')}</Button>
              <Button size="small" onClick={(e) => setBulkCatMenu(e.currentTarget)} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700 }}>{t('setCategory')}</Button>
              <Button size="small" onClick={endBulk} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 700, ml: 'auto' }}>{t('cancel2')}</Button>
              <Menu anchorEl={bulkCatMenu || null} open={!!bulkCatMenu} onClose={() => setBulkCatMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}` } }}>
                {isReal ? [...new Set([...Object.keys(CAT_I18N), ...mood.images.map((im: any) => im.category).filter(Boolean)])].map((k) => <MenuItem key={k} onClick={() => { setBulkCatMenu(null); patchSel({ category: k }); }} sx={{ fontSize: 13 }}>{CAT_I18N[k]?.[locale] || k}</MenuItem>) : null}
                <MenuItem onClick={() => { setBulkCatMenu(null); patchSel({ category: null }); }} sx={{ fontSize: 13, color: ws.textDim }}>—</MenuItem>
              </Menu>
            </Stack>
          )}

          {/* Grid: flat eller soner */}
          {zoneMode && isReal ? (
            <Stack spacing={1.5}>
              {Object.entries(groups).map(([gk, imgs]) => {
                const cv = covByCat(gk);
                return (
                  <Box key={gk}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: ws.textDim }}>{CAT_I18N[gk]?.[locale] || gk} · {imgs.length}</Typography>
                      {cv && cv.missing > 0 && <WsTag label={`${cv.missing} ${t('missingRefs')}`} tone="amber" />}
                      {cv && cv.missing === 0 && cv.shots > 0 && <WsTag label="OK" tone="green" />}
                    </Stack>
                    <WsImageGrid columns={4} images={imgs} {...gridProps} />
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <WsImageGrid columns={4} images={shownImgs} {...gridProps} />
          )}
          {isReal && (
            <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 1 }}>{t('coverage')}: {Object.keys(CAT_I18N).map((k) => { const cv = covByCat(k); return cv && (cv.shots > 0 || cv.refs > 0) ? `${CAT_I18N[k][locale]} ${cv.shots}/${cv.refs}` : null; }).filter(Boolean).join(' · ') || t('noShotsData')}</Typography>
          )}
          </>)}
          {subTab === 'shared' && (<>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{t('sharedRefs')}</Typography>
                {shared.images.length > 0 && <WsTag label={`${shared.images.length}`} tone="neutral" />}
              </Stack>
              <Button size="small" onClick={() => setSharedBig((v) => !v)} sx={{ color: ws.accent, textTransform: 'none' }}>{sharedBig ? t('compact') : t('seeAll')}</Button>
            </Stack>
            {shared.images.length > 0 && (
              <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mb: 1 }}>
                {t('lastUpdated')}
              </Typography>
            )}
            {isReal && shared.images.length === 0 && (
              <Typography sx={{ fontSize: 11.5, color: ws.textDim, mb: 1 }}>Ingen delte referanser ennå — last opp et bilde for å dele det med teamet.</Typography>
            )}
            <WsImageGrid
              columns={sharedBig ? 4 : 7}
              addLabel={t('shareImage')}
              images={shared.images}
              onUpload={shared.onUpload}
              onSelect={(im: any) => { if (im.url) window.open(im.url, '_blank'); }}
              onRemove={(id: string) => { apiRequest(`/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => shared.reload()).catch((e: any) => window.alert(e?.message || t('couldNotSave'))); }}
              actions={(im: any) => (
                <>
                  {im.createdAt && Date.now() - new Date(im.createdAt).getTime() < 86400000 && (
                    <Box sx={{ px: 0.6, py: 0.15, borderRadius: 1, bgcolor: 'rgba(34,197,94,.9)', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>NY</Box>
                  )}
                  {isReal && (
                    <Box onClick={() => apiRequest(`/api/projects/${encodeURIComponent(projectId)}/images/${encodeURIComponent(im.id)}`, { method: 'PATCH', body: { panel: 'moodboard' } }).then(() => { shared.reload(); mood.reload(); }).catch((e: any) => window.alert(e?.message || t('couldNotSave')))} title="Flytt til moodboard" sx={{ px: 0.6, py: 0.15, borderRadius: 1, bgcolor: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 9.5, fontWeight: 800, cursor: 'pointer', '&:hover': { bgcolor: ws.accent, color: ws.accentContrast } }}>→ Moodboard</Box>
                  )}
                </>
              )}
            />
          </>)}
        </WsCard>

        {/* Fargepalett + Stilnotater */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
          <WsCard>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t('palette')}</Typography>
              {isReal && <Button size="small" startIcon={<Palette sx={{ fontSize: 15 }} />} onClick={extractPalette} disabled={extracting} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 600, fontSize: 11.5 }}>{extracting ? t('extracting') : t('autoFromRefs')}</Button>}
            </Stack>
            <Stack spacing={0.5}>
              {pal.map((p, i) => (
                <Stack key={`${p.name}${p.hex}${i}`} direction="row" spacing={1} alignItems="center" sx={{ borderRadius: 1, px: 0.5, py: 0.25, '&:hover': { bgcolor: ws.panelAlt } }}>
                  <Box sx={{ position: 'relative', width: 20, height: 20, borderRadius: 1, bgcolor: p.hex, border: `1px solid ${ws.borderSoft}`, flexShrink: 0 }} title={`${p.name} · ${p.hex}`}>
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(p.hex) ? p.hex : '#cccccc'} onChange={(e) => setPalAt(i, { hex: e.target.value })} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                  </Box>
                  <TextField size="small" value={p.name} onChange={(e) => setPalAt(i, { name: e.target.value })} placeholder={t('namePlaceholder')} sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 12.5, py: 0.75, px: 0.5 } }} />
                  <TextField size="small" value={p.hex} onChange={(e) => setPalAt(i, { hex: e.target.value })} placeholder={t('hexPlaceholder')} onClick={() => copyHex(p.hex)} sx={{ width: 92, '& .MuiInputBase-input': { fontSize: 11, py: 0.75, px: 0.5, color: copied === p.hex ? ws.green : ws.textDim } }} InputProps={{ endAdornment: copied === p.hex ? <Box component="span" sx={{ fontSize: 10, color: ws.green, fontWeight: 800 }}>✓</Box> : null }} />
                  <Box onClick={(e) => setPalUseMenu({ anchor: e.currentTarget, idx: i })} title={t('attachUse')} sx={{ fontSize: 10, fontWeight: 700, color: p.use ? ws.accent : ws.textFaint, cursor: 'pointer', border: `1px dashed ${p.use ? ws.accentBorder : ws.border}`, borderRadius: 999, px: 0.65, py: 0.2, whiteSpace: 'nowrap', flexShrink: 0, maxWidth: 132, overflow: 'hidden', textOverflow: 'ellipsis', '&:hover': { bgcolor: ws.accentSoft } }}>{p.use ? t('useLabels')[p.use] : t('attachUse')}</Box>
                  {p.from.length > 0 ? (
                    <Box onClick={() => setSelColor(i)} title={t('whereFrom')} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: 10.5, fontWeight: 700, color: ws.accent, cursor: 'pointer', border: `1px solid ${ws.accentBorder}`, borderRadius: 999, px: 0.65, py: 0.1, whiteSpace: 'nowrap', flexShrink: 0 }}><ImageSearch sx={{ fontSize: 12 }} />{p.from.length} {t('sources')}</Box>
                  ) : (
                    <Box sx={{ fontSize: 10, color: ws.textFaint, whiteSpace: 'nowrap', flexShrink: 0 }}>{t('noSources')}</Box>
                  )}
                  <IconButton size="small" onClick={() => savePalette(pal.filter((_, j) => j !== i))} sx={{ color: ws.textFaint, p: 0.25 }}><Close sx={{ fontSize: 14 }} /></IconButton>
                </Stack>
              ))}
            </Stack>
            <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={addPalColor} sx={{ alignSelf: 'flex-start', color: ws.accent, textTransform: 'none', mt: 0.5 }}>{t('addColor')}</Button>
            <Menu anchorEl={palUseMenu?.anchor || null} open={!!palUseMenu} onClose={() => setPalUseMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, py: 0.5 } }}>
              {PAL_USES.map((u) => <MenuItem key={u} selected={palUseMenu != null && pal[palUseMenu.idx]?.use === u} onClick={() => { if (palUseMenu) setPalAt(palUseMenu.idx, { use: u }); setPalUseMenu(null); }} sx={{ fontSize: 12.5 }}>{t('useLabels')[u]}</MenuItem>)}
              <MenuItem onClick={() => { if (palUseMenu) setPalAt(palUseMenu.idx, { use: '' }); setPalUseMenu(null); }} sx={{ fontSize: 12.5, color: ws.textDim }}>{t('noUse')}</MenuItem>
            </Menu>
            {/* Fargebruk på shoot — hvor hver farge gjelder */}
            {pal.length > 0 && (
              <Box sx={{ mt: 1.5, pt: 1.25, borderTop: `1px solid ${ws.borderSoft}` }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.75 }}>{t('paletteUse')}</Typography>
                <Stack spacing={0.6}>
                  {PAL_USES.map((u) => {
                    const cols = pal.filter((p) => p.use === u);
                    if (!cols.length) return null;
                    return (
                      <Stack key={u} direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ width: 118, fontSize: 11, color: ws.textDim, fontWeight: 700, flexShrink: 0 }}>{t('useLabels')[u]}</Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {cols.map((c) => (
                            <Box key={`${c.name}${c.hex}`} title={`${c.name} · ${c.hex}`} onClick={() => copyHex(c.hex)} sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: c.hex, border: `2px solid ${ws.panelSolid}`, boxShadow: `0 0 0 1px ${ws.border}`, cursor: 'pointer', transition: 'transform .12s', '&:hover': { transform: 'scale(1.2)' } }} />
                          ))}
                        </Stack>
                      </Stack>
                    );
                  })}
                  {(() => { const cols = pal.filter((p) => !p.use); return cols.length ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ width: 118, fontSize: 11, color: ws.textFaint, flexShrink: 0 }}>{t('noUse')}</Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {cols.map((c) => <Box key={`${c.name}${c.hex}`} title={`${c.name} · ${c.hex}`} onClick={() => copyHex(c.hex)} sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: c.hex, border: `2px solid ${ws.panelSolid}`, boxShadow: `0 0 0 1px ${ws.border}`, cursor: 'pointer', transition: 'transform .12s', '&:hover': { transform: 'scale(1.2)' } }} />)}
                      </Stack>
                    </Stack>
                  ) : null; })()}
                  {(!meta?.palette || !meta.palette.length) && isReal && <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t('samplePaletteHint')}</Typography>}
                </Stack>
              </Box>
            )}
          </WsCard>
          <WsCard>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t('styleNotes')}</Typography>
              {isReal && <Button size="small" startIcon={<AutoAwesome sx={{ fontSize: 15 }} />} onClick={generateNotes} disabled={genNotes} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 600, fontSize: 11.5 }}>{genNotes ? t('analyzing') : t('aiFromRefs')}</Button>}
            </Stack>
            {notes.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>{t('notesEmpty')}</Typography>
            ) : (
              <Stack spacing={0.25}>
                {notes.map((n, i) => {
                  const catKey = noteCatOf(n);
                  const cat = NOTE_CATS[catKey];
                  const Icon = cat.icon;
                  const editing = notesEdit === i;
                  return (
                    <Stack key={`${i}-${n}`} direction="row" spacing={0.75} alignItems="center" sx={{ px: 0.5, py: 0.3, borderRadius: 1, '&:hover': { bgcolor: ws.panelAlt } }}>
                      <Box sx={{ width: 24, height: 24, borderRadius: 1.5, bgcolor: `${cat.color}1f`, color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon sx={{ fontSize: 13 }} /></Box>
                      {editing ? (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                          <TextField fullWidth size="small" autoFocus value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitNoteEdit(); if (e.key === 'Escape') setNotesEdit(null); }} sx={{ '& .MuiInputBase-input': { fontSize: 12.5, py: 0.6 } }} />
                          <Button size="small" onClick={commitNoteEdit} sx={{ minWidth: 0, p: 0.25, fontSize: 11, fontWeight: 800, color: ws.green, textTransform: 'none' }}>✓</Button>
                        </Stack>
                      ) : (
                        <>
                          <Typography sx={{ fontSize: 12.5, color: ws.text, flex: 1, minWidth: 0 }}>{n}</Typography>
                          <Box onClick={(e) => openNoteCatMenu(e, i)} title="Endre kategori — AI-en lærer av valget" sx={{ fontSize: 9, fontWeight: 800, color: cat.color, textTransform: 'uppercase', letterSpacing: 0.6, flexShrink: 0, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>{t('noteCats')[catKey]}</Box>
                        </>
                      )}
                      {!editing && (
                        <Stack direction="row" spacing={0} sx={{ opacity: 0, '&:hover': { opacity: 1 }, flexShrink: 0 }}>
                          <Button size="small" onClick={() => { setNotesEdit(i); setNotesDraft(n); }} sx={{ minWidth: 0, p: 0.25, fontSize: 10.5, color: ws.textFaint, textTransform: 'none' }}>Rediger</Button>
                          <Button size="small" onClick={() => saveNotesAll(notes.filter((_, j) => j !== i))} sx={{ minWidth: 0, p: 0.25, fontSize: 10.5, color: '#f87171', textTransform: 'none' }}>✕</Button>
                        </Stack>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            )}
            {(!meta?.notes || !meta.notes.length) && isReal && <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 1 }}>{t('sampleNotesHint')}</Typography>}
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.25 }}>
              <TextField fullWidth size="small" placeholder={t('addNote')} value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNote(); }} disabled={genNotes} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 12.5 } }} />
              <Button size="small" onClick={addNote} disabled={!noteText.trim() || genNotes} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5, px: 1, '&:hover': { bgcolor: ws.accentSoft } }}>Legg til</Button>
            </Stack>
            <Menu anchorEl={noteCatMenu?.anchor || null} open={!!noteCatMenu} onClose={() => setNoteCatMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, py: 0.5 } }}>
              {noteCatMenu && (
                <Typography sx={{ px: 1.75, py: 0.75, fontSize: 10.5, color: ws.textFaint }}>
                  {t('styleDirection')}: <Box component="span" sx={{ color: (NOTE_CATS[noteCatMenu.guess] || {}).color || ws.textFaint, fontWeight: 800 }}>{t('noteCats')[noteCatMenu.guess] || '—'}</Box>{noteCatMenu.conf ? ` · ${noteCatMenu.conf}%` : ''}
                </Typography>
              )}
              {Object.keys(NOTE_CATS).map((k) => (
                <MenuItem key={k} selected={noteCatMenu != null && noteCatOf(notes[noteCatMenu.idx]) === k} onClick={() => { if (noteCatMenu) setNoteCat(noteCatMenu.idx, k); setNoteCatMenu(null); }} sx={{ fontSize: 12.5, display: 'flex', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: NOTE_CATS[k].color }} />
                  {t('noteCats')[k]}
                </MenuItem>
              ))}
            </Menu>
          </WsCard>
        </Box>
      </Box>

      {/* Mood details (høyre) — valgt bilde ellers standard-innhold */}
      <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0 }}>
        <WsCard className="ws-fade-up2" sx={{ animationDelay: '120ms' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <WsSectionTitle title="Mood details" />
            {selIm && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton size="small" onClick={() => stepSel(-1)} sx={{ color: ws.textDim }}><ChevronLeft fontSize="small" /></IconButton>
                <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{(selMood ?? 0) + 1} {t('detailsCount')} {gridImages.length}</Typography>
                <IconButton size="small" onClick={() => stepSel(1)} sx={{ color: ws.textDim }}><ChevronRight fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => setSelMood(null)} sx={{ color: ws.textDim }}><Close sx={{ fontSize: 15 }} /></IconButton>
              </Stack>
            )}
          </Stack>
          {selIm ? (
            <>
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ width: '100%', aspectRatio: '4 / 3', borderRadius: `${ws.radiusSm}px`, overflow: 'hidden', border: selIm.flag ? '1.5px solid #f59e0b' : `1px solid ${ws.borderSoft}`, bgcolor: ws.panelInput, background: selIm.url ? `center/cover no-repeat url(${selIm.url})` : 'linear-gradient(135deg, rgba(255,140,0,0.16), rgba(255,255,255,0.05))' }} />
                {gridImages.length > 1 && (
                  <>
                    <IconButton size="small" onClick={() => stepSel(-1)} sx={{ position: 'absolute', left: 5, top: '50%', transform: 'translateY(-50%)', color: '#fff', bgcolor: 'rgba(0,0,0,0.45)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }, p: 0.5 }}><ChevronLeft fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => stepSel(1)} sx={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', color: '#fff', bgcolor: 'rgba(0,0,0,0.45)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }, p: 0.5 }}><ChevronRight fontSize="small" /></IconButton>
                  </>
                )}
                {selIm.flag && <Box sx={{ position: 'absolute', top: 6, left: 7, color: '#f59e0b', fontSize: 16, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>★</Box>}
                {typeof selIm.fit === 'number' && <Box sx={{ position: 'absolute', right: 6, bottom: 6, px: 0.6, py: 0.25, borderRadius: 1, bgcolor: selIm.fit >= 60 ? 'rgba(52,211,153,.9)' : 'rgba(251,191,36,.9)', color: '#0d0d16', fontSize: 10, fontWeight: 800 }}>{selIm.fit}%</Box>}
              </Box>
              {selIm.label && <Typography sx={{ fontSize: 12.5, fontWeight: 700, mt: 1 }}>{selIm.label}</Typography>}
              <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }} alignItems="center">
                <Box onClick={(e) => setSelCatMenu(e.currentTarget)} title={t('setCategory')} sx={{ fontSize: 11, fontWeight: 700, color: ws.accent, cursor: 'pointer', border: `1px solid ${ws.accentBorder}`, borderRadius: 999, px: 0.7, py: 0.2, '&:hover': { bgcolor: ws.accentSoft } }}>{selIm.category || t('setCategory')}</Box>
                {isReal && (
                  <>
                    <IconButton size="small" onClick={toggleSelFlag} title={selIm.flag ? t('unstar') : t('star')} sx={{ color: selIm.flag ? '#f59e0b' : ws.textFaint, p: 0.4 }}><Star sx={{ fontSize: 15 }} /></IconButton>
                    <Button size="small" component="a" href={selIm.url} target="_blank" rel="noreferrer" sx={{ minWidth: 0, fontSize: 10.5, color: ws.textDim, textTransform: 'none' }}>{t('openOriginal')}</Button>
                  </>
                )}
              </Stack>
              <Menu anchorEl={selCatMenu || null} open={!!selCatMenu} onClose={() => setSelCatMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, py: 0.5 } }}>
                {[...new Set([...(isReal ? Object.keys(CAT_I18N) : []), ...mood.images.map((im: any) => im.category).filter(Boolean)])].map((k) => <MenuItem key={k} selected={selIm?.category === k} onClick={() => setSelCat(k)} sx={{ fontSize: 12.5 }}>{CAT_I18N[k]?.[locale] || k}</MenuItem>)}
                <MenuItem onClick={() => setSelCat(null)} selected={!selIm?.category} sx={{ fontSize: 12.5, color: ws.textDim }}>—</MenuItem>
              </Menu>
              {typeof selIm.fit === 'number' && <Typography sx={{ fontSize: 11, color: selIm.fit >= 60 ? ws.green : ws.amber, mt: 0.5, fontWeight: 700 }}>{selIm.fit}% {t('fitScore')}</Typography>}
              {isReal && (
                <Button size="small" onClick={refToShot} disabled={!!shotOk} sx={{ mt: 1, color: shotOk ? ws.green : ws.accent, textTransform: 'none', fontWeight: 700, border: `1px solid ${shotOk ? 'rgba(52,211,153,.5)' : ws.accentBorder}`, borderRadius: 1.5, '&:hover': { bgcolor: ws.accentSoft } }}>{shotOk ? t('shotAdded') : t('addShotSugg')}</Button>
              )}
              {(isReal || selIm.comments?.length > 0) && (
                <>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5, mt: 1 }}>{t('commentsHeader')}</Typography>
                  <Stack spacing={0.75} sx={{ mb: 1 }}>
                    {(selIm.comments || []).map((m: any, i: number) => (
                      <Stack key={m.id || i} direction="row" spacing={1} alignItems="flex-start">
                        <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: ws.panelAlt, color: ws.accent }}>{(m.who || '?')[0]}</Avatar>
                        <Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} alignItems="baseline"><Typography sx={{ fontSize: 11, fontWeight: 800 }}>{m.who}</Typography><Typography sx={{ fontSize: 9.5, color: ws.textFaint }}>{m.t}</Typography></Stack><Typography sx={{ fontSize: 12, color: ws.textDim }}>{m.msg}</Typography></Box>
                      </Stack>
                    ))}
                  </Stack>
                  {isReal && (
                    <TextField fullWidth size="small" placeholder={t('commentPlaceholder')} value={imgComment} onChange={(e) => setImgComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addImgComment(); }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 12.5 } }} />
                  )}
                </>
              )}
            </>
          ) : isReal ? (
            <>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: ws.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.75 }}>{t('detailsSummary')}</Typography>
              <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                {PAL_USES.filter((u) => pal.some((p) => p.use === u)).slice(0, 3).map((u) => <WsTag key={u} label={t('useLabels')[u]} tone="neutral" />)}
                {notes.slice(0, 3).map((n) => <WsTag key={n} label={t('noteCats')[guessNoteCat(n)]} tone="accent" />)}
              </Stack>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>{styleDir}</Typography>
              <Typography sx={{ fontSize: 12.5, color: ws.textDim, mb: 1.5 }}>{notes.slice(0, 3).map((n) => `· ${n}`).join('\n')}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>{t('responsible')}</Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: ws.accentSoft, color: ws.accent, fontWeight: 800 }}>{ini(user?.firstName || user?.name || user?.email || 'Jeg')}</Avatar>
                {(isReal ? viewers : []).map((v) => <Avatar key={v.userId} sx={{ width: 22, height: 22, fontSize: 10, bgcolor: ws.panelAlt, color: ws.accent }}>{ini(v.name || '?')}</Avatar>)}
                <Typography sx={{ fontSize: 11, color: ws.textFaint, ml: 0.5 }}>{1 + (isReal ? viewers.length : 0)}</Typography>
              </Stack>
              <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mt: 1.5, mb: 1 }}>{t('selectImageHint')}</Typography>
              <WsImageGrid columns={1} ratio="4 / 3" addLabel={t('uploadMain')} allowAdd images={[]} onUpload={(f) => mood.onUpload(f, cat === 'alle' ? undefined : cat)} />
            </>
          ) : (
            <>
              <WsImageGrid columns={1} ratio="4 / 3" addLabel={t('uploadMain')} allowAdd />
              <Stack direction="row" spacing={0.5} sx={{ my: 1.25, flexWrap: 'wrap', gap: 0.5 }}>
                <WsTag label="Golden hour" tone="amber" /><WsTag label={t('tagPortraits')} tone="accent" /><WsTag label={t('tagCritical')} tone="red" />
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: ws.textDim, mb: 1.5 }}>{t('moodDesc')}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>{t('notesHeader')}</Typography>
              <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                {[t('note1'), t('note2'), t('note3'), t('note4')].map((n) => <Typography key={n} sx={{ fontSize: 12, color: ws.textDim }}>· {n}</Typography>)}
              </Stack>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>{t('responsible')}</Typography>
              <Stack direction="row" spacing={1}>
                {[t('person1'), t('person2')].map((p) => <Stack key={p} direction="row" spacing={0.5} alignItems="center"><Avatar sx={{ width: 20, height: 20, fontSize: 9 }}>{p[0]}</Avatar><Typography sx={{ fontSize: 11.5 }}>{p}</Typography><CheckCircle sx={{ fontSize: 13, color: ws.green }} /></Stack>)}
              </Stack>
            </>
          )}
        </WsCard>
      </Box>

      {/* Hvor fargene er hentet fra (kilder per farge) */}
      <WsModal open={selColor != null} onClose={() => setSelColor(null)} title={t('whereFrom')} maxWidth="sm">
        {selColor != null && pal[selColor] ? (() => {
          const p = pal[selColor];
          const srcs = p.from.map((k: string) => keyToImg(k)).filter(Boolean);
          return (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: p.hex, border: `1px solid ${ws.borderSoft}` }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{p.name}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{p.hex}</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{t('fromImages').replace('{n}', String(srcs.length)).replace('{r}', srcs.length === 1 ? '' : 'r')}</Typography>
                </Box>
                <Button size="small" onClick={() => copyHex(p.hex)} sx={{ color: ws.accent, textTransform: 'none', border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5 }}>{copied === p.hex ? `✓ ${t('copied')}` : 'Kopier hex'}</Button>
              </Stack>
              {srcs.length === 0 ? (
                <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{isReal ? t('noSources') : t('fromAISample')}</Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                  {srcs.map((im: any, i: number) => (
                    <Box key={i} sx={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: `${ws.radiusSm}px`, overflow: 'hidden', border: `1px solid ${ws.borderSoft}`, background: im.url ? `center/cover no-repeat url(${im.url})` : 'linear-gradient(135deg, rgba(255,140,0,0.16), rgba(255,255,255,0.05))' }} title={im.label}>
                      {im.label && <Typography noWrap sx={{ position: 'absolute', left: 4, bottom: 4, fontSize: 10, px: 0.6, py: 0.2, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', maxWidth: '92%' }}>{im.label}</Typography>}
                      <Box sx={{ position: 'absolute', top: 4, left: 4, width: 12, height: 12, borderRadius: '50%', bgcolor: p.hex, border: '1.5px solid rgba(255,255,255,0.8)' }} />
                    </Box>
                  ))}
                </Box>
              )}
            </Stack>
          );
        })() : <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('noSources')}</Typography>}
      </WsModal>

      <MetaEditDialog open={editOpen} onClose={() => setEditOpen(false)} projectId={projectId} meta={meta} onSaved={() => { setEditOpen(false); loadMeta(); }} />

      {/* AI konsept-generering (tekst→bilde) */}
      <WsModal open={conceptOpen} onClose={() => { if (!conceptBusy) setConceptOpen(false); }} title={t('conceptTitle')} maxWidth="sm">
        <Stack spacing={2}>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('conceptDesc')}</Typography>
          <TextField value={conceptPrompt} onChange={(e) => setConceptPrompt(e.target.value)} fullWidth multiline minRows={2} size="small" placeholder={t('conceptPlaceholder')} disabled={conceptBusy} />
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {[t('chip1'), t('chip2'), t('chip3'), t('chip4')].map((p) => <Box key={p} onClick={() => setConceptPrompt(p)} sx={{ px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11, color: ws.accent, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>{p}</Box>)}
          </Stack>
          {conceptBusy && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={16} sx={{ color: ws.accent }} /><Typography sx={{ fontSize: 12, color: ws.textDim }}>{conceptStatus}</Typography></Stack>}
          {!conceptBusy && conceptStatus && <Typography sx={{ fontSize: 12, color: ws.green }}>{conceptStatus}</Typography>}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t('perImage')}{credits?.billingMode === 'credits' ? <> · {t('balance')} ${(credits?.balanceUsd ?? 0).toFixed(2)} · <Box component="span" onClick={() => { setConceptOpen(false); setBuyOpen(true); }} sx={{ color: ws.accent, cursor: 'pointer', fontWeight: 700 }}>{t('buy')}</Box></> : null}</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setConceptOpen(false)} disabled={conceptBusy} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('close')}</Button>
              <Button variant="contained" disabled={!conceptPrompt.trim() || conceptBusy} onClick={generateConcept} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{conceptBusy ? t('generating') : t('generate')}</Button>
            </Stack>
          </Stack>
        </Stack>
      </WsModal>
      <AiBuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} credits={credits} onBuy={buyPack} />
    </Stack>
  );
};

const MetaEditDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; meta: any; onSaved: () => void }> = ({ open, onClose, projectId, meta, onSaved }) => {
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const [style, setStyle] = useState('');
  const [notes, setNotes] = useState('');
  const [palette, setPalette] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setStyle(meta?.style || '');
    setNotes((meta?.notes || []).join('\n'));
    setPalette((meta?.palette || []).map((p: any) => ({ name: p.name || p[0] || '', hex: p.hex || p[1] || '#cccccc', use: p.use || '' })));
  }, [open, meta]);
  const setColor = (i: number, k: string, v: string) => setPalette((p) => p.map((c, j) => j === i ? { ...c, [k]: v } : c));
  const addColor = () => setPalette((p) => [...p, { name: '', hex: '#cccccc' }]);
  const removeColor = (i: number) => setPalette((p) => p.filter((_, j) => j !== i));
  const save = async () => {
    setBusy(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`, {
        method: 'PUT',
        body: { style: style.trim(), notes: notes.split('\n').map((s) => s.trim()).filter(Boolean), mustCapture: (meta?.mustCapture || []).map((m: any) => ({ label: m.label || m[0] || m, done: m.done ?? m[1] ?? false })), palette: palette.filter((c) => c.hex).map((c) => ({ name: c.name.trim() || c.hex, hex: c.hex, ...(c.use ? { use: c.use } : {}) })) },
      });
      onSaved();
    } catch (e: any) { window.alert(e?.message || t('couldNotSave')); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('editMoodboard')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label={t('styleDirection')} value={style} onChange={(e) => setStyle(e.target.value)} fullWidth size="small" placeholder={t('stylePlaceholder')} />
          <TextField label={t('notesPerLine')} value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={4} size="small" />
          <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ws.textDim, mb: 0.75 }}>{t('palette')}</Typography>
            <Stack spacing={0.75}>
              {palette.map((c, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#cccccc'} onChange={(e) => setColor(i, 'hex', e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                  <TextField value={c.name} onChange={(e) => setColor(i, 'name', e.target.value)} size="small" placeholder={t('namePlaceholder')} sx={{ flex: 1 }} />
                  <TextField value={c.hex} onChange={(e) => setColor(i, 'hex', e.target.value)} size="small" sx={{ width: 110 }} />
                  <IconButton size="small" onClick={() => removeColor(i)}><Close sx={{ fontSize: 16 }} /></IconButton>
                </Stack>
              ))}
              <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={addColor} sx={{ alignSelf: 'flex-start', color: ws.accent, textTransform: 'none' }}>{t('addColor')}</Button>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{t('cancel')}</Button>
        <Button variant="contained" onClick={save} disabled={busy}>{busy ? t('saving') : t('save')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default MoodboardTab;
