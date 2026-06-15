/**
 * LyricTimingDialog — «tap-to-time»: spill av masteren og tapp på hver tekstlinje
 * i takt for å lage beat-synket timing (lagres som sekunder per linje). Driver
 * karaoke-lyric-videoen på YouTube.
 */
import React from 'react';
import {
  Box, Stack, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, CircularProgress, LinearProgress,
} from '@mui/material';
import { PlayArrow, Pause, Replay, TouchApp, Undo, CheckCircle } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

const PANEL = '#131316', BORDER = 'rgba(255,255,255,0.08)', TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', FAINT = 'rgba(245,242,234,0.38)', ACCENT = '#FF6B35', GREEN = '#5fb88a';
const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

const LyricTimingDialog: React.FC<{ open: boolean; projectId: string; masterUrl?: string; onClose: () => void; onSaved?: () => void }> = ({ open, projectId, masterUrl, onClose, onSaved }) => {
  const [loading, setLoading] = React.useState(true);
  const [lines, setLines] = React.useState<string[]>([]);
  const [timing, setTiming] = React.useState<(number | null)[]>([]);
  const [cursor, setCursor] = React.useState(0); // neste linje som skal tappes
  const [playing, setPlaying] = React.useState(false);
  const [cur, setCur] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return; setLoading(true); setCursor(0);
    apiRequest(`/api/audio-showcases/${projectId}/lyric-timing`).then((d: any) => {
      setLines(d.lines || []);
      setTiming(d.timing && d.timing.length === (d.lines || []).length ? d.timing : new Array((d.lines || []).length).fill(null));
    }).catch(() => { setLines([]); setTiming([]); }).finally(() => setLoading(false));
  }, [open, projectId]);

  const tap = React.useCallback(() => {
    const a = audioRef.current; if (!a || cursor >= lines.length) return;
    const t = Math.max(0, a.currentTime);
    setTiming((prev) => { const n = [...prev]; n[cursor] = Math.round(t * 100) / 100; return n; });
    setCursor((c) => Math.min(c + 1, lines.length));
  }, [cursor, lines.length]);

  const undo = () => { setCursor((c) => { const i = Math.max(0, c - 1); setTiming((prev) => { const n = [...prev]; n[i] = null; return n; }); return i; }); };
  const reset = () => { setTiming(new Array(lines.length).fill(null)); setCursor(0); };
  const togglePlay = () => { const a = audioRef.current; if (!a) return; if (a.paused) { void a.play(); } else a.pause(); };

  // Spacebar = tap, mens dialog er åpen.
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); tap(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [open, tap]);

  React.useEffect(() => { // auto-scroll til aktiv linje
    listRef.current?.querySelector('[data-active="1"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [cursor]);

  const allTimed = lines.length > 0 && timing.every((t) => typeof t === 'number');
  const monotonic = timing.every((t, i) => t == null || i === 0 || timing[i - 1] == null || (t as number) >= (timing[i - 1] as number));

  const save = async () => {
    if (!allTimed || !monotonic) return; setBusy(true);
    try { await apiRequest(`/api/audio-showcases/${projectId}/lyric-timing`, { method: 'PUT', body: { timing } }); onSaved?.(); onClose(); }
    catch { /* */ } finally { setBusy(false); }
  };
  const [autoMsg, setAutoMsg] = React.useState('');
  const autoFromEaseVerse = async () => {
    setBusy(true); setAutoMsg('');
    try {
      const r = await apiRequest(`/api/audio-showcases/${projectId}/lyric-timing/from-easeverse`, { method: 'POST', body: {} });
      if (r?.ok) { const d = await apiRequest(`/api/audio-showcases/${projectId}/lyric-timing`); setTiming(d.timing && d.timing.length === lines.length ? d.timing : timing); setCursor(lines.length); setAutoMsg(`Hentet timing for ${r.count} linjer fra EaseVerse ✓`); }
      else setAutoMsg(r?.reason === 'no_take_timing' ? 'Ingen analysert take i EaseVerse ennå — ta opp i booten først.' : 'Fant ikke timing.');
    } catch { setAutoMsg('Auto-henting feilet.'); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}><TouchApp sx={{ color: ACCENT }} /> Tidssett sangtekst (tap-to-time)</DialogTitle>
      <DialogContent>
        {loading ? <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>
          : lines.length === 0 ? <Typography sx={{ color: MUTED, py: 2 }}>Ingen sangtekst funnet på den koblede låta.</Typography>
            : (
              <Stack spacing={1.5}>
                <Typography sx={{ fontSize: '0.8rem', color: MUTED }}>Spill av masteren og trykk <b>Tapp</b> (eller mellomrom) i det hver linje begynner. Du kan angre eller nullstille.</Typography>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)', borderRadius: '10px', p: 1 }}>
                  <Box sx={{ flex: 1 }}><Typography sx={{ fontSize: '0.74rem', fontWeight: 700 }}>Auto fra EaseVerse</Typography><Typography sx={{ fontSize: '0.66rem', color: MUTED }}>{autoMsg || 'Bruk vokalistens analyserte take (ord-timing) til å sette tidene automatisk.'}</Typography></Box>
                  <Button onClick={autoFromEaseVerse} disabled={busy} size="small" variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', whiteSpace: 'nowrap' }}>Hent timing</Button>
                </Stack>
                {/* Transport */}
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', p: 1 }}>
                  <IconButton onClick={togglePlay} sx={{ color: '#150d05', bgcolor: ACCENT, '&:hover': { bgcolor: '#ff855a' } }}>{playing ? <Pause /> : <PlayArrow />}</IconButton>
                  <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem' }}>{fmt(cur)}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <Button onClick={undo} startIcon={<Undo />} size="small" disabled={cursor === 0} sx={{ color: MUTED, textTransform: 'none' }}>Angre</Button>
                  <Button onClick={reset} startIcon={<Replay />} size="small" sx={{ color: MUTED, textTransform: 'none' }}>Nullstill</Button>
                </Stack>
                <LinearProgress variant="determinate" value={lines.length ? (timing.filter((t) => t != null).length / lines.length) * 100 : 0} sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: GREEN } }} />
                {/* Linjer */}
                <Box ref={listRef} sx={{ maxHeight: 280, overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
                  {lines.map((ln, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1} data-active={i === cursor ? '1' : '0'}
                      sx={{ px: 1.5, py: 0.85, borderBottom: i < lines.length - 1 ? `1px solid ${BORDER}` : 'none', bgcolor: i === cursor ? 'rgba(255,107,53,0.14)' : 'transparent' }}>
                      <Typography sx={{ width: 52, fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', color: timing[i] != null ? GREEN : FAINT }}>{timing[i] != null ? fmt(timing[i] as number) : '—'}</Typography>
                      <Typography sx={{ flex: 1, fontSize: '0.84rem', fontWeight: i === cursor ? 700 : 400, color: i === cursor ? TEXT : MUTED }} noWrap>{ln}</Typography>
                      {timing[i] != null && <CheckCircle sx={{ fontSize: 15, color: GREEN }} />}
                    </Stack>
                  ))}
                </Box>
                <Button onClick={tap} disabled={cursor >= lines.length} startIcon={<TouchApp />} variant="contained" size="large"
                  sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 800, textTransform: 'none', borderRadius: '12px', py: 1.25 }}>
                  {cursor >= lines.length ? 'Alle linjer tidssatt' : `Tapp linje ${cursor + 1} / ${lines.length}  ·  mellomrom`}
                </Button>
                {!monotonic && <Typography sx={{ fontSize: '0.72rem', color: '#e0606a' }}>Tidene må stige. Bruk Angre og tapp på nytt.</Typography>}
                {masterUrl && <audio ref={audioRef} src={masterUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => setCur((e.target as HTMLAudioElement).currentTime)} />}
                {!masterUrl && <Typography sx={{ fontSize: '0.72rem', color: '#e0a955' }}>Ingen master-lyd å spille av — last opp en versjon først.</Typography>}
              </Stack>
            )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: MUTED, textTransform: 'none' }}>Lukk</Button>
        <Button onClick={save} disabled={busy || !allTimed || !monotonic} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>{busy ? 'Lagrer…' : 'Lagre timing'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LyricTimingDialog;
