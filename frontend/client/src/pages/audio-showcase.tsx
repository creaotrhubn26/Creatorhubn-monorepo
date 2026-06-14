/**
 * audio-showcase.tsx — Feedback Studio (Audio Showcase)
 * ───────────────────────────────────────────────────────────────────────────
 * Profesjonelt mix/master-review-rom for musikkprodusenter. Bygget for eksakt
 * paritet med produktmockup #2 — topbar + venstre prosjekt-sidebar + senter
 * (waveform m/ seksjonsbar + transport + versjoner + tasks) + høyre kommentar-
 * rail + bunn-action-bar. ALT wired til ekte /api/audio-* — ingen stubs.
 */

import React from 'react';
import { useParams } from 'wouter';
import WaveSurfer from 'wavesurfer.js';
import {
  Box, Stack, Typography, Button, IconButton, Chip, TextField, Avatar, Divider,
  CircularProgress, Tooltip, Menu, MenuItem, Slider, InputBase, Dialog, DialogTitle,
  DialogContent, DialogActions, Tabs, Tab, Switch, FormControlLabel,
} from '@mui/material';
import {
  Search, NotificationsNone, HelpOutline, KeyboardArrowDown, MoreHoriz, FileDownloadOutlined,
  MusicNote, PlayArrow, Pause, SkipPrevious, SkipNext, VolumeUp, Loop as LoopIcon, CompareArrows,
  Add, ChatBubbleOutline, CheckCircle, CheckCircleOutline, CloudUpload, ThumbUpAltOutlined,
  ThumbUpAlt, AccessTime, Send, WorkspacePremium, GridViewOutlined, GraphicEq, LayersOutlined,
  Inventory2Outlined, SubjectOutlined, StickyNote2Outlined, TimelineOutlined, Speed, VpnKey,
  CategoryOutlined, StyleOutlined, Schedule, CalendarTodayOutlined, ArrowForwardIos, FiberManualRecord, Sync,
  PhotoCamera, ReceiptLongOutlined, ContentCopy, DoneAll, RocketLaunchOutlined, FileDownloadDoneOutlined, TipsAndUpdatesOutlined,
} from '@mui/icons-material';
import { apiRequest, getAuthHeader } from '@/lib/queryClient';
import { buildSectionAnchors, parseSongSections, sectionInsertToken, INSERT_SECTION_OPTIONS, SECTION_COLORS as SECTION_TYPE_COLORS, NB_LABELS, type SectionType } from '@/lib/lyric-sections';
import ImageDrop from '@/components/universal/showcase/ImageDrop';
import ComboField, { MultiComboField, ROLE_OPTIONS, INSTRUMENT_OPTIONS, CONTRIBUTION_OPTIONS } from '@/components/universal/showcase/ComboField';
import SpotifyArtistField from '@/components/universal/showcase/SpotifyArtistField';
import SignaturePad, { type SignatureHandle } from '@/components/universal/showcase/SignaturePad';
import YouTubePublishPanel from '@/components/universal/showcase/YouTubePublishPanel';
import { audioShowcaseEvents } from '@/utils/creatorhub-events';

/* ── Tema ──────────────────────────────────────────────────────────────── */
const BG = '#0A0A0B', PANEL = '#131316', PANEL2 = '#0F0F11', BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', FAINT = 'rgba(245,242,234,0.38)', ACCENT = '#FF6B35';
const SECTION_COLORS = ['#d6457f', '#3fa7d6', '#e0606a', '#FF6B35', '#9b59b6', '#e0a955', '#d4c04a', '#5fb88a'];

