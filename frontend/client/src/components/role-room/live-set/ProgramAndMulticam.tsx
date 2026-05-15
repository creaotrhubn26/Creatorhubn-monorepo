/**
 * ProgramAndMulticam.tsx
 *
 * Senter-seksjonen i LIVE-mode: stor PROGRAM-viewer + 2x2 multicam-grid
 * + roll-kontroller (ROLL/CUT/AUTO CUT/TAKE SNAPSHOT) under.
 * Speiler livesetmode.md §16.3, §16.4, §16.5.
 *
 * Reel video-feed kommer fra:
 *   - NDI-mottak (Vaxis/Hollyland trådløs)
 *   - SDI via Decklink/AJA-kort
 *   - RTMP fra OBS/vMix
 *   - WebRTC for kabel-fri klient-review
 * Inntil videre: placeholder med kamera-label + audio-meter.
 */

import React from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import VideoFeed from './VideoFeed';
import type { CameraId, CameraSlot, CameraSettings } from './types';

interface ProgramAndMulticamProps {
  cameras: CameraSlot[];
  programCameraId: CameraId;
  onSelectProgramCamera: (id: CameraId) => void;
  programSettings?: CameraSettings;
  isRecording: boolean;
  recordingTimecode: string;
  onRoll: () => void;
  onCut: () => void;
  onAutoCut: () => void;
  onSnapshot: () => void;
}

/** Mini-VU-stripe for thumbnails — kompakt og responsive */
function MiniVuStrip({ db }: { db: number }) {
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  const isClipping = db >= -1;
  return (
    <Box sx={{ height: 4, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 0.25, overflow: 'hidden' }}>
      <Box
        sx={{
          width: `${pct}%`,
          height: '100%',
          bgcolor: isClipping ? '#dc2626' : '#22c55e',
          transition: 'width 50ms linear',
        }}
      />
    </Box>
  );
}

/** Multi-cam thumbnail-card */
function CamThumbnail({
  cam,
  selected,
  onClick,
}: {
  cam: CameraSlot;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        aspectRatio: '16/9',
        bgcolor: '#000',
        cursor: 'pointer',
        border: '2px solid',
        borderColor: selected ? '#dc2626' : 'rgba(255,255,255,0.08)',
        borderRadius: 0.75,
        overflow: 'hidden',
        transition: 'border-color 120ms',
        '&:hover': { borderColor: selected ? '#dc2626' : 'rgba(255,255,255,0.25)' },
      }}
    >
      {/* VideoFeed velger transport: webrtc → hls → mjpeg → poll → mock */}
      <VideoFeed
        source={{
          ccapiCameraIp: cam.ccapi?.ipAddress,
          // hlsUrl/webrtcUrl populeres når MediaMTX-server er konfigurert
        }}
      />
      {!cam.online && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(20,20,20,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            OFFLINE
          </Typography>
        </Box>
      )}

      {/* Cam-label */}
      <Box
        sx={{
          position: 'absolute',
          top: 6,
          left: 6,
          bgcolor: 'rgba(0,0,0,0.6)',
          px: 0.75,
          py: 0.25,
          borderRadius: 0.5,
        }}
      >
        <Typography sx={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
          {cam.label}
        </Typography>
      </Box>

      {/* Audio bar */}
      <Box sx={{ position: 'absolute', bottom: 4, left: 6, right: 6 }}>
        <MiniVuStrip db={cam.audioLevelDb ?? -60} />
      </Box>

      {/* Fullscreen + sound icons */}
      <Stack
        direction="row"
        spacing={0.25}
        sx={{ position: 'absolute', bottom: 4, right: 4 }}
      >
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)', p: 0.25 }}>
          <VolumeUpIcon sx={{ fontSize: 12 }} />
        </IconButton>
        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)', p: 0.25 }}>
          <FullscreenIcon sx={{ fontSize: 12 }} />
        </IconButton>
      </Stack>
    </Box>
  );
}

