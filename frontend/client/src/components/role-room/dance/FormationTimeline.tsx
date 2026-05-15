/**
 * FormationTimeline — DanceFlow-paritet: tids-basert multi-track timeline.
 *
 * Spor:
 *   FORMATION : Formation-blokker (Intro Line / V-Shape / Circle …)
 *   MOVEMENT  : Movement-beskrivelser per tids-rom (Walk / Reach / …)
 *   MUSIC     : Bølgeform fra koreografien (når musikkURL er satt)
 *   NOTES     : Per-tidsrom tekst-notater
 *
 * Klikk på FORMATION-blokk → setActiveFormationId.
 * Zoom-slider under timeline justerer visuell skalering (50-400%).
 */

import React from 'react';
import { Box, Stack, Typography, Tooltip, Button } from '@mui/material';
import { CenterFocusStrong as FitIcon } from '@mui/icons-material';
import type { Formation } from './formationTypes';
import { formatTimecode } from './timecode';
import { MusicWaveformTrack } from './MusicWaveformTrack';

const TRACK_HEIGHT = 32;
const SMALL_TRACK_HEIGHT = 22;
const LABEL_WIDTH = 64;
const DEFAULT_BLOCK_SEC = 8;
const MIN_ZOOM = 50;
const MAX_ZOOM = 400;

export interface FormationTimelineMovementItem {
  id: string;
  label: string;
  startSec: number;
  endSec: number;
}

export interface FormationTimelineNoteItem {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
}

export interface FormationTimelineProps {
  formations: Formation[];
  activeFormationId: string | null;
  totalDurationSec?: number;
  onSelect?: (id: string) => void;
  /** F5-8: movement-spor items. */
  movements?: readonly FormationTimelineMovementItem[];
  /** F5-9: notes-spor items. */
  notes?: readonly FormationTimelineNoteItem[];
  /** F5-10: musikk-URL — om satt rendres en waveform-strek. */
  musicUrl?: string | null;
}

