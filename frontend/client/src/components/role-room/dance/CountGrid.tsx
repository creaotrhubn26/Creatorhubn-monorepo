/**
 * CountGrid — 8-count grid for ett segment.
 *
 * Profesjonell dans tellestrukturen er typisk 8-counts (eller halv-counts:
 * 5-6-7-8 før et 1-2-3-4-5-6-7-8). Hver count får én rad med detaljer:
 * bevegelse, posisjon, formasjon, retning, energi, notat, video-ref.
 *
 * Viser BPM-utregnet antall counts pr segment. Brukeren kan:
 *  - Toggle "include 5-6-7-8 leadup" — legger til 4 forberedende counts
 *  - Endre count-detaljer pr rad
 *  - Hoppe til count via klikk → playhead seeker til count-tid
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import {
  Movie as VideoIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import {
  ENERGY_LEVELS,
  formatTime,
  getEnergyMeta,
  type EnergyLevel,
  type Segment,
} from './choreographyTypes';
import useBrandingSettings from '../hooks/useBrandingSettings';

// ─── Datamodell ─────────────────────────────────────────────────────────

export interface CountEntry {
  /** 1-8 (eller 5-8 for leadup). */
  count: number;
  movement?: string;
  position?: string;
  formation?: string;
  direction?: string;
  energy?: EnergyLevel;
  note?: string;
  videoRefUrl?: string;
}