export const ProgramAndMulticam: React.FC<ProgramAndMulticamProps> = ({
  cameras,
  programCameraId,
  onSelectProgramCamera,
  programSettings,
  isRecording,
  recordingTimecode,
  onRoll,
  onCut,
  onAutoCut,
  onSnapshot,
}) => {
  const programCam = cameras.find((c) => c.id === programCameraId) ?? cameras[0];

  return (
    <Box
      sx={{
        height: '100%',
        bgcolor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top section: PROGRAM + multicam side-by-side */}
      <Box sx={{ display: 'flex', gap: 1.5, p: 1.5, flexGrow: 0 }}>
        {/* PROGRAM-viewer (60% width) */}
        <Box sx={{ flex: '1 1 60%', minWidth: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>
              PROGRAM
            </Typography>
            {isRecording && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <FiberManualRecordIcon sx={{ fontSize: 10, color: '#dc2626' }} />
                <Typography sx={{ fontSize: 10, color: '#fca5a5', fontWeight: 700, letterSpacing: 0.5 }}>
                  RECORDING
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', ml: 1 }}>
                  {recordingTimecode}
                </Typography>
              </Stack>
            )}
          </Stack>
          <Box
            sx={{
              position: 'relative',
              aspectRatio: '16/9',
              bgcolor: '#000',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            {/* VideoFeed: webrtc → hls → mjpeg → poll → mock-fallback */}
            <VideoFeed
              source={{
                ccapiCameraIp: programCam?.ccapi?.ipAddress,
              }}
            />
            {/* Cam-info row */}
            <Box sx={{ position: 'absolute', bottom: 8, left: 12 }}>
              <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>
                {programCam?.label ?? '—'}
                {programSettings && (
                  <Typography component="span" sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', ml: 1 }}>
                    · {programSettings.lensFocalLength ?? '24mm'} · {programSettings.aspectRatio ?? '1.85:1'}
                  </Typography>
                )}
              </Typography>
            </Box>
            {/* Audio-strip */}
            <Box sx={{ position: 'absolute', bottom: 32, left: 12, right: 64 }}>
              <MiniVuStrip db={programCam?.audioLevelDb ?? -12} />
            </Box>
            {/* Controls */}
            <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', bottom: 8, right: 8 }}>
              <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                <VolumeUpIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
        </Box>

        {/* Multicam 2x2 grid (40% width) */}
        <Box sx={{ flex: '1 1 40%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.75, flex: 1, alignContent: 'start' }}>
            {cameras.slice(0, 4).map((cam) => (
              <CamThumbnail
                key={cam.id}
                cam={cam}
                selected={cam.id === programCameraId}
                onClick={() => onSelectProgramCamera(cam.id)}
              />
            ))}
          </Box>
        </Box>
      </Box>

      {/* Roll-kontroller */}
      <Box sx={{ display: 'flex', gap: 1, px: 1.5, pb: 1.5 }}>
        <RollButton
          label="ROLL"
          shortcut="Space"
          icon={<PlayArrowIcon />}
          active={isRecording}
          activeColor="#dc2626"
          inactiveColor="rgba(220,38,38,0.8)"
          onClick={onRoll}
        />
        <RollButton
          label="CUT"
          shortcut="T"
          icon={<StopIcon />}
          inactiveColor="rgba(255,255,255,0.15)"
          onClick={onCut}
        />
        <RollButton
          label="AUTO CUT"
          shortcut="A"
          icon={<ContentCutIcon />}
          inactiveColor="rgba(255,255,255,0.15)"
          onClick={onAutoCut}
        />
        <RollButton
          label="TAKE SNAPSHOT"
          shortcut="S"
          icon={<PhotoCameraIcon />}
          inactiveColor="rgba(255,255,255,0.15)"
          onClick={onSnapshot}
        />
      </Box>
    </Box>
  );
};

function RollButton({
  label,
  shortcut,
  icon,
  active,
  activeColor,
  inactiveColor,
  onClick,
}: {
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  active?: boolean;
  activeColor?: string;
  inactiveColor: string;
  onClick: () => void;
}) {
  return (
    <Tooltip title={`Tastatursnarvei: ${shortcut}`}>
      <Box
        component="button"
        onClick={onClick}
        sx={{
          flex: 1,
          bgcolor: active && activeColor ? activeColor : 'rgba(255,255,255,0.02)',
          color: '#fff',
          border: '1px solid',
          borderColor: active && activeColor ? activeColor : inactiveColor,
          borderRadius: 1,
          py: 1.25,
          px: 2,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.25,
          transition: 'all 120ms',
          fontFamily: 'inherit',
          '&:hover': {
            bgcolor: active && activeColor ? activeColor : 'rgba(255,255,255,0.06)',
            borderColor: active && activeColor ? activeColor : 'rgba(255,255,255,0.3)',
          },
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          {icon}
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
            {label}
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 }}>
          {shortcut}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export default ProgramAndMulticam;