const fmt = (s: number) => { if (!Number.isFinite(s) || s < 0) s = 0; return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`; };
const initial = (n?: string) => (n || '?').trim().charAt(0).toUpperCase();
const relTime = (iso?: string) => {
  if (!iso) return '';
  const t = Date.parse(iso); if (Number.isNaN(t)) return '';
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'I dag'; if (days === 1) return 'I går'; if (days < 7) return `${days} dager siden`;
  return new Date(t).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
};

type CommentFilter = 'all' | 'unresolved' | 'resolved' | 'decision';

/* ── Sidebar-byggesteiner ──────────────────────────────────────────────── */
const MetaRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ py: 0.4 }}>
    <Box sx={{ color: FAINT, display: 'flex', '& svg': { fontSize: 16 } }}>{icon}</Box>
    <Typography sx={{ color: MUTED, fontSize: '0.8rem', flex: 1 }}>{label}</Typography>
    <Typography sx={{ color: TEXT, fontSize: '0.8rem', fontWeight: 600 }}>{value}</Typography>
  </Stack>
);
const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <Stack direction="row" alignItems="center" spacing={1.5} onClick={onClick}
    sx={{
      px: 1.5, py: 1, borderRadius: '10px', cursor: 'pointer', position: 'relative',
      bgcolor: active ? 'rgba(255,107,53,0.12)' : 'transparent', color: active ? ACCENT : MUTED,
      '&:hover': { bgcolor: active ? 'rgba(255,107,53,0.16)' : 'rgba(255,255,255,0.04)', color: active ? ACCENT : TEXT },
      '& svg': { fontSize: 19 },
      ...(active ? { '&::before': { content: '""', position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3, bgcolor: ACCENT } } : {}),
    }}>
    {icon}<Typography sx={{ fontSize: '0.86rem', fontWeight: active ? 700 : 500 }}>{label}</Typography>
  </Stack>
);

export default function AudioShowcasePage() {
  const params = useParams() as { projectId?: string };
  const projectId = params.projectId || '';

  const [project, setProject] = React.useState<any>(null);
  const [versions, setVersions] = React.useState<any[]>([]);
  const [members, setMembers] = React.useState<any[]>([]);
  const [tasks, setTasks] = React.useState<any[]>([]);
  const [currentVid, setCurrentVid] = React.useState('');
  const [detail, setDetail] = React.useState<{ comments: any[]; sections: any[]; approvals: any[] }>({ comments: [], sections: [], approvals: [] });
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [filter, setFilter] = React.useState<CommentFilter>('all');
  const [draft, setDraft] = React.useState('');
  const [replyTo, setReplyTo] = React.useState<any>(null);
  const [newTitle, setNewTitle] = React.useState('');
  const [newBand, setNewBand] = React.useState('');
  // dialoger
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [moreEl, setMoreEl] = React.useState<null | HTMLElement>(null);
  const [easeverseTrack, setEaseverseTrack] = React.useState<any>(null);
  const [lyricsOpen, setLyricsOpen] = React.useState(false);
  const [composerSection, setComposerSection] = React.useState<string | null>(null);
  const [sectionMenuEl, setSectionMenuEl] = React.useState<null | HTMLElement>(null);
  const [memberDialog, setMemberDialog] = React.useState<any>(null);
  const [splitOpen, setSplitOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [splitToast, setSplitToast] = React.useState<string | null>(null);

  const saveCover = async (dataUrl: string) => {
    try { const p = await apiRequest(`/api/audio-showcases/${projectId}`, { method: 'PATCH', body: { coverUrl: dataUrl } }); setProject(p); } catch { /* */ }
  };
  const generateSplitSheet = async () => {
    setSplitToast('Genererer splittark…');
    try { const r = await apiRequest(`/api/audio-showcases/${projectId}/split-sheet`, { method: 'POST', body: {} }); setSplitToast(r.created ? `Splittark opprettet (${r.contributors} parter)` : 'Åpner eksisterende splittark'); if (r.url) window.open(r.url, '_blank'); }
    catch { setSplitToast('Kunne ikke generere splittark'); }
    setTimeout(() => setSplitToast(null), 3500);
  };
  const pullSections = async () => {
    if (!currentVid) return;
    try { const r = await apiRequest(`/api/audio-versions/${currentVid}/pull-sections`, { method: 'POST', body: {} }); if (r?.applied === 'pulled') await loadVersion(currentVid); } catch { /* */ }
  };
  const pullTakes = async () => {
    try { const r = await apiRequest(`/api/audio-showcases/${projectId}/pull-takes`, { method: 'POST', body: {} }); if (r?.created > 0) await loadProject(); } catch { /* */ }
  };
  const saveMemberProfile = async (id: string, patch: Record<string, string>) => {
    const updated = await apiRequest(`/api/audio-members/${id}`, { method: 'PATCH', body: patch });
    setMembers((p) => p.map((x) => (x.id === id ? updated : x)));
    setMemberDialog(updated);
  };

  /* ── Datahenting ── */
  const loadProject = React.useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    try {
      const d = await apiRequest(`/api/audio-showcases/${projectId}`);
      setProject(d.project); setVersions(d.versions || []); setMembers(d.members || []); setTasks(d.tasks || []); setEaseverseTrack(d.easeverseTrack || null);
      const cur = (d.versions || []).find((v: any) => v.status !== 'superseded') || (d.versions || [])[(d.versions || []).length - 1];
      setCurrentVid((prev) => prev || cur?.id || '');
    } catch { /* not found */ } finally { setLoading(false); }
  }, [projectId]);
  const loadVersion = React.useCallback(async (vid: string) => {
    if (!vid) return;
    try { const d = await apiRequest(`/api/audio-versions/${vid}`); setDetail({ comments: d.comments || [], sections: d.sections || [], approvals: d.approvals || [] }); }
    catch { /* ignore */ }
  }, []);
  React.useEffect(() => { void loadProject(); }, [loadProject]);
  React.useEffect(() => { void loadVersion(currentVid); }, [currentVid, loadVersion]);
  // «Now on Spotify»: hvis rommet har en utgivelse som er live, vis embed i senter.
  const [spotifyLive, setSpotifyLive] = React.useState<any>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiRequest(`/api/audio-showcases/${projectId}/release`);
        const rel = r?.release; if (!rel || (!rel.isrc && !rel.upc)) return;
        const st = await apiRequest(`/api/releases/${rel.id}/spotify-status`);
        if (!cancelled && st?.live) { setSpotifyLive(st); audioShowcaseEvents.nowOnSpotifyShown(); }
      } catch { /* */ }
    })();
    return () => { cancelled = true; };
  }, [projectId, publishOpen]);
  // Sanntid: poll gjeldende versjon hvert 5. sek så nye kommentarer/seksjoner fra
  // andre anmeldere dukker opp live (uten å forstyrre lokal skriving/avspilling).
  React.useEffect(() => {
    if (!currentVid) return;
    const t = setInterval(() => { void loadVersion(currentVid); }, 5000);
    return () => clearInterval(t);
  }, [currentVid, loadVersion]);

  const currentVersion = versions.find((v) => v.id === currentVid);
  const prevVersion = React.useMemo(() => {
    if (!currentVersion) return null;
    return [...versions].filter((v) => v.version_number < currentVersion.version_number).sort((a, b) => b.version_number - a.version_number)[0] || null;
  }, [versions, currentVersion]);

  /* ── Wavesurfer ── */
  const waveRef = React.useRef<HTMLDivElement | null>(null);
  const wsRef = React.useRef<WaveSurfer | null>(null);
  const [ready, setReady] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [cur, setCur] = React.useState(0);
  const [dur, setDur] = React.useState(0);
  const [vol, setVol] = React.useState(0.8);
  const [loopOn, setLoopOn] = React.useState(false);
  const [abActive, setAbActive] = React.useState(false);
  const loopRef = React.useRef(loopOn); loopRef.current = loopOn;
  const effectiveSrc = (abActive && prevVersion ? prevVersion.file_url : currentVersion?.file_url) || '';
  const fracRef = React.useRef(0);

  React.useEffect(() => {
    if (!waveRef.current || !effectiveSrc) return;
    let cancelled = false;
    setReady(false);
    const ws = WaveSurfer.create({
      container: waveRef.current, url: effectiveSrc, height: 96,
      waveColor: 'rgba(245,242,234,0.22)', progressColor: ACCENT, cursorColor: 'rgba(245,242,234,0.85)',
      cursorWidth: 2, barWidth: 2, barGap: 1, barRadius: 3, normalize: true,
    });
    wsRef.current = ws;
    ws.on('ready', () => { if (cancelled) return; setReady(true); setDur(ws.getDuration()); ws.setVolume(vol); if (fracRef.current > 0) ws.setTime(fracRef.current * ws.getDuration()); });
    ws.on('timeupdate', (t: number) => { if (!cancelled) { setCur(t); if (ws.getDuration()) fracRef.current = t / ws.getDuration(); } });
    ws.on('play', () => !cancelled && setPlaying(true));
    ws.on('pause', () => !cancelled && setPlaying(false));
    ws.on('finish', () => { if (cancelled) return; if (loopRef.current) { ws.setTime(0); void ws.play(); } else setPlaying(false); });
    return () => { cancelled = true; try { ws.destroy(); } catch { /* ignore */ } wsRef.current = null; };
  }, [effectiveSrc]); // eslint-disable-line react-hooks/exhaustive-deps
  const seekFrac = (f: number) => { const ws = wsRef.current; if (ws && dur) ws.setTime(Math.max(0, Math.min(1, f)) * dur); };

  /* ── Mutasjoner (alle wired) ── */
  const addComment = async (body: string, opts: { parentId?: string; sectionRef?: string | null } = {}) => {
    if (!currentVid || !body.trim()) return;
    const me = members.find((m) => m.is_owner);
    const c = await apiRequest('/api/audio-comments', { method: 'POST', body: { versionId: currentVid, timecodeSeconds: Math.floor(cur), body, author: me?.name, authorRole: me?.role, parentCommentId: opts.parentId, sectionRef: opts.sectionRef ?? composerSection } });
    setDetail((p) => ({ ...p, comments: [...p.comments, c] }));
    setComposerSection(null);
  };
  // Tekst-seksjoner fra koblet track → kan refereres i kommentarer.
  const lyricSectionLabels = React.useMemo(() => {
    const secs = parseSongSections(easeverseTrack?.lyrics || '');
    return Array.from(new Set(secs.map((s) => s.nbLabel)));
  }, [easeverseTrack]);
  const setCommentStatus = async (id: string, status: string) => {
    const c = await apiRequest(`/api/audio-comments/${id}`, { method: 'PATCH', body: { status } });
    setDetail((p) => ({ ...p, comments: p.comments.map((x) => (x.id === id ? c : x)) }));
  };
  const likeComment = async (id: string) => {
    const c = await apiRequest(`/api/audio-comments/${id}/like`, { method: 'POST', body: {} });
    setDetail((p) => ({ ...p, comments: p.comments.map((x) => (x.id === id ? c : x)) }));
  };
  const approve = async (approvalType: string) => {
    if (!currentVid) return; setBusy(true);
    try { await apiRequest(`/api/audio-versions/${currentVid}/approve`, { method: 'POST', body: { approvalType } }); await loadProject(); await loadVersion(currentVid); }
    finally { setBusy(false); }
  };
  const versionFileRef = React.useRef<HTMLInputElement | null>(null);
  const [uploadPct, setUploadPct] = React.useState<number | null>(null);
  const uploadVersion = () => versionFileRef.current?.click();
  const uploadVersionFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true); setUploadPct(0);
    try {
      // Ekte fil-opplasting → backend lagrer + serverer same-origin (waveform-vennlig).
      const fd = new FormData(); fd.append('file', file);
      const headers = await getAuthHeader(); delete (headers as any)['Content-Type'];
      const url: string = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload/audio');
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v as string));
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => { try { const j = JSON.parse(xhr.responseText); j?.url ? resolve(j.url) : reject(new Error('no url')); } catch { reject(new Error('bad response')); } };
        xhr.onerror = () => reject(new Error('upload failed'));
        xhr.send(fd);
      });
      const v = await apiRequest('/api/audio-versions', { method: 'POST', body: { projectId, fileUrl: url, fileName: file.name } });
      audioShowcaseEvents.versionUploaded({ sizeBytes: file.size });
      await loadProject(); setCurrentVid(v.id);
    } catch { /* ignore */ } finally { setBusy(false); setUploadPct(null); }
  };
  const toggleTask = async (t: any) => {
    const next = t.status === 'done' ? 'todo' : 'done';
    const updated = await apiRequest(`/api/audio-tasks/${t.id}`, { method: 'PATCH', body: { status: next } });
    setTasks((p) => p.map((x) => (x.id === t.id ? updated : x)));
  };
  const createProject = async () => {
    if (!newTitle.trim()) return; setBusy(true);
    try { const p = await apiRequest('/api/audio-showcases', { method: 'POST', body: { title: newTitle.trim(), bandName: newBand.trim() || null } }); audioShowcaseEvents.projectCreated({ hasBand: !!newBand.trim() }); window.location.href = `/audio-review/${p.id}`; }
    finally { setBusy(false); }
  };

  /* ── Opprett-skjema ── */
  if (!projectId) {
    return (
      <Box sx={{ bgcolor: BG, minHeight: '100vh', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '16px', p: 3, maxWidth: 460, width: '100%' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}><MusicNote sx={{ color: ACCENT }} /><Typography sx={{ fontWeight: 800, fontSize: '1.2rem' }}>Nytt mix/master-review</Typography></Stack>
          <Stack spacing={1.5}>
            <TextField label="Tittel" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} size="small" sx={fieldSx} />
            <TextField label="Band / artist (valgfritt)" value={newBand} onChange={(e) => setNewBand(e.target.value)} size="small" sx={fieldSx} />
            <Button onClick={createProject} disabled={busy || !newTitle.trim()} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>{busy ? 'Oppretter…' : 'Opprett review-rom'}</Button>
          </Stack>
        </Box>
      </Box>
    );
  }
  if (loading) return <Box sx={{ bgcolor: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  if (!project) return <Box sx={{ bgcolor: BG, minHeight: '100vh', color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Fant ikke review-rommet.</Box>;

  const owner = members.find((m) => m.is_owner);
  const metaLine = [project.band_name && `Band: ${project.band_name}`, owner && `Produsent: ${owner.name}`, project.deadline && `Frist: ${new Date(project.deadline).toLocaleDateString('no-NO', { weekday: 'long' })}`].filter(Boolean);
  const counts = {
    all: detail.comments.length,
    unresolved: detail.comments.filter((c) => c.status === 'unresolved').length,
    resolved: detail.comments.filter((c) => c.status === 'resolved').length,
    decision: detail.comments.filter((c) => c.is_decision).length,
  };
  const visibleComments = detail.comments.filter((c) => filter === 'all' ? true : filter === 'decision' ? c.is_decision : c.status === filter);
  // Tasks gruppert etter assignee/kategori (slik mockupens panel viser «Vokal 3 tasks»).
  const taskGroups = Object.entries(tasks.reduce((m: Record<string, any[]>, t) => { const k = t.assignee || 'Generelt'; (m[k] = m[k] || []).push(t); return m; }, {}));
  const specsLine = currentVersion ? [currentVersion.sample_rate && `${(currentVersion.sample_rate / 1000).toFixed(0)} kHz`, currentVersion.bit_depth && `${currentVersion.bit_depth} bit`, currentVersion.channels === 2 ? 'Stereo' : currentVersion.channels === 1 ? 'Mono' : null].filter(Boolean).join('  ·  ') : '';

  return (
    <Box sx={{ bgcolor: BG, height: '100vh', color: TEXT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ═══ TOPBAR ═══ */}
      <Stack direction="row" alignItems="center" sx={{ px: 2.5, height: 60, borderBottom: `1px solid ${BORDER}`, flexShrink: 0, gap: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 260 }}>
          <Box sx={{ width: 30, height: 30, borderRadius: '8px', bgcolor: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: 'polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)' }}><GraphicEq sx={{ fontSize: 18, color: '#150d05' }} /></Box>
          <Typography sx={{ fontWeight: 800, letterSpacing: 0.5, fontSize: '0.95rem' }}>CREATORHUB</Typography>
          <Divider orientation="vertical" flexItem sx={{ borderColor: BORDER, mx: 0.5 }} />
          <Typography sx={{ color: MUTED, fontSize: '0.9rem' }}>Universal Showcase</Typography>
        </Stack>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>{project.title}</Typography>
            <Chip label={(project.status || 'draft').replace('_', ' ')} size="small" icon={<FiberManualRecord sx={{ fontSize: '8px !important', color: `${ACCENT} !important` }} />}
              sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize', color: ACCENT, bgcolor: 'transparent', border: `1px solid ${ACCENT}66` }} />
          </Stack>
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ mt: 0.2 }}>
            {metaLine.map((m, i) => (<React.Fragment key={i}>{i > 0 && <FiberManualRecord sx={{ fontSize: 5, color: ACCENT }} />}<Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>{m}</Typography></React.Fragment>))}
          </Stack>
        </Box>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 260, justifyContent: 'flex-end' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '999px', px: 1.5, py: 0.6 }}>
            <Search sx={{ fontSize: 17, color: FAINT }} /><InputBase placeholder="Søk i prosjektet" sx={{ color: TEXT, fontSize: '0.8rem', width: 130 }} />
            <Box sx={{ px: 0.6, py: 0.1, borderRadius: '5px', bgcolor: 'rgba(255,255,255,0.06)', color: FAINT, fontSize: '0.66rem' }}>⌘K</Box>
          </Stack>
          <IconButton size="small" sx={{ color: MUTED }}><NotificationsNone fontSize="small" /></IconButton>
          <IconButton size="small" sx={{ color: MUTED }}><HelpOutline fontSize="small" /></IconButton>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ pl: 0.5 }}>
            <Avatar sx={{ width: 30, height: 30, bgcolor: ACCENT, color: '#150d05', fontSize: '0.8rem', fontWeight: 700 }}>{initial(owner?.name)}</Avatar>
            <Box sx={{ textAlign: 'left' }}><Typography sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1 }}>{owner?.name || 'Eier'}</Typography><Typography sx={{ fontSize: '0.68rem', color: MUTED }}>{owner?.role || 'Produsent'}</Typography></Box>
            <KeyboardArrowDown sx={{ fontSize: 18, color: MUTED }} />
          </Stack>
        </Stack>
      </Stack>

      {/* ═══ BODY (3 kolonner) ═══ */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ─── VENSTRE SIDEBAR ─── */}
        <Box sx={{ width: 260, flexShrink: 0, borderRight: `1px solid ${BORDER}`, bgcolor: PANEL2, overflowY: 'auto', p: 2 }}>
          <Box sx={{ position: 'relative', mb: 1.5 }}>
            <ImageDrop variant="cover" value={project.cover_url} onChange={saveCover} />
            <Box sx={{ position: 'absolute', bottom: 10, left: 12, right: 12, pointerEvents: 'none' }}>
              <Typography sx={{ fontSize: '0.62rem', letterSpacing: 2, color: 'rgba(255,255,255,0.7)' }}>{(project.band_name || '').toUpperCase()}</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.05 }}>{project.title}</Typography>
            </Box>
          </Box>
          <Stack direction="row" alignItems="center" sx={{ mb: 1 }}><Typography sx={{ fontWeight: 700, flex: 1 }}>{project.title}</Typography><IconButton size="small" onClick={(e) => setMoreEl(e.currentTarget)} sx={{ color: MUTED }}><MoreHoriz fontSize="small" /></IconButton></Stack>

          <Box sx={{ mb: 1 }}>
            <MetaRow icon={<Speed />} label="BPM" value={project.bpm ?? '—'} />
            <MetaRow icon={<VpnKey />} label="Toneart" value={project.musical_key ?? '—'} />
            <MetaRow icon={<CategoryOutlined />} label="Type" value="Mix Review" />
            <Divider sx={{ borderColor: BORDER, my: 0.75 }} />
            <MetaRow icon={<StyleOutlined />} label="Sjanger" value={project.genre ?? '—'} />
            <MetaRow icon={<Schedule />} label="Lengde" value={dur ? fmt(dur) : '—'} />
            <MetaRow icon={<CalendarTodayOutlined />} label="Opprettet" value={project.created_at ? new Date(project.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
          </Box>
          <Divider sx={{ borderColor: BORDER, my: 1 }} />
          <Stack spacing={0.25} sx={{ mb: 1 }}>
            <NavItem icon={<GridViewOutlined />} label="Oversikt" />
            <NavItem icon={<GraphicEq />} label="Audio Showcase" active />
            <NavItem icon={<LayersOutlined />} label="Versjoner" />
            <NavItem icon={<Inventory2Outlined />} label="Leveranser" />
            <NavItem icon={<SubjectOutlined />} label="Tekster" active={lyricsOpen} onClick={() => setLyricsOpen(true)} />
            <NavItem icon={<StickyNote2Outlined />} label="Notater" />
            <NavItem icon={<TimelineOutlined />} label="Aktivitet" />
          </Stack>
          <Divider sx={{ borderColor: BORDER, my: 1 }} />
          <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: '0.72rem', letterSpacing: 1, color: FAINT, flex: 1, textTransform: 'uppercase' }}>Prosjektmedlemmer</Typography>
            <Button size="small" startIcon={<Add sx={{ fontSize: '16px !important' }} />} onClick={() => setInviteOpen(true)} sx={{ color: ACCENT, textTransform: 'none', fontSize: '0.75rem', minWidth: 0 }}>Inviter</Button>
          </Stack>
          <Stack spacing={0.5}>
            {members.map((m) => (
              <Stack key={m.id} direction="row" alignItems="center" spacing={1.25} onClick={() => setMemberDialog(m)}
                sx={{ px: 0.75, py: 0.5, mx: -0.75, borderRadius: '8px', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                <Avatar src={m.avatar_url || undefined} sx={{ width: 28, height: 28, fontSize: '0.72rem', bgcolor: m.avatar_color || ACCENT, color: '#150d05', fontWeight: 700 }}>{!m.avatar_url && initial(m.name)}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}><Stack direction="row" alignItems="center" spacing={0.5}><Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }} noWrap>{m.name}</Typography>{m.is_owner && <WorkspacePremium sx={{ fontSize: 14, color: ACCENT }} />}</Stack><Typography sx={{ fontSize: '0.7rem', color: MUTED }} noWrap>{[m.role, m.instrument].filter(Boolean).join(' · ') || 'Bidragsyter'}</Typography></Box>
                {m.invite_status === 'pending' && <Chip label="Venter" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(224,169,85,0.16)', color: '#e0a955' }} />}
              </Stack>
            ))}
            {members.length === 0 && <Typography sx={{ fontSize: '0.78rem', color: FAINT }}>Ingen medlemmer ennå.</Typography>}
          </Stack>
          {members.length > 0 && (
            <Button onClick={() => setSplitOpen(true)} fullWidth startIcon={<ReceiptLongOutlined sx={{ fontSize: '17px !important' }} />}
              sx={{ mt: 1.5, color: ACCENT, bgcolor: 'rgba(255,107,53,0.1)', textTransform: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '0.78rem', '&:hover': { bgcolor: 'rgba(255,107,53,0.18)' } }}>Splittark (royalty)</Button>
          )}
          <Button onClick={() => setPublishOpen(true)} fullWidth startIcon={<RocketLaunchOutlined sx={{ fontSize: '17px !important' }} />}
            sx={{ mt: 1, color: '#150d05', bgcolor: ACCENT, textTransform: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '0.78rem', '&:hover': { bgcolor: '#ff855a' } }}>Publiser utgivelse</Button>
        </Box>

        {/* ─── SENTER ─── */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, minWidth: 0 }}>
          {/* «Now on Spotify» — vises kun når utgivelsen er verifisert live */}
          {spotifyLive?.live && (() => { const e = spotifyLive.track || spotifyLive.album; return (
            <Box sx={{ bgcolor: 'rgba(29,185,84,0.07)', border: '1px solid rgba(29,185,84,0.3)', borderRadius: '16px', p: 2, mb: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
                <MusicNote sx={{ fontSize: 18, color: '#1DB954' }} />
                <Typography sx={{ fontWeight: 700, flex: 1 }}>Nå på Spotify</Typography>
                <Button href={e.url} target="_blank" size="small" sx={{ color: '#1DB954', textTransform: 'none' }}>Åpne</Button>
              </Stack>
              <Box component="iframe" title="Spotify-utgivelse" src={e.embedUrl} sx={{ width: '100%', height: spotifyLive.track ? 152 : 352, border: 0, borderRadius: '12px' }} allow="encrypted-media" loading="lazy" />
            </Box>
          ); })()}
          {/* Track-header + waveform */}
          <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '16px', p: 2.5, mb: 2.5 }}>
            <Stack direction="row" alignItems="flex-start" sx={{ mb: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: 'rgba(255,107,53,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1.5 }}><MusicNote sx={{ color: ACCENT }} /></Box>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}><Typography sx={{ fontWeight: 700 }}>{currentVersion ? `${project.title} – ${currentVersion.version_label}` : project.title}{currentVersion?.file_name ? '' : '.wav'}</Typography><KeyboardArrowDown sx={{ fontSize: 18, color: MUTED }} /></Stack>
                <Typography sx={{ color: MUTED, fontSize: '0.76rem' }}>{specsLine || '—'}{abActive && prevVersion ? `   ·   A/B: ${prevVersion.version_label}` : ''}</Typography>
              </Box>
              {easeverseTrack && <Button startIcon={<CloudUpload />} size="small" onClick={pullTakes} variant="outlined" sx={{ color: TEXT, borderColor: BORDER, textTransform: 'none', borderRadius: '8px', mr: 1 }}>Hent takes</Button>}
              {easeverseTrack && <Button startIcon={<GraphicEq />} size="small" onClick={pullSections} variant="outlined" sx={{ color: TEXT, borderColor: BORDER, textTransform: 'none', borderRadius: '8px', mr: 1 }}>Hent seksjoner</Button>}
              {currentVersion?.file_url && <Button startIcon={<FileDownloadOutlined />} size="small" href={currentVersion.file_url} target="_blank" variant="outlined" sx={{ color: TEXT, borderColor: BORDER, textTransform: 'none', borderRadius: '8px', mr: 1 }}>Last ned</Button>}
              <IconButton size="small" sx={{ color: MUTED }}><MoreHoriz fontSize="small" /></IconButton>
            </Stack>

            {/* Waveform + playhead-boble */}
            <Box sx={{ position: 'relative' }}>
              <Box ref={waveRef} sx={{ cursor: 'pointer' }} />
              {!ready && <Typography sx={{ position: 'absolute', top: 38, left: 0, right: 0, textAlign: 'center', color: FAINT, fontSize: '0.8rem' }}>Laster waveform…</Typography>}
              {ready && dur > 0 && (
                <Box sx={{ position: 'absolute', top: -8, transform: 'translateX(-50%)', left: `${(cur / dur) * 100}%`, bgcolor: ACCENT, color: '#150d05', fontSize: '0.68rem', fontWeight: 700, px: 0.7, py: 0.1, borderRadius: '5px', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>{fmt(cur)}</Box>
              )}
            </Box>

            {/* Tidslinjal */}
            <Box sx={{ position: 'relative', height: 16, mt: 0.5 }}>
              {dur > 0 && Array.from({ length: 9 }).map((_, i) => { const t = (dur / 8) * i; return (<Typography key={i} sx={{ position: 'absolute', left: `${(i / 8) * 100}%`, transform: i === 0 ? 'none' : i === 8 ? 'translateX(-100%)' : 'translateX(-50%)', fontSize: '0.66rem', color: FAINT, fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</Typography>); })}
            </Box>

            {/* Seksjonsbar */}
            {detail.sections.length > 0 && dur > 0 && (
              <Box sx={{ position: 'relative', height: 42, mt: 0.5 }}>
                <Box sx={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  {detail.sections.map((sec, i) => { const w = ((sec.end_time_seconds - sec.start_time_seconds) / dur) * 100; const color = sec.color || SECTION_COLORS[i % SECTION_COLORS.length]; return (<Tooltip key={sec.id} title={`${sec.name} · ${fmt(sec.start_time_seconds)}–${fmt(sec.end_time_seconds)}`}><Box onClick={() => seekFrac(sec.start_time_seconds / dur)} sx={{ width: `${w}%`, bgcolor: color, cursor: 'pointer', borderRight: '1px solid #0A0A0B', '&:hover': { filter: 'brightness(1.2)' } }} /></Tooltip>); })}
                </Box>
                <Box sx={{ position: 'relative', mt: 0.5 }}>
                  {detail.sections.map((sec, i) => { const left = (sec.start_time_seconds / dur) * 100; const color = sec.color || SECTION_COLORS[i % SECTION_COLORS.length]; return (<Box key={sec.id} sx={{ position: 'absolute', left: `${left}%`, maxWidth: '14%' }}><Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color, whiteSpace: 'nowrap' }}>{sec.name}</Typography><Typography sx={{ fontSize: '0.6rem', color: FAINT, whiteSpace: 'nowrap' }}>{fmt(sec.start_time_seconds)}–{fmt(sec.end_time_seconds)}</Typography></Box>); })}
                </Box>
              </Box>
            )}

            {/* Transport */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2.5 }}>
              <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.9rem', fontWeight: 600, minWidth: 96 }}>{fmt(cur)} <span style={{ color: FAINT }}>/ {fmt(dur)}</span></Typography>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                <IconButton onClick={() => setLoopOn((v) => !v)} sx={{ color: loopOn ? ACCENT : MUTED }}><LoopIcon /></IconButton>
                <IconButton onClick={() => seekFrac(Math.max(0, (cur - 10) / (dur || 1)))} sx={{ color: TEXT }}><SkipPrevious /></IconButton>
                <IconButton onClick={() => wsRef.current?.playPause()} disabled={!ready} sx={{ bgcolor: 'transparent', color: ACCENT, border: `2px solid ${ACCENT}`, width: 52, height: 52, '&:hover': { bgcolor: 'rgba(255,107,53,0.12)' }, '&.Mui-disabled': { borderColor: BORDER, color: FAINT } }}>{playing ? <Pause sx={{ fontSize: 28 }} /> : <PlayArrow sx={{ fontSize: 28 }} />}</IconButton>
                <IconButton onClick={() => seekFrac(Math.min(1, (cur + 10) / (dur || 1)))} sx={{ color: TEXT }}><SkipNext /></IconButton>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 110 }}>
                  <VolumeUp sx={{ fontSize: 18, color: MUTED }} />
                  <Slider size="small" value={vol} min={0} max={1} step={0.01} onChange={(_, v) => { setVol(v as number); wsRef.current?.setVolume(v as number); }} sx={{ color: ACCENT, '& .MuiSlider-thumb': { width: 11, height: 11 } }} />
                </Stack>
              </Box>
              <Button onClick={() => setLoopOn((v) => !v)} startIcon={<LoopIcon sx={{ fontSize: '18px !important' }} />} variant="outlined" size="small" sx={{ color: loopOn ? ACCENT : TEXT, borderColor: loopOn ? ACCENT : BORDER, textTransform: 'none', borderRadius: '8px' }}>Loop</Button>
              <Tooltip title={prevVersion ? `Sammenlign med ${prevVersion.version_label}` : 'Ingen tidligere versjon'}>
                <span><Button onClick={() => setAbActive((v) => !v)} disabled={!prevVersion} startIcon={<CompareArrows sx={{ fontSize: '18px !important' }} />} variant="outlined" size="small" sx={{ color: abActive ? ACCENT : TEXT, borderColor: abActive ? ACCENT : BORDER, textTransform: 'none', borderRadius: '8px', lineHeight: 1.1 }}>A / B<br />Compare</Button></span>
              </Tooltip>
            </Stack>
          </Box>

          {/* Versjoner + Tasks */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.7fr 1fr' }, gap: 2.5 }}>
            {/* Versjoner */}
            <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '16px', p: 2.5 }}>
              <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}><Typography sx={{ fontWeight: 700, flex: 1 }}>Versjoner</Typography><Typography sx={{ color: ACCENT, fontSize: '0.78rem', cursor: 'pointer' }}>Se alle</Typography></Stack>
              <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: BORDER, borderRadius: 3 } }}>
                {versions.map((v) => {
                  const active = v.id === currentVid;
                  const statusLabel = v.status === 'approved' ? 'Godkjent' : v.status === 'superseded' ? 'Erstattet' : 'Til vurdering';
                  const statusColor = v.status === 'approved' ? '#5fb88a' : v.status === 'superseded' ? FAINT : '#e0a955';
                  const cCount = detail.comments.length && active ? detail.comments.length : (v.comment_count ?? null);
                  return (
                    <Box key={v.id} onClick={() => { setAbActive(false); setCurrentVid(v.id); }} sx={{ flexShrink: 0, width: 180, p: 1.5, borderRadius: '12px', cursor: 'pointer', border: `1.5px solid ${active ? ACCENT : BORDER}`, bgcolor: active ? 'rgba(255,107,53,0.06)' : 'transparent' }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}><Typography sx={{ fontWeight: 700, fontSize: '0.88rem' }}>{v.version_label}</Typography>{active && <Chip label="Aktiv" size="small" sx={{ height: 17, fontSize: '0.62rem', bgcolor: ACCENT, color: '#150d05', fontWeight: 700 }} />}{v.status === 'approved' && <CheckCircle sx={{ fontSize: 15, color: '#5fb88a' }} />}</Stack>
                      <Typography sx={{ fontSize: '0.68rem', color: MUTED, mb: 1 }}>{v.created_at ? new Date(v.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</Typography>
                      <Box sx={{ height: 30, borderRadius: '6px', mb: 1, background: active ? 'repeating-linear-gradient(90deg,#FF6B35 0 2px,transparent 2px 4px)' : 'repeating-linear-gradient(90deg,rgba(245,242,234,0.25) 0 2px,transparent 2px 4px)', opacity: 0.8 }} />
                      <Stack direction="row" alignItems="center" justifyContent="space-between"><Stack direction="row" alignItems="center" spacing={0.5}><ChatBubbleOutline sx={{ fontSize: 13, color: MUTED }} /><Typography sx={{ fontSize: '0.7rem', color: MUTED }}>{cCount ?? 0}</Typography></Stack><Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: statusColor }}>{statusLabel}</Typography></Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            {/* Tasks (erstatter AI-panel — spec: oppgaver, ikke AI) */}
            <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '16px', p: 2.5, display: 'flex', flexDirection: 'column' }}>
              <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}><Typography sx={{ fontWeight: 700, flex: 1 }}>Oppgaver</Typography><Typography sx={{ fontSize: '0.66rem', color: MUTED }}>{tasks.filter((t) => t.status !== 'done').length} åpne</Typography></Stack>
              <Stack spacing={1} sx={{ flex: 1 }}>
                {taskGroups.map(([group, list]) => { const open = list.filter((t: any) => t.status !== 'done').length; const allDone = open === 0; return (
                  <Stack key={group} direction="row" alignItems="center" spacing={1.25} sx={{ py: 0.5 }}>
                    <Box sx={{ width: 26, height: 26, borderRadius: '7px', bgcolor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GraphicEq sx={{ fontSize: 15, color: ACCENT }} /></Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>{group}</Typography><Typography sx={{ fontSize: '0.7rem', color: MUTED }}>{list.length} oppgaver</Typography></Box>
                    {allDone ? <CheckCircle sx={{ fontSize: 18, color: '#5fb88a' }} /> : <Box sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: '999px', bgcolor: 'rgba(255,107,53,0.18)', color: ACCENT, fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{open}</Box>}
                  </Stack>
                ); })}
                {taskGroups.length === 0 && <Typography sx={{ fontSize: '0.78rem', color: FAINT, py: 1 }}>Ingen oppgaver ennå. Gjør feedback om til konkrete oppgaver.</Typography>}
              </Stack>
              <Button onClick={() => setTaskOpen(true)} startIcon={<Add />} fullWidth sx={{ mt: 1.5, color: ACCENT, bgcolor: 'rgba(255,107,53,0.1)', textTransform: 'none', borderRadius: '10px', fontWeight: 700, '&:hover': { bgcolor: 'rgba(255,107,53,0.18)' } }}>Ny oppgave</Button>
            </Box>
          </Box>
        </Box>

        {/* ─── HØYRE: KOMMENTARER ─── */}
        <Box sx={{ width: 372, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, bgcolor: PANEL2, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Stack direction="row" spacing={2} sx={{ px: 2.5, pt: 2, borderBottom: `1px solid ${BORDER}` }}>
            {([['all', 'Alle'], ['unresolved', 'Uløst'], ['resolved', 'Løst'], ['decision', 'Beslutninger']] as [CommentFilter, string][]).map(([k, lbl]) => (
              <Box key={k} onClick={() => setFilter(k)} sx={{ pb: 1.25, cursor: 'pointer', borderBottom: `2px solid ${filter === k ? ACCENT : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: filter === k ? 700 : 500, color: filter === k ? TEXT : MUTED }}>{lbl}</Typography>
                {counts[k] > 0 && <Box sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: '999px', bgcolor: filter === k ? ACCENT : 'rgba(255,255,255,0.08)', color: filter === k ? '#150d05' : MUTED, fontSize: '0.66rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{counts[k]}</Box>}
              </Box>
            ))}
          </Stack>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {visibleComments.length === 0 && <Typography sx={{ p: 2.5, color: FAINT, fontSize: '0.84rem' }}>Ingen kommentarer i dette filteret.</Typography>}
            {visibleComments.map((c) => {
              const mem = members.find((m) => m.name === c.author);
              const color = mem?.avatar_color || ACCENT;
              const resolved = c.status === 'resolved';
              return (
                <Box key={c.id} sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Stack direction="row" spacing={1.5}>
                    <Box sx={{ pt: 0.25 }}><Typography sx={{ fontSize: '0.68rem', color: ACCENT, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(c.timecode_seconds))}</Typography></Box>
                    <Avatar sx={{ width: 30, height: 30, fontSize: '0.76rem', bgcolor: color, color: '#150d05', fontWeight: 700 }}>{initial(c.author)}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{c.author}{c.author_role ? ` (${c.author_role})` : ''}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: FAINT }}>{relTime(c.created_at)}</Typography>
                        {c.section_ref && <Chip label={`↳ ${c.section_ref}`} size="small" sx={{ height: 18, fontSize: '0.64rem', fontWeight: 700, bgcolor: 'rgba(255,107,53,0.16)', color: ACCENT }} />}
                        <Box sx={{ flex: 1 }} /><IconButton size="small" sx={{ color: FAINT, p: 0.25 }}><MoreHoriz sx={{ fontSize: 16 }} /></IconButton>
                      </Stack>
                      <Typography sx={{ fontSize: '0.86rem', color: 'rgba(245,242,234,0.9)', mt: 0.4 }}>{c.body}</Typography>
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: 0.75 }}>
                        <Typography onClick={() => { setReplyTo(c); }} sx={{ fontSize: '0.74rem', color: MUTED, cursor: 'pointer', '&:hover': { color: TEXT } }}>Svar</Typography>
                        <Stack direction="row" alignItems="center" spacing={0.4} onClick={() => void likeComment(c.id)} sx={{ cursor: 'pointer', color: c.like_count > 0 ? ACCENT : FAINT, '&:hover': { color: ACCENT } }}>
                          {c.like_count > 0 ? <ThumbUpAlt sx={{ fontSize: 14 }} /> : <ThumbUpAltOutlined sx={{ fontSize: 14 }} />}{c.like_count > 0 && <Typography sx={{ fontSize: '0.72rem', fontWeight: 700 }}>{c.like_count}</Typography>}
                        </Stack>
                        <Box sx={{ flex: 1 }} />
                        <Chip onClick={() => void setCommentStatus(c.id, resolved ? 'unresolved' : 'resolved')} size="small"
                          icon={resolved ? <CheckCircle sx={{ fontSize: '13px !important' }} /> : <KeyboardArrowDown sx={{ fontSize: '13px !important' }} />}
                          label={resolved ? 'Løst' : 'Uløst'}
                          sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', color: resolved ? '#5fb88a' : '#e0a955', bgcolor: resolved ? 'rgba(95,184,138,0.14)' : 'rgba(224,169,85,0.14)', border: `1px solid ${resolved ? 'rgba(95,184,138,0.4)' : 'rgba(224,169,85,0.4)'}`, '& .MuiChip-icon': { color: resolved ? '#5fb88a' : '#e0a955' } }} />
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Box>
          {replyTo && <Box sx={{ px: 2.5, py: 0.75, bgcolor: 'rgba(255,107,53,0.08)', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 1 }}><Typography sx={{ fontSize: '0.74rem', color: MUTED, flex: 1 }}>Svarer {replyTo.author}</Typography><Typography onClick={() => setReplyTo(null)} sx={{ fontSize: '0.74rem', color: ACCENT, cursor: 'pointer' }}>Avbryt</Typography></Box>}
          <Box sx={{ p: 2, borderTop: `1px solid ${BORDER}` }}>
            {lyricSectionLabels.length > 0 && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Chip size="small" icon={<SubjectOutlined sx={{ fontSize: '14px !important' }} />} label={composerSection ? `Refererer: ${composerSection}` : 'Knytt til tekst-seksjon'}
                  onClick={(e) => setSectionMenuEl(e.currentTarget)} onDelete={composerSection ? () => setComposerSection(null) : undefined}
                  sx={{ height: 24, fontSize: '0.7rem', cursor: 'pointer', color: composerSection ? ACCENT : MUTED, bgcolor: composerSection ? 'rgba(255,107,53,0.14)' : 'rgba(255,255,255,0.05)', '& .MuiChip-icon': { color: composerSection ? ACCENT : MUTED } }} />
                <Menu anchorEl={sectionMenuEl} open={Boolean(sectionMenuEl)} onClose={() => setSectionMenuEl(null)}>
                  {lyricSectionLabels.map((lbl) => (
                    <MenuItem key={lbl} onClick={() => { setComposerSection(lbl); setSectionMenuEl(null); }} sx={{ fontSize: '0.82rem' }}>{lbl}</MenuItem>
                  ))}
                </Menu>
              </Stack>
            )}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Avatar sx={{ width: 30, height: 30, fontSize: '0.76rem', bgcolor: ACCENT, color: '#150d05', fontWeight: 700 }}>{initial(owner?.name)}</Avatar>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '999px', px: 1.5 }}>
                <InputBase fullWidth placeholder="Legg til en tidskodet kommentar…" value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { void addComment(draft.trim(), { parentId: replyTo?.id }); setDraft(''); setReplyTo(null); } }}
                  sx={{ color: TEXT, fontSize: '0.82rem', py: 0.75 }} />
                <Tooltip title={`Tidsstemple ved ${fmt(cur)}`}><AccessTime sx={{ fontSize: 17, color: FAINT }} /></Tooltip>
              </Box>
              <IconButton onClick={() => { if (draft.trim()) { void addComment(draft.trim(), { parentId: replyTo?.id }); setDraft(''); setReplyTo(null); } }} sx={{ bgcolor: ACCENT, color: '#150d05', '&:hover': { bgcolor: '#ff855a' } }}><Send sx={{ fontSize: 18 }} /></IconButton>
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* ═══ BUNN-ACTION-BAR ═══ */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 3, py: 1.5, borderTop: `1px solid ${BORDER}`, bgcolor: PANEL2, flexShrink: 0 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: '10px', bgcolor: 'rgba(255,107,53,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Box sx={{ width: 14, height: 14, bgcolor: ACCENT, transform: 'rotate(45deg)', borderRadius: '3px' }} /></Box>
        <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>Samarbeid. Forfin. Lever.</Typography><Typography sx={{ fontSize: '0.78rem', color: MUTED }}>All feedback, versjoner og beslutninger på ett sted.</Typography></Box>
        <Button onClick={() => approve('changes_requested')} disabled={busy || !currentVid} startIcon={<ChatBubbleOutline />} variant="outlined" sx={{ color: TEXT, borderColor: BORDER, textTransform: 'none', borderRadius: '10px', px: 2.5, py: 1 }}>Be om endringer</Button>
        <Button onClick={() => approve('mix_approved')} disabled={busy || !currentVid} startIcon={<CheckCircleOutline />} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '10px', px: 3, py: 1, '&:hover': { bgcolor: '#ff855a' } }}>Godkjenn mix</Button>
        <input ref={versionFileRef} type="file" accept="audio/*,.wav,.mp3,.aif,.aiff,.m4a,.flac" hidden onChange={(e) => { void uploadVersionFile(e.target.files?.[0]); e.target.value = ''; }} />
        <Button onClick={uploadVersion} disabled={busy} startIcon={uploadPct !== null ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : <CloudUpload />} variant="outlined" sx={{ color: TEXT, borderColor: BORDER, textTransform: 'none', borderRadius: '10px', px: 2.5, py: 1 }}>{uploadPct !== null ? `Laster opp… ${uploadPct}%` : 'Last opp ny versjon'}</Button>
      </Stack>

      {/* Dialoger */}
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onAdd={async (name, role, email) => { const m = await apiRequest(`/api/audio-showcases/${projectId}/members`, { method: 'POST', body: { name, role, email } }); audioShowcaseEvents.memberInvited({ method: email?.trim() ? 'email' : 'link' }); setMembers((p) => [...p, m]); return m; }} />
      <MemberProfileDialog member={memberDialog} externalTrackId={easeverseTrack?.id} onClose={() => setMemberDialog(null)} onSave={saveMemberProfile}
        onDelete={async (id) => { await apiRequest(`/api/audio-members/${id}`, { method: 'DELETE' }); setMembers((p) => p.filter((x) => x.id !== id)); setMemberDialog(null); }} />
      <SplitSheetDialog open={splitOpen} projectId={projectId} ownerName={owner?.name} onClose={() => setSplitOpen(false)} />
      <PublishDialog open={publishOpen} projectId={projectId} onClose={() => setPublishOpen(false)} />
      <TaskDialog open={taskOpen} onClose={() => setTaskOpen(false)} onAdd={async (title, category) => { const t = await apiRequest('/api/audio-tasks', { method: 'POST', body: { projectId, title, assignee: category, versionId: currentVid } }); setTasks((p) => [...p, t]); setTaskOpen(false); }} />
      <Menu anchorEl={moreEl} open={Boolean(moreEl)} onClose={() => setMoreEl(null)}><MenuItem onClick={() => setMoreEl(null)} sx={{ fontSize: '0.85rem' }}>Kopier review-lenke</MenuItem></Menu>
      <LyricsDialog
        open={lyricsOpen}
        onClose={() => setLyricsOpen(false)}
        projectId={projectId}
        track={easeverseTrack}
        onLyricsChange={(lyrics) => setEaseverseTrack((t: any) => (t ? { ...t, lyrics } : t))}
      />
    </Box>
  );
}

