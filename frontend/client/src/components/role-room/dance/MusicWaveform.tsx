/**
 * MusicWaveform — renders the choreography's audio as a waveform via
 * wavesurfer.js, syncing with the existing HTMLAudioElement for playback
 * (so play/pause/seek elsewhere keeps working unchanged).
 *
 * Click on the waveform → seeks the underlying audio + reports the new
 * second back via onSeek.
 *
 * Segments overlay as colored ticks on top of the waveform so the
 * choreographer can see where each segment sits in the music.
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import type { Segment } from './choreographyTypes';

const PURPLE = danceFlowColors.lavenderDark;
const PURPLE_LIGHT = danceFlowColors.lavender;

export interface MusicWaveformProps {
  audioUrl: string | null;
  mediaElement: HTMLAudioElement | null;
  totalDurationSec: number;
  segments: Segment[];
  onSeek?: (sec: number) => void;
  height?: number;
}

export const MusicWaveform: React.FC<MusicWaveformProps> = ({
  audioUrl,
  mediaElement,
  totalDurationSec,
  segments,
  onSeek,
  height = 60,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const wsRef = React.useRef<WaveSurfer | null>(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!containerRef.current || !audioUrl || !mediaElement) {
      return undefined;
    }

    setReady(false);
    setError(null);

    let cancelled = false;
    let ws: WaveSurfer | null = null;
    try {
      ws = WaveSurfer.create({
        container: containerRef.current,
        media: mediaElement,
        waveColor: 'rgba(167,139,250,0.55)',
        progressColor: PURPLE,
        cursorColor: danceFlowColors.successPrimary,
        cursorWidth: 2,
        height,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
      });
      wsRef.current = ws;

      ws.on('ready', () => {
        if (!cancelled) setReady(true);
      });
      ws.on('error', (err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        // Suppress benign errors about media being replaced mid-load.
        if (msg.toLowerCase().includes('aborted')) return;
        setError(msg);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke initialisere waveform');
    }

    return () => {
      cancelled = true;
      try {
        ws?.destroy();
      } catch {
        /* ignore */
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [audioUrl, mediaElement, height]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!onSeek || totalDurationSec <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct * totalDurationSec);
  };

  if (!audioUrl) {
    return (
      <Box
        sx={{
          height,
          borderRadius: 1,
          bgcolor: danceFlowColors.bgInset,
          border: '1px dashed rgba(139,92,246,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ color: danceFlowColors.textDisabled, fontSize: 11 }}>
          Last opp en musikkfil for å se waveform
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: danceFlowColors.bgInset,
        borderRadius: 1,
        border: '1px solid rgba(139,92,246,0.25)',
        overflow: 'hidden',
      }}
    >
      <Box
        ref={containerRef}
        onClick={handleClick}
        data-testid="music-waveform"
        sx={{
          width: '100%',
          height,
          cursor: 'pointer',
          '& > *': { width: '100%', height: '100%' },
        }}
      />
      {!ready && !error ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            position: 'absolute',
            inset: 0,
            justifyContent: 'center',
            color: PURPLE_LIGHT,
            pointerEvents: 'none',
            bgcolor: 'rgba(13,18,24,0.65)',
          }}
        >
          <CircularProgress size={14} sx={{ color: PURPLE_LIGHT }} />
          <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
            Tegner waveform…
          </Typography>
        </Stack>
      ) : null}
      {error ? (
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            position: 'absolute',
            inset: 0,
            color: danceFlowColors.errorSoft,
            bgcolor: 'rgba(13,18,24,0.85)',
            pointerEvents: 'none',
          }}
        >
          <Typography sx={{ fontSize: 11 }}>Waveform-feil: {error}</Typography>
        </Stack>
      ) : null}
      {/* Segment ticks overlay */}
      {ready && totalDurationSec > 0 ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          {segments.map((s) => {
            const pct = (s.startSec / totalDurationSec) * 100;
            return (
              <Box
                key={s.id}
                sx={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  bgcolor: 'rgba(255,255,255,0.35)',
                }}
              />
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
};

export default MusicWaveform;
