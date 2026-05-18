// @ts-nocheck
/**
 * ContinuityStrip — horisontal stripe med ±2 nabo-frames + aktiv frame.
 *
 * Storyboard-artister glemmer kontinuitet hvis hver frame tegnes
 * isolert — nabo-thumbs holder rytmen synlig. Klikk på en nabo-thumb
 * navigerer til den framen.
 */

import React from 'react';
import { Box, Stack, Typography, Tooltip } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { getNeighborWindow, getNavigationFlags } from './continuityStripHelpers';

export interface ContinuityStripFrame {
  id: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  description?: string;
  shotNumber?: string;
}

export interface ContinuityStripProps {
  frames: ContinuityStripFrame[];
  activeIndex: number;
  onSelectFrame?: (index: number) => void;
  /** ±N naboer. Default 2 = 5 thumbs totalt. */
  radius?: number;
  /** Compact-mode for tett-inntil-canvas-bruk. */
  compact?: boolean;
}

const THUMB_WIDTH = 88;
const THUMB_HEIGHT = 56;
const COMPACT_THUMB_WIDTH = 64;
const COMPACT_THUMB_HEIGHT = 40;

export const ContinuityStrip: React.FC<ContinuityStripProps> = ({
  frames,
  activeIndex,
  onSelectFrame,
  radius = 2,
  compact = false,
}) => {
  const window = getNeighborWindow(frames, activeIndex, radius);
  const flags = getNavigationFlags(frames.length, activeIndex);
  const w = compact ? COMPACT_THUMB_WIDTH : THUMB_WIDTH;
  const h = compact ? COMPACT_THUMB_HEIGHT : THUMB_HEIGHT;

  if (window.ordered.length === 0) {
    return null;
  }

  return (
    <Box
      data-testid="continuity-strip"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        p: compact ? 0.75 : 1,
        bgcolor: 'rgba(15,15,25,0.92)',
        borderRadius: 1.5,
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <NavArrow
        direction="left"
        disabled={!flags.hasPrevious}
        onClick={() => flags.hasPrevious && onSelectFrame?.(activeIndex - 1)}
      />

      {window.ordered.map((entry) => (
        <ContinuityThumb
          key={`${entry.frame.id}-${entry.index}`}
          frame={entry.frame}
          index={entry.index}
          relativeOffset={entry.relativeOffset}
          isActive={entry.isActive}
          width={w}
          height={h}
          onClick={() => onSelectFrame?.(entry.index)}
        />
      ))}

      <NavArrow
        direction="right"
        disabled={!flags.hasNext}
        onClick={() => flags.hasNext && onSelectFrame?.(activeIndex + 1)}
      />
    </Box>
  );
};

interface ContinuityThumbProps {
  frame: ContinuityStripFrame;
  index: number;
  relativeOffset: number;
  isActive: boolean;
  width: number;
  height: number;
  onClick: () => void;
}

const ContinuityThumb: React.FC<ContinuityThumbProps> = ({
  frame,
  index,
  relativeOffset,
  isActive,
  width,
  height,
  onClick,
}) => {
  const imageSrc = frame.thumbnailUrl || frame.imageUrl;
  const labelText = relativeOffset === 0
    ? 'NÅ'
    : relativeOffset > 0
      ? `+${relativeOffset}`
      : `${relativeOffset}`;
  const titleText = `Frame ${index + 1}${frame.shotNumber ? ` · ${frame.shotNumber}` : ''}${frame.description ? `: ${frame.description}` : ''}`;

  return (
    <Tooltip title={titleText} placement="top" arrow>
      <Box
        data-testid={`continuity-thumb-${index}`}
        data-active={isActive ? 'true' : 'false'}
        onClick={onClick}
        sx={{
          width,
          height,
          flexShrink: 0,
          borderRadius: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: 'pointer',
          border: isActive
            ? '2px solid #fbbf24'
            : '1px solid rgba(255,255,255,0.12)',
          boxShadow: isActive ? '0 0 14px rgba(251,191,36,0.4)' : 'none',
          bgcolor: 'rgba(40,40,52,0.8)',
          transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
          '&:hover': {
            borderColor: '#fbbf24',
            transform: 'translateY(-2px)',
          },
        }}
      >
        {imageSrc ? (
          <Box
            component="img"
            src={imageSrc}
            alt={`Frame ${index + 1}`}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>
            <span>Ingen tegning</span>
          </Stack>
        )}
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            top: 2,
            left: 2,
            px: 0.5,
            py: 0.1,
            fontSize: 9,
            fontWeight: 800,
            color: isActive ? '#0b1120' : '#fff',
            bgcolor: isActive ? '#fbbf24' : 'rgba(0,0,0,0.55)',
            borderRadius: 0.5,
            letterSpacing: '0.04em',
          }}
        >
          {labelText}
        </Typography>
      </Box>
    </Tooltip>
  );
};

const NavArrow: React.FC<{ direction: 'left' | 'right'; disabled: boolean; onClick: () => void }> = ({
  direction,
  disabled,
  onClick,
}) => (
  <Box
    onClick={disabled ? undefined : onClick}
    sx={{
      width: 22,
      height: 22,
      borderRadius: '50%',
      bgcolor: disabled ? 'transparent' : 'rgba(255,255,255,0.06)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.25 : 0.85,
      flexShrink: 0,
      '&:hover': {
        bgcolor: disabled ? 'transparent' : 'rgba(255,255,255,0.14)',
      },
    }}
  >
    {direction === 'left' ? <ChevronLeft sx={{ fontSize: 16 }} /> : <ChevronRight sx={{ fontSize: 16 }} />}
  </Box>
);

export default ContinuityStrip;
