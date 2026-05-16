/**
 * LiveSetTopBar.tsx
 *
 * Top-chrome med breadcrumb, mode-toggle (LIVE/EDIT/REVIEW), sync-status,
 * crew-count, og settings/user-menu. Speiler livesetmode.md §16.1.
 */

import React from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VideocamIcon from '@mui/icons-material/Videocam';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import RateReviewIcon from '@mui/icons-material/RateReview';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SyncIcon from '@mui/icons-material/Sync';
import GroupIcon from '@mui/icons-material/Group';
import type { LiveSetMode, SyncStatus } from './types';

interface LiveSetTopBarProps {
  projectName: string;
  episodeLabel?: string;
  sceneLabel: string;
  mode: LiveSetMode;
  onModeChange: (mode: LiveSetMode) => void;
  isRecording: boolean;
  syncStatus: SyncStatus;
  crewCount: number;
  /** Antall paired kameraer (vises i camera-button-badge) */
  cameraCount?: number;
  lastSavedAt?: string;
  onClose?: () => void;
  onChatOpen?: () => void;
  onSettingsOpen?: () => void;
  /** Åpner CameraDetailDrawer */
  onCamerasOpen?: () => void;
}

const SYNC_META: Record<SyncStatus, { label: string; color: 'success' | 'warning' | 'error' }> = {
  'fully-synced': { label: 'FULLT SYNK', color: 'success' },
  'partial-sync': { label: 'DELVIS SYNK', color: 'warning' },
  offline: { label: 'OFFLINE', color: 'error' },
};

export const LiveSetTopBar: React.FC<LiveSetTopBarProps> = ({
  projectName,
  episodeLabel,
  sceneLabel,
  mode,
  onModeChange,
  isRecording,
  syncStatus,
  crewCount,
  cameraCount = 0,
  onClose,
  onChatOpen,
  onSettingsOpen,
  onCamerasOpen,
}) => {
  const sync = SYNC_META[syncStatus];

  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{
        bgcolor: '#0a0a0a',
        color: '#fff',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 56, gap: 2 }}>
        {/* Branding + breadcrumb */}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <Box
            sx={{
              bgcolor: '#dc2626',
              color: '#fff',
              px: 1,
              py: 0.25,
              borderRadius: 0.5,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <FiberManualRecordIcon sx={{ fontSize: 10 }} />
            LIVE SET
          </Box>
          <Box
            sx={{
              bgcolor: 'rgba(220,38,38,0.18)',
              color: '#dc2626',
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            PRO
          </Box>
        </Stack>

        <Typography
          variant="caption"
          color="rgba(255,255,255,0.7)"
          sx={{ flexShrink: 0, fontSize: 13 }}
        >
          {projectName}
          {episodeLabel ? ` / ${episodeLabel}` : ''} / {sceneLabel}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {/* Mode-toggle */}
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, next) => {
            if (next) onModeChange(next);
          }}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.1)',
              px: 1.5,
              py: 0.5,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.5,
            },
            '& .Mui-selected': {
              bgcolor: 'rgba(139,92,246,0.2) !important',
              color: '#a78bfa !important',
              borderColor: '#8b5cf6 !important',
            },
          }}
        >
          <ToggleButton value="live">
            <FiberManualRecordIcon sx={{ fontSize: 8, mr: 0.5, color: isRecording ? '#dc2626' : 'inherit' }} />
            LIVE
          </ToggleButton>
          <ToggleButton value="edit">
            <ContentCutIcon sx={{ fontSize: 12, mr: 0.5 }} />
            EDIT
          </ToggleButton>
          <ToggleButton value="review">
            <RateReviewIcon sx={{ fontSize: 12, mr: 0.5 }} />
            REVIEW
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flexGrow: 1 }} />

        {/* Status-pills */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <Chip
            icon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
            label="LAGRET"
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: 10, fontWeight: 700, height: 22 }}
          />
          <Chip
            icon={<SyncIcon sx={{ fontSize: 14 }} />}
            label={sync.label}
            size="small"
            color={sync.color}
            variant="outlined"
            sx={{ fontSize: 10, fontWeight: 700, height: 22 }}
          />
          <Chip
            icon={<GroupIcon sx={{ fontSize: 14 }} />}
            label={`CREW (${crewCount})`}
            size="small"
            variant="outlined"
            sx={{
              fontSize: 10,
              fontWeight: 700,
              height: 22,
              color: 'rgba(255,255,255,0.8)',
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          />
        </Stack>

        {/* Trailing actions */}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0, ml: 1 }}>
          {onCamerasOpen && (
            <Tooltip title={`Tilkoblede kameraer (${cameraCount})`}>
              <IconButton size="small" onClick={onCamerasOpen} sx={{ color: 'rgba(255,255,255,0.7)', position: 'relative' }}>
                <VideocamIcon fontSize="small" />
                {cameraCount > 0 && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      bgcolor: '#dc2626',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      minWidth: 14,
                      height: 14,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      px: 0.5,
                    }}
                  >
                    {cameraCount}
                  </Box>
                )}
              </IconButton>
            </Tooltip>
          )}
          {onChatOpen && (
            <Tooltip title="Crew chat">
              <IconButton size="small" onClick={onChatOpen} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                <ChatBubbleOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onSettingsOpen && (
            <Tooltip title="Koble til kamera">
              <IconButton size="small" onClick={onSettingsOpen} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Avatar sx={{ width: 28, height: 28, bgcolor: '#8b5cf6', fontSize: 12 }}>D</Avatar>
          {onClose && (
            <Tooltip title="Lukk LIVE SET">
              <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', ml: 0.5 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default LiveSetTopBar;
