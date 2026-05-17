// @ts-nocheck
/**
 * AnimaticVoiceoverStrip — horisontal rad med mic-knapper per frame
 * for opplastning av per-frame voiceover. Aktivt frame fremheves,
 * frames med voiceover får grønn tint.
 */

import React from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { MicNone, Close as CloseIcon } from '@mui/icons-material';

export interface VoiceoverStripFrame {
  id: string;
}

export interface AnimaticVoiceoverStripProps {
  frames: VoiceoverStripFrame[];
  activeFrameIndex: number;
  /** Map fra frameId → voiceover-URL (user-uploadet eller fra prop). */
  voiceoverUrls: Record<string, string>;
  /** Predikat: gir true hvis framet har en voiceover (uavhengig av kilde). */
  hasVoiceover: (frame: VoiceoverStripFrame) => boolean;
  isFullscreen: boolean;
  stageMaxWidth: number;
  onPick: (frameId: string) => void;
  onClear: (frameId: string) => void;
}

export const AnimaticVoiceoverStrip: React.FC<AnimaticVoiceoverStripProps> = ({
  frames,
  activeFrameIndex,
  voiceoverUrls,
  hasVoiceover,
  isFullscreen,
  stageMaxWidth,
  onPick,
  onClear,
}) => {
  if (frames.length <= 1) return null;
  return (
    <Box
      sx={{
        maxWidth: isFullscreen ? '70%' : stageMaxWidth,
        mx: 'auto',
        mb: 0.75,
        display: 'flex',
        gap: 0.25,
        overflowX: 'auto',
        px: 0.5,
        py: 0.5,
        bgcolor: 'rgba(0,0,0,0.3)',
        borderRadius: 1,
      }}
      data-testid="animatic-voiceover-strip"
    >
      {frames.map((f, idx) => {
        const hasVo = hasVoiceover(f);
        const isActive = idx === activeFrameIndex;
        return (
          <Tooltip
            key={f.id}
            title={
              hasVo
                ? `Frame ${idx + 1} — voiceover på (klikk for å bytte)`
                : `Frame ${idx + 1} — legg til voiceover`
            }
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.25}
              sx={{
                px: 0.5,
                py: 0.25,
                borderRadius: 0.75,
                bgcolor: isActive ? 'rgba(165,180,252,0.2)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'rgba(165,180,252,0.5)' : 'transparent',
                flexShrink: 0,
              }}
              data-testid={`animatic-voiceover-frame-${idx}`}
            >
              <IconButton
                size="small"
                onClick={() => onPick(f.id)}
                sx={{
                  p: 0.25,
                  color: hasVo ? '#86efac' : 'rgba(255,255,255,0.5)',
                }}
              >
                <MicNone fontSize="inherit" sx={{ fontSize: 14 }} />
              </IconButton>
              <Typography variant="caption" sx={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                {idx + 1}
              </Typography>
              {hasVo && voiceoverUrls[f.id] && (
                <IconButton
                  size="small"
                  onClick={() => onClear(f.id)}
                  sx={{ p: 0.1, color: 'rgba(255,255,255,0.4)' }}
                >
                  <CloseIcon sx={{ fontSize: 10 }} />
                </IconButton>
              )}
            </Stack>
          </Tooltip>
        );
      })}
    </Box>
  );
};