/* ── Dialoger ──────────────────────────────────────────────────────────── */
const InviteDialog: React.FC<{ open: boolean; onClose: () => void; onAdd: (name: string, role: string, email: string) => Promise<any> }> = ({ open, onClose, onAdd }) => {
  const [name, setName] = React.useState(''); const [role, setRole] = React.useState(''); const [email, setEmail] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<any>(null); const [copied, setCopied] = React.useState(false);
  const close = () => { setCreated(null); setName(''); setRole(''); setEmail(''); setCopied(false); onClose(); };
  const link = created?.inviteUrl ? `${window.location.origin}${created.inviteUrl}` : '';
  return (
    <Dialog open={open} onClose={close} PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px', minWidth: 380 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{created ? 'Inviter bidragsyter' : 'Inviter bidragsyter'}</DialogTitle>
      <DialogContent>
        {created ? (
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Typography sx={{ fontSize: '0.88rem' }}>Del denne lenken med <strong>{created.name}</strong> — de fyller ut profilen sin selv (navn, rolle, bidrag, profilbilde).</Typography>
            {created.emailed && <Stack direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 16, color: '#5fb88a' }} /><Typography sx={{ fontSize: '0.78rem', color: '#5fb88a' }}>Invitasjon sendt på e-post.</Typography></Stack>}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '10px', p: 1 }}>
              <Typography sx={{ flex: 1, fontSize: '0.74rem', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</Typography>
              <Button size="small" startIcon={copied ? <DoneAll /> : <ContentCopy />} onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} sx={{ color: ACCENT, textTransform: 'none' }}>{copied ? 'Kopiert' : 'Kopier'}</Button>
            </Stack>
            <Typography sx={{ fontSize: '0.7rem', color: FAINT }}>Profilen knyttes til review-rommet og splittark (royalty).</Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 0.5 }}><TextField autoFocus label="Navn" value={name} onChange={(e) => setName(e.target.value)} size="small" sx={fieldSx} /><TextField label="Rolle (f.eks. Vokalist)" value={role} onChange={(e) => setRole(e.target.value)} size="small" sx={fieldSx} /><TextField label="E-post (valgfritt — sender invitasjon)" value={email} onChange={(e) => setEmail(e.target.value)} size="small" sx={fieldSx} /></Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {created ? (
          <><Button onClick={() => setCreated(null)} sx={{ color: MUTED, textTransform: 'none' }}>Inviter en til</Button><Button onClick={close} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>Ferdig</Button></>
        ) : (
          <><Button onClick={close} sx={{ color: MUTED, textTransform: 'none' }}>Avbryt</Button><Button disabled={!name.trim() || busy} onClick={async () => { setBusy(true); try { const m = await onAdd(name.trim(), role.trim(), email.trim()); setCreated(m); setName(''); setRole(''); setEmail(''); } finally { setBusy(false); } }} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>{email.trim() ? 'Inviter på e-post' : 'Lag invitasjonslenke'}</Button></>
        )}
      </DialogActions>
    </Dialog>
  );
};

