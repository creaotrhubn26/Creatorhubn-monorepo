// @ts-nocheck
/**
 * StyleConsistencyIndicator — viser sekvens-palett + flagger frames som
 * driver bort fra etablert stil.
 *
 * Bruker `analyzeStyleDrift` fra styleConsistency.ts (leave-one-out).
 * Plasseres typisk under continuity-strip eller i Creative Studio-panelet.
 */

import React, { useMemo } from 'react';
import { Box, Stack, Typography, Tooltip, Alert } from '@mui/material';
import { Palette, WarningAmber, ErrorOutline, CheckCircleOutline } from '@mui/icons-material';
import { analyzeStyleDrift } from './styleConsistency';

export interface StyleConsistencyIndicatorProps {
  /** Alle frames i sekvensen. */
  frames: Array<{
    id: string;
    strokes?: unknown[];
    drawingData?: unknown;
    description?: string;
    shotNumber?: string;
  }>;
  /** Frame som er aktiv nå — får drift-status fremhevet. */
  activeFrameId?: string;
  /** Compact-mode for tett-inntil-canvas. */
  compact?: boolean;
}

export const StyleConsistencyIndicator: React.FC<StyleConsistencyIndicatorProps> = ({
  frames,
  activeFrameId,
  compact = false,
}) => {
  const report = useMemo(() => analyzeStyleDrift(frames as any), [frames]);
  const activeEntry = useMemo(
    () => report.driftByFrame.find((d) => d.frameId === activeFrameId),
    [report.driftByFrame, activeFrameId],
  );

  if (report.sequencePalette.length === 0) {
    return (
      <Box data-testid="style-consistency-empty" sx={{ p: compact ? 1 : 1.5 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          Tegne flere frames for å se sekvens-palett.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      data-testid="style-consistency-indicator"
      sx={{
        p: compact ? 1 : 1.5,
        borderRadius: 1.5,
        bgcolor: 'rgba(15,15,25,0.92)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
        <Palette sx={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }} />
        <Typography variant="overline" sx={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.65)', fontWeight: 800 }}>
          Sekvens-palett
        </Typography>
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ mb: activeEntry ? 1 : 0 }} data-testid="sequence-palette">
        {report.sequencePalette.map((bin) => (
          <Tooltip key={bin.color} title={`${bin.color}  ·  vekt ${Math.round(bin.weight)}`}>
            <Box
              sx={{
                width: compact ? 18 : 22,
                height: compact ? 18 : 22,
                borderRadius: 0.75,
                bgcolor: bin.color,
                border: '1px solid rgba(255,255,255,0.18)',
                cursor: 'help',
              }}
            />
          </Tooltip>
        ))}
      </Stack>

      {activeEntry && (
        <Box data-testid="active-drift-status" sx={{ mt: 0.5 }}>
          {activeEntry.severity === 'ok' && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <CheckCircleOutline sx={{ fontSize: 14, color: '#34d399' }} />
              <Typography variant="caption" sx={{ color: '#86efac', fontSize: 11 }}>
                Stil-konsistent ({(activeEntry.drift * 100).toFixed(0)} % drift)
              </Typography>
            </Stack>
          )}
          {activeEntry.severity === 'warning' && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <WarningAmber sx={{ fontSize: 14, color: '#fbbf24' }} />
              <Typography variant="caption" sx={{ color: '#fcd34d', fontSize: 11 }}>
                Lett stil-drift ({(activeEntry.drift * 100).toFixed(0)} %). Vurder å plukke farger fra sekvens-paletten.
              </Typography>
            </Stack>
          )}
          {activeEntry.severity === 'high' && (
            <Alert
              severity="warning"
              variant="outlined"
              icon={<ErrorOutline sx={{ fontSize: 16 }} />}
              sx={{ mt: 0.5, py: 0.5, fontSize: 11, color: '#fca5a5', borderColor: 'rgba(239,68,68,0.4)', bgcolor: 'rgba(239,68,68,0.08)' }}
            >
              Denne framen bryter sekvens-stilen ({(activeEntry.drift * 100).toFixed(0)} % drift).
              Sjekk om paletten matcher resten.
            </Alert>
          )}
        </Box>
      )}

      {report.outliers.length > 0 && !activeEntry && (
        <Typography variant="caption" sx={{ color: '#fcd34d', fontSize: 11, mt: 0.75, display: 'block' }}>
          {report.outliers.length} outlier-frame{report.outliers.length !== 1 ? 's' : ''} flagget.
        </Typography>
      )}
    </Box>
  );
};

export default StyleConsistencyIndicator;