export function FormationTimeline({
  formations,
  activeFormationId,
  totalDurationSec,
  onSelect,
  movements = [],
  notes = [],
  musicUrl = null,
}: FormationTimelineProps): React.ReactElement {
  const [zoomPct, setZoomPct] = React.useState<number>(100);

  const placed = React.useMemo(() => {
    let cursor = 0;
    return formations.map((f) => {
      const start = typeof f.startSec === 'number' ? f.startSec : cursor;
      const end = typeof f.endSec === 'number'
        ? f.endSec
        : (typeof f.startSec === 'number'
            ? f.startSec + DEFAULT_BLOCK_SEC
            : cursor + DEFAULT_BLOCK_SEC);
      cursor = Math.max(cursor, end);
      return { formation: f, start, end };
    });
  }, [formations]);

  const computedDuration = Math.max(
    totalDurationSec ?? 0,
    placed.reduce((max, p) => Math.max(max, p.end), 0),
    movements.reduce((max, m) => Math.max(max, m.endSec), 0),
    notes.reduce((max, n) => Math.max(max, n.endSec), 0),
    16,
  );

  const zoomFactor = zoomPct / 100;

  // Helper: render a generic block-track (used for movement + notes).
  const renderBlockTrack = (
    label: string,
    color: string,
    items: ReadonlyArray<{ id: string; label: string; startSec: number; endSec: number }>,
    testIdPrefix: string,
  ): React.ReactElement => (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography sx={{ width: LABEL_WIDTH, fontSize: 10, fontWeight: 700, color, letterSpacing: 1, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box
        data-testid={`${testIdPrefix}-track`}
        sx={{
          position: 'relative', flex: 1, height: SMALL_TRACK_HEIGHT,
          bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 0.5, overflow: 'hidden',
        }}
      >
        {items.map((item) => {
          const startPct = Math.max(0, Math.min(100, (item.startSec / computedDuration) * 100));
          const endPct = Math.max(startPct + 1, Math.min(100, (item.endSec / computedDuration) * 100));
          const widthPct = Math.max(2, endPct - startPct);
          return (
            <Tooltip key={item.id} title={`${item.label} · ${formatTimecode(item.startSec)}–${formatTimecode(item.endSec)}`}>
              <Box
                data-testid={`${testIdPrefix}-block-${item.id}`}
                sx={{
                  position: 'absolute', top: 2, bottom: 2,
                  left: `${startPct}%`, width: `${widthPct}%`, minWidth: 16,
                  bgcolor: `${color}22`, border: `1px solid ${color}55`,
                  borderRadius: 0.5, color: '#fff',
                  fontSize: 9.5, fontWeight: 600, px: 0.5,
                  display: 'flex', alignItems: 'center', overflow: 'hidden',
                  whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}
              >
                {item.label}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Stack>
  );

  return (
    <Box
      data-testid="formation-timeline"
      sx={{
        width: '100%',
        bgcolor: '#0d0f14',
        border: '1px solid rgba(139,92,246,0.18)',
        borderRadius: 1,
        p: 1,
      }}
    >
      {/* Indre wrapper som skalerer med zoom. Overflow-x scroller. */}
      <Box sx={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <Box sx={{ width: `${100 * zoomFactor}%`, minWidth: '100%' }}>
          <Stack spacing={0.5}>
            {/* FORMATION-spor */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ width: LABEL_WIDTH, fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: 1, flexShrink: 0 }}>
                FORMATION
              </Typography>
              <Box sx={{
                position: 'relative', flex: 1, height: TRACK_HEIGHT,
                bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 0.5, overflow: 'hidden',
              }}>
                {placed.map(({ formation, start, end }) => {
                  const startPct = Math.max(0, Math.min(100, (start / computedDuration) * 100));
                  const endPct = Math.max(startPct + 1, Math.min(100, (end / computedDuration) * 100));
                  const widthPct = Math.max(2, endPct - startPct);
                  const isActive = formation.id === activeFormationId;
                  return (
                    <Tooltip
                      key={formation.id}
                      title={`${formation.name} · ${formatTimecode(start)} – ${formatTimecode(end)}`}
                    >
                      <Box
                        data-testid={`formation-timeline-block-${formation.id}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isActive}
                        onClick={() => onSelect?.(formation.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelect?.(formation.id);
                          }
                        }}
                        sx={{
                          position: 'absolute', top: 2, bottom: 2,
                          left: `${startPct}%`, width: `${widthPct}%`, minWidth: 24,
                          bgcolor: isActive ? 'rgba(167,139,250,0.32)' : 'rgba(167,139,250,0.14)',
                          border: `${isActive ? 2 : 1}px solid ${isActive ? '#c4b5fd' : 'rgba(167,139,250,0.45)'}`,
                          borderRadius: 0.5, cursor: 'pointer', color: '#fff',
                          fontSize: 10, fontWeight: 600, px: 0.5,
                          display: 'flex', alignItems: 'center', overflow: 'hidden',
                          whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                          '&:hover': { bgcolor: 'rgba(167,139,250,0.28)' },
                          '&:focus-visible': { outline: '2px solid #c4b5fd' },
                        }}
                      >
                        {formation.name}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Stack>

            {/* MOVEMENT-spor (F5-8) */}
            {movements.length > 0 ? renderBlockTrack('MOVEMENT', '#34d399', movements, 'formation-timeline-movement') : null}

            {/* MUSIC waveform-spor (F5-10) — wavesurfer.js-basert */}
            {musicUrl ? (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography sx={{ width: LABEL_WIDTH, fontSize: 10, fontWeight: 700, color: '#fbbf24', letterSpacing: 1, flexShrink: 0 }}>
                  MUSIC
                </Typography>
                <Box
                  data-testid="formation-timeline-music-track"
                  sx={{ flex: 1 }}
                >
                  <MusicWaveformTrack musicUrl={musicUrl} />
                </Box>
              </Stack>
            ) : null}

            {/* NOTES-spor (F5-9) */}
            {notes.length > 0 ? renderBlockTrack('NOTES', '#60a5fa', notes.map((n) => ({ id: n.id, label: n.text, startSec: n.startSec, endSec: n.endSec })), 'formation-timeline-note') : null}
          </Stack>
        </Box>
      </Box>

      {/* F5-11: Zoom + Fit to Timeline */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mt: 0.75, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <Typography sx={{ fontSize: 10, color: 'rgba(229,231,235,0.55)' }}>Zoom</Typography>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={10}
          value={zoomPct}
          onChange={(e) => setZoomPct(Number(e.target.value))}
          data-testid="formation-timeline-zoom"
          style={{ flex: 1 }}
        />
        <Typography sx={{ fontSize: 10, color: '#a78bfa', minWidth: 36, textAlign: 'right' }}>
          {zoomPct}%
        </Typography>
        <Button
          size="small"
          startIcon={<FitIcon sx={{ fontSize: 14 }} />}
          onClick={() => setZoomPct(100)}
          data-testid="formation-timeline-fit"
          sx={{ fontSize: 10, textTransform: 'none', color: '#a78bfa' }}
        >
          Fit
        </Button>
      </Stack>
    </Box>
  );
}

export default FormationTimeline;
