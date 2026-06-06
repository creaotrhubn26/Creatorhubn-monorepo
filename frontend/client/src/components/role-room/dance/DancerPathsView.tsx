/**
 * DancerPathsView — DanceFlow-paritet: pre-danser linje-graf på tvers av
 * formasjons-rekkefølgen. Hver danser får sin egen rad; nodes = posisjon i
 * en formasjon, kobler sammen med en linje slik at man ser banen.
 *
 * Tomt panel hvis < 2 formasjoner eller ingen felles dansere. Bruker
 * normaliserte x/y (0..1) for å plotte — y blir invertert slik at
 * upstage = topp av rad-rektangelet.
 */

import React from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { Dancer, Formation } from './formationTypes';
import { danceFlowColors } from './danceFlowTheme';

const ROW_HEIGHT = 56;
const ROW_GAP = 6;
const LABEL_WIDTH = 64;
const NODE_R = 5;

export interface DancerPathsViewProps {
  formations: Formation[];
  dancers: readonly Dancer[];
}

interface DancerSeries {
  dancer: Dancer;
  /** Per formasjon: { x, y } eller null hvis ikke i den formasjonen. */
  points: Array<{ x: number; y: number } | null>;
}

export function DancerPathsView({ formations, dancers }: DancerPathsViewProps): React.ReactElement | null {
  const series = React.useMemo<DancerSeries[]>(() => {
    if (formations.length < 1 || dancers.length === 0) return [];
    return dancers.map((d) => ({
      dancer: d,
      points: formations.map((f) => {
        const p = f.positions.find((pp) => pp.dancerId === d.id);
        return p ? { x: p.x, y: p.y } : null;
      }),
    }));
  }, [formations, dancers]);

  // Filtrer ut dansere som ikke er i NOEN formasjon.
  const visible = series.filter((s) => s.points.some((p) => p !== null));
  if (visible.length === 0 || formations.length < 1) return null;

  return (
    <Box
      data-testid="dancer-paths-view"
      sx={{
        width: '100%',
        bgcolor: '#0d0f14',
        border: '1px solid rgba(139,92,246,0.18)',
        borderRadius: 1,
        p: 1,
      }}
    >
      <Typography sx={{ fontSize: 9, letterSpacing: 1.8, color: danceFlowColors.lavender, fontWeight: 700, mb: 0.5 }}>
        DANCERS · BANER OVER FORMASJONS-REKKEFØLGE
      </Typography>
      <Stack spacing={`${ROW_GAP}px`}>
        {visible.map((s) => (
          <Box
            key={s.dancer.id}
            data-testid={`dancer-path-${s.dancer.id}`}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Typography
              sx={{
                width: LABEL_WIDTH,
                fontSize: 10,
                fontWeight: 700,
                color: s.dancer.color ?? danceFlowColors.lavender,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s.dancer.initials || s.dancer.name.slice(0, 2).toUpperCase()} · {s.dancer.name}
            </Typography>
            <Box
              sx={{
                position: 'relative',
                flex: 1,
                height: ROW_HEIGHT,
                bgcolor: 'rgba(255,255,255,0.02)',
                borderRadius: 0.5,
                border: '1px dashed rgba(255,255,255,0.05)',
              }}
            >
              <svg
                width="100%"
                height={ROW_HEIGHT}
                viewBox={`0 0 100 ${ROW_HEIGHT}`}
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0 }}
              >
                {/* Connect non-null adjacent points with a stroke */}
                {s.points.reduce<React.ReactElement[]>((acc, p, i) => {
                  if (i === 0 || p == null) return acc;
                  const prev = s.points[i - 1];
                  if (prev == null) return acc;
                  const x1 = ((i - 1) / Math.max(1, s.points.length - 1)) * 100;
                  const x2 = (i / Math.max(1, s.points.length - 1)) * 100;
                  const y1 = prev.y * (ROW_HEIGHT - NODE_R * 2) + NODE_R;
                  const y2 = p.y * (ROW_HEIGHT - NODE_R * 2) + NODE_R;
                  acc.push(
                    <line
                      key={`l-${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={s.dancer.color ?? danceFlowColors.lavender}
                      strokeWidth={1.2}
                      opacity={0.85}
                      vectorEffect="non-scaling-stroke"
                    />,
                  );
                  return acc;
                }, [])}
              </svg>
              {s.points.map((p, i) => {
                if (p == null) return null;
                const x = (i / Math.max(1, s.points.length - 1)) * 100;
                const y = p.y * (ROW_HEIGHT - NODE_R * 2) + NODE_R;
                return (
                  <Tooltip
                    key={i}
                    title={`${formations[i]?.name ?? `#${i + 1}`} · ${(p.x * 100).toFixed(0)}% × ${(p.y * 100).toFixed(0)}%`}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${x}%`,
                        top: y,
                        width: NODE_R * 2,
                        height: NODE_R * 2,
                        marginLeft: `-${NODE_R}px`,
                        borderRadius: '50%',
                        bgcolor: s.dancer.color ?? danceFlowColors.lavender,
                        border: '1.5px solid #0d0f14',
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

export default DancerPathsView;
