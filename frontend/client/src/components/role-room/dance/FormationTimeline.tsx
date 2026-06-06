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
import { danceFlowColors } from './danceFlowTheme';

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
  /**
   * Phase 5: DancerPathsView (eller annen DANCERS-track-komponent) rendres
   * som siste rad i timeline-stacken (etter NOTES). Holder layout-kompositt
   * uten å hardkode DancerPathsView-import her.
   */
  dancersTrackSlot?: React.ReactNode;
  /**
   * Phase 5: når true (default), lytter timeline på `dance:video-time` og
   * tegner en vertikal playhead-cursor. Klikk på ruler-bakgrunnen dispatcher
   * `dance:video-seek` med detail.timeSec. Sett false for å skru av i tester.
   */
  enableVideoSync?: boolean;
  /**
   * Workflow-audit G16: BPM for counts-display. Koreografer tenker i
   * 1-2-3-4-5-6-7-8, ikke HH:MM:SS:FF. Default 120 BPM = 2 beats/sek.
   * Settes per prosjekt/choreografi senere.
   */
  bpm?: number;
}

const VIDEO_SEEK_EVENT = 'dance:video-seek' as const;
const VIDEO_TIME_EVENT_NAME = 'dance:video-time';
/** Workflow-audit G11: dobbeltklikk på timeline = opprett formasjon ved tid. */
const CREATE_FORMATION_AT_EVENT = 'dance:create-formation-at' as const;

