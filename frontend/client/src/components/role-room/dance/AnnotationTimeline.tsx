/**
 * AnnotationTimeline — DanceAnnotate-inspirert multi-track timeline.
 *
 * Renderer 5 horisontale spor (Steps / Arms / Body / Jumps / Turns) +
 * et "Annet"-spor for ukategoriserte annotasjoner. Hver annotation er
 * en absolutt-plassert blokk på sitt kategori-spor, plassert ved
 * timestampSec og scalert mot clip-duration.
 *
 *   ├── Spor: Steps  [Walk]──[Chassé]────[Step]─
 *   ├── Spor: Arms   [Reach]──────[Sweep]──[Open]
 *   ├── Spor: Body   ...
 *
 * Klikk på blokk → onSeek(timestampSec) + onSelect(annotation).
 * Dra venstre/høyre kant → onResize(annotation, newStart, newEnd).
 * Playhead-linje følger playheadSec.
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { DANCE_MOVEMENT_CATEGORIES, categoryById } from './danceMovementCategories';
import type { VideoAnnotation } from './danceVideoService';

const TRACK_HEIGHT = 22;
const TRACK_GAP = 4;
const LABEL_WIDTH = 64;
const UNCAT_COLOR = danceFlowColors.textDisabled;
const HANDLE_WIDTH = 6;

export interface AnnotationTimelineProps {
  annotations: VideoAnnotation[];
  durationSec: number;
  playheadSec: number;
  onSeek?: (sec: number) => void;
  onSelectAnnotation?: (annotation: VideoAnnotation) => void;
  onResize?: (annotation: VideoAnnotation, newStartSec: number, newEndSec: number) => void;
  /**
   * DanceAnnotate mockup-paritet: '+ Add Track'-knapp under siste spor.
   * Når satt, vises knapp; click trigger handler (typisk for å opprette
   * prosjekt-spesifikk kategori). Når undefined, skjules knappen.
   */
  onAddTrack?: () => void;
  /**
   * ID til valgt annotation — driver lavender outline + boost-bgcolor
   * (matcher mockup hvor "Chassé" er aktiv-highlighted i Steps-sporet).
   */
  selectedAnnotationId?: string | null;
}

