/**
 * SceneInfoColumn.tsx
 *
 * Høyre-kolonne i LIVE-mode med scene info / script & notes / shot list.
 * Speiler livesetmode.md §16.9 + 16.11 (quick actions) + §16.12 (camera metadata).
 *
 * Data:
 *   - Scene-info kommer fra SceneBreakdown-objektet (passed in via props)
 *   - Quick actions er handler-callbacks som triggerer take-state-endringer
 *   - Camera metadata leses fra cameras-prop (CCAPI eller mock)
 */

import React from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import VideocamIcon from '@mui/icons-material/Videocam';
import GppGoodIcon from '@mui/icons-material/GppGood';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import ArticleIcon from '@mui/icons-material/Article';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import EditIcon from '@mui/icons-material/Edit';
import type { CameraId, CameraSlot, CameraSettings } from './types';
import type { SceneBreakdown } from '../models/casting';

interface SceneInfoColumnProps {
  scene: SceneBreakdown | null;
  cameras: CameraSlot[];
  activeCameraId: CameraId;
  activeCameraSettings?: CameraSettings;
  /** Værrapp (fra yr.no-integrasjon — placeholder for nå) */
  weatherCelsius?: number;
  onQuickAction?: (action: 'good-take' | 'pickup-shot' | 'action-safe' | 'check-focus' | 'setup-complete' | 'add-note') => void;
}

// Konsistent quick-action knapp-stil
function QuickActionButton({
  label,
  icon,
  color = 'rgba(34, 197, 94, 0.7)',
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <Button
      fullWidth
      onClick={onClick}
      startIcon={icon}
      sx={{
        justifyContent: 'flex-start',
        textTransform: 'none',
        bgcolor: 'rgba(255,255,255,0.03)',
        color: 'rgba(255,255,255,0.9)',
        borderLeft: '3px solid',
        borderLeftColor: color,
        borderRadius: 1,
        py: 0.75,
        px: 1.5,
        fontSize: 11,
        fontWeight: 600,
        '&:hover': {
          bgcolor: 'rgba(255,255,255,0.08)',
        },
      }}
    >
      {label}
    </Button>
  );
}

