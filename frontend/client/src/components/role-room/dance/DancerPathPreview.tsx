/**
 * DancerPathPreview — DanceFlow-paritet: mini-canvas som viser EN dansers
 * reisevei på tvers av formasjons-sekvensen, sammen med metrikker:
 *
 *   Path Length    8.42 m
 *   Travel Time    00:00:12:00
 *
 * Beregner total banelengde i meter ved å summere distanser mellom
 * etterfølgende formasjoners posisjoner (skalert med stage-bredde/dybde
 * fra første formasjon — default 12×8 m).
 */

import React from 'react';
import { Box, Stack, Typography, MenuItem, TextField } from '@mui/material';
import type { Dancer, Formation } from './formationTypes';
import { formatTimecode } from './timecode';

const PREVIEW_HEIGHT = 96;
const STAGE_DEFAULT_M = { w: 12, d: 8 };

export interface DancerPathPreviewProps {
  formations: Formation[];
  dancers: readonly Dancer[];
  /** Default-valgt dancer-id. */
  defaultDancerId?: string | null;
}

export function DancerPathPreview({
  formations,
  dancers,
  defaultDancerId,
}: DancerPathPreviewProps): React.ReactElement | null {
  const dancersInAny = React.useMemo(
    () => dancers.filter((d) => formations.some((f) => f.positions.some((p) => p.dancerId === d.id))),
    [formations, dancers],
  );

  const [selectedId, setSelectedId] = React.useState<string>(
    () => defaultDancerId ?? dancersInAny[0]?.id ?? '',
  );

  React.useEffect(() => {
    if (!selectedId && dancersInAny[0]) setSelectedId(dancersInAny[0].id);
  }, [dancersInAny, selectedId]);

  if (dancersInAny.length === 0) return null;
  const dancer = dancersInAny.find((d) => d.id === selectedId) ?? dancersInAny[0];

  const points = formations
    .map((f) => f.positions.find((p) => p.dancerId === dancer.id))
    .filter((p): p is { dancerId: string; x: number; y: number } => !!p);

  // Path length i meter (Pythagoras, x*stage_width + y*stage_depth).
  let pathLengthM = 0;
  for (let i = 1; i < points.length; i += 1) {
    const dx = (points[i].x - points[i - 1].x) * STAGE_DEFAULT_M.w;
    const dy = (points[i].y - points[i - 1].y) * STAGE_DEFAULT_M.d;
    pathLengthM += Math.sqrt(dx * dx + dy * dy);
  }

  // Travel time = siste formasjons end - første formasjons start, hvis satt.
  const firstStart = formations[0]?.startSec ?? null;
  const lastEnd = formations[formations.length - 1]?.endSec ?? null;
  const travelSec = firstStart != null && lastEnd != null && lastEnd > firstStart
    ? lastEnd - firstStart
    : 0;

  return (
    <Box
      data-testid="dancer-path-preview"
      sx={{ pb: 1.5, mb: 1.5, borderBottom: '1px solid #1e2536' }}
    >
      <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: '#6b7280', fontWeight: 700, mb: 0.5 }}>
        MOVEMENT PATHS
      </Typography>
      <TextField
        select
        size="small"
        fullWidth
        value={dancer.id}
        onChange={(e) => setSelectedId(e.target.value)}
        inputProps={{ 'data-testid': 'dancer-path-preview-select' }}
        sx={{ mb: 0.75, '& .MuiInputBase-input': { fontSize: 10.5 } }}
      >
        {dancersInAny.map((d) => (
          <MenuItem key={d.id} value={d.id} sx={{ fontSize: 11 }}>
            {d.initials || d.id.slice(0, 2).toUpperCase()} · {d.name}
          </MenuItem>
        ))}
      </TextField>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: PREVIEW_HEIGHT,
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 0.5,
          mb: 0.75,
        }}
      >
        <svg
          width="100%"
          height={PREVIEW_HEIGHT}
          viewBox={`0 0 100 ${PREVIEW_HEIGHT}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0 }}
        >
          {points.length >= 2 ? (
            <polyline
              points={points
                .map((p, i) => `${(i / Math.max(1, points.length - 1)) * 100},${p.y * (PREVIEW_HEIGHT - 8) + 4}`)
                .join(' ')}
              fill="none"
              stroke={dancer.color ?? '#a78bfa'}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={(i / Math.max(1, points.length - 1)) * 100}
              cy={p.y * (PREVIEW_HEIGHT - 8) + 4}
              r={2.5}
              fill={dancer.color ?? '#a78bfa'}
              stroke="#0d0f14"
              strokeWidth={1}
            />
          ))}
        </svg>
      </Box>
      <Stack direction="row" justifyContent="space-between" sx={{ fontSize: 10 }}>
        <Box>
          <Typography sx={{ fontSize: 9, color: '#6b7280' }}>Path Length</Typography>
          <Typography
            sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}
            data-testid="dancer-path-preview-length"
          >
            {pathLengthM.toFixed(2)} m
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 9, color: '#6b7280' }}>Travel Time</Typography>
          <Typography
            sx={{ fontSize: 11, color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}
            data-testid="dancer-path-preview-time"
          >
            {formatTimecode(travelSec)}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

export default DancerPathPreview;
