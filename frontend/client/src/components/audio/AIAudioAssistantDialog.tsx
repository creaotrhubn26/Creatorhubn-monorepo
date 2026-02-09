import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Chip,
  Alert,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  AutoFixHigh,
  GraphicEq,
  CheckCircle
} from '@mui/icons-material';
import AudioMixerPanel from './AudioMixerPanel';

interface AIAudioAssistantDialogProps {
  open: boolean;
  onClose: () => void;
  audioTracks: Array<{
    id: string;
    name: string;
    sourceFile: string;
    type?: 'dialogue' | 'music' | 'sfx';
  }>;
  onMixComplete: (mixedAudioUrl: string, metrics: Record<string, unknown>) => void;
  selectedTrackId?: string | null;
  openMixerDirectly?: boolean;
}

interface MixerTrack {
  id: string;
  name: string;
  sourceFile: string;
  type: 'dialogue' | 'music' | 'sfx';
  volume: number;
  muted: boolean;
  solo: boolean;
  targetLUFS: number;
  eq: {
    enabled: boolean;
    lowGain: number;
    midGain: number;
    highGain: number;
  };
}

interface DuckingSettings {
  enabled: boolean;
  amount: number;
  attack: number;
  release: number;
  threshold: number;
}

export default function AIAudioAssistantDialog({
  open,
  onClose,
  audioTracks,
  onMixComplete,
  selectedTrackId = null,
  openMixerDirectly = false
}: AIAudioAssistantDialogProps) {
  const [viewMode, setViewMode] = useState<'simple' | 'mixer'>(openMixerDirectly ? 'mixer' : 'simple');
  const [mixerTracks, setMixerTracks] = useState<MixerTrack[]>([]);
  const [duckingSettings, setDuckingSettings] = useState<DuckingSettings>({
    enabled: true,
    amount: -6,
    attack: 0.1,
    release: 0.5,
    threshold: -40
  });
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ mixedUrl: string; metrics: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredTracks = useMemo(() => {
    if (!selectedTrackId) return audioTracks;
    return audioTracks.filter((track) => track.id === selectedTrackId);
  }, [audioTracks, selectedTrackId]);

  useEffect(() => {
    if (!open) return;
    const initial = filteredTracks.map((track) => ({
      id: track.id,
      name: track.name,
      sourceFile: track.sourceFile,
      type: track.type || 'music',
      volume: 100,
      muted: false,
      solo: false,
      targetLUFS: track.type === 'dialogue' ? -16 : track.type === 'music' ? -20 : -18,
      eq: {
        enabled: false,
        lowGain: 0,
        midGain: 0,
        highGain: 0
      }
    }));
    setMixerTracks(initial);
    setResult(null);
    setError(null);
  }, [filteredTracks, open]);

  const handleAutoMix = async () => {
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/audio/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: mixerTracks,
          duckingSettings
        })
      });

      if (!response.ok) {
        throw new Error('Kunne ikke lage miks');
      }

      const data = await response.json();
      setResult({ mixedUrl: data.mixedUrl, metrics: data.metrics || {} });
      onMixComplete(data.mixedUrl, data.metrics || {});
    } catch (err) {
      console.error('Mix failed:', err);
      setError(err instanceof Error ? err.message : 'Miksing feilet');
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyAndClose = () => {
    if (result) {
      onMixComplete(result.mixedUrl, result.metrics);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <AutoFixHigh />
          <Typography variant="h6">AI Audio Assistant</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, value) => value && setViewMode(value)}
            size="small"
          >
            <ToggleButton value="simple">Quick Mix</ToggleButton>
            <ToggleButton value="mixer">Mixer</ToggleButton>
          </ToggleButtonGroup>

          {viewMode === 'simple' && (
            <Box>
              <Typography variant="body2" gutterBottom>
                La assistenten balansere sporene og bruke ducking automatisk.
              </Typography>
              <Button
                variant="contained"
                startIcon={<GraphicEq />}
                onClick={handleAutoMix}
                disabled={processing || mixerTracks.length === 0}
              >
                {processing ? 'Mikser...' : 'Auto Mix'}
              </Button>
            </Box>
          )}

          {viewMode === 'mixer' && (
            <AudioMixerPanel
              tracks={mixerTracks}
              onTracksChange={setMixerTracks}
              duckingSettings={duckingSettings}
              onDuckingChange={setDuckingSettings}
              onPreview={handleAutoMix}
              onMix={handleAutoMix}
              isPlaying={false}
              onPlayPause={() => {}}
              onStop={() => {}}
            />
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {result && (
            <Alert severity="success" icon={<CheckCircle />}>
              Miks klar! Du kan bruke den nye filen.
            </Alert>
          )}

          {result && (
            <Chip
              label={`Spor: ${mixerTracks.length} • Ducking: ${duckingSettings.enabled ? 'pa' : 'av'}`}
              color="primary"
              variant="outlined"
            />
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
        <Button
          onClick={handleApplyAndClose}
          variant="contained"
          disabled={!result}
        >
          Bruk miks
        </Button>
      </DialogActions>
    </Dialog>
  );
}
