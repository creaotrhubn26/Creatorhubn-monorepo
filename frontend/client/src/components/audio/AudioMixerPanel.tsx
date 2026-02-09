import React, { useMemo, useState } from 'react';
import { useDuckingPresets, useEQPresets, useMixerSettings } from '@/hooks/useAudioSettings';
import {
  Box,
  Typography,
  Slider,
  Stack,
  IconButton,
  Button,
  Chip,
  Divider,
  Switch,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip
} from '@mui/material';
import {
  VolumeUp,
  VolumeOff,
  GraphicEq,
  PlayArrow,
  Pause,
  Stop,
  RecordVoiceOver,
  MusicNote,
  Hearing
} from '@mui/icons-material';

interface EQSettings {
  enabled: boolean;
  lowGain: number;
  midGain: number;
  highGain: number;
}

interface AudioTrack {
  id: string;
  name: string;
  type: 'dialogue' | 'music' | 'sfx';
  sourceFile: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  targetLUFS: number;
  eq: EQSettings;
}

interface DuckingSettings {
  enabled: boolean;
  amount: number;
  attack: number;
  release: number;
  threshold: number;
}

interface AudioMixerPanelProps {
  tracks: AudioTrack[];
  onTracksChange: (tracks: AudioTrack[]) => void;
  duckingSettings: DuckingSettings;
  onDuckingChange: (settings: DuckingSettings) => void;
  onPreview: () => void;
  onMix: () => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  onStop: () => void;
}

const BRAND_COLORS = {
  orange: '#ff8c00',
  purple: '#9333ea',
  green: '#16a34a',
  blue: '#3b82f6'
};

