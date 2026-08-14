// @ts-nocheck
/**
 * ShotlistTab — design #4, dark CreatorHub.
 * Stats + kategori-pills + shot-tabell + Shot detaljer (høyre, opplastbart bilde
 * + samtale) + Referanser & inspirasjon (opplastbart) + Må huskes.
 *
 * Forbedringer: kategori-filter virker (sample + ekte), sample-data utleder
 * stats/piller, «Neste opp» også i sample og klikkbar, «Mangler»-fokus med
 * puls, «Huk av som ferdig»/«Angre» mot /api/capture/... PATCH, animasjoner
 * (live-puls, fade-up, glow) med prefers-reduced-motion-støtte.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Stack, Typography, Button, Avatar, TextField, Menu, MenuItem, IconButton } from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import { useLocation } from 'wouter';
import { apiRequest, buildApiUrl } from '@/lib/queryClient';
import PhotoCameraBack from '@mui/icons-material/PhotoCameraBack';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Star from '@mui/icons-material/Star';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import Add from '@mui/icons-material/Add';
import Undo from '@mui/icons-material/Undo';
import RestartAlt from '@mui/icons-material/RestartAlt';
import Lightbulb from '@mui/icons-material/Lightbulb';
import PersonAddAlt from '@mui/icons-material/PersonAddAlt';
import { ws } from '../workspaceTheme';
import { wsIcon } from '../crewIcons';
import { WsCard, WsSectionTitle, WsStat, WsPills, WsTag, WsTable, WsImageGrid, WsRing, WsPageTitle } from '../ui';
import { useCaptureRealtime } from '../useCaptureRealtime';
import { useAuth } from '@/hooks/useAuth';

interface SampleShot {
  prio: string;
  tone: string;
  title: string;
  kat: string; // nøkkel i CAT_LABEL
  loc: string;
  status: string;
  stTone: string;
  ansvarlig: string;
  done: boolean;
}

const CAT_LABEL: Record<string, string> = {
  forb: 'Forberedelser', vielse: 'Vielse', portrett: 'Portretter', fam: 'Familiebilder',
  golden: 'Golden hour', taler: 'Taler', fest: 'Fest',
};

const SHOTS: SampleShot[] = [
  { prio: 'Kritisk', tone: 'red', title: 'Ringer og detaljer', kat: 'forb', loc: 'Brudens suite', status: 'Ferdig', stTone: 'green', ansvarlig: 'Daniel', done: true },
  { prio: 'Høy', tone: 'amber', title: 'Brudekjole hanging shot', kat: 'forb', loc: 'Brudens suite', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Emma', done: false },
  { prio: 'Høy', tone: 'amber', title: 'Makeup & hår detaljer', kat: 'forb', loc: 'Brudens suite', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Mia', done: false },
  { prio: 'Kritisk', tone: 'red', title: 'First look reaksjon', kat: 'vielse', loc: 'Hage', status: 'Ferdig', stTone: 'green', ansvarlig: 'Emma', done: true },
  { prio: 'Kritisk', tone: 'red', title: 'Brud inngang', kat: 'vielse', loc: 'Kirken', status: 'Pågår', stTone: 'amber', ansvarlig: 'Daniel', done: false },
  { prio: 'Kritisk', tone: 'red', title: 'Ring exchange', kat: 'vielse', loc: 'Kirken', status: 'Klar', stTone: 'accent', ansvarlig: 'Daniel', done: false },
  { prio: 'Kritisk', tone: 'red', title: 'Kyss', kat: 'vielse', loc: 'Kirken', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Emma', done: false },
  { prio: 'Høy', tone: 'amber', title: 'Gjestene reiser seg', kat: 'vielse', loc: 'Kirken', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Trym', done: false },
  { prio: 'Kritisk', tone: 'red', title: 'Portrett av paret', kat: 'portrett', loc: 'Parkområdet', status: 'Klar', stTone: 'accent', ansvarlig: 'Daniel', done: false },
  { prio: 'Høy', tone: 'amber', title: 'Brudgommen alene', kat: 'portrett', loc: 'Parkområdet', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Mia', done: false },
  { prio: 'Høy', tone: 'amber', title: 'Brudepike-portrett', kat: 'portrett', loc: 'Parkområdet', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Mia', done: false },
  { prio: 'Normal', tone: 'neutral', title: 'Overhead detalj', kat: 'portrett', loc: 'Parkområdet', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Lukas', done: false },
  { prio: 'Kritisk', tone: 'red', title: 'Familiebilder', kat: 'fam', loc: 'Kirken', status: 'Ferdig', stTone: 'green', ansvarlig: 'Lukas', done: true },
  { prio: 'Normal', tone: 'neutral', title: 'Bestevenner', kat: 'fam', loc: 'Kirken', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Daniel', done: false },
  { prio: 'Normal', tone: 'neutral', title: 'Grandparents', kat: 'fam', loc: 'Kirken', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Trym', done: false },
  { prio: 'Kritisk', tone: 'red', title: 'Golden hour par', kat: 'golden', loc: 'Location 2', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Emma', done: false },
  { prio: 'Normal', tone: 'neutral', title: 'Silhuett shot', kat: 'golden', loc: 'Location 2', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Emma', done: false },
  { prio: 'Normal', tone: 'neutral', title: 'Gjestene i motlys', kat: 'golden', loc: 'Location 2', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Lukas', done: false },
  { prio: 'Kritisk', tone: 'red', title: 'Brudgommens tale', kat: 'taler', loc: 'Festsalen', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Daniel', done: false },
  { prio: 'Høy', tone: 'amber', title: 'Brudens tale', kat: 'taler', loc: 'Festsalen', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Daniel', done: false },
  { prio: 'Normal', tone: 'neutral', title: 'Far-datter dans', kat: 'taler', loc: 'Festsalen', status: 'Klar', stTone: 'accent', ansvarlig: 'Emma', done: false },
  { prio: 'Kritisk', tone: 'red', title: 'Første dans', kat: 'fest', loc: 'Festsalen', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Emma', done: false },
  { prio: 'Høy', tone: 'amber', title: 'Kakestykking', kat: 'fest', loc: 'Festsalen', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Trym', done: false },
  { prio: 'Normal', tone: 'neutral', title: 'Gjestebilder', kat: 'fest', loc: 'Festsalen', status: 'Planlagt', stTone: 'blue', ansvarlig: 'Lukas', done: false },
];

const SAMTALE = [
  { who: 'Daniel (Foto)', t: '10:12', msg: 'Jeg tar 85mm fra fronten, Emma kan ta siden for reaksjoner? 👍' },
  { who: 'Emma (Video)', t: '10:15', msg: 'Yes! Jeg tar slow motion på siste steg i kirken. ✨' },
  { who: 'Lukas (Editor)', t: '10:18', msg: 'Perfekt! Husk å få med gjestene som reiser seg også.' },
];

const PRIO_TONE: Record<string, string> = { kritisk: 'red', critical: 'red', høy: 'amber', high: 'amber', normal: 'neutral', lav: 'neutral', low: 'neutral' };
const STATUS_TONE: Record<string, string> = { ferdig: 'green', done: 'green', completed: 'green', pågår: 'amber', in_progress: 'amber', klar: 'accent', ready: 'accent', planlagt: 'blue', planned: 'blue' };
const ini = (name: string) => (name || '?').slice(0, 1).toUpperCase();

// Bruker-events-WS (samme backend som iPad: /api/ipad/ws/events).
const EVENTS_WS_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_BASE)
  ? import.meta.env.VITE_WS_BASE
  : 'wss://creatorhub-backend-rtbl.onrender.com';

/** Kommentartid: «HH:MM» i dag, ellers «dd.mm HH:MM» (fallback til gammelt HH:MM-felt). */
const fmtCommentTime = (ts?: string, fallbackT?: string) => {
  if (ts) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) {
      const now = new Date();
      const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return d.toDateString() === now.toDateString() ? hm : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hm}`;
    }
  }
  return fallbackT || '';
};

/** Kategori-meta for «Må huskes»-punkter */
const CHK_CAT: Record<string, { label: string; color: string }> = {
  utstyr: { label: 'Utstyr', color: '#60a5fa' },
  backup: { label: 'Backup', color: '#fbbf24' },
  vær: { label: 'Vær', color: '#22d3ee' },
  transport: { label: 'Transport', color: '#c084fc' },
};
const CHK_CREW = ['Daniel', 'Emma', 'Lukas', 'Mia', 'Trym'];
/** Deterministic farge for egendefinerte kategorier (hash → palett). */
const CAT_PALETTE = ['#34d399', '#f472b6', '#f97316', '#22d3ee', '#a78bfa', '#eab308', '#4ade80', '#fb7185', '#60a5fa', '#fb923c'];
const catColor = (name: string): string => {
  const known = CHK_CAT[name];
  if (known) return known.color;
  let h = 0;
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  return CAT_PALETTE[h % CAT_PALETTE.length];
};

const ShotlistTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isRealP = projectId && projectId !== 'sample';
  const [cat, setCat] = useState('alle');
  const [filterMode, setFilterMode] = useState<'alle' | 'done' | 'critical' | 'mangler'>('alle');
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ title: '', kat: 'forb', prio: 'Normal', loc: '' });
  const addCancel = () => { setAdding(false); setNewForm({ title: '', kat: 'forb', prio: 'Normal', loc: '' }); };
  const [sampleShots, setSampleShots] = useState<SampleShot[]>(() => SHOTS);
  const [real, setReal] = useState<{ shots: any[]; meta: any } | null>(null);
  const [sel, setSel] = useState<any | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [, navigate] = useLocation();
  const [comment, setComment] = useState('');
  // «Må huskes» — sjekkliste fra project_checklist_items (ekte) / lokal state (sample).
  const SAMPLE_CHK: { label: string; checked: boolean; category: string; critical: boolean; assignedTo: string }[] = [
    { label: 'Batterier ladet', checked: true, category: 'utstyr', critical: false, assignedTo: 'Daniel' },
    { label: 'Backup kort formatert', checked: true, category: 'backup', critical: true, assignedTo: 'Lukas' },
    { label: 'Lydopptaker testet', checked: false, category: 'utstyr', critical: false, assignedTo: 'Emma' },
    { label: 'Reflektor / diffuser', checked: false, category: 'utstyr', critical: false, assignedTo: 'Mia' },
    { label: 'Regncover til kamera', checked: false, category: 'vær', critical: false, assignedTo: '' },
    { label: 'Parkeringstillatelse kirken', checked: false, category: 'transport', critical: true, assignedTo: 'Trym' },
  ];
  const [chkMenu, setChkMenu] = useState<null | { anchor: HTMLElement; item: any; idx: number }>(null);
  const [chkOpen, setChkOpen] = useState(false);
  const [chkCatOverride, setChkCatOverride] = useState<string | null>(null); // null = auto-gjett
  const [chkGuess, setChkGuess] = useState<{ category: string; confidence: number; critical: boolean } | null>(null); // ML-gjett fra backend
  const [chk, setChk] = useState<any[] | null>(null);
  const [chkText, setChkText] = useState('');
  const [chkBusy, setChkBusy] = useState(false);
  const loadChk = useCallback(() => {
    if (!isRealP || !projectId) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist`)
      .then((r: any) => setChk(Array.isArray(r?.items) ? r.items : []))
      .catch(() => setChk([]));
  }, [projectId]);
  useEffect(() => { if (isRealP) loadChk(); }, [loadChk]);

  // ML-kategorisering: debounced POST mot checklist/guess mens brukeren skriver.
  useEffect(() => {
    setChkGuess(null);
    const label = chkText.trim();
    if (!isRealP || !projectId || !label) return;
    const t = window.setTimeout(() => {
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist/guess`, { method: 'POST', body: { label } })
        .then((r: any) => setChkGuess(r && typeof r.category === 'string' ? r : null))
        .catch(() => {});
    }, 300);
    return () => window.clearTimeout(t);
  }, [chkText, projectId]);
  const toggleChk = async (item: any, idx: number) => {
    if (isRealP && item.id) {
      setChk((prev) => (prev || []).map((c) => (c.id === item.id ? { ...c, checked: !c.checked } : c)));
      try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: { checked: !item.checked } }); }
      catch (e: any) { window.alert(e?.message || 'Kunne ikke oppdatere'); }
    } else {
      setChk((prev) => (prev || SAMPLE_CHK).map((c, i) => (i === idx ? { ...c, checked: !c.checked } : c)));
    }
  };
  const guessCat = (text: string): string => {
    const t = text.toLowerCase();
    if (/(regn|cover|paraply|vær|vind|frost|tåke|uv|solkrem|regnbu)/.test(t)) return 'vær';
    if (/(backup|minnekort|ssd|lagring|format|kopier|ekstra kort)/.test(t)) return 'backup';
    if (/(parkering|bil|transport|kjøre|kjøretøy|hente|avreise|frakt|levering|drosje|taxi|samlested)/.test(t)) return 'transport';
    return 'utstyr';
  };
  const guessCritical = (text: string): boolean => /(kritisk|viktig|påkrevd|må (?!huske)|husk|nødvendig)/.test(text.toLowerCase());
  const addChk = async (label: string = '', opts?: { category?: string; critical?: boolean; assignedTo?: string; color?: string }) => {
    const useLabel = label || chkText.trim(); if (!useLabel || chkBusy) return;
    const cat = opts?.category || chkCatOverride || chkGuess?.category || guessCat(useLabel);
    const critical = opts?.critical !== undefined ? opts.critical : guessCritical(useLabel);
    const color = opts?.color || chkPendingColor || undefined;
    setChkBusy(true);
    try {
      if (isRealP) {
        const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist`, { method: 'POST', body: { label: useLabel, category: cat, critical, assignedTo: opts?.assignedTo || null, color: color || null } });
        setChk((prev) => [...(prev || []), { id: r.id, label: r.label, checked: !!r.checked, category: r.category, critical: r.critical, assignedTo: r.assignedTo, color: r.color }]);
      } else {
        setChk((prev) => [...(prev || SAMPLE_CHK), { label: useLabel, checked: false, category: cat, critical, assignedTo: opts?.assignedTo || '', color }]);
      }
      setChkText('');
      setChkCatOverride(null); // neste punkt gjettes på nytt
      setChkPendingColor(null);
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke legge til'); }
    finally { setChkBusy(false); }
  };
  const assignChk = async (item: any, idx: number, name: string) => {
    setChkMenu(null);
    const setter = (prev: any[] | null) => (prev || SAMPLE_CHK).map((c: any, i: number) => (i === idx ? { ...c, assignedTo: name } : c));
    if (isRealP && item.id) {
      setChk(prev => setter(prev));
      try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: { assignedTo: name || null } }); }
      catch (e: any) { window.alert(e?.message || 'Kunne ikke oppdatere ansvar'); }
    } else {
      setChk(prev => setter(prev));
    }
  };
  // Auto-forslag: kontekst fra shot-lista (golden hour → reflektor; backup-rutine).
  const chkItems: any[] = chk || (isRealP ? [] : SAMPLE_CHK);
  const chkHas = (lbl: string) => chkItems.some((c: any) => c.label.trim().toLowerCase() === lbl.toLowerCase());
  const sults: { label: string; category: string; critical?: boolean }[] = (() => {
    const out: { label: string; category: string; critical?: boolean }[] = [];
    const anyShot = (isRealP ? (real?.shots || []) : sampleShots);
    const hasGolden = anyShot.some((s: any) => {
      const k = (s.category || s.kategori || s.phase || s.scene || '').toString().toLowerCase();
      return k.includes('golden') || k.includes('solnedgang') || k.includes('hour');
    });
    if (hasGolden && !chkHas('Reflektor / diffuser')) out.push({ label: 'Reflektor / diffuser pakket (Golden hour)', category: 'utstyr' });
    if (!chkHas('Backup kort formatert') && !chkHas('Backup-kort sjekket og formatert')) out.push({ label: 'Backup-kort sjekket og formatert', category: 'backup' });
    if (!chkHas('Regncover til kamera')) out.push({ label: 'Regncover til kamera', category: 'vær' });
    if (!chkHas('Ekstra linser med')) out.push({ label: 'Ekstra linser med', category: 'utstyr' });
    return out;
  })();
  const delChk = async (item: any, idx: number) => {
    if (isRealP && item.id) {
      setChk((prev) => (prev || []).filter((c) => c.id !== item.id));
      try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); }
      catch (e: any) { window.alert(e?.message || 'Kunne ikke slette'); }
    } else {
      setChk((prev) => (prev || SAMPLE_CHK).filter((_, i) => i !== idx));
    }
  };
  const sendShotComment = async () => {
    const body = comment.trim(); if (!body || !projectId || projectId === 'sample' || !sel?.raw?.id) return;
    const current = real?.shots || [];
    const myName = user?.name || 'Meg';
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const msg = { id: crypto.randomUUID(), who: myName, t, ts: now.toISOString(), msg: body };
    const next = current.map((s: any) => s.id === sel.raw.id ? { ...s, comments: [...(Array.isArray(s.comments) ? s.comments : []), msg] } : s);
    // Lokal append: kommentaren dukker opp med en gang.
    setReal((prev) => (prev ? { ...prev, shots: next } : prev));
    setSel({ ...sel, comments: [...(Array.isArray(sel.comments) ? sel.comments : []), msg] });
    setComment('');
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/shot-list`, { method: 'POST', body: { shots: next } });
      loadShotList(); // bakgrunn-synk — lokalt append ga allerede instant feedback
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke sende kommentar'); }
  };

  // Rediger/slett kommentar: mutér comments-arrayet og POST full liste.
  const saveComments = async (shotId: string, comments: any[]) => {
    if (!projectId || !real) return;
    const next = real.shots.map((s: any) => (s.id === shotId ? { ...s, comments } : s));
    setReal((prev) => (prev ? { ...prev, shots: next } : prev));
    setSel((prev) => (prev && prev.raw?.id === shotId ? { ...prev, comments } : prev));
    setEditingId(null);
    setEditText('');
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/shot-list`, { method: 'POST', body: { shots: next } });
      loadShotList();
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke lagre endringen'); }
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const startEdit = (c: any) => { setEditingId(c.id); setEditText(c.msg || ''); };
  const delComment = (cid: string) => {
    if (!sel?.raw?.id) return;
    saveComments(sel.raw.id, (Array.isArray(sel.comments) ? sel.comments : []).filter((c: any) => c.id !== cid));
  };
  const saveEdit = () => {
    if (!sel?.raw?.id || editingId == null) return;
    const body = editText.trim();
    if (!body) return;
    const now = new Date();
    saveComments(sel.raw.id, (Array.isArray(sel.comments) ? sel.comments : []).map((c: any) =>
      c.id === editingId ? { ...c, msg: body, t: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, ts: now.toISOString() } : c));
  };

  // Live: bruker-events-WS → refetch når shot-lista endres på andre enheter.
  React.useEffect(() => {
    if (!projectId || projectId === 'sample') return;
    const token = localStorage.getItem('creatorhub_auth_token') || localStorage.getItem('token') || localStorage.getItem('role_room_auth_token');
    if (!token) return;
    let alive = true;
    let ws: WebSocket | null = null;
    let retry: any = null;
    let deb: any = null;
    const connect = () => {
      if (!alive) return;
      clearTimeout(retry);
      try { ws = new WebSocket(`${EVENTS_WS_BASE}/api/ipad/ws/events?token=${encodeURIComponent(token)}`); }
      catch { retry = setTimeout(connect, 8000); return; }
      ws.onclose = () => { if (alive) { retry = setTimeout(connect, 8000); } };
      ws.onerror = () => { try { ws && ws.close(); } catch { /* */ } };
      ws.onmessage = (ev) => {
        let payload: any = null;
        try { payload = JSON.parse(ev.data); } catch { /* */ }
        const kind = payload?.event?.kind;
        if (typeof kind !== 'string' || !kind.startsWith('shot.')) return;
        clearTimeout(deb);
        deb = setTimeout(loadShotList, 250); // debounce egen echo + stimer
      };
    };
    connect();
    return () => { alive = false; clearTimeout(retry); clearTimeout(deb); try { ws && ws.close(); } catch { /* */ } };
  }, [projectId]);
  const { user } = useAuth();

  // Hent shot-lista på nytt (mount + live-event + polling-fallback).
  const loadShotList = useCallback(() => {
    if (!projectId || projectId === 'sample') return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/shot-list`)
      .then((r: any) => { const shots = Array.isArray(r?.shots) ? r.shots : []; if (shots.length) setReal({ shots, meta: r.shotList || {} }); })
      .catch(() => {});
  }, [projectId]);

  const { live } = useCaptureRealtime(projectId, loadShotList);
  useEffect(() => {
    loadShotList();
    const id = setInterval(loadShotList, 10000);
    return () => clearInterval(id);
  }, [loadShotList]);

  // «Huk av som ferdig» / «Angre» — PATCH mot capture-APIet (samme som iPad).
  const addShot = async () => {
    if (!newForm.title.trim()) return;
    if (isRealP && projectId) {
      const current = real?.shots || [];
      const shot = { id: crypto.randomUUID(), scene: newForm.kat, name: newForm.title.trim(), priority: newForm.prio.toLowerCase(), locationName: newForm.loc.trim(), isCompleted: false, status: 'planlagt' };
      try {
        await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/shot-list`, { method: 'POST', body: { shots: [...current, shot] } });
        loadShotList();
      } catch (e: any) { window.alert(e?.message || 'Kunne ikke lagre'); }
    } else {
      setSampleShots((prev) => [...prev, { prio: newForm.prio, tone: PRIO_TONE[newForm.prio.toLowerCase()] || 'neutral', title: newForm.title.trim(), kat: newForm.kat, loc: newForm.loc.trim(), status: 'Planlagt', stTone: 'blue', ansvarlig: '', done: false }]);
    }
    addCancel();
    setShowAll(true);
  };

  const toggleDone = async () => {
    const raw = sel?.raw;
    if (!raw?.id || !projectId || toggling) return;
    setToggling(true);
    try {
      await apiRequest(`/api/capture/projects/${encodeURIComponent(projectId)}/shots/${encodeURIComponent(raw.id)}`, {
        method: 'PATCH',
        body: { isCompleted: raw.isCompleted !== true },
      });
      loadShotList();
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke oppdatere status'); }
    finally { setToggling(false); }
  };

  // Sample → display-objekt (uten raw).
  const sampleMap = (s: SampleShot) => ({
    isSample: true,
    raw: null,
    title: s.title,
    prio: s.prio, prioTone: s.tone,
    kat: CAT_LABEL[s.kat] || s.kat,
    katKey: s.kat,
    loc: s.loc,
    statusTxt: s.status, statusTone: s.stTone,
    done: s.done,
    ansvarlig: s.ansvarlig,
    thumb: null,
    notes: '',
    id: '',
    comments: [],
  });

  // Ekte shot → display-objekt (fleksibel felt-mapping mot wizard-shapen).
  const realMap = (s: any) => {
    const title = s.name || s.title || s.shot || s.description || 'Shot';
    const prio = (s.priority || s.prio || 'normal').toString();
    const done = s.isCompleted === true || String(s.status || '').toLowerCase() === 'ferdig';
    const statusBase = done ? 'ferdig' : (s.status || 'planlagt').toString();
    const statusTxt = done && s.completedBy ? `Ferdig · ${s.completedBy}` : (done ? 'Ferdig' : statusBase);
    const kat = s.category || s.kategori || s.phase || s.scene || '—';
    const loc = s.location || s.lokasjon || s.locationName || '—';
    const thumb = s.capturedAssetBackendId
      ? buildApiUrl(`/api/capture/assets/${encodeURIComponent(s.capturedAssetBackendId)}/preview`)
      : null;
    return {
      isSample: false,
      raw: s,
      title,
      prio, prioTone: PRIO_TONE[prio.toLowerCase()] || 'neutral',
      kat: kat === '—' ? '—' : kat,
      katKey: kat,
      loc,
      statusTxt, statusTone: STATUS_TONE[statusBase.toLowerCase()] || 'blue',
      done,
      ansvarlig: s.completedBy || '',
      thumb,
      notes: s.notes || s.description || '',
      id: s.id || '',
      comments: Array.isArray(s.comments) ? s.comments : [],
    };
  };

  const tbl: any[] = isRealP
    ? (real ? real.shots.map(realMap) : [])
    : sampleShots.map(sampleMap);

  const catMatch = (d: any) => {
    if (cat === 'alle' || cat === 'alle-kritisk') return true;
    return d.katKey === cat;
  };
  const isCritical = (d: any) => (d.prio || '').toLowerCase() === 'kritisk' || (d.prio || '').toLowerCase() === 'critical';
  const filteredTbl = tbl
    .filter(catMatch)
    .filter((d) => {
      if (filterMode === 'done') return d.done;
      if (filterMode === 'critical') return isCritical(d);
      if (filterMode === 'mangler') return isCritical(d) && !d.done;
      return true;
    });
  const shownTbl = filteredTbl.slice(0, showAll ? 999 : 12);

  // Stats (sample utledes fra SHOTS; ekte fra meta — aldri sample-tallene).
  const total = isRealP ? (real ? (real.meta.totalShots ?? real.shots.length) : 0) : sampleShots.length;
  const doneN = isRealP ? (real ? (real.meta.completedShots ?? 0) : 0) : sampleShots.filter((s) => s.done).length;
  const criticalN = isRealP ? (real ? (real.meta.criticalShots ?? 0) : 0) : sampleShots.filter((s) => s.prio === 'Kritisk').length;
  const doneCritical = isRealP ? (real ? (real.meta.completedCriticalShots ?? 0) : 0) : sampleShots.filter((s) => s.prio === 'Kritisk' && s.done).length;
  const mangler = isRealP ? Math.max(0, criticalN - doneCritical) : Math.max(0, criticalN - doneCritical);
  const donePct = total > 0 ? Math.round((doneN / total) * 100) : 0;

  // Kategori-piller: sample utleder fra SHOTS; ekte fra egne shots.
  const pills = isRealP
    ? (real ? [{ key: 'alle', label: `Alle (${real.shots.length})` }, ...Object.entries(
        real.shots.reduce((acc: any, s: any) => { const k = s.category || s.kategori || s.phase || s.scene || 'Annet'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
      ).map(([k, n]: any) => ({ key: k, label: `${k} (${n})` }))]
    : [{ key: 'alle', label: 'Alle (0)' }])
    : [
        { key: 'alle', label: `Alle (${sampleShots.length})` },
        ...Object.keys(CAT_LABEL).map((k) => ({ key: k, label: `${CAT_LABEL[k]} (${sampleShots.filter((s) => s.kat === k).length})` })),
      ];


  const selDone = sel?.done === true;
  const selCompBy = sel?.statusTxt || '';
  const myName = user?.name || 'Meg';
  // «Må huskes»-målinger: ring, klarhet og kritisk-åpen.
  const chkDone = chkItems.filter((c: any) => c.checked).length;
  const chkTotal = chkItems.length;
  const chkPct = chkTotal > 0 ? Math.round((chkDone / chkTotal) * 100) : 0;
  const chkRingColor = chkTotal === 0 ? ws.border : (chkPct === 100 ? ws.green : (chkPct > 0 ? ws.amber : '#f87171'));
  const chkReady = chkTotal > 0 && chkDone === chkTotal;
  const openCriticals = chkItems.filter((c: any) => c.critical && !c.checked);
  // Live-gjett i quick-add: ML-gjett fra backend (fallback: lokale stikkord).
  const chkGuessCat = chkText.trim() ? (chkCatOverride || chkGuess?.category || guessCat(chkText)) : null;
  const chkGuessCrit = chkText.trim() ? (chkGuess?.critical ?? guessCritical(chkText)) : false;
  const chkGuessConf = chkGuess && !chkCatOverride ? chkGuess.confidence : null;
  // Kategori-velger: brukes både for quick-add (item=null → override) og for å
  // endre kategorien på et eksisterende punkt (PATCH → backend lærer).
  const [chkCatMenu, setChkCatMenu] = useState<null | { anchor: HTMLElement; item: any; idx: number; quick: boolean }>(null);
  const [catNewName, setCatNewName] = useState('');
  const [catNewColor, setCatNewColor] = useState<string | null>(null); // valgt farge i menyen
  const [chkPendingColor, setChkPendingColor] = useState<string | null>(null); // brukes ved neste quick-add
  const [customCats, setCustomCats] = useState<{ name: string; color: string }[]>([]);

  const customOf = (name: string) => customCats.find((c) => c.name.toLowerCase() === name.toLowerCase());
  const usedCatColors = () => [...Object.values(CHK_CAT).map((c) => c.color), ...customCats.map((c) => c.color)];
  const firstFreeColor = () => CAT_PALETTE.find((c) => !usedCatColors().includes(c)) || CAT_PALETTE[0];
  const effColor = (name: string, itemColor?: string) => itemColor || CHK_CAT[name]?.color || customOf(name)?.color || catColor(name);

  // Seed egendefinerte kategorier fra eksisterende punkter (iPad/tidligere data) —
  // med automatisk farge som ikke kolliderer med de andre.
  useEffect(() => {
    const seed = new Map<string, string>();
    for (const c of chkItems) {
      const x = c.category;
      if (!x || CHK_CAT[x]) continue;
      const key = x.toLowerCase();
      if (!seed.has(key)) seed.set(key, c.color || catColor(x));
    }
    setCustomCats((prev) => {
      const next = [...prev];
      for (const [name, fallback] of seed) {
        if (next.some((c) => c.name.toLowerCase() === name)) continue;
        const used = new Set([...Object.values(CHK_CAT).map((cc) => cc.color), ...next.map((c) => c.color)]);
        const free = CAT_PALETTE.find((p) => !used.has(p)) || fallback;
        next.push({ name, color: free });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chk, sampleShots]);

  const useCatChoice = (m: { item: any; idx: number; quick: boolean }, k: string, color?: string) => {
    if (m.quick) { setChkCatOverride(k || null); setChkPendingColor(color || null); return; }
    const setter = (prev: any[] | null) => (prev || SAMPLE_CHK).map((c: any, i2: number) => (i2 === m.idx ? { ...c, category: k, ...(color ? { color } : {}) } : c));
    setChk((prev) => setter(prev));
    if (color && k && !CHK_CAT[k]) {
      setCustomCats((prev) => {
        const i = prev.findIndex((c) => c.name.toLowerCase() === k.toLowerCase());
        if (i === -1) return prev;
        const next = [...prev];
        next[i] = { ...next[i], color };
        return next;
      });
    }
    if (isRealP && m.item?.id) {
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist/${encodeURIComponent(m.item.id)}`, { method: 'PATCH', body: { category: k, ...(color ? { color } : {}) } }).catch((e: any) => window.alert(e?.message || 'Kunne ikke endre kategori'));
    }
  };
  const pickChkCat = (k: string) => {
    const m = chkCatMenu;
    setChkCatMenu(null);
    if (m) useCatChoice(m, k, catNewColor || undefined);
    else setCatNewColor(null);
  };
  // Farge-swatch: quick → forhåndsvelg til neste add; item → umiddelbar PATCH (beholder kategori).
  const onSwatch = (c: string) => {
    const m = chkCatMenu;
    if (!m) return;
    if (m.quick) {
      setCatNewColor(c);
      if (chkCatOverride) setChkPendingColor(c);
    } else {
      useCatChoice(m, m.item?.category || 'utstyr', c);
      setCatNewColor(null);
    }
  };
  // Ny egenkategori: velger automatisk ledig farge, lagres lokalt, brukes nå.
  const commitCatCustom = () => {
    const name = catNewName.trim();
    if (!name) return;
    const m = chkCatMenu;
    setChkCatMenu(null);
    setCatNewName('');
    const color = catNewColor || firstFreeColor();
    setCatNewColor(null);
    setCustomCats((prev) => (prev.some((c) => c.name.toLowerCase() === name.toLowerCase()) ? prev : [...prev, { name, color }]));
    if (m) useCatChoice(m, name, color);
  };
  const chkInputRef = React.useRef<any>(null);

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <style>{`
          @keyframes wsLivePulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.45); } 70% { box-shadow: 0 0 0 7px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
          @keyframes wsRedGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(248,113,113,0); } 50% { box-shadow: 0 0 16px 1px rgba(248,113,113,.28); } }
          @keyframes wsFadeUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
          @keyframes wsStripePulse { 0%,100% { opacity: .9; } 50% { opacity: .55; } }
          @keyframes wsCheckPop { 0% { transform: scale(.5); opacity: .3; } 60% { transform: scale(1.35); } 100% { transform: scale(1); opacity: 1; } }
          @keyframes wsCritTag { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
          @keyframes wsReadyShine { 0% { transform: translateX(-130%); } 100% { transform: translateX(400%); } }
          .ws-live-dot { width: 7px; height: 7px; border-radius: 999px; background: #22c55e; animation: wsLivePulse 1.8s ease-out infinite; }
          .ws-mangler-glow { border-radius: 12px; animation: wsRedGlow 2.2s ease-in-out infinite; }
          .ws-fade-up { animation: wsFadeUp .4s cubic-bezier(.22,1,.36,1) both; }
          .ws-stripe-live { animation: wsStripePulse 1.6s ease-in-out infinite; }
          .ws-check-pop { transform-origin: center; animation: wsCheckPop .3s cubic-bezier(.22,1,.36,1); }
          .ws-crit-pulse { animation: wsCritTag 1.9s ease-in-out infinite; }
          .ws-ready-box { position: relative; overflow: hidden; }
          .ws-ready-box::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 45%; background: linear-gradient(105deg, transparent, rgba(52,211,153,.3), transparent); animation: wsReadyShine 2.8s ease-in-out infinite; pointer-events: none; }
          @media (prefers-reduced-motion: reduce) {
            .ws-live-dot, .ws-mangler-glow, .ws-fade-up, .ws-stripe-live, .ws-check-pop, .ws-crit-pulse, .ws-ready-box::after { animation: none; }
          }
        `}</style>

        <WsPageTitle icon={<PhotoCameraBack sx={{ fontSize: 21, color: '#fff' }} />} title="Shotlist" sub={`${total} shots · ${donePct}% fullført · ${mangler} kritiske mangler`}>
          {live && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.25, borderRadius: 999, bgcolor: ws.greenSoft }}>
              <Box className="ws-live-dot" />
              <Typography sx={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Live</Typography>
            </Box>
          )}
        </WsPageTitle>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <WsStat icon={<PhotoCameraBack sx={{ fontSize: 20 }} />} label="Totalt antall shots" value={total} sub={isRealP ? 'I aktiv shotlist' : 'Alle kategorier'} />
          <Box sx={{ borderRadius: 2, cursor: doneN > 0 ? 'pointer' : 'default', transition: 'box-shadow .2s', '&:hover': { boxShadow: doneN > 0 ? '0 0 0 1px rgba(52,211,153,.4)' : 'none' } }} onClick={() => { if (doneN > 0) { setFilterMode((f) => (f === 'done' ? 'alle' : 'done')); setCat('alle'); } }}>
            <WsStat icon={<CheckCircle sx={{ fontSize: 20 }} />} label="Fullført" value={doneN} sub={`${donePct}% av totalen`} tone={ws.greenSoft} />
          </Box>
          <Box sx={{ borderRadius: 2, cursor: criticalN > 0 ? 'pointer' : 'default', transition: 'box-shadow .2s', '&:hover': { boxShadow: criticalN > 0 ? '0 0 0 1px rgba(251,191,36,.4)' : 'none' } }} onClick={() => { if (criticalN > 0) { setFilterMode((f) => (f === 'critical' ? 'alle' : 'critical')); setCat('alle'); } }}>
            <WsStat icon={<Star sx={{ fontSize: 20 }} />} label="Kritiske øyeblikk" value={criticalN} sub={`Av totalt ${total}`} tone={ws.amberSoft} />
          </Box>
          <Box className={mangler > 0 && filterMode !== 'mangler' ? 'ws-mangler-glow' : undefined} sx={{ borderRadius: 2, cursor: mangler > 0 ? 'pointer' : 'default' }} onClick={() => { if (mangler > 0) { setFilterMode((f) => (f === 'mangler' ? 'alle' : 'mangler')); setCat('alle'); } }}>
            <WsStat icon={<ErrorOutline sx={{ fontSize: 20 }} />} label="Mangler" value={mangler} sub="Kritiske som må dekkes" tone={ws.redSoft} />
          </Box>
        </Box>

        {/* Preflight: Må huskes — sammenleggbar rad; kollaps viser ring + åpne kritiske, klikk for full liste */}
        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} onClick={() => setChkOpen((o) => !o)} sx={{ cursor: 'pointer' }}>
            <WsRing value={chkPct} size={40} thickness={5} label={chkTotal > 0 ? `${chkDone}/${chkTotal}` : '–'} color={chkRingColor} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>Må huskes</Typography>
                {chkReady ? <WsTag label="Klart" tone="green" /> : (openCriticals.length > 0 && <Box className="ws-crit-pulse" sx={{ fontSize: 10, fontWeight: 800, color: '#f87171' }}>{openCriticals.length} kritiske åpne</Box>)}
              </Stack>
              <Typography noWrap sx={{ fontSize: 11, color: ws.textDim }}>{chkTotal === 0 ? 'Bygg preflight-lagen din' : (chkReady ? 'Alt på plass — klart for produksjon' : `${chkDone} av ${chkTotal} på plass · ${chkPct}%`)}</Typography>
            </Box>
            {!chkOpen && openCriticals.length > 0 && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0, minWidth: 0, maxWidth: '36%', overflow: 'hidden' }}>
                {openCriticals.slice(0, 2).map((c: any) => (
                  <Box key={c.id || c.label} title={c.label} sx={{ fontSize: 10.5, fontWeight: 800, color: '#f87171', border: '1px solid rgba(248,113,113,.5)', borderRadius: 999, px: 0.75, py: 0.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</Box>
                ))}
                {openCriticals.length > 2 && <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#f87171' }}>+{openCriticals.length - 2}</Typography>}
              </Stack>
            )}
            {chkOpen && (
              <Button size="small" startIcon={<Add sx={{ fontSize: 14 }} />} onClick={(e) => { e.stopPropagation(); chkInputRef.current?.scrollIntoView({ block: 'nearest' }); chkInputRef.current?.focus(); }} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5, px: 1, flexShrink: 0, '&:hover': { bgcolor: ws.accentSoft } }}>Legg til</Button>
            )}
            <IconButton size="small" sx={{ color: ws.textDim, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); setChkOpen((o) => !o); }} aria-label="Utvid eller skjul må huskes">
              {chkOpen ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
            </IconButton>
          </Stack>

          {chkOpen && (
            <Box className="ws-fade-up" sx={{ mt: 1.5 }}>
              {chkReady && (
                <Box className="ws-ready-box" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, bgcolor: 'rgba(52,211,153,0.09)', border: '1px solid rgba(52,211,153,0.4)', borderRadius: 1.5, px: 1.25, py: 0.75, mb: 1 }}>
                  <CheckCircle sx={{ fontSize: 15, color: ws.green, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: ws.green }}>Alt klart — alt på plass til produksjon</Typography>
                </Box>
              )}

              {sults.length > 0 && (
                <Stack spacing={0.5} sx={{ mb: 1 }}>
                  {sults.map((su) => (
                    <Stack key={su.label} direction="row" spacing={1} alignItems="center" sx={{ bgcolor: ws.accentSoft, borderRadius: 1, px: 1, py: 0.5 }}>
                      <Lightbulb sx={{ fontSize: 14, color: ws.accent, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12, flex: 1, minWidth: 0, color: ws.textDim }}>{su.label}</Typography>
                      <Button size="small" disabled={chkBusy} onClick={() => addChk(su.label, { category: su.category, critical: su.critical })} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, fontSize: 11 }}>Legg til</Button>
                    </Stack>
                  ))}
                </Stack>
              )}

              {chkItems.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: ws.textDim, py: 0.5 }}>Ingen huskepunkter ennå — legg til nedenfor.</Typography>
              ) : (
                <Stack spacing={0.25}>
                  {chkItems.map((item: any, i: number) => {
                    const catLabel = item.category || 'Annet';
                    const criticalOpen = !!item.critical && !item.checked;
                    return (
                      <Stack key={item.id || i} direction="row" spacing={0.75} alignItems="center" sx={{ px: 0.5, py: 0.35, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: ws.panelAlt } }} onClick={() => toggleChk(item, i)}>
                        <CheckCircle className={item.checked ? 'ws-check-pop' : undefined} sx={{ fontSize: 18, color: item.checked ? ws.green : ws.textFaint, transition: 'color .2s', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 12.5, flex: 1, minWidth: 0, textDecoration: item.checked ? 'line-through' : 'none', color: item.checked ? ws.textFaint : ws.text }}>{item.label}</Typography>
                        <Box onClick={(e) => { e.stopPropagation(); setCatNewColor(null); setChkCatMenu({ anchor: e.currentTarget, item, idx: i, quick: false }); }} title="Endre kategori eller farge" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, flexShrink: 0, cursor: 'pointer', borderRadius: 1, px: 0.4, py: 0.15, '&:hover': { bgcolor: ws.accentSoft } }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: effColor(item.category, item.color) }} />
                          <Typography sx={{ fontSize: 10.5, color: effColor(item.category, item.color) }}>{catLabel}</Typography>
                        </Box>
                        {criticalOpen && <Box className="ws-crit-pulse" sx={{ fontSize: 10, fontWeight: 800, color: '#f87171', border: '1px solid rgba(248,113,113,.5)', borderRadius: 1, px: 0.5, py: 0.1, flexShrink: 0 }}>KRITISK</Box>}
                        <Box onClick={(e) => { e.stopPropagation(); setChkMenu({ anchor: e.currentTarget, item, idx: i }); }} sx={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', bgcolor: item.assignedTo ? ws.accentSoft : ws.panelAlt, '&:hover': { bgcolor: ws.accentSoft } }} title="Tildel ansvar">
                          {item.assignedTo ? <Avatar sx={{ width: 22, height: 22, fontSize: 9, bgcolor: 'transparent', color: ws.accent, fontWeight: 800 }}>{ini(item.assignedTo)}</Avatar> : <PersonAddAlt sx={{ fontSize: 12, color: ws.textFaint }} />}
                        </Box>
                        <Box component="span" onClick={(e) => { e.stopPropagation(); delChk(item, i); }} sx={{ fontSize: 12, color: ws.textFaint, opacity: 0, cursor: 'pointer', flexShrink: 0, '&:hover': { color: '#f87171' } }}>✕</Box>
                      </Stack>
                    );
                  })}
                </Stack>
              )}

              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.25 }}>
                <TextField fullWidth size="small" placeholder="Nytt huskepunkt…" value={chkText} onChange={(e) => setChkText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addChk(); }} disabled={chkBusy} inputRef={chkInputRef} sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 12.5 } }} />
                {chkGuessCat && (
                  <Box onClick={(e) => { setCatNewColor(null); setChkCatMenu({ anchor: e.currentTarget, item: null, idx: -1, quick: true }); }} title="Velg kategori eller farge manuelt" sx={{ display: 'flex', alignItems: 'center', gap: 0.45, cursor: 'pointer', flexShrink: 0, borderRadius: 999, border: `1px dashed ${chkCatOverride ? 'rgba(99,102,241,.8)' : (chkGuessCrit ? 'rgba(248,113,113,.6)' : 'rgba(148,163,184,.5)')}`, px: 0.9, py: 0.35, bgcolor: chkCatOverride ? ws.accentSoft : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: effColor(chkGuessCat) }} />
                    <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: effColor(chkGuessCat) }}>{CHK_CAT[chkGuessCat]?.label || chkGuessCat}</Typography>
                    {chkCatOverride && <Typography sx={{ fontSize: 9, fontWeight: 700, color: ws.accent }}>manuell</Typography>}
                    {chkGuessConf != null && <Typography sx={{ fontSize: 9, fontWeight: 600, color: ws.textFaint }}>{chkGuessConf}%</Typography>}
                    {chkGuessCrit && <Typography sx={{ fontSize: 9.5, fontWeight: 900, color: '#f87171' }}>KRITISK</Typography>}
                  </Box>
                )}
                <Button size="small" onClick={() => addChk()} disabled={!chkText.trim() || chkBusy} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5, px: 1, '&:hover': { bgcolor: ws.accentSoft } }}>Legg til</Button>
              </Stack>
              <Menu anchorEl={chkCatMenu?.anchor || null} open={!!chkCatMenu} onClose={() => setChkCatMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}`, py: 0.5 } }}>
                {(Object.keys(CHK_CAT) as string[]).map((k) => (
                  <MenuItem key={k} selected={chkCatMenu?.quick ? chkCatOverride === k : chkCatMenu?.item?.category === k} onClick={() => pickChkCat(k)} sx={{ fontSize: 13, display: 'flex', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: effColor(k) }} />
                    {CHK_CAT[k].label}
                  </MenuItem>
                ))}
                {customCats.map((cc) => (
                  <MenuItem key={cc.name} selected={chkCatMenu?.quick ? chkCatOverride === cc.name : chkCatMenu?.item?.category === cc.name} onClick={() => pickChkCat(cc.name)} sx={{ fontSize: 13, display: 'flex', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: effColor(cc.name) }} />
                    {cc.name}
                  </MenuItem>
                ))}
                {chkCatMenu?.quick && <MenuItem selected={!chkCatOverride} onClick={() => pickChkCat('')} sx={{ fontSize: 13, color: ws.textDim }}>Auto (gjett)</MenuItem>}
                <Stack direction="row" spacing={0.6} sx={{ px: 1.25, pt: 0.5, flexWrap: 'wrap', gap: 0.4 }} alignItems="center" onClick={(e) => e.stopPropagation()}>
                  {CAT_PALETTE.map((c) => {
                    const active = (chkCatMenu?.quick ? (chkCatOverride ? effColor(chkCatOverride) : (catNewName.trim() ? (catNewColor || firstFreeColor()) : undefined)) : effColor(chkCatMenu?.item?.category, chkCatMenu?.item?.color)) === c;
                    return (
                      <Box key={c} onClick={() => onSwatch(c)} title="Velg farge" sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: c, cursor: 'pointer', border: active ? '2px solid #fff' : '1px solid rgba(255,255,255,.25)', transform: active ? 'scale(1.1)' : 'none', transition: 'transform .12s, border-color .12s', '&:hover': { transform: 'scale(1.15)' } }} />
                    );
                  })}
                </Stack>
                <Box sx={{ px: 1.25, py: 0.75 }}>
                  <TextField size="small" fullWidth placeholder="Ny kategori…" value={catNewName} onChange={(e) => setCatNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitCatCustom(); if (e.key === 'Escape') setChkCatMenu(null); }} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 12.5 } }} />
                </Box>
              </Menu>
            </Box>
          )}

          <Menu anchorEl={chkMenu?.anchor || null} open={!!chkMenu} onClose={() => setChkMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}` } }}>
            <MenuItem disabled={!chkMenu?.item?.assignedTo} onClick={() => { if (chkMenu) { const { item, idx } = chkMenu; assignChk(item, idx, ''); } }} sx={{ fontSize: 13 }}>Ikke tildelt</MenuItem>
            {CHK_CREW.map((nm) => <MenuItem key={nm} onClick={() => { if (chkMenu) { const { item, idx } = chkMenu; assignChk(item, idx, nm); } }} sx={{ fontSize: 13 }}>{nm}</MenuItem>)}
          </Menu>
        </WsCard>

        <WsCard>
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              <WsPills items={pills} value={cat} onChange={(k) => { setCat(k); setFilterMode('alle'); }} />
              <Button size="small" startIcon={<Add sx={{ fontSize: 14 }} />} onClick={() => setAdding(true)} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.accentBorder}`, borderRadius: 1.5, px: 1, '&:hover': { bgcolor: ws.accentSoft } }}>Nytt shot</Button>
            </Stack>
            {filterMode !== 'alle' && (
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1 }}>
                <ErrorOutline sx={{ fontSize: 14, color: filterMode === 'mangler' ? '#f87171' : (filterMode === 'critical' ? ws.amber : ws.green) }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: filterMode === 'mangler' ? '#f87171' : (filterMode === 'critical' ? ws.amber : ws.green) }}>
                  {filterMode === 'mangler' ? `Kritiske som mangler dekning (${filteredTbl.length})` : filterMode === 'critical' ? `Kritiske øyeblikk (${filteredTbl.length})` : `Fullførte shots (${filteredTbl.length})`}
                </Typography>
                <Button size="small" onClick={() => setFilterMode('alle')} sx={{ color: ws.textDim, textTransform: 'none', fontSize: 11.5, ml: 'auto' }} startIcon={<RestartAlt sx={{ fontSize: 14 }} />}>Vis alle</Button>
              </Stack>
            )}
            <Box sx={{ mt: 1, height: 4, borderRadius: 999, bgcolor: ws.panelAlt, overflow: 'hidden' }}>
              <Box className={donePct > 0 && donePct < 100 ? 'ws-stripe-live' : undefined} sx={{ height: '100%', width: `${Math.max(2, donePct)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${ws.accent}, #22d3ee)`, transition: 'width .6s cubic-bezier(.22,1,.36,1)' }} />
            </Box>
            <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 0.5 }}>{donePct}% fullført · {mangler} kritiske mangler</Typography>
          </Box>
          {shownTbl.length === 0 && <Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 3, textAlign: 'center' }}>{isRealP ? 'Ingen shots ennå. Shotlister opprettes fra prosjekt-oppsettet eller iPad-appen.' : 'Ingen shots i denne kategorien.'}</Typography>}
          {shownTbl.length > 0 && <WsTable
            columns={['Prioritet', 'Shot', 'Kategori', 'Foto', 'Video', 'Lokasjon', 'Ansvarlig', 'Status']}
            onRowClick={(i) => setSel(shownTbl[i])}
            rows={shownTbl.map((d) => [
              <WsTag key="p" label={d.prio} tone={d.prioTone} />,
              <Box key="t" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {d.thumb && <Box component="img" src={d.thumb} alt="" loading="lazy" sx={{ width: 34, height: 28, objectFit: 'cover', borderRadius: 1, flex: 'none', border: `1px solid ${d.done ? ws.green : ws.border}` }} />}
                <Typography sx={{ fontSize: 13, fontWeight: 600, opacity: d.done ? 0.55 : 1 }}>{d.title}</Typography>
              </Box>,
              <Typography key="k" sx={{ fontSize: 12, color: ws.textDim }}>{d.kat}</Typography>,
              <WsTag key="f" label="Foto" tone="accent" />,
              <WsTag key="v" label="Video" tone="blue" />,
              <Typography key="l" sx={{ fontSize: 12, color: ws.textDim }}>{d.loc}</Typography>,
              d.ansvarlig ? (
                <Stack key="a" direction="row" spacing={0.75} alignItems="center">
                  <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: ws.panelAlt, color: ws.accent }}>{ini(d.ansvarlig)}</Avatar>
                  <Typography sx={{ fontSize: 12, color: ws.textDim }}>{d.ansvarlig}</Typography>
                </Stack>
              ) : <Typography key="a" sx={{ fontSize: 12, color: ws.textFaint }}>—</Typography>,
              <Box key="s" sx={{ display: 'inline-flex' }}><WsTag label={d.statusTxt} tone={d.statusTone} /></Box>,
            ])}
          />}
          {filteredTbl.length > 12 && (
            <Stack alignItems="center" sx={{ mt: 1 }}><Button size="small" onClick={() => setShowAll((v) => !v)} sx={{ color: ws.textDim, textTransform: 'none' }}>{showAll ? 'Vis færre ▴' : `Vis ${filteredTbl.length - 12} flere shots ▾`}</Button></Stack>
          )}
        </WsCard>

      </Box>

      {/* Shot detaljer (høyre) */}
      <Box sx={{ width: { xs: '100%', lg: 320 }, flexShrink: 0 }}>
        <WsCard className="ws-fade-up">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Shot detaljer</Typography>
            {isRealP ? (real?.shots?.length ? <WsTag label={`${real.shots.length} shots`} tone="neutral" /> : null) : <WsTag label={`${sampleShots.length} shots`} tone="neutral" />}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <WsTag label={sel ? sel.prio : (isRealP ? 'Shot' : 'Kritisk')} tone={sel ? sel.prioTone : (isRealP ? 'neutral' : 'red')} />
            <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{sel ? sel.title : (isRealP ? 'Velg et shot' : 'Brud inngang')}</Typography>
            {(sel || !isRealP) && <WsTag label={sel ? (sel.kat || 'Shot') : 'Vielse'} tone="accent" />}
          </Stack>
          {sel && <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mb: 1, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>{wsIcon('Place', { fontSize: 13 })}{sel.loc || '—'} · {sel.statusTxt || '—'}</Typography>}
          <WsImageGrid columns={1} ratio="4 / 3" addLabel="Last opp referanse" />
          {/* Nytt shot-skjema (uavhengig av isRealP); ellers ekte-innhold eller sample-demo. */}
          {adding ? (
            <Stack spacing={1.25} sx={{ mt: 1 }}>
              <TextField fullWidth size="small" placeholder="Tittel på shot…" value={newForm.title} onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {Object.keys(CAT_LABEL).map((k) => (
                  <Box key={k} onClick={() => setNewForm((f) => ({ ...f, kat: k }))} sx={{ px: 0.75, py: 0.25, borderRadius: 1, fontSize: 11.5, fontWeight: newForm.kat === k ? 800 : 500, cursor: 'pointer', color: newForm.kat === k ? ws.accent : ws.textDim, bgcolor: newForm.kat === k ? ws.accentSoft : 'transparent', '&:hover': { bgcolor: ws.accentSoft } }}>{CAT_LABEL[k]}</Box>
                ))}
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {['Kritisk', 'Høy', 'Normal', 'Lav'].map((p) => (
                  <Box key={p} onClick={() => setNewForm((f) => ({ ...f, prio: p }))} sx={{ px: 0.75, py: 0.25, borderRadius: 1, fontSize: 11.5, fontWeight: newForm.prio === p ? 800 : 500, cursor: 'pointer', color: newForm.prio === p ? PRIO_TONE[p.toLowerCase()] === 'red' ? '#f87171' : PRIO_TONE[p.toLowerCase()] === 'amber' ? ws.amber : ws.textDim : ws.textDim, bgcolor: newForm.prio === p ? 'rgba(255,255,255,0.06)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}>{p}</Box>
                ))}
              </Stack>
              <TextField fullWidth size="small" placeholder="Lokasjon (valgfri)" value={newForm.loc} onChange={(e) => setNewForm((f) => ({ ...f, loc: e.target.value }))} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
              <Stack direction="row" spacing={1}>
                <Button fullWidth size="small" disabled={!newForm.title.trim()} onClick={addShot} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, color: ws.accent, border: `1px solid ${ws.accentBorder}` }}>Lagre</Button>
                <Button fullWidth size="small" onClick={addCancel} sx={{ textTransform: 'none', borderRadius: 1.5, color: ws.textDim }}>Avbryt</Button>
              </Stack>
            </Stack>
          ) : isRealP ? (
            sel ? (
              <>
                {sel.thumb && (
                  <Box component="img" src={sel.thumb} alt="" sx={{ width: '100%', borderRadius: 1.5, border: `1px solid ${ws.border}`, mt: 1 }} />
                )}
                {selDone && selCompBy && <Typography sx={{ fontSize: 12.5, color: ws.green, mt: 1 }}>✓ Ferdig{selCompBy.includes('Ferdig') ? ` · ${selCompBy.replace(/^Ferdig · /, '')}` : ''}</Typography>}
                {sel.notes && <Typography sx={{ fontSize: 12.5, color: ws.textDim, mt: 1 }}>{sel.notes}</Typography>}
                <Button
                  fullWidth
                  size="small"
                  startIcon={selDone ? <Undo sx={{ fontSize: 15 }} /> : <CheckCircle sx={{ fontSize: 15 }} />}
                  disabled={toggling}
                  onClick={toggleDone}
                  sx={{ mt: 1.25, textTransform: 'none', fontWeight: 700, borderRadius: 1.5, color: selDone ? ws.amber : ws.green, border: `1px solid ${selDone ? 'rgba(251,191,36,.4)' : 'rgba(52,211,153,.45)'}`, '&:hover': { bgcolor: selDone ? 'rgba(251,191,36,.08)' : 'rgba(52,211,153,.08)' } }}
                >
                  {selDone ? 'Angre (marker uferdig)' : 'Huk av som ferdig'}
                </Button>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5, mt: 1.5 }}>SAMTALE</Typography>
                {(Array.isArray(sel.comments) ? sel.comments : []).length === 0 ? (
                  <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mb: 1 }}>Ingen kommentarer ennå — første beskjeden setter tråden.</Typography>
                ) : (
                  <Stack spacing={0.75} sx={{ mb: 1 }}>
                    {sel.comments.map((m: any, i: number) => {
                      const mine = (m.who || '').trim().toLowerCase() === myName.trim().toLowerCase();
                      const editing = editingId === m.id;
                      return (
                        <Stack key={m.id || i} direction="row" spacing={1} sx={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                          {!mine && <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: ws.panelAlt, color: ws.accent }}>{(m.who || '?')[0]}</Avatar>}
                          <Box sx={{ maxWidth: '82%' }}>
                            <Box sx={{ bgcolor: mine ? ws.accentSoft : ws.panelAlt, borderRadius: mine ? '10px 10px 2px 10px' : '10px 10px 10px 2px', px: 1, py: 0.5 }}>
                              <Stack direction="row" spacing={0.75} alignItems="baseline">
                                <Typography sx={{ fontSize: 11, fontWeight: 800, color: mine ? ws.accent : ws.textDim }}>{mine ? 'Du' : m.who}</Typography>
                                <Typography sx={{ fontSize: 9.5, color: ws.textFaint }}>{fmtCommentTime(m.ts, m.t)}</Typography>
                              </Stack>
                              {editing ? (
                                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                                  <TextField fullWidth size="small" autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }} sx={{ '& .MuiInputBase-root': { fontSize: 11.5 } }} />
                                </Stack>
                              ) : (
                                <Typography sx={{ fontSize: 12, color: ws.text }}>{m.msg}</Typography>
                              )}
                            </Box>
                            {mine && (
                              <Stack direction="row" spacing={0.75} sx={{ justifyContent: 'flex-end', mt: 0.25 }}>
                                {editing ? (
                                  <>
                                    <Button size="small" onClick={saveEdit} sx={{ minWidth: 0, p: 0, fontSize: 10.5, fontWeight: 700, color: ws.green, textTransform: 'none' }}>Lagre</Button>
                                    <Button size="small" onClick={() => setEditingId(null)} sx={{ minWidth: 0, p: 0, fontSize: 10.5, color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="small" onClick={() => startEdit(m)} sx={{ minWidth: 0, p: 0, fontSize: 10.5, color: ws.textFaint, textTransform: 'none' }}>Rediger</Button>
                                    <Button size="small" onClick={() => delComment(m.id)} sx={{ minWidth: 0, p: 0, fontSize: 10.5, color: '#f87171', textTransform: 'none' }}>Slett</Button>
                                  </>
                                )}
                              </Stack>
                            )}
                          </Box>
                          {mine && <Avatar sx={{ width: 24, height: 24, fontSize: 10, bgcolor: ws.accentSoft, color: ws.accent }}>{myName[0]}</Avatar>}
                        </Stack>
                      );
                    })}
                  </Stack>
                )}
              </>
            ) : (
              <Typography sx={{ fontSize: 12.5, color: ws.textDim, mt: 1 }}>Klikk på en rad i tabellen for å se detaljer og huke av shots.</Typography>
            )
          ) : (<>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, my: 1.25 }}>Bruden går ned midtgangen. Fokus på reaksjonene til brudgommen og gjestene.</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>UTSTYR & INNSTILLINGER</Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
              {['Foto: 85mm f/1.4', '4K 25fps', '50mm', 'Gimbal'].map((x) => <WsTag key={x} label={x} tone="neutral" />)}
            </Stack>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>SAMTALE</Typography>
            <Stack spacing={1.25} sx={{ mb: 1 }}>
              {SAMTALE.map((m, i) => (
                <Stack key={i} direction="row" spacing={1}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: 10 }}>{m.who[0]}</Avatar>
                  <Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} alignItems="baseline"><Typography sx={{ fontSize: 12, fontWeight: 700 }}>{m.who}</Typography><Typography sx={{ fontSize: 10, color: ws.textFaint }}>{m.t}</Typography></Stack><Typography sx={{ fontSize: 12, color: ws.textDim }}>{m.msg}</Typography></Box>
                </Stack>
              ))}
            </Stack>
          </>)}
          <TextField fullWidth size="small" placeholder="Skriv en kommentar…" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendShotComment(); }} disabled={!projectId || projectId === 'sample' || !sel?.raw?.id} sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 }, mt: isRealP ? 1.25 : 0 }} />
        </WsCard>
      </Box>
    </Stack>
  );
};

export default ShotlistTab;