export const SceneInfoColumn: React.FC<SceneInfoColumnProps> = ({
  scene,
  cameras,
  activeCameraId,
  activeCameraSettings,
  weatherCelsius = 12,
  onQuickAction,
}) => {
  const [tab, setTab] = React.useState<'info' | 'script' | 'shotlist'>('info');
  const activeCamera = cameras.find((c) => c.id === activeCameraId);

  return (
    <Box
      sx={{
        height: '100%',
        bgcolor: '#0a0a0a',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          minHeight: 36,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          '& .MuiTab-root': {
            color: 'rgba(255,255,255,0.5)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            minHeight: 36,
            py: 0.5,
            minWidth: 0,
            px: 1.5,
          },
          '& .Mui-selected': { color: '#fff !important' },
          '& .MuiTabs-indicator': { backgroundColor: '#8b5cf6' },
        }}
      >
        <Tab value="info" label="SCENE INFO" />
        <Tab value="script" label="SCRIPT & NOTES" />
        <Tab value="shotlist" label="SHOT LIST" />
      </Tabs>

      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1.5, py: 1 }}>
        {tab === 'info' && scene && (
          <Stack spacing={1.5}>
            {/* Scene-header */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  Scene {scene.sceneNumber}
                </Typography>
                <Chip
                  label="● AKTIV SCENE"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(34,197,94,0.2)',
                    color: '#86efac',
                    fontSize: 9,
                    fontWeight: 700,
                    height: 18,
                  }}
                />
              </Stack>
              <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                {scene.intExt} · {scene.locationName} · {scene.timeOfDay}
              </Typography>
            </Box>

            {/* Metadata-row */}
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: '1 1 80px' }}>
                <ArticleIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
                <Box>
                  <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                    Manus side
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#fff' }}>
                    18/22
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: '1 1 80px' }}>
                <LightbulbIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
                <Box>
                  <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                    Lys
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#fff' }}>
                    Naturlig dag
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flex: '1 1 80px' }}>
                <WbSunnyIcon sx={{ fontSize: 14, color: '#fbbf24' }} />
                <Box>
                  <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                    Værrapp
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#fff' }}>
                    {weatherCelsius}°C
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            {/* Scene notes */}
            <Box>
              <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', mb: 0.5 }}>
                Scene notes
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                {scene.description || 'Ingen notater for denne scenen ennå.'}
              </Typography>
            </Box>

            {/* Tags */}
            {scene.characters && scene.characters.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', mb: 0.5 }}>
                  Tags
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  <Chip label="Dialog" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: '#a78bfa', fontSize: 10, height: 18 }} />
                  <Chip label="Reaksjon" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: '#a78bfa', fontSize: 10, height: 18 }} />
                  {scene.characters.length === 2 && (
                    <Chip label="To personer" size="small" sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: '#a78bfa', fontSize: 10, height: 18 }} />
                  )}
                  <Chip label="Viktig" size="small" sx={{ bgcolor: 'rgba(220,38,38,0.18)', color: '#fca5a5', fontSize: 10, height: 18 }} />
                </Stack>
              </Box>
            )}
          </Stack>
        )}

        {tab === 'script' && (
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', py: 3 }}>
            Script & notes-tab kommer
          </Typography>
        )}

        {tab === 'shotlist' && (
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', py: 3 }}>
            Shot list-tab kommer
          </Typography>
        )}
      </Box>

      {/* Quick actions */}
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', mb: 0.75 }}>
          Quick actions
        </Typography>
        <Stack spacing={0.5}>
          <QuickActionButton
            label="GOOD TAKE"
            icon={<DoneAllIcon sx={{ fontSize: 14 }} />}
            color="#22c55e"
            onClick={() => onQuickAction?.('good-take')}
          />
          <QuickActionButton
            label="PICKUP SHOT"
            icon={<StarIcon sx={{ fontSize: 14 }} />}
            color="#3b82f6"
            onClick={() => onQuickAction?.('pickup-shot')}
          />
          <QuickActionButton
            label="ACTION SAFE"
            icon={<GppGoodIcon sx={{ fontSize: 14 }} />}
            color="#fbbf24"
            onClick={() => onQuickAction?.('action-safe')}
          />
          <QuickActionButton
            label="CHECK FOCUS"
            icon={<CenterFocusStrongIcon sx={{ fontSize: 14 }} />}
            color="#a78bfa"
            onClick={() => onQuickAction?.('check-focus')}
          />
          <QuickActionButton
            label="SETUP COMPLETE"
            icon={<VideocamIcon sx={{ fontSize: 14 }} />}
            color="#86efac"
            onClick={() => onQuickAction?.('setup-complete')}
          />
          <Button
            fullWidth
            startIcon={<NoteAddIcon sx={{ fontSize: 14 }} />}
            onClick={() => onQuickAction?.('add-note')}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              bgcolor: 'transparent',
              border: '1px dashed rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.6)',
              borderRadius: 1,
              mt: 0.5,
              py: 0.75,
              px: 1.5,
              fontSize: 11,
              fontWeight: 500,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
            }}
          >
            LEGG TIL NOTAT (N)
          </Button>
        </Stack>
      </Box>

      {/* Camera metadata block */}
      {activeCamera && (
        <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
              Camera metadata
            </Typography>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.4)', p: 0.25 }}>
              <EditIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Stack>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff', mb: 0.5 }}>
            {activeCamera.label}
            {activeCamera.ccapi?.model && (
              <Typography component="span" sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', ml: 1 }}>
                {activeCamera.ccapi.model}
              </Typography>
            )}
          </Typography>
          {activeCameraSettings && (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <MetadataChip label="FPS" value={String(activeCameraSettings.fps)} />
              <MetadataChip label="RES" value={activeCameraSettings.resolution ?? '16:9'} />
              <MetadataChip label="CODEC" value={activeCameraSettings.codec ?? 'ProRes'} />
              <MetadataChip label="WB" value={`${activeCameraSettings.whiteBalanceK}K`} />
              <MetadataChip
                label="SHUTTER"
                value={activeCameraSettings.shutterAngle ? `${activeCameraSettings.shutterAngle}°` : activeCameraSettings.shutterSpeed ?? '180°'}
              />
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
};

function MetadataChip({ label, value }: { label: string; value: string }) {
  return (
    <Tooltip title={label}>
      <Box
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 0.5,
          px: 0.75,
          py: 0.25,
          minWidth: 40,
        }}
      >
        <Typography sx={{ fontSize: 7, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', lineHeight: 1 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 10, color: '#fff', fontFamily: 'monospace', lineHeight: 1.2 }}>
          {value}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default SceneInfoColumn;
