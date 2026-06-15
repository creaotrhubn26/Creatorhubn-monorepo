/**
 * WarmupDialog — produsenten setter sammen en «Oppvarming & fokus»-rutine fra
 * EaseVerse-innholdet (vokal/kropp/pust/mindfulness), tilordner band/vokalist,
 * og ser hvem som er klar. Innholdet hentes fra EaseVerse via collab-API.
 */
import React from 'react';
import {
  Box, Stack, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Checkbox, Chip, CircularProgress, Divider, IconButton,
} from '@mui/material';
import { SelfImprovement, CheckCircle, DeleteOutline, GraphicEq, Air, FitnessCenter, CloudUpload, MusicNote } from '@mui/icons-material';
import { apiRequest, getAuthHeader } from '@/lib/queryClient';

const PANEL = '#131316', BORDER = 'rgba(255,255,255,0.08)', TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', FAINT = 'rgba(245,242,234,0.38)', ACCENT = '#FF6B35', GREEN = '#5fb88a';
const fieldSx = { '& .MuiInputBase-input': { color: TEXT }, '& .MuiInputLabel-root': { color: MUTED }, '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER } };
const TARGETS: [string, string][] = [['all', 'Alle'], ['vocalist', 'Vokalist'], ['instrument', 'Instrument']];

const WarmupDialog: React.FC<{ open: boolean; projectId: string; onClose: () => void }> = ({ open, projectId, onClose }) => {
  const [lib, setLib] = React.useState<any>(null);
  const [routines, setRoutines] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');
  const [target, setTarget] = React.useState('all');
  const [note, setNote] = React.useState('');
  const [picked, setPicked] = React.useState<Record<string, any>>({});
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const audioInputRef = React.useRef<HTMLInputElement>(null);

  // Produsenten laster opp sin egen oppvarmings-lyd (gjenbruker /api/upload/audio).
  const uploadAudio = async (file?: File | null) => {
    if (!file) return; setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const headers = await getAuthHeader(); delete (headers as any)['Content-Type'];
      const res = await fetch('/api/upload/audio', { method: 'POST', headers, body: fd });
      if (!res.ok) return;
      const { url } = await res.json();
      if (!url) return;
      const durationSec = await new Promise<number>((resolve) => { const a = new Audio(); a.onloadedmetadata = () => resolve(Math.round(a.duration) || 60); a.onerror = () => resolve(60); a.src = url; });
      const key = `custom:${Date.now()}`;
      setPicked((p) => ({ ...p, [key]: { sourceId: key, title: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Egen oppvarming', type: 'custom', durationSec, audioUrl: url, instruction: 'Egen lydfil fra produsenten — følg med og varm opp.' } }));
    } catch { /* */ } finally { setUploading(false); }
  };

  const loadRoutines = React.useCallback(() => apiRequest(`/api/audio-showcases/${projectId}/warmups`).then((d: any) => setRoutines(d.routines || [])).catch(() => setRoutines([])), [projectId]);
  React.useEffect(() => {
    if (!open) return; setLoading(true);
    Promise.all([
      apiRequest('/api/audio-showcase/warmup-library').then(setLib).catch(() => setLib(null)),
      loadRoutines(),
    ]).finally(() => setLoading(false));
  }, [open, loadRoutines]);

  const toggle = (key: string, step: any) => setPicked((p) => { const n = { ...p }; if (n[key]) delete n[key]; else n[key] = step; return n; });
  const steps = Object.values(picked);
  const save = async () => {
    if (!title.trim() || steps.length === 0) return; setBusy(true);
    try {
      await apiRequest(`/api/audio-showcases/${projectId}/warmups`, { method: 'POST', body: { title: title.trim(), target, note: note.trim() || undefined, steps } });
      setTitle(''); setNote(''); setPicked({}); await loadRoutines();
    } catch { /* */ } finally { setBusy(false); }
  };
  const del = async (id: string) => { await apiRequest(`/api/warmups/${id}`, { method: 'DELETE' }); await loadRoutines(); };

  const catIcon = (c: string) => /breath|pust/i.test(c) ? <Air sx={{ fontSize: 16 }} /> : /body|kropp/i.test(c) ? <FitnessCenter sx={{ fontSize: 16 }} /> : <GraphicEq sx={{ fontSize: 16 }} />;
  const Item = ({ k, step, sub }: { k: string; step: any; sub?: string }) => (
    <Stack direction="row" alignItems="center" spacing={1} onClick={() => toggle(k, step)} sx={{ py: 0.5, px: 1, borderRadius: '8px', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
      <Checkbox checked={!!picked[k]} size="small" sx={{ p: 0.25, color: MUTED, '&.Mui-checked': { color: ACCENT } }} />
      <Box sx={{ color: FAINT, display: 'flex' }}>{catIcon(step.type)}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }} noWrap>{step.title}</Typography>
        {sub && <Typography sx={{ fontSize: '0.66rem', color: MUTED }} noWrap>{sub}</Typography>}
      </Box>
      <Typography sx={{ fontSize: '0.66rem', color: FAINT }}>{Math.round((step.durationSec || 0) / 60) || 1} min</Typography>
    </Stack>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}><SelfImprovement sx={{ color: ACCENT }} /> Oppvarming & fokus
        <Chip label="fra EaseVerse" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.08)', color: MUTED }} /></DialogTitle>
      <DialogContent>
        {loading ? <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box> : (
          <Stack direction="row" spacing={2}>
            {/* Bygg rutine */}
            <Stack spacing={1.25} sx={{ flex: 1, minWidth: 0 }}>
              <TextField label="Rutinenavn (f.eks. «Vokal før refreng»)" value={title} onChange={(e) => setTitle(e.target.value)} size="small" sx={fieldSx} />
              <Stack direction="row" spacing={0.5}>{TARGETS.map(([v, l]) => <Chip key={v} label={l} onClick={() => setTarget(v)} size="small" sx={{ bgcolor: target === v ? 'rgba(255,107,53,0.18)' : 'rgba(255,255,255,0.06)', color: target === v ? ACCENT : MUTED, fontWeight: target === v ? 700 : 400 }} />)}</Stack>
              {!lib ? <Typography sx={{ fontSize: '0.74rem', color: '#e0a955' }}>Får ikke kontakt med EaseVerse-innholdet akkurat nå.</Typography> : (
                <Box sx={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: '10px', p: 0.5 }}>
                  <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Vokal & kropp</Typography>
                  {(lib.warmups || []).map((w: any) => <Item key={w.id} k={`w:${w.id}`} step={{ sourceId: w.id, title: w.title, type: w.category, durationSec: w.durationSeconds, instruction: w.instruction }} sub={w.subtitle} />)}
                  <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Pust</Typography>
                  {(lib.breathing || []).map((b: any) => <Item key={b.id} k={`b:${b.id}`} step={{ sourceId: b.id, title: b.title, type: 'breath', durationSec: (b.inhale + b.hold + b.exhale + (b.holdAfter || 0)) * (b.cycles || 4), instruction: b.description, breathing: { inhale: b.inhale, hold: b.hold, exhale: b.exhale, holdAfter: b.holdAfter, cycles: b.cycles } }} sub={`${b.inhale}-${b.hold}-${b.exhale}${b.holdAfter ? '-' + b.holdAfter : ''}`} />)}
                  <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Mindfulness / fokus</Typography>
                  {(lib.techniques || []).map((t: any) => <Item key={t.id} k={`t:${t.id}`} step={{ sourceId: t.id, title: t.title, type: 'mindfulness', durationSec: t.durationSeconds, instruction: (t.steps || []).join(' · ') }} sub={t.description} />)}
                  <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Visualisering</Typography>
                  {(lib.visualizations || []).map((v: any) => <Item key={v.id} k={`v:${v.id}`} step={{ sourceId: v.id, title: v.title, type: 'visualization', durationSec: v.durationSeconds, instruction: (v.narration || []).join(' · ') }} sub={v.bestFor} />)}
                  {(lib.affirmations || []).length > 0 && <Typography sx={{ fontSize: '0.62rem', color: FAINT, textTransform: 'uppercase', px: 1, pt: 0.5 }}>Affirmasjoner</Typography>}
                  {(lib.affirmations || []).length > 0 && <Item k="aff" step={{ sourceId: 'affirmations', title: 'Affirmasjoner', type: 'affirmation', durationSec: 45, instruction: (lib.affirmations || []).slice(0, 6).map((a: any) => a.text).join('  ·  ') }} sub="Gjenta rolig før opptak" />}
                </Box>
              )}
              {/* Egen oppvarmings-lyd */}
              <Stack spacing={0.5}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Button onClick={() => audioInputRef.current?.click()} disabled={uploading} startIcon={uploading ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <CloudUpload sx={{ fontSize: '16px !important' }} />} size="small" sx={{ color: ACCENT, textTransform: 'none', fontSize: '0.72rem' }}>{uploading ? 'Laster opp…' : 'Last opp egen oppvarmings-lyd'}</Button>
                  <input ref={audioInputRef} type="file" accept="audio/*" hidden onChange={(e) => { void uploadAudio(e.target.files?.[0]); e.target.value = ''; }} />
                </Stack>
                {steps.filter((s: any) => s.type === 'custom').map((s: any) => (
                  <Stack key={s.sourceId} direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', px: 1, py: 0.5 }}>
                    <MusicNote sx={{ fontSize: 15, color: ACCENT }} />
                    <Typography sx={{ fontSize: '0.76rem', flex: 1 }} noWrap>{s.title}</Typography>
                    <Typography sx={{ fontSize: '0.66rem', color: FAINT }}>{Math.round(s.durationSec / 60) || 1} min</Typography>
                    <IconButton size="small" onClick={() => toggle(s.sourceId, s)} sx={{ color: FAINT, p: 0.25 }}><DeleteOutline sx={{ fontSize: 15 }} /></IconButton>
                  </Stack>
                ))}
              </Stack>
              <TextField label="Beskjed til medlemmet (valgfri)" value={note} onChange={(e) => setNote(e.target.value)} size="small" multiline minRows={2} sx={fieldSx} />
              <Button onClick={save} disabled={busy || !title.trim() || steps.length === 0} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>{busy ? 'Lagrer…' : `Tilordne rutine (${steps.length} steg)`}</Button>
            </Stack>
            <Divider orientation="vertical" flexItem sx={{ borderColor: BORDER }} />
            {/* Tilordnede rutiner + hvem er klar */}
            <Stack spacing={1} sx={{ width: 260 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: MUTED }}>Tilordnet</Typography>
              {routines.length === 0 && <Typography sx={{ fontSize: '0.74rem', color: FAINT }}>Ingen rutiner ennå.</Typography>}
              {routines.map((r) => (
                <Box key={r.id} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', p: 1.25 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, flex: 1 }} noWrap>{r.title}</Typography>
                    <Chip label={TARGETS.find((t) => t[0] === r.target)?.[1] || r.target} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(255,107,53,0.14)', color: ACCENT }} />
                    <IconButton size="small" onClick={() => del(r.id)} sx={{ color: FAINT, p: 0.25 }}><DeleteOutline sx={{ fontSize: 15 }} /></IconButton>
                  </Stack>
                  <Typography sx={{ fontSize: '0.66rem', color: MUTED }}>{(r.steps || []).length} steg</Typography>
                  {(r.completions || []).length > 0
                    ? <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.5 }}>{r.completions.map((c: any) => <Chip key={c.name} icon={<CheckCircle sx={{ fontSize: '12px !important' }} />} label={c.name} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(95,184,138,0.16)', color: GREEN, '& .MuiChip-icon': { color: GREEN } }} />)}</Stack>
                    : <Typography sx={{ fontSize: '0.62rem', color: FAINT, mt: 0.5 }}>Ingen har fullført ennå</Typography>}
                </Box>
              ))}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={onClose} sx={{ color: MUTED, textTransform: 'none' }}>Lukk</Button></DialogActions>
    </Dialog>
  );
};

export default WarmupDialog;