export function FormationTimeline({
  formations,
  activeFormationId,
  totalDurationSec,
  onSelect,
  movements = [],
  notes = [],
  musicUrl = null,
  dancersTrackSlot = null,
  enableVideoSync = true,
  bpm = 120,
}: FormationTimelineProps): React.ReactElement {
  const [zoomPct, setZoomPct] = React.useState<number>(100);

  // Phase 5: playhead-cursor — lytter på dance:video-time fra
  // FormationVideoPanel og holder local state med current time.
  const [currentTimeSec, setCurrentTimeSec] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!enableVideoSync) return;
    const onTime = (e: Event): void => {
      const detail = (e as CustomEvent<{ currentTime?: number }>).detail;
      if (detail && typeof detail.currentTime === 'number') {
        setCurrentTimeSec(detail.currentTime);
      }
    };
    window.addEventListener(VIDEO_TIME_EVENT_NAME, onTime as EventListener);
    return () => window.removeEventListener(VIDEO_TIME_EVENT_NAME, onTime as EventListener);
  }, [enableVideoSync]);

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
                  borderRadius: 0.5, color: danceFlowColors.textPrimary,
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
        <Box
          sx={{ width: `${100 * zoomFactor}%`, minWidth: '100%', position: 'relative' }}
          onClick={(e) => {
            // Phase 5: seek-på-bakgrunnsklikk. Vi sjekker at click-target IKKE
            // er en formasjon-blokk (de stopper propagation via egen onClick).
            // X-posisjon innen wrapperen → tid.
            if (!enableVideoSync) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const xWithinWrapper = e.clientX - rect.left;
            const labelOffset = LABEL_WIDTH + 8; // label-bredde + Stack-gap
            if (xWithinWrapper < labelOffset) return;
            const trackWidth = rect.width - labelOffset;
            const ratio = (xWithinWrapper - labelOffset) / trackWidth;
            const rawTimeSec = ratio * computedDuration;
            // Audit K2: hvis brukeren klikker utenfor faktisk lengde, vis
            // varsel i stedet for stille klamping.
            if (rawTimeSec > computedDuration) {
              window.dispatchEvent(
                new CustomEvent('dance:toast', {
                  detail: { message: 'Forbi klipp-lengden', kind: 'info' },
                }),
              );
            }
            const timeSec = Math.max(0, Math.min(computedDuration, rawTimeSec));
            window.dispatchEvent(
              new CustomEvent(VIDEO_SEEK_EVENT, { detail: { timeSec } }),
            );
          }}
          onDoubleClick={(e) => {
            // Workflow-audit G11: dobbeltklikk på bakgrunnen = opprett
            // formasjon ved klikket tid (FCP/Premiere-konvensjon).
            // Stopper propagation/preventDefault for å unngå tekstvalg.
            const rect = e.currentTarget.getBoundingClientRect();
            const xWithinWrapper = e.clientX - rect.left;
            const labelOffset = LABEL_WIDTH + 8;
            if (xWithinWrapper < labelOffset) return;
            const trackWidth = rect.width - labelOffset;
            const ratio = (xWithinWrapper - labelOffset) / trackWidth;
            const timeSec = Math.max(0, Math.min(computedDuration, ratio * computedDuration));
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent(CREATE_FORMATION_AT_EVENT, { detail: { timeSec } }),
            );
          }}
          onContextMenu={(e) => {
            // Workflow-audit G18: høyre-klikk på timeline-bakgrunn = åpne
            // 'Legg til note'-modal ved klikket tid. preventDefault undertrykker
            // native context-menyen.
            const rect = e.currentTarget.getBoundingClientRect();
            const xWithinWrapper = e.clientX - rect.left;
            const labelOffset = LABEL_WIDTH + 8;
            if (xWithinWrapper < labelOffset) return;
            const trackWidth = rect.width - labelOffset;
            const ratio = (xWithinWrapper - labelOffset) / trackWidth;
            const timeSec = Math.max(0, Math.min(computedDuration, ratio * computedDuration));
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent('dance:open-timeline-item', {
                detail: { mode: 'create', startSec: timeSec },
              }),
            );
          }}
        >
          <Stack spacing={0.5}>
            {/* FORMATION-spor */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ width: LABEL_WIDTH, fontSize: 10, fontWeight: 700, color: danceFlowColors.lavender, letterSpacing: 1, flexShrink: 0 }}>
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
                        onClick={(e) => {
                          // Phase 5: stop propagation så wrapper-seek ikke fyrer
                          // når brukeren klikker på en formasjon-blokk.
                          e.stopPropagation();
                          onSelect?.(formation.id);
                        }}
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
                          border: `${isActive ? 2 : 1}px solid ${isActive ? danceFlowColors.lavenderLight : 'rgba(167,139,250,0.45)'}`,
                          borderRadius: 0.5, cursor: 'pointer', color: danceFlowColors.textPrimary,
                          fontSize: 10, fontWeight: 600, px: 0.5,
                          display: 'flex', alignItems: 'center', overflow: 'hidden',
                          whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                          '&:hover': { bgcolor: 'rgba(167,139,250,0.28)' },
                          '&:focus-visible': { outline: `2px solid ${danceFlowColors.lavenderLight}` },
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
            {movements.length > 0 ? renderBlockTrack('MOVEMENT', danceFlowColors.successPrimary, movements, 'formation-timeline-movement') : null}

            {/* MUSIC waveform-spor (F5-10) — wavesurfer.js-basert */}
            {musicUrl ? (
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography sx={{ width: LABEL_WIDTH, fontSize: 10, fontWeight: 700, color: danceFlowColors.gold, letterSpacing: 1, flexShrink: 0 }}>
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
            {notes.length > 0 ? renderBlockTrack('NOTES', danceFlowColors.infoLight, notes.map((n) => ({ id: n.id, label: n.text, startSec: n.startSec, endSec: n.endSec })), 'formation-timeline-note') : null}

            {/* Phase 5: DANCERS-track-slot (typisk <DancerPathsView/>) */}
            {dancersTrackSlot ? (
              <Box data-testid="formation-timeline-dancers-slot" sx={{ mt: 0.5 }}>
                {dancersTrackSlot}
              </Box>
            ) : null}
          </Stack>

          {/* Phase 5 + workflow-audit G16: playhead-cursor m/ tids-callout.
              Vertikal linje på currentTime + lavender pill-label over toppen
              som viser HH:MM:SS:FF (matches DanceFlow-mockup). */}
          {enableVideoSync && currentTimeSec != null && computedDuration > 0 ? (
            <Box
              data-testid="formation-timeline-playhead"
              aria-hidden
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `calc(${LABEL_WIDTH + 8}px + (100% - ${LABEL_WIDTH + 8}px) * ${Math.min(1, Math.max(0, currentTimeSec / computedDuration))})`,
                width: 0,
                borderLeft: `1.5px solid ${danceFlowColors.gold}`,
                pointerEvents: 'none',
                boxShadow: '0 0 8px rgba(251,191,36,0.5)',
                zIndex: 5,
              }}
            >
              <Box
                data-testid="formation-timeline-playhead-callout"
                sx={{
                  position: 'absolute',
                  top: -18,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bgcolor: danceFlowColors.lavender,
                  color: danceFlowColors.bgBase,
                  fontSize: 9,
                  fontWeight: 700,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.5,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: 0.5,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                }}
              >
                {formatTimecode(currentTimeSec)}
              </Box>
            </Box>
          ) : null}
        </Box>
      </Box>

      {/* F5-11: Zoom + Fit + Counts-display (workflow-audit G16) */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mt: 0.75, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Counts ved playhead — koreografer tenker 1-2-3-4-5-6-7-8.
            Default 120 BPM = 2 beats/sek. Vises bare når video-sync er på
            og vi har en current time. */}
        {enableVideoSync && currentTimeSec != null ? (
          <Typography
            data-testid="formation-timeline-counts"
            sx={{
              fontSize: 10,
              color: danceFlowColors.gold,
              fontWeight: 700,
              letterSpacing: 0.5,
              fontVariantNumeric: 'tabular-nums',
              minWidth: 88,
            }}
          >
            Count {Math.floor((currentTimeSec * bpm) / 60) + 1}
            <Box
              component="span"
              sx={{ ml: 0.5, color: danceFlowColors.textDisabled, fontSize: 9, fontWeight: 500 }}
            >
              @ {bpm} BPM
            </Box>
          </Typography>
        ) : null}
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
        <Typography sx={{ fontSize: 10, color: danceFlowColors.lavender, minWidth: 36, textAlign: 'right' }}>
          {zoomPct}%
        </Typography>
        <Button
          size="small"
          startIcon={<FitIcon sx={{ fontSize: 14 }} />}
          onClick={() => setZoomPct(100)}
          data-testid="formation-timeline-fit"
          sx={{ fontSize: 10, textTransform: 'none', color: danceFlowColors.lavender }}
        >
          Fit
        </Button>
      </Stack>
    </Box>
  );
}

export default FormationTimeline;
