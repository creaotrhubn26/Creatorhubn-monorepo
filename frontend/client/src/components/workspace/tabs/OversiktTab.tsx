// @ts-nocheck
/**
 * OversiktTab — workspace-forsiden (design #1), dark CreatorHub.
 * Dagens tidslinje + Samkjøringsboard + Team Sync / Sjekkliste / Referanser
 * + Team Chat (høyre). Bruker prøvedata nå; wires mot ekte backend i wire-fasen.
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
import { WsCard, WsSectionTitle, WsRing, WsBar, WsImageGrid } from '../ui';
import WorkspaceChatPanel from '../WorkspaceChatPanel';
import { useProjectImages } from '../useProjectImages';
import { useCaptureRealtime } from '../useCaptureRealtime';

const PHASES = [
  { icon: '🤍', label: 'Forberedelser', time: '08:00 – 10:00', color: ws.textDim },
  { icon: '💗', label: 'First look', time: '10:30 – 11:00', color: ws.red },
  { icon: '⛪', label: 'Vielse', time: '11:30 – 12:30', color: ws.accent, active: true },
  { icon: '🌅', label: 'Golden hour', time: '16:30 – 17:30', color: ws.amber },
  { icon: '🎙️', label: 'Taler', time: '19:00 – 20:00', color: ws.blue },
  { icon: '🎉', label: 'Fest', time: '20:30 – 00:00', color: ws.green },
];

const BOARD = [
  { role: 'Fotograf (Daniel)', icon: '📷', tasks: [
    { t: 'Detaljer: ringer & tilbehør', time: '07:30 – 08:00', done: true },
    { t: 'Forberedelser – candids', time: '08:00 – 10:00', done: true },
    { t: 'Portretter av brud & brudgom', time: '10:00 – 10:30', done: false },
    { t: 'Close-ups av ringer', time: '11:20 – 11:30', done: false },
  ]},
  { role: 'Videograf (Emma)', icon: '🎥', tasks: [
    { t: 'Etableringsbilder + lydsjekk', time: '07:30 – 08:30', done: true },
    { t: 'Forberedelser – video', time: '08:00 – 10:00', done: true },
    { t: 'First look – video', time: '10:30 – 11:00', done: false },
    { t: 'Vielse – flere vinkler', time: '11:30 – 12:30', done: false },
  ]},
  { role: 'Begge', icon: '👥', tasks: [
    { t: 'First look – reaksjoner', time: '10:30 – 11:00', done: true },
    { t: 'Vielse: inngang & første kyss', time: '11:30 – 12:30', done: false },
    { t: 'Gruppebilder familie', time: '13:00 – 13:45', done: false },
    { t: 'Golden hour – parbilder', time: '16:30 – 17:30', done: false },
  ]},
  { role: 'Editor (Lukas)', icon: '🎬', tasks: [
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
  if (t.includes('first look')) return '💗';
  if (t.includes('viel') || t.includes('seremoni')) return '⛪';
  if (t.includes('golden')) return '🌅';
  if (t.includes('tale') || t.includes('toast')) return '🎙️';
  if (t.includes('fest') || t.includes('dans')) return '🎉';
  if (t.includes('forbered') || t.includes('getting ready')) return '🤍';
  return '⏱️';
}
// Humaniser en capture_events.event_type (fri tekst fra iPad/One Desk) til ikon + tekst.
function activityMeta(type: string): { icon: string; label: string } {
  const t = (type || '').toLowerCase();
  if (t.includes('asset') && (t.includes('add') || t.includes('upload') || t.includes('captur'))) return { icon: '📸', label: 'Nytt bilde lastet opp' };
  if (t.includes('rating') || t.includes('rated')) return { icon: '⭐', label: 'Rating endret' };
  if (t.includes('cull') || t.includes('reject')) return { icon: '🗑️', label: 'Culling' };
  if (t.includes('flag') || t.includes('pick') || t.includes('highlight')) return { icon: '🚩', label: 'Markert for klient' };
  if (t.includes('handoff')) return { icon: '🎬', label: 'Sendt til editor' };
  if (t.includes('deliver')) return { icon: '📦', label: 'Levert' };
  if (t.includes('backup') || t.includes('secured') || t.includes('mirror')) return { icon: '☁️', label: 'Sikkerhetskopiert' };
  if (t.includes('session') && t.includes('start')) return { icon: '▶️', label: 'Capture-session startet' };
  if (t.includes('enhance')) return { icon: '✨', label: 'AI-forbedring' };
  if (t.includes('voice') || t.includes('memo') || t.includes('audio')) return { icon: '🎙️', label: 'Talenotat lagt til' };
  if (t.includes('comment') || t.includes('review')) return { icon: '💬', label: 'Tilbakemelding' };
  return { icon: '⚡', label: (type || 'Hendelse').replace(/_/g, ' ') };
}
function timeAgo(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso).getTime(); if (!Number.isFinite(d)) return '';
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return 'nå nettopp';
  if (s < 3600) return `${Math.floor(s / 60)} min siden`;
  if (s < 86400) return `${Math.floor(s / 3600)} t siden`;
  return `${Math.floor(s / 86400)} d siden`;
}
function addMinutes(hhmm: string, mins: number): string {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h * 60 + m + (mins || 0)) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const OversiktTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [, navigate] = useLocation();
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
    const label = window.prompt('Nytt sjekkpunkt:'); if (!label) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist`, { method: 'POST', body: { label: label.trim() } }); apiRequest(`/api/projects/${encodeURIComponent(projectId)}/checklist`).then((r: any) => setChecks(r?.items || [])); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke legge til'); }
  };
  const checkItems = isReal ? (checks || []).map((c) => ({ id: c.id, t: c.label, ok: c.checked, real: true })) : CHECKLIST;
  const refs = useProjectImages(projectId, 'references');
  const [teamSync, setTeamSync] = useState<any | null>(null);
  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team-sync`).then((r: any) => setTeamSync(r || null)).catch(() => {});
  }, [projectId, isReal, tasks, checks]);
  const syncPct = teamSync ? teamSync.pct : 82;
  const syncItems = (teamSync && Array.isArray(teamSync.readiness) && teamSync.readiness.length)
    ? teamSync.readiness.map((x: any) => ({ t: `${x.label} (${x.value})`, ok: x.done }))
    : SYNC_ITEMS.map((s) => ({ t: s, ok: true }));

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
    const title = window.prompt('Ny oppgave:'); if (!title) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks`, { method: 'POST', body: { title: title.trim(), crewRole } }); loadTasks(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke legge til'); }
  };

  // Bygg de 4 rolle-kolonnene fra ekte tasks, ellers sample.
  const COLS = [
    { role: 'Fotograf (Daniel)', icon: '📷', crew: 'fotograf' },
    { role: 'Videograf (Emma)', icon: '🎥', crew: 'videograf' },
    { role: 'Begge', icon: '👥', crew: 'begge' },
    { role: 'Editor (Lukas)', icon: '🎬', crew: 'editor' },
  ];
  const realBoard = tasks && tasks.length > 0
    ? COLS.map((c) => ({ ...c, tasks: tasks.filter((t) => (t.crewRole || 'begge') === c.crew).map((t) => ({ id: t.id, t: t.title, time: t.timeLabel || '', done: t.status === 'done', real: true })) }))
    : null;
  const boardCols = isReal ? (realBoard || COLS.map((c) => ({ role: c.role || c.label || c.crew, icon: c.icon || '👥', crew: c.crew, tasks: [] }))) : BOARD.map((c, i) => ({ role: c.role, icon: c.icon, crew: COLS[i]?.crew || 'begge', tasks: c.tasks }));

  const fremdriftPct = progress ? progress.pct : 68;
  const fremdriftText = progress ? `${progress.done} av ${progress.total} oppgaver fullført` : '14 av 21 oppgaver fullført';
  const phaseItems = isReal
    ? (events || []).map((e: any) => ({ icon: eventIcon(e.title), label: e.title || 'Hendelse', time: e.time ? `${e.time}${e.durationMinutes ? ' – ' + addMinutes(e.time, e.durationMinutes) : ''}` : '', active: e.status === 'in_progress' || e.status === 'current' }))
    : PHASES;

  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'stretch' }}>
      {/* ───────── Hovedkolonne ───────── */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Fremdrift */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, color: ws.textDim }}>Fremdrift</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: ws.accent }}>{fremdriftPct} %</Typography>
          <Box sx={{ flex: 1, maxWidth: 360 }}><WsBar value={fremdriftPct} /></Box>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{fremdriftText}</Typography>
        </Stack>

        {/* Capture & backup — live fra iPad CaptureApp + One Desk */}
        {cap?.hasSession && (
          <WsCard sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" gap={1.5}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 180 }}>
                <Typography sx={{ fontSize: 17 }}>📷</Typography>
                <Box>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Capture & backup</Typography>
                    {cap.shootingNow && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.red }} /><Typography sx={{ fontSize: 10.5, color: ws.red, fontWeight: 700 }}>SKYTER NÅ</Typography></Box>}
                  </Stack>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{cap.session?.name || 'Capture-session'}</Typography>
                </Box>
              </Stack>
              <Box sx={{ textAlign: 'center', px: 1 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{cap.assets?.total ?? 0}</Typography>
                <Typography sx={{ fontSize: 10.5, color: ws.textDim }}>bilder</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 160 }}>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 11.5, color: ws.textDim }}>☁️ Sikret i B2 (One Desk)</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 700, color: (cap.assets?.securedPct ?? 0) >= 100 ? ws.green : ws.amber }}>{cap.assets?.securedPct ?? 0}%</Typography></Stack>
                <WsBar value={cap.assets?.securedPct ?? 0} color={(cap.assets?.securedPct ?? 0) >= 100 ? ws.green : ws.amber} height={5} />
                <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 0.25 }}>{cap.assets?.securedToB2 ?? 0} av {cap.assets?.total ?? 0} originaler verifisert</Typography>
              </Box>
            </Stack>

            {/* One Desk DIT — speilings-destinasjoner + hash-verifiserte kopier */}
            {dit?.hasBackup && (
              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${ws.borderSoft}` }}>
                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" gap={1}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 150 }}>
                    <Typography sx={{ fontSize: 13 }}>🖥️</Typography>
                    <Box>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>One Desk-speiling</Typography>
                      <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{dit.oneDeskHosts?.length ? dit.oneDeskHosts.join(', ') : 'Backup-helper'}</Typography>
                    </Box>
                  </Stack>
                  {(dit.destinations || []).map((d: any) => {
                    const ok = d.status === 'online' || d.status === 'connected' || d.status === 'ok' || d.status === 'active';
                    const ic = d.type === 'cloud' || d.storage === 'cloud' || d.cloud ? '☁️' : d.type === 'raid' || d.storage === 'raid' ? '🗄️' : '💾';
                    return (
                      <Stack key={d.id} direction="row" spacing={0.5} alignItems="center" sx={{ px: 1, py: 0.4, borderRadius: 1, bgcolor: ws.panelAlt }}>
                        <Typography sx={{ fontSize: 11 }}>{ic}</Typography>
                        <Typography sx={{ fontSize: 11, color: ws.text }}>{d.label || d.type || 'Destinasjon'}</Typography>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: ok ? ws.green : ws.textFaint }} />
                      </Stack>
                    );
                  })}
                  <Box sx={{ flex: 1 }} />
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: dit.jobs?.failed ? ws.amber : ws.green }}>
                      {dit.jobs?.verified ?? 0} hash-verifisert{dit.jobs?.copying ? ` · ${dit.jobs.copying} kopierer…` : ''}{dit.jobs?.failed ? ` · ${dit.jobs.failed} feilet` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{dit.jobs?.completed ?? 0} av {dit.jobs?.total ?? 0} jobber · xxHash64</Typography>
                  </Box>
                </Stack>

                {/* Per-take-rollup — hver take speilet+verifisert til N destinasjoner */}
                {Array.isArray(dit.takes) && dit.takes.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography sx={{ fontSize: 10, color: ws.textFaint, mb: 0.5 }}>
                      {dit.takes.length} take{dit.takes.length > 1 ? 's' : ''} · {dit.takes.filter((t: any) => t.fullyVerified).length} fullt verifisert
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
            title="Dagens tidslinje"
            action={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button size="small" onClick={() => go('produksjonskart')} sx={{ color: ws.text, textTransform: 'none', minWidth: 0 }}>I dag</Button>
                <IconButton size="small" sx={{ color: ws.textDim }}><ChevronLeft fontSize="small" /></IconButton>
                <IconButton size="small" sx={{ color: ws.textDim }}><ChevronRight fontSize="small" /></IconButton>
              </Stack>
            }
          />
          {/* Ruler */}
          <Box sx={{ position: 'relative', mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ px: 0.5 }}>
              {RULER.map((t) => <Typography key={t} sx={{ fontSize: 11, color: ws.textFaint }}>{t}</Typography>)}
            </Stack>
            <Box sx={{ position: 'relative', height: 1, bgcolor: ws.border, mt: 0.5 }}>
              {/* now-marker ~12:15 → ((12.25-8)/14)*100 ≈ 30.4% */}
              <Box sx={{ position: 'absolute', left: '30.4%', top: -18, transform: 'translateX(-50%)' }}>
                <Chip size="small" label="12:15" sx={{ height: 18, bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 800, fontSize: 11 }} />
                <Box sx={{ width: 1, height: 60, bgcolor: ws.accent, mx: 'auto', mt: 0.5, opacity: 0.6 }} />
              </Box>
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
                  <Typography sx={{ fontSize: 16 }}>{p.icon}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{p.label}</Typography>
                </Stack>
                <Typography sx={{ fontSize: 11.5, color: ws.textDim, mt: 0.5 }}>{p.time}</Typography>
              </Box>
            ))}
          </Stack>
        </WsCard>

        {/* Samkjøringsboard */}
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle icon={<ViewKanban sx={{ fontSize: 18, color: ws.textDim }} />} title="Samkjøringsboard" />
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto' }}>
            {boardCols.map((col) => (
              <Box key={col.role} sx={{ minWidth: 220, flex: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 14 }}>{col.icon}</Typography>
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
                    Legg til oppgave
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </WsCard>

        {/* Bunn-rad: Team Sync / Sjekkliste / Referanser */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Samkjøring (Team Sync)</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <WsRing value={syncPct} size={104} label={`${syncPct}%`} sub="Klar" color={syncPct >= 80 ? ws.green : ws.amber} />
              <Stack spacing={0.75} sx={{ flex: 1 }}>
                {syncItems.map((s, i) => (
                  <Stack key={i} direction="row" spacing={0.75} alignItems="center">
                    {s.ok ? <CheckCircle sx={{ fontSize: 16, color: ws.green }} /> : <RadioButtonUnchecked sx={{ fontSize: 16, color: ws.textFaint }} />}
                    <Typography sx={{ fontSize: 12.5, color: ws.text }}>{s.t}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
            <Button fullWidth size="small" onClick={() => go('prosjektplan')} sx={{ mt: 1.5, color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.border}` }}>Se detaljer</Button>
          </WsCard>

          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Sjekkliste</Typography>
            <Stack spacing={1}>
              {checkItems.map((c, i) => (
                <Stack key={c.id || i} direction="row" spacing={0.75} alignItems="center" onClick={() => c.real && toggleCheck(c.id, c.ok)} sx={{ cursor: c.real ? 'pointer' : 'default' }}>
                  {c.ok ? <CheckCircle sx={{ fontSize: 17, color: ws.green }} /> : <Warning sx={{ fontSize: 17, color: ws.amber }} />}
                  <Typography sx={{ fontSize: 12.5, color: ws.text }}>{c.t}</Typography>
                </Stack>
              ))}
            </Stack>
            <Button fullWidth size="small" onClick={addCheck} disabled={!isReal} sx={{ mt: 1.5, color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.border}` }}>{isReal ? '+ Legg til sjekkpunkt' : 'Se alle'}</Button>
          </WsCard>

          <WsCard>
            <WsSectionTitle title="Referanser & shots" action={<Button size="small" onClick={() => go('shotlist')} sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
            <WsImageGrid columns={3} addLabel="Legg til referanse" images={refs.images} onUpload={refs.onUpload} />
          </WsCard>
        </Box>
      </Box>

      {/* ───────── Capture-aktivitet + Team Chat (høyre) ───────── */}
      <Box sx={{ width: 340, flexShrink: 0 }}>
        {(isReal ? activity.length > 0 : true) && (
          <WsCard sx={{ mb: 2 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25 }}>
              <Typography sx={{ fontSize: 14 }}>⚡</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Capture-aktivitet</Typography>
              {capLive && <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.green }} /><Typography sx={{ fontSize: 10, color: ws.green, fontWeight: 700 }}>LIVE</Typography></Stack>}
            </Stack>
            <Stack spacing={0.25} sx={{ maxHeight: 280, overflowY: 'auto' }}>
              {(isReal ? activity : [
                { id: 'd1', type: 'asset_added', filename: 'A7IV_1188.CR3', createdAt: new Date(Date.now() - 30000).toISOString() },
                { id: 'd2', type: 'flagged_for_client', filename: 'A7IV_1184.CR3', createdAt: new Date(Date.now() - 180000).toISOString() },
                { id: 'd3', type: 'handoff_triggered', filename: null, createdAt: new Date(Date.now() - 900000).toISOString() },
              ]).map((ev: any) => {
                const m = activityMeta(ev.type);
                return (
                  <Stack key={ev.id} direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.65, px: 0.5, borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.3 }}>{m.icon}</Typography>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 12, color: ws.text, lineHeight: 1.35 }}>
                        {m.label}{ev.filename ? <Typography component="span" sx={{ color: ws.textDim }}> · {ev.filename}</Typography> : null}
                      </Typography>
                      <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{ev.actorName ? `${ev.actorName} · ` : ''}{timeAgo(ev.createdAt)}</Typography>
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
          </WsCard>
        )}
        <WorkspaceChatPanel projectId={projectId} />
      </Box>
    </Stack>
  );
};

export default OversiktTab;
