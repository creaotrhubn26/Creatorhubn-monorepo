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
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  type SelectChangeEvent,
} from '@mui/material';
import { AutoFixHigh, GraphicEq, CheckCircle } from '@mui/icons-material';
import AudioMixerPanel from './AudioMixerPanel';

interface AIAudioAssistantDialogProps {
  open: boolean;
  onClose: () => void;
  audioTracks: Array<{
    id: string;
    name: string;
    sourceFile: string;
    type?: 'dialogue' | 'music' | 'sfx';
    timeline?: {
      start: number;
      duration: number;
      inPoint: number;
      outPoint: number;
      linkedVideoClipId?: string;
      autoEditDucking?: Record<string, unknown>;
      autoEditJCut?: Record<string, unknown>;
      autoEditLCut?: Record<string, unknown>;
      audioFadeIn?: { duration: number; edge: 'in'; layer: 'audio' };
      audioFadeOut?: { duration: number; edge: 'out'; layer: 'audio' };
    };
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
  timeline?: {
    start: number;
    duration: number;
    inPoint: number;
    outPoint: number;
    linkedVideoClipId?: string;
    autoEditDucking?: Record<string, unknown>;
    autoEditJCut?: Record<string, unknown>;
    autoEditLCut?: Record<string, unknown>;
    audioFadeIn?: { duration: number; edge: 'in'; layer: 'audio' };
    audioFadeOut?: { duration: number; edge: 'out'; layer: 'audio' };
  };
}

interface DuckingSettings {
  enabled: boolean;
  amount: number;
  attack: number;
  release: number;
  threshold: number;
}

type DeliveryProfileValue =
  | 'adaptive'
  | 'netflix'
  | 'ebu_r128'
  | 'atsc_a85'
  | 'streaming_spotify'
  | 'streaming_youtube'
  | 'streaming_prime_video'
  | 'streaming_apple_music'
  | 'streaming_tidal'
  | 'podcast';

type NoiseReductionProfileValue = 'off' | 'light' | 'standard' | 'aggressive';

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
  const [deliveryProfile, setDeliveryProfile] = useState<DeliveryProfileValue>('adaptive');
  const [noiseReductionProfile, setNoiseReductionProfile] =
    useState<NoiseReductionProfileValue>('standard');

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
      },
      timeline: track.timeline,
    }));
    setMixerTracks(initial);
    setResult(null);
    setError(null);
    setDeliveryProfile('adaptive');
    setNoiseReductionProfile('standard');
  }, [filteredTracks, open]);

  const handleDeliveryProfileChange = (event: SelectChangeEvent<DeliveryProfileValue>) => {
    setDeliveryProfile(event.target.value as DeliveryProfileValue);
  };

  const handleNoiseReductionProfileChange = (
    event: SelectChangeEvent<NoiseReductionProfileValue>
  ) => {
    setNoiseReductionProfile(event.target.value as NoiseReductionProfileValue);
  };

  const handleAutoMix = async () => {
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/audio/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks: mixerTracks,
          duckingSettings,
          mixContext: {
            source: 'story-arc-studio',
            includeAutoEditMetadata: true,
            deliveryProfile,
            noiseReductionProfile,
            noiseReductionApplyTo: 'dialogue',
          },
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

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="mix-delivery-profile-label">Delivery</InputLabel>
            <Select
              labelId="mix-delivery-profile-label"
              label="Delivery"
              value={deliveryProfile}
              onChange={handleDeliveryProfileChange}
            >
              <MenuItem value="adaptive">Adaptive</MenuItem>
              <MenuItem value="netflix">Netflix</MenuItem>
              <MenuItem value="ebu_r128">Broadcast (EBU R128)</MenuItem>
              <MenuItem value="atsc_a85">Broadcast (ATSC A/85)</MenuItem>
              <MenuItem value="streaming_spotify">Spotify</MenuItem>
              <MenuItem value="streaming_youtube">YouTube</MenuItem>
              <MenuItem value="streaming_prime_video">Prime Video</MenuItem>
              <MenuItem value="streaming_apple_music">Apple Music</MenuItem>
              <MenuItem value="streaming_tidal">TIDAL</MenuItem>
              <MenuItem value="podcast">Podcast / Speech</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="mix-noise-profile-label">Noise Reduction</InputLabel>
            <Select
              labelId="mix-noise-profile-label"
              label="Noise Reduction"
              value={noiseReductionProfile}
              onChange={handleNoiseReductionProfileChange}
            >
              <MenuItem value="off">Off</MenuItem>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="standard">Standard</MenuItem>
              <MenuItem value="aggressive">Aggressive</MenuItem>
            </Select>
          </FormControl>

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
              label={`Spor: ${mixerTracks.length} • Ducking: ${duckingSettings.enabled ? 'pa' : 'av'} • NR: ${noiseReductionProfile} • Delivery: ${deliveryProfile}`}
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
