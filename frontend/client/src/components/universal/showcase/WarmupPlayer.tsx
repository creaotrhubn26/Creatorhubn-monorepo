/**
 * WarmupPlayer — medlemmets «Oppvarming & fokus» på delingssiden. Viser rutiner
 * tilordnet av produsenten (fra EaseVerse-innhold) og kjører en guidet flyt:
 * nedtelling per steg, pust-animasjon for pust/mindfulness, og en referansetone
 * (Web Audio drone) i låtas toneart for vokal-steg. Markerer fullført.
 */
import React from 'react';
import {
  Box, Stack, Typography, Button, Dialog, DialogContent, IconButton, LinearProgress, Chip,
} from '@mui/material';
import { SelfImprovement, CheckCircle, PlayArrow, Pause, SkipNext, Close, MusicNote } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

const PANEL = '#131316', BORDER = 'rgba(255,255,255,0.08)', TEXT = '#F5F2EA', MUTED = 'rgba(245,242,234,0.55)', FAINT = 'rgba(245,242,234,0.38)', ACCENT = '#FF6B35', GREEN = '#5fb88a';

// toneart → tonika-frekvens (oktav ~4) for referansetone-drone.
const NOTE_FREQ: Record<string, number> = { C: 261.63, 'C#': 277.18, D: 293.66, 'D#': 311.13, E: 329.63, F: 349.23, 'F#': 369.99, G: 392.0, 'G#': 415.3, A: 440.0, 'A#': 466.16, B: 493.88 };
function keyToFreq(key?: string): number | null {
  if (!key) return null;
  const m = key.trim().match(/^([A-Ga-g])([#b♯♭]?)/); if (!m) return null;
  let note = m[1].toUpperCase() + (m[2] === '#' || m[2] === '♯' ? '#' : '');
  if (m[2] === 'b' || m[2] === '♭') { const flats: Record<string, string> = { A: 'G#', B: 'A#', C: 'B', D: 'C#', E: 'D#', F: 'E', G: 'F#' }; note = flats[m[1].toUpperCase()] || m[1].toUpperCase(); }
  return NOTE_FREQ[note] ?? null;
}

const WarmupPlayer: React.FC<{ token: string; musicalKey?: string }> = ({ token, musicalKey }) => {
  const [routines, setRoutines] = React.useState<any[]>([]);
  const [active, setActive] = React.useState<any | null>(null);
  const [stepIdx, setStepIdx] = React.useState(0);
  const [remaining, setRemaining] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const audioCtx = React.useRef<AudioContext | null>(null);
  const osc = React.useRef<{ o: OscillatorNode; g: GainNode } | null>(null);
  const [drone, setDrone] = React.useState(false);

  const load = React.useCallback(() => apiRequest(`/api/audio-review-shared/${token}/warmup`).then((d: any) => setRoutines(d.routines || [])).catch(() => setRoutines([])), [token]);
  React.useEffect(() => { if (token) load(); }, [token, load]);

  const step = active?.steps?.[stepIdx];
  // Nedtelling
  React.useEffect(() => {
    if (!playing || !step) return;
    const t = setInterval(() => setRemaining((r) => { if (r <= 1) { clearInterval(t); next(); return 0; } return r - 1; }), 1000);
    return () => clearInterval(t);
  }, [playing, stepIdx, active]); // eslint-disable-line

  const stopDrone = () => { if (osc.current) { try { osc.current.o.stop(); } catch { /* */ } osc.current = null; } setDrone(false); };
  const toggleDrone = () => {
    if (drone) { stopDrone(); return; }
    const f = keyToFreq(musicalKey); if (!f) return;
    audioCtx.current ||= new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx.current; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; g.gain.value = 0.12; o.connect(g); g.connect(ctx.destination); o.start();
    osc.current = { o, g }; setDrone(true);
  };

  const startRoutine = (r: any) => { setActive(r); setStepIdx(0); setRemaining(r.steps?.[0]?.durationSec || 60); setPlaying(true); };
  const next = () => { stopDrone(); setStepIdx((i) => { const ni = i + 1; if (active && ni < active.steps.length) { setRemaining(active.steps[ni].durationSec || 60); return ni; } setPlaying(false); return i; }); };
  const isLast = active && stepIdx >= (active.steps.length - 1);
  const finish = async () => { stopDrone(); try { await apiRequest(`/api/audio-review-shared/${token}/warmup/${active.id}/complete`, { method: 'POST', body: {} }); } catch { /* */ } setActive(null); setPlaying(false); await load(); };
  const close = () => { stopDrone(); setActive(null); setPlaying(false); };

  if (routines.length === 0) return null;

  return (
    <Box sx={{ bgcolor: 'rgba(255,107,53,0.07)', border: '1px solid rgba(255,107,53,0.3)', borderRadius: '16px', p: 2, mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <SelfImprovement sx={{ color: ACCENT }} /><Typography sx={{ fontWeight: 700, flex: 1 }}>Anbefalt før opptak</Typography>
      </Stack>
      <Stack spacing={1}>
        {routines.map((r) => (
          <Stack key={r.id} direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px', p: 1.25 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography sx={{ fontSize: '0.86rem', fontWeight: 700 }} noWrap>{r.title}</Typography>
                {r.completed && <CheckCircle sx={{ fontSize: 15, color: GREEN }} />}
              </Stack>
              <Typography sx={{ fontSize: '0.7rem', color: MUTED }}>{(r.steps || []).length} steg · ~{Math.round((r.steps || []).reduce((a: number, s: any) => a + (s.durationSec || 0), 0) / 60) || 1} min</Typography>
              {r.note && <Typography sx={{ fontSize: '0.7rem', color: ACCENT, fontStyle: 'italic', mt: 0.25 }}>«{r.note}»</Typography>}
            </Box>
            <Button onClick={() => startRoutine(r)} startIcon={<PlayArrow />} size="small" variant={r.completed ? 'text' : 'contained'} sx={{ bgcolor: r.completed ? 'transparent' : ACCENT, color: r.completed ? ACCENT : '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px', whiteSpace: 'nowrap' }}>{r.completed ? 'Kjør igjen' : 'Start'}</Button>
          </Stack>
        ))}
      </Stack>

      {/* Guidet flyt */}
      <Dialog open={!!active} onClose={close} fullWidth maxWidth="xs" PaperProps={{ sx: { bgcolor: PANEL, color: TEXT, borderRadius: '16px' } }}>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          {active && step && (
            <Stack spacing={2} alignItems="center">
              <Stack direction="row" sx={{ width: '100%' }} alignItems="center">
                <Typography sx={{ fontSize: '0.7rem', color: FAINT, flex: 1, textAlign: 'left' }}>Steg {stepIdx + 1} / {active.steps.length}</Typography>
                <IconButton size="small" onClick={close} sx={{ color: MUTED }}><Close fontSize="small" /></IconButton>
              </Stack>
              <Chip label={step.type} size="small" sx={{ bgcolor: 'rgba(255,107,53,0.14)', color: ACCENT, textTransform: 'capitalize' }} />
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>{step.title}</Typography>
              {/* Pust-/fokus-sirkel som puster, eller nedtellingsring */}
              <Box sx={{ position: 'relative', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{
                  width: 130, height: 130, borderRadius: '50%', border: `3px solid ${ACCENT}`,
                  bgcolor: 'rgba(255,107,53,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: playing && /breath|mindful/i.test(step.type) ? 'wbreathe 8s ease-in-out infinite' : 'none',
                  '@keyframes wbreathe': { '0%,100%': { transform: 'scale(0.7)' }, '50%': { transform: 'scale(1.05)' } },
                }}>
                  <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</Typography>
                </Box>
              </Box>
              {step.instruction && <Typography sx={{ fontSize: '0.82rem', color: MUTED, lineHeight: 1.5 }}>{step.instruction}</Typography>}
              {/* Egen oppvarmings-lyd fra produsenten */}
              {step.audioUrl && <Box component="audio" src={step.audioUrl} controls autoPlay sx={{ width: '100%', height: 36 }} />}
              {/* Referansetone for vokal-steg */}
              {keyToFreq(musicalKey) && /vocal|vokal|breath|articul/i.test(step.type) && (
                <Button onClick={toggleDrone} startIcon={<MusicNote />} size="small" sx={{ color: drone ? ACCENT : MUTED, textTransform: 'none' }}>{drone ? 'Stopp referansetone' : `Referansetone (${musicalKey})`}</Button>
              )}
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setPlaying((p) => !p)} startIcon={playing ? <Pause /> : <PlayArrow />} variant="outlined" sx={{ color: TEXT, borderColor: BORDER, textTransform: 'none', borderRadius: '999px' }}>{playing ? 'Pause' : 'Spill'}</Button>
                {isLast
                  ? <Button onClick={finish} startIcon={<CheckCircle />} variant="contained" sx={{ bgcolor: GREEN, color: '#082b16', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>Fullfør</Button>
                  : <Button onClick={next} startIcon={<SkipNext />} variant="contained" sx={{ bgcolor: ACCENT, color: '#150d05', fontWeight: 700, textTransform: 'none', borderRadius: '999px' }}>Neste</Button>}
              </Stack>
              <LinearProgress variant="determinate" value={((stepIdx) / active.steps.length) * 100} sx={{ width: '100%', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: ACCENT } }} />
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default WarmupPlayer;