const MemberProfileDialog: React.FC<{ member: any; externalTrackId?: string; onClose: () => void; onSave: (id: string, patch: Record<string, any>) => Promise<void>; onDelete: (id: string) => Promise<void> }> = ({ member, externalTrackId, onClose, onSave, onDelete }) => {
  const [f, setF] = React.useState<any>({ links: {} });
  const [busy, setBusy] = React.useState(false); const [copied, setCopied] = React.useState(false); const [boothCopied, setBoothCopied] = React.useState(false);
  React.useEffect(() => { if (member) setF({ name: member.name || '', role: member.role || '', instrument: member.instrument || '', email: member.email || '', phone: member.phone || '', bio: member.bio || '', avatarUrl: member.avatar_url || '', easeverseAccess: Boolean(member.easeverse_access), links: (member.links && !Array.isArray(member.links)) ? member.links : {}, contributions: Array.isArray(member.contributions) ? member.contributions : [] }); }, [member]);
  if (!member) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p: any) => ({ ...p, [k]: e.target.value }));
  const setLink = (k: string, v: string) => setF((p: any) => ({ ...p, links: { ...p.links, [k]: v } }));
  const link = member.invite_token ? `${window.location.origin}/audio-review/invite/${member.invite_token}` : '';
  const isVocalist = /vokal/i.test(f.role || '');
  const boothUrl = externalTrackId ? `https://easeverse.vercel.app/booth/${externalTrackId}` : '';
  return (
    <Dialog open={Boolean(member)} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>Profil {member.is_owner && <WorkspacePremium sx={{ fontSize: 16, color: ACCENT }} />}
        {member.invite_status === 'pending' && <Chip label="Venter på utfylling" size="small" sx={{ height: 20, fontSize: '0.64rem', bgcolor: 'rgba(224,169,85,0.16)', color: '#e0a955' }} />}</DialogTitle>
      <DialogContent>
        <Stack alignItems="center" sx={{ mb: 1.5 }}>
          <ImageDrop variant="circle" size={88} value={f.avatarUrl} onChange={(url) => { setF((p: any) => ({ ...p, avatarUrl: url })); void onSave(member.id, { avatarUrl: url }); }} label="Profilbilde — slipp / velg" />
        </Stack>
        <Stack spacing={1.5}>
          <TextField label="Navn" value={f.name} onChange={set('name')} size="small" sx={fieldSx} />
          <Stack direction="row" spacing={1.5}><ComboField label="Rolle" options={ROLE_OPTIONS} value={f.role || ''} onChange={(v) => setF((p: any) => ({ ...p, role: v }))} /><ComboField label="Instrument" options={INSTRUMENT_OPTIONS} value={f.instrument || ''} onChange={(v) => setF((p: any) => ({ ...p, instrument: v }))} /></Stack>
          <MultiComboField label="Bidrag (hvem gjør hva)" options={CONTRIBUTION_OPTIONS} value={f.contributions || []} onChange={(v) => setF((p: any) => ({ ...p, contributions: v }))} />
          {isVocalist && (
            <Box sx={{ border: `1px solid rgba(255,107,53,0.4)`, borderRadius: '10px', p: 1.25, bgcolor: 'rgba(255,107,53,0.07)' }}>
              <FormControlLabel sx={{ m: 0 }}
                control={<Switch checked={Boolean(f.easeverseAccess)} onChange={(e) => { setF((p: any) => ({ ...p, easeverseAccess: e.target.checked })); void onSave(member.id, { easeverseAccess: e.target.checked }); }} sx={{ '& .Mui-checked': { color: ACCENT }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${ACCENT} !important` } }} />}
                label={<Stack direction="row" spacing={0.75} alignItems="center"><GraphicEq sx={{ fontSize: 16, color: ACCENT }} /><Typography sx={{ fontSize: '0.82rem' }}>Tilgang til EaseVerse (vokalopptak)</Typography></Stack>} />
              {f.easeverseAccess && boothUrl && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '8px', p: 0.6 }}>
                  <Typography sx={{ flex: 1, fontSize: '0.68rem', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{boothUrl}</Typography>
                  <Button size="small" startIcon={boothCopied ? <DoneAll /> : <ContentCopy />} onClick={() => { void navigator.clipboard.writeText(boothUrl); setBoothCopied(true); setTimeout(() => setBoothCopied(false), 1500); }} sx={{ color: ACCENT, textTransform: 'none', minWidth: 0 }}>{boothCopied ? 'Kopiert' : 'Booth'}</Button>
                </Stack>
              )}
            </Box>
          )}
          <TextField label="E-post" value={f.email} onChange={set('email')} size="small" sx={fieldSx} />
          <TextField label="Om" value={f.bio} onChange={set('bio')} size="small" multiline minRows={2} sx={fieldSx} />
          <Typography sx={{ fontSize: '0.66rem', letterSpacing: 1, color: FAINT, textTransform: 'uppercase' }}>Sosiale kontoer</Typography>
          <Stack direction="row" spacing={1.5}><TextField label="Instagram" value={f.links?.instagram || ''} onChange={(e) => setLink('instagram', e.target.value)} size="small" fullWidth sx={fieldSx} /><TextField label="TikTok" value={f.links?.tiktok || ''} onChange={(e) => setLink('tiktok', e.target.value)} size="small" fullWidth sx={fieldSx} /></Stack>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <SpotifyArtistField value={f.links?.spotify || ''} onChange={(v) => setLink('spotify', v)} fieldSx={fieldSx}
              onPick={(a) => { audioShowcaseEvents.spotifyArtistLinked('profile'); if (!f.avatarUrl && a.image) { setF((p: any) => ({ ...p, avatarUrl: a.image })); void onSave(member.id, { avatarUrl: a.image }); } }} />
            <TextField label="YouTube" value={f.links?.youtube || ''} onChange={(e) => setLink('youtube', e.target.value)} size="small" fullWidth sx={fieldSx} />
          </Stack>
          {link && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '10px', p: 1 }}>
              <Typography sx={{ flex: 1, fontSize: '0.72rem', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</Typography>
              <Button size="small" startIcon={copied ? <DoneAll /> : <ContentCopy />} onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} sx={{ color: ACCENT, textTransform: 'none' }}>{copied ? 'Kopiert' : 'Lenke'}</Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!member.is_owner && <Button onClick={() => void onDelete(member.id)} sx={{ color: '#e0606a', textTransform: 'none', mr: 'auto' }}>Fjern</Button>}
        <Button onClick={onClose} sx={{ color: MUTED, textTransform: 'none' }}>Lukk</Button>
        <Button disabled={busy} onClick={async () => { setBusy(true); try { await onSave(member.id, f); onClose(); } finally { setBusy(false); } }} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>Lagre</Button>
      </DialogActions>
    </Dialog>
  );
};
const TaskDialog: React.FC<{ open: boolean; onClose: () => void; onAdd: (title: string, category: string) => Promise<void> }> = ({ open, onClose, onAdd }) => {
  const [title, setTitle] = React.useState(''); const [cat, setCat] = React.useState('Vokal'); const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px', minWidth: 380 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Ny oppgave</DialogTitle>
      <DialogContent><Stack spacing={1.5} sx={{ mt: 0.5 }}><TextField autoFocus label="Hva må gjøres?" value={title} onChange={(e) => setTitle(e.target.value)} size="small" sx={fieldSx} /><TextField label="Kategori (f.eks. Vokal, Bass)" value={cat} onChange={(e) => setCat(e.target.value)} size="small" sx={fieldSx} /></Stack></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose} sx={{ color: MUTED, textTransform: 'none' }}>Avbryt</Button><Button disabled={!title.trim() || busy} onClick={async () => { setBusy(true); try { await onAdd(title.trim(), cat.trim() || 'Generelt'); setTitle(''); } finally { setBusy(false); } }} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>Opprett</Button></DialogActions>
    </Dialog>
  );
};

type SyncConn = { easeverseConfigured: boolean; reachable: boolean; latencyMs?: number | null };

const LyricsDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; track: any; onLyricsChange: (lyrics: string) => void }> = ({ open, onClose, projectId, track, onLyricsChange }) => {
  const [val, setVal] = React.useState('');
  const [conn, setConn] = React.useState<SyncConn>({ easeverseConfigured: false, reachable: false });
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [pulse, setPulse] = React.useState(false);
  const dirtyRef = React.useRef(false);
  const saveTimer = React.useRef<any>(null);
  const esRef = React.useRef<EventSource | null>(null);

  // Initial last + synk-status.
  React.useEffect(() => {
    if (!open || !track) return;
    setVal(track.lyrics || ''); dirtyRef.current = false;
    apiRequest(`/api/audio-showcases/${projectId}/lyrics-sync`).then((d: any) => {
      if (d?.connection) setConn(d.connection);
      if (d?.lyrics != null && !dirtyRef.current) setVal(d.lyrics);
    }).catch(() => { /* ignore */ });
  }, [open, track, projectId]);

  // Live SSE-strøm (auto-reconnect via EventSource).
  React.useEffect(() => {
    if (!open || !track) return;
    const token = localStorage.getItem('sessionToken') || localStorage.getItem('auth_token') || '';
    const es = new EventSource(`/api/audio-showcases/${projectId}/lyrics-stream?token=${encodeURIComponent(token)}`);
    esRef.current = es;
    const onUpdate = (e: MessageEvent) => {
      try {
        const d = JSON.parse(e.data);
        setConn((c) => ({ ...c, easeverseConfigured: true, reachable: true }));
        if (!dirtyRef.current && typeof d.lyrics === 'string') { setVal(d.lyrics); onLyricsChange(d.lyrics); setPulse(true); setTimeout(() => setPulse(false), 1400); }
      } catch { /* ignore */ }
    };
    es.addEventListener('snapshot', (e) => { try { const d = JSON.parse((e as MessageEvent).data); if (!dirtyRef.current && typeof d.lyrics === 'string') setVal(d.lyrics); } catch { /* */ } });
    es.addEventListener('update', onUpdate as any);
    es.addEventListener('status', (e) => { try { setConn(JSON.parse((e as MessageEvent).data)); } catch { /* */ } });
    es.onerror = () => setConn((c) => ({ ...c, reachable: false }));
    return () => { es.close(); esRef.current = null; };
  }, [open, track, projectId, onLyricsChange]);

  const scheduleSave = (next: string) => {
    dirtyRef.current = true; setVal(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const r = await apiRequest(`/api/audio-showcases/${projectId}/lyrics`, { method: 'PUT', body: { lyrics: next } });
        dirtyRef.current = false; setSavedAt(new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }));
        if (r?.connection) setConn(r.connection); onLyricsChange(r?.lyrics ?? next);
      } catch { /* beholdt lokalt */ } finally { setSaving(false); }
    }, 800);
  };

  const syncNow = async () => {
    try {
      const r = await apiRequest(`/api/audio-showcases/${projectId}/lyrics-sync`, { method: 'POST', body: {} });
      if (r?.connection) setConn(r.connection);
      if (r?.applied === 'pulled' && typeof r.lyrics === 'string') { setVal(r.lyrics); onLyricsChange(r.lyrics); setPulse(true); setTimeout(() => setPulse(false), 1400); }
    } catch { /* ignore */ }
  };

  const status = !conn.easeverseConfigured
    ? { label: 'Lokal · EaseVerse ikke koblet', color: '#e0a955', dot: '#e0a955' }
    : conn.reachable
      ? { label: `Live · synket med EaseVerse${conn.latencyMs != null ? ` (${conn.latencyMs}ms)` : ''}`, color: '#5fb88a', dot: '#5fb88a' }
      : { label: 'Kobler til EaseVerse…', color: '#e0606a', dot: '#e0606a' };

  const [tab, setTab] = React.useState<'write' | 'structure'>('write');
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const anchors = React.useMemo(() => buildSectionAnchors(val), [val]);
  const sections = React.useMemo(() => parseSongSections(val), [val]);

  const insertSection = (type: SectionType) => {
    const ta = taRef.current;
    const token = sectionInsertToken(type);
    const pos = ta ? ta.selectionStart : val.length;
    const before = val.slice(0, pos), after = val.slice(pos);
    const needNlBefore = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    const block = `${needNlBefore}${token}\n`;
    const next = before + block + after;
    scheduleSave(next);
    const caret = (before + block).length;
    setTimeout(() => { if (taRef.current) { taRef.current.focus(); taRef.current.setSelectionRange(caret, caret); } }, 0);
  };
  const jumpToAnchor = (cursor: number, lineEndCursor: number) => {
    const ta = taRef.current; if (!ta) return;
    ta.focus(); ta.setSelectionRange(cursor, lineEndCursor);
    // scroll header til topp
    const before = val.slice(0, cursor); const line = before.split('\n').length - 1;
    ta.scrollTop = Math.max(0, line * 22 - 20);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, pb: 0.5 }}>
        <SubjectOutlined sx={{ color: ACCENT }} /> Tekst-studio {track?.title ? `· ${track.title}` : ''}
        <Box sx={{ flex: 1 }} />
        {track && (
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1, py: 0.4, borderRadius: '999px', bgcolor: 'rgba(255,255,255,0.05)', border: `1px solid ${status.color}44` }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: status.dot, boxShadow: conn.reachable ? `0 0 6px ${status.dot}` : 'none' }} />
            <Typography sx={{ fontSize: '0.72rem', color: status.color, fontWeight: 600 }}>{status.label}</Typography>
          </Stack>
        )}
      </DialogTitle>
      <DialogContent sx={{ minHeight: 420 }}>
        {!track ? (
          <Typography sx={{ color: MUTED, py: 2 }}>Dette review-rommet er ikke koblet til en SongFlow-låt ennå. Send en låt til review fra SongFlow for å skrive tekst her.</Typography>
        ) : (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1.5, minHeight: 36, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', color: MUTED, fontWeight: 600 }, '& .Mui-selected': { color: `${ACCENT} !important` }, '& .MuiTabs-indicator': { bgcolor: ACCENT } }}>
              <Tab value="write" label="Skriv" />
              <Tab value="structure" label={`Struktur${sections.length ? ` · ${sections.length}` : ''}`} />
            </Tabs>

            {tab === 'write' && (
              <>
                {/* Seksjons-verktøylinje — sett inn struktur (som EaseVerse) */}
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                  {INSERT_SECTION_OPTIONS.map((o) => (
                    <Chip key={o.type} label={`+ ${NB_LABELS[o.type]}`} size="small" onClick={() => insertSection(o.type)}
                      sx={{ height: 26, fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600, color: SECTION_TYPE_COLORS[o.type], bgcolor: `${SECTION_TYPE_COLORS[o.type]}1f`, '&:hover': { bgcolor: `${SECTION_TYPE_COLORS[o.type]}33` } }} />
                  ))}
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: anchors.length ? '180px 1fr' : '1fr', gap: 1.5 }}>
                  {anchors.length > 0 && (
                    <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: '10px', p: 1, maxHeight: 320, overflowY: 'auto' }}>
                      <Typography sx={{ fontSize: '0.66rem', letterSpacing: 1, color: FAINT, textTransform: 'uppercase', px: 0.5, mb: 0.5 }}>Struktur</Typography>
                      {anchors.map((a) => (
                        <Stack key={a.id} direction="row" alignItems="center" spacing={1} onClick={() => jumpToAnchor(a.cursor, a.cursor + a.label.length + 2)}
                          sx={{ px: 0.75, py: 0.5, borderRadius: '7px', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: SECTION_TYPE_COLORS[a.type], flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.8rem', color: TEXT }}>{a.nbLabel}</Typography>
                        </Stack>
                      ))}
                    </Box>
                  )}
                  <TextField inputRef={taRef} value={val} onChange={(e) => scheduleSave(e.target.value)} multiline minRows={13} maxRows={16} fullWidth
                    placeholder="Skriv teksten… bruk knappene over for [Vers], [Refreng], [Bro]…"
                    sx={{ transition: 'box-shadow .3s', boxShadow: pulse ? `0 0 0 2px ${ACCENT}` : 'none', borderRadius: '8px',
                      '& .MuiInputBase-input': { color: TEXT, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '0.86rem', lineHeight: 1.55 },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' } }} />
                </Box>
              </>
            )}

            {tab === 'structure' && (
              <Stack spacing={1.25} sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5 }}>
                {sections.length === 0 && <Typography sx={{ color: MUTED, py: 2 }}>Ingen seksjoner ennå. Gå til «Skriv» og sett inn [Vers]/[Refreng] for å bygge strukturen.</Typography>}
                {sections.map((s) => (
                  <Box key={s.id} sx={{ borderLeft: `3px solid ${SECTION_TYPE_COLORS[s.type]}`, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px', p: 1.5 }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: SECTION_TYPE_COLORS[s.type], textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>{s.nbLabel}</Typography>
                    {s.lines.map((ln, i) => <Typography key={i} sx={{ fontSize: '0.86rem', color: 'rgba(245,242,234,0.9)', lineHeight: 1.5 }}>{ln}</Typography>)}
                  </Box>
                ))}
              </Stack>
            )}

            <Typography sx={{ mt: 1, fontSize: '0.72rem', color: MUTED }}>
              {saving ? 'Lagrer + synker til EaseVerse…' : pulse ? 'Oppdatert fra EaseVerse nå' : savedAt ? `Lagret ${savedAt} · auto-synk` : 'Auto-lagrer mens du skriver · seksjoner deles med EaseVerse'}
            </Typography>
          </>
        )}
      </DialogContent>
      {track && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={syncNow} startIcon={<Sync />} sx={{ color: MUTED, textTransform: 'none' }}>Synk nå</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>Ferdig</Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

const FEE_TYPES = [['royalty', 'Kun royalty'], ['session', 'Session-honorar'], ['buyout', 'Buyout'], ['hourly', 'Timepris']];
const SplitSheetDialog: React.FC<{ open: boolean; projectId: string; ownerName?: string; onClose: () => void }> = ({ open, projectId, ownerName, onClose }) => {
  const [loading, setLoading] = React.useState(true);
  const [sheet, setSheet] = React.useState<any>(null);
  const [rows, setRows] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [signFor, setSignFor] = React.useState<any>(null); const [sigName, setSigName] = React.useState(''); const [consent, setConsent] = React.useState(false);
  const sigPadRef = React.useRef<SignatureHandle>(null);
  const [creo, setCreo] = React.useState<any>(null);
  const [rateMenu, setRateMenu] = React.useState<{ el: HTMLElement; row: number } | null>(null);
  React.useEffect(() => { if (open && !creo) apiRequest('/api/audio-showcase/rate-guidance').then(setCreo).catch(() => {}); }, [open, creo]);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiRequest(`/api/audio-showcases/${projectId}/split-sheet`); setSheet(d);
      setRows((d?.contributors || []).map((c: any) => ({ id: c.id, name: c.name, role: c.role, signed_at: c.signed_at,
        contributions: c.custom_fields?.contributions || [], master: Number(c.percentage) || 0, comp: Number(c.custom_fields?.compositionPct) || 0,
        feeAmount: c.custom_fields?.feeAmount || '', feeCurrency: c.custom_fields?.feeCurrency || 'NOK', feeType: c.custom_fields?.feeType || 'royalty' })));
    } catch { setSheet(null); } finally { setLoading(false); }
  }, [projectId]);
  React.useEffect(() => { if (open) { void load(); setSignFor(null); setSigName(''); setConsent(false); } }, [open, load]);
  const masterTotal = Math.round(rows.reduce((a, r) => a + (Number(r.master) || 0), 0) * 100) / 100;
  const compTotal = Math.round(rows.reduce((a, r) => a + (Number(r.comp) || 0), 0) * 100) / 100;
  const locked = (sheet?.signedCount || 0) > 0;
  const upd = (i: number, k: string, v: any) => setRows(rows.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const generate = async () => { setBusy(true); try { const r = await apiRequest(`/api/audio-showcases/${projectId}/split-sheet`, { method: 'POST', body: {} }); audioShowcaseEvents.splitGenerated((r?.contributors || []).length); await load(); } finally { setBusy(false); } };
  const save = async () => { setBusy(true); try { await apiRequest(`/api/audio-showcases/${projectId}/split-sheet`, { method: 'PATCH', body: { contributors: rows.map((r) => ({ id: r.id, masterPct: Number(r.master) || 0, compositionPct: Number(r.comp) || 0, feeAmount: Number(r.feeAmount) || 0, feeCurrency: r.feeCurrency, feeType: r.feeType })) } }); await load(); } catch { /* */ } finally { setBusy(false); } };
  const unlock = async () => { setBusy(true); try { await apiRequest(`/api/audio-showcases/${projectId}/split-sheet/unlock`, { method: 'POST', body: {} }); await load(); } finally { setBusy(false); } };
  const splitEven = () => { const ev = Math.floor((10000 / rows.length)) / 100; setRows(rows.map((r, i) => ({ ...r, master: i === 0 ? Math.round((100 - ev * (rows.length - 1)) * 100) / 100 : ev, comp: i === 0 ? Math.round((100 - ev * (rows.length - 1)) * 100) / 100 : ev }))); };
  const doSign = async () => {
    if (!signFor || !sigName.trim() || !consent) return; setBusy(true);
    try {
      const sg = sigPadRef.current?.get() || null;
      await apiRequest(`/api/audio-showcases/${projectId}/split-sheet/sign`, { method: 'POST', body: { contributorId: signFor.id, signature: sigName.trim(), consent: true, signatureImage: sg?.dataUrl, signatureMethod: sg?.method } });
      audioShowcaseEvents.splitSigned({ method: sg?.method || 'simple', by: 'owner' });
      setSignFor(null); setSigName(''); setConsent(false); await load();
    } catch { /* */ } finally { setBusy(false); }
  };
  const downloadPdf = async () => {
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/audio-showcases/${projectId}/agreement.pdf`, { headers });
      if (!res.ok) return;
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'splittavtale.pdf'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      audioShowcaseEvents.agreementDownloaded('owner');
    } catch { /* */ }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}><ReceiptLongOutlined sx={{ color: ACCENT }} /> Avtale · royalty & honorar
        {sheet?.exists && <Chip label={`${sheet.signedCount}/${rows.length} signert`} size="small" sx={{ height: 20, fontSize: '0.64rem', bgcolor: locked ? 'rgba(95,184,138,0.16)' : 'rgba(255,255,255,0.08)', color: locked ? '#5fb88a' : MUTED }} />}</DialogTitle>
      <DialogContent>
        {loading ? <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>
          : !sheet?.exists ? (
            <Stack spacing={1.5} sx={{ py: 1, textAlign: 'center' }}><Typography sx={{ color: MUTED }}>Ingen avtale ennå. Generer fra bidragsyterne (lik fordeling som start).</Typography>
              <Button onClick={generate} disabled={busy} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>{busy ? 'Genererer…' : 'Generer avtale'}</Button></Stack>
          ) : signFor ? (
            <Stack spacing={1.5} sx={{ py: 1 }}>
              <Typography sx={{ fontWeight: 700 }}>Signér som {signFor.name}</Typography>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', p: 1.5, fontSize: '0.82rem' }}>
                <Typography sx={{ fontSize: '0.82rem' }}>Master {signFor.master}% · Komposisjon {signFor.comp}%{Number(signFor.feeAmount) > 0 ? ` · ${signFor.feeAmount} ${signFor.feeCurrency} (${FEE_TYPES.find(f => f[0] === signFor.feeType)?.[1]})` : ''}</Typography>
                {signFor.contributions?.length > 0 && <Typography sx={{ fontSize: '0.74rem', color: MUTED, mt: 0.5 }}>Bidrag: {signFor.contributions.join(', ')}</Typography>}
              </Box>
              <FormControlLabel control={<Switch checked={consent} onChange={(e) => setConsent(e.target.checked)} sx={{ '& .Mui-checked': { color: ACCENT } }} />} label={<Typography sx={{ fontSize: '0.8rem' }}>Jeg bekrefter at fordelingen er korrekt og at jeg godkjenner avtalen som bindende.</Typography>} />
              <TextField label="Fullt navn (juridisk)" value={sigName} onChange={(e) => setSigName(e.target.value)} size="small" sx={fieldSx} />
              <SignaturePad ref={sigPadRef} name={sigName} fieldSx={fieldSx} />
              <Typography sx={{ fontSize: '0.66rem', color: FAINT, lineHeight: 1.45 }}>Vi lagrer navn, tidspunkt, IP og signaturbilde som bevis på avtalen (GDPR art. 6(1)(b) – avtaleinngåelse). Kvittering sendes på e-post.</Typography>
            </Stack>
          ) : (
            <Stack spacing={0.75}>
              {locked && <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'rgba(95,184,138,0.1)', border: '1px solid rgba(95,184,138,0.4)', borderRadius: '10px', p: 1 }}><CheckCircle sx={{ fontSize: 17, color: '#5fb88a' }} /><Typography sx={{ fontSize: '0.78rem', flex: 1 }}>Signert av {sheet.signedCount} — låst for endring.</Typography><Button size="small" onClick={unlock} disabled={busy} sx={{ color: '#e0a955', textTransform: 'none' }}>Lås opp</Button></Stack>}
              <Stack direction="row" sx={{ px: 0.5, pb: 0.5 }}><Box sx={{ flex: 1 }} /><Typography sx={{ width: 70, fontSize: '0.66rem', color: FAINT, textAlign: 'center' }}>Master</Typography><Typography sx={{ width: 70, fontSize: '0.66rem', color: FAINT, textAlign: 'center' }}>Komp.</Typography><Typography sx={{ width: 130, fontSize: '0.66rem', color: FAINT, textAlign: 'center' }}>Honorar</Typography><Box sx={{ width: 76 }} /></Stack>
              {rows.map((r, i) => (
                <Stack key={r.id} direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}><Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }} noWrap>{r.name}</Typography>{r.signed_at && <CheckCircle sx={{ fontSize: 14, color: '#5fb88a' }} />}</Stack>
                    <Typography sx={{ fontSize: '0.68rem', color: MUTED }} noWrap>{(r.contributions || []).join(' · ') || r.role}</Typography>
                  </Box>
                  <TextField type="number" size="small" disabled={locked} value={r.master} onChange={(e) => upd(i, 'master', e.target.value)} sx={{ width: 70, ...fieldSx }} />
                  <TextField type="number" size="small" disabled={locked} value={r.comp} onChange={(e) => upd(i, 'comp', e.target.value)} sx={{ width: 70, ...fieldSx }} />
                  <TextField type="number" size="small" disabled={locked} value={r.feeAmount} placeholder="0" onChange={(e) => upd(i, 'feeAmount', e.target.value)} sx={{ width: 130, ...fieldSx }}
                    InputProps={{ endAdornment: (
                      <Stack direction="row" alignItems="center" spacing={0.25}>
                        <Typography sx={{ color: MUTED, fontSize: '0.7rem' }}>{r.feeCurrency}</Typography>
                        {!locked && creo?.rates?.length > 0 && <Tooltip title="Veiledende sats (Creo)"><IconButton size="small" onClick={(e) => setRateMenu({ el: e.currentTarget, row: i })} sx={{ color: ACCENT, p: 0.25 }}><TipsAndUpdatesOutlined sx={{ fontSize: 15 }} /></IconButton></Tooltip>}
                      </Stack>
                    ) }} />
                  {!r.signed_at && (r.name === ownerName)
                    ? <Button size="small" onClick={() => { setSignFor(r); setSigName(r.name); }} sx={{ width: 76, color: ACCENT, textTransform: 'none', fontSize: '0.72rem' }}>Signér</Button>
                    : <Box sx={{ width: 76, textAlign: 'center' }}>{r.signed_at ? <Typography sx={{ fontSize: '0.66rem', color: '#5fb88a' }}>signert</Typography> : <Typography sx={{ fontSize: '0.62rem', color: FAINT }}>via lenke</Typography>}</Box>}
                </Stack>
              ))}
              <Stack direction="row" alignItems="center" sx={{ mt: 1, pt: 1, borderTop: `1px solid ${BORDER}` }}>
                {!locked && <Button size="small" onClick={splitEven} sx={{ color: MUTED, textTransform: 'none' }}>Fordel likt</Button>}
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: Math.abs(masterTotal - 100) < 0.01 ? '#5fb88a' : '#e0606a', mr: 2 }}>Master {masterTotal}%</Typography>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: Math.abs(compTotal - 100) < 0.01 ? '#5fb88a' : '#e0606a' }}>Komp. {compTotal}%</Typography>
              </Stack>
              <Typography sx={{ fontSize: '0.68rem', color: FAINT }}>Hver part signerer selv via sin egen lenke. Royalty = løpende andel; honorar = engangs. Komposisjon (TONO) og master (Gramo) kan ha ulik fordeling.</Typography>
            </Stack>
          )}
      </DialogContent>
      <Menu anchorEl={rateMenu?.el} open={Boolean(rateMenu)} onClose={() => setRateMenu(null)}
        PaperProps={{ sx: { bgcolor: '#1a1a1e', color: TEXT, border: `1px solid ${BORDER}`, maxWidth: 320 } }}>
        <Typography sx={{ px: 2, pt: 1, pb: 0.5, fontSize: '0.66rem', color: FAINT, textTransform: 'uppercase', letterSpacing: 0.5 }}>Veiledende sats · {creo?.source}</Typography>
        {(creo?.rates || []).map((rt: any) => (
          <MenuItem key={rt.key} onClick={() => { if (rateMenu) { upd(rateMenu.row, 'feeAmount', rt.amount); upd(rateMenu.row, 'feeType', rt.key === 'concert' ? 'flat' : 'session'); } setRateMenu(null); }} sx={{ display: 'block', py: 0.75 }}>
            <Stack direction="row" alignItems="baseline" spacing={1}><Typography sx={{ fontSize: '0.82rem', fontWeight: 600, flex: 1 }}>{rt.label}</Typography><Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: ACCENT }}>{rt.amount.toLocaleString('no-NO')} kr</Typography></Stack>
            <Typography sx={{ fontSize: '0.68rem', color: MUTED }}>{rt.unit}{rt.note ? ` · ${rt.note}` : ''}</Typography>
          </MenuItem>
        ))}
        <Typography sx={{ px: 2, py: 1, fontSize: '0.64rem', color: FAINT, lineHeight: 1.4 }}>{creo?.markupNote} Oppdatert {creo?.updated}.</Typography>
      </Menu>
      {sheet?.exists && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {signFor ? (
            <><Button onClick={() => setSignFor(null)} sx={{ color: MUTED, textTransform: 'none' }}>Avbryt</Button>
              <Button onClick={doSign} disabled={busy || !sigName.trim() || !consent} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>Signér bindende</Button></>
          ) : (
            <><Button href={sheet.url} target="_blank" sx={{ color: MUTED, textTransform: 'none', mr: 'auto' }}>Åpne i CRM</Button>
              <Button onClick={downloadPdf} startIcon={<FileDownloadOutlined sx={{ fontSize: '17px !important' }} />} sx={{ color: TEXT, textTransform: 'none' }}>Last ned avtale (PDF)</Button>
              <Button onClick={onClose} sx={{ color: MUTED, textTransform: 'none' }}>Lukk</Button>
              <Button onClick={save} disabled={busy || locked || masterTotal > 100.01} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>Lagre vilkår</Button></>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

/* ── Publiseringsdialog (release-pakke) ────────────────────────────────────
 * Bygger en utgivelse fra det godkjente review-rommet: metadata + ISRC/UPC +
 * cover/master + splitt/credits → validerer → eksporterer en «release-pakke»
 * (JSON-manifest) som produsenten laster opp i sin egen distributørkonto. */
const RELEASE_TYPES: [string, string][] = [['single', 'Singel'], ['ep', 'EP'], ['album', 'Album']];
const PublishDialog: React.FC<{ open: boolean; projectId: string; onClose: () => void }> = ({ open, projectId, onClose }) => {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [rel, setRel] = React.useState<any>(null);
  const [checks, setChecks] = React.useState<{ key: string; ok: boolean; label: string }[]>([]);
  const [valid, setValid] = React.useState(false);
  const [spot, setSpot] = React.useState<any>(null); const [spotBusy, setSpotBusy] = React.useState(false);
  const [enrichNote, setEnrichNote] = React.useState('');

  const refresh = React.useCallback(async (id: string) => {
    try { const v = await apiRequest(`/api/releases/${id}/validate`); setChecks(v.checks || []); setValid(!!v.valid); } catch { /* */ }
  }, []);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiRequest(`/api/audio-showcases/${projectId}/release`, { method: 'POST', body: {} });
      setRel(d.release); await refresh(d.release.id); audioShowcaseEvents.releaseStarted();
    } catch { setRel(null); } finally { setLoading(false); }
  }, [projectId, refresh]);
  React.useEffect(() => { if (open) void load(); }, [open, load]);

  const set = (k: string, v: any) => setRel((r: any) => ({ ...r, [k]: v }));
  const save = async () => {
    if (!rel) return; setBusy(true);
    try {
      const u = await apiRequest(`/api/releases/${rel.id}`, { method: 'PATCH', body: {
        title: rel.title, primaryArtist: rel.primary_artist, releaseType: rel.release_type,
        primaryGenre: rel.primary_genre, secondaryGenre: rel.secondary_genre, language: rel.language,
        explicit: !!rel.explicit, releaseDate: (rel.release_date || '').slice(0, 10), isrc: rel.isrc, upc: rel.upc,
        label: rel.label, copyrightYear: Number(rel.copyright_year) || undefined, pLine: rel.p_line, cLine: rel.c_line,
      } });
      setRel(u); await refresh(u.id);
    } catch { /* */ } finally { setBusy(false); }
  };
  // Metadata-berikelse: slå opp hovedartisten på Spotify, fyll sjanger om tom.
  const enrich = async () => {
    if (!rel?.primary_artist) { setEnrichNote('Fyll inn hovedartist først.'); return; }
    setSpotBusy(true); setEnrichNote('');
    try {
      const d = await apiRequest(`/api/spotify/search-artist?q=${encodeURIComponent(rel.primary_artist)}`);
      const a = (d?.artists || [])[0];
      if (!a) { setEnrichNote('Fant ingen Spotify-artist.'); return; }
      setRel((r: any) => ({ ...r, primary_genre: r.primary_genre || a.genres?.[0] || r.primary_genre, secondary_genre: r.secondary_genre || a.genres?.[1] || r.secondary_genre }));
      setEnrichNote(`Matchet «${a.name}»${a.genres?.length ? ` · ${a.genres.slice(0, 2).join(', ')}` : ' (ingen sjanger registrert)'}`);
      audioShowcaseEvents.spotifyEnriched();
    } catch (e: any) { setEnrichNote(typeof e?.message === 'string' && e.message.includes('503') ? 'Spotify ikke konfigurert.' : 'Oppslag feilet.'); }
    finally { setSpotBusy(false); }
  };
  // ISRC/UPC-verifisering: er utgivelsen live på Spotify?
  const checkSpotify = async () => {
    if (!rel) return; setSpotBusy(true);
    try { await save(); const st = await apiRequest(`/api/releases/${rel.id}/spotify-status`); setSpot(st); audioShowcaseEvents.spotifyStatusChecked(!!st?.live); }
    catch { setSpot({ error: true }); } finally { setSpotBusy(false); }
  };

  const exportPackage = async () => {
    if (!rel) return; setBusy(true);
    try {
      await save();
      const headers = await getAuthHeader();
      const res = await fetch(`/api/releases/${rel.id}/package`, { headers });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `release-${(rel.title || 'release').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      audioShowcaseEvents.releaseExported({ valid });
      await refresh(rel.id);
    } catch { /* */ } finally { setBusy(false); }
  };

  const field = (label: string, key: string, opts: { w?: number | string; ph?: string } = {}) => (
    <TextField label={label} value={rel?.[key] ?? ''} placeholder={opts.ph} onChange={(e) => set(key, e.target.value)} size="small" sx={{ width: opts.w, ...fieldSx }} fullWidth={!opts.w} />
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}><RocketLaunchOutlined sx={{ color: ACCENT }} /> Publiser utgivelse
        {rel && <Chip label={valid ? 'Klar' : 'Mangler info'} size="small" sx={{ height: 20, fontSize: '0.64rem', bgcolor: valid ? 'rgba(95,184,138,0.16)' : 'rgba(224,169,85,0.16)', color: valid ? '#5fb88a' : '#e0a955' }} />}
        {rel?.status === 'exported' && <Chip label="Eksportert" size="small" sx={{ height: 20, fontSize: '0.64rem', bgcolor: 'rgba(255,255,255,0.08)', color: MUTED }} />}</DialogTitle>
      <DialogContent>
        {loading || !rel ? <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box> : (
          <Stack direction="row" spacing={2} sx={{ py: 0.5 }}>
            {/* Venstre: metadata-skjema */}
            <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
              {field('Tittel', 'title')}
              <Stack direction="row" spacing={1}>
                {field('Hovedartist', 'primary_artist')}
                <TextField select SelectProps={{ native: true }} label="Type" value={rel.release_type || 'single'} onChange={(e) => set('release_type', e.target.value)} size="small" sx={{ width: 120, ...fieldSx }}>
                  {RELEASE_TYPES.map(([v, l]) => <option key={v} value={v} style={{ background: PANEL }}>{l}</option>)}
                </TextField>
              </Stack>
              <Stack direction="row" spacing={1}>{field('Sjanger', 'primary_genre')}{field('Undersjanger', 'secondary_genre')}</Stack>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Button onClick={enrich} disabled={spotBusy} size="small" startIcon={<MusicNote sx={{ fontSize: '15px !important' }} />} sx={{ color: '#1DB954', textTransform: 'none', fontSize: '0.72rem', minWidth: 0 }}>Berik fra Spotify</Button>
                {enrichNote && <Typography sx={{ fontSize: '0.68rem', color: MUTED }} noWrap>{enrichNote}</Typography>}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField type="date" label="Utgivelsesdato" InputLabelProps={{ shrink: true }} value={(rel.release_date || '').slice(0, 10)} onChange={(e) => set('release_date', e.target.value)} size="small" sx={{ flex: 1, ...fieldSx }} />
                {field('Språk', 'language', { w: 90, ph: 'no' })}
              </Stack>
              <Stack direction="row" spacing={1}>{field('ISRC', 'isrc', { ph: 'NOABC2500001' })}{field('UPC/EAN', 'upc', { ph: 'strekkode' })}</Stack>
              {field('Plateselskap / label', 'label')}
              <Stack direction="row" spacing={1} alignItems="center">
                {field('© Komposisjon (C-line)', 'c_line')}
                <FormControlLabel control={<Switch checked={!!rel.explicit} onChange={(e) => set('explicit', e.target.checked)} sx={{ '& .Mui-checked': { color: ACCENT } }} />} label={<Typography sx={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}>Explicit</Typography>} />
              </Stack>
              {field('℗ Master (P-line)', 'p_line')}
            </Stack>
            {/* Høyre: cover + sjekkliste */}
            <Stack spacing={1.25} sx={{ width: 230 }}>
              <Box sx={{ aspectRatio: '1', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${BORDER}`, bgcolor: PANEL2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {rel.cover_url ? <Box component="img" src={rel.cover_url} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MusicNote sx={{ fontSize: 40, color: FAINT }} />}
              </Box>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '10px', p: 1.25 }}>
                <Typography sx={{ fontSize: '0.68rem', color: FAINT, mb: 0.5, fontWeight: 700, letterSpacing: 0.5 }}>SJEKKLISTE FØR LEVERING</Typography>
                <Stack spacing={0.4}>
                  {checks.map((c) => (
                    <Stack key={c.key} direction="row" alignItems="center" spacing={0.75}>
                      {c.ok ? <CheckCircle sx={{ fontSize: 15, color: '#5fb88a' }} /> : <FiberManualRecord sx={{ fontSize: 9, color: '#e0a955', mx: '3px' }} />}
                      <Typography sx={{ fontSize: '0.72rem', color: c.ok ? TEXT : MUTED }}>{c.label}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
              <Typography sx={{ fontSize: '0.66rem', color: FAINT, lineHeight: 1.4 }}>Pakken inneholder metadata, credits/splitt og asset-lenker (master + cover). Last den opp i din egen distributør (DistroKid, CD Baby, Amuse e.l.).</Typography>
              {/* Spotify-verifisering (etter publisering hos distributør) */}
              <Box sx={{ bgcolor: 'rgba(29,185,84,0.06)', border: '1px solid rgba(29,185,84,0.25)', borderRadius: '10px', p: 1.25 }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                  <MusicNote sx={{ fontSize: 15, color: '#1DB954' }} />
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, flex: 1 }}>Live på Spotify?</Typography>
                  <Button onClick={checkSpotify} disabled={spotBusy || (!rel.isrc && !rel.upc)} size="small" sx={{ color: '#1DB954', textTransform: 'none', fontSize: '0.7rem', minWidth: 0 }}>{spotBusy ? '…' : 'Sjekk'}</Button>
                </Stack>
                {!rel.isrc && !rel.upc && <Typography sx={{ fontSize: '0.66rem', color: FAINT }}>Legg inn ISRC eller UPC for å sjekke.</Typography>}
                {spot?.error && <Typography sx={{ fontSize: '0.68rem', color: '#e0606a' }}>Oppslag feilet.</Typography>}
                {spot && !spot.error && spot.live === false && <Typography sx={{ fontSize: '0.68rem', color: '#e0a955' }}>Ikke funnet ennå — det tar gjerne 1–3 dager etter levering.</Typography>}
                {spot?.live && (() => { const e = spot.track || spot.album; return (
                  <Stack spacing={0.75}>
                    <Box component="iframe" title="Spotify" src={e.embedUrl} sx={{ width: '100%', height: spot.track ? 80 : 152, border: 0, borderRadius: '8px' }} allow="encrypted-media" />
                    <Button href={e.url} target="_blank" size="small" sx={{ color: '#1DB954', textTransform: 'none', fontSize: '0.7rem', alignSelf: 'flex-start', minWidth: 0 }}>Åpne på Spotify</Button>
                  </Stack>
                ); })()}
              </Box>
              {/* YouTube-publisering (visualizer / lyric-video / karaoke) */}
              <YouTubePublishPanel releaseId={rel.id} projectId={projectId} masterUrl={rel.master_url} />
            </Stack>
          </Stack>
        )}
      </DialogContent>
      {rel && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} sx={{ color: MUTED, textTransform: 'none', mr: 'auto' }}>Lukk</Button>
          <Button onClick={save} disabled={busy} sx={{ color: TEXT, textTransform: 'none' }}>Lagre</Button>
          <Button onClick={exportPackage} disabled={busy || !valid} startIcon={busy ? <CircularProgress size={15} sx={{ color: '#150d05' }} /> : <FileDownloadDoneOutlined />} variant="contained"
            sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', '&.Mui-disabled': { bgcolor: 'rgba(255,107,53,0.3)', color: 'rgba(21,13,5,0.5)' } }}>Eksporter release-pakke</Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

const fieldSx = {
  '& .MuiInputBase-input': { color: TEXT },
  '& .MuiInputLabel-root': { color: MUTED },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
};
