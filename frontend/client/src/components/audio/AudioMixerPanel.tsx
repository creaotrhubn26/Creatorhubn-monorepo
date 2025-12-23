/**
 * AUDIO MIXER PANEL
 * Professional audio mixing interface with faders, ducking controls, and real-time preview
 * Inspired by DaVinci Resolve's Fairlight page
 * Enhanced with database persistence for user presets
 */

import React, { useState, useEffect } from 'react';
import { useDuckingPresets, useEQPresets, useMixerSettings } from '@/hooks/useAudioSettings';
import {
  Box,
  Paper,
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
  Hearing,
  Equalizer,
  ShowChart
} from '@mui/icons-material';

interface EQSettings {
  enabled: boolean;
  lowGain: number;    // -12 to +12 dB
  midGain: number;    // -12 to +12 dB
  highGain: number;   // -12 to +12 dB
}

interface AudioTrack {
  id: string;
  name: string;
  type: 'dialogue' | 'music' | 'sfx';
  sourceFile: string;
  volume: number;  // 0-100
  muted: boolean;
  solo: boolean;
  targetLUFS: number;
  eq: EQSettings;
  waveformData?: number[];  // For visual waveform display
  peakLevel?: number;  // Current peak level (0-1)
  isPeaking?: boolean;  // Is currently peaking (> 0.95)
}

interface DuckingSettings {
  enabled: boolean;
  amount: number;  // dB reduction (-12 to 0)
  attack: number;  // seconds (0.01 to 1.0)
  release: number; // seconds (0.1 to 2.0)
  threshold: number; // dB (-60 to 0)
}

interface DuckingPreset {
  name: string;
  description: string;
  settings: Omit<DuckingSettings, 'enabled, '>;
}

