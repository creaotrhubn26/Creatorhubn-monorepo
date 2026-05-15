/**
 * MusicWaveformTrack — wavesurfer.js-basert waveform-spor for
 * FormationTimeline. Loader audio fra `musicUrl` og synkroniserer
 * playhead via `playheadSec` (kontrollert utenfra — ingen egen player).
 *
 * Wavesurfer initieres i useEffect og rives ned på unmount/URL-bytte.
 * `progressColor` følger DanceFlow-paletten (#fbbf24).
 *
 * Klikk på waveformen seeker via onSeek-callback (typisk koblet til video).
 */

import React from 'react';
import { Box } from '@mui/material';
import WaveSurfer from 'wavesurfer.js';

const WAVE_HEIGHT = 28;

export interface MusicWaveformTrackProps {
  musicUrl: string;
  durationSec?: number;
  playheadSec?: number;
  onSeek?: (sec: number) => void;
  /** Hvis true, ber wavesurfer ikke render under loading (skjuler flicker). */
  hideUntilReady?: boolean;
}

export function MusicWaveformTrack({
  musicUrl,
  durationSec,
  playheadSec,
  onSeek,
  hideUntilReady = true,
}: MusicWaveformTrackProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const wsRef = React.useRef<WaveSurfer | null>(null);
  const [ready, setReady] = React.useState(false);

  // Initialiser wavesurfer ved mount + url-bytte. Tear down på unmount.
  React.useEffect(() => {
    if (!containerRef.current) return undefined;
    setReady(false);
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(251, 191, 36, 0.55)',
      progressColor: '#fbbf24',
      cursorColor: 'rgba(255,255,255,0.7)',
      cursorWidth: 1,
      height: WAVE_HEIGHT,
      barWidth: 1.4,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      interact: !!onSeek,
      // Vi har vår egen player (video) — wavesurfer skal kun visualisere.
      backend: 'WebAudio',
    });
    wsRef.current = ws;

    ws.on('ready', () => setReady(true));
    ws.on('interaction', (newTime: number) => {
      if (onSeek) onSeek(newTime);
    });

    ws.load(musicUrl).catch(() => {
      // Stille feil — bare ikke render bar hvis URL er ugyldig.
      setReady(false);
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicUrl]);

  // Sync playhead → wavesurfer setTime når ekstern playhead endres.
  React.useEffect(() => {
    if (!ready || playheadSec == null) return;
    const ws = wsRef.current;
    if (!ws) return;
    const cur = ws.getCurrentTime();
    // Bare update hvis forskjellen er mer enn 100 ms — unngår event-loop.
    if (Math.abs(cur - playheadSec) > 0.1) {
      try { ws.setTime(playheadSec); } catch { /* under destroy */ }
    }
  }, [ready, playheadSec]);

  // Hvis durationSec er passert inn og wavesurfer-duration ikke matcher,
  // viser vi det ytre wrapperen i samme bredde for visuell konsistens.
  // (Wavesurfer-bredde justeres automatisk til container.)

  return (
    <Box
      data-testid="formation-timeline-music-waveform"
      sx={{
        position: 'relative',
        height: WAVE_HEIGHT,
        overflow: 'hidden',
        borderRadius: 0.5,
        bgcolor: 'rgba(255,255,255,0.02)',
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          visibility: ready || !hideUntilReady ? 'visible' : 'hidden',
        }}
      />
      {!ready && hideUntilReady ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            letterSpacing: 1.5,
            color: 'rgba(251,191,36,0.45)',
            fontWeight: 700,
          }}
        >
          LOADING WAVEFORM…
        </Box>
      ) : null}
      {/* Note: durationSec er kun brukt til forhåndsvurdering — wavesurfer
          bruker faktisk audio-buffer-duration. */}
      {process.env.NODE_ENV === 'development' && durationSec != null && ready ? (
        <Box sx={{ position: 'absolute', right: 4, top: 0, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
          {durationSec.toFixed(1)}s
        </Box>
      ) : null}
    </Box>
  );
}

export default MusicWaveformTrack;
