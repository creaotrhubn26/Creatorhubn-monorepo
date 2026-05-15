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
 * Playhead-linje følger playheadSec.
 */

import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { DANCE_MOVEMENT_CATEGORIES, categoryById } from './danceMovementCategories';
import type { VideoAnnotation } from './danceVideoService';

const TRACK_HEIGHT = 22;
const TRACK_GAP = 4;
const LABEL_WIDTH = 64;
const UNCAT_COLOR = '#6b7280';

export interface AnnotationTimelineProps {
  annotations: VideoAnnotation[];
  durationSec: number;
  playheadSec: number;
  onSeek?: (sec: number) => void;
  onSelectAnnotation?: (annotation: VideoAnnotation) => void;
}

export function AnnotationTimeline({
  annotations,
  durationSec,
  playheadSec,
  onSeek,
  onSelectAnnotation,
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
              >
                {blocks.map((a) => {
                  const startPct = Math.max(0, Math.min(100, (a.timestampSec / safeDuration) * 100));
                  const endSec = a.endSec ?? a.timestampSec + 2; // 2s default-bredde for punkt-annot
                  const endPct = Math.max(startPct + 1, Math.min(100, (endSec / safeDuration) * 100));
                  const widthPct = Math.max(0.6, endPct - startPct);
                  return (
                    <Tooltip key={a.id} title={a.body || '(uten tekst)'}>
                      <Box
                        data-testid={`annotation-block-${a.id}`}
                        role="button"
                        tabIndex={0}
                        aria-label={a.body || 'kommentar'}
                        onClick={() => {
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
                          bgcolor: `${track.color}66`,
                          border: `1px solid ${track.color}`,
                          borderRadius: 0.5,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: `${track.color}99` },
                          '&:focus-visible': { outline: `2px solid ${track.color}` },
                        }}
                      />
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
    </Box>
  );
}

export default AnnotationTimeline;
