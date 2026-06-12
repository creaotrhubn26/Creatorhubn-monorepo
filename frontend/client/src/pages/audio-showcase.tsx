/**
 * audio-showcase.tsx — Feedback Studio (Audio Showcase)
 * ───────────────────────────────────────────────────────────────────────────
 * Profesjonelt mix/master-review-rom for musikkprodusent (jf. spec + mockup #2).
 * Design-paritet: header + waveform-spiller + versjoner + tidskodet kommentar-
 * tråd m/ resolve + godkjennings-bar + leveranse-status. ALT wired til de ekte
 * /api/audio-* -endepunktene — ingen stubs.
 *
 * Route: /audio-review/:projectId  (uten id → opprett-skjema)
 */

import React from 'react';
import { useParams } from 'wouter';
import {
  Box, Stack, Typography, Button, IconButton, Chip, TextField, Avatar, Divider,
  CircularProgress, MenuItem, Select, Tooltip,
} from '@mui/material';
import {
  Share, MoreVert, Download, Notifications, Send, CheckCircle, Schedule, Send as SendPlane,
  ContentCopy, Add, MusicNote, Star, RadioButtonUnchecked, DoneAll,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import AudioReviewPlayer, { MIX_CATEGORIES } from '@/components/universal/showcase/AudioReviewPlayer';

const BG = '#0B0B0C', PANEL = 'rgba(255,255,255,0.03)', BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.58)', ACCENT = '#FF6B35';
const fmt = (s: number) => `${Math.floor((s || 0) / 60)}:${Math.floor((s || 0) % 60).toString().padStart(2, '0')}`;

const Panel: React.FC<{ children: React.ReactNode; sx?: any }> = ({ children, sx }) => (
  <Box sx={{ bgcolor: PANEL, border: `1px solid ${BORDER}`, borderRadius: '16px', p: 2.5, ...sx }}>{children}</Box>
);

type CommentFilter = 'all' | 'unresolved' | 'resolved' | 'decision';