export interface CountGridState {
  /** Hvis true, prefiks med 5-6-7-8 leadup. */
  includeLeadup: boolean;
  entries: CountEntry[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Antall 8-counts som passer i et segment ved gitt BPM. */
function countsForSegment(segment: Segment, bpm: number | undefined): number {
  if (!bpm || bpm <= 0) return 8;
  const durationMin = (segment.endSec - segment.startSec) / 60;
  const beats = bpm * durationMin;
  return Math.max(8, Math.round(beats));
}

/** Gir tids-stempel (sek fra koreografi-start) for en gitt count. */
function timeForCount(segment: Segment, countIdx: number, totalCounts: number): number {
  const segDur = segment.endSec - segment.startSec;
  const tWithinSegment = (countIdx / totalCounts) * segDur;
  return segment.startSec + tWithinSegment;
}

// ─── Komponent ─────────────────────────────────────────────────────────

export interface CountGridProps {
  segment: Segment;
  bpm?: number;
  initialState?: CountGridState;
  onChange?: (state: CountGridState) => void;
  /** Klikk på count → seek playhead til den tiden i hovedtimelinjen. */
  onSeekToCount?: (sec: number) => void;
}

export const CountGrid: React.FC<CountGridProps> = ({
  segment, bpm, initialState, onChange, onSeekToCount,
}) => {
  const branding = useBrandingSettings();
  const labels = branding.tokens.labels;

  const totalCounts = countsForSegment(segment, bpm);
  const eightCounts = Math.ceil(totalCounts / 8);

  const [state, setState] = useState<CountGridState>(
    () => initialState ?? { includeLeadup: true, entries: [] },
  );

  const updateState = useCallback((next: CountGridState) => {
    setState(next);
    onChange?.(next);
  }, [onChange]);

  const updateEntry = useCallback((countNum: number, patch: Partial<CountEntry>) => {
    const existing = state.entries.find((e) => e.count === countNum);
    const newEntries = existing
      ? state.entries.map((e) => (e.count === countNum ? { ...e, ...patch } : e))
      : [...state.entries, { count: countNum, ...patch }];
    updateState({ ...state, entries: newEntries });
  }, [state, updateState]);

  const reset = useCallback(() => {
    updateState({ includeLeadup: state.includeLeadup, entries: [] });
  }, [state.includeLeadup, updateState]);

  // Bygg radene som skal vises: optional 5-6-7-8 prefix + 1-8 × eightCounts
  const rows = useMemo(() => {
    const list: { displayCount: number; absoluteCount: number; isLeadup: boolean; eightCountIdx: number }[] = [];
    let abs = 0;
    if (state.includeLeadup) {
      for (let c = 5; c <= 8; c++) {
        list.push({ displayCount: c, absoluteCount: abs++, isLeadup: true, eightCountIdx: 0 });
      }
    }
    for (let g = 0; g < eightCounts; g++) {
      for (let c = 1; c <= 8; c++) {
        list.push({ displayCount: c, absoluteCount: abs++, isLeadup: false, eightCountIdx: g + 1 });
      }
    }
    return list;
  }, [eightCounts, state.includeLeadup]);

  return (
    <Box data-testid="count-grid" sx={{ bgcolor: '#0d1218', borderRadius: 1.5, p: 1.5 }}>
      {/* ─── Header ──────────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>
            COUNT SYSTEM · {eightCounts} × 8-COUNT
          </Typography>
          <Chip
            size="small"
            label={`${bpm ?? '–'} BPM · ${totalCounts} beats`}
            sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
          />
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={state.includeLeadup}
                onChange={(e) => updateState({ ...state, includeLeadup: e.target.checked })}
                data-testid="count-grid-leadup-toggle"
              />
            }
            label={<Typography sx={{ fontSize: 10, color: '#9ca3af' }}>5-6-7-8 leadup</Typography>}
            sx={{ ml: 0, mr: 0.5 }}
          />
          <Tooltip title="Tilbakestill alle tellinger">
            <IconButton size="small" onClick={reset} sx={{ color: '#9ca3af', '&:hover': { color: '#f87171' } }}>
              <ResetIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ─── Grid ────────────────────────────────────── */}
      <Box
        sx={{
          display: 'grid',
          // count(40) | move | pos | form | dir | energy | note | video
          gridTemplateColumns: '36px minmax(110px, 1.4fr) minmax(80px, 1fr) minmax(90px, 1fr) minmax(60px, 0.8fr) 70px minmax(110px, 1.4fr) 28px',
          gap: 0,
          fontSize: 10,
        }}
      >
        {/* ─── Header-rad ─── */}
        <CountHeader>#</CountHeader>
        <CountHeader>BEVEGELSE</CountHeader>
        <CountHeader>POSISJON</CountHeader>
        <CountHeader>FORMASJON</CountHeader>
        <CountHeader>RETNING</CountHeader>
        <CountHeader>ENERGI</CountHeader>
        <CountHeader>NOTAT</CountHeader>
        <CountHeader>{' '}</CountHeader>

        {/* ─── Data-rader ─── */}
        {rows.map((row) => {
          const entry = state.entries.find((e) => e.count === row.absoluteCount);
          const isFirstOfEightCount = !row.isLeadup && row.displayCount === 1;
          const groupColor = row.isLeadup
            ? '#9ca3af'
            : row.eightCountIdx % 2 === 1 ? '#8b5cf6' : '#3b82f6';
          const sec = timeForCount(segment, row.absoluteCount, rows.length);
          return (
            <React.Fragment key={row.absoluteCount}>
              {/* # — telling-tall */}
              <Box
                onClick={() => onSeekToCount?.(sec)}
                data-testid={`count-cell-${row.absoluteCount}`}
                sx={{
                  borderTop: isFirstOfEightCount ? '2px solid #2a3142' : '1px solid #1a2230',
                  borderRight: '1px solid #1a2230',
                  px: 0.75, py: 0.6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: row.isLeadup ? 'rgba(156,163,175,0.05)' : 'transparent',
                  cursor: onSeekToCount ? 'pointer' : 'default',
                  '&:hover': onSeekToCount ? { bgcolor: 'rgba(167,139,250,0.1)' } : undefined,
                }}
              >
                <Box
                  sx={{
                    width: 22, height: 22, borderRadius: '50%',
                    bgcolor: row.isLeadup ? 'rgba(156,163,175,0.15)' : `${groupColor}22`,
                    color: groupColor,
                    border: `1.5px solid ${groupColor}66`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    fontFamily: 'monospace',
                  }}
                >
                  {row.displayCount}
                </Box>
              </Box>

              <CountInput value={entry?.movement} onChange={(v) => updateEntry(row.absoluteCount, { movement: v })} firstOfEight={isFirstOfEightCount} />
              <CountInput value={entry?.position} onChange={(v) => updateEntry(row.absoluteCount, { position: v })} firstOfEight={isFirstOfEightCount} />
              <CountInput value={entry?.formation} onChange={(v) => updateEntry(row.absoluteCount, { formation: v })} firstOfEight={isFirstOfEightCount} />
              <CountInput value={entry?.direction} onChange={(v) => updateEntry(row.absoluteCount, { direction: v })} firstOfEight={isFirstOfEightCount} />

              {/* Energi-velger */}
              <Box
                sx={{
                  borderTop: isFirstOfEightCount ? '2px solid #2a3142' : '1px solid #1a2230',
                  borderRight: '1px solid #1a2230',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  px: 0.4,
                }}
              >
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  {ENERGY_LEVELS.slice(0, 6).map((e) => {
                    const isSel = entry?.energy === e.level;
                    return (
                      <Tooltip key={e.level} title={labels[e.labelToken]}>
                        <Box
                          onClick={() => updateEntry(row.absoluteCount, { energy: e.level as EnergyLevel })}
                          sx={{
                            width: 6, height: 14,
                            borderRadius: 0.5,
                            bgcolor: isSel ? e.color : `${e.color}22`,
                            cursor: 'pointer',
                            transition: 'all 0.1s',
                            '&:hover': { bgcolor: `${e.color}88` },
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
              </Box>

              <CountInput value={entry?.note} onChange={(v) => updateEntry(row.absoluteCount, { note: v })} firstOfEight={isFirstOfEightCount} />

              {/* Video-ref-knapp */}
              <Box
                sx={{
                  borderTop: isFirstOfEightCount ? '2px solid #2a3142' : '1px solid #1a2230',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Tooltip title={entry?.videoRefUrl ? 'Åpne video-referanse' : 'Legg til video-referanse'}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (entry?.videoRefUrl) {
                        window.open(entry.videoRefUrl, '_blank', 'noopener');
                      } else {
                        const url = window.prompt('Video-URL (Vimeo/YouTube/Drive):');
                        if (url) updateEntry(row.absoluteCount, { videoRefUrl: url });
                      }
                    }}
                    sx={{ p: 0.25, color: entry?.videoRefUrl ? '#a78bfa' : '#4b5563' }}
                  >
                    <VideoIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </React.Fragment>
          );
        })}
      </Box>

      {/* ─── Footer info ─────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1, pt: 0.75, borderTop: '1px solid #1a2230' }}>
        <Typography sx={{ fontSize: 9, color: '#6b7280' }}>
          Klikk på telling-tall for å spille av musikk fra det punktet
        </Typography>
        <Typography sx={{ fontSize: 9, color: '#6b7280', fontFamily: 'monospace' }}>
          {formatTime(segment.startSec)} → {formatTime(segment.endSec)}
        </Typography>
      </Stack>
    </Box>
  );
};

// ─── Header-celle ────────────────────────────────────────────────────────

const CountHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      px: 0.75, py: 0.5,
      borderBottom: '1px solid #2a3142',
      borderRight: '1px solid #1a2230',
      bgcolor: '#0a0a0a',
      fontSize: 8.5,
      letterSpacing: 1,
      color: '#6b7280',
      fontWeight: 700,
    }}
  >
    {children}
  </Box>
);

// ─── Inline-input-celle ─────────────────────────────────────────────────

const CountInput: React.FC<{
  value: string | undefined;
  onChange: (v: string) => void;
  firstOfEight: boolean;
}> = ({ value, onChange, firstOfEight }) => (
  <Box
    sx={{
      borderTop: firstOfEight ? '2px solid #2a3142' : '1px solid #1a2230',
      borderRight: '1px solid #1a2230',
    }}
  >
    <TextField
      size="small"
      variant="standard"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      InputProps={{ disableUnderline: true, sx: { fontSize: 10, px: 0.6, py: 0.4, color: '#e5e7eb' } }}
      sx={{ width: '100%' }}
    />
  </Box>
);

export default CountGrid;
