/**
 * SelfTapeVideoPlayer — video-player med custom controls + opptaks-knapp
 *
 * Fase B: render uten ekte video (stub-placeholder). Fase C kobler til
 * MediaRecorder + CF Stream playback.
 */
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import { useState } from 'react';

import { palette, radius } from '../../theme';
import {
  formatDuration,
  type SelftapeTake,
} from '../../../services/roleRoomSelfTapesService';

interface Props {
  take: SelftapeTake | null;
}

export default function SelfTapeVideoPlayer({ take }: Props) {
  const [playing, setPlaying] = useState(false);
  // Fase B: stub-progress (33% inn). Fase C: faktisk videoTime-binding.
  const progressPct = 33;

  return (
    <Box
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      {/* Tittel-bar */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2.4, py: 1.4, borderBottom: `1px solid ${palette.borderSubtle}` }}
      >
        <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', fontWeight: 600 }}>
          Nåværende take: {take ? `Take ${take.take_number}` : 'Ingen take valgt'}
        </Typography>
        <Tooltip title="Verktøy">
          <IconButton size="small" sx={{ color: palette.textMuted }}>
            <HandymanOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Video-flate */}
      <Box
        sx={{
          aspectRatio: '16 / 9',
          bgcolor: '#000',
          position: 'relative',
          backgroundImage: take?.thumbnail_url ? `url(${take.thumbnail_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: palette.textMuted,
        }}
      >
        {!take?.thumbnail_url ? (
          <Stack alignItems="center" spacing={1.4}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: 'rgba(168,85,247,0.18)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlayCircleOutlineIcon sx={{ color: palette.accentBright, fontSize: 40 }} />
            </Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
              {take ? `Take ${take.take_number} · ${formatDuration(take.duration_ms)}` : 'Ingen video lastet'}
            </Typography>
          </Stack>
        ) : null}
      </Box>

      {/* Progress-bar */}
      <Box sx={{ position: 'relative', height: 6, bgcolor: 'rgba(168,85,247,0.10)' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, #a855f7, #d946ef)',
            boxShadow: '0 0 8px rgba(168,85,247,0.4)',
          }}
        />
      </Box>

      {/* Controls */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.2 }}
      >
        <IconButton
          size="small"
          sx={{ color: palette.textPrimary }}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing
            ? <PauseCircleOutlineIcon fontSize="medium" />
            : <PlayCircleOutlineIcon fontSize="medium" />}
        </IconButton>
        <IconButton size="small" sx={{ color: palette.textMuted }}>
          <Replay10Icon fontSize="small" />
        </IconButton>
        <IconButton size="small" sx={{ color: palette.textMuted }}>
          <Forward10Icon fontSize="small" />
        </IconButton>
        <IconButton size="small" sx={{ color: palette.textMuted }}>
          <VolumeUpOutlinedIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', ml: 0.6 }}>
          {take ? `00:21 / ${formatDuration(take.duration_ms)}` : '00:00 / 00:00'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>1x</Typography>
        <IconButton size="small" sx={{ color: palette.textMuted }}>
          <SettingsOutlinedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" sx={{ color: palette.textMuted }}>
          <FullscreenOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Action-knapper under */}
      <Stack
        direction="row"
        spacing={1.4}
        sx={{ p: 2, borderTop: `1px solid ${palette.borderSubtle}`, flexWrap: 'wrap', gap: 1 }}
      >
        <Box
          component="button"
          sx={{
            flex: '1 1 auto',
            minWidth: 220,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            background: palette.accentGradient,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            py: 1.4,
            px: 2.4,
            borderRadius: radius.sm,
            fontWeight: 700,
            fontSize: '0.92rem',
            fontFamily: 'inherit',
            boxShadow: '0 4px 14px rgba(168,85,247,0.38)',
            '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
          }}
        >
          <VideocamOutlinedIcon fontSize="small" />
          Spill inn ny take
        </Box>
        <Box
          component="button"
          sx={{
            flex: '1 1 auto',
            minWidth: 160,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            background: 'transparent',
            color: palette.textPrimary,
            border: `1px solid ${palette.borderStrong}`,
            cursor: 'pointer',
            py: 1.4,
            px: 2.4,
            borderRadius: radius.sm,
            fontWeight: 600,
            fontFamily: 'inherit',
            '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
          }}
        >
          <FileUploadOutlinedIcon fontSize="small" />
          Last opp video
        </Box>
        <Box
          component="button"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            background: 'transparent',
            color: palette.textPrimary,
            border: `1px solid ${palette.borderStrong}`,
            cursor: 'pointer',
            py: 1.4,
            px: 2,
            borderRadius: radius.sm,
            fontWeight: 600,
            fontFamily: 'inherit',
            '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
          }}
        >
          <MenuBookOutlinedIcon fontSize="small" />
          Guides
        </Box>
      </Stack>
    </Box>
  );
}
