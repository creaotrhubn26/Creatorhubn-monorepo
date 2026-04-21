import React, { useMemo } from 'react';
import { Box, Chip, CircularProgress, Stack, Tooltip, Typography } from '@mui/material';
import type { DetectedFace, FaceDetectionStatus } from '../../lib/enhancer-session/types';

export interface FaceChipStripProps {
  faces: DetectedFace[] | undefined;
  status: FaceDetectionStatus;
  activeFaceIndex: number | null;
  onSelect: (face: DetectedFace | null) => void;
}

/**
 * Numbered face chips — one per detected face — shown in a horizontal
 * strip above the preview. Clicking a chip emits the full face object so
 * the parent can zoom the preview onto the bounding box. Clicking the
 * active chip again emits null to reset.
 *
 * The strip is invisible when detection hasn't started and collapses to
 * a short status line when no faces were found.
 */
export function FaceChipStrip(props: FaceChipStripProps) {
  const { faces, status, activeFaceIndex, onSelect } = props;

  const ordered = useMemo(() => {
    if (!faces) return [] as DetectedFace[];
    // Largest face first — typically the primary subject in the frame.
    return [...faces].sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  }, [faces]);

  if (status === 'idle') return null;
  if (status === 'unavailable') {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
        Ansiktsdeteksjon utilgjengelig (face-api.js ikke lastet)
      </Typography>
    );
  }
  if (status === 'pending') {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 0.5 }}>
        <CircularProgress size={12} thickness={5} />
        <Typography variant="caption" color="text.secondary">
          Detekterer ansikter…
        </Typography>
      </Stack>
    );
  }
  if (status === 'none' || ordered.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
        Ingen ansikter funnet
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap" sx={{ px: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
        {ordered.length} ansikt{ordered.length === 1 ? '' : 'er'}
      </Typography>
      {ordered.map((face) => {
        const isActive = face.index === activeFaceIndex;
        const confidencePct = face.score != null ? Math.round(face.score * 100) : null;
        return (
          <Tooltip
            key={face.index}
            title={
              confidencePct != null
                ? `Ansikt #${face.index + 1} · ${confidencePct}% sikker`
                : `Ansikt #${face.index + 1}`
            }
            placement="bottom"
          >
            <Chip
              size="small"
              label={face.index + 1}
              onClick={() => onSelect(isActive ? null : face)}
              color={isActive ? 'primary' : 'default'}
              variant={isActive ? 'filled' : 'outlined'}
              sx={{
                minWidth: 28,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            />
          </Tooltip>
        );
      })}
      {activeFaceIndex != null && (
        <Chip
          size="small"
          label="Tilpass"
          variant="outlined"
          onClick={() => onSelect(null)}
          sx={{ ml: 0.5 }}
        />
      )}
    </Stack>
  );
}

/** Utility the preview uses to compute CSS transform values for
 *  zoom-to-face. Pure so the call site stays simple. */
export function computeFocusTransform(
  box: { x: number; y: number; width: number; height: number },
  containerWidth: number,
  containerHeight: number,
  padding = 0.25,
): { scale: number; translateXPct: number; translateYPct: number } {
  const boxCx = box.x + box.width / 2;
  const boxCy = box.y + box.height / 2;
  const padW = box.width * (1 + padding);
  const padH = box.height * (1 + padding);
  const scaleX = 1 / padW;
  const scaleY = 1 / padH;
  const scale = Math.max(1, Math.min(scaleX, scaleY, 6));
  // Translate in percentages of the container so the face centres in view.
  const translateXPct = (0.5 - boxCx) * 100;
  const translateYPct = (0.5 - boxCy) * 100;
  return { scale, translateXPct, translateYPct };
}