const DUCKING_PRESETS: DuckingPreset[] = [
  {
    name: 'Podcast',
    description: 'Standard podcast ducking - clear dialogue',
    settings: { amount: -6, attack: 0.1, release: 0.5, threshold: -40 }
  },
  {
    name: 'Radio',
    description: 'Radio-style ducking - fast and aggressive',
    settings: { amount: -9, attack: 0.05, release: 0.3, threshold: -35 }
  },
  {
    name: 'Film/TV',
    description: 'Cinematic ducking - smooth and natural',
    settings: { amount: -4, attack: 0.2, release: 1.0, threshold: -40 }
  },
  {
    name: 'YouTube',
    description: 'YouTube-style ducking - balanced',
    settings: { amount: -6, attack: 0.1, release: 0.5, threshold: -38 }
  },
  {
    name: 'Audiobook',
    description: 'Audiobook ducking - gentle background music',
    settings: { amount: -8, attack: 0.15, release: 0.8, threshold: -42 }
  },
  {
    name: 'Live Stream',
    description: 'Live streaming - quick response',
    settings: { amount: -7, attack: 0.05, release: 0.4, threshold: -36 }
  },
  {
    name: 'Subtle',
    description: 'Minimal ducking - music stays prominent',
    settings: { amount: -3, attack: 0.05, release: 0.3, threshold: -40 }
  },
  {
    name: 'Aggressive',
    description: 'Heavy ducking - dialogue dominates',
    settings: { amount: -12, attack: 0.2, release: 1.0, threshold: -40 }
  }
];

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
  blue: '#3b82f6',
  dark: '#1a1a1a',
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
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  // Use persistence hooks
  const { presets: userDuckingPresets, isLoading: loadingDuckingPresets, savePreset: saveDuckingPreset } = useDuckingPresets();
  const { presets: userEQPresets, savePreset: saveEQPreset } = useEQPresets();
  const { saveSettings: saveMixerSettings } = useMixerSettings();

  // Combine system presets with user presets
  const [duckingPresets, setDuckingPresets] = useState<DuckingPreset[]>(DUCKING_PRESETS);

  // Load ducking presets from backend (system + user)
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const response = await fetch('/api/audio-enhancement/ducking-presets');
        if (response.ok) {
          const data = await response.json();
          if (data.presets) {
            const presetsArray = Object.entries(data.presets).map(([key, preset]: [string, any]) => ({
              name: preset.name,
              description: preset.description || ', ',
              settings: {
                amount: preset.amount,
                attack: preset.attack,
                release: preset.release,
                threshold: preset.threshold
              }
            }));

            // Combine system presets with user presets
            const allPresets = [...presetsArray, ...userDuckingPresets.map((p: any) => ({
              name: p.name,
              description: p.description || ', ',
              settings: {
                amount: p.amount,
                attack: p.attack,
                release: p.release,
                threshold: p.threshold
              }
            }))];

            setDuckingPresets(allPresets);
          }
        }
      } catch (error) {
        console.error('Failed to load ducking presets: ', error);
        // Keep default presets
      }
    };

    loadPresets();
  }, [userDuckingPresets]);

  const handleVolumeChange = (trackId: string, volume: number) => {
    onTracksChange(tracks.map(t =>
      t.id === trackId ? { ...t, volume } : t
    ));
  };

  const handleMuteToggle = (trackId: string) => {
    onTracksChange(tracks.map(t =>
      t.id === trackId ? { ...t, muted: !t.muted } : t
    ));
  };

  const handleSoloToggle = (trackId: string) => {
    onTracksChange(tracks.map(t =>
      t.id === trackId ? { ...t, solo: !t.solo } : t
    ));
  };

  const handleTargetLUFSChange = (trackId: string, lufs: number) => {
    onTracksChange(tracks.map(t =>
      t.id === trackId ? { ...t, targetLUFS: lufs } : t
    ));
  };

  const handleEQChange = (trackId: string, eqType: 'lowGain' | 'midGain' | 'highGain', value: number) => {
    onTracksChange(tracks.map(t =>
      t.id === trackId ? { ...t, eq: { ...t.eq, [eqType]: value } } : t
    ));
  };

  const handleEQToggle = (trackId: string) => {
    onTracksChange(tracks.map(t =>
      t.id === trackId ? { ...t, eq: { ...t.eq, enabled: !t.eq.enabled } } : t
    ));
  };

  const handlePresetChange = (presetName: string) => {
    const preset = duckingPresets.find(p => p.name === presetName);
    if (preset) {
      setSelectedPreset(presetName);
      onDuckingChange({
        enabled: true,
        ...preset.settings
      });
    }
  };

  const getTrackIcon = (type: string) => {
    switch (type) {
      case 'dialogue': return <RecordVoiceOver />;
      case 'music': return <MusicNote />;
      case 'sfx': return <Hearing />;
      default: return <GraphicEq />;
    }
  };

  const getTrackColor = (type: string) => {
    switch (type) {
      case 'dialogue': return BRAND_COLORS.blue;
      case 'music': return BRAND_COLORS.purple;
      case 'sfx': return BRAND_COLORS.orange;
      default: return '#666';
    }
  };

  return (
    <>
      {/* CSS Animation for peaking indicator */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1a1a1a' }}>
      {/* Header */}
      <Paper sx={{ p: 2, bgcolor: '#2a2a2a', borderRadius: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <GraphicEq sx={{ color: BRAND_COLORS.purple }} />
            <Typography variant="h6" sx={{ color: 'white' }}>
              Audio Mixer
            </Typography>
            <Chip 
              label={`${tracks.length} Tracks`}
              size="small"
              sx={{ bgcolor: 'rgba(147, 51, 234, 0.2)', color: 'white' }}
            />
          </Stack>
          
          {/* Transport Controls */}
          <Stack direction="row" spacing={1}>
            <IconButton 
              onClick={onPlayPause}
              sx={{ 
                color: 'white',
                bgcolor: isPlaying ? 'rgba(76, 175, 80, 0.2)' : 'transparent'
              }}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
            <IconButton onClick={onStop} sx={{ color: 'white' }}>
              <Stop />
            </IconButton>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
            <Button
              variant="outlined"
              size="small"
              onClick={onPreview}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
            >
              Preview Mix
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={onMix}
              sx={{
                background: `linear-gradient(135deg, ${BRAND_COLORS.orange} 0%, ${BRAND_COLORS.purple} 100%)`}}
            >
              Create Mix
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Mixer Channels */}
        <Box sx={{ flexGrow: 1, p: 2, overflowX: 'auto', overflowY: 'hidden' }}>
          <Stack direction="row" spacing={2} sx={{ height: '100%' }}>
            {tracks.map((track) => (
              <Paper
                key={track.id}
                sx={{
                  width: 120,
                  height: '100%',
                  bgcolor: selectedTrack === track.id ? 'rgba(147, 51, 234, 0.1)' : '#2a2a2a',
                  border: selectedTrack === track.id ? '2px solid #9333ea' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s', '&:hover': {
                    bgcolor: 'rgba(147, 51, 234, 0.05)',
                  }
                }}
                onClick={() => setSelectedTrack(track.id)}
              >
                <Stack sx={{ height: '100%', p: 1 }} spacing={1}>
                  {/* Track Header */}
                  <Box sx={{ textAlign: 'center' }}>
                    <Box sx={{ color: getTrackColor(track.type), mb: 0.5 }}>
                      {getTrackIcon(track.type)}
                    </Box>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'white', 
                        fontWeight: 600,
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {track.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                      {track.type.toUpperCase()}
                    </Typography>
                  </Box>

                  {/* Fader */}
                  <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', py: 2 }}>
                    <Slider
                      orientation="vertical"
                      value={track.volume}
                      onChange={(_, value) => handleVolumeChange(track.id, value as number)}
                      min={0}
                      max={100}
                      sx={{
                        color: getTrackColor(track.type),
                        '& .MuiSlider-thumb': {
                          width: 20,
                          height: 20,
                        }, '& .MuiSlider-track': {
                          width: 4,
                        }, '& .MuiSlider-rail': {
                          width: 4,
                          bgcolor: 'rgba(255,255,255,0.1)',
                        }
                      }}
                    />
                  </Box>

                  {/* Volume Display */}
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'white', 
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem'
                    }}
                  >
                    {track.volume}%
                  </Typography>

                  {/* Mute/Solo Buttons */}
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMuteToggle(track.id);
                      }}
                      sx={{
                        color: track.muted ? '#f44336' : 'rgba(255,255,255,0.5)',
                        bgcolor: track.muted ? 'rgba(244, 67, 54, 0.2)' : 'transparent','&:hover': {
                          bgcolor: 'rgba(244, 67, 54, 0.3)',
                        }
                      }}
                    >
                      {track.muted ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
                    </IconButton>
                    <Chip
                      label="S"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSoloToggle(track.id);
                      }}
                      sx={{
                        height: 24,
                        width: 24,
                        fontSize: '0.7rem',
                        bgcolor: track.solo ? 'rgba(255, 193, 7, 0.3)' : 'rgba(255,255,255,0.1)',
                        color: track.solo ? '#ffc107' : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer','&:hover': {
                          bgcolor: 'rgba(255, 193, 7, 0.2)',
                        }
                      }}
                    />
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>

        {/* Settings Panel */}
        <Paper sx={{ width: 320, bgcolor: '#2a2a2a', p: 2, overflowY: 'auto' }}>
          <Stack spacing={3}>
            {/* Selected Track Settings */}
            {selectedTrack && (() => {
              const track = tracks.find(t => t.id === selectedTrack);
              if (!track) return null;

              return (
                <Card sx={{ bgcolor: '#1a1a1a' }}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ color: getTrackColor(track.type) }}>
                          {getTrackIcon(track.type)}
                        </Box>
                        <Typography variant="subtitle2" sx={{ color: 'white' }}>
                          {track.name}
                        </Typography>
                      </Box>

                      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />

                      {/* Waveform Visualization with Peak Indicators */}
                      {track.waveformData && track.waveformData.length > 0 && (
                        <Box>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ShowChart fontSize="small" />
                            Waveform
                            {track.isPeaking && (
                              <Chip
                                label="PEAKING"
                                size="small"
                                sx={{
                                  bgcolor: '#ef4444',
                                  color: '#fff',
                                  height: 16,
                                  fontSize: '0.65rem',
                                  fontWeight: 'bold',
                                  animation: 'pulse 1s infinite'
                                }}
                              />
                            )}
                          </Typography>
                          <Box sx={{
                            height: 80,
                            bgcolor: '#0a0a0a',
                            borderRadius: 1,
                            mt: 1,
                            position: 'relative',
                            overflow: 'hidden',
                            border: track.isPeaking ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)'
                          }}>
                            {/* Peak threshold line (0.95) */}
                            <Box sx={{
                              position: 'absolute',
                              top: '5%',
                              left: 0,
                              right: 0,
                              height: 1,
                              bgcolor: 'rgba(239, 68, 68, 0.3)',
                              zIndex: 1}} />
                            <Box sx={{
                              position: 'absolute',
                              bottom: '5%',
                              left: 0,
                              right: 0,
                              height: 1,
                              bgcolor: 'rgba(239, 68, 68, 0.3)',
                              zIndex: 1}} />

                            {/* Waveform */}
                            <svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0 }}>
                              {/* Gradient definition */}
                              <defs>
                                <linearGradient id={`waveGradient-${track.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                                  <stop offset="5%" stopColor={getTrackColor(track.type)} stopOpacity="1" />
                                  <stop offset="50%" stopColor={getTrackColor(track.type)} stopOpacity="1" />
                                  <stop offset="95%" stopColor={getTrackColor(track.type)} stopOpacity="1" />
                                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
                                </linearGradient>
                              </defs>

                              {/* Waveform polyline */}
                              <polyline
                                points={track.waveformData.map((val, i) =>
                                  `${(i / track.waveformData!.length) * 100}%,${50 - val * 45}%`
                                ).join('')}
                                fill="none"
                                stroke={`url(#waveGradient-${track.id})`}
                                strokeWidth="2"
                              />

                              {/* Peak indicators (red dots for values > 0.95) */}
                              {track.waveformData.map((val, i) => {
                                if (val > 0.95) {
                                  return (
                                    <circle
                                      key={i}
                                      cx={`${(i / track.waveformData!.length) * 100}%`}
                                      cy={`${50 - val * 45}%`}
                                      r="2"
                                      fill="#ef4444"
                                    />
                                  );
                                }
                                return null;
                              })}
                            </svg>

                            {/* Level labels */}
                            <Typography variant="caption" sx={{
                              position: 'absolute',
                              top: 2,
                              right: 4,
                              color: 'rgba(239, 68, 68, 0.6)',
                              fontSize: '0.65rem'
                            }}>
                              0 dB
                            </Typography>
                            <Typography variant="caption" sx={{
                              position: 'absolute',
                              bottom: 2,
                              right: 4,
                              color: 'rgba(239, 68, 68, 0.6)',
                              fontSize: '0.65rem'
                            }}>
                              0 dB
                            </Typography>
                          </Box>

                          {/* Peak level indicator */}
                          {track.peakLevel !== undefined && (
                            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 60 }}>
                                Peak:
                              </Typography>
                              <Box sx={{ flex: 1, height: 4, bgcolor: '#0a0a0a', borderRadius: 2, overflow: 'hidden' }}>
                                <Box sx={{
                                  width: `${track.peakLevel * 100}%`,
                                  height: '100%',
                                  bgcolor: track.peakLevel > 0.95 ? '#ef4444' : track.peakLevel > 0.8 ? '#f59e0b' : '#16a34a',
                                  transition: 'width 0.1s, background-color 0.2s'
                                }} />
                              </Box>
                              <Typography variant="caption" sx={{
                                color: track.peakLevel > 0.95 ? '#ef4444' : track.peakLevel > 0.8 ? '#f59e0b' : '#16a34a',
                                minWidth: 50,
                                fontWeight: 'bold'
                              }}>
                                {(track.peakLevel * 100).toFixed(0)}%
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}

                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Target Loudness (LUFS)
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                          <Slider
                            value={track.targetLUFS}
                            onChange={(_, value) => handleTargetLUFSChange(track.id, value as number)}
                            min={-30}
                            max={-10}
                            step={0.5}
                            marks={[
                              { value: -23, label: '-23' },
                              { value: -16, label: '-16' },
                            ]}
                            sx={{
                              color: getTrackColor(track.type), '& .MuiSlider-markLabel': {
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '0.65rem'
                              }
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'white',
                              fontFamily: 'monospace',
                              minWidth: 50,
                              textAlign: 'right'
                            }}
                          >
                            {track.targetLUFS.toFixed(1)}
                          </Typography>
                        </Stack>
                      </Box>

                      {/* EQ Controls */}
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Equalizer fontSize="small" />
                            3-Band EQ
                          </Typography>
                          <Switch
                            size="small"
                            checked={track.eq.enabled}
                            onChange={() => handleEQToggle(track.id)}
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': {
                                color: getTrackColor(track.type),
                              }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                backgroundColor: getTrackColor(track.type),
                              }}}
                          />
                        </Box>

                        {track.eq.enabled && (
                          <Stack spacing={1.5}>
                            {/* Low EQ */}
                            <Box>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                Low (80Hz)
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Slider
                                  value={track.eq.lowGain}
                                  onChange={(_, value) => handleEQChange(track.id, 'lowGain', value as number)}
                                  min={-12}
                                  max={12}
                                  step={0.5}
                                  marks={[
                                    { value: -12, label: '-12' },
                                    { value: 0, label: '0' },
                                    { value: 12, label: '+12' },
                                  ]}
                                  sx={{
                                    color: '#ef4444','& .MuiSlider-markLabel': {
                                      color: 'rgba(255,255,255,0.3)',
                                      fontSize: '0.6rem'
                                    }
                                  }}
                                />
                                <Typography variant="caption" sx={{ color: 'white', fontFamily: 'monospace', minWidth: 45, textAlign: 'right' }}>
                                  {track.eq.lowGain > 0 ? '+' : ', '}{track.eq.lowGain.toFixed(1)}
                                </Typography>
                              </Stack>
                            </Box>

                            {/* Mid EQ */}
                            <Box>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                Mid (1kHz)
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Slider
                                  value={track.eq.midGain}
                                  onChange={(_, value) => handleEQChange(track.id, 'midGain', value as number)}
                                  min={-12}
                                  max={12}
                                  step={0.5}
                                  marks={[
                                    { value: -12, label: '-12' },
                                    { value: 0, label: '0' },
                                    { value: 12, label: '+12' },
                                  ]}
                                  sx={{
                                    color: '#22c55e','& .MuiSlider-markLabel': {
                                      color: 'rgba(255,255,255,0.3)',
                                      fontSize: '0.6rem'
                                    }
                                  }}
                                />
                                <Typography variant="caption" sx={{ color: 'white', fontFamily: 'monospace', minWidth: 45, textAlign: 'right' }}>
                                  {track.eq.midGain > 0 ? '+' : ', '}{track.eq.midGain.toFixed(1)}
                                </Typography>
                              </Stack>
                            </Box>

                            {/* High EQ */}
                            <Box>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>
                                High (8kHz)
                              </Typography>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Slider
                                  value={track.eq.highGain}
                                  onChange={(_, value) => handleEQChange(track.id, 'highGain', value as number)}
                                  min={-12}
                                  max={12}
                                  step={0.5}
                                  marks={[
                                    { value: -12, label: '-12' },
                                    { value: 0, label: '0' },
                                    { value: 12, label: '+12' },
                                  ]}
                                  sx={{
                                    color: '#3b82f6','& .MuiSlider-markLabel': {
                                      color: 'rgba(255,255,255,0.3)',
                                      fontSize: '0.6rem'
                                    }
                                  }}
                                />
                                <Typography variant="caption" sx={{ color: 'white', fontFamily: 'monospace', minWidth: 45, textAlign: 'right' }}>
                                  {track.eq.highGain > 0 ? '+' : ','}{track.eq.highGain.toFixed(1)}
                                </Typography>
                              </Stack>
                            </Box>
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Music Ducking Settings */}
            <Card sx={{ bgcolor: '#1a1a1a' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle2" sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MusicNote fontSize="small" />
                      Music Ducking
                    </Typography>
                    <Switch
                      checked={duckingSettings.enabled}
                      onChange={(e) => onDuckingChange({ ...duckingSettings, enabled: e.target.checked })}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: BRAND_COLORS.purple,
                        }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: BRAND_COLORS.purple,
                        }}}
                    />
                  </Box>

                  {duckingSettings.enabled && (
                    <>
                      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />

                      {/* Duck Amount */}
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Duck Amount (dB)
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                          <Slider
                            value={duckingSettings.amount}
                            onChange={(_, value) => onDuckingChange({ ...duckingSettings, amount: value as number })}
                            min={-12}
                            max={0}
                            step={0.5}
                            marks={[
                              { value: -12, label: '-12' },
                              { value: -6, label: '-6' },
                              { value: 0, label: '0' },
                            ]}
                            sx={{
                              color: BRAND_COLORS.purple, '& .MuiSlider-markLabel': {
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '0.65rem'
                              }
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'white',
                              fontFamily: 'monospace',
                              minWidth: 50,
                              textAlign: 'right'
                            }}
                          >
                            {duckingSettings.amount.toFixed(1)} dB
                          </Typography>
                        </Stack>
                      </Box>

                      {/* Attack Time */}
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Attack Time (seconds)
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                          <Slider
                            value={duckingSettings.attack}
                            onChange={(_, value) => onDuckingChange({ ...duckingSettings, attack: value as number })}
                            min={0.01}
                            max={1.0}
                            step={0.01}
                            marks={[
                              { value: 0.01, label: '0.01' },
                              { value: 0.5, label: '0.5' },
                              { value: 1.0, label: '1.0' },
                            ]}
                            sx={{
                              color: BRAND_COLORS.orange, '& .MuiSlider-markLabel': {
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '0.65rem'
                              }
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'white',
                              fontFamily: 'monospace',
                              minWidth: 50,
                              textAlign: 'right'
                            }}
                          >
                            {duckingSettings.attack.toFixed(2)}s
                          </Typography>
                        </Stack>
                      </Box>

                      {/* Release Time */}
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Release Time (seconds)
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                          <Slider
                            value={duckingSettings.release}
                            onChange={(_, value) => onDuckingChange({ ...duckingSettings, release: value as number })}
                            min={0.1}
                            max={2.0}
                            step={0.1}
                            marks={[
                              { value: 0.1, label: '0.1' },
                              { value: 1.0, label: '1.0' },
                              { value: 2.0, label: '2.0' },
                            ]}
                            sx={{
                              color: BRAND_COLORS.green, '& .MuiSlider-markLabel': {
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '0.65rem'
                              }
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'white',
                              fontFamily: 'monospace',
                              minWidth: 50,
                              textAlign: 'right'
                            }}
                          >
                            {duckingSettings.release.toFixed(1)}s
                          </Typography>
                        </Stack>
                      </Box>

                      {/* Threshold */}
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Dialogue Threshold (dB)
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                          <Slider
                            value={duckingSettings.threshold}
                            onChange={(_, value) => onDuckingChange({ ...duckingSettings, threshold: value as number })}
                            min={-60}
                            max={0}
                            step={1}
                            marks={[
                              { value: -60, label: '-60' },
                              { value: -40, label: '-40' },
                              { value: 0, label: '0' },
                            ]}
                            sx={{
                              color: BRAND_COLORS.blue, '& .MuiSlider-markLabel': {
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: '0.65rem'
                              }
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'white',
                              fontFamily: 'monospace',
                              minWidth: 50,
                              textAlign: 'right'
                            }}
                          >
                            {duckingSettings.threshold} dB
                          </Typography>
                        </Stack>
                      </Box>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Presets */}
            <Card sx={{ bgcolor: '#1a1a1a' }}>
              <CardContent>
                <Typography variant="subtitle2" sx={{ color: 'white', mb: 2 }}>
                  Ducking Presets
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>Select Preset</InputLabel>
                  <Select
                    value={selectedPreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    label="Select Preset"
                    sx={{
                      color: 'white','.MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      }, '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.5)',
                      }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: BRAND_COLORS.purple,
                      },
                      '.MuiSvgIcon-root': {
                        color: 'white',
                      }
                    }}
                  >
                    <MenuItem value="">
                      <em>Custom Settings</em>
                    </MenuItem>
                    {duckingPresets.map((preset) => (
                      <MenuItem key={preset.name} value={preset.name}>
                        <Box>
                          <Typography variant="body2">{preset.name}</Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.6)' }}>
                            {preset.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Quick Preset Buttons */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mb: 1, display: 'block' }}>
                    Quick Access:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {['Podcast','Radio','Film/TV','YouTube'].map((presetName) => (
                      <Chip
                        key={presetName}
                        label={presetName}
                        size="small"
                        onClick={() => handlePresetChange(presetName)}
                        sx={{
                          bgcolor: selectedPreset === presetName ? BRAND_COLORS.purple : 'rgba(255,255,255,0.1)',
                          color: 'white',
                          cursor: 'pointer', '&:hover': {
                            bgcolor: selectedPreset === presetName ? BRAND_COLORS.purple :'rgba(255,255,255,0.2)',
                          }
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Paper>
      </Box>
    </Box>
    </>
  );
}

