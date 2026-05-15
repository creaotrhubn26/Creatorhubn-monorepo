/**
 * AudioColumn.tsx
 *
 * Ytterste høyre-kolonne med master + per-cam audio levels og mixer-knapp.
 * Speiler livesetmode.md §16.10.
 *
 * Audio-levels kommer fra useLiveSetHardware-mocken. Real implementation
 * vil koble mot Sound Devices network protocol (MixPre/Scorpio Dante/AES67)
 * eller NDI-mottak fra trådløse Vaxis/Hollyland-sendere.
 */

import React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import type { CameraSlot } from './types';

interface AudioColumnProps {
  masterDb: number;
  cameras: CameraSlot[];
  onOpenMixer?: () => void;
}

/**
 * VU-meter med fargegradient. dBFS-skala: -60 til 0.
 * Grønn → Gul → Rød ved -6 dBFS (peak warning).
 */
function VuBar({ db, height = 12 }: { db: number; height?: number }) {
  // Map -60..0 dB til 0..100%
  const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  const isClipping = db >= -1;
  const isPeak = db >= -6;

  return (
    <Box
      sx={{
        height,
        bgcolor: 'rgba(255,255,255,0.05)',
        borderRadius: 0.5,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          width: `${pct}%`,
          height: '100%',
          background: isClipping
            ? '#dc2626'
            : isPeak
              ? 'linear-gradient(90deg, #22c55e 0%, #22c55e 70%, #fbbf24 85%, #f97316 100%)'
              : 'linear-gradient(90deg, #22c55e 0%, #22c55e 70%, #fbbf24 100%)',
          transition: 'width 50ms linear',
        }}
      />
      {/* Peak-marker ved -6 dBFS */}
      <Box
        sx={{
          position: 'absolute',
          left: '90%',
          top: 0,
          bottom: 0,
          width: 1,
          bgcolor: 'rgba(255,255,255,0.2)',
        }}
      />
    </Box>
  );
}

export const AudioColumn: React.FC<AudioColumnProps> = ({ masterDb, cameras, onOpenMixer }) => {
  return (
    <Box
      sx={{
        height: '100%',
        bgcolor: '#0a0a0a',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        p: 1.5,
      }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, mb: 1 }}>
        LYD
      </Typography>

      {/* Master */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.25 }}>
          <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            MASTER
          </Typography>
          <Typography sx={{ fontSize: 10, color: '#fff', fontFamily: 'monospace' }}>
            {masterDb.toFixed(1)} dB
          </Typography>
        </Stack>
        <VuBar db={masterDb} height={20} />
      </Box>

      {/* Per-cam audio */}
      <Stack spacing={0.75} sx={{ flexGrow: 1 }}>
        {cameras.map((cam) => (
          <Box key={cam.id}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.25 }}>
              <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                {cam.label.toUpperCase()}
              </Typography>
              <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                {cam.audioLevelDb !== undefined ? cam.audioLevelDb.toFixed(1) : '—'}
              </Typography>
            </Stack>
            <VuBar db={cam.audioLevelDb ?? -60} />
          </Box>
        ))}
      </Stack>

      {/* Mixer button */}
      <Button
        fullWidth
        variant="outlined"
        size="small"
        startIcon={<GraphicEqIcon fontSize="small" />}
        onClick={onOpenMixer}
        sx={{
          mt: 1.5,
          color: 'rgba(255,255,255,0.8)',
          borderColor: 'rgba(255,255,255,0.15)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.04)' },
        }}
      >
        LYD MIXER
      </Button>
    </Box>
  );
};

export default AudioColumn;
