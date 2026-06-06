/**
 * SelfTapeVideoPlayer — ekte <video>-element med custom controls,
 * record/upload-knapper og guide-snarvei.
 *
 * Fase B-2: video-element med play/pause/seek/volum/fullskjerm-binding.
 * Fase C: record-knapp åpner RecordTakeDialog, upload-knapp tar i mot fil.
 */
import { Box, IconButton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import VolumeOffOutlinedIcon from '@mui/icons-material/VolumeOffOutlined';
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { useEffect, useRef, useState } from 'react';

import { palette, radius } from '../../theme';
import {
  externalProviderLabel,
  formatDuration,
  isExternalProvider,
  type SelftapeTake,
} from '../../../services/roleRoomSelfTapesService';

interface Props {
  take: SelftapeTake | null;
  onRecordClick: () => void;
  onUploadFile: (file: File) => void;
  onGuidesClick: () => void;
  onAddExternalClick: () => void;
}

export default function SelfTapeVideoPlayer({
  take, onRecordClick, onUploadFile, onGuidesClick, onAddExternalClick,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(take?.duration_ms ?? 0);

  // Sync video src til take
  useEffect(() => {
    setPlaying(false);
    setCurrentMs(0);
    setDurationMs(take?.duration_ms ?? 0);
  }, [take?.id, take?.video_url, take?.duration_ms]);

  const isExternal = isExternalProvider(take?.source_provider);
  const playable = take?.video_url ?? take?.hls_manifest ?? null;
  // For external embeds bygger vi iframe-URL fra video_url (allerede embed-formet
  // av backend parseExternalVideoUrl).
  const externalEmbedUrl = isExternal ? (take?.video_url ?? null) : null;

  const handlePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const handleSeek = (deltaSec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + deltaSec));
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  const handleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleFullscreen = () => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else c.requestFullscreen?.().catch(() => {});
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const progressPct = durationMs > 0
    ? Math.min(100, (currentMs / durationMs) * 100)
    : 0;
  const elapsedLabel = formatDuration(currentMs);
  const totalLabel = formatDuration(durationMs);

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
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', fontWeight: 600 }}>
            Nåværende take: {take ? `Take ${take.take_number}` : 'Ingen take valgt'}
          </Typography>
          {isExternal ? (
            <Box
              sx={{
                bgcolor: 'rgba(168,85,247,0.18)',
                color: palette.accentBright,
                fontWeight: 700,
                fontSize: '0.7rem',
                px: 1,
                py: 0.2,
                borderRadius: 999,
              }}
            >
              {externalProviderLabel(take?.source_provider)}
            </Box>
          ) : null}
        </Stack>
        <Tooltip title="Verktøy">
          <IconButton size="small" sx={{ color: palette.textMuted }}>
            <HandymanOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Video-flate */}
      <Box
        ref={containerRef}
        sx={{
          aspectRatio: '16 / 9',
          bgcolor: '#000',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: palette.textMuted,
        }}
      >
        {externalEmbedUrl ? (
          <iframe
            src={externalEmbedUrl}
            title={`Take ${take?.take_number ?? ''}`}
            allow="autoplay; fullscreen; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        ) : playable ? (
          <video
            ref={videoRef}
            src={playable}
            playsInline
            poster={take?.thumbnail_url ?? undefined}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
            onDurationChange={(e) => setDurationMs(e.currentTarget.duration * 1000)}
            onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Stack alignItems="center" spacing={1.4}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: take?.thumbnail_url ? undefined : 'rgba(168,85,247,0.18)',
                backgroundImage: take?.thumbnail_url ? `url(${take.thumbnail_url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
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
        )}
      </Box>

      {/* Scrub-bar (kun for native CF Stream — eksterne har egne kontroller i iframe) */}
      {!isExternal ? (
        <Box
          onClick={handleScrub}
          sx={{
            position: 'relative',
            height: 6,
            bgcolor: 'rgba(168,85,247,0.10)',
            cursor: playable ? 'pointer' : 'default',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #a855f7, #d946ef)',
              boxShadow: '0 0 8px rgba(168,85,247,0.4)',
              pointerEvents: 'none',
            }}
          />
        </Box>
      ) : null}

      {/* Controls — skjules for eksterne (iframe har egne) */}
      {!isExternal ? (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.2 }}
      >
        <IconButton
          size="small"
          sx={{ color: palette.textPrimary }}
          disabled={!playable}
          onClick={handlePlayPause}
        >
          {playing
            ? <PauseCircleOutlineIcon fontSize="medium" />
            : <PlayCircleOutlineIcon fontSize="medium" />}
        </IconButton>
        <IconButton
          size="small"
          sx={{ color: palette.textMuted }}
          disabled={!playable}
          onClick={() => handleSeek(-10)}
        >
          <Replay10Icon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          sx={{ color: palette.textMuted }}
          disabled={!playable}
          onClick={() => handleSeek(10)}
        >
          <Forward10Icon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          sx={{ color: palette.textMuted }}
          disabled={!playable}
          onClick={handleMute}
        >
          {muted ? <VolumeOffOutlinedIcon fontSize="small" /> : <VolumeUpOutlinedIcon fontSize="small" />}
        </IconButton>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', ml: 0.6 }}>
          {elapsedLabel} / {totalLabel}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>1x</Typography>
        <IconButton
          size="small"
          sx={{ color: palette.textMuted }}
          disabled={!playable}
          onClick={handleFullscreen}
        >
          <FullscreenOutlinedIcon fontSize="small" />
        </IconButton>
      </Stack>
      ) : null}

      {/* Action-knapper under */}
      <Stack
        direction="row"
        spacing={1.4}
        sx={{ p: 2, borderTop: `1px solid ${palette.borderSubtle}`, flexWrap: 'wrap', gap: 1 }}
      >
        <Box
          component="button"
          onClick={onRecordClick}
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
          onClick={() => fileInputRef.current?.click()}
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
          onClick={onAddExternalClick}
          title="Lim inn YouTube, Google Drive eller Vimeo-lenke"
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
          <LinkOutlinedIcon fontSize="small" />
          Lenke
        </Box>
        <Box
          component="button"
          onClick={onGuidesClick}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFilePick}
          style={{ display: 'none' }}
        />
      </Stack>
    </Box>
  );
}
