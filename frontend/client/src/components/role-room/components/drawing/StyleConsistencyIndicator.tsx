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
import { Palette, WarningAmber, ErrorOutline, CheckCircleOutline, CollectionsBookmark } from '@mui/icons-material';
import { analyzeStyleDrift, type ColorBin } from './styleConsistency';

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
  /** Hvis satt: mål drift mot denne paletten (typisk fra mood-board)
   *  i stedet for leave-one-out på sekvensen. */
  targetPalette?: ColorBin[];
}

export const StyleConsistencyIndicator: React.FC<StyleConsistencyIndicatorProps> = ({
  frames,
  activeFrameId,
  compact = false,
  targetPalette,
}) => {
  const report = useMemo(
    () => analyzeStyleDrift(frames as any, { targetPalette }),
    [frames, targetPalette],
  );
  const activeEntry = useMemo(
    () => report.driftByFrame.find((d) => d.frameId === activeFrameId),
    [report.driftByFrame, activeFrameId],
  );
  const hasTarget = report.driftSource === 'target' && Array.isArray(targetPalette) && targetPalette.length > 0;
  const displayPalette = hasTarget ? targetPalette! : report.sequencePalette;
  const paletteLabel = hasTarget ? 'Mood-board-palett' : 'Sekvens-palett';
  const PaletteIcon = hasTarget ? CollectionsBookmark : Palette;

  if (displayPalette.length === 0) {
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
        <PaletteIcon sx={{ fontSize: 14, color: hasTarget ? '#c4b5fd' : 'rgba(255,255,255,0.6)' }} />
        <Typography variant="overline" sx={{ fontSize: 10, letterSpacing: '0.08em', color: hasTarget ? '#c4b5fd' : 'rgba(255,255,255,0.65)', fontWeight: 800 }}>
          {paletteLabel}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        spacing={0.5}
        sx={{ mb: activeEntry ? 1 : 0 }}
        data-testid={hasTarget ? 'target-palette' : 'sequence-palette'}
      >
        {displayPalette.map((bin) => (
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
                {hasTarget ? 'Matcher mood-board' : 'Stil-konsistent'} ({(activeEntry.drift * 100).toFixed(0)} % drift)
              </Typography>
            </Stack>
          )}
          {activeEntry.severity === 'warning' && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <WarningAmber sx={{ fontSize: 14, color: '#fbbf24' }} />
              <Typography variant="caption" sx={{ color: '#fcd34d', fontSize: 11 }}>
                {hasTarget
                  ? `Lett drift fra mood-board (${(activeEntry.drift * 100).toFixed(0)} %). Plukk farger fra refs.`
                  : `Lett stil-drift (${(activeEntry.drift * 100).toFixed(0)} %). Vurder å plukke farger fra sekvens-paletten.`}
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
              {hasTarget
                ? `Denne framen er langt fra mood-board-paletten (${(activeEntry.drift * 100).toFixed(0)} % drift). Sjekk fargene mot refs.`
                : `Denne framen bryter sekvens-stilen (${(activeEntry.drift * 100).toFixed(0)} % drift). Sjekk om paletten matcher resten.`}
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