export function AnnotationTimeline({
  annotations,
  durationSec,
  playheadSec,
  onSeek,
  onSelectAnnotation,
  onResize,
  onAddTrack,
  selectedAnnotationId = null,
}: AnnotationTimelineProps): React.ReactElement {
  const safeDuration = Math.max(durationSec, 1);
  const tracks = React.useMemo(() => {
    const list = DANCE_MOVEMENT_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      color: c.color,
    }));
    list.push({ id: '__uncat__', label: 'Annet', color: UNCAT_COLOR });
    return list;
  }, []);
  const annotationsByTrack = React.useMemo(() => {
    const map = new Map<string, VideoAnnotation[]>();
    for (const t of tracks) map.set(t.id, []);
    for (const a of annotations) {
      if (a.parentId) continue; // skjul tråd-svar fra timelinen
      const trackId = a.category && categoryById(a.category) ? a.category : '__uncat__';
      map.get(trackId)!.push(a);
    }
    return map;
  }, [annotations, tracks]);

  const playheadPct = Math.min(100, Math.max(0, (playheadSec / safeDuration) * 100));

  // ─── Drag-to-resize state ──────────────────────────────────────
  // Vi tracker en aktiv drag-økt slik at vi kan oppdatere lokalt under
  // bevegelse + sende patch på mouseup. Bredder kommer fra track-elementet.
  const [drag, setDrag] = React.useState<{
    annotationId: string;
    edge: 'start' | 'end';
    initialStart: number;
    initialEnd: number;
    trackWidthPx: number;
    pointerStartX: number;
    currentStart: number;
    currentEnd: number;
  } | null>(null);

  React.useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent): void => {
      const dxPx = e.clientX - drag.pointerStartX;
      const dxSec = (dxPx / drag.trackWidthPx) * safeDuration;
      let newStart = drag.initialStart;
      let newEnd = drag.initialEnd;
      if (drag.edge === 'start') {
        newStart = Math.max(0, Math.min(drag.initialEnd - 0.2, drag.initialStart + dxSec));
      } else {
        newEnd = Math.max(drag.initialStart + 0.2, Math.min(safeDuration, drag.initialEnd + dxSec));
      }
      setDrag({ ...drag, currentStart: newStart, currentEnd: newEnd });
    };
    const onUp = (): void => {
      const a = annotations.find((x) => x.id === drag.annotationId);
      if (a && onResize) {
        onResize(a, drag.currentStart, drag.currentEnd);
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, annotations, onResize, safeDuration]);

  return (
    <Box
      data-testid="annotation-timeline"
      sx={{
        width: '100%',
        bgcolor: '#0d0f14',
        border: '1px solid rgba(139,92,246,0.18)',
        borderRadius: 1,
        p: 1,
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${TRACK_GAP}px` }}>
        {tracks.map((track) => {
          const blocks = annotationsByTrack.get(track.id) ?? [];
          return (
            <Box
              key={track.id}
              data-testid={`annotation-track-${track.id}`}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Typography
                sx={{
                  width: LABEL_WIDTH,
                  fontSize: 10,
                  fontWeight: 700,
                  color: track.color,
                  letterSpacing: 1,
                  flexShrink: 0,
                }}
              >
                {track.label.toUpperCase()}
              </Typography>
              <Box
                sx={{
                  position: 'relative',
                  flex: 1,
                  height: TRACK_HEIGHT,
                  bgcolor: 'rgba(255,255,255,0.02)',
                  borderRadius: 0.5,
                  overflow: 'hidden',
                }}
                ref={(el: HTMLDivElement | null) => {
                  if (el) (el as HTMLDivElement & { __trackRef?: true }).__trackRef = true;
                }}
              >
                {blocks.map((a) => {
                  const isDragged = drag?.annotationId === a.id;
                  const liveStart = isDragged ? drag!.currentStart : a.timestampSec;
                  const liveEnd = isDragged ? drag!.currentEnd : (a.endSec ?? a.timestampSec + 2);
                  const startPct = Math.max(0, Math.min(100, (liveStart / safeDuration) * 100));
                  const endPct = Math.max(startPct + 1, Math.min(100, (liveEnd / safeDuration) * 100));
                  const widthPct = Math.max(0.6, endPct - startPct);
                  const beginResize = (edge: 'start' | 'end') => (e: React.PointerEvent<HTMLDivElement>): void => {
                    if (!onResize) return;
                    e.stopPropagation();
                    e.preventDefault();
                    const trackEl = e.currentTarget.parentElement?.parentElement;
                    if (!trackEl) return;
                    const rect = trackEl.getBoundingClientRect();
                    setDrag({
                      annotationId: a.id,
                      edge,
                      initialStart: a.timestampSec,
                      initialEnd: a.endSec ?? a.timestampSec + 2,
                      trackWidthPx: rect.width,
                      pointerStartX: e.clientX,
                      currentStart: a.timestampSec,
                      currentEnd: a.endSec ?? a.timestampSec + 2,
                    });
                  };
                  const isSelected = selectedAnnotationId === a.id;
                  return (
                    <Tooltip key={a.id} title={a.body || '(uten tekst)'}>
                      <Box
                        data-testid={`annotation-block-${a.id}`}
                        role="button"
                        tabIndex={0}
                        aria-label={a.body || 'kommentar'}
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (isDragged) return;
                          onSeek?.(a.timestampSec);
                          onSelectAnnotation?.(a);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSeek?.(a.timestampSec);
                            onSelectAnnotation?.(a);
                          }
                        }}
                        sx={{
                          position: 'absolute',
                          top: 2,
                          bottom: 2,
                          left: `${startPct}%`,
                          width: `${widthPct}%`,
                          minWidth: 6,
                          bgcolor: isSelected ? `${track.color}cc` : `${track.color}66`,
                          border: isSelected
                            ? `2px solid #fff`
                            : `1px solid ${track.color}`,
                          borderRadius: 0.5,
                          cursor: 'pointer',
                          boxShadow: isSelected
                            ? `0 0 0 1px ${track.color}, 0 0 8px ${track.color}55`
                            : 'none',
                          '&:hover': { bgcolor: `${track.color}99` },
                          '&:focus-visible': { outline: `2px solid ${track.color}` },
                        }}
                      >
                        {/* Drag-handle: venstre kant */}
                        {onResize ? (
                          <Box
                            data-testid={`annotation-resize-start-${a.id}`}
                            onPointerDown={beginResize('start')}
                            sx={{
                              position: 'absolute',
                              left: 0, top: 0, bottom: 0,
                              width: HANDLE_WIDTH,
                              cursor: 'ew-resize',
                              bgcolor: 'rgba(255,255,255,0.18)',
                            }}
                          />
                        ) : null}
                        {/* Drag-handle: høyre kant */}
                        {onResize ? (
                          <Box
                            data-testid={`annotation-resize-end-${a.id}`}
                            onPointerDown={beginResize('end')}
                            sx={{
                              position: 'absolute',
                              right: 0, top: 0, bottom: 0,
                              width: HANDLE_WIDTH,
                              cursor: 'ew-resize',
                              bgcolor: 'rgba(255,255,255,0.18)',
                            }}
                          />
                        ) : null}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
      {/* Playhead */}
      <Box
        data-testid="annotation-timeline-playhead"
        sx={{
          position: 'absolute',
          top: 8,
          bottom: 8,
          left: `calc(${LABEL_WIDTH + 16}px + (100% - ${LABEL_WIDTH + 24}px) * ${playheadPct / 100})`,
          width: 1.5,
          bgcolor: '#fff',
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />
      {/* DanceAnnotate mockup-paritet: '+ Add Track'-knapp under siste spor. */}
      {onAddTrack ? (
        <Box
          component="button"
          type="button"
          onClick={onAddTrack}
          data-testid="annotation-timeline-add-track"
          sx={{
            mt: 1, ml: `${LABEL_WIDTH + 8}px`,
            display: 'inline-flex', alignItems: 'center', gap: 0.5,
            px: 1.25, py: 0.5,
            border: '1px dashed rgba(255,255,255,0.18)',
            borderRadius: 1,
            bgcolor: 'transparent',
            color: 'rgba(229,231,235,0.65)',
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer', font: 'inherit',
            '&:hover': {
              color: danceFlowColors.lavender,
              borderColor: danceFlowColors.lavender,
              bgcolor: 'rgba(167,139,250,0.06)',
            },
          }}
        >
          + Add Track
        </Box>
      ) : null}
    </Box>
  );
}

export default AnnotationTimeline;
