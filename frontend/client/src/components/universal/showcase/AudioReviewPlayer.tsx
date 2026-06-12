/**
 * AudioReviewPlayer.tsx
 * ───────────────────────────────────────────────────────────────────────────
 * Profesjonell lyd-review med tidskodede kommentarer — SoundCloud-mønsteret:
 * waveform + kommentar-markører festet til riktig tidspunkt, klikk for å hoppe,
 * og «legg igjen kommentar ved spillehodet». Brukes i musikkprodusent-visningen
 * (tidskode-kommentering var tidligere kun wired for video).
 *
 * Bygger på wavesurfer.js v7 (allerede en dependency). Selvstendig +
 * props-drevet: tar src + kommentarer + onAddComment.
 */

import React from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Box, IconButton, TextField, Tooltip, Typography, Stack, Chip } from '@mui/material';
import { PlayArrow, Pause, AddComment } from '@mui/icons-material';

// Profesjonelle mix/master-aspekter — gir struktur til feedbacken. Hver farge
// brukes på markøren så produsenten ser fordelingen visuelt på waveformen.
export const MIX_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'balance', label: 'Balanse', color: '#FF6B35' },
  { key: 'low', label: 'Bass/lavmellom', color: '#9b59b6' },
  { key: 'high', label: 'Diskant', color: '#3fa7d6' },
  { key: 'vocal', label: 'Vokal', color: '#e0a955' },
  { key: 'stereo', label: 'Lydbilde', color: '#5fb88a' },
  { key: 'dynamics', label: 'Dynamikk/Loudness', color: '#e0606a' },
  { key: 'arrangement', label: 'Arrangement', color: '#8aa0b6' },
  { key: 'other', label: 'Annet', color: 'rgba(245,242,234,0.55)' },
];
const catOf = (key?: string) => MIX_CATEGORIES.find((c) => c.key === key) || MIX_CATEGORIES[0];

export interface TimecodedComment {
  id: string;
  timecode: number; // sekunder
  comment: string;
  author?: string;
  category?: string; // mix/master-aspekt (se MIX_CATEGORIES)
}

interface Props {
  src: string;
  comments: TimecodedComment[];
  onAddComment: (timecode: number, comment: string, category: string) => void | Promise<void>;
  accentColor?: string;
  /** Skjul innsendingsfeltet (f.eks. ren visning for klient uten skrive-rett). */
  readOnly?: boolean;
}

