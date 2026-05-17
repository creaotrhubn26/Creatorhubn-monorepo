// @ts-nocheck
/**
 * AnimaticThumbnailStrip — Final Cut-style miniatyrer langs tidslinjen.
 * Hver thumbnail er proporsjonal med frame.duration, så de stiller seg
 * opp med scrubber-posisjonene. Klikk = hopp til framet.
 */

import React from 'react';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';

export interface ThumbnailFrame {
  id: string;
  duration?: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  shotNumber?: string;
  description?: string;
}

export interface AnimaticThumbnailStripProps {
  frames: ThumbnailFrame[];
  activeFrameIndex: number;
  /** Total duration i sekunder — for proporsjonal bredde. */
  totalDuration: number;
  onSeekToFrame: (frameIndex: number) => void;
  /** Compact-modus: kortere thumbnail-høyde. */
  compact?: boolean;
}

const DEFAULT_FRAME_DURATION = 3;

export const AnimaticThumbnailStrip: React.FC<AnimaticThumbnailStripProps> = ({
  frames,
  activeFrameIndex,
  totalDuration,
  onSeekToFrame,
  compact = false,
}) => {
  if (frames.length === 0 || totalDuration <= 0) return null;

  const height = compact ? 36 : 48;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0,
        width: '100%',
        height,
        mb: 0.5,
        bgcolor: 'rgba(0,0,0,0.3)',
        borderRadius: 0.75,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      data-testid="animatic-thumbnail-strip"
    >
      {frames.map((frame, idx) => {
        const dur = (frame.duration ?? DEFAULT_FRAME_DURATION) > 0
          ? (frame.duration ?? DEFAULT_FRAME_DURATION)
          : DEFAULT_FRAME_DURATION;
        const widthPercent = (dur / totalDuration) * 100;
        const isActive = idx === activeFrameIndex;
        const src = frame.imageUrl || frame.thumbnailUrl;
        return (
          <Tooltip
            key={frame.id}
            title={
              <Box>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                  {frame.shotNumber ? `Shot ${frame.shotNumber}` : `Frame ${idx + 1}`}
                </Typography>
                {frame.description && (
                  <Typography variant="caption" sx={{ display: 'block', fontSize: 10, opacity: 0.8 }}>
                    {frame.description.slice(0, 80)}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ display: 'block', fontSize: 9, opacity: 0.6 }}>
                  {dur.toFixed(1)}s
                </Typography>
              </Box>
            }
            placement="top"
          >
            <ButtonBase
              onClick={() => onSeekToFrame(idx)}
              sx={{
                width: `${widthPercent}%`,
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                bgcolor: '#000',
                borderRight: idx < frames.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                opacity: isActive ? 1 : 0.65,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 0.9 },
                boxShadow: isActive ? 'inset 0 0 0 2px #a5b4fc' : 'none',
                flexShrink: 0,
                minWidth: 0,
              }}
              data-testid={`animatic-thumbnail-${idx}`}
            >
              {src ? (
                <Box
                  component="img"
                  src={src}
                  alt={frame.description || `Frame ${idx + 1}`}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                  loading="lazy"
                />
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: 10,
                  }}
                >
                  {idx + 1}
                </Box>
              )}
              {/* Frame-nummer i hjørnet — synlig kun når thumbnail er bredt nok. */}
              {widthPercent > 6 && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 1,
                    left: 2,
                    fontSize: 8,
                    fontWeight: 600,
                    color: 'white',
                    textShadow: '0 0 2px rgba(0,0,0,0.8)',
                    fontFamily: 'monospace',
                  }}
                >
                  {idx + 1}
                </Box>
              )}
            </ButtonBase>
          </Tooltip>
        );
      })}
    </Box>
  );
};