export default function AudioMixerPanel({
  tracks,
  onTracksChange,
  duckingSettings,
  onDuckingChange,
  onPreview,
  onMix,
  isPlaying,
  onPlayPause,
  onStop
}: AudioMixerPanelProps) {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const { presets: userDuckingPresets } = useDuckingPresets();
  const { presets: userEQPresets } = useEQPresets();
  const { saveSettings } = useMixerSettings();

  const combinedDuckingPresets = useMemo(() => {
    const systemPresets = [
      { name: 'Podcast', description: 'Standard ducking', amount: -6, attack: 0.1, release: 0.5, threshold: -40 },
      { name: 'Radio', description: 'Aggressive', amount: -9, attack: 0.05, release: 0.3, threshold: -35 },
      { name: 'Film/TV', description: 'Cinematic', amount: -4, attack: 0.2, release: 1.0, threshold: -40 }
    ];
    return [...systemPresets, ...userDuckingPresets];
  }, [userDuckingPresets]);

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) || tracks[0];

  const updateTrack = (trackId: string, updates: Partial<AudioTrack>) => {
    onTracksChange(tracks.map((track) => (track.id === trackId ? { ...track, ...updates } : track)));
  };

  const handlePresetChange = (presetName: string) => {
    const preset = combinedDuckingPresets.find((item: any) => item.name === presetName);
    if (!preset) return;
    setSelectedPreset(presetName);
    onDuckingChange({
      enabled: true,
      amount: Number(preset.amount),
      attack: Number(preset.attack),
      release: Number(preset.release),
      threshold: Number(preset.threshold)
    });
  };

  const handleSaveMixerSettings = () => {
    if (!selectedTrack) return;
    saveSettings({
      name: `Mixer ${selectedTrack.name}`,
      projectId: Number(selectedTrack.id) || undefined,
      trackId: selectedTrack.id,
      settings: {
        track: selectedTrack,
        duckingSettings
      }
    });
  };

  const getTrackIcon = (type: string) => {
    if (type === 'dialogue') return <RecordVoiceOver fontSize="small" />;
    if (type === 'music') return <MusicNote fontSize="small" />;
    return <Hearing fontSize="small" />;
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={onPlayPause} color="primary">
          {isPlaying ? <Pause /> : <PlayArrow />}
        </IconButton>
        <IconButton onClick={onStop} color="primary">
          <Stop />
        </IconButton>
        <Button variant="outlined" onClick={onPreview}>
          Preview
        </Button>
        <Button variant="contained" onClick={onMix}>
          Mix
        </Button>
        <Chip
          label={`Tracks: ${tracks.length}`}
          size="small"
          color={tracks.length > 0 ? 'primary' : 'default'}
        />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          {tracks.map((track) => (
            <Card
              key={track.id}
              variant={selectedTrackId === track.id ? 'elevation' : 'outlined'}
              sx={{ mb: 2, cursor: 'pointer' }}
              onClick={() => setSelectedTrackId(track.id)}
            >
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  {getTrackIcon(track.type)}
                  <Typography variant="subtitle2">{track.name}</Typography>
                  {track.muted && <Chip label="Muted" size="small" />}
                  {track.solo && <Chip label="Solo" size="small" color="info" />}
                </Stack>

                <Typography variant="caption" color="text.secondary">
                  Volume: {track.volume}%
                </Typography>
                <Slider
                  value={track.volume}
                  onChange={(_, value) => updateTrack(track.id, { volume: value as number })}
                  min={0}
                  max={150}
                />

                <Stack direction="row" spacing={1} alignItems="center">
                  <Tooltip title="Mute">
                    <IconButton onClick={() => updateTrack(track.id, { muted: !track.muted })}>
                      {track.muted ? <VolumeOff /> : <VolumeUp />}
                    </IconButton>
                  </Tooltip>
                  <Button
                    size="small"
                    variant={track.solo ? 'contained' : 'outlined'}
                    onClick={() => updateTrack(track.id, { solo: !track.solo })}
                  >
                    Solo
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Box sx={{ flex: 1 }}>
          {selectedTrack && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Track Details
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  Target LUFS
                </Typography>
                <Slider
                  value={selectedTrack.targetLUFS}
                  onChange={(_, value) => updateTrack(selectedTrack.id, { targetLUFS: value as number })}
                  min={-30}
                  max={-10}
                  step={1}
                />

                <Divider sx={{ my: 2 }} />

                <Stack direction="row" spacing={1} alignItems="center">
                  <GraphicEq fontSize="small" />
                  <Typography variant="subtitle2">EQ</Typography>
                  <Switch
                    checked={selectedTrack.eq.enabled}
                    onChange={() => updateTrack(selectedTrack.id, { eq: { ...selectedTrack.eq, enabled: !selectedTrack.eq.enabled } })}
                  />
                </Stack>

                <Stack spacing={1} sx={{ mt: 1 }}>
                  {(['lowGain', 'midGain', 'highGain'] as const).map((band) => (
                    <Box key={band}>
                      <Typography variant="caption" color="text.secondary">
                        {band.replace('Gain', '')}
                      </Typography>
                      <Slider
                        value={selectedTrack.eq[band]}
                        onChange={(_, value) =>
                          updateTrack(selectedTrack.id, {
                            eq: { ...selectedTrack.eq, [band]: value as number }
                          })
                        }
                        min={-12}
                        max={12}
                        step={1}
                        disabled={!selectedTrack.eq.enabled}
                      />
                    </Box>
                  ))}
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2">Ducking</Typography>
                <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                  <InputLabel>Preset</InputLabel>
                  <Select
                    value={selectedPreset}
                    label="Preset"
                    onChange={(event) => handlePresetChange(event.target.value)}
                  >
                    {combinedDuckingPresets.map((preset: any) => (
                      <MenuItem key={preset.name} value={preset.name}>
                        {preset.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Stack spacing={1} sx={{ mt: 2 }}>
                  <Typography variant="caption">Amount: {duckingSettings.amount} dB</Typography>
                  <Slider
                    value={duckingSettings.amount}
                    onChange={(_, value) => onDuckingChange({ ...duckingSettings, amount: value as number })}
                    min={-12}
                    max={0}
                    step={1}
                  />
                  <Typography variant="caption">Threshold: {duckingSettings.threshold} dB</Typography>
                  <Slider
                    value={duckingSettings.threshold}
                    onChange={(_, value) => onDuckingChange({ ...duckingSettings, threshold: value as number })}
                    min={-60}
                    max={0}
                    step={1}
                  />
                </Stack>

                <Button variant="outlined" sx={{ mt: 2 }} onClick={handleSaveMixerSettings}>
                  Save Settings
                </Button>

                {userEQPresets.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    EQ presets available: {userEQPresets.length}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          {!selectedTrack && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Velg et spor for detaljer.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
        <Chip label="Mixer" size="small" sx={{ bgcolor: BRAND_COLORS.purple, color: '#fff' }} />
        <Chip
          label={duckingSettings.enabled ? 'Ducking pa' : 'Ducking av'}
          size="small"
          color={duckingSettings.enabled ? 'success' : 'default'}
        />
      </Stack>
    </Box>
  );
}