export default function AudioShowcasePage() {
  const params = useParams() as { projectId?: string };
  const projectId = params.projectId || '';

  const [project, setProject] = React.useState<any>(null);
  const [versions, setVersions] = React.useState<any[]>([]);
  const [currentVid, setCurrentVid] = React.useState<string>('');
  const [detail, setDetail] = React.useState<{ comments: any[]; sections: any[]; approvals: any[] }>({ comments: [], sections: [], approvals: [] });
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [filter, setFilter] = React.useState<CommentFilter>('all');
  const [draft, setDraft] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  // Opprett-skjema (når ingen projectId)
  const [newTitle, setNewTitle] = React.useState('');
  const [newBand, setNewBand] = React.useState('');

  const loadProject = React.useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiRequest(`/api/audio-showcases/${projectId}`);
      setProject(data.project);
      setVersions(data.versions || []);
      const cur = (data.versions || []).find((v: any) => v.status !== 'superseded') || (data.versions || [])[data.versions.length - 1];
      setCurrentVid(cur?.id || '');
    } catch { /* not found */ } finally { setLoading(false); }
  }, [projectId]);

  const loadVersion = React.useCallback(async (vid: string) => {
    if (!vid) { setDetail({ comments: [], sections: [], approvals: [] }); return; }
    try {
      const d = await apiRequest(`/api/audio-versions/${vid}`);
      setDetail({ comments: d.comments || [], sections: d.sections || [], approvals: d.approvals || [] });
    } catch { /* ignore */ }
  }, []);

  React.useEffect(() => { void loadProject(); }, [loadProject]);
  React.useEffect(() => { void loadVersion(currentVid); }, [currentVid, loadVersion]);

  const currentVersion = versions.find((v) => v.id === currentVid);

  const addComment = async (timecode: number, body: string, category: string) => {
    if (!currentVid || !body.trim()) return;
    try {
      const c = await apiRequest('/api/audio-comments', { method: 'POST', body: { versionId: currentVid, timecodeSeconds: timecode, body, category } });
      setDetail((p) => ({ ...p, comments: [...p.comments, c] }));
    } catch { /* ignore */ }
  };

  const setCommentStatus = async (id: string, status: string) => {
    try {
      const c = await apiRequest(`/api/audio-comments/${id}`, { method: 'PATCH', body: { status } });
      setDetail((p) => ({ ...p, comments: p.comments.map((x) => (x.id === id ? c : x)) }));
    } catch { /* ignore */ }
  };

  const approve = async (approvalType: string) => {
    if (!currentVid) return;
    setBusy(true);
    try {
      await apiRequest(`/api/audio-versions/${currentVid}/approve`, { method: 'POST', body: { approvalType } });
      await loadProject(); await loadVersion(currentVid);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const uploadVersion = async () => {
    const url = window.prompt('Lim inn URL til lydfilen (WAV/MP3) for ny versjon:');
    if (!url) return;
    setBusy(true);
    try {
      const v = await apiRequest('/api/audio-versions', { method: 'POST', body: { projectId, fileUrl: url.trim() } });
      await loadProject(); setCurrentVid(v.id);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const createProject = async () => {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const p = await apiRequest('/api/audio-showcases', { method: 'POST', body: { title: newTitle.trim(), bandName: newBand.trim() || null } });
      window.location.href = `/audio-review/${p.id}`;
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const copyLink = () => { void navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  // ── Opprett-skjema ──────────────────────────────────────────────────────
  if (!projectId) {
    return (
      <Box sx={{ bgcolor: BG, minHeight: '100vh', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Panel sx={{ maxWidth: 460, width: '100%' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <MusicNote sx={{ color: ACCENT }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem' }}>Nytt mix/master-review</Typography>
          </Stack>
          <Stack spacing={1.5}>
            <TextField label="Tittel" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} size="small" sx={fieldSx} />
            <TextField label="Band / artist (valgfritt)" value={newBand} onChange={(e) => setNewBand(e.target.value)} size="small" sx={fieldSx} />
            <Button onClick={createProject} disabled={busy || !newTitle.trim()} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>
              {busy ? 'Oppretter…' : 'Opprett review-rom'}
            </Button>
          </Stack>
        </Panel>
      </Box>
    );
  }

  if (loading) {
    return <Box sx={{ bgcolor: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  }
  if (!project) {
    return <Box sx={{ bgcolor: BG, minHeight: '100vh', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ color: MUTED }}>Fant ikke review-rommet.</Typography></Box>;
  }

  const metaLine = [project.genre, project.bpm ? `${project.bpm} BPM` : null, project.musical_key].filter(Boolean).join(' · ');
  const visibleComments = detail.comments.filter((c) =>
    filter === 'all' ? true : filter === 'decision' ? c.is_decision : c.status === filter);
  const statusChipColor = project.status === 'approved' || project.status === 'final_delivered' ? '#5fb88a' : project.status === 'changes_requested' ? '#e0a955' : ACCENT;

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100vh', color: TEXT, p: { xs: 1.5, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.1 }}>{project.title}</Typography>
            <Star sx={{ color: MUTED, fontSize: 20 }} />
            <Chip label={(project.status || 'draft').replace('_', ' ')} size="small" sx={{ bgcolor: `${statusChipColor}28`, color: statusChipColor, fontWeight: 700, textTransform: 'capitalize' }} />
          </Stack>
          <Typography sx={{ color: MUTED, fontSize: '0.85rem' }}>{[project.band_name, metaLine].filter(Boolean).join('  ·  ')}</Typography>
        </Box>
        <IconButton sx={{ color: MUTED }}><Notifications /></IconButton>
        <Tooltip title={copied ? 'Kopiert!' : 'Kopier review-lenke'}>
          <Button startIcon={copied ? <DoneAll /> : <Share />} onClick={copyLink} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', '&:hover': { bgcolor: '#ff855a' } }}>Del</Button>
        </Tooltip>
        <IconButton sx={{ color: MUTED }}><MoreVert /></IconButton>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.7fr 1fr' }, gap: 2.5, alignItems: 'start' }}>
        {/* ── Senter ── */}
        <Stack spacing={2.5}>
          <Panel>
            <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
              <Select value={currentVid} onChange={(e) => setCurrentVid(e.target.value)} size="small" variant="standard" disableUnderline
                sx={{ color: TEXT, fontWeight: 700, '& .MuiSvgIcon-root': { color: MUTED } }}>
                {versions.map((v) => <MenuItem key={v.id} value={v.id}>{v.version_label}{v.status === 'superseded' ? ' (forrige)' : v.status === 'approved' ? ' ✓' : ''}</MenuItem>)}
              </Select>
              <Box sx={{ flex: 1 }} />
              {currentVersion?.file_url && <Button startIcon={<Download />} size="small" href={currentVersion.file_url} target="_blank" sx={{ color: TEXT, textTransform: 'none' }}>Last ned</Button>}
            </Stack>
            {currentVersion ? (
              <AudioReviewPlayer
                src={currentVersion.file_url}
                comments={detail.comments.map((c) => ({ id: c.id, timecode: Number(c.timecode_seconds), comment: c.body, author: c.author, category: c.category }))}
                onAddComment={addComment}
                accentColor={ACCENT}
              />
            ) : <Typography sx={{ color: MUTED }}>Ingen versjon ennå. Last opp en bounce for å starte.</Typography>}
          </Panel>

          {/* Versjoner */}
          {versions.length > 0 && (
            <Panel>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Versjoner</Typography>
              <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                {versions.map((v) => (
                  <Box key={v.id} onClick={() => setCurrentVid(v.id)} sx={{ flex: '1 1 170px', p: 1.5, borderRadius: '12px', cursor: 'pointer', border: `1px solid ${v.id === currentVid ? ACCENT : BORDER}`, bgcolor: v.id === currentVid ? 'rgba(255,107,53,0.08)' : 'transparent' }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{v.version_label}</Typography>
                      {v.status === 'approved' && <CheckCircle sx={{ fontSize: 16, color: '#5fb88a' }} />}
                    </Stack>
                    <Typography sx={{ color: MUTED, fontSize: '0.72rem', textTransform: 'capitalize' }}>{(v.status || '').replace('_', ' ')}</Typography>
                  </Box>
                ))}
              </Stack>
            </Panel>
          )}

          {/* Leveranse-status — utledet fra ekte prosjekt-status + godkjenninger */}
          <Panel>
            <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Leveranse-status</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              {[
                { icon: <SendPlane />, label: 'Bounce sendt', done: versions.length > 0 },
                { icon: <Schedule />, label: 'Venter på feedback', active: project.status === 'under_review' },
                { icon: <CheckCircle />, label: 'Godkjent', done: project.status === 'approved' || project.status === 'final_delivered' },
              ].map((s, i) => (
                <Box key={i} sx={{ flex: 1, p: 1.5, borderRadius: '12px', border: `1px solid ${s.active ? ACCENT : BORDER}`, bgcolor: s.done ? 'rgba(95,184,138,0.08)' : s.active ? 'rgba(255,107,53,0.06)' : 'transparent', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ color: s.done ? '#5fb88a' : s.active ? ACCENT : MUTED, display: 'flex' }}>{s.icon}</Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.label}</Typography>
                </Box>
              ))}
            </Stack>
          </Panel>

          {/* Godkjennings-bar */}
          <Panel sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, flex: 1 }}>Samarbeid. Forfin. Lever.</Typography>
            <Button onClick={() => approve('changes_requested')} disabled={busy || !currentVid} variant="outlined" sx={{ color: TEXT, borderColor: BORDER, textTransform: 'none', borderRadius: '999px' }}>Be om endringer</Button>
            <Button onClick={() => approve('mix_approved')} disabled={busy || !currentVid} variant="contained" startIcon={<CheckCircle />} sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', '&:hover': { bgcolor: '#ff855a' } }}>Godkjenn mix</Button>
            <Button onClick={uploadVersion} disabled={busy} variant="outlined" startIcon={<Add />} sx={{ color: TEXT, borderColor: BORDER, textTransform: 'none', borderRadius: '999px' }}>Last opp ny versjon</Button>
          </Panel>
        </Stack>

        {/* ── Kommentarer ── */}
        <Panel sx={{ p: 0, display: 'flex', flexDirection: 'column', maxHeight: { lg: 'calc(100vh - 130px)' } }}>
          <Box sx={{ p: 2.5, pb: 1.5, borderBottom: `1px solid ${BORDER}` }}>
            <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontWeight: 700, flex: 1 }}>Kommentarer</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              {([['all', 'Alle'], ['unresolved', 'Uløst'], ['resolved', 'Løst'], ['decision', 'Beslutninger']] as [CommentFilter, string][]).map(([k, lbl]) => (
                <Chip key={k} label={lbl} size="small" onClick={() => setFilter(k)}
                  sx={{ height: 24, fontSize: '0.72rem', cursor: 'pointer', bgcolor: filter === k ? ACCENT : 'rgba(255,255,255,0.06)', color: filter === k ? '#150d05' : MUTED, fontWeight: filter === k ? 700 : 500 }} />
              ))}
            </Stack>
          </Box>
          <Stack sx={{ overflowY: 'auto', flex: 1 }}>
            {visibleComments.length === 0 && <Typography sx={{ p: 2.5, color: MUTED, fontSize: '0.85rem' }}>Ingen kommentarer i dette filteret.</Typography>}
            {visibleComments.map((c) => {
              const cat = MIX_CATEGORIES.find((x) => x.key === c.category);
              return (
                <Box key={c.id} sx={{ p: 2.5, py: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Avatar sx={{ width: 30, height: 30, fontSize: '0.78rem', bgcolor: 'rgba(255,107,53,0.18)', color: ACCENT }}>{(c.author || '?').charAt(0).toUpperCase()}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.84rem' }}>{c.author || 'Bruker'}</Typography>
                        <Chip label={fmt(Number(c.timecode_seconds))} size="small" sx={{ height: 18, fontSize: '0.66rem', bgcolor: 'rgba(255,107,53,0.16)', color: ACCENT, fontWeight: 700 }} />
                        {cat && <Typography sx={{ color: cat.color, fontSize: '0.7rem', fontWeight: 700 }}>{cat.label}</Typography>}
                      </Stack>
                      <Typography sx={{ color: 'rgba(245,242,234,0.88)', fontSize: '0.88rem', mt: 0.5 }}>{c.body}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} alignItems="center">
                        {c.status === 'resolved'
                          ? <Chip icon={<CheckCircle />} label="Løst" size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'rgba(95,184,138,0.16)', color: '#5fb88a', '& .MuiChip-icon': { color: '#5fb88a' } }} />
                          : <Button size="small" startIcon={<RadioButtonUnchecked />} onClick={() => setCommentStatus(c.id, 'resolved')} sx={{ color: MUTED, textTransform: 'none', fontSize: '0.72rem', minWidth: 0 }}>Marker løst</Button>}
                      </Stack>
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
          <Box sx={{ p: 2, borderTop: `1px solid ${BORDER}` }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField fullWidth size="small" placeholder="Skriv en kommentar…" value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { void addComment(0, draft.trim(), 'general'); setDraft(''); } }}
                sx={{ '& .MuiInputBase-input': { color: TEXT }, '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER } }} />
              <IconButton onClick={() => { if (draft.trim()) { void addComment(0, draft.trim(), 'general'); setDraft(''); } }} sx={{ color: ACCENT }}><Send /></IconButton>
            </Stack>
          </Box>
        </Panel>
      </Box>
    </Box>
  );
}

const fieldSx = {
  '& .MuiInputBase-input': { color: TEXT },
  '& .MuiInputLabel-root': { color: MUTED },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
};