const fmt = (s: number): string => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export default function AudioReviewPlayer({
  src,
  comments,
  onAddComment,
  accentColor = '#FF6B35',
  readOnly = false,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const wsRef = React.useRef<WaveSurfer | null>(null);
  const [ready, setReady] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [draft, setDraft] = React.useState('');
  const [draftCat, setDraftCat] = React.useState('balance');
  const [filterCat, setFilterCat] = React.useState<string | null>(null); // null = alle
  const [hoverId, setHoverId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!containerRef.current || !src) return;
    let cancelled = false;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: src,
      height: 72,
      waveColor: 'rgba(245,242,234,0.28)',
      progressColor: accentColor,
      cursorColor: 'rgba(245,242,234,0.9)',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });
    wsRef.current = ws;

    ws.on('ready', () => { if (!cancelled) { setReady(true); setDuration(ws.getDuration()); } });
    ws.on('timeupdate', (t: number) => { if (!cancelled) setCurrent(t); });
    ws.on('play', () => !cancelled && setPlaying(true));
    ws.on('pause', () => !cancelled && setPlaying(false));
    ws.on('finish', () => !cancelled && setPlaying(false));

    return () => {
      cancelled = true;
      try { ws.destroy(); } catch { /* ignore */ }
      wsRef.current = null;
    };
  }, [src, accentColor]);

  const seekTo = React.useCallback((sec: number) => {
    const ws = wsRef.current;
    if (!ws || !duration) return;
    ws.setTime(Math.max(0, Math.min(sec, duration)));
    setCurrent(Math.max(0, Math.min(sec, duration)));
  }, [duration]);

  const submit = React.useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    await onAddComment(Math.floor(current), text, draftCat);
    setDraft('');
  }, [draft, current, draftCat, onAddComment]);

  const sorted = [...comments].sort((a, b) => a.timecode - b.timecode);
  const visible = filterCat ? sorted.filter((c) => (c.category || 'balance') === filterCat) : sorted;
  // Telling per aspekt — viser hvor tyngden av feedback ligger.
  const counts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of sorted) { const k = c.category || 'balance'; m[k] = (m[k] || 0) + 1; }
    return m;
  }, [sorted]);

  return (
    <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '14px', p: 2 }}>
      {/* Waveform + markører */}
      <Box sx={{ position: 'relative', mb: 1 }}>
        {/* Kommentar-markører festet til tidspunkt over waveformen */}
        <Box sx={{ position: 'relative', height: 18 }}>
          {ready && duration > 0 && visible.map((c) => (
            <Tooltip key={c.id} open={hoverId === c.id} title={`${fmt(c.timecode)} · ${catOf(c.category).label} · ${c.author ? c.author + ': ' : ''}${c.comment}`} arrow>
              <Box
                onMouseEnter={() => setHoverId(c.id)}
                onMouseLeave={() => setHoverId((h) => (h === c.id ? null : h))}
                onClick={() => seekTo(c.timecode)}
                sx={{
                  position: 'absolute', top: 0, transform: 'translateX(-50%)',
                  left: `${Math.min(100, (c.timecode / duration) * 100)}%`,
                  width: 14, height: 14, borderRadius: '50% 50% 50% 0', rotate: '45deg',
                  bgcolor: catOf(c.category).color, cursor: 'pointer', border: '2px solid #0B0B0C',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)', transition: 'transform .12s',
                  '&:hover': { transform: 'translateX(-50%) scale(1.25)' },
                }}
              />
            </Tooltip>
          ))}
        </Box>
        <Box ref={containerRef} sx={{ cursor: 'pointer' }} />
        {!ready && (
          <Typography sx={{ color: 'rgba(245,242,234,0.5)', fontSize: '0.8rem', mt: 1 }}>Laster waveform…</Typography>
        )}
      </Box>

      {/* Transport + tid */}
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton
          onClick={() => wsRef.current?.playPause()}
          disabled={!ready}
          sx={{ bgcolor: accentColor, color: '#150d05', '&:hover': { bgcolor: accentColor, opacity: 0.9 }, '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.1)' } }}
        >
          {playing ? <Pause /> : <PlayArrow />}
        </IconButton>
        <Typography sx={{ color: '#F5F2EA', fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem' }}>
          {fmt(current)} <span style={{ color: 'rgba(245,242,234,0.45)' }}>/ {fmt(duration)}</span>
        </Typography>
      </Stack>

      {/* Legg til kommentar ved spillehodet — velg aspekt + skriv */}
      {!readOnly && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
            {MIX_CATEGORIES.map((c) => (
              <Chip
                key={c.key} label={c.label} size="small"
                onClick={() => setDraftCat(c.key)}
                sx={{
                  height: 22, fontSize: '0.7rem', cursor: 'pointer',
                  bgcolor: draftCat === c.key ? c.color : 'rgba(255,255,255,0.06)',
                  color: draftCat === c.key ? '#0B0B0C' : 'rgba(245,242,234,0.7)',
                  fontWeight: draftCat === c.key ? 700 : 500,
                  '&:hover': { bgcolor: draftCat === c.key ? c.color : 'rgba(255,255,255,0.12)' },
                }}
              />
            ))}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth size="small"
              placeholder={`${catOf(draftCat).label} ved ${fmt(current)} — trykk Enter`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }}
              sx={{
                '& .MuiInputBase-input': { color: '#F5F2EA' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.18)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.32)' },
                '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accentColor },
              }}
            />
            <IconButton onClick={() => void submit()} disabled={!draft.trim()} sx={{ color: accentColor }}>
              <AddComment />
            </IconButton>
          </Stack>
        </Box>
      )}

      {/* Aspekt-filter med telling — se hvor tyngden av feedback ligger */}
      {sorted.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 0.5 }}>
          <Chip label={`Alle (${sorted.length})`} size="small" onClick={() => setFilterCat(null)}
            sx={{ height: 22, fontSize: '0.7rem', cursor: 'pointer', bgcolor: filterCat === null ? '#F5F2EA' : 'rgba(255,255,255,0.06)', color: filterCat === null ? '#0B0B0C' : 'rgba(245,242,234,0.7)', fontWeight: 700 }} />
          {MIX_CATEGORIES.filter((c) => counts[c.key]).map((c) => (
            <Chip key={c.key} label={`${c.label} (${counts[c.key]})`} size="small" onClick={() => setFilterCat(c.key)}
              sx={{ height: 22, fontSize: '0.7rem', cursor: 'pointer',
                bgcolor: filterCat === c.key ? c.color : 'rgba(255,255,255,0.06)',
                color: filterCat === c.key ? '#0B0B0C' : 'rgba(245,242,234,0.7)', fontWeight: filterCat === c.key ? 700 : 500 }} />
          ))}
        </Stack>
      )}

      {/* Kommentar-liste (klikk for å hoppe) — fargekodet per aspekt */}
      {visible.length > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          {visible.map((c) => (
            <Stack key={c.id} direction="row" spacing={1} alignItems="flex-start"
              onMouseEnter={() => setHoverId(c.id)} onMouseLeave={() => setHoverId((h) => (h === c.id ? null : h))}
              onClick={() => seekTo(c.timecode)}
              sx={{ p: 0.75, borderRadius: '8px', cursor: 'pointer', borderLeft: `3px solid ${catOf(c.category).color}`, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
            >
              <Box sx={{ px: 0.75, py: 0.1, borderRadius: '6px', bgcolor: 'rgba(255,255,255,0.08)', color: catOf(c.category).color, fontSize: '0.72rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {fmt(c.timecode)}
              </Box>
              <Typography sx={{ color: '#F5F2EA', fontSize: '0.85rem' }}>
                <span style={{ color: catOf(c.category).color, fontWeight: 700 }}>{catOf(c.category).label}</span>
                {c.author && <strong> · {c.author}</strong>}: {c.comment}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
