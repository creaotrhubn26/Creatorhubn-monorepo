/**
 * FormationTimeline — DanceFlow-paritet: tids-basert formasjons-rekkefølge.
 *
 * Renderer formasjoner som horisontale blokker på en tidsakse. Hver blokk
 * er plassert ved formation.startSec → formation.endSec. Formasjoner uten
 * tid plasseres til slutt med default-bredde slik at de fortsatt er
 * synlige og klikkbare.
 *
 * Klikk → setActiveFormationId. Aktiv formasjon har thicker border.
 */

import React from 'react';
import { Box, Stack, Typography, Tooltip } from '@mui/material';
import type { Formation } from './formationTypes';

const TRACK_HEIGHT = 32;
const LABEL_WIDTH = 56;
const DEFAULT_BLOCK_SEC = 8;

export interface FormationTimelineProps {
  formations: Formation[];
  activeFormationId: string | null;
  /** Hvor lang tids-aksen er. Brukes til pct-beregning. Default = max(endSec). */
  totalDurationSec?: number;
  onSelect?: (id: string) => void;
}

export function FormationTimeline({
  formations,
  activeFormationId,
  totalDurationSec,
  onSelect,
}: FormationTimelineProps): React.ReactElement {
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
    16,
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
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography
          sx={{ width: LABEL_WIDTH, fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: 1, flexShrink: 0 }}
        >
          FORMATION
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
          {placed.map(({ formation, start, end }) => {
            const startPct = Math.max(0, Math.min(100, (start / computedDuration) * 100));
            const endPct = Math.max(startPct + 1, Math.min(100, (end / computedDuration) * 100));
            const widthPct = Math.max(2, endPct - startPct);
            const isActive = formation.id === activeFormationId;
            return (
              <Tooltip
                key={formation.id}
                title={`${formation.name} · ${start.toFixed(0)}–${end.toFixed(0)}s`}
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
                    position: 'absolute',
                    top: 2,
                    bottom: 2,
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    minWidth: 24,
                    bgcolor: isActive ? 'rgba(167,139,250,0.32)' : 'rgba(167,139,250,0.14)',
                    border: `${isActive ? 2 : 1}px solid ${isActive ? '#c4b5fd' : 'rgba(167,139,250,0.45)'}`,
                    borderRadius: 0.5,
                    cursor: 'pointer',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 600,
                    px: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
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
    </Box>
  );
}

export default FormationTimeline;
